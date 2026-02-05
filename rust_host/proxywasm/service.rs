use crate::host::{dictionary, stats};
use anyhow::{Context, Error, Result};
use fastedge_proxywasm::action::{
    CONTINUE, EXECUTION_PANIC, EXECUTION_TIMEOUT, INTERNAL_ERROR, NOT_ACCEPTABLE, NOT_FOUND,
    OUT_OF_MEMORY, TOO_MANY_REQUESTS,
};
use fastedge_proxywasm::{
    AdditionalInfo, MapType, RequestId, WasmBytes,
    v2::{Handler, Host as HostFunction},
};
use futures::stream::StreamExt;
use futures::{SinkExt, Stream};
#[cfg(feature = "metrics")]
use lazy_static::lazy_static;
#[cfg(feature = "metrics")]
use prometheus::{
    Histogram, IntCounter, IntCounterVec, register_histogram, register_int_counter,
    register_int_counter_vec,
};
use runtime::app::Status;
use runtime::service::Service;
#[cfg(feature = "metrics")]
use runtime::util::metrics;
use runtime::{AppResult, ContextT, Router, WasmEngine, WasmEngineBuilder};
use shellflip::{ShutdownHandle, ShutdownSignal};
use std::collections::{HashMap, HashSet};
use std::os::fd::OwnedFd;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::{Arc, Weak};
use std::time::Duration;
use tokio_util::codec::Framed;

use fastedge_proxywasm::v1::{NginxMessage, WasmMessage};

use crate::executor::ExecutorFactory;
use crate::host;
use crate::host::proxy::{HostResponse, Proxy, ProxyCommand};
use crate::host::{HostCommand, key_value, secret};

use fastedge_proxywasm::v2::{CodecError, Host, HostError, ProxyStatus};
use fastedge_proxywasm::{HandshakeMessage, ProxyMessage, Version};
use runtime::store::HasStats;
use runtime::util::stats::StatsVisitor;
use smol_str::{SmolStr, ToSmolStr};
#[cfg(unix)]
use std::os::fd::AsRawFd;
use tokio::net::UnixListener;
use tokio::sync::Mutex;
use tokio::time::Instant;
use tokio::{
    io::{AsyncRead, AsyncWrite},
    time::timeout,
};
use tokio_util::bytes::Buf;
use tracing::instrument;

#[cfg(feature = "metrics")]
lazy_static! {
    /// Histogram to track request_reply duration in seconds
    static ref PROXYWASM_REQUEST_REPLY_DURATION: Histogram = register_histogram!(
        "fastedge_wasm_request_reply_duration",
        "Duration of ProxyWasmHost request_reply calls in microseconds",
        vec![100.0, 250.0, 500.0, 1000.0, 2500.0, 5000.0, 10000.0, 25000.0, 100000.0]
    )
    .unwrap();

    /// Counter to track command method invocations
    static ref PROXYWASM_COMMANDS: IntCounter = register_int_counter!(
        "fastedge_wasm_commands_total",
        "Total number of ProxyWasmHost command method invocations"
    )
    .unwrap();

    /// Counter to track request_reply errors by status
    static ref PROXYWASM_REQUEST_REPLY_ERRORS: IntCounterVec = register_int_counter_vec!(
        "fastedge_wasm_request_reply_errors",
        "Total number of ProxyWasmHost request_reply errors by status",
        &["status"]
    )
    .unwrap();
}

pub struct ProxyWasmConfig {
    pub path: PathBuf,
    pub backoff: u64,
    pub cancel: Weak<ShutdownHandle>,
    pub listen_fd: Option<OwnedFd>,
}

pub struct ProxyWasmService<T, C: 'static> {
    engine: WasmEngine<Proxy<C>>,
    context: T,
    stats_cache: mini_moka::sync::Cache<SmolStr, Arc<dyn StatsVisitor>>,
}

#[derive(Clone)]
pub struct ProxyWasmHost {
    version: Version,
    request_id: RequestId,
    additional_info: Arc<Mutex<Option<AdditionalInfo>>>,
    tx: tokio::sync::mpsc::Sender<ProxyCommand>,
}

#[async_trait::async_trait]
impl HostCommand for ProxyWasmHost {
    fn new(
        version: Version,
        request_id: RequestId,
        additional_info: Option<AdditionalInfo>,
        tx: tokio::sync::mpsc::Sender<ProxyCommand>,
    ) -> Self {
        Self {
            version,
            request_id,
            additional_info: Arc::new(Mutex::new(additional_info)),
            tx,
        }
    }

    async fn command(&self, message: HostFunction) -> Result<(), HostError> {
        tracing::trace!(?message, "send");
        match self.version {
            Version::V1 | Version::V2a => {
                if let Some(additional_info) = self.additional_info.lock().await.as_mut() {
                    match &message {
                        Host::AddMapValue {
                            map_type,
                            key,
                            value,
                        } if *map_type == MapType::HttpRequestHeaders => {
                            additional_info.add_request_header_value(key.clone(), value.clone());
                        }
                        Host::ReplaceMapValue {
                            map_type,
                            key,
                            value,
                        } if *map_type == MapType::HttpRequestHeaders => {
                            additional_info.replace_request_header_value(key, value.clone());
                        }
                        Host::RemoveMapValue { map_type, key }
                            if *map_type == MapType::HttpRequestHeaders =>
                        {
                            additional_info.remove_request_header_value(key);
                        }
                        Host::SetMapPairs { map_type, map }
                            if *map_type == MapType::HttpRequestHeaders =>
                        {
                            additional_info.set_request_headers(map.clone());
                        }
                        _ => {}
                    }
                }

                #[cfg(feature = "metrics")]
                PROXYWASM_COMMANDS.inc();

                self.tx
                    .send(ProxyCommand {
                        request_id: self.request_id,
                        reply: None,
                        message,
                    })
                    .await
                    .map_err(|e| HostError::InternalFailure(e.to_string()))
            }

            Version::V2 => {
                let _ = self.request_reply(message).await?;
                Ok(())
            }
        }
    }

    async fn request_reply(&self, message: HostFunction) -> Result<WasmBytes, HostError> {
        tracing::trace!(?message, "send");

        if let Some(additional_info) = self.additional_info.lock().await.as_mut() {
            match &message {
                Host::GetMapPairs { map_type } if *map_type == MapType::HttpRequestHeaders => {
                    return Ok(additional_info.get_request_headers());
                }
                Host::GetMapValue { map_type, key } if *map_type == MapType::HttpRequestHeaders => {
                    if let Some(value) = additional_info.get_request_header_value(key) {
                        return Ok(value);
                    } else {
                        return Err(HostError::NotFound(format!(
                            "header key not found: {:?}",
                            key
                        )));
                    }
                }
                Host::GetProperty { path } => {
                    if let Some(value) = additional_info.get_property_value(path) {
                        return Ok(value);
                    } else {
                        // Property not found in additional_info, proceed to send the request
                        tracing::debug!("property path not found: {:?}", path);
                    }
                }
                _ => {}
            }
        }

        let (tx, rx) = tokio::sync::oneshot::channel();
        self.tx
            .send(ProxyCommand {
                request_id: self.request_id,
                reply: Some(tx),
                message,
            })
            .await
            .map_err(|e| HostError::InternalFailure(e.to_string()))?;

        #[cfg(feature = "metrics")]
        let start = Instant::now();

        let result = match timeout(Duration::from_millis(200), rx).await {
            Ok(Ok((status, res))) => {
                if status == ProxyStatus::Ok {
                    Ok(res)
                } else {
                    Err(HostError::from(status))
                }
            }
            Ok(Err(error)) => Err(HostError::InternalFailure(error.to_string())),
            Err(error) => {
                tracing::warn!(%error, "timed out waiting for reply");
                //Err(HostError::InternalFailure(error.to_string()))
                Ok(WasmBytes::new())
            }
        };

        #[cfg(feature = "metrics")]
        {
            let duration = start.elapsed();
            PROXYWASM_REQUEST_REPLY_DURATION.observe(duration.as_micros() as f64);

            // Track errors by status
            if let Err(ref err) = result {
                let status = match err {
                    HostError::InternalFailure(_) => "internal_failure",
                    HostError::InvalidMemoryAccess(_) => "invalid_memory_access",
                    HostError::SerializationFailure(_) => "serialization_failure",
                    HostError::ParseFailure(_) => "parse_failure",
                    HostError::BadArgument(_) => "bad_argument",
                    HostError::NotFound(_) => "not_found",
                    HostError::Empty(_) => "empty",
                    HostError::CasMismatch(_) => "cas_mismatch",
                    HostError::Unimplemented(_) => "unimplemented",
                    HostError::Utf8Error(_) => "utf8_error",
                    HostError::HeaderNameError(_) => "header_name_error",
                };
                PROXYWASM_REQUEST_REPLY_ERRORS
                    .with_label_values(&[status])
                    .inc();
            }
        }

        result
    }
}

impl<T, C> Service for ProxyWasmService<T, C>
where
    T: ContextT + Router + ExecutorFactory<C> + Sync + Send + 'static,
    C: HostCommand + Clone + Send + Sync + 'static,
{
    type State = Proxy<C>;
    type Config = ProxyWasmConfig;
    type Context = T;

    fn new(engine: WasmEngine<Self::State>, context: Self::Context) -> Result<Self> {
        let stats_cache = mini_moka::sync::Cache::builder()
            .time_to_idle(Duration::from_secs(1))
            .build();
        Ok(Self {
            engine,
            context,
            stats_cache,
        })
    }

    async fn run(self, config: ProxyWasmConfig) -> Result<()> {
        #[cfg(unix)]
        use std::os::unix::net::UnixListener as StdUnixListener;

        let listener = if let Some(fd) = config.listen_fd {
            let listener = StdUnixListener::from(fd);
            listener.set_nonblocking(true)?;
            UnixListener::from_std(listener)?
        } else {
            let _ = tokio::fs::remove_file(&config.path).await;
            UnixListener::bind(&config.path)?
        };
        tracing::info!("Listening on {:?}", listener.local_addr()?);
        let mut backoff = 1;
        let self_ = Arc::new(self);
        loop {
            match listener.accept().await {
                Ok((stream, _)) => {
                    #[cfg(unix)]
                    let fd = stream.as_raw_fd() as u32;
                    #[cfg(not(unix))]
                    let fd: u32 = 0;

                    tracing::info!("new uds connection: {}", fd);

                    let connection = self_.clone();
                    if let Some(cancel) = config.cancel.upgrade() {
                        tokio::spawn(connection.serve(fd, stream, cancel));
                        backoff = 1;
                    } else {
                        tracing::debug!("weak cancel handler");
                        backoff *= 2;
                    }
                }
                Err(error) => {
                    tracing::warn!(cause=?error, "unix domain accept error");
                    tokio::time::sleep(Duration::from_millis(backoff * 100)).await;
                    if backoff > config.backoff {
                        backoff = 1;
                    } else {
                        backoff *= 2;
                    }
                }
            }
        }
    }

    fn configure_engine(builder: &mut WasmEngineBuilder<Self::State>) -> Result<()> {
        let module_linker = builder.module_linker_ref();
        // link wasi preview1 ctx
        wasmtime_wasi::preview1::add_to_linker_async(module_linker, |data| {
            data.preview1_wasi_ctx_mut()
        })?;

        // link proxywasm host functions
        host::add_to_linker(module_linker, |data| data)?;

        // link proxywasm secret functions
        secret::add_to_linker(module_linker, |data| &mut data.secret_store)?;

        // link proxywasm key-value store functions
        key_value::add_to_linker(module_linker, |data| &mut data.key_value_store)?;

        // link proxywasm dictionary functions
        dictionary::add_to_linker(module_linker, |data| &mut data.dictionary)?;

        // link proxywasm stats functions
        stats::add_to_linker(module_linker, |data| data.as_ref().get_stats())?;

        Ok(())
    }
}

#[cfg(feature = "metrics")]
const PROXYWASM_LABEL: &[&str; 1] = &["proxywasm"];
const SUPPORTED_VERSIONS: [u32; 3] = [0x01, 0x02, 0x2a];

impl<T, C> ProxyWasmService<T, C>
where
    T: ContextT + Router + ExecutorFactory<C> + Sync + Send + 'static,
    C: HostCommand + Clone + Send + Sync + 'static,
{
    #[instrument(level = "info", skip(self, stream, cancel))]
    async fn serve<S>(self: Arc<Self>, fd: u32, stream: S, cancel: Arc<ShutdownHandle>)
    where
        S: AsyncRead + AsyncWrite + Unpin,
    {
        use fastedge_proxywasm::ProxyWasmCodec;

        let mut signal = ShutdownSignal::from(cancel.as_ref());
        let mut stream = Framed::new(stream, ProxyWasmCodec::server());

        let version = tokio::select! {
            ret = handshake(&mut stream) => {
                match ret {
                    Ok(version) => version,
                    Err(error) => {
                        tracing::warn!(?error, "handshake failed");
                        return;
                    }
                }
            }
            _ = signal.on_shutdown() => {
                tracing::debug!("cancelled connection");
                return;
            }
        };

        match version {
            Version::V1 => {
                tokio::select! {
                    ret = self.serve_v1(fd, &mut stream) => {
                        if let Err(error) = ret {
                            tracing::warn!(cause=?error, "serve v1");
                        }
                    }
                    _ = signal.on_shutdown() => {
                        tracing::debug!("cancelled connection");
                    }
                }
            }
            Version::V2 => {
                tokio::select! {
                    ret = self.serve_v2(fd, &mut stream) => {
                        if let Err(error) = ret {
                            tracing::warn!(cause=?error, "serve v2");
                        }
                    }
                    _ = signal.on_shutdown() => {
                        tracing::debug!("cancelled connection");
                    }
                }
            }
            Version::V2a => {
                tokio::select! {
                    ret = self.serve_v2a(fd, &mut stream) => {
                        if let Err(error) = ret {
                            tracing::warn!(cause=?error, "serve v2a");
                        }
                    }
                    _ = signal.on_shutdown() => {
                        tracing::debug!("cancelled connection");
                    }
                }
            }
        }
    }

    async fn serve_v1<S>(self: Arc<Self>, fd: u32, stream: &mut S) -> Result<()>
    where
        S: Stream<Item = Result<ProxyMessage, CodecError>> + SinkExt<ProxyMessage> + Unpin,
    {
        let (tx, mut rx) = tokio::sync::mpsc::channel(1024);
        let mut reply_handlers: HashMap<RequestId, tokio::sync::oneshot::Sender<HostResponse>> =
            HashMap::new();

        loop {
            tokio::select! {
                msg = stream.next() => {
                    match msg {
                        Some(Ok(message)) => {
                            match message {
                                ProxyMessage::NginxMessage(request_id, NginxMessage::Request(app_name, request)) => {
                                    // Make a new service
                                    tokio::spawn({
                                        let self_ = self.clone();
                                        let proxy_command = C::new(Version::V1, request_id, None, tx.clone());
                                        let next_action_tx = tx.clone();
                                        async move {
                                            // Call the service
                                            let next_action = self_.handle_request(fd, proxy_command, app_name, request.into()).await ;

                                            let return_value = WasmBytes::copy_from_slice(&next_action.to_be_bytes());
                                            let message = HostFunction::Response {status: ProxyStatus::Empty, return_value};
                                            if let Err(error) = next_action_tx.send(ProxyCommand{request_id,reply: None, message}).await {
                                                tracing::warn!(cause=?error, "response send error");
                                            }
                                        }
                                    });
                                },

                                ProxyMessage::NginxMessage(request_id, NginxMessage::Response(res)) => {
                                    if let Some(tx) = reply_handlers.remove(&request_id) {
                                        if let Err(error) = tx.send((ProxyStatus::Ok, res.into())) {
                                             tracing::warn!(cause=?error, "send wasm response");
                                        }
                                    } else {
                                        tracing::warn!(?request_id, "unhandled wasm response");
                                    }
                                },


                                _ => {
                                    anyhow::bail!("unexpected message: {:?}", message);
                                }
                            }
                        },
                        Some(Err(error)) => {
                            anyhow::bail!("stream decode error: {:?}", error);
                        },
                        None => {
                            tracing::info!("uds stream closed");
                            return Ok(());
                        }
                    }
                },

                msg = rx.recv() => {
                    let Some(ProxyCommand{request_id,reply,message}) = msg else {
                        anyhow::bail!("duplex channel closed");
                    };

                    if let HostFunction::Response {status, mut return_value} = message {
                        if status == ProxyStatus::Empty && return_value.len() == size_of::<i32>() {
                            let next_action = return_value.get_i32();
                            if stream.send(ProxyMessage::WasmMessage(request_id, WasmMessage::NextAction(next_action))).await.is_err() {
                                anyhow::bail!("stream send error");
                            };
                        } else {
                            tracing::debug!(?status, ?return_value);
                        }
                    } else {
                        let msg = ProxyMessage::WasmMessage(request_id, message.into());
                        if (stream.send(msg).await).is_err() {
                            anyhow::bail!("stream send error");
                        };
                        if let Some(tx) = reply {
                            reply_handlers.insert(request_id, tx);
                        }
                    }
                }
            }
        }
    }

    async fn serve_v2<S>(self: Arc<Self>, fd: u32, stream: &mut S) -> Result<()>
    where
        S: Stream<Item = Result<ProxyMessage, CodecError>> + SinkExt<ProxyMessage> + Unpin,
    {
        use fastedge_proxywasm::v2::FilterCallback;

        let mut index: u32 = 0;

        while let Some(msg) = stream.next().await {
            let msg = msg.context("decode error")?;

            let ProxyMessage::FilterCallback(
                FilterCallback::Entrypoint {
                    application,
                    handler,
                },
                _additional_info,
                _request_id,
            ) = msg
            else {
                anyhow::bail!("unexpected message: {:?}", msg);
            };

            let (tx, mut rx) = tokio::sync::mpsc::channel(32);

            let next_action = tokio::spawn({
                index += 1;

                let self_ = self.clone();
                let proxy_command = C::new(
                    Version::V2,
                    RequestId {
                        index,
                        generation: 0,
                    },
                    None,
                    tx,
                );
                async move {
                    // Call the service
                    self_
                        .handle_request(fd, proxy_command.clone(), application as i64, handler)
                        .await
                }
            });

            while let Some(msg) = rx.recv().await {
                tracing::trace!(request=?msg.request_id, message=?msg.message);

                let proxy_message = ProxyMessage::HostFunction(msg.message, _request_id);
                if (stream.send(proxy_message).await).is_err() {
                    anyhow::bail!("stream send error");
                }

                if let Some(tx) = msg.reply {
                    let Some(msg) = stream.next().await else {
                        anyhow::bail!("connection closed");
                    };
                    let msg = msg.context("decode error")?;
                    let ProxyMessage::HostFunction(
                        Host::Response {
                            status,
                            return_value,
                        },
                        _request_id,
                    ) = msg
                    else {
                        anyhow::bail!("unexpected message: {:?}", msg);
                    };
                    if let Err(error) = tx.send((status, return_value)) {
                        anyhow::bail!("send host response error: {:?}", error);
                    }
                }
            }

            let next_action = next_action.await.map_err(|join_err| {
                if join_err.is_cancelled() {
                    anyhow::anyhow!("request handler task for request was cancelled")
                } else if join_err.is_panic() {
                    anyhow::anyhow!("request handler task for request panicked")
                } else {
                    anyhow::anyhow!("request handler task for request failed: {:?}", join_err)
                }
            })?;

            if (stream
                .send(ProxyMessage::FilterCallback(
                    FilterCallback::NextAction(next_action),
                    None,
                    None,
                ))
                .await)
                .is_err()
            {
                anyhow::bail!("stream send next_action error");
            }
        }

        Ok(())
    }

    async fn serve_v2a<S>(self: Arc<Self>, fd: u32, stream: &mut S) -> Result<()>
    where
        S: Stream<Item = Result<ProxyMessage, CodecError>> + SinkExt<ProxyMessage> + Unpin,
    {
        use fastedge_proxywasm::v2::FilterCallback;
        let (tx, mut rx) = tokio::sync::mpsc::channel(1024);
        let (next_action_tx, mut next_action_rx) = tokio::sync::mpsc::channel(1024);
        let mut reply_handlers: HashMap<RequestId, tokio::sync::oneshot::Sender<HostResponse>> =
            HashMap::new();

        loop {
            tokio::select! {
                msg = stream.next() => {
                    match msg {
                        Some(Ok(message)) => {
                            match message {
                                ProxyMessage::FilterCallback(FilterCallback::Entrypoint {application,handler}, additional_info,request_id) => {
                                    let Some(request_id) = request_id else {
                                        anyhow::bail!("missing request id");
                                    };
                                    // Make a new service
                                    tokio::spawn({
                                        let self_ = self.clone();
                                        let proxy_command = C::new(Version::V2a, request_id,  additional_info, tx.clone());
                                        let next_action_tx = next_action_tx.clone();
                                        async move {
                                            // Call the service
                                            let next_action = self_.handle_request(fd, proxy_command, application as i64, handler).await ;

                                            if let Err(error) = next_action_tx.send((request_id, next_action)).await {
                                                tracing::warn!(cause=?error, "response send error");
                                            }
                                        }
                                    });
                                },
                                ProxyMessage::HostFunction(HostFunction::Response {status,return_value}, request_id) => {

                                     let Some(request_id) = request_id else {
                                        anyhow::bail!("missing request id");
                                    };

                                    if let Some(tx) = reply_handlers.remove(&request_id) {
                                        if let Err(error) = tx.send((status, return_value)) {
                                             tracing::warn!(cause=?error, "send wasm response");
                                        }
                                    } else {
                                        tracing::warn!(?request_id, "unhandled wasm response");
                                    }
                                },
                                // handle host error sent by wasm module and terminate the connection since it's likely the module is in a bad state and cannot continue processing further requests
                                ProxyMessage::HostError(error) => {
                                    anyhow::bail!(String::from_utf8(error.to_vec()).unwrap_or_else(|_| format!("invalid host error: {:?}", error)));
                                },

                                _ => {
                                    anyhow::bail!("unexpected message: {:?}", message);
                                }
                            }
                        },
                        Some(Err(error)) => {
                            anyhow::bail!("stream decode error: {:?}", error);
                        },
                        None => {
                            tracing::info!("uds stream closed");
                            return Ok(());
                        }
                    }
                },

                Some((request_id, next_action)) = next_action_rx.recv() => {
                    if stream.send(ProxyMessage::FilterCallback(FilterCallback::NextAction(next_action), None, Some(request_id))).await.is_err() {
                        anyhow::bail!("stream send error");
                    };
                }

                msg = rx.recv() => {
                    let Some(ProxyCommand{request_id,reply,message}) = msg else {
                        anyhow::bail!("duplex channel closed");
                    };

                    let msg = ProxyMessage::HostFunction(message, Some(request_id));
                    if (stream.send(msg).await).is_err() {
                        anyhow::bail!("stream send error");
                    };

                    if let Some(tx) = reply {
                        reply_handlers.insert(request_id, tx);
                    }
                }
            }
        }
    }

    async fn handle_request(&self, fd: u32, host: C, app_id: i64, request: Handler) -> i32 {
        use tokio::time::error::Elapsed;
        use wasmtime::Trap;
        use wasmtime_wasi::I32Exit;

        // lookup for application config and binary_id
        tracing::debug!(fd, "Processing request for application with id: {}", app_id);
        let (app_name, cfg) = match self.context.lookup_by_id(app_id as u64).await {
            None => {
                #[cfg(feature = "metrics")]
                metrics::metrics(AppResult::UNKNOWN, PROXYWASM_LABEL, None, None);
                tracing::info!("Request for unknown application: {}", app_id);
                return NOT_FOUND;
            }
            Some((app_name, cfg))
                if cfg.status == Status::Draft || cfg.status == Status::Disabled =>
            {
                tracing::info!("Request for disabled application '{}'", app_name);
                return NOT_ACCEPTABLE;
            }
            Some((app_name, cfg)) if cfg.status == Status::RateLimited => {
                tracing::info!("Request for rate limited application '{}'", app_name);
                return TOO_MANY_REQUESTS;
            }

            Some(app_cfg) => app_cfg,
        };

        // get cached execute context for this application
        let executor = match self
            .context
            .get_executor(app_name.clone(), &cfg, &self.engine)
        {
            Ok(executor) => executor,
            Err(error) => {
                #[cfg(feature = "metrics")]
                metrics::metrics(AppResult::UNKNOWN, PROXYWASM_LABEL, None, None);
                tracing::warn!(cause=?error,
                    "failure on getting context"
                );
                return INTERNAL_ERROR;
            }
        };

        let request_id = traceparent(&host)
            .await
            .unwrap_or_else(|_| nanoid::nanoid!(10).to_smolstr());

        let stats = self.get_stats_row(&request, &request_id, &app_name, &cfg);

        match executor
            .execute(host, request_id, request, stats.clone())
            .await
        {
            Ok(next_action) => {
                #[cfg(feature = "metrics")]
                metrics::metrics(
                    AppResult::SUCCESS,
                    PROXYWASM_LABEL,
                    Some(stats.get_time_elapsed()),
                    Some(stats.get_memory_used()),
                );
                next_action
            }
            Err(error) => {
                tracing::warn!(cause=?error, "execution '{}' failed", app_name);
                let root_cause = error.root_cause();
                let (next_action, fail_reason) =
                    if let Some(exit) = root_cause.downcast_ref::<I32Exit>() {
                        if exit.0 == 0 {
                            (CONTINUE, AppResult::SUCCESS)
                        } else {
                            (EXECUTION_PANIC, AppResult::OTHER)
                        }
                    } else if let Some(trap) = root_cause.downcast_ref::<Trap>() {
                        match trap {
                            Trap::Interrupt => (EXECUTION_TIMEOUT, AppResult::TIMEOUT),
                            Trap::UnreachableCodeReached => (OUT_OF_MEMORY, AppResult::OOM),
                            _ => (EXECUTION_PANIC, AppResult::OTHER),
                        }
                    } else if let Some(_elapsed) = root_cause.downcast_ref::<Elapsed>() {
                        (EXECUTION_TIMEOUT, AppResult::TIMEOUT)
                    } else {
                        (INTERNAL_ERROR, AppResult::OTHER)
                    };

                tracing::trace!(?fail_reason, "stats");
                stats.status_code(next_action as u16);
                stats.fail_reason(fail_reason as u32);

                #[cfg(feature = "metrics")]
                metrics::metrics(
                    fail_reason,
                    PROXYWASM_LABEL,
                    Some(stats.get_time_elapsed()),
                    None,
                );

                next_action
            }
        }
    }

    /// Retrieves or creates a statistics row for the current request.
    ///
    /// For streaming body requests (`OnRequestBody` and `OnResponseBody`), this method:
    /// - Returns a cached stats row if one exists for the request ID
    /// - Creates and caches a new stats row when `end_of_stream` is false
    /// - Removes the cached entry when `end_of_stream` is true
    ///
    /// For all other request types, always creates a new stats row.
    fn get_stats_row(
        &self,
        request: &Handler,
        request_id: &SmolStr,
        app_name: &SmolStr,
        cfg: &runtime::App,
    ) -> Arc<dyn StatsVisitor> {
        let end_of_stream = match request {
            Handler::OnRequestBody { end_of_stream, .. } => *end_of_stream,
            Handler::OnResponseBody { end_of_stream, .. } => *end_of_stream,
            _ => return self.context.new_stats_row(request_id, app_name, cfg),
        };

        if let Some(stats) = self.stats_cache.get(request_id) {
            if end_of_stream {
                self.stats_cache.invalidate(request_id);
            }
            stats
        } else {
            let stats = self.context.new_stats_row(request_id, app_name, cfg);
            if !end_of_stream {
                self.stats_cache.insert(request_id.clone(), stats.clone());
            }
            stats
        }
    }
}

async fn traceparent(host: &impl HostCommand) -> Result<SmolStr> {
    let value = host
        .request_reply(HostFunction::GetMapValue {
            map_type: MapType::HttpRequestHeaders,
            key: WasmBytes::from_static(b"traceparent"),
        })
        .await?;

    if value.is_empty() {
        anyhow::bail!("empty or not found traceparent header");
    }
    let str = std::str::from_utf8(&value)?;
    SmolStr::from_str(str).map_err(Error::msg)
}

async fn handshake<S>(stream: &mut S) -> Result<Version>
where
    S: Stream<Item = Result<ProxyMessage, CodecError>> + SinkExt<ProxyMessage> + Unpin,
{
    let Some(msg) = stream.next().await else {
        anyhow::bail!("stream closed");
    };
    let msg = msg.context("decode error")?;

    match msg {
        ProxyMessage::Handshake(handshake) => {
            tracing::trace!(?handshake, "decoded");
            let handshake_versions = HashSet::from_iter(handshake.supported_versions.into_iter());
            let supported_versions = HashSet::from(SUPPORTED_VERSIONS);
            let supported_versions = supported_versions.intersection(&handshake_versions);
            let supported_versions: Vec<u32> = supported_versions.into_iter().copied().collect();
            tracing::trace!(?supported_versions, "handshake");
            let Some(version) = supported_versions.first() else {
                anyhow::bail!("unexpected handshake message received");
            };
            let version = Version::try_from(*version)?;

            stream
                .send(ProxyMessage::Handshake(HandshakeMessage {
                    supported_versions,
                }))
                .await
                .map_err(|_| anyhow::anyhow!("handshake send error"))?;

            Ok(version)
        }
        _ => {
            anyhow::bail!("unreachable proxywasm message. expect handshake.");
        }
    }
}

#[cfg(test)]
mod tests {
    use claims::assert_ok;
    use fastedge_proxywasm::v2::Host;
    use jsonwebtoken::EncodingKey;
    use jsonwebtoken::Header;
    use jsonwebtoken::encode;
    use runtime::App;
    use runtime::WasmConfig;
    use runtime::service::ServiceBuilder;
    use smol_str::ToSmolStr;
    use std::collections;
    use std::collections::HashMap;
    use std::time::{SystemTime, UNIX_EPOCH};
    use wasmtime::Engine;

    use crate::host::HostCommand;
    use crate::service::{ProxyWasmHost, ProxyWasmService};
    use crate::tests::{HostMock, TestContext};
    use fastedge_proxywasm::action::{CONTINUE, PAUSE};
    use fastedge_proxywasm::v2::Handler;
    use fastedge_proxywasm::{BufferType, MapType, WasmBytes, utils};

    #[tokio::test]
    #[tracing_test::traced_test]
    async fn test_log() {
        let config = WasmConfig::default();
        let engine = assert_ok!(Engine::new(&config));

        let app = Some(App {
            binary_id: 0,
            max_duration: 10,
            mem_limit: 1400000,
            env: Default::default(),
            rsp_headers: Default::default(),
            log: Default::default(),
            app_id: 12345,
            client_id: 23456,
            plan: "test_plan".to_smolstr(),
            status: Default::default(),
            debug_until: None,
            secrets: vec![],
            kv_stores: vec![],
            plan_id: 0,
        });

        let wasm = include_bytes!("fixtures/log_time.wasm").to_vec();

        let context = TestContext { app, engine, wasm };

        let proxywasm_service: ProxyWasmService<TestContext, HostMock> =
            assert_ok!(ServiceBuilder::new(context.clone()).build());

        let proxy = HostMock::default();
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: format!(
                    "on_http_request_headers: {}",
                    SystemTime::now()
                        .duration_since(SystemTime::UNIX_EPOCH)
                        .unwrap()
                        .as_secs()
                        / 3600
                ),
            },
            Ok(()),
        );

        let request = Handler::OnRequestHeaders {
            context_id: 10,
            num_headers: 10,
        };

        let res = proxywasm_service
            .handle_request(1, proxy.clone(), 123, request)
            .await;
        assert_eq!(CONTINUE, res);
        assert!(proxy.is_empty());

        let proxy = HostMock::default();
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: format!(
                    "on_http_response_headers: {}",
                    SystemTime::now()
                        .duration_since(SystemTime::UNIX_EPOCH)
                        .unwrap()
                        .as_secs()
                        / 3600
                ),
            },
            Ok(()),
        );

        let request = Handler::OnResponseHeaders {
            context_id: 10,
            num_headers: 10,
        };

        let res = proxywasm_service
            .handle_request(1, proxy.clone(), 123, request)
            .await;
        assert_eq!(CONTINUE, res);

        assert!(proxy.is_empty());
    }

    #[tokio::test]
    #[tracing_test::traced_test]
    async fn test_request_headers() {
        let config = WasmConfig::default();
        let engine = assert_ok!(Engine::new(&config));

        let app = Some(App {
            binary_id: 0,
            max_duration: 10,
            mem_limit: 1400000,
            env: Default::default(),
            rsp_headers: Default::default(),
            log: Default::default(),
            app_id: 12345,
            client_id: 23456,
            plan: "test_plan".to_smolstr(),
            status: Default::default(),
            debug_until: None,
            secrets: vec![],
            kv_stores: vec![],
            plan_id: 0,
        });

        let wasm = include_bytes!("fixtures/get_set_headers.wasm").to_vec();

        let context = TestContext { app, engine, wasm };

        let proxywasm_service: ProxyWasmService<TestContext, HostMock> =
            assert_ok!(ServiceBuilder::new(context.clone()).build());

        let proxy = HostMock::default();
        // get_http_request_headers
        proxy.expect_request_reply(
            Host::GetMapPairs {
                map_type: MapType::HttpRequestHeaders,
            },
            Ok(utils::serialize_map(vec![(b"key01", b"value01"), (b"key02", b"value02")]).into()),
        );
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: "#10 -> key01: value01".to_string(),
            },
            Ok(()),
        );
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: "#10 -> key02: value02".to_string(),
            },
            Ok(()),
        );
        // get_http_request_headers_bytes
        proxy.expect_request_reply(
            Host::GetMapPairs {
                map_type: MapType::HttpRequestHeaders,
            },
            Ok(utils::serialize_map(vec![(b"key01", b"value01"), (b"key02", b"value02")]).into()),
        );
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: format!("#10 -> key01: {:?}", b"value01"),
            },
            Ok(()),
        );
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: format!("#10 -> key02: {:?}", b"value02"),
            },
            Ok(()),
        );

        let request = Handler::OnRequestHeaders {
            context_id: 10,
            num_headers: 2,
        };

        let res = proxywasm_service
            .handle_request(1, proxy.clone(), 0, request)
            .await;
        assert_eq!(CONTINUE, res);

        assert!(proxy.is_empty());
    }

    #[tokio::test]
    #[tracing_test::traced_test]
    async fn test_request_body() {
        let config = WasmConfig::default();
        let engine = assert_ok!(Engine::new(&config));

        let app = Some(App {
            binary_id: 0,
            max_duration: 10,
            mem_limit: 1400000,
            env: Default::default(),
            rsp_headers: Default::default(),
            log: Default::default(),
            app_id: 12345,
            client_id: 23456,
            plan: "test_plan".to_smolstr(),
            status: Default::default(),
            debug_until: None,
            secrets: vec![],
            kv_stores: vec![],
            plan_id: 0,
        });

        let wasm = include_bytes!("fixtures/request_body.wasm").to_vec();

        let context = TestContext { app, engine, wasm };

        let proxywasm_service: ProxyWasmService<TestContext, HostMock> =
            assert_ok!(ServiceBuilder::new(context.clone()).build());

        let proxy = HostMock::default();
        proxy.expect_request_reply(
            Host::GetMapValue {
                map_type: MapType::HttpRequestHeaders,
                key: WasmBytes::from_static(b"traceparent"),
            },
            Ok(WasmBytes::from_static(
                b"00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
            )),
        );
        proxy.expect_request_reply(
            Host::GetProperty {
                path: WasmBytes::from_static(b"request.x_real_ip"),
            },
            Ok(WasmBytes::from_static(b"10.10.10.10")),
        );

        proxy.expect_request_reply(
            Host::GetBufferBytes {
                buffer_type: BufferType::HttpRequestBody,
                start: 0,
                max_size: 19,
            },
            Ok(WasmBytes::from_static(b"Client request body")),
        );

        proxy.expect_command(
            Host::SetBufferBytes {
                buffer_type: BufferType::HttpRequestBody,
                start: 0,
                size: 19,
                value: WasmBytes::from_static(b"Original message body (19 bytes) redacted.\n"),
            },
            Ok(()),
        );

        let request = Handler::OnRequestBody {
            context_id: 10,
            body_size: 0,
            end_of_stream: false,
        };

        let res = proxywasm_service
            .handle_request(1, proxy.clone(), 0, request)
            .await;
        assert_eq!(PAUSE, res);

        let request = Handler::OnRequestBody {
            context_id: 10,
            body_size: 19,
            end_of_stream: true,
        };

        let res = proxywasm_service
            .handle_request(1, proxy.clone(), 0, request)
            .await;
        assert_eq!(CONTINUE, res);

        assert!(proxy.is_empty());
    }

    #[tokio::test]
    #[tracing_test::traced_test]
    async fn test_response_headers() {
        let config = WasmConfig::default();
        let engine = assert_ok!(Engine::new(&config));

        let app = Some(App {
            binary_id: 0,
            max_duration: 10,
            mem_limit: 1400000,
            env: Default::default(),
            rsp_headers: Default::default(),
            log: Default::default(),
            app_id: 12345,
            client_id: 23456,
            plan: "test_plan".to_smolstr(),
            status: Default::default(),
            debug_until: None,
            secrets: vec![],
            kv_stores: vec![],
            plan_id: 0,
        });

        let wasm = include_bytes!("fixtures/get_set_headers.wasm").to_vec();

        let context = TestContext { app, engine, wasm };

        let proxywasm_service: ProxyWasmService<TestContext, HostMock> =
            assert_ok!(ServiceBuilder::new(context.clone()).build());

        let proxy = HostMock::default();
        // get_http_response_headers
        proxy.expect_request_reply(
            Host::GetMapPairs {
                map_type: MapType::HttpResponseHeaders,
            },
            Ok(utils::serialize_map(vec![(b"key03", b"value03"), (b"key04", b"value04")]).into()),
        );
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: "#11 <- key03: value03".to_string(),
            },
            Ok(()),
        );
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: "#11 <- key04: value04".to_string(),
            },
            Ok(()),
        );

        // get_http_response_headers_bytes
        proxy.expect_request_reply(
            Host::GetMapPairs {
                map_type: MapType::HttpResponseHeaders,
            },
            Ok(utils::serialize_map(vec![(b"key03", b"value03"), (b"key04", b"value04")]).into()),
        );
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: format!("#11 <- key03: {:?}", b"value03"),
            },
            Ok(()),
        );
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: format!("#11 <- key04: {:?}", b"value04"),
            },
            Ok(()),
        );

        let request = Handler::OnResponseHeaders {
            context_id: 11,
            num_headers: 2,
        };

        let res = proxywasm_service
            .handle_request(1, proxy.clone(), 1, request)
            .await;
        assert_eq!(CONTINUE, res);

        assert!(proxy.is_empty());
    }

    #[tokio::test]
    #[tracing_test::traced_test]
    async fn test_response_headers_v2() {
        let config = WasmConfig::default();
        let engine = assert_ok!(Engine::new(&config));

        let app = Some(App {
            binary_id: 0,
            max_duration: 10,
            mem_limit: 1400000,
            env: Default::default(),
            rsp_headers: Default::default(),
            log: Default::default(),
            app_id: 12345,
            client_id: 23456,
            plan: "test_plan".to_smolstr(),
            status: Default::default(),
            debug_until: None,
            secrets: vec![],
            kv_stores: vec![],
            plan_id: 0,
        });

        let wasm = include_bytes!("fixtures/get_set_headers.wasm").to_vec();

        let context = TestContext { app, engine, wasm };

        let proxywasm_service: ProxyWasmService<TestContext, HostMock> =
            assert_ok!(ServiceBuilder::new(context.clone()).build());

        let proxy = HostMock::default();
        // get_http_response_headers
        proxy.expect_request_reply(
            Host::GetMapPairs {
                map_type: MapType::HttpResponseHeaders,
            },
            Ok(utils::serialize_map(vec![(b"key03", b"value03"), (b"key04", b"value04")]).into()),
        );
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: "#11 <- key03: value03".to_string(),
            },
            Ok(()),
        );
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: "#11 <- key04: value04".to_string(),
            },
            Ok(()),
        );

        // get_http_response_headers_bytes
        proxy.expect_request_reply(
            Host::GetMapPairs {
                map_type: MapType::HttpResponseHeaders,
            },
            Ok(utils::serialize_map(vec![(b"key03", b"value03"), (b"key04", b"value04")]).into()),
        );
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: format!("#11 <- key03: {:?}", b"value03"),
            },
            Ok(()),
        );
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: format!("#11 <- key04: {:?}", b"value04"),
            },
            Ok(()),
        );

        let request = Handler::OnResponseHeaders {
            context_id: 11,
            num_headers: 2,
        };

        let res = proxywasm_service
            .handle_request(1, proxy.clone(), 1, request.into())
            .await;
        assert_eq!(CONTINUE, res);

        assert!(proxy.is_empty());
    }

    #[tokio::test]
    #[tracing_test::traced_test]
    async fn test_modify_request_headers() {
        let config = WasmConfig::default();
        let engine = assert_ok!(Engine::new(&config));

        let app = Some(App {
            binary_id: 0,
            max_duration: 10,
            mem_limit: 1400000,
            env: Default::default(),
            rsp_headers: Default::default(),
            log: Default::default(),
            app_id: 12345,
            client_id: 23456,
            plan: "test_plan".to_smolstr(),
            status: Default::default(),
            debug_until: None,
            secrets: vec![],
            kv_stores: vec![],
            plan_id: 0,
        });

        let wasm = include_bytes!("fixtures/modify_headers.wasm").to_vec();

        let context = TestContext { app, engine, wasm };

        let proxywasm_service: ProxyWasmService<TestContext, HostMock> =
            assert_ok!(ServiceBuilder::new(context.clone()).build());

        let proxy = HostMock::default();
        // get_http_request_header("header01")
        proxy.expect_request_reply(
            Host::GetMapValue {
                map_type: MapType::HttpRequestHeaders,
                key: WasmBytes::from_static(b"header01"),
            },
            Ok(WasmBytes::from_static(b"value01")),
        );
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: "header01: value01".to_string(),
            },
            Ok(()),
        );
        // get_http_request_header_bytes("header01")
        proxy.expect_request_reply(
            Host::GetMapValue {
                map_type: MapType::HttpRequestHeaders,
                key: WasmBytes::from_static(b"header01"),
            },
            Ok(WasmBytes::from_static(b"value01")),
        );
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: format!("header01: {:?}", b"value01"),
            },
            Ok(()),
        );

        // set_http_request_header
        proxy.expect_command(
            Host::RemoveMapValue {
                map_type: MapType::HttpRequestHeaders,
                key: WasmBytes::from_static(b"header02"),
            },
            Ok(()),
        );
        // set_http_request_header_bytes
        proxy.expect_command(
            Host::RemoveMapValue {
                map_type: MapType::HttpRequestHeaders,
                key: WasmBytes::from_static(b"header02"),
            },
            Ok(()),
        );

        // set_http_request_header("header01", "value01")
        proxy.expect_command(
            Host::ReplaceMapValue {
                map_type: MapType::HttpRequestHeaders,
                key: WasmBytes::from_static(b"header02"),
                value: WasmBytes::from_static(b"value02"),
            },
            Ok(()),
        );
        // set_http_request_header_bytes("header01", "value01")
        proxy.expect_command(
            Host::ReplaceMapValue {
                map_type: MapType::HttpRequestHeaders,
                key: WasmBytes::from_static(b"header02"),
                value: WasmBytes::from_static(b"value02"),
            },
            Ok(()),
        );

        // add_http_request_header("header01", "value01")
        proxy.expect_command(
            Host::AddMapValue {
                map_type: MapType::HttpRequestHeaders,
                key: WasmBytes::from_static(b"header03"),
                value: WasmBytes::from_static(b"value03"),
            },
            Ok(()),
        );
        // add_http_request_header_bytes("header01", "value01")
        proxy.expect_command(
            Host::AddMapValue {
                map_type: MapType::HttpRequestHeaders,
                key: WasmBytes::from_static(b"header03"),
                value: WasmBytes::from_static(b"value03"),
            },
            Ok(()),
        );

        let request = Handler::OnRequestHeaders {
            context_id: 10,
            num_headers: 2,
        };

        let res = proxywasm_service
            .handle_request(1, proxy.clone(), 2, request)
            .await;
        assert_eq!(CONTINUE, res);

        assert!(proxy.is_empty());
    }

    #[tokio::test]
    #[tracing_test::traced_test]
    async fn test_modify_response_headers() {
        let config = WasmConfig::default();
        let engine = assert_ok!(Engine::new(&config));

        let app = Some(App {
            binary_id: 0,
            max_duration: 10,
            mem_limit: 1400000,
            env: Default::default(),
            rsp_headers: Default::default(),
            log: Default::default(),
            app_id: 12345,
            client_id: 23456,
            plan: "test_plan".to_smolstr(),
            status: Default::default(),
            debug_until: None,
            secrets: vec![],
            kv_stores: vec![],
            plan_id: 0,
        });

        let wasm = include_bytes!("fixtures/modify_headers.wasm").to_vec();

        let context = TestContext { app, engine, wasm };

        let proxywasm_service: ProxyWasmService<TestContext, HostMock> =
            assert_ok!(ServiceBuilder::new(context.clone()).build());

        let proxy = HostMock::default();
        // get_http_response_header("header01")
        proxy.expect_request_reply(
            Host::GetMapValue {
                map_type: MapType::HttpResponseHeaders,
                key: WasmBytes::from_static(b"header01"),
            },
            Ok(WasmBytes::from_static(b"value01")),
        );
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: "header01: value01".to_string(),
            },
            Ok(()),
        );
        // get_http_response_header_bytes("header01")
        proxy.expect_request_reply(
            Host::GetMapValue {
                map_type: MapType::HttpResponseHeaders,
                key: WasmBytes::from_static(b"header01"),
            },
            Ok(WasmBytes::from_static(b"value01")),
        );
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: format!("header01: {:?}", b"value01"),
            },
            Ok(()),
        );

        // set_http_response_header
        proxy.expect_command(
            Host::RemoveMapValue {
                map_type: MapType::HttpResponseHeaders,
                key: WasmBytes::from_static(b"header02"),
            },
            Ok(()),
        );
        // set_http_response_header_bytes
        proxy.expect_command(
            Host::RemoveMapValue {
                map_type: MapType::HttpResponseHeaders,
                key: WasmBytes::from_static(b"header02"),
            },
            Ok(()),
        );

        // set_http_response_header("header01", "value01")
        proxy.expect_command(
            Host::ReplaceMapValue {
                map_type: MapType::HttpResponseHeaders,
                key: WasmBytes::from_static(b"header02"),
                value: WasmBytes::from_static(b"value02"),
            },
            Ok(()),
        );
        // set_http_response_header_bytes("header01", "value01")
        proxy.expect_command(
            Host::ReplaceMapValue {
                map_type: MapType::HttpResponseHeaders,
                key: WasmBytes::from_static(b"header02"),
                value: WasmBytes::from_static(b"value02"),
            },
            Ok(()),
        );

        // add_http_response_header("header01", "value01")
        proxy.expect_command(
            Host::AddMapValue {
                map_type: MapType::HttpResponseHeaders,
                key: WasmBytes::from_static(b"header03"),
                value: WasmBytes::from_static(b"value03"),
            },
            Ok(()),
        );
        // add_http_response_header_bytes("header01", "value01")
        proxy.expect_command(
            Host::AddMapValue {
                map_type: MapType::HttpResponseHeaders,
                key: WasmBytes::from_static(b"header03"),
                value: WasmBytes::from_static(b"value03"),
            },
            Ok(()),
        );

        let request = Handler::OnResponseHeaders {
            context_id: 10,
            num_headers: 2,
        };

        let res = proxywasm_service
            .handle_request(1, proxy.clone(), 3, request)
            .await;
        assert_eq!(CONTINUE, res);

        assert!(proxy.is_empty());
    }

    #[tokio::test]
    #[tracing_test::traced_test]
    async fn test_property() {
        let config = WasmConfig::default();
        let engine = assert_ok!(Engine::new(&config));

        let app = Some(App {
            binary_id: 0,
            max_duration: 10,
            mem_limit: 1400000,
            env: Default::default(),
            rsp_headers: Default::default(),
            log: Default::default(),
            app_id: 12345,
            client_id: 23456,
            plan: "test_plan".to_smolstr(),
            status: Default::default(),
            debug_until: None,
            secrets: vec![],
            kv_stores: vec![],
            plan_id: 0,
        });

        let wasm = include_bytes!("fixtures/properties.wasm").to_vec();

        let context = TestContext { app, engine, wasm };

        let proxywasm_service: ProxyWasmService<TestContext, HostMock> =
            assert_ok!(ServiceBuilder::new(context.clone()).build());

        let proxy = HostMock::default();
        proxy.expect_request_reply(
            Host::GetMapValue {
                map_type: MapType::HttpRequestHeaders,
                key: WasmBytes::from_static(b"X-Forwarded-Proto"),
            },
            Ok(WasmBytes::from_static(b"http")),
        );
        proxy.expect_request_reply(
            Host::GetMapValue {
                map_type: MapType::HttpRequestHeaders,
                key: WasmBytes::from_static(b"X-CDN-Real-Host"),
            },
            Ok(WasmBytes::from_static(b"www.host.com")),
        );
        proxy.expect_request_reply(
            Host::GetProperty {
                path: WasmBytes::from_static(b"request.path"),
            },
            Ok(WasmBytes::from_static(b"")),
        );
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: "url=http://www.host.com".to_string(),
            },
            Ok(()),
        );
        proxy.expect_request_reply(
            Host::GetProperty {
                path: WasmBytes::from_static(b"request.query"),
            },
            Ok(WasmBytes::from_static(b"test")),
        );
        proxy.expect_command(
            Host::Log {
                level: 2,
                message: "query=test".to_string(),
            },
            Ok(()),
        );

        let request = Handler::OnRequestHeaders {
            context_id: 10,
            num_headers: 2,
        };

        let res = proxywasm_service
            .handle_request(1, proxy.clone(), 4, request)
            .await;
        assert_eq!(CONTINUE, res);

        assert!(proxy.is_empty());
    }

    #[tokio::test]
    #[tracing_test::traced_test]
    async fn test_jwt() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let proxywasm_service = init_jwt_service();

        // test OK
        let claims = serde_json::json!({
            "aud": "Audience",
            "iss": "Issuer",
            "iat": now - 1000,
            "exp": now + 1000,
            "cid": "cid",
            "stt": "stt",
            "cip": "10.20.30.40",
            "geo": ["fr", "uk"],
            "geo_tw": [{ "start": now - 100, "end": now + 100}],
            "local": "Amsterdam",
            "path": "/3456457656756/asset/path"
        });

        let token = assert_ok!(encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret("secret".as_ref())
        ));

        let proxy = HostMock::default();
        proxy.expect_request_reply(
            Host::GetProperty {
                path: WasmBytes::from_static(b"request.path"),
            },
            Ok(format!("/{}/3456457656756/asset/path", token).into()),
        );

        proxy.expect_request_reply(
            Host::GetProperty {
                path: WasmBytes::from_static(b"request.x_real_ip"),
            },
            Ok("10.20.30.40".into()),
        );

        let request = Handler::OnRequestHeaders {
            context_id: 10,
            num_headers: 2,
        };

        let res = proxywasm_service
            .handle_request(1, proxy.clone(), 3, request)
            .await;
        assert_eq!(CONTINUE, res);

        assert!(proxy.is_empty());
    }

    #[tokio::test]
    #[tracing_test::traced_test]
    async fn test_jwt_not_allowed_path() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let proxywasm_service = init_jwt_service();

        // test OK
        let claims = serde_json::json!({
            "aud": "Audience",
            "iss": "Issuer",
            "iat": now - 1000,
            "exp": now + 1000,
            "cid": "cid",
            "stt": "stt",
            "path": "/path"
        });

        let token = assert_ok!(encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret("secret".as_ref())
        ));

        let proxy = HostMock::default();
        proxy.expect_request_reply(
            Host::GetProperty {
                path: WasmBytes::from_static(b"request.path"),
            },
            Ok(format!("/{}/3456457656756/asset/path", token).into()),
        );

        let request = Handler::OnRequestHeaders {
            context_id: 15,
            num_headers: 2,
        };

        let res = proxywasm_service
            .handle_request(1, proxy.clone(), 3, request)
            .await;
        assert_eq!(403, res);

        assert!(proxy.is_empty());
    }

    #[tokio::test]
    #[tracing_test::traced_test]
    async fn test_jwt_expired() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let proxywasm_service = init_jwt_service();

        // test expired
        let claims = serde_json::json!({
            "aud": "Audience",
            "iss": "Issuer",
            "iat": now - 1000,
            "exp": now ,
            "cid": "cid",
            "stt": "stt",
            "cip": "10.20.30.40",
            "geo": ["fr", "uk"],
            "geo_tw": [{ "start": now - 100, "end": now + 100}],
            "local": "Paris"
        });

        let token = assert_ok!(encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret("secret".as_ref())
        ));

        let proxy = HostMock::default();
        proxy.expect_request_reply(
            Host::GetProperty {
                path: WasmBytes::from_static(b"request.path"),
            },
            Ok(format!("/{}/3456457656756/asset/path", token).into()),
        );

        let request = Handler::OnRequestHeaders {
            context_id: 11,
            num_headers: 2,
        };

        let res = proxywasm_service
            .handle_request(1, proxy.clone(), 3, request)
            .await;
        assert_eq!(403, res);

        assert!(proxy.is_empty());
    }

    #[tokio::test]
    #[tracing_test::traced_test]
    async fn test_jwt_not_allowed_ip() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let proxywasm_service = init_jwt_service();

        // test not alloed IP
        let claims = serde_json::json!({
            "aud": "Audience",
            "iss": "Issuer",
            "iat": now - 1000,
            "exp": now + 1000,
            "cid": "cid",
            "stt": "stt",
            "cip": "10.20.30.40",
            "geo": ["fr", "uk"],
            "geo_tw": [{ "start": now - 100, "end": now + 100}],
            "local": "Paris"
        });

        let token = assert_ok!(encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret("secret".as_ref())
        ));

        let proxy = HostMock::default();
        proxy.expect_request_reply(
            Host::GetProperty {
                path: WasmBytes::from_static(b"request.path"),
            },
            Ok(format!("/{}/3456457656756/asset/path", token).into()),
        );
        proxy.expect_request_reply(
            Host::GetProperty {
                path: WasmBytes::from_static(b"request.x_real_ip"),
            },
            Ok("1.2.3.4".into()),
        );

        let request = Handler::OnRequestHeaders {
            context_id: 12,
            num_headers: 2,
        };

        let res = proxywasm_service
            .handle_request(1, proxy.clone(), 3, request)
            .await;
        assert_eq!(403, res);

        assert!(proxy.is_empty());
    }

    #[tokio::test]
    #[tracing_test::traced_test]
    async fn test_jwt_not_allowed_country() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let proxywasm_service = init_jwt_service();

        // test now alloed country
        let claims = serde_json::json!({
            "aud": "Audience",
            "iss": "Issuer",
            "iat": now - 1000,
            "exp": now + 1000,
            "cid": "cid",
            "stt": "stt",
            "cip": "10.20.30.40",
            "geo": [ "uk"],
            "geo_tw": [{ "start": now - 100, "end": now + 100}],
            "local": "Paris"
        });

        let token = assert_ok!(encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret("secret".as_ref())
        ));

        let proxy = HostMock::default();
        proxy.expect_request_reply(
            Host::GetProperty {
                path: WasmBytes::from_static(b"request.path"),
            },
            Ok(format!("/{}/3456457656756/asset/path", token).into()),
        );
        proxy.expect_request_reply(
            Host::GetProperty {
                path: WasmBytes::from_static(b"request.x_real_ip"),
            },
            Ok("10.20.30.40".into()),
        );

        let request = Handler::OnRequestHeaders {
            context_id: 12,
            num_headers: 2,
        };

        let res = proxywasm_service
            .handle_request(1, proxy.clone(), 3, request)
            .await;
        assert_eq!(403, res);

        assert!(proxy.is_empty());
    }

    #[tokio::test]
    #[tracing_test::traced_test]
    async fn test_jwt_not_allowed_geo_tw() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let proxywasm_service = init_jwt_service();

        // test now alloed country
        let claims = serde_json::json!({
            "aud": "Audience",
            "iss": "Issuer",
            "iat": now - 1000,
            "exp": now + 1000,
            "cid": "cid",
            "stt": "stt",
            "cip": "10.20.30.40",
            "geo": [ "FR"],
            "geo_tw": [{ "start": now + 100, "end": now + 200}],
            "local": "Paris"
        });

        let token = assert_ok!(encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret("secret".as_ref())
        ));

        let proxy = HostMock::default();
        proxy.expect_request_reply(
            Host::GetProperty {
                path: WasmBytes::from_static(b"request.path"),
            },
            Ok(format!("/{}/3456457656756/asset/path", token).into()),
        );
        proxy.expect_request_reply(
            Host::GetProperty {
                path: WasmBytes::from_static(b"request.x_real_ip"),
            },
            Ok("10.20.30.40".into()),
        );

        let request = Handler::OnRequestHeaders {
            context_id: 13,
            num_headers: 2,
        };

        let res = proxywasm_service
            .handle_request(1, proxy.clone(), 3, request)
            .await;
        assert_eq!(403, res);

        assert!(proxy.is_empty());
    }

    #[tokio::test]
    #[tracing_test::traced_test]
    async fn test_jwt_not_allowed_city() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let proxywasm_service = init_jwt_service();

        // test OK
        let claims = serde_json::json!({
            "aud": "Audience",
            "iss": "Issuer",
            "iat": now - 1000,
            "exp": now + 1000,
            "cid": "cid",
            "stt": "stt",
            "cip": "10.20.30.40",
            "local": "Amsterdam"
        });

        let token = assert_ok!(encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret("secret".as_ref())
        ));

        let proxy = HostMock::default();
        proxy.expect_request_reply(
            Host::GetProperty {
                path: WasmBytes::from_static(b"request.path"),
            },
            Ok(format!("/{}/3456457656756/asset/path", token).into()),
        );

        proxy.expect_request_reply(
            Host::GetProperty {
                path: WasmBytes::from_static(b"request.x_real_ip"),
            },
            Ok("10.20.30.40".into()),
        );

        let request = Handler::OnRequestHeaders {
            context_id: 14,
            num_headers: 2,
        };

        let res = proxywasm_service
            .handle_request(1, proxy.clone(), 3, request)
            .await;
        assert_eq!(403, res);

        assert!(proxy.is_empty());
    }

    fn init_jwt_service() -> ProxyWasmService<TestContext, HostMock> {
        let config = WasmConfig::default();
        let engine = assert_ok!(Engine::new(&config));

        let app = Some(App {
            binary_id: 0,
            max_duration: 10,
            mem_limit: 1400000,
            env: collections::HashMap::from([("secret".to_smolstr(), "secret".to_smolstr())]),
            rsp_headers: Default::default(),
            log: Default::default(),
            app_id: 12345,
            client_id: 23456,
            plan: "test_plan".to_smolstr(),
            status: Default::default(),
            debug_until: None,
            secrets: vec![],
            kv_stores: vec![],
            plan_id: 0,
        });

        let wasm = include_bytes!("fixtures/cdn_jwt_validate.wasm").to_vec();

        let context = TestContext { app, engine, wasm };

        let proxywasm_service: ProxyWasmService<TestContext, HostMock> =
            assert_ok!(ServiceBuilder::new(context.clone()).build());
        proxywasm_service
    }

    #[tokio::test]
    #[tracing_test::traced_test]
    async fn test_dictionary() {
        let config = WasmConfig::default();
        let engine = assert_ok!(Engine::new(&config));

        let mut env = HashMap::new();
        env.insert("example_key".to_smolstr(), "example_value".to_smolstr());

        let app = Some(App {
            binary_id: 0,
            max_duration: 10,
            mem_limit: 1400000,
            env,
            rsp_headers: Default::default(),
            log: Default::default(),
            app_id: 12345,
            client_id: 23456,
            plan: "test_plan".to_smolstr(),
            status: Default::default(),
            debug_until: None,
            secrets: vec![],
            kv_stores: vec![],
            plan_id: 0,
        });

        let wasm = include_bytes!("fixtures/dictionary.wasm").to_vec();

        let context = TestContext { app, engine, wasm };

        let proxywasm_service: ProxyWasmService<TestContext, HostMock> =
            assert_ok!(ServiceBuilder::new(context.clone()).build());

        let proxy = HostMock::default();

        proxy.expect_command(
            Host::AddMapValue {
                map_type: MapType::HttpRequestHeaders,
                key: WasmBytes::from_static(b"x-example-key"),
                value: WasmBytes::from_static(b"example_value"),
            },
            Ok(()),
        );

        let request = Handler::OnRequestHeaders {
            context_id: 10,
            num_headers: 2,
        };

        let res = proxywasm_service
            .handle_request(1, proxy.clone(), 4, request)
            .await;
        assert_eq!(CONTINUE, res);

        assert!(proxy.is_empty());
    }

    #[tokio::test]
    #[tracing_test::traced_test]
    async fn test_request_reply_with_additional_info() {
        use fastedge_proxywasm::v2::AdditionalInfo;
        use tokio_util::bytes::Bytes;

        // Create AdditionalInfo with request headers
        let request_headers = vec![
            (Bytes::from_static(b"key01"), Bytes::from_static(b"value01")),
            (Bytes::from_static(b"key02"), Bytes::from_static(b"value02")),
            (
                Bytes::from_static(b"x-custom-header"),
                Bytes::from_static(b"custom-value"),
            ),
        ];

        let properties = vec![
            (
                Bytes::from_static(b"request.path"),
                Bytes::from_static(b"/test/path"),
            ),
            (
                Bytes::from_static(b"request.x_real_ip"),
                Bytes::from_static(b"192.168.1.1"),
            ),
        ];

        let additional_info = AdditionalInfo::new(request_headers, properties);

        // Test the request_reply method directly with additional_info
        let (tx, _rx) = tokio::sync::mpsc::channel(32);
        let host = ProxyWasmHost::new(
            fastedge_proxywasm::Version::V2a,
            fastedge_proxywasm::RequestId {
                index: 1,
                generation: 0,
            },
            Some(additional_info.clone()),
            tx,
        );

        // Test GetMapPairs for HttpRequestHeaders - should be served from cache
        // This is the key feature: when additional_info is set, GetMapPairs
        // returns cached headers without network communication
        let result = host
            .request_reply(Host::GetMapPairs {
                map_type: MapType::HttpRequestHeaders,
            })
            .await;

        // Verify request was served from cache
        assert_ok!(&result);
        let headers_bytes: WasmBytes = result.unwrap();

        // Verify we got non-empty serialized header data from cache
        // This proves that additional_info serves data without network I/O
        assert!(
            !headers_bytes.is_empty(),
            "GetMapPairs should return cached data"
        );
        assert!(
            headers_bytes.len() > 4,
            "Cached headers should contain serialized data"
        );
    }
}

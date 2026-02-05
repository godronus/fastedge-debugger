use crate::host::{HostCommand, proxy::Proxy};
use crate::{GeoLookup, NodeDescription};
use fastedge_proxywasm::{
    WasmBytes,
    action::CONTINUE,
    v2::{Handler, Host as HostFunction},
};
use runtime::util::stats::{CdnPhase, StatsTimer, StatsVisitor};
use runtime::{App, Data, ModuleInstancePre, WasmEngine, store::StoreBuilder};
use smol_str::SmolStr;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::OnceCell;
use wasmtime::{AsContextMut, Instance};

const ROOT_CTX_ID: u32 = 1;
const PLUGIN_INITIALIZE: &str = "_initialize";
const PLUGIN_START: &str = "_start";
const PROXY_ON_CONTEXT_CREATE: &str = "proxy_on_context_create";
const PLUGIN_ON_REQUEST_HEADERS: &str = "proxy_on_request_headers";
const PLUGIN_ON_RESPONSE_HEADERS: &str = "proxy_on_response_headers";
const PLUGIN_ON_REQUEST_BODY: &str = "proxy_on_request_body";
const PLUGIN_ON_RESPONSE_BODY: &str = "proxy_on_response_body";
const PLUGIN_ON_LOG: &str = "proxy_on_log";

const REQUESTOR_KEY: &str = "requestor";
const HOSTNAME_KEY: &str = "hostname";

pub trait ExecutorFactory<C> {
    fn get_executor(
        &self,
        name: SmolStr,
        app: &App,
        engine: &WasmEngine<Proxy<C>>,
    ) -> anyhow::Result<ProxyWasmExecutor<C>>;
}

/// Execute context used by ['ProxyWasmService']
#[derive(Clone)]
pub struct ProxyWasmExecutor<C: 'static> {
    instance_pre: ModuleInstancePre<Proxy<C>>,
    store_builder: StoreBuilder,
    geo: Arc<dyn GeoLookup>,
    node_description: Arc<NodeDescription>,
}

impl<C> ProxyWasmExecutor<C>
where
    C: HostCommand + Send,
{
    pub async fn execute(
        self,
        host: C,
        request_id: SmolStr,
        request: Handler,
        stats: Arc<dyn StatsVisitor>,
    ) -> anyhow::Result<i32> {
        // Start timing for stats
        let stats_timer = StatsTimer::new(stats.clone());

        let properties = self.load_properties(&request_id, &host).await?;
        let store_builder = self.store_builder.with_properties(properties);

        let return_status_code = OnceCell::new();
        let proxy = Proxy::new(
            host,
            return_status_code,
            self.geo.clone(),
            stats.clone(),
            self.node_description.clone(),
        );

        let mut store = store_builder.build(proxy)?;
        let timeout = Duration::from_millis(store.data().timeout);
        let instance = self.instance_pre.instantiate_async(&mut store).await?;

        let result = match request {
            Handler::OnRequestHeaders {
                context_id,
                num_headers,
            } => {
                stats.cdn_phase(CdnPhase::RequestHeaders);
                // init proxywasm app context
                plugin_create_context(&instance, &mut store, context_id).await?;

                let func = instance.get_typed_func::<(i32, i32, i32), i32>(
                    &mut store,
                    PLUGIN_ON_REQUEST_HEADERS,
                )?;

                tokio::time::timeout(
                    timeout,
                    func.call_async(
                        &mut store,
                        (context_id as i32, num_headers as i32, true as i32),
                    ),
                )
                .await?
            }
            Handler::OnResponseHeaders {
                context_id,
                num_headers,
            } => {
                stats.cdn_phase(CdnPhase::ResponseHeaders);
                // init proxywasm app context
                plugin_create_context(&instance, &mut store, context_id).await?;

                let func = instance.get_typed_func::<(i32, i32, i32), i32>(
                    &mut store,
                    PLUGIN_ON_RESPONSE_HEADERS,
                )?;

                tokio::time::timeout(
                    timeout,
                    func.call_async(
                        &mut store,
                        (context_id as i32, num_headers as i32, true as i32),
                    ),
                )
                .await?
            }
            Handler::OnLog { context_id } => {
                stats.cdn_phase(CdnPhase::Log);
                // init proxywasm app context
                plugin_create_context(&instance, &mut store, context_id).await?;

                let func = instance.get_typed_func::<i32, ()>(&mut store, PLUGIN_ON_LOG)?;

                tokio::time::timeout(timeout, func.call_async(&mut store, context_id as i32))
                    .await?
                    .map(|_| CONTINUE)
            }
            Handler::OnRequestBody {
                context_id,
                body_size,
                end_of_stream,
            } => {
                stats.cdn_phase(CdnPhase::RequestBody);
                // init proxywasm app context
                plugin_create_context(&instance, &mut store, context_id).await?;

                let func = instance
                    .get_typed_func::<(i32, i32, i32), i32>(&mut store, PLUGIN_ON_REQUEST_BODY)?;

                tokio::time::timeout(
                    timeout,
                    func.call_async(
                        &mut store,
                        (context_id as i32, body_size as i32, end_of_stream as i32),
                    ),
                )
                .await?
            }
            Handler::OnResponseBody {
                context_id,
                body_size,
                end_of_stream,
            } => {
                stats.cdn_phase(CdnPhase::ResponseBody);
                // init proxywasm app context
                plugin_create_context(&instance, &mut store, context_id).await?;

                let func = instance
                    .get_typed_func::<(i32, i32, i32), i32>(&mut store, PLUGIN_ON_RESPONSE_BODY)?;

                tokio::time::timeout(
                    timeout,
                    func.call_async(
                        &mut store,
                        (context_id as i32, body_size as i32, end_of_stream as i32),
                    ),
                )
                .await?
            }
        };

        let next_action = result?;
        let proxy = store.data().as_ref();
        drop(stats_timer);
        stats.status_code(next_action as u16);
        stats.memory_used(store.memory_used() as u64);

        tracing::debug!(?request, ?next_action, "execute");
        if let Some(status_code) = proxy.status_code.get() {
            stats.status_code(*status_code as u16);
            if next_action != CONTINUE {
                return Ok(status_code.to_owned());
            } else {
                tracing::warn!(
                    "application must return Pause action to stop further processing of the initial HTTP request"
                );
            }
        };
        Ok(next_action)
    }

    pub fn new(
        instance_pre: ModuleInstancePre<Proxy<C>>,
        store_builder: StoreBuilder,
        geo: Arc<dyn GeoLookup>,
        node_description: Arc<NodeDescription>,
    ) -> Self {
        Self {
            instance_pre,
            store_builder,
            geo,
            node_description,
        }
    }

    async fn load_properties(
        &self,
        request_id: &SmolStr,
        host: &impl HostCommand,
    ) -> anyhow::Result<HashMap<String, String>> {
        let mut properties = HashMap::new();

        let value = host
            .request_reply(HostFunction::GetProperty {
                path: WasmBytes::from_static(b"request.x_real_ip"),
            })
            .await?;
        properties.insert("client_ip".to_string(), String::from_utf8(value.to_vec())?);

        properties.insert("traceparent".to_string(), request_id.to_string());

        properties.insert(
            REQUESTOR_KEY.to_string(),
            self.node_description[HOSTNAME_KEY].to_string(),
        );

        Ok(properties)
    }
}

async fn plugin_create_context<C: Send + 'static>(
    instance: &Instance,
    mut store: impl AsContextMut<Data = Data<Proxy<C>>>,
    context_id: u32,
) -> anyhow::Result<()> {
    // plugin_initialize plugin
    plugin_initialize(instance, &mut store).await?;
    // create root context
    plugin_ctx_create(instance, &mut store, ROOT_CTX_ID, 0).await?;
    // create request context
    plugin_ctx_create(instance, &mut store, context_id, ROOT_CTX_ID).await?;

    Ok(())
}

async fn plugin_initialize<C: Send + 'static>(
    instance: &Instance,
    mut store: impl AsContextMut<Data = Data<Proxy<C>>>,
) -> anyhow::Result<()> {
    if let Ok(func) = instance.get_typed_func::<(), ()>(&mut store, PLUGIN_INITIALIZE) {
        func.call_async(&mut store, ()).await?;
    } else if let Ok(func) = instance.get_typed_func::<(), ()>(&mut store, PLUGIN_START) {
        func.call_async(&mut store, ()).await?;
    } else {
        tracing::debug!("init function not found");
    }
    Ok(())
}

// create
async fn plugin_ctx_create<C: Send + 'static>(
    instance: &Instance,
    mut store: impl AsContextMut<Data = Data<Proxy<C>>>,
    ctx_id: u32,
    root_ctx_id: u32,
) -> anyhow::Result<()> {
    // create context
    let func = instance.get_typed_func::<(i32, i32), ()>(&mut store, PROXY_ON_CONTEXT_CREATE)?;
    func.call_async(&mut store, (ctx_id as i32, root_ctx_id as i32))
        .await?;

    Ok(())
}

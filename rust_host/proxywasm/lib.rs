mod executor;
mod host;
mod service;

pub use crate::executor::{ExecutorFactory, ProxyWasmExecutor};
pub use crate::host::proxy::Proxy;
pub use crate::service::ProxyWasmConfig;
pub use crate::service::ProxyWasmHost;
pub use crate::service::ProxyWasmService;
use smol_str::SmolStr;
use std::collections::HashMap;
use std::net::IpAddr;

pub type NodeDescription = HashMap<SmolStr, SmolStr>;

pub trait GeoLookup: Send + Sync {
    fn lookup_country(&self, ip: IpAddr) -> Option<&str>;
    fn lookup_country_name(&self, ip: IpAddr) -> Option<&str>;
    fn lookup_city(&self, ip: IpAddr) -> Option<&str>;
    fn lookup_asn(&self, ip: IpAddr) -> Option<u32>;
    fn lookup_geo_lat(&self, ip: IpAddr) -> Option<f64>;
    fn lookup_geo_long(&self, ip: IpAddr) -> Option<f64>;
    fn lookup_region(&self, ip: IpAddr) -> Option<&str>;
    fn lookup_continent(&self, ip: IpAddr) -> Option<&str>;
}

#[cfg(test)]
mod tests {
    use crate::executor::ProxyWasmExecutor;
    use crate::host::HostCommand;
    use crate::host::proxy::ProxyCommand;
    use crate::service::ProxyWasmService;
    use crate::{ExecutorFactory, GeoLookup, Proxy};
    use claims::*;
    use fastedge_proxywasm::v2::{Host, HostError};
    use fastedge_proxywasm::{
        AdditionalInfo, HostFunction, MapType, RequestId, Version, WasmBytes,
    };
    use http_backend::FastEdgeConnector;
    use http_backend::stats::ExtRequestStats;
    use key_value_store::ReadStats;
    use runtime::app::{KvStoreOption, SecretOption};
    use runtime::logger::Logger;
    use runtime::service::ServiceBuilder;
    use runtime::util::stats::{CdnPhase, StatsVisitor};
    use runtime::{
        App, ContextT, PreCompiledLoader, Router, WasiVersion, WasmConfig, WasmEngine,
        componentize_if_necessary,
    };
    use secret::SecretStore;
    use smol_str::{SmolStr, ToSmolStr};
    use std::collections::{HashMap, VecDeque};
    use std::net::IpAddr;
    use std::sync::{Arc, Mutex};
    use std::time::Duration;
    use tokio::sync::mpsc::Sender;
    use utils::{Dictionary, UserDiagStats};
    use wasmtime::component::Component;
    use wasmtime::{Engine, Module};

    #[derive(Clone)]
    pub(crate) struct TestContext {
        pub(crate) app: Option<App>,
        pub(crate) engine: Engine,
        pub(crate) wasm: Vec<u8>,
    }

    impl Router for TestContext {
        async fn lookup_by_name(&self, _name: &str) -> Option<App> {
            unreachable!()
        }

        async fn lookup_by_id(&self, _id: u64) -> Option<(SmolStr, App)> {
            self.app.clone().map(|a| ("test_app".to_smolstr(), a))
        }
    }

    impl ExecutorFactory<HostMock> for TestContext {
        fn get_executor(
            &self,
            name: SmolStr,
            cfg: &App,
            engine: &WasmEngine<Proxy<HostMock>>,
        ) -> anyhow::Result<ProxyWasmExecutor<HostMock>> {
            let env = cfg.env.iter().collect::<Vec<(&SmolStr, &SmolStr)>>();

            let mut dictionary = Dictionary::new();
            for (k, v) in env.iter() {
                dictionary.insert(k.to_string(), v.to_string());
            }

            let store_builder = engine
                .store_builder(WasiVersion::Preview1)
                .set_env(&env)
                .max_memory_size(cfg.mem_limit)
                .max_epoch_ticks(cfg.max_duration)
                .dictionary(dictionary);

            let module = self.loader().load_module(cfg.binary_id)?;
            let instance_pre = engine.module_instantiate_pre(&module)?;
            let geo = Arc::new(GeoLookupMock);
            tracing::debug!("Added application id:{} to cache", name);
            let mut node_description = HashMap::new();
            node_description.insert("hostname".to_smolstr(), "hostname".to_smolstr());
            let node_description = Arc::new(node_description);

            Ok(ProxyWasmExecutor::<HostMock>::new(
                instance_pre,
                store_builder,
                geo,
                node_description,
            ))
        }
    }

    struct TestStats;

    impl ReadStats for TestStats {
        fn count_kv_read(&self, _size: i32) {}
        fn count_kv_byod_read(&self, _size: i32) {}
    }

    impl UserDiagStats for TestStats {
        fn set_user_diag(&self, _diag: &str) {}
    }

    impl ExtRequestStats for TestStats {
        fn observe_ext(&self, _elapsed: Duration) {}
    }

    impl StatsVisitor for TestStats {
        fn status_code(&self, _status_code: u16) {}

        fn memory_used(&self, _memory_used: u64) {}

        fn fail_reason(&self, _fail_reason: u32) {}

        fn observe(&self, _elapsed: Duration) {}

        fn get_time_elapsed(&self) -> u64 {
            0
        }

        fn get_memory_used(&self) -> u64 {
            0
        }

        fn cdn_phase(&self, _phase: CdnPhase) {}
    }

    impl ContextT for TestContext {
        type BackendConnector = FastEdgeConnector;

        fn make_logger(&self, _name: SmolStr, _wrk: &App) -> Logger {
            todo!()
        }

        fn backend(&self) -> http_backend::Backend<Self::BackendConnector> {
            todo!()
        }

        fn loader(&self) -> &dyn PreCompiledLoader<u64> {
            self
        }

        fn engine_ref(&self) -> &Engine {
            &self.engine
        }

        fn make_secret_store(&self, _secrets: &Vec<SecretOption>) -> anyhow::Result<SecretStore> {
            todo!()
        }

        fn make_key_value_store(&self, _stores: &Vec<KvStoreOption>) -> key_value_store::Builder {
            todo!()
        }

        fn new_stats_row(
            &self,
            _request_id: &SmolStr,
            _app: &SmolStr,
            _cfg: &App,
        ) -> Arc<dyn StatsVisitor> {
            Arc::new(TestStats)
        }
    }

    impl PreCompiledLoader<u64> for TestContext {
        fn load_component(&self, _id: u64) -> anyhow::Result<Component> {
            let wasm_sample = componentize_if_necessary(&self.wasm)?;
            Component::new(&self.engine, wasm_sample)
        }

        fn load_module(&self, _id: u64) -> anyhow::Result<Module> {
            Module::new(&self.engine, &self.wasm)
        }
    }

    #[derive(Debug)]
    enum HostCommandType {
        Command(Host, Result<(), HostError>),
        RequestReply(Host, Result<WasmBytes, HostError>),
    }

    #[derive(Clone)]
    pub(crate) struct HostMock {
        expected: Arc<Mutex<VecDeque<HostCommandType>>>,
    }

    impl HostMock {
        pub(crate) fn expect_command(&self, cmd: Host, ret: Result<(), HostError>) {
            assert_ok!(self.expected.lock()).push_back(HostCommandType::Command(cmd, ret))
        }

        pub(crate) fn expect_request_reply(&self, cmd: Host, ret: Result<WasmBytes, HostError>) {
            assert_ok!(self.expected.lock()).push_back(HostCommandType::RequestReply(cmd, ret))
        }

        pub(crate) fn is_empty(&self) -> bool {
            tracing::debug!("proxy expected {:?}", self.expected.lock().unwrap());
            assert_ok!(self.expected.lock()).is_empty()
        }
    }

    impl Default for HostMock {
        fn default() -> Self {
            let mut expected = VecDeque::new();
            expected.push_back(HostCommandType::RequestReply(
                Host::GetMapValue {
                    map_type: MapType::HttpRequestHeaders,
                    key: WasmBytes::from_static(b"traceparent"),
                },
                Ok(WasmBytes::from_static(
                    b"00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
                )),
            ));
            expected.push_back(HostCommandType::RequestReply(
                Host::GetProperty {
                    path: WasmBytes::from_static(b"request.x_real_ip"),
                },
                Ok(WasmBytes::from_static(b"127.0.0.1")),
            ));
            Self {
                expected: Arc::new(Mutex::new(expected)),
            }
        }
    }

    #[async_trait::async_trait]
    impl HostCommand for HostMock {
        fn new(
            _version: Version,
            _request_id: RequestId,
            _additional_info: Option<AdditionalInfo>,
            _tx: Sender<ProxyCommand>,
        ) -> Self {
            todo!()
        }

        async fn command(&self, cmd: HostFunction) -> Result<(), HostError> {
            tracing::trace!(?cmd, "command");
            let mut guard = assert_ok!(self.expected.lock());
            match assert_some!(guard.pop_front()) {
                HostCommandType::Command(expected, ret) => {
                    assert_eq!(expected, cmd);
                    ret
                }
                HostCommandType::RequestReply(expected, _) => {
                    match expected {
                        Host::GetProperty { ref path } => {
                            let path = assert_ok!(std::str::from_utf8(path));
                            tracing::debug!("get param: {}", path);
                        }
                        _ => {}
                    }
                    panic!("unexpected request reply: {:?}", expected)
                }
            }
        }

        async fn request_reply(&self, cmd: HostFunction) -> Result<WasmBytes, HostError> {
            tracing::trace!(?cmd, "request_reply");
            let mut guard = assert_ok!(self.expected.lock());
            match assert_some!(guard.pop_front()) {
                HostCommandType::Command(expected, _) => {
                    panic!("unexpected command: {:?}", expected)
                }
                HostCommandType::RequestReply(expected, ret) => {
                    assert_eq!(expected, cmd);
                    ret
                }
            }
        }
    }

    #[derive(Clone)]
    pub(crate) struct GeoLookupMock;

    impl GeoLookup for GeoLookupMock {
        fn lookup_country(&self, _ip: IpAddr) -> Option<&str> {
            Some("fr")
        }

        fn lookup_country_name(&self, _ip: IpAddr) -> Option<&str> {
            Some("France")
        }

        fn lookup_city(&self, _ip: IpAddr) -> Option<&str> {
            Some("Paris")
        }

        fn lookup_asn(&self, _ip: IpAddr) -> Option<u32> {
            Some(23456)
        }

        fn lookup_geo_lat(&self, _ip: IpAddr) -> Option<f64> {
            Some(1.0)
        }

        fn lookup_geo_long(&self, _ip: IpAddr) -> Option<f64> {
            Some(1.0)
        }

        fn lookup_region(&self, _ip: IpAddr) -> Option<&str> {
            Some("eu")
        }

        fn lookup_continent(&self, _ip: IpAddr) -> Option<&str> {
            Some("Europe")
        }
    }

    #[tokio::test]
    #[tracing_test::traced_test]
    async fn test_make_executor() {
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

        let _proxywasm_service: ProxyWasmService<TestContext, HostMock> =
            assert_ok!(ServiceBuilder::new(context.clone()).build());

        /*let executor = assert_ok!(
            proxywasm_service.make_executor("app", &assert_some!(context.lookup("app").await))
        );

        let _executor = assert_ok!(executor.downcast::<ProxyWasmExecutor<HostMock>>());*/
    }
}

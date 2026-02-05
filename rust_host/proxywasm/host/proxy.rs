use crate::host::{Host, HostCommand};
use crate::{GeoLookup, NodeDescription};
use anyhow::Result;
use fastedge_proxywasm::property::{
    REQUEST_ASN, REQUEST_CITY, REQUEST_CONTINENT, REQUEST_COUNTRY, REQUEST_COUNTRY_NAME,
    REQUEST_GEO_LAT, REQUEST_GEO_LONG, REQUEST_HOST, REQUEST_PATH, REQUEST_REGION, REQUEST_SCHEME,
    REQUEST_URI, REQUEST_X_REAL_IP,
};
use fastedge_proxywasm::v2::{Host as HostFunction, HostError, ProxyStatus};
use fastedge_proxywasm::{BufferType, MapType, RequestId, WasmBytes};
use mini_moka::sync::Cache;
use runtime::store::HasStats;
use runtime::util::stats::StatsVisitor;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::{OnceCell, oneshot};

pub(crate) type HostResponse = (ProxyStatus, WasmBytes);

#[derive(Debug)]
pub struct ProxyCommand {
    pub(crate) request_id: RequestId,
    pub(crate) reply: Option<oneshot::Sender<HostResponse>>,
    pub(crate) message: HostFunction,
}

#[derive(Clone)]
pub struct Proxy<C> {
    host: C,
    pub(crate) status_code: OnceCell<i32>,
    property_cache: Cache<WasmBytes, WasmBytes>,
    geo: Arc<dyn GeoLookup>,
    stats: Arc<dyn StatsVisitor>,
    node_description: Arc<NodeDescription>,
}

impl<C> HasStats for Proxy<C> {
    fn get_stats(&self) -> Arc<dyn StatsVisitor> {
        self.stats.clone()
    }
}

impl<C> Proxy<C> {
    pub(crate) fn new(
        host: C,
        status_code: OnceCell<i32>,
        geo: Arc<dyn GeoLookup>,
        stats: Arc<dyn StatsVisitor>,
        node_description: Arc<NodeDescription>,
    ) -> Self {
        Self {
            host,
            status_code,
            property_cache: Cache::new(32),
            geo,
            stats,
            node_description,
        }
    }
}

#[async_trait::async_trait]
impl<C> Host for Proxy<C>
where
    C: HostCommand + Send + Sync,
{
    async fn proxy_log(&self, _level: i32, _message: WasmBytes) -> Result<(), HostError> {
        let message = std::str::from_utf8(&_message)?;
        tracing::debug!("{}:{}", _level, message);
        #[cfg(test)]
        {
            let _ = self
                .host
                .command(HostFunction::Log {
                    level: _level,
                    message: message.to_string(),
                })
                .await;
        }
        Ok(())
    }

    #[tracing::instrument(skip(self), level = "debug")]
    fn proxy_get_current_time_nanoseconds(&self) -> Result<u64, HostError> {
        let return_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .map_err(|e| HostError::InternalFailure(e.to_string()))?;
        Ok(return_time as u64)
    }

    #[tracing::instrument(skip(self), level = "debug")]
    fn proxy_set_tick_period_milliseconds(&self) -> Result<u64, HostError> {
        Err(HostError::Unimplemented(
            "unimplemented proxy_set_tick_period_milliseconds".to_string(),
        ))
    }

    #[tracing::instrument(skip(self), level = "debug")]
    async fn proxy_get_buffer_bytes(
        &self,
        buffer_type: BufferType,
        offset: i32,
        max_size: i32,
    ) -> Result<WasmBytes, HostError> {
        match buffer_type {
            BufferType::HttpRequestBody | BufferType::HttpResponseBody => {
                self.host
                    .request_reply(HostFunction::GetBufferBytes {
                        buffer_type,
                        start: offset,
                        max_size,
                    })
                    .await
            }
            _ => Err(HostError::Unimplemented(format!(
                "proxy_get_buffer_bytes unsupported buffer type: {:?}",
                buffer_type
            ))),
        }
    }

    #[tracing::instrument(skip(self, value), level = "debug")]
    async fn proxy_set_buffer_bytes(
        &self,
        buffer_type: BufferType,
        offset: i32,
        size: i32,
        value: WasmBytes,
    ) -> Result<(), HostError> {
        match buffer_type {
            BufferType::HttpRequestBody | BufferType::HttpResponseBody => {
                self.host
                    .command(HostFunction::SetBufferBytes {
                        buffer_type,
                        start: offset,
                        size,
                        value,
                    })
                    .await
            }
            _ => Err(HostError::Unimplemented(format!(
                "proxy_set_buffer_bytes unsupported buffer type: {:?}",
                buffer_type
            ))),
        }
    }

    #[tracing::instrument(skip(self), level = "debug")]
    async fn proxy_get_header_map_pairs(&self, map_type: MapType) -> Result<WasmBytes, HostError> {
        match map_type {
            MapType::HttpRequestHeaders | MapType::HttpResponseHeaders => {
                self.host
                    .request_reply(HostFunction::GetMapPairs { map_type })
                    .await
            }
            _ => Err(HostError::Unimplemented(format!(
                "proxy_get_header_map_pairs unsupported map type: {:?}",
                map_type
            ))),
        }
    }

    #[tracing::instrument(skip(self, map), level = "debug")]
    async fn proxy_set_header_map_pairs(
        &self,
        map_type: MapType,
        map: WasmBytes,
    ) -> Result<(), HostError> {
        match map_type {
            MapType::HttpRequestHeaders | MapType::HttpResponseHeaders => {
                self.host
                    .command(HostFunction::SetMapPairs { map_type, map })
                    .await?;
                Ok(())
            }
            _ => Err(HostError::Unimplemented(format!(
                "proxy_set_header_map_pairs unsupported map type: {:?}",
                map_type
            ))),
        }
    }

    #[tracing::instrument(skip(self), level = "debug")]
    async fn proxy_get_header_map_value(
        &self,
        map_type: MapType,
        key: WasmBytes,
    ) -> Result<WasmBytes, HostError> {
        match map_type {
            MapType::HttpRequestHeaders | MapType::HttpResponseHeaders => {
                self.host
                    .request_reply(HostFunction::GetMapValue { map_type, key })
                    .await
            }
            _ => Err(HostError::Unimplemented(format!(
                "proxy_get_header_map_value unsupported map type: {:?}",
                map_type
            ))),
        }
    }

    #[tracing::instrument(skip(self, value), level = "debug")]
    async fn proxy_replace_header_map_value(
        &self,
        map_type: MapType,
        key: WasmBytes,
        value: WasmBytes,
    ) -> Result<(), HostError> {
        match map_type {
            MapType::HttpRequestHeaders | MapType::HttpResponseHeaders => {
                self.host
                    .command(HostFunction::ReplaceMapValue {
                        map_type,
                        key,
                        value,
                    })
                    .await
            }
            _ => Err(HostError::Unimplemented(format!(
                "proxy_replace_header_map_value unsupported map type: {:?}",
                map_type
            ))),
        }
    }

    #[tracing::instrument(skip(self), level = "debug")]
    async fn proxy_remove_header_map_value(
        &self,
        map_type: MapType,
        key: WasmBytes,
    ) -> Result<(), HostError> {
        match map_type {
            MapType::HttpRequestHeaders | MapType::HttpResponseHeaders => {
                self.host
                    .command(HostFunction::RemoveMapValue { map_type, key })
                    .await
            }
            _ => Err(HostError::Unimplemented(format!(
                "proxy_remove_header_map_value unsupported map type: {:?}",
                map_type
            ))),
        }
    }

    #[tracing::instrument(skip(self, value), level = "debug")]
    async fn proxy_add_header_map_value(
        &self,
        map_type: MapType,
        key: WasmBytes,
        value: WasmBytes,
    ) -> Result<(), HostError> {
        match map_type {
            MapType::HttpRequestHeaders | MapType::HttpResponseHeaders => {
                self.host
                    .command(HostFunction::AddMapValue {
                        map_type,
                        key,
                        value,
                    })
                    .await
            }
            _ => Err(HostError::Unimplemented(format!(
                "proxy_add_header_map_value unsupported map type: {:?}",
                map_type
            ))),
        }
    }

    #[tracing::instrument(skip(self), level = "debug")]
    async fn proxy_get_property(&self, path: WasmBytes) -> Result<WasmBytes, HostError> {
        if let Some(value) = self.property_cache.get(&path) {
            return Ok(value.to_owned());
        }
        match &path[..] {
            REQUEST_COUNTRY => {
                let ip = self.proxy_get_property(REQUEST_X_REAL_IP.into()).await?;
                let ip = std::str::from_utf8(&ip)?;
                let ip = ip
                    .parse::<IpAddr>()
                    .map_err(|e| HostError::ParseFailure(e.to_string()))?;
                let country = self.geo.lookup_country(ip);
                Ok(country.map_or(WasmBytes::new(), |c| {
                    WasmBytes::copy_from_slice(c.as_bytes())
                }))
            }
            REQUEST_COUNTRY_NAME => {
                let ip = self.proxy_get_property(REQUEST_X_REAL_IP.into()).await?;
                let ip = std::str::from_utf8(&ip)?;
                let ip = ip
                    .parse::<IpAddr>()
                    .map_err(|e| HostError::ParseFailure(e.to_string()))?;
                let country = self.geo.lookup_country_name(ip);
                Ok(country.map_or(WasmBytes::new(), |c| {
                    WasmBytes::copy_from_slice(c.as_bytes())
                }))
            }
            REQUEST_CITY => {
                let ip = self.proxy_get_property(REQUEST_X_REAL_IP.into()).await?;
                let ip = std::str::from_utf8(&ip)?;
                let ip = ip
                    .parse::<IpAddr>()
                    .map_err(|e| HostError::ParseFailure(e.to_string()))?;
                let city = self.geo.lookup_city(ip);
                Ok(city.map_or(WasmBytes::new(), |c| {
                    WasmBytes::copy_from_slice(c.as_bytes())
                }))
            }
            REQUEST_ASN => {
                let ip = self.proxy_get_property(REQUEST_X_REAL_IP.into()).await?;
                let ip = std::str::from_utf8(&ip)?;
                let ip = ip
                    .parse::<IpAddr>()
                    .map_err(|e| HostError::ParseFailure(e.to_string()))?;
                let country = self.geo.lookup_asn(ip);
                Ok(country.map_or(WasmBytes::new(), |c| {
                    WasmBytes::copy_from_slice(c.to_string().as_bytes())
                }))
            }
            REQUEST_GEO_LAT => {
                let ip = self.proxy_get_property(REQUEST_X_REAL_IP.into()).await?;
                let ip = std::str::from_utf8(&ip)?;
                let ip = ip
                    .parse::<IpAddr>()
                    .map_err(|e| HostError::ParseFailure(e.to_string()))?;
                let country = self.geo.lookup_geo_lat(ip);
                Ok(country.map_or(WasmBytes::new(), |c| {
                    WasmBytes::copy_from_slice(c.to_string().as_bytes())
                }))
            }
            REQUEST_GEO_LONG => {
                let ip = self.proxy_get_property(REQUEST_X_REAL_IP.into()).await?;
                let ip = std::str::from_utf8(&ip)?;
                let ip = ip
                    .parse::<IpAddr>()
                    .map_err(|e| HostError::ParseFailure(e.to_string()))?;
                let country = self.geo.lookup_geo_long(ip);
                Ok(country.map_or(WasmBytes::new(), |c| {
                    WasmBytes::copy_from_slice(c.to_string().as_bytes())
                }))
            }
            REQUEST_REGION => {
                let ip = self.proxy_get_property(REQUEST_X_REAL_IP.into()).await?;
                let ip = std::str::from_utf8(&ip)?;
                let ip = ip
                    .parse::<IpAddr>()
                    .map_err(|e| HostError::ParseFailure(e.to_string()))?;
                let country = self.geo.lookup_region(ip);
                Ok(country.map_or(WasmBytes::new(), |c| {
                    WasmBytes::copy_from_slice(c.as_bytes())
                }))
            }
            REQUEST_CONTINENT => {
                let ip = self.proxy_get_property(REQUEST_X_REAL_IP.into()).await?;
                let ip = std::str::from_utf8(&ip)?;
                let ip = ip
                    .parse::<IpAddr>()
                    .map_err(|e| HostError::ParseFailure(e.to_string()))?;
                let country = self.geo.lookup_continent(ip);
                Ok(country.map_or(WasmBytes::new(), |c| {
                    WasmBytes::copy_from_slice(c.as_bytes())
                }))
            }
            REQUEST_URI => {
                let scheme = self.proxy_get_property(REQUEST_SCHEME.into()).await?;
                let host = self.proxy_get_property(REQUEST_HOST.into()).await?;
                let path = self.proxy_get_property(REQUEST_PATH.into()).await?;
                Ok(format!(
                    "{}://{}{}",
                    std::str::from_utf8(&scheme)?,
                    std::str::from_utf8(&host)?,
                    std::str::from_utf8(&path)?
                )
                .into())
            }
            REQUEST_SCHEME => {
                self.proxy_get_header_map_value(
                    MapType::HttpRequestHeaders,
                    WasmBytes::from_static(b"X-Forwarded-Proto"),
                )
                .await
            }
            REQUEST_HOST => {
                let host = match self
                    .proxy_get_header_map_value(
                        MapType::HttpRequestHeaders,
                        WasmBytes::from_static(b"X-CDN-Real-Host"),
                    )
                    .await
                {
                    Ok(value) => {
                        if let Some(role) = self.node_description.get("role") {
                            if role == "edge_shield" {
                                let mut host = Vec::with_capacity(7 + value.len());
                                host.extend_from_slice(b"shield_");
                                host.extend_from_slice(&value);
                                Ok(host.into())
                            } else {
                                Ok(value)
                            }
                        } else {
                            Ok(value)
                        }
                    }
                    error => error,
                }?;

                let host = if host.is_empty() {
                    match self
                        .host
                        .request_reply(HostFunction::GetProperty { path: path.clone() })
                        .await
                    {
                        Ok(value) => Ok(value),
                        error => error,
                    }?
                } else {
                    host
                };

                self.property_cache.insert(path, host.clone());
                Ok(host)
            }
            _ => {
                match self
                    .host
                    .request_reply(HostFunction::GetProperty { path: path.clone() })
                    .await
                {
                    Ok(value) => {
                        self.property_cache.insert(path, value.clone());
                        Ok(value)
                    }
                    error => error,
                }
            }
        }
    }

    #[tracing::instrument(skip(self, value), level = "debug")]
    async fn proxy_set_property(&self, path: WasmBytes, value: WasmBytes) -> Result<(), HostError> {
        self.host
            .command(HostFunction::SetProperty { path, value })
            .await
    }

    #[tracing::instrument(skip(self), level = "debug")]
    async fn proxy_get_shared_data(
        &self,
        _arg0: i32,
        _arg1: i32,
        _arg2: i32,
        _arg3: i32,
        _arg4: i32,
    ) -> i32 {
        tracing::warn!("unimplemented proxy_get_shared_data");
        12 // 12 is the unimplemented return value
    }

    #[tracing::instrument(skip(self), level = "debug")]
    async fn proxy_set_shared_data(
        &self,
        _arg0: i32,
        _arg1: i32,
        _arg2: i32,
        _arg3: i32,
        _arg4: i32,
    ) -> i32 {
        tracing::warn!("unimplemented proxy_set_shared_data");
        12 // 12 is the unimplemented return value
    }

    #[tracing::instrument(skip(self), level = "debug")]
    async fn proxy_register_shared_queue(&self, _arg0: i32, _arg1: i32, _arg2: i32) -> i32 {
        tracing::warn!("unimplemented proxy_register_shared_queue");
        12 // 12 is the unimplemented return value
    }

    #[tracing::instrument(skip(self), level = "debug")]
    async fn proxy_resolve_shared_queue(
        &self,
        _arg0: i32,
        _arg1: i32,
        _arg2: i32,
        _arg3: i32,
        _arg4: i32,
    ) -> i32 {
        tracing::warn!("unimplemented proxy_resolve_shared_queue");
        12 // 12 is the unimplemented return value
    }

    #[tracing::instrument(skip(self), level = "debug")]
    async fn proxy_dequeue_shared_queue(&self, _arg0: i32, _arg1: i32, _arg2: i32) -> i32 {
        tracing::warn!("unimplemented proxy_dequeue_shared_queue");
        12 // 12 is the unimplemented return value
    }

    #[tracing::instrument(skip(self), level = "debug")]
    async fn proxy_enqueue_shared_queue(&self, _arg0: i32, _arg1: i32, _arg2: i32) -> i32 {
        tracing::warn!("unimplemented proxy_enqueue_shared_queue");
        12 // 12 is the unimplemented return value
    }

    #[tracing::instrument(skip(self), level = "debug")]
    async fn proxy_continue_stream(&self, _arg0: i32) -> i32 {
        tracing::warn!("unimplemented proxy_continue_stream");
        12 // 12 is the unimplemented return value
    }

    #[tracing::instrument(skip(self), level = "debug")]
    async fn proxy_close_stream(&self, _arg0: i32) -> i32 {
        tracing::warn!("unimplemented proxy_close_stream");
        12 // 12 is the unimplemented return value
    }

    #[tracing::instrument(skip(self, _headers, body), level = "debug")]
    async fn proxy_send_local_response(
        &self,
        status_code: i32,
        _headers: WasmBytes,
        body: WasmBytes,
    ) -> Result<(), HostError> {
        tracing::trace!(
            "send local response: '{}' {}",
            status_code,
            std::str::from_utf8(&body).unwrap_or_default()
        );

        self.status_code
            .set(status_code)
            .map_err(|e| HostError::InternalFailure(e.to_string()))
    }

    async fn proxy_http_call(
        &self,
        _arg0: i32,
        _arg1: i32,
        _arg2: i32,
        _arg3: i32,
        _arg4: i32,
        _arg5: i32,
        _arg6: i32,
        _arg7: i32,
        _arg8: i32,
        _arg9: i32,
    ) -> i32 {
        tracing::warn!("unimplemented proxy_http_call");
        12 // 12 is the unimplemented return value
    }

    async fn proxy_grpc_call(
        &self,
        _arg0: i32,
        _arg1: i32,
        _arg2: i32,
        _arg3: i32,
        _arg4: i32,
        _arg5: i32,
        _arg6: i32,
        _arg7: i32,
        _arg8: i32,
        _arg9: i32,
        _arg10: i32,
        _arg11: i32,
    ) -> i32 {
        tracing::warn!("unimplemented proxy_grpc_call");
        12 // 12 is the unimplemented return value
    }

    async fn proxy_grpc_stream(
        &self,
        _arg0: i32,
        _arg1: i32,
        _arg2: i32,
        _arg3: i32,
        _arg4: i32,
        _arg5: i32,
        _arg6: i32,
        _arg7: i32,
        _arg8: i32,
    ) -> i32 {
        tracing::warn!("unimplemented proxy_grpc_stream");
        12 // 12 is the unimplemented return value
    }

    async fn proxy_grpc_send(&self, _arg0: i32, _arg1: i32, _arg2: i32, _arg3: i32) -> i32 {
        tracing::warn!("unimplemented proxy_grpc_send");
        12 // 12 is the unimplemented return value
    }

    async fn proxy_grpc_cancel(&self, _arg0: i32) -> i32 {
        tracing::warn!("unimplemented proxy_grpc_cancel");
        12 // 12 is the unimplemented return value
    }

    async fn proxy_grpc_close(&self, _arg0: i32) -> i32 {
        tracing::warn!("unimplemented proxy_grpc_close");
        12 // 12 is the unimplemented return value
    }

    async fn proxy_get_status(&self, _arg0: i32, _arg1: i32, _arg2: i32) -> i32 {
        tracing::warn!("unimplemented proxy_get_status");
        12 // 12 is the unimplemented return value
    }

    async fn proxy_set_effective_context(&self, _arg0: i32) -> i32 {
        tracing::warn!("unimplemented proxy_set_effective_context");
        12 // 12 is the unimplemented return value
    }

    async fn proxy_call_foreign_function(
        &self,
        _arg0: i32,
        _arg1: i32,
        _arg2: i32,
        _arg3: i32,
        _arg4: i32,
        _arg5: i32,
    ) -> i32 {
        tracing::warn!("unimplemented proxy_call_foreign_function");
        12 // 12 is the unimplemented return value
    }

    #[tracing::instrument(skip(self), level = "debug")]
    async fn proxy_done(&self) -> i32 {
        tracing::debug!("done");
        0
    }
}

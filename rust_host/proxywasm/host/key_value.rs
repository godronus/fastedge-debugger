use crate::host::{allocate, get_mem_data};
use fastedge_proxywasm::v2::ProxyStatus;
use runtime::{Data, ModuleLinker};
use wasmtime::{Caller, Extern};

pub fn add_to_linker<T>(
    linker: &mut ModuleLinker<T>,
    get: impl Fn(&mut Data<T>) -> &mut key_value_store::StoreImpl + Send + Sync + Copy + 'static,
) -> wasmtime::Result<()>
where
    T: Send,
{
    linker.func_wrap_async(
        "env",
        "proxy_kv_store_open",
        move |mut caller: Caller<'_, Data<T>>,
              (name_data, name_size, return_value): (i32, i32, i32)| {
            Box::new(async move {
                tracing::trace!(name_data, name_size, return_value, "proxy_kv_store_open");

                let Ok(name) = get_mem_data(&mut caller, name_data, name_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };
                let Ok(name) = std::str::from_utf8(&name) else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let store = get(caller.data_mut());
                let value = match store.open(name).await {
                    Ok(value_data) => value_data,
                    Err(key_value_store::Error::NoSuchStore) => {
                        tracing::warn!("env::proxy_kv_store_open: no such store");
                        return i32::from(ProxyStatus::NotFound);
                    }
                    Err(key_value_store::Error::AccessDenied) => {
                        tracing::warn!("env::proxy_kv_store_open: access denied");
                        return i32::from(ProxyStatus::BadArgument);
                    }
                    Err(error) => {
                        tracing::warn!(cause=?error, "env::proxy_kv_store_open");
                        return i32::from(ProxyStatus::InternalFailure);
                    }
                };

                let Some(Extern::Memory(mem)) = caller.get_export("memory") else {
                    tracing::debug!("failed to find host memory");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };
                // copy to wasm memory at allocated offset
                if let Err(error) =
                    mem.write(&mut caller, return_value as usize, &value.to_le_bytes())
                {
                    tracing::debug!(cause=?error, "mem write");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                }

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;

    linker.func_wrap_async(
        "env",
        "proxy_kv_store_get",
        move |mut caller: Caller<'_, Data<T>>,
              (handle, key_data, key_size, return_value_data, return_value_size): (
            i32,
            i32,
            i32,
            i32,
            i32,
        )| {
            Box::new(async move {
                tracing::trace!(
                    handle,
                    key_data,
                    key_size,
                    return_value_data,
                    return_value_size,
                    "proxy_kv_store_get"
                );

                let Ok(key) = get_mem_data(&mut caller, key_data, key_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };
                let Ok(key) = std::str::from_utf8(&key) else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let store = get(caller.data_mut());
                let value_data = match store.get(handle as u32, key).await {
                    Ok(Some(value_data)) => value_data,
                    Ok(None) => return i32::from(ProxyStatus::Ok),
                    Err(error) => {
                        tracing::debug!(cause=?error, "env::proxy_kv_store_get");
                        return i32::from(ProxyStatus::InternalFailure);
                    }
                };

                let value_size = value_data.len() as i32;
                let Ok(offset) = allocate(&mut caller, value_size).await else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                // copy to wasm memory at allocated offset
                let return_value_data = return_value_data as u32 as usize;
                let return_value_size = return_value_size as u32 as usize;

                let Some(Extern::Memory(mem)) = caller.get_export("memory") else {
                    tracing::debug!("failed to find host memory");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                if let Err(error) = mem.write(&mut caller, offset as usize, &value_data) {
                    tracing::debug!(cause=?error, "mem write");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                }
                mem.data_mut(&mut caller)[return_value_data..return_value_data + size_of::<i32>()]
                    .copy_from_slice(&offset.to_le_bytes());
                mem.data_mut(&mut caller)[return_value_size..return_value_size + size_of::<i32>()]
                    .copy_from_slice(&value_size.to_le_bytes());

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;

    linker.func_wrap_async(
        "env",
        "proxy_kv_store_zrange_by_score",
        move |mut caller: Caller<'_, Data<T>>,
              (handle, key_data, key_size, min, max, return_value_data, return_value_size): (
            i32,
            i32,
            i32,
            f64,
            f64,
            i32,
            i32,
        )| {
            Box::new(async move {
                tracing::trace!(
                    handle,
                    key_data,
                    key_size,
                    min,
                    max,
                    return_value_data,
                    return_value_size,
                    "proxy_kv_store_zrange_by_score"
                );

                let Ok(key) = get_mem_data(&mut caller, key_data, key_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };
                let Ok(key) = std::str::from_utf8(&key) else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let store = get(caller.data_mut());
                let value_data = match store.zrange_by_score(handle as u32, key, min, max).await {
                    Ok(mut value_data) => {
                        let value_data = value_data
                            .iter_mut()
                            .map(|(v, s)| {
                                v.extend_from_slice(&s.to_le_bytes());
                                v.as_slice()
                            })
                            .collect();
                        serialize_list(value_data)
                    }
                    Err(error) => {
                        tracing::debug!(cause=?error, "env::proxy_kv_store_zrange_by_score");
                        return i32::from(ProxyStatus::InternalFailure);
                    }
                };

                let value_size = value_data.len() as i32;
                let Ok(offset) = allocate(&mut caller, value_size).await else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                // copy to wasm memory at allocated offset
                let return_value_data = return_value_data as u32 as usize;
                let return_value_size = return_value_size as u32 as usize;

                let Some(Extern::Memory(mem)) = caller.get_export("memory") else {
                    tracing::debug!("failed to find host memory");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                if let Err(error) = mem.write(&mut caller, offset as usize, &value_data) {
                    tracing::debug!(cause=?error, "mem write");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                }
                mem.data_mut(&mut caller)[return_value_data..return_value_data + size_of::<i32>()]
                    .copy_from_slice(&offset.to_le_bytes());
                mem.data_mut(&mut caller)[return_value_size..return_value_size + size_of::<i32>()]
                    .copy_from_slice(&value_size.to_le_bytes());

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;

    linker.func_wrap_async(
        "env",
        "proxy_kv_store_scan",
        move |mut caller: Caller<'_, Data<T>>,
              (handle, pattern_data, pattern_size, return_value_data, return_value_size): (
            i32,
            i32,
            i32,
            i32,
            i32,
        )| {
            Box::new(async move {
                tracing::trace!(
                    handle,
                    pattern_data,
                    pattern_size,
                    return_value_data,
                    return_value_size,
                    "proxy_kv_store_scan"
                );

                let Ok(pattern) = get_mem_data(&mut caller, pattern_data, pattern_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };
                let Ok(pattern) = std::str::from_utf8(&pattern) else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let store = get(caller.data_mut());
                let value_data = match store.scan(handle as u32, pattern).await {
                    Ok(value_data) => {
                        serialize_list(value_data.iter().map(|v| v.as_bytes()).collect())
                    }
                    Err(error) => {
                        tracing::debug!(cause=?error, "env::proxy_kv_store_zrange");
                        return i32::from(ProxyStatus::InternalFailure);
                    }
                };

                let value_size = value_data.len() as i32;
                let Ok(offset) = allocate(&mut caller, value_size).await else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                // copy to wasm memory at allocated offset
                let return_value_data = return_value_data as u32 as usize;
                let return_value_size = return_value_size as u32 as usize;

                let Some(Extern::Memory(mem)) = caller.get_export("memory") else {
                    tracing::debug!("failed to find host memory");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                if let Err(error) = mem.write(&mut caller, offset as usize, &value_data) {
                    tracing::debug!(cause=?error, "mem write");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                }
                mem.data_mut(&mut caller)[return_value_data..return_value_data + size_of::<i32>()]
                    .copy_from_slice(&offset.to_le_bytes());
                mem.data_mut(&mut caller)[return_value_size..return_value_size + size_of::<i32>()]
                    .copy_from_slice(&value_size.to_le_bytes());

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;

    linker.func_wrap_async(
        "env",
        "proxy_kv_store_zscan",
        move |mut caller: Caller<'_, Data<T>>,
              (
            handle,
            key_data,
            key_size,
            pattern_data,
            pattern_size,
            return_value_data,
            return_value_size,
        ): (i32, i32, i32, i32, i32, i32, i32)| {
            Box::new(async move {
                tracing::trace!(
                    handle,
                    key_data,
                    key_size,
                    pattern_data,
                    pattern_size,
                    return_value_data,
                    return_value_size,
                    "proxy_kv_store_zscan"
                );

                let Ok(key) = get_mem_data(&mut caller, key_data, key_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };
                let Ok(key) = std::str::from_utf8(&key) else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let Ok(pattern) = get_mem_data(&mut caller, pattern_data, pattern_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };
                let Ok(pattern) = std::str::from_utf8(&pattern) else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let store = get(caller.data_mut());
                let value_data = match store.zscan(handle as u32, key, pattern).await {
                    Ok(mut value_data) => {
                        let value_data = value_data
                            .iter_mut()
                            .map(|(v, s)| {
                                v.extend_from_slice(&s.to_le_bytes());
                                v.as_slice()
                            })
                            .collect();
                        serialize_list(value_data)
                    }
                    Err(error) => {
                        tracing::debug!(cause=?error, "env::proxy_kv_store_zscan");
                        return i32::from(ProxyStatus::InternalFailure);
                    }
                };

                let value_size = value_data.len() as i32;
                let Ok(offset) = allocate(&mut caller, value_size).await else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                // copy to wasm memory at allocated offset
                let return_value_data = return_value_data as u32 as usize;
                let return_value_size = return_value_size as u32 as usize;

                let Some(Extern::Memory(mem)) = caller.get_export("memory") else {
                    tracing::debug!("failed to find host memory");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                if let Err(error) = mem.write(&mut caller, offset as usize, &value_data) {
                    tracing::debug!(cause=?error, "mem write");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                }
                mem.data_mut(&mut caller)[return_value_data..return_value_data + size_of::<i32>()]
                    .copy_from_slice(&offset.to_le_bytes());
                mem.data_mut(&mut caller)[return_value_size..return_value_size + size_of::<i32>()]
                    .copy_from_slice(&value_size.to_le_bytes());

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;

    linker.func_wrap_async(
        "env",
        "proxy_kv_store_bf_exists",
        move |mut caller: Caller<'_, Data<T>>,
              (handle, key_data, key_size, item_data, item_size, return_value): (
            i32,
            i32,
            i32,
            i32,
            i32,
            i32,
        )| {
            Box::new(async move {
                tracing::trace!(
                    handle,
                    key_data,
                    key_size,
                    item_data,
                    item_size,
                    return_value,
                    "proxy_kv_store_bf_exists"
                );

                let Ok(key) = get_mem_data(&mut caller, key_data, key_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };
                let Ok(key) = std::str::from_utf8(&key) else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let Ok(item) = get_mem_data(&mut caller, item_data, item_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };
                let Ok(item) = std::str::from_utf8(&item) else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let store = get(caller.data_mut());
                let value = match store.bf_exists(handle as u32, key, item).await {
                    Ok(value_data) => value_data as i32,
                    Err(error) => {
                        tracing::debug!(cause=?error, "env::proxy_kv_store_bf_exists");
                        return i32::from(ProxyStatus::InternalFailure);
                    }
                };

                let Some(Extern::Memory(mem)) = caller.get_export("memory") else {
                    tracing::debug!("failed to find host memory");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                // copy to wasm memory at allocated offset
                if let Err(error) =
                    mem.write(&mut caller, return_value as usize, &value.to_le_bytes())
                {
                    tracing::debug!(cause=?error, "mem write");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                }

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;

    Ok(())
}

// serializes a list of bytes into a single byte vector
#[inline]
fn serialize_list(list: Vec<&[u8]>) -> Vec<u8> {
    let size = list.iter().fold(4, |size, v| size + v.len() + 5);

    let mut bytes = Vec::with_capacity(size);
    bytes.extend_from_slice(&(list.len() as i32).to_le_bytes());

    for value in &list {
        bytes.extend_from_slice(&(value.len() as i32).to_le_bytes());
    }

    for value in list {
        bytes.extend(value);
        bytes.push(0);
    }
    bytes
}

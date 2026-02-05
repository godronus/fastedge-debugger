use crate::host::{allocate, get_mem_data};
use fastedge_proxywasm::v2::ProxyStatus;
use runtime::{Data, ModuleLinker};
use secret::SecretStore;
use wasmtime::{Caller, Extern};

pub fn add_to_linker<T>(
    linker: &mut ModuleLinker<T>,
    get: impl Fn(&mut Data<T>) -> &mut SecretStore + Send + Sync + Copy + 'static,
) -> wasmtime::Result<()>
where
    T: Send,
{
    linker.func_wrap_async(
        "env",
        "proxy_get_secret",
        move |mut caller: Caller<'_, Data<T>>,
              (key_data, key_size, return_value_data, return_value_size): (
                  i32,
                  i32,
                  i32,
                  i32,
              )| {
            Box::new(async move {
                tracing::trace!(
                    key_data,
                    key_size,
                    return_value_data,
                    return_value_size,
                    "proxy_get_secret"
                );

                let Ok(key) = get_mem_data(&mut caller, key_data, key_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };
                let Ok(key) = String::from_utf8(key.to_vec()) else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let secret = get(caller.data_mut());
                let value_data = match secret.get(key) {
                    Ok(Some(value_data)) => value_data,
                    Ok(None) => return i32::from(ProxyStatus::NotFound),
                    Err(error) => {
                        tracing::debug!(cause=?error, "env::proxy_get_secret");
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
                mem.data_mut(&mut caller)
                    [return_value_data..return_value_data + size_of::<i32>()]
                    .copy_from_slice(&offset.to_le_bytes());
                mem.data_mut(&mut caller)
                    [return_value_size..return_value_size + size_of::<i32>()]
                    .copy_from_slice(&value_size.to_le_bytes());

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;

    linker.func_wrap_async(
        "env",
        "proxy_get_effective_at_secret",
        move |mut caller: Caller<'_, Data<T>>,
              (key_data, key_size, at, return_value_data, return_value_size): (
            i32,
            i32,
            u32,
            i32,
            i32,
        )| {
            Box::new(async move {
                tracing::trace!(
                    key_data,
                    key_size,
                    return_value_data,
                    return_value_size,
                    "proxy_get_effective_at_secret"
                );
                let Ok(key) = get_mem_data(&mut caller, key_data, key_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };
                let Ok(key) = String::from_utf8(key.to_vec()) else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let secret = get(caller.data_mut());
                let value_data = match secret.get_effective_at(key, at as u64) {
                    Ok(Some(value_data)) => value_data,
                    Ok(None) => return i32::from(ProxyStatus::NotFound),
                    Err(error) => {
                        tracing::debug!(cause=?error, "env::proxy_get_effective_at_secret");
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
                    return i32::from(ProxyStatus::InternalFailure);
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
        "proxy_secret_get",
        move |mut caller: Caller<'_, Data<T>>,
              (key_data, key_size, return_value_data, return_value_size): (
                  i32,
                  i32,
                  i32,
                  i32,
              )| {
            Box::new(async move {
                tracing::trace!(
                    key_data,
                    key_size,
                    return_value_data,
                    return_value_size,
                    "proxy_secret_get"
                );

                let Ok(key) = get_mem_data(&mut caller, key_data, key_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };
                let Ok(key) = String::from_utf8(key.to_vec()) else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let secret = get(caller.data_mut());
                let value_data = match secret.get(key) {
                    Ok(Some(value_data)) => value_data,
                    Ok(None) => return i32::from(ProxyStatus::NotFound),
                    Err(error) => {
                        tracing::debug!(cause=?error, "env::proxy_secret_get");
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
                mem.data_mut(&mut caller)
                    [return_value_data..return_value_data + size_of::<i32>()]
                    .copy_from_slice(&offset.to_le_bytes());
                mem.data_mut(&mut caller)
                    [return_value_size..return_value_size + size_of::<i32>()]
                    .copy_from_slice(&value_size.to_le_bytes());

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;

    linker.func_wrap_async(
        "env",
        "proxy_secret_get_effective_at",
        move |mut caller: Caller<'_, Data<T>>,
              (key_data, key_size, at, return_value_data, return_value_size): (
            i32,
            i32,
            u32,
            i32,
            i32,
        )| {
            Box::new(async move {
                tracing::trace!(
                    key_data,
                    key_size,
                    return_value_data,
                    return_value_size,
                    "proxy_secret_get_effective_at"
                );
                let Ok(key) = get_mem_data(&mut caller, key_data, key_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };
                let Ok(key) = String::from_utf8(key.to_vec()) else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let secret = get(caller.data_mut());
                let value_data = match secret.get_effective_at(key, at as u64) {
                    Ok(Some(value_data)) => value_data,
                    Ok(None) => return i32::from(ProxyStatus::NotFound),
                    Err(error) => {
                        tracing::debug!(cause=?error, "env::proxy_secret_get_effective_at");
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
                    return i32::from(ProxyStatus::InternalFailure);
                }
                mem.data_mut(&mut caller)[return_value_data..return_value_data + size_of::<i32>()]
                    .copy_from_slice(&offset.to_le_bytes());
                mem.data_mut(&mut caller)[return_value_size..return_value_size + size_of::<i32>()]
                    .copy_from_slice(&value_size.to_le_bytes());

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;

    Ok(())
}

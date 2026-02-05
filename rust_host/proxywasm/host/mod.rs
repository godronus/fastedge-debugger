use fastedge_proxywasm::MapType;
use fastedge_proxywasm::Version;
use fastedge_proxywasm::v2::AdditionalInfo;
use fastedge_proxywasm::{
    BufferType, RequestId, WasmBytes,
    v2::{Host as HostFunction, HostError, ProxyStatus},
};
use wasmtime::{Caller, Extern};

use crate::host::proxy::ProxyCommand;
use runtime::{Data, ModuleLinker};

pub mod dictionary;
pub mod key_value;
pub mod proxy;
pub mod secret;
pub mod stats;

#[async_trait::async_trait]
pub trait HostCommand {
    fn new(
        version: Version,
        request_id: RequestId,
        additional_info: Option<AdditionalInfo>,
        tx: tokio::sync::mpsc::Sender<ProxyCommand>,
    ) -> Self;
    async fn command(&self, msg: HostFunction) -> Result<(), HostError>;
    async fn request_reply(&self, msg: HostFunction) -> Result<WasmBytes, HostError>;
}

macro_rules! add_to_linker_func0 {
    ($linker:ident, $name:ident, $get:ident) => {
        $linker.func_wrap_async(
            "env",
            stringify!($name),
            move |mut caller: Caller<'_, runtime::Data<T>>, ()| {
                Box::new(async move {
                    let host = $get(caller.data_mut().as_mut());
                    let r = Host::$name(host).await;
                    Ok((r,))
                })
            },
        )?;
    };
}

macro_rules! add_to_linker_func1 {
    ($linker:ident, $name:ident, $get:ident) => {
        $linker.func_wrap_async(
            "env",
            stringify!($name),
            move |mut caller: Caller<'_, runtime::Data<T>>, (arg1,)| {
                Box::new(async move {
                    let host = $get(caller.data_mut().as_mut());
                    let r = Host::$name(host, arg1).await;
                    Ok((r,))
                })
            },
        )?;
    };
}

macro_rules! add_to_linker_func3 {
    ($linker:ident, $name:ident, $get:ident) => {
        $linker.func_wrap_async(
            "env",
            stringify!($name),
            move |mut caller: Caller<'_, runtime::Data<T>>, (arg1, arg2, arg3)| {
                Box::new(async move {
                    let host = $get(caller.data_mut().as_mut());
                    let r = Host::$name(host, arg1, arg2, arg3).await;
                    Ok((r,))
                })
            },
        )?;
    };
}

macro_rules! add_to_linker_func4 {
    ($linker:ident, $name:ident, $get:ident) => {
        $linker.func_wrap_async(
            "env",
            stringify!($name),
            move |mut caller: Caller<'_, runtime::Data<T>>, (arg1, arg2, arg3, arg4)| {
                Box::new(async move {
                    let host = $get(caller.data_mut().as_mut());
                    let r = Host::$name(host, arg1, arg2, arg3, arg4).await;
                    Ok((r,))
                })
            },
        )?;
    };
}

macro_rules! add_to_linker_func5 {
    ($linker:ident, $name:ident, $get:ident) => {
        $linker.func_wrap_async(
            "env",
            stringify!($name),
            move |mut caller: Caller<'_, runtime::Data<T>>,
                  (arg1, arg2, arg3, arg4, arg5): (i32, i32, i32, i32, i32)| {
                Box::new(async move {
                    let host = $get(caller.data_mut().as_mut());
                    let r = Host::$name(host, arg1, arg2, arg3, arg4, arg5).await;
                    Ok((r,))
                })
            },
        )?;
    };
}

macro_rules! add_to_linker_func6 {
    ($linker:ident, $name:ident, $get:ident) => {
        $linker.func_wrap_async(
            "env",
            stringify!($name),
            move |mut caller: Caller<'_, runtime::Data<T>>,
                  (arg1, arg2, arg3, arg4, arg5, arg6)| {
                Box::new(async move {
                    let host = $get(caller.data_mut().as_mut());
                    let r = Host::$name(host, arg1, arg2, arg3, arg4, arg5, arg6).await;
                    Ok((r,))
                })
            },
        )?;
    };
}

macro_rules! add_to_linker_func9 {
    ($linker:ident, $name:ident, $get:ident) => {
        $linker.func_wrap_async(
            "env",
            stringify!($name),
            move |mut caller: Caller<'_, runtime::Data<T>>,
                  (arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9)| {
                Box::new(async move {
                    let host = $get(caller.data_mut().as_mut());
                    let r = Host::$name(host, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9)
                        .await;
                    Ok((r,))
                })
            },
        )?;
    };
}

macro_rules! add_to_linker_func10 {
    ($linker:ident, $name:ident, $get:ident) => {
        $linker.func_wrap_async(
            "env",
            stringify!($name),
            move |mut caller: Caller<'_, runtime::Data<T>>,
                  (arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10)| {
                Box::new(async move {
                    let host = $get(caller.data_mut().as_mut());
                    let r = Host::$name(
                        host, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10,
                    )
                    .await;
                    Ok((r,))
                })
            },
        )?;
    };
}

macro_rules! add_to_linker_func12 {
    ($linker:ident, $name:ident, $get:ident) => {
        $linker.func_wrap_async(
            "env",
            stringify!($name),
            move |mut caller: Caller<'_, runtime::Data<T>>,
                  (arg1,
                  arg2,
                  arg3,
                  arg4,
                  arg5,
                  arg6,
                  arg7,
                  arg8,
                  arg9,
                  arg10,
                  arg11,
                  arg12)| {
                Box::new(async move {
                    let host = $get(caller.data_mut().as_mut());
                    let r = Host::$name(
                        host, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10, arg11,
                        arg12,
                    )
                    .await;
                    Ok((r,))
                })
            },
        )?;
    };
}

async fn allocate<T: Send>(
    mut caller: &mut Caller<'_, Data<T>>,
    value_size: i32,
) -> anyhow::Result<i32> {
    let Some(Extern::Func(memory_allocate)) =
        caller.get_export("proxy_on_memory_allocate").or_else(|| {
            tracing::info!("get malloc export");
            caller.get_export("malloc")
        })
    else {
        tracing::warn!("failed to find memory allocation func");
        anyhow::bail!("failed to find memory allocation func")
    };
    memory_allocate
        .typed::<i32, i32>(&caller)?
        .call_async(&mut caller, value_size)
        .await
}

fn get_mem_data<T: Send>(
    caller: &mut Caller<'_, Data<T>>,
    data: i32,
    size: i32,
) -> anyhow::Result<WasmBytes> {
    let data = data as u32 as usize;
    let size = size as u32 as usize;
    let Some(Extern::Memory(mem)) = caller.get_export("memory") else {
        tracing::debug!("failed to find host memory");
        anyhow::bail!("failed to find host memory")
    };
    let Some(data) = mem.data(caller).get(data..(data + size)) else {
        tracing::debug!("failed to get key data slice");
        anyhow::bail!("failed to get key data slice")
    };
    Ok(WasmBytes::copy_from_slice(data))
}

fn proxy_log<T, U>(
    linker: &mut ModuleLinker<T>,
    get: impl Fn(&T) -> &U + Send + Sync + Copy + 'static,
) -> wasmtime::Result<()>
where
    T: Send,
    U: Host + Send,
{
    linker.func_wrap_async(
        "env",
        "proxy_log",
        move |mut caller: Caller<'_, Data<T>>, (log_level, message_data, message_size)| {
            Box::new(async move {
                let Ok(message) = get_mem_data(&mut caller, message_data, message_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                let host = get(caller.data().as_ref());

                if let Err(error) = Host::proxy_log(host, log_level, message).await {
                    i32::from(ProxyStatus::from(error))
                } else {
                    i32::from(ProxyStatus::Ok)
                }
            })
        },
    )?;
    Ok(())
}

fn proxy_get_header_map_pairs<T, U>(
    linker: &mut ModuleLinker<T>,
    get: impl Fn(&T) -> &U + Send + Sync + Copy + 'static,
) -> wasmtime::Result<()>
where
    T: Send,
    U: Host + Send,
{
    linker.func_wrap_async(
        "env",
        "proxy_get_header_map_pairs",
        move |mut caller: Caller<'_, Data<T>>,
              (map_type, return_map_data, return_map_size): (i32, i32, i32)| {
            Box::new(async move {
                tracing::trace!(
                    map_type,
                    return_map_data,
                    return_map_size,
                    "proxy_get_header_map_pairs"
                );

                let host = get(caller.data().as_ref());
                let Ok(map_type) = map_type.try_into() else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let map_data = match Host::proxy_get_header_map_pairs(host, map_type).await {
                    Ok(map_data) => map_data,
                    Err(error) => {
                        tracing::debug!(cause=?error, "host proxy_get_header_map_pairs");
                        return i32::from(ProxyStatus::from(error));
                    }
                };
                let map_size = map_data.len() as u32 as i32;

                let Ok(offset) = allocate(&mut caller, map_size).await else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                let Some(Extern::Memory(mem)) = caller.get_export("memory") else {
                    tracing::debug!("failed to find host memory");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                // copy to wasm memory at allocated offset
                let return_map_data = return_map_data as usize;
                let return_map_size = return_map_size as usize;

                if let Err(error) = mem.write(&mut caller, offset as usize, &map_data) {
                    tracing::debug!(cause=?error, "mem write");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                }

                mem.data_mut(&mut caller)
                    [return_map_data..return_map_data + std::mem::size_of::<i32>()]
                    .copy_from_slice(&offset.to_le_bytes());
                mem.data_mut(&mut caller)
                    [return_map_size..return_map_size + std::mem::size_of::<i32>()]
                    .copy_from_slice(&map_size.to_le_bytes());

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;
    Ok(())
}

fn proxy_set_header_map_pairs<T, U>(
    linker: &mut ModuleLinker<T>,
    get: impl Fn(&T) -> &U + Send + Sync + Copy + 'static,
) -> wasmtime::Result<()>
where
    T: Send,
    U: Host + Send,
{
    linker.func_wrap_async(
        "env",
        "proxy_set_header_map_pairs",
        move |mut caller: Caller<'_, runtime::Data<T>>,
              (map_type, map_data, map_size): (i32, i32, i32)| {
            Box::new(async move {
                tracing::trace!(map_type, map_data, map_size, "proxy_set_header_map_pairs");

                let Ok(map_type) = map_type.try_into() else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let Ok(map_data) = get_mem_data(&mut caller, map_data, map_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                let host = get(caller.data().as_ref());

                match Host::proxy_set_header_map_pairs(host, map_type, map_data).await {
                    Ok(_) => i32::from(ProxyStatus::Ok),
                    Err(error) => {
                        tracing::debug!(cause=?error, "host proxy_set_header_map_pairs");
                        i32::from(ProxyStatus::from(error))
                    }
                }
            })
        },
    )?;
    Ok(())
}

fn proxy_get_header_map_value<T, U>(
    linker: &mut ModuleLinker<T>,
    get: impl Fn(&T) -> &U + Send + Sync + Copy + 'static,
) -> wasmtime::Result<()>
where
    T: Send,
    U: Host + Send,
{
    linker.func_wrap_async(
        "env",
        "proxy_get_header_map_value",
        move |mut caller: Caller<'_, runtime::Data<T>>,
              (map_type, key_data, key_size, return_value_data, return_value_size): (
            i32,
            i32,
            i32,
            i32,
            i32,
        )| {
            Box::new(async move {
                tracing::trace!(
                    map_type,
                    key_data,
                    key_size,
                    return_value_data,
                    return_value_size,
                    "proxy_get_header_map_value"
                );
                let Ok(map_type) = map_type.try_into() else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let Ok(key) = get_mem_data(&mut caller, key_data, key_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };
                let host = get(caller.data().as_ref());
                let value_data = match Host::proxy_get_header_map_value(host, map_type, key).await {
                    Ok(value_data) => value_data,
                    Err(error) => {
                        tracing::debug!(cause=?error, "host proxy_get_header_map_value");
                        return i32::from(ProxyStatus::from(error));
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
                    [return_value_data..return_value_data + std::mem::size_of::<i32>()]
                    .copy_from_slice(&offset.to_le_bytes());
                mem.data_mut(&mut caller)
                    [return_value_size..return_value_size + std::mem::size_of::<i32>()]
                    .copy_from_slice(&value_size.to_le_bytes());

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;
    Ok(())
}

fn proxy_replace_header_map_value<T, U>(
    linker: &mut ModuleLinker<T>,
    get: impl Fn(&T) -> &U + Send + Sync + Copy + 'static,
) -> wasmtime::Result<()>
where
    T: Send,
    U: Host + Send,
{
    linker.func_wrap_async(
        "env",
        "proxy_replace_header_map_value",
        move |mut caller: Caller<'_, runtime::Data<T>>,
              (map_type,
                  key_data,
                  key_size,
                  value_data,
                  value_size): (
                  i32,
                  i32,
                  i32,
                  i32,
                  i32,
              )| {
            Box::new(async move {
                tracing::trace!(
                    map_type,
                    key_data,
                    key_size,
                    value_data,
                    value_size,
                    "proxy_replace_header_map_value"
                );
                let Ok(map_type) = map_type.try_into() else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let Ok(key) = get_mem_data(&mut caller, key_data, key_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };
                let Ok(value) = get_mem_data(&mut caller, value_data, value_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                let host = get(caller.data().as_ref());
                if let Err(error) =
                    Host::proxy_replace_header_map_value(host, map_type, key, value).await
                {
                    tracing::debug!(cause=?error, "host proxy_replace_header_map_value");
                    return i32::from(ProxyStatus::from(error));
                }

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;
    Ok(())
}

fn proxy_remove_header_map_value<T, U>(
    linker: &mut ModuleLinker<T>,
    get: impl Fn(&T) -> &U + Send + Sync + Copy + 'static,
) -> wasmtime::Result<()>
where
    T: Send,
    U: Host + Send,
{
    linker.func_wrap_async(
        "env",
        "proxy_remove_header_map_value",
        move |mut caller: Caller<'_, runtime::Data<T>>,
              (map_type, key_data, key_size): (i32, i32, i32)| {
            Box::new(async move {
                tracing::trace!(
                    map_type,
                    key_data,
                    key_size,
                    "proxy_remove_header_map_value"
                );
                let Ok(map_type) = map_type.try_into() else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let Ok(key) = get_mem_data(&mut caller, key_data, key_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                let host = get(caller.data().as_ref());

                if let Err(error) = Host::proxy_remove_header_map_value(host, map_type, key).await {
                    tracing::debug!(cause=?error, "host proxy_remove_header_map_value");
                    return i32::from(ProxyStatus::from(error));
                }

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;
    Ok(())
}

fn proxy_add_header_map_value<T, U>(
    linker: &mut ModuleLinker<T>,
    get: impl Fn(&T) -> &U + Send + Sync + Copy + 'static,
) -> wasmtime::Result<()>
where
    T: Send,
    U: Host + Send,
{
    linker.func_wrap_async(
        "env",
        "proxy_add_header_map_value",
        move |mut caller: Caller<'_, Data<T>>,
              (map_type,
                  key_data,
                  key_size,
                  value_data,
                  value_size): (i32, i32, i32, i32, i32)| {
            Box::new(async move {
                tracing::trace!(
                    map_type,
                    key_data,
                    key_size,
                    value_data,
                    value_size,
                    "proxy_add_header_map_value"
                );
                let Ok(map_type) = map_type.try_into() else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let Ok(key) = get_mem_data(&mut caller, key_data, key_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };
                let Ok(value) = get_mem_data(&mut caller, value_data, value_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                let host = get(caller.data().as_ref());

                if let Err(error) =
                    Host::proxy_add_header_map_value(host, map_type, key, value).await
                {
                    tracing::debug!(cause=?error, "host proxy_add_header_map_value");
                    return i32::from(ProxyStatus::from(error));
                }

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;
    Ok(())
}

fn proxy_get_buffer_bytes<T, U>(
    linker: &mut ModuleLinker<T>,
    get: impl Fn(&T) -> &U + Send + Sync + Copy + 'static,
) -> wasmtime::Result<()>
where
    T: Send,
    U: Host + Send,
{
    linker.func_wrap_async(
        "env",
        "proxy_get_buffer_bytes",
        move |mut caller: Caller<'_, runtime::Data<T>>,
              (buffer_type, offset, max_size, return_buffer_data, return_buffer_size): (
            i32,
            i32,
            i32,
            i32,
            i32,
        )| {
            Box::new(async move {
                tracing::trace!(
                    buffer_type,
                    offset,
                    max_size,
                    return_buffer_data,
                    return_buffer_size,
                    "proxy_get_buffer_bytes"
                );

                let Ok(buffer_type) = buffer_type.try_into() else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let host = get(caller.data().as_ref());

                let value =
                    match Host::proxy_get_buffer_bytes(host, buffer_type, offset, max_size).await {
                        Ok(value) => value,
                        Err(error) => {
                            tracing::debug!(cause=?error, "host proxy_get_buffer_bytes");
                            return i32::from(ProxyStatus::from(error));
                        }
                    };

                let value_data = value.to_vec();
                let value_size = value.len() as i32;

                let Ok(offset) = allocate(&mut caller, value_size).await else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                let Some(Extern::Memory(mem)) = caller.get_export("memory") else {
                    tracing::debug!("failed to find host memory");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                // copy to wasm memory at allocated offset
                let return_buffer_data = return_buffer_data as u32 as usize;
                let return_buffer_size = return_buffer_size as u32 as usize;

                if let Err(error) = mem.write(&mut caller, offset as usize, &value_data) {
                    tracing::debug!(cause=?error, "mem write");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                }
                mem.data_mut(&mut caller)
                    [return_buffer_data..return_buffer_data + std::mem::size_of::<i32>()]
                    .copy_from_slice(&offset.to_le_bytes());
                mem.data_mut(&mut caller)
                    [return_buffer_size..return_buffer_size + std::mem::size_of::<i32>()]
                    .copy_from_slice(&value_size.to_le_bytes());

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;
    Ok(())
}

fn proxy_set_buffer_bytes<T, U>(
    linker: &mut ModuleLinker<T>,
    get: impl Fn(&T) -> &U + Send + Sync + Copy + 'static,
) -> wasmtime::Result<()>
where
    T: Send,
    U: Host + Send,
{
    linker.func_wrap_async(
        "env",
        "proxy_set_buffer_bytes",
        move |mut caller: Caller<'_, runtime::Data<T>>,
              (buffer_type, offset, max_size, return_buffer_data, return_buffer_size): (
            i32,
            i32,
            i32,
            i32,
            i32,
        )| {
            Box::new(async move {
                tracing::trace!(
                    buffer_type,
                    offset,
                    max_size,
                    return_buffer_data,
                    return_buffer_size,
                    "proxy_set_buffer_bytes"
                );
                let Ok(buffer_type) = buffer_type.try_into() else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let Ok(buffer_data) =
                    get_mem_data(&mut caller, return_buffer_data, return_buffer_size)
                else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                let host = get(caller.data().as_ref());
                if let Err(error) =
                    Host::proxy_set_buffer_bytes(host, buffer_type, offset, max_size, buffer_data)
                        .await
                {
                    tracing::debug!(cause=?error, "host proxy_set_buffer_bytes");
                    return i32::from(ProxyStatus::from(error));
                }

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;
    Ok(())
}

fn proxy_get_property<T, U>(
    linker: &mut ModuleLinker<T>,
    get: impl Fn(&T) -> &U + Send + Sync + Copy + 'static,
) -> wasmtime::Result<()>
where
    T: Send,
    U: Host + Send,
{
    linker.func_wrap_async(
        "env",
        "proxy_get_property",
        move |mut caller: Caller<'_, Data<T>>,
              (path_data, path_size, return_buffer_data, return_buffer_size): (
            i32,
            i32,
            i32,
            i32,
        )| {
            Box::new(async move {
                tracing::trace!(
                    path_data,
                    path_size,
                    return_buffer_data,
                    return_buffer_size,
                    "proxy_get_property"
                );
                let Ok(path) = get_mem_data(&mut caller, path_data, path_size) else {
                    tracing::warn!("host proxy_get_property: get_mem_data failed");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                let host = get(caller.data().as_ref());

                let value_data = match Host::proxy_get_property(host, path).await {
                    Ok(value) => value,
                    Err(error) => {
                        tracing::warn!(cause=?error, "host proxy_get_property");
                        return i32::from(ProxyStatus::from(error));
                    }
                };

                let value_size = value_data.len() as i32;

                let Ok(offset) = allocate(&mut caller, value_size).await else {
                    tracing::warn!("host proxy_get_property: allocate failed");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                let Some(Extern::Memory(mem)) = caller.get_export("memory") else {
                    tracing::warn!("host proxy_get_property: failed to find host memory");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                // copy to wasm memory at allocated offset
                let return_buffer_data = return_buffer_data as u32 as usize;
                let return_buffer_size = return_buffer_size as u32 as usize;

                if let Err(error) = mem.write(&mut caller, offset as usize, &value_data) {
                    tracing::warn!(cause=?error, "host proxy_get_property: mem write");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                }
                mem.data_mut(&mut caller)
                    [return_buffer_data..return_buffer_data + std::mem::size_of::<i32>()]
                    .copy_from_slice(&offset.to_le_bytes());
                mem.data_mut(&mut caller)
                    [return_buffer_size..return_buffer_size + std::mem::size_of::<i32>()]
                    .copy_from_slice(&value_size.to_le_bytes());

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;
    Ok(())
}

fn proxy_set_property<T, U>(
    linker: &mut ModuleLinker<T>,
    get: impl Fn(&T) -> &U + Send + Sync + Copy + 'static,
) -> wasmtime::Result<()>
where
    T: Send,
    U: Host + Send,
{
    linker.func_wrap_async(
        "env",
        "proxy_set_property",
        move |mut caller: Caller<'_, Data<T>>,
              (path_data, path_size, data, size): (i32, i32, i32, i32)| {
            Box::new(async move {
                tracing::trace!(path_data, path_size, data, size, "proxy_set_property");
                let Ok(path) = get_mem_data(&mut caller, path_data, path_size) else {
                    tracing::warn!("host proxy_set_property failed to get mem path");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                let Ok(data) = get_mem_data(&mut caller, data, size) else {
                    tracing::warn!("host proxy_set_property failed to get mem data");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                let host = get(caller.data().as_ref());
                if let Err(error) = Host::proxy_set_property(host, path, data).await {
                    tracing::warn!(cause=?error, "host proxy_set_property");
                    return i32::from(ProxyStatus::from(error));
                };

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;
    Ok(())
}

fn proxy_get_current_time_nanoseconds<T, U>(
    linker: &mut ModuleLinker<T>,
    get: impl Fn(&T) -> &U + Send + Sync + Copy + 'static,
) -> wasmtime::Result<()>
where
    T: Send,
    U: Host + Send,
{
    linker.func_wrap_async(
        "env",
        "proxy_get_current_time_nanoseconds",
        move |mut caller: Caller<'_, Data<T>>, (return_time,): (i32,)| {
            Box::new(async move {
                tracing::trace!(return_time, "proxy_get_current_time_nanoseconds");

                let host = get(caller.data().as_ref());
                let Ok(time_data) = Host::proxy_get_current_time_nanoseconds(host) else {
                    return i32::from(ProxyStatus::InternalFailure);
                };
                let Some(Extern::Memory(mem)) = caller.get_export("memory") else {
                    tracing::debug!("failed to find host memory");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };
                // copy to wasm memory at allocated offset
                if let Err(error) =
                    mem.write(&mut caller, return_time as usize, &time_data.to_le_bytes())
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

fn proxy_set_tick_period_milliseconds<T, U>(
    linker: &mut ModuleLinker<T>,
    get: impl Fn(&T) -> &U + Send + Sync + Copy + 'static,
) -> wasmtime::Result<()>
where
    T: Send,
    U: Host + Send,
{
    linker.func_wrap_async(
        "env",
        "proxy_set_tick_period_milliseconds",
        move |mut caller: Caller<'_, Data<T>>, (return_time,): (i32,)| {
            Box::new(async move {
                tracing::trace!(return_time, "proxy_set_tick_period_milliseconds");

                let host = get(caller.data().as_ref());
                let Ok(time_data) = Host::proxy_set_tick_period_milliseconds(host) else {
                    return i32::from(ProxyStatus::InternalFailure);
                };

                let Ok(offset) = allocate(&mut caller, std::mem::size_of::<u64>() as i32).await
                else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                let Some(Extern::Memory(mem)) = caller.get_export("memory") else {
                    tracing::debug!("failed to find host memory");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                // copy to wasm memory at allocated offset
                if let Err(error) =
                    mem.write(&mut caller, offset as usize, &time_data.to_le_bytes())
                {
                    tracing::debug!(cause=?error, "mem write");
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                }
                let return_time = return_time as u32 as usize;
                mem.data_mut(&mut caller)[return_time..return_time + std::mem::size_of::<i32>()]
                    .copy_from_slice(&offset.to_le_bytes());

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;
    Ok(())
}

fn proxy_send_local_response<T, U>(
    linker: &mut ModuleLinker<T>,
    get: impl Fn(&T) -> &U + Send + Sync + Copy + 'static,
) -> wasmtime::Result<()>
where
    T: Send,
    U: Host + Send,
{
    linker.func_wrap_async(
        "env",
        "proxy_send_local_response",
        move |mut caller: Caller<'_, Data<T>>,
              (
            status_code,
            status_code_details_data,
            status_code_details_size,
            body_data,
            body_size,
            headers_data,
            headers_size,
            grpc_status,
        ): (i32, i32, i32, i32, i32, i32, i32, i32)| {
            Box::new(async move {
                tracing::trace!(
                    status_code,
                    status_code_details_data,
                    status_code_details_size,
                    body_data,
                    body_size,
                    headers_data,
                    headers_size,
                    grpc_status,
                    "proxy_send_local_response"
                );
                let Ok(body) = get_mem_data(&mut caller, body_data, body_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                let Ok(headers) = get_mem_data(&mut caller, headers_data, headers_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };

                let host = get(caller.data().as_ref());
                let status =
                    match Host::proxy_send_local_response(host, status_code, headers, body).await {
                        Ok(_) => ProxyStatus::Ok,
                        Err(error) => ProxyStatus::from(error),
                    };
                i32::from(status)
            })
        },
    )?;
    Ok(())
}

pub fn add_to_linker<T, U>(
    linker: &mut ModuleLinker<T>,
    get: impl Fn(&T) -> &U + Send + Sync + Copy + 'static,
) -> wasmtime::Result<()>
where
    T: Send,
    U: Host + Send,
{
    proxy_log(linker, get)?;
    proxy_get_current_time_nanoseconds(linker, get)?;
    proxy_set_tick_period_milliseconds(linker, get)?;

    proxy_get_buffer_bytes(linker, get)?;
    proxy_set_buffer_bytes(linker, get)?;

    proxy_get_header_map_pairs(linker, get)?;
    proxy_set_header_map_pairs(linker, get)?;

    proxy_get_header_map_value(linker, get)?;
    proxy_replace_header_map_value(linker, get)?;
    proxy_remove_header_map_value(linker, get)?;
    proxy_add_header_map_value(linker, get)?;

    proxy_get_property(linker, get)?;
    proxy_set_property(linker, get)?;

    proxy_send_local_response(linker, get)?;

    add_to_linker_func5!(linker, proxy_get_shared_data, get);
    add_to_linker_func5!(linker, proxy_set_shared_data, get);
    add_to_linker_func3!(linker, proxy_register_shared_queue, get);
    add_to_linker_func5!(linker, proxy_resolve_shared_queue, get);
    add_to_linker_func3!(linker, proxy_dequeue_shared_queue, get);
    add_to_linker_func3!(linker, proxy_enqueue_shared_queue, get);
    add_to_linker_func1!(linker, proxy_continue_stream, get);
    add_to_linker_func1!(linker, proxy_close_stream, get);
    add_to_linker_func10!(linker, proxy_http_call, get);
    add_to_linker_func12!(linker, proxy_grpc_call, get);
    add_to_linker_func9!(linker, proxy_grpc_stream, get);
    add_to_linker_func4!(linker, proxy_grpc_send, get);
    add_to_linker_func1!(linker, proxy_grpc_cancel, get);
    add_to_linker_func1!(linker, proxy_grpc_close, get);
    add_to_linker_func3!(linker, proxy_get_status, get);
    add_to_linker_func1!(linker, proxy_set_effective_context, get);
    add_to_linker_func6!(linker, proxy_call_foreign_function, get);
    add_to_linker_func0!(linker, proxy_done, get);

    Ok(())
}

#[allow(clippy::too_many_arguments)]
#[async_trait::async_trait]
pub trait Host {
    async fn proxy_log(&self, log_level: i32, message: WasmBytes) -> Result<(), HostError>;
    fn proxy_get_current_time_nanoseconds(&self) -> Result<u64, HostError>;
    fn proxy_set_tick_period_milliseconds(&self) -> Result<u64, HostError>;
    async fn proxy_get_buffer_bytes(
        &self,
        buffer_type: BufferType,
        offset: i32,
        max_size: i32,
    ) -> Result<WasmBytes, HostError>;
    async fn proxy_set_buffer_bytes(
        &self,
        buffer_type: BufferType,
        offset: i32,
        max_size: i32,
        data: WasmBytes,
    ) -> Result<(), HostError>;

    async fn proxy_get_header_map_pairs(&self, map_type: MapType) -> Result<WasmBytes, HostError>;

    async fn proxy_set_header_map_pairs(
        &self,
        map_type: MapType,
        map: WasmBytes,
    ) -> Result<(), HostError>;

    async fn proxy_get_header_map_value(
        &self,
        map_type: MapType,
        key: WasmBytes,
    ) -> Result<WasmBytes, HostError>;

    async fn proxy_replace_header_map_value(
        &self,
        map_type: MapType,
        key: WasmBytes,
        value: WasmBytes,
    ) -> Result<(), HostError>;

    async fn proxy_remove_header_map_value(
        &self,
        map_type: MapType,
        key: WasmBytes,
    ) -> Result<(), HostError>;

    async fn proxy_add_header_map_value(
        &self,
        map_type: MapType,
        key: WasmBytes,
        value: WasmBytes,
    ) -> Result<(), HostError>;

    async fn proxy_get_property(&self, path: WasmBytes) -> Result<WasmBytes, HostError>;

    async fn proxy_set_property(&self, path: WasmBytes, value: WasmBytes) -> Result<(), HostError>;

    async fn proxy_get_shared_data(
        &self,
        arg0: i32,
        arg1: i32,
        arg2: i32,
        arg3: i32,
        arg4: i32,
    ) -> i32;

    async fn proxy_set_shared_data(
        &self,
        arg0: i32,
        arg1: i32,
        arg2: i32,
        arg3: i32,
        arg4: i32,
    ) -> i32;

    async fn proxy_register_shared_queue(&self, arg0: i32, arg1: i32, arg2: i32) -> i32;

    async fn proxy_resolve_shared_queue(
        &self,
        arg0: i32,
        arg1: i32,
        arg2: i32,
        arg3: i32,
        arg4: i32,
    ) -> i32;

    async fn proxy_dequeue_shared_queue(&self, arg0: i32, arg1: i32, arg2: i32) -> i32;

    async fn proxy_enqueue_shared_queue(&self, arg0: i32, arg1: i32, arg2: i32) -> i32;

    async fn proxy_continue_stream(&self, arg0: i32) -> i32;
    async fn proxy_close_stream(&self, arg0: i32) -> i32;

    async fn proxy_send_local_response(
        &self,
        status_code: i32,
        headers: WasmBytes,
        body: WasmBytes,
    ) -> Result<(), HostError>;

    async fn proxy_http_call(
        &self,
        arg0: i32,
        arg1: i32,
        arg2: i32,
        arg3: i32,
        arg4: i32,
        arg5: i32,
        arg6: i32,
        arg7: i32,
        arg8: i32,
        arg9: i32,
    ) -> i32;

    async fn proxy_grpc_call(
        &self,
        arg0: i32,
        arg1: i32,
        arg2: i32,
        arg3: i32,
        arg4: i32,
        arg5: i32,
        arg6: i32,
        arg7: i32,
        arg8: i32,
        arg9: i32,
        arg10: i32,
        arg11: i32,
    ) -> i32;
    async fn proxy_grpc_stream(
        &self,
        arg0: i32,
        arg1: i32,
        arg2: i32,
        arg3: i32,
        arg4: i32,
        arg5: i32,
        arg6: i32,
        arg7: i32,
        arg8: i32,
    ) -> i32;
    async fn proxy_grpc_send(&self, arg0: i32, arg1: i32, arg2: i32, arg3: i32) -> i32;
    async fn proxy_grpc_cancel(&self, arg0: i32) -> i32;
    async fn proxy_grpc_close(&self, arg0: i32) -> i32;

    async fn proxy_get_status(&self, arg0: i32, arg1: i32, arg2: i32) -> i32;
    async fn proxy_set_effective_context(&self, arg0: i32) -> i32;
    async fn proxy_call_foreign_function(
        &self,
        arg0: i32,
        arg1: i32,
        arg2: i32,
        arg3: i32,
        arg4: i32,
        arg5: i32,
    ) -> i32;

    async fn proxy_done(&self) -> i32;
}

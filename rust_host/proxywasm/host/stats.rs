use crate::host::get_mem_data;
use fastedge_proxywasm::v2::ProxyStatus;
use runtime::util::stats::StatsVisitor;
use runtime::{Data, ModuleLinker};
use std::sync::Arc;
use wasmtime::Caller;

pub fn add_to_linker<T>(
    linker: &mut ModuleLinker<T>,
    get: impl Fn(&mut Data<T>) -> Arc<dyn StatsVisitor> + Send + Sync + Copy + 'static,
) -> wasmtime::Result<()>
where
    T: Send,
{
    linker.func_wrap_async(
        "env",
        "stats_set_user_diag",
        move |mut caller: Caller<'_, Data<T>>, (value_data, value_size): (i32, i32)| {
            Box::new(async move {
                tracing::trace!(value_data, value_size, "stats_set_user_diag");

                let Ok(value) = get_mem_data(&mut caller, value_data, value_size) else {
                    return i32::from(ProxyStatus::InvalidMemoryAccess);
                };
                let Ok(value) = std::str::from_utf8(&value) else {
                    return i32::from(ProxyStatus::BadArgument);
                };

                let stats = get(caller.data_mut());
                stats.set_user_diag(value);

                i32::from(ProxyStatus::Ok)
            })
        },
    )?;

    Ok(())
}

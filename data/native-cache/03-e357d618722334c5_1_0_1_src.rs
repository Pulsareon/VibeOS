use vibeos_core::c_abi::{VibeAbi, VIBE_MODULE_OK};

#[unsafe(no_mangle)]
pub unsafe extern "C" fn vibe_module_main(abi: *const VibeAbi) -> i32 {
    let msg = "VibeOS Fix: hello from minimal module\0";
    ((*abi).log)((*abi).context, msg.as_ptr(), msg.len() - 1);
    VIBE_MODULE_OK
}
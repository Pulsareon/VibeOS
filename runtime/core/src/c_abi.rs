//! Stable C ABI for native Rust modules.
//!
//! Native modules are compiled as `cdylib` (or equivalent) and loaded by the
//! host. The host passes a `VibeAbi` table to the module's entry point. The
//! table contains function pointers for every system capability and an opaque
//! `context` pointer that the host uses to identify its state.
//!
//! A minimal native module looks like:
//!
//! ```rust
//! use vibeos_core::c_abi::{VibeAbi, VIBE_MODULE_OK};
//!
//! #[unsafe(no_mangle)]
//! pub unsafe extern "C" fn vibe_module_main(abi: *const VibeAbi) -> i32 {
//!     let abi = unsafe { &*abi };
//!     let message = b"hello from native module\0";
//!     unsafe { (abi.log)(abi.context, message.as_ptr(), message.len() - 1) };
//!     VIBE_MODULE_OK
//! }
//! ```

use core::ffi::c_void;

/// Success return code for `vibe_module_main`.
pub const VIBE_MODULE_OK: i32 = 0;
/// Generic failure return code for `vibe_module_main`.
pub const VIBE_MODULE_ERROR: i32 = -1;

/// Log a message. `message` points to `len` UTF-8 bytes.
pub type LogFn = unsafe extern "C" fn(context: *mut c_void, message: *const u8, len: usize);

/// Read a value from the system store.
/// `key`/`key_len` identify the value.
/// `out`/`out_cap` receive the value; `out_len` receives the actual length.
/// Returns 0 on success, negative on error.
pub type StoreGetFn = unsafe extern "C" fn(
    context: *mut c_void,
    key: *const u8,
    key_len: usize,
    out: *mut u8,
    out_cap: usize,
    out_len: *mut usize,
) -> i32;

/// Write a value to the system store.
/// `key`/`key_len` identify the value; `value`/`value_len` are the data.
/// Returns 0 on success, negative on error.
pub type StoreSetFn = unsafe extern "C" fn(
    context: *mut c_void,
    key: *const u8,
    key_len: usize,
    value: *const u8,
    value_len: usize,
) -> i32;

/// Read the current Unix timestamp in milliseconds.
/// Returns 0 on success, negative on error.
pub type TimeUnixMsFn = unsafe extern "C" fn(context: *mut c_void, out: *mut i64) -> i32;

/// Perform an HTTP GET request.
/// `url`/`url_len` is the URL. Response written to `out`/`out_cap`;
/// `out_len` receives the actual length.
/// Returns 0 on success, negative on error.
pub type HttpGetFn = unsafe extern "C" fn(
    context: *mut c_void,
    url: *const u8,
    url_len: usize,
    out: *mut u8,
    out_cap: usize,
    out_len: *mut usize,
) -> i32;

/// Perform an HTTP POST request.
/// `url`/`url_len` is the URL; `body`/`body_len` is the request body.
/// Response written to `out`/`out_cap`; `out_len` receives the actual length.
/// Returns 0 on success, negative on error.
pub type HttpPostFn = unsafe extern "C" fn(
    context: *mut c_void,
    url: *const u8,
    url_len: usize,
    body: *const u8,
    body_len: usize,
    out: *mut u8,
    out_cap: usize,
    out_len: *mut usize,
) -> i32;

/// Table of system capability function pointers passed to native modules.
/// This struct is `#[repr(C)]` so its layout is stable across compilers.
#[repr(C)]
#[derive(Debug)]
pub struct VibeAbi {
    pub version: u32,
    pub context: *mut c_void,
    pub log: LogFn,
    pub store_get: StoreGetFn,
    pub store_set: StoreSetFn,
    pub time_unix_ms: TimeUnixMsFn,
    pub http_get: HttpGetFn,
    pub http_post: HttpPostFn,
}

/// Native module entry point signature.
pub type VibeModuleMain = unsafe extern "C" fn(abi: *const VibeAbi) -> i32;

impl VibeAbi {
    pub const VERSION: u32 = 1;
}

//! Stable C ABI for native Rust modules.

use core::ffi::c_void;

pub const VIBE_MODULE_OK: i32 = 0;
pub const VIBE_MODULE_ERROR: i32 = -1;

pub type LogFn = unsafe extern "C" fn(context: *mut c_void, message: *const u8, len: usize);

pub type DisplayGetInfoFn =
    unsafe extern "C" fn(context: *mut c_void, width: *mut u32, height: *mut u32);

pub type DisplayPresentFn =
    unsafe extern "C" fn(context: *mut c_void, width: u32, height: u32, pixels: *const u8);

#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct InputEvent {
    pub kind: u32,
    pub code: u32,
    pub x: i32,
    pub y: i32,
}

pub type InputPollFn =
    unsafe extern "C" fn(context: *mut c_void, event: *mut InputEvent) -> i32;

pub type StoreGetFn = unsafe extern "C" fn(
    context: *mut c_void,
    key: *const u8,
    key_len: usize,
    out: *mut u8,
    out_cap: usize,
    out_len: *mut usize,
) -> i32;

pub type StoreSetFn = unsafe extern "C" fn(
    context: *mut c_void,
    key: *const u8,
    key_len: usize,
    value: *const u8,
    value_len: usize,
) -> i32;

pub type TimeUnixMsFn = unsafe extern "C" fn(context: *mut c_void, out: *mut i64) -> i32;

pub type HttpGetFn = unsafe extern "C" fn(
    context: *mut c_void,
    url: *const u8,
    url_len: usize,
    out: *mut u8,
    out_cap: usize,
    out_len: *mut usize,
) -> i32;

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

#[repr(C)]
#[derive(Debug)]
pub struct VibeAbi {
    pub version: u32,
    pub context: *mut c_void,
    pub log: LogFn,
    pub display_get_info: DisplayGetInfoFn,
    pub display_present: DisplayPresentFn,
    pub input_poll: InputPollFn,
    pub store_get: StoreGetFn,
    pub store_set: StoreSetFn,
    pub time_unix_ms: TimeUnixMsFn,
    pub http_get: HttpGetFn,
    pub http_post: HttpPostFn,
}

pub type VibeModuleMain = unsafe extern "C" fn(abi: *const VibeAbi) -> i32;

impl VibeAbi {
    pub const VERSION: u32 = 2;
}

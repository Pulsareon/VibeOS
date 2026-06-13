use std::ffi::c_void;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use vibeos_core::c_abi::{InputEvent, VibeAbi};

#[allow(dead_code)]
pub fn host_abi(store_root: PathBuf) -> VibeAbi {
    let ctx = Box::into_raw(Box::new(store_root)) as *mut c_void;
    VibeAbi {
        version: VibeAbi::VERSION,
        context: ctx,
        log: host_log,
        display_get_info: host_display_get_info,
        display_present: host_display_present,
        input_poll: host_input_poll,
        store_get: host_store_get,
        store_set: host_store_set,
        time_unix_ms: host_time_unix_ms,
        http_get: host_http_get,
        http_post: host_http_post,
    }
}

#[allow(dead_code)]
pub fn host_abi_with_context(context: *mut c_void, _store_root: PathBuf) -> VibeAbi {
    VibeAbi {
        version: VibeAbi::VERSION,
        context,
        log: host_log,
        display_get_info: host_display_get_info,
        display_present: host_display_present,
        input_poll: host_input_poll,
        store_get: host_store_get,
        store_set: host_store_set,
        time_unix_ms: host_time_unix_ms,
        http_get: host_http_get,
        http_post: host_http_post,
    }
}

unsafe fn store_root_from_context(context: *mut c_void) -> &'static PathBuf {
    unsafe { &*(context as *const PathBuf) }
}

unsafe extern "C" fn host_log(_context: *mut c_void, message: *const u8, len: usize) {
    let bytes = unsafe { std::slice::from_raw_parts(message, len) };
    println!("[vibe-native] {}", String::from_utf8_lossy(bytes));
}

unsafe extern "C" fn host_display_get_info(
    _context: *mut c_void,
    width: *mut u32,
    height: *mut u32,
) {
    crate::display::get_info(unsafe { &mut *width }, unsafe { &mut *height });
}

unsafe extern "C" fn host_display_present(
    _context: *mut c_void,
    width: u32,
    height: u32,
    pixels: *const u8,
) {
    crate::display::present(width, height, pixels);
}

unsafe extern "C" fn host_input_poll(_context: *mut c_void, event: *mut InputEvent) -> i32 {
    crate::display::poll(unsafe { &mut *event })
}

unsafe extern "C" fn host_store_get(
    context: *mut c_void,
    key: *const u8,
    key_len: usize,
    out: *mut u8,
    out_cap: usize,
    out_len: *mut usize,
) -> i32 {
    let root = unsafe { store_root_from_context(context) };
    let key = unsafe { std::slice::from_raw_parts(key, key_len) };
    let key_str = match std::str::from_utf8(key) {
        Ok(s) => s,
        Err(_) => return -1,
    };
    let path = root.join(sanitize(key_str));
    let mut file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return -2,
    };
    let mut buf = vec![0u8; out_cap];
    let read = match file.read(&mut buf) {
        Ok(n) => n,
        Err(_) => return -3,
    };
    unsafe {
        std::ptr::copy_nonoverlapping(buf.as_ptr(), out, read);
        *out_len = read;
    }
    0
}

unsafe extern "C" fn host_store_set(
    context: *mut c_void,
    key: *const u8,
    key_len: usize,
    value: *const u8,
    value_len: usize,
) -> i32 {
    let root = unsafe { store_root_from_context(context) };
    let key = unsafe { std::slice::from_raw_parts(key, key_len) };
    let value = unsafe { std::slice::from_raw_parts(value, value_len) };
    let key_str = match std::str::from_utf8(key) {
        Ok(s) => s,
        Err(_) => return -1,
    };
    if std::fs::create_dir_all(root).is_err() {
        return -2;
    }
    let path = root.join(sanitize(key_str));
    let mut file = match std::fs::File::create(path) {
        Ok(f) => f,
        Err(_) => return -3,
    };
    if file.write_all(value).is_err() {
        return -4;
    }
    0
}

unsafe extern "C" fn host_time_unix_ms(_context: *mut c_void, out: *mut i64) -> i32 {
    let now = match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(d) => d,
        Err(_) => return -1,
    };
    unsafe {
        *out = now.as_millis() as i64;
    }
    0
}

unsafe extern "C" fn host_http_get(
    _context: *mut c_void,
    url: *const u8,
    url_len: usize,
    out: *mut u8,
    out_cap: usize,
    out_len: *mut usize,
) -> i32 {
    let url = match std::str::from_utf8(unsafe { std::slice::from_raw_parts(url, url_len) }) {
        Ok(s) => s,
        Err(_) => return -1,
    };
    let client = match reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
    {
        Ok(c) => c,
        Err(_) => return -2,
    };
    let response = match client.get(url).send() {
        Ok(r) => r,
        Err(_) => return -3,
    };
    let bytes = match response.bytes() {
        Ok(b) => b,
        Err(_) => return -4,
    };
    let len = bytes.len().min(out_cap);
    unsafe {
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), out, len);
        *out_len = len;
    }
    0
}

unsafe extern "C" fn host_http_post(
    _context: *mut c_void,
    url: *const u8,
    url_len: usize,
    body: *const u8,
    body_len: usize,
    out: *mut u8,
    out_cap: usize,
    out_len: *mut usize,
) -> i32 {
    let url = match std::str::from_utf8(unsafe { std::slice::from_raw_parts(url, url_len) }) {
        Ok(s) => s,
        Err(_) => return -1,
    };
    let body = unsafe { std::slice::from_raw_parts(body, body_len) };
    let client = match reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
    {
        Ok(c) => c,
        Err(_) => return -2,
    };
    let response = match client.post(url).body(body.to_vec()).send() {
        Ok(r) => r,
        Err(_) => return -3,
    };
    let bytes = match response.bytes() {
        Ok(b) => b,
        Err(_) => return -4,
    };
    let len = bytes.len().min(out_cap);
    unsafe {
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), out, len);
        *out_len = len;
    }
    0
}

fn sanitize(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' => c,
            _ => '_',
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn abi_log_does_not_panic() {
        let abi = host_abi(std::env::temp_dir().join("vibeos-c-abi-test"));
        let message = b"native abi test";
        unsafe { (abi.log)(abi.context, message.as_ptr(), message.len()) };
    }
}

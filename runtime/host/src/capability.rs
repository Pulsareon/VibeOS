use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use vibeos_core::Error;
use vibeos_core::capability::{Capability, CapabilityId, CapabilityRegistry, CapabilityVersion};

pub const SYS_LOG: &str = "sys:log";
pub const SYS_STORE: &str = "sys:store";
pub const SYS_TIME: &str = "sys:time";
pub const SYS_NET: &str = "sys:net";
pub const SYS_DISPLAY: &str = "sys:display";
pub const SYS_INPUT: &str = "sys:input";

fn id(value: &str) -> CapabilityId {
    CapabilityId::from_str(value).expect("valid capability id")
}

fn version(major: u16, minor: u16) -> CapabilityVersion {
    CapabilityVersion::new(major, minor)
}

pub struct SysLog;

impl Capability for SysLog {
    fn id(&self) -> CapabilityId {
        id(SYS_LOG)
    }
    fn version(&self) -> CapabilityVersion {
        version(1, 0)
    }
    fn invoke(&mut self, input: &[u8], _output: &mut [u8]) -> Result<usize, Error> {
        let message = core::str::from_utf8(input).map_err(|_| Error::InvalidPacket)?;
        println!("[vibe] {}", message);
        Ok(0)
    }
}

pub struct SysStore {
    root: PathBuf,
}

impl SysStore {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }
}

impl Capability for SysStore {
    fn id(&self) -> CapabilityId {
        id(SYS_STORE)
    }
    fn version(&self) -> CapabilityVersion {
        version(1, 0)
    }
    fn invoke(&mut self, input: &[u8], output: &mut [u8]) -> Result<usize, Error> {
        if input.len() < 4 {
            return Err(Error::InvalidPacket);
        }
        let op = &input[..4];
        let rest = &input[4..];
        if op == b"GET " {
            let name = sanitize(core::str::from_utf8(rest).unwrap_or("invalid"));
            let mut file = fs::File::open(self.root.join(&name)).map_err(|_| Error::Storage)?;
            Ok(file.read(output).map_err(|_| Error::Storage)?)
        } else if op == b"PUT " {
            let split = rest
                .iter()
                .position(|b| *b == b'\n')
                .ok_or(Error::InvalidPacket)?;
            let key = sanitize(core::str::from_utf8(&rest[..split]).unwrap_or("invalid"));
            let value = &rest[split + 1..];
            fs::create_dir_all(&self.root).map_err(|_| Error::Storage)?;
            let mut file = fs::File::create(self.root.join(&key)).map_err(|_| Error::Storage)?;
            file.write_all(value).map_err(|_| Error::Storage)?;
            Ok(0)
        } else {
            Err(Error::UnsupportedOperation)
        }
    }
}

fn sanitize(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' => c,
            _ => '_',
        })
        .collect()
}

pub struct SysTime;

impl Capability for SysTime {
    fn id(&self) -> CapabilityId {
        id(SYS_TIME)
    }
    fn version(&self) -> CapabilityVersion {
        version(1, 0)
    }
    fn invoke(&mut self, _input: &[u8], output: &mut [u8]) -> Result<usize, Error> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| Error::Storage)?;
        let text = format!("{}", now.as_millis());
        let bytes = text.as_bytes();
        if bytes.len() > output.len() {
            return Err(Error::BufferTooSmall);
        }
        output[..bytes.len()].copy_from_slice(bytes);
        Ok(bytes.len())
    }
}

pub struct SysNet;

impl Capability for SysNet {
    fn id(&self) -> CapabilityId {
        id(SYS_NET)
    }
    fn version(&self) -> CapabilityVersion {
        version(1, 0)
    }
    fn invoke(&mut self, input: &[u8], output: &mut [u8]) -> Result<usize, Error> {
        let request = core::str::from_utf8(input).map_err(|_| Error::InvalidPacket)?;
        let (method, rest) = request.split_once(' ').ok_or(Error::InvalidPacket)?;
        let (url, body) = match rest.split_once('\n') {
            Some((u, b)) => (u, Some(b)),
            None => (rest, None),
        };
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|_| Error::Transport)?;
        let response = match method {
            "GET" => client.get(url).send(),
            "POST" => {
                let mut builder = client.post(url);
                if let Some(body) = body {
                    builder = builder.body(body.to_owned());
                }
                builder.send()
            }
            _ => return Err(Error::UnsupportedOperation),
        }
        .map_err(|_| Error::Transport)?;
        let bytes = response.bytes().map_err(|_| Error::Transport)?;
        if bytes.len() > output.len() {
            return Err(Error::BufferTooSmall);
        }
        output[..bytes.len()].copy_from_slice(&bytes);
        Ok(bytes.len())
    }
}

pub struct SysDisplay;

impl Capability for SysDisplay {
    fn id(&self) -> CapabilityId {
        id(SYS_DISPLAY)
    }
    fn version(&self) -> CapabilityVersion {
        version(1, 0)
    }
    fn invoke(&mut self, input: &[u8], output: &mut [u8]) -> Result<usize, Error> {
        if input.is_empty() {
            return Err(Error::InvalidPacket);
        }
        match input[0] {
            0x01 => {
                let mut width = 0u32;
                let mut height = 0u32;
                crate::display::get_info(&mut width, &mut height);
                if output.len() < 8 {
                    return Err(Error::BufferTooSmall);
                }
                output[0..4].copy_from_slice(&width.to_le_bytes());
                output[4..8].copy_from_slice(&height.to_le_bytes());
                Ok(8)
            }
            0x02 => {
                if input.len() < 9 {
                    return Err(Error::InvalidPacket);
                }
                let width = u32::from_le_bytes(input[1..5].try_into().unwrap());
                let height = u32::from_le_bytes(input[5..9].try_into().unwrap());
                let pixels = &input[9..];
                crate::display::present(width, height, pixels.as_ptr());
                Ok(0)
            }
            _ => Err(Error::UnsupportedOperation),
        }
    }
}

pub struct SysInput;

impl Capability for SysInput {
    fn id(&self) -> CapabilityId {
        id(SYS_INPUT)
    }
    fn version(&self) -> CapabilityVersion {
        version(1, 0)
    }
    fn invoke(&mut self, _input: &[u8], output: &mut [u8]) -> Result<usize, Error> {
        let mut event = vibeos_core::c_abi::InputEvent::default();
        let available = crate::display::poll(&mut event);
        let size = std::mem::size_of::<vibeos_core::c_abi::InputEvent>();
        if output.len() < size + 1 {
            return Err(Error::BufferTooSmall);
        }
        output[0] = if available > 0 { 1 } else { 0 };
        unsafe {
            std::ptr::copy_nonoverlapping(
                &event as *const vibeos_core::c_abi::InputEvent as *const u8,
                output[1..].as_mut_ptr(),
                size,
            );
        }
        Ok(1 + size)
    }
}

pub struct HostCapabilityRegistry {
    capabilities: HashMap<CapabilityId, Box<dyn Capability + Send>>,
}

impl HostCapabilityRegistry {
    pub fn new(store_root: PathBuf) -> Self {
        let mut capabilities: HashMap<CapabilityId, Box<dyn Capability + Send>> = HashMap::new();
        capabilities.insert(id(SYS_LOG), Box::new(SysLog));
        capabilities.insert(id(SYS_STORE), Box::new(SysStore::new(store_root)));
        capabilities.insert(id(SYS_TIME), Box::new(SysTime));
        capabilities.insert(id(SYS_NET), Box::new(SysNet));
        capabilities.insert(id(SYS_DISPLAY), Box::new(SysDisplay));
        capabilities.insert(id(SYS_INPUT), Box::new(SysInput));
        Self { capabilities }
    }
}

impl CapabilityRegistry for HostCapabilityRegistry {
    fn invoke(
        &mut self,
        id: CapabilityId,
        input: &[u8],
        output: &mut [u8],
    ) -> Result<usize, Error> {
        self.capabilities
            .get_mut(&id)
            .ok_or(Error::CapabilityNotFound)?
            .invoke(input, output)
    }
    fn has(&self, id: CapabilityId, min_version: CapabilityVersion) -> bool {
        self.capabilities
            .get(&id)
            .map(|c| c.version() >= min_version)
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn store_round_trips_value() {
        let dir = std::env::temp_dir().join(format!(
            "vibeos-store-test-{}",
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let mut store = SysStore::new(dir.clone());
        let mut put = b"PUT ".to_vec();
        put.extend_from_slice(b"greeting\nhello world");
        store.invoke(&put, &mut []).unwrap();
        let mut output = [0u8; 64];
        let len = store.invoke(b"GET greeting", &mut output).unwrap();
        assert_eq!(&output[..len], b"hello world");
        fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn registry_has_builtin_capabilities() {
        let dir = std::env::temp_dir().join("vibeos-registry-test");
        let registry = HostCapabilityRegistry::new(dir);
        assert!(registry.has(id(SYS_LOG), version(1, 0)));
        assert!(registry.has(id(SYS_STORE), version(1, 0)));
        assert!(registry.has(id(SYS_TIME), version(1, 0)));
        assert!(registry.has(id(SYS_NET), version(1, 0)));
        assert!(registry.has(id(SYS_DISPLAY), version(1, 0)));
        assert!(registry.has(id(SYS_INPUT), version(1, 0)));
        assert!(!registry.has(id("sys:nope"), version(1, 0)));
    }
}

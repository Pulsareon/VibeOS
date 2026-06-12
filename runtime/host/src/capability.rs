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

fn id(value: &str) -> CapabilityId {
    CapabilityId::from_str(value).expect("valid capability id")
}

fn version(major: u16, minor: u16) -> CapabilityVersion {
    CapabilityVersion::new(major, minor)
}

/// Host implementation of `sys:log`: prints messages to stdout.
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

/// Host implementation of `sys:store`: key-value persistence under a directory.
pub struct SysStore {
    root: PathBuf,
}

impl SysStore {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    fn key_path(&self, key: &[u8]) -> PathBuf {
        // Store each key as a file named by its UTF-8 key under the root.
        // Non-UTF-8 keys are rejected.
        let name = core::str::from_utf8(key).unwrap_or("invalid");
        self.root.join(sanitize(name))
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
            let key = rest;
            let path = self.key_path(key);
            let mut file = fs::File::open(path).map_err(|_| Error::Storage)?;
            let read = file.read(output).map_err(|_| Error::Storage)?;
            Ok(read)
        } else if op == b"PUT " {
            let Some(split) = rest.iter().position(|b| *b == b'\n') else {
                return Err(Error::InvalidPacket);
            };
            let key = &rest[..split];
            let value = &rest[split + 1..];
            fs::create_dir_all(&self.root).map_err(|_| Error::Storage)?;
            let path = self.key_path(key);
            let mut file = fs::File::create(path).map_err(|_| Error::Storage)?;
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

/// Host implementation of `sys:time`: returns system time.
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

/// Host implementation of `sys:net`: simple HTTP client.
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
                if let Some(b) = body {
                    builder = builder.body(b.to_owned());
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

/// Host-side capability registry backed by a HashMap.
pub struct HostCapabilityRegistry {
    capabilities: HashMap<CapabilityId, Box<dyn Capability + Send>>,
}

impl HostCapabilityRegistry {
    pub fn new(store_root: PathBuf) -> Self {
        let mut capabilities: HashMap<CapabilityId, Box<dyn Capability + Send>> = HashMap::new();
        let log = SysLog;
        capabilities.insert(log.id(), Box::new(log));

        let store = SysStore::new(store_root);
        capabilities.insert(store.id(), Box::new(store));

        let time = SysTime;
        capabilities.insert(time.id(), Box::new(time));

        let net = SysNet;
        capabilities.insert(net.id(), Box::new(net));

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
        let capability = self
            .capabilities
            .get_mut(&id)
            .ok_or(Error::CapabilityNotFound)?;
        capability.invoke(input, output)
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
        let written = store.invoke(&put, &mut []).unwrap();
        assert_eq!(written, 0);

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
        assert!(!registry.has(id("sys:nope"), version(1, 0)));
    }
}

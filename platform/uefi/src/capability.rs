use vibeos_core::Error;
use vibeos_core::capability::{Capability, CapabilityId, CapabilityRegistry, CapabilityVersion};

use crate::Console;

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

/// UEFI implementation of `sys:log` using the console.
pub struct SysLog {
    console: *mut Console,
}

impl SysLog {
    pub const unsafe fn new(console: *mut Console) -> Self {
        Self { console }
    }
}

impl Capability for SysLog {
    fn id(&self) -> CapabilityId {
        id(SYS_LOG)
    }

    fn version(&self) -> CapabilityVersion {
        version(1, 0)
    }

    fn invoke(&mut self, input: &[u8], _output: &mut [u8]) -> Result<usize, Error> {
        // SAFETY: console pointer is valid for the lifetime of the UEFI app.
        unsafe {
            (*self.console).write(core::str::from_utf8_unchecked(input));
            (*self.console).write("\r\n");
        }
        Ok(0)
    }
}

/// UEFI implementation of `sys:time`. Currently a stub returning 0.
pub struct SysTime;

impl Capability for SysTime {
    fn id(&self) -> CapabilityId {
        id(SYS_TIME)
    }

    fn version(&self) -> CapabilityVersion {
        version(1, 0)
    }

    fn invoke(&mut self, _input: &[u8], output: &mut [u8]) -> Result<usize, Error> {
        // TODO: wire to UEFI Runtime Services GetTime.
        let text = b"0";
        if text.len() > output.len() {
            return Err(Error::BufferTooSmall);
        }
        output[..text.len()].copy_from_slice(text);
        Ok(text.len())
    }
}

/// UEFI implementation of `sys:store`. Currently a stub.
pub struct SysStore;

impl Capability for SysStore {
    fn id(&self) -> CapabilityId {
        id(SYS_STORE)
    }

    fn version(&self) -> CapabilityVersion {
        version(1, 0)
    }

    fn invoke(&mut self, _input: &[u8], _output: &mut [u8]) -> Result<usize, Error> {
        // TODO: wire to UEFI variables.
        Err(Error::CapabilityNotFound)
    }
}

/// UEFI implementation of `sys:net`. Not available in the minimal UEFI target.
pub struct SysNet;

impl Capability for SysNet {
    fn id(&self) -> CapabilityId {
        id(SYS_NET)
    }

    fn version(&self) -> CapabilityVersion {
        version(1, 0)
    }

    fn invoke(&mut self, _input: &[u8], _output: &mut [u8]) -> Result<usize, Error> {
        Err(Error::CapabilityNotFound)
    }
}

/// UEFI capability registry using fixed fields.
pub struct UefiCapabilityRegistry {
    log: SysLog,
    time: SysTime,
    store: SysStore,
    net: SysNet,
}

impl UefiCapabilityRegistry {
    /// # Safety
    /// `console` must remain valid for the lifetime of the registry.
    pub const unsafe fn new(console: *mut Console) -> Self {
        Self {
            log: unsafe { SysLog::new(console) },
            time: SysTime,
            store: SysStore,
            net: SysNet,
        }
    }
}

impl CapabilityRegistry for UefiCapabilityRegistry {
    fn invoke(
        &mut self,
        id: CapabilityId,
        input: &[u8],
        output: &mut [u8],
    ) -> Result<usize, Error> {
        if id == self.log.id() {
            self.log.invoke(input, output)
        } else if id == self.time.id() {
            self.time.invoke(input, output)
        } else if id == self.store.id() {
            self.store.invoke(input, output)
        } else if id == self.net.id() {
            self.net.invoke(input, output)
        } else {
            Err(Error::CapabilityNotFound)
        }
    }

    fn has(&self, id: CapabilityId, min_version: CapabilityVersion) -> bool {
        let check = |cap: &dyn Capability| cap.id() == id && cap.version() >= min_version;
        check(&self.log) || check(&self.time) || check(&self.store) || check(&self.net)
    }
}

use crate::VibeMode;
use crate::capability::{CapabilityRegistry, CapabilityRequirement};

pub const MODULE_MAGIC: [u8; 4] = *b"VPK1";
pub const MODULE_ABI_VERSION: u8 = 2;
pub const MAX_MODULE_ID: usize = 32;
const HEADER_LEN: usize = 20;

#[repr(u8)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ModuleFormat {
    VibeBytecode = 1,
    PortableUi = 2,
    WebAssembly = 3,
    NativeBinary = 4,
}

impl ModuleFormat {
    const fn decode(value: u8) -> Option<Self> {
        match value {
            1 => Some(Self::VibeBytecode),
            2 => Some(Self::PortableUi),
            3 => Some(Self::WebAssembly),
            4 => Some(Self::NativeBinary),
            _ => None,
        }
    }
}

#[repr(u8)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ModuleTarget {
    Portable = 0,
    X86_64Uefi = 1,
    Aarch64BareMetal = 2,
    Wasm32 = 3,
    Android = 4,
    Ios = 5,
    MacOs = 6,
    Linux = 7,
}

impl ModuleTarget {
    const fn decode(value: u8) -> Option<Self> {
        match value {
            0 => Some(Self::Portable),
            1 => Some(Self::X86_64Uefi),
            2 => Some(Self::Aarch64BareMetal),
            3 => Some(Self::Wasm32),
            4 => Some(Self::Android),
            5 => Some(Self::Ios),
            6 => Some(Self::MacOs),
            7 => Some(Self::Linux),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub struct Version {
    pub major: u16,
    pub minor: u16,
    pub patch: u16,
}

impl Version {
    pub const fn new(major: u16, minor: u16, patch: u16) -> Self {
        Self {
            major,
            minor,
            patch,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ModuleError {
    InvalidPackage,
    BufferTooSmall,
    AbiMismatch,
    IdTooLong,
    RegistryFull,
    AlreadyInstalled,
    NotFound,
    LoadFailed,
    InvokeFailed,
    CapabilityNotSatisfied,
}

pub struct ModulePackage<'a> {
    pub id: &'a [u8],
    pub version: Version,
    pub mode: VibeMode,
    pub format: ModuleFormat,
    pub target: ModuleTarget,
    /// Raw encoded capability requirements. Use `for_each_requirement` to iterate.
    pub capabilities: &'a [u8],
    pub payload: &'a [u8],
}

impl<'a> ModulePackage<'a> {
    pub fn decode(bytes: &'a [u8]) -> Result<Self, ModuleError> {
        if bytes.len() < HEADER_LEN || bytes[..4] != MODULE_MAGIC {
            return Err(ModuleError::InvalidPackage);
        }
        let abi_version = bytes[4];
        if abi_version == 1 {
            return Self::decode_v1(bytes);
        }
        if abi_version != MODULE_ABI_VERSION {
            return Err(ModuleError::AbiMismatch);
        }

        let mode = VibeMode::from_operation(bytes[5]).ok_or(ModuleError::InvalidPackage)?;
        let format = ModuleFormat::decode(bytes[6]).ok_or(ModuleError::InvalidPackage)?;
        let target = ModuleTarget::decode(bytes[7]).ok_or(ModuleError::InvalidPackage)?;
        let version = Version::new(
            u16::from_le_bytes([bytes[8], bytes[9]]),
            u16::from_le_bytes([bytes[10], bytes[11]]),
            u16::from_le_bytes([bytes[12], bytes[13]]),
        );
        let id_len = bytes[14] as usize;
        let payload_len = u32::from_le_bytes([bytes[15], bytes[16], bytes[17], bytes[18]]) as usize;
        let capabilities_len = bytes[19] as usize;

        if id_len == 0 || id_len > MAX_MODULE_ID {
            return Err(ModuleError::InvalidPackage);
        }

        let mut offset = HEADER_LEN;
        let mut remaining = bytes
            .len()
            .checked_sub(offset)
            .ok_or(ModuleError::InvalidPackage)?;
        for _ in 0..capabilities_len {
            if remaining == 0 {
                return Err(ModuleError::InvalidPackage);
            }
            let id_len_req = bytes[offset] as usize;
            let req_len = 1 + id_len_req + 4;
            if req_len > remaining {
                return Err(ModuleError::InvalidPackage);
            }
            offset += req_len;
            remaining -= req_len;
        }
        let capabilities_end = offset;

        let id_end = offset
            .checked_add(id_len)
            .ok_or(ModuleError::InvalidPackage)?;
        let payload_end = id_end
            .checked_add(payload_len)
            .ok_or(ModuleError::InvalidPackage)?;
        if payload_end != bytes.len() {
            return Err(ModuleError::InvalidPackage);
        }

        Ok(Self {
            id: &bytes[capabilities_end..id_end],
            version,
            mode,
            format,
            target,
            capabilities: &bytes[HEADER_LEN..capabilities_end],
            payload: &bytes[id_end..payload_end],
        })
    }

    fn decode_v1(bytes: &'a [u8]) -> Result<Self, ModuleError> {
        // Legacy v1 header layout: 19 bytes, no capabilities field.
        const V1_HEADER_LEN: usize = 19;
        if bytes.len() < V1_HEADER_LEN {
            return Err(ModuleError::InvalidPackage);
        }
        let mode = VibeMode::from_operation(bytes[5]).ok_or(ModuleError::InvalidPackage)?;
        let format = ModuleFormat::decode(bytes[6]).ok_or(ModuleError::InvalidPackage)?;
        let target = ModuleTarget::decode(bytes[7]).ok_or(ModuleError::InvalidPackage)?;
        let version = Version::new(
            u16::from_le_bytes([bytes[8], bytes[9]]),
            u16::from_le_bytes([bytes[10], bytes[11]]),
            u16::from_le_bytes([bytes[12], bytes[13]]),
        );
        let id_len = bytes[14] as usize;
        let payload_len = u32::from_le_bytes([bytes[15], bytes[16], bytes[17], bytes[18]]) as usize;
        if id_len == 0 || id_len > MAX_MODULE_ID {
            return Err(ModuleError::InvalidPackage);
        }
        let id_end = V1_HEADER_LEN
            .checked_add(id_len)
            .ok_or(ModuleError::InvalidPackage)?;
        let payload_end = id_end
            .checked_add(payload_len)
            .ok_or(ModuleError::InvalidPackage)?;
        if payload_end != bytes.len() {
            return Err(ModuleError::InvalidPackage);
        }
        Ok(Self {
            id: &bytes[V1_HEADER_LEN..id_end],
            version,
            mode,
            format,
            target,
            capabilities: &[],
            payload: &bytes[id_end..payload_end],
        })
    }

    pub fn encode(&self, output: &mut [u8]) -> Result<usize, ModuleError> {
        if self.id.is_empty()
            || self.id.len() > MAX_MODULE_ID
            || self.payload.len() > u32::MAX as usize
        {
            return Err(ModuleError::InvalidPackage);
        }

        let mut capabilities_len = 0usize;
        self.for_each_requirement(|_| {
            capabilities_len += 1;
            Ok(())
        })?;

        let mut capabilities_total = 0usize;
        self.for_each_requirement(|req| {
            capabilities_total += 1 + req.id.as_bytes().len() + 4;
            Ok(())
        })?;

        let total = HEADER_LEN + capabilities_total + self.id.len() + self.payload.len();
        if output.len() < total {
            return Err(ModuleError::BufferTooSmall);
        }

        output[..4].copy_from_slice(&MODULE_MAGIC);
        output[4] = MODULE_ABI_VERSION;
        output[5] = self.mode as u8;
        output[6] = self.format as u8;
        output[7] = self.target as u8;
        output[8..10].copy_from_slice(&self.version.major.to_le_bytes());
        output[10..12].copy_from_slice(&self.version.minor.to_le_bytes());
        output[12..14].copy_from_slice(&self.version.patch.to_le_bytes());
        output[14] = self.id.len() as u8;
        output[15..19].copy_from_slice(&(self.payload.len() as u32).to_le_bytes());
        output[19] = capabilities_len as u8;

        let mut offset = HEADER_LEN;
        self.for_each_requirement(|req| {
            let encoded = req
                .encode(&mut output[offset..])
                .map_err(|_| ModuleError::BufferTooSmall)?;
            offset += encoded;
            Ok(())
        })?;

        let id_end = offset + self.id.len();
        output[offset..id_end].copy_from_slice(self.id);
        let payload_end = id_end + self.payload.len();
        output[id_end..payload_end].copy_from_slice(self.payload);
        Ok(payload_end)
    }

    /// Iterate over declared capability requirements.
    pub fn for_each_requirement<F>(&self, mut callback: F) -> Result<(), ModuleError>
    where
        F: FnMut(CapabilityRequirement) -> Result<(), ModuleError>,
    {
        let mut offset = 0;
        while offset < self.capabilities.len() {
            let (req, consumed) = CapabilityRequirement::decode(&self.capabilities[offset..])
                .map_err(|_| ModuleError::InvalidPackage)?;
            callback(req)?;
            offset += consumed;
        }
        Ok(())
    }

    /// Check that all declared capability requirements are satisfied by the registry.
    pub fn check_capabilities(&self, registry: &dyn CapabilityRegistry) -> Result<(), ModuleError> {
        self.for_each_requirement(|req| {
            if !registry.has(req.id, req.min_version) {
                return Err(ModuleError::CapabilityNotSatisfied);
            }
            Ok(())
        })
    }
}

pub trait ModuleLoader {
    type Handle: Copy;

    fn load(&mut self, package: &ModulePackage<'_>) -> Result<Self::Handle, ModuleError>;
    fn unload(&mut self, handle: Self::Handle) -> Result<(), ModuleError>;
    fn invoke(
        &mut self,
        handle: Self::Handle,
        input: &[u8],
        output: &mut [u8],
        capabilities: &mut dyn CapabilityRegistry,
    ) -> Result<usize, ModuleError>;
}

#[derive(Clone, Copy)]
struct ModuleRecord<H: Copy> {
    id: [u8; MAX_MODULE_ID],
    id_len: u8,
    version: Version,
    mode: VibeMode,
    format: ModuleFormat,
    target: ModuleTarget,
    handle: H,
    enabled: bool,
}

impl<H: Copy> ModuleRecord<H> {
    fn matches(&self, id: &[u8]) -> bool {
        self.id_len as usize == id.len() && self.id[..self.id_len as usize] == *id
    }
}

pub struct ModuleRegistry<H: Copy, const SLOTS: usize> {
    records: [Option<ModuleRecord<H>>; SLOTS],
}

impl<H: Copy, const SLOTS: usize> Default for ModuleRegistry<H, SLOTS> {
    fn default() -> Self {
        Self::new()
    }
}

impl<H: Copy, const SLOTS: usize> ModuleRegistry<H, SLOTS> {
    pub const fn new() -> Self {
        Self {
            records: [None; SLOTS],
        }
    }

    pub fn install<L>(
        &mut self,
        package: &ModulePackage<'_>,
        loader: &mut L,
        capabilities: &dyn CapabilityRegistry,
    ) -> Result<(), ModuleError>
    where
        L: ModuleLoader<Handle = H>,
    {
        if package.id.len() > MAX_MODULE_ID {
            return Err(ModuleError::IdTooLong);
        }
        if self.records.iter().flatten().any(|record| {
            record.matches(package.id) && record.version == package.version && record.enabled
        }) {
            return Err(ModuleError::AlreadyInstalled);
        }

        package.check_capabilities(capabilities)?;

        let slot = self
            .records
            .iter()
            .position(Option::is_none)
            .ok_or(ModuleError::RegistryFull)?;
        let handle = loader.load(package).map_err(|_| ModuleError::LoadFailed)?;
        let mut id = [0; MAX_MODULE_ID];
        id[..package.id.len()].copy_from_slice(package.id);
        self.records[slot] = Some(ModuleRecord {
            id,
            id_len: package.id.len() as u8,
            version: package.version,
            mode: package.mode,
            format: package.format,
            target: package.target,
            handle,
            enabled: true,
        });
        Ok(())
    }

    pub fn latest_version(&self, id: &[u8]) -> Option<Version> {
        self.latest_index(id)
            .and_then(|index| self.records[index].map(|record| record.version))
    }

    pub fn latest_mode(&self, id: &[u8]) -> Option<VibeMode> {
        self.latest_index(id)
            .and_then(|index| self.records[index].map(|record| record.mode))
    }

    pub fn latest_format(&self, id: &[u8]) -> Option<ModuleFormat> {
        self.latest_index(id)
            .and_then(|index| self.records[index].map(|record| record.format))
    }

    pub fn latest_target(&self, id: &[u8]) -> Option<ModuleTarget> {
        self.latest_index(id)
            .and_then(|index| self.records[index].map(|record| record.target))
    }

    pub fn invoke_latest<L>(
        &self,
        id: &[u8],
        input: &[u8],
        output: &mut [u8],
        loader: &mut L,
        capabilities: &mut dyn CapabilityRegistry,
    ) -> Result<usize, ModuleError>
    where
        L: ModuleLoader<Handle = H>,
    {
        let index = self.latest_index(id).ok_or(ModuleError::NotFound)?;
        let record = self.records[index].ok_or(ModuleError::NotFound)?;
        loader
            .invoke(record.handle, input, output, capabilities)
            .map_err(|_| ModuleError::InvokeFailed)
    }

    pub fn rollback<L>(&mut self, id: &[u8], loader: &mut L) -> Result<Version, ModuleError>
    where
        L: ModuleLoader<Handle = H>,
    {
        let index = self.latest_index(id).ok_or(ModuleError::NotFound)?;
        let mut record = self.records[index].ok_or(ModuleError::NotFound)?;
        loader
            .unload(record.handle)
            .map_err(|_| ModuleError::LoadFailed)?;
        record.enabled = false;
        self.records[index] = Some(record);
        self.latest_version(id).ok_or(ModuleError::NotFound)
    }

    fn latest_index(&self, id: &[u8]) -> Option<usize> {
        self.records
            .iter()
            .enumerate()
            .filter_map(|(index, record)| record.map(|record| (index, record)))
            .filter(|(_, record)| record.enabled && record.matches(id))
            .max_by_key(|(_, record)| record.version)
            .map(|(index, _)| index)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Error;
    use crate::capability::{Capability, CapabilityId, CapabilityRegistry, CapabilityVersion};

    struct Loader;

    impl ModuleLoader for Loader {
        type Handle = u32;

        fn load(&mut self, package: &ModulePackage<'_>) -> Result<Self::Handle, ModuleError> {
            Ok(package.version.patch as u32)
        }

        fn unload(&mut self, _: Self::Handle) -> Result<(), ModuleError> {
            Ok(())
        }

        fn invoke(
            &mut self,
            handle: Self::Handle,
            _: &[u8],
            output: &mut [u8],
            _capabilities: &mut dyn CapabilityRegistry,
        ) -> Result<usize, ModuleError> {
            output[0] = handle as u8;
            Ok(1)
        }
    }

    struct DummyCapability;

    impl Capability for DummyCapability {
        fn id(&self) -> CapabilityId {
            CapabilityId::from_str("sys:dummy").unwrap()
        }

        fn version(&self) -> CapabilityVersion {
            CapabilityVersion::new(1, 0)
        }

        fn invoke(&mut self, _: &[u8], output: &mut [u8]) -> Result<usize, Error> {
            output[0] = 42;
            Ok(1)
        }
    }

    struct TestRegistry;

    impl CapabilityRegistry for TestRegistry {
        fn invoke(
            &mut self,
            id: CapabilityId,
            input: &[u8],
            output: &mut [u8],
        ) -> Result<usize, Error> {
            if id == CapabilityId::from_str("sys:dummy").unwrap() {
                DummyCapability.invoke(input, output)
            } else {
                Err(Error::CapabilityNotFound)
            }
        }

        fn has(&self, id: CapabilityId, min_version: CapabilityVersion) -> bool {
            id == CapabilityId::from_str("sys:dummy").unwrap()
                && CapabilityVersion::new(1, 0) >= min_version
        }
    }

    fn package(version: Version) -> ModulePackage<'static> {
        ModulePackage {
            id: b"demo",
            version,
            mode: VibeMode::Ui,
            format: ModuleFormat::NativeBinary,
            target: ModuleTarget::X86_64Uefi,
            capabilities: &[],
            payload: b"module",
        }
    }

    fn package_with_capability<'a>(version: Version, buffer: &'a mut [u8]) -> ModulePackage<'a> {
        let req = CapabilityRequirement {
            id: CapabilityId::from_str("sys:dummy").unwrap(),
            min_version: CapabilityVersion::new(1, 0),
        };
        let len = req.encode(buffer).unwrap();
        ModulePackage {
            id: b"demo",
            version,
            mode: VibeMode::Ui,
            format: ModuleFormat::NativeBinary,
            target: ModuleTarget::X86_64Uefi,
            capabilities: &buffer[..len],
            payload: b"module",
        }
    }

    #[test]
    fn loads_latest_and_rolls_back_without_heap_allocation() {
        let mut registry: ModuleRegistry<u32, 4> = ModuleRegistry::new();
        let mut loader = Loader;
        let mut capabilities = TestRegistry;
        registry
            .install(&package(Version::new(1, 0, 0)), &mut loader, &capabilities)
            .unwrap();
        registry
            .install(&package(Version::new(1, 0, 1)), &mut loader, &capabilities)
            .unwrap();

        let mut output = [0; 4];
        registry
            .invoke_latest(b"demo", b"", &mut output, &mut loader, &mut capabilities)
            .unwrap();
        assert_eq!(output[0], 1);
        assert_eq!(
            registry.rollback(b"demo", &mut loader).unwrap(),
            Version::new(1, 0, 0)
        );
    }

    #[test]
    fn encodes_and_decodes_a_native_ui_package() {
        let package = package(Version::new(2, 1, 3));
        let mut bytes = [0; 64];
        let length = package.encode(&mut bytes).unwrap();
        let decoded = ModulePackage::decode(&bytes[..length]).unwrap();
        assert_eq!(decoded.id, b"demo");
        assert_eq!(decoded.version, Version::new(2, 1, 3));
        assert_eq!(decoded.format, ModuleFormat::NativeBinary);
        assert_eq!(decoded.target, ModuleTarget::X86_64Uefi);
    }

    #[test]
    fn encodes_and_decodes_capability_requirements() {
        let mut cap_buffer = [0u8; 64];
        let package = package_with_capability(Version::new(1, 0, 0), &mut cap_buffer);
        let mut bytes = [0; 128];
        let length = package.encode(&mut bytes).unwrap();
        let decoded = ModulePackage::decode(&bytes[..length]).unwrap();
        assert_eq!(decoded.id, b"demo");

        let mut found = false;
        decoded
            .for_each_requirement(|req| {
                if req.id.as_bytes() == b"sys:dummy" {
                    found = true;
                    assert_eq!(req.min_version, CapabilityVersion::new(1, 0));
                }
                Ok(())
            })
            .unwrap();
        assert!(found);
    }

    #[test]
    fn rejects_install_when_capability_missing() {
        let mut registry: ModuleRegistry<u32, 4> = ModuleRegistry::new();
        let mut loader = Loader;
        struct EmptyRegistry;
        impl CapabilityRegistry for EmptyRegistry {
            fn invoke(&mut self, _: CapabilityId, _: &[u8], _: &mut [u8]) -> Result<usize, Error> {
                Err(Error::CapabilityNotFound)
            }
            fn has(&self, _: CapabilityId, _: CapabilityVersion) -> bool {
                false
            }
        }
        let mut cap_buffer = [0u8; 64];
        let package = package_with_capability(Version::new(1, 0, 0), &mut cap_buffer);
        let result = registry.install(&package, &mut loader, &EmptyRegistry);
        assert_eq!(result, Err(ModuleError::CapabilityNotSatisfied));
    }

    #[test]
    fn decodes_legacy_v1_package() {
        // Manually craft a v1 package.
        let mut bytes = [0u8; 64];
        bytes[..4].copy_from_slice(b"VPK1");
        bytes[4] = 1; // ABI v1
        bytes[5] = VibeMode::Ui as u8;
        bytes[6] = ModuleFormat::NativeBinary as u8;
        bytes[7] = ModuleTarget::X86_64Uefi as u8;
        bytes[8..10].copy_from_slice(&1u16.to_le_bytes());
        bytes[10..12].copy_from_slice(&0u16.to_le_bytes());
        bytes[12..14].copy_from_slice(&0u16.to_le_bytes());
        bytes[14] = b"legacy".len() as u8;
        let payload = b"payload";
        bytes[15..19].copy_from_slice(&(payload.len() as u32).to_le_bytes());
        let mut offset = 19;
        bytes[offset..offset + b"legacy".len()].copy_from_slice(b"legacy");
        offset += b"legacy".len();
        bytes[offset..offset + payload.len()].copy_from_slice(payload);
        offset += payload.len();

        let decoded = ModulePackage::decode(&bytes[..offset]).unwrap();
        assert_eq!(decoded.id, b"legacy");
        assert_eq!(decoded.payload, payload);
        assert!(decoded.capabilities.is_empty());
    }
}

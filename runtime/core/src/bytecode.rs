use crate::Error;
use crate::capability::{CapabilityId, CapabilityRegistry};
use crate::module::{ModuleError, ModuleLoader, ModulePackage};

const STACK_SIZE: usize = 16;
const MEMORY_SIZE: usize = 256;

#[repr(u8)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Op {
    Halt = 0x00,
    PushImm8 = 0x01,
    PushImm32 = 0x02,
    Pop = 0x03,
    Add = 0x04,
    WriteMem = 0x05,
    Log = 0x06,
    StoreGet = 0x07,
    StoreSet = 0x08,
    TimeMs = 0x09,
    Return = 0x0a,
}

impl Op {
    fn decode(value: u8) -> Option<Self> {
        match value {
            0x00 => Some(Self::Halt),
            0x01 => Some(Self::PushImm8),
            0x02 => Some(Self::PushImm32),
            0x03 => Some(Self::Pop),
            0x04 => Some(Self::Add),
            0x05 => Some(Self::WriteMem),
            0x06 => Some(Self::Log),
            0x07 => Some(Self::StoreGet),
            0x08 => Some(Self::StoreSet),
            0x09 => Some(Self::TimeMs),
            0x0a => Some(Self::Return),
            _ => None,
        }
    }
}

struct Vm {
    memory: [u8; MEMORY_SIZE],
    stack: [u32; STACK_SIZE],
    sp: usize,
}

impl Vm {
    const fn new() -> Self {
        Self {
            memory: [0; MEMORY_SIZE],
            stack: [0; STACK_SIZE],
            sp: 0,
        }
    }

    fn push(&mut self, value: u32) -> Result<(), Error> {
        if self.sp >= STACK_SIZE {
            return Err(Error::BufferTooSmall);
        }
        self.stack[self.sp] = value;
        self.sp += 1;
        Ok(())
    }

    fn pop(&mut self) -> Result<u32, Error> {
        if self.sp == 0 {
            return Err(Error::InvalidPacket);
        }
        self.sp -= 1;
        Ok(self.stack[self.sp])
    }

    fn run(
        &mut self,
        code: &[u8],
        output: &mut [u8],
        capabilities: &mut dyn CapabilityRegistry,
    ) -> Result<usize, Error> {
        let mut pc = 0usize;
        loop {
            let op = code.get(pc).copied().ok_or(Error::InvalidPacket)?;
            let op = Op::decode(op).ok_or(Error::UnsupportedOperation)?;
            pc += 1;

            match op {
                Op::Halt => return Ok(0),
                Op::PushImm8 => {
                    let value = code.get(pc).copied().ok_or(Error::InvalidPacket)? as u32;
                    pc += 1;
                    self.push(value)?;
                }
                Op::PushImm32 => {
                    if pc + 4 > code.len() {
                        return Err(Error::InvalidPacket);
                    }
                    let value =
                        u32::from_le_bytes([code[pc], code[pc + 1], code[pc + 2], code[pc + 3]]);
                    pc += 4;
                    self.push(value)?;
                }
                Op::Pop => {
                    self.pop()?;
                }
                Op::Add => {
                    let a = self.pop()?;
                    let b = self.pop()?;
                    self.push(a.wrapping_add(b))?;
                }
                Op::WriteMem => {
                    let addr = code.get(pc).copied().ok_or(Error::InvalidPacket)? as usize;
                    pc += 1;
                    let len = code.get(pc).copied().ok_or(Error::InvalidPacket)? as usize;
                    pc += 1;
                    if pc + len > code.len() || addr + len > MEMORY_SIZE {
                        return Err(Error::InvalidPacket);
                    }
                    self.memory[addr..addr + len].copy_from_slice(&code[pc..pc + len]);
                    pc += len;
                }
                Op::Log => {
                    let addr = self.pop()? as usize;
                    let len = self.pop()? as usize;
                    if addr + len > MEMORY_SIZE {
                        return Err(Error::InvalidPacket);
                    }
                    capabilities.invoke(
                        CapabilityId::from_str("sys:log").unwrap(),
                        &self.memory[addr..addr + len],
                        &mut [],
                    )?;
                }
                Op::StoreGet => {
                    let key_addr = self.pop()? as usize;
                    let key_len = self.pop()? as usize;
                    let out_addr = self.pop()? as usize;
                    let out_cap = self.pop()? as usize;
                    if key_addr + key_len > MEMORY_SIZE || out_addr + out_cap > MEMORY_SIZE {
                        return Err(Error::InvalidPacket);
                    }
                    let mut request = [0u8; 80];
                    request[..4].copy_from_slice(b"GET ");
                    request[4..4 + key_len]
                        .copy_from_slice(&self.memory[key_addr..key_addr + key_len]);
                    let mut temp = [0u8; 64];
                    let written = capabilities.invoke(
                        CapabilityId::from_str("sys:store").unwrap(),
                        &request[..4 + key_len],
                        &mut temp,
                    )?;
                    let written = written.min(out_cap);
                    self.memory[out_addr..out_addr + written].copy_from_slice(&temp[..written]);
                    self.push(written as u32)?;
                }
                Op::StoreSet => {
                    let key_addr = self.pop()? as usize;
                    let key_len = self.pop()? as usize;
                    let value_addr = self.pop()? as usize;
                    let value_len = self.pop()? as usize;
                    if key_addr + key_len > MEMORY_SIZE || value_addr + value_len > MEMORY_SIZE {
                        return Err(Error::InvalidPacket);
                    }
                    let mut request = [0u8; 160];
                    request[..4].copy_from_slice(b"PUT ");
                    request[4..4 + key_len]
                        .copy_from_slice(&self.memory[key_addr..key_addr + key_len]);
                    request[4 + key_len] = b'\n';
                    request[5 + key_len..5 + key_len + value_len]
                        .copy_from_slice(&self.memory[value_addr..value_addr + value_len]);
                    let req_len = 5 + key_len + value_len;
                    capabilities.invoke(
                        CapabilityId::from_str("sys:store").unwrap(),
                        &request[..req_len],
                        &mut [],
                    )?;
                }
                Op::TimeMs => {
                    let mut temp = [0u8; 32];
                    let written = capabilities.invoke(
                        CapabilityId::from_str("sys:time").unwrap(),
                        &[],
                        &mut temp,
                    )?;
                    let text =
                        core::str::from_utf8(&temp[..written.min(temp.len())]).unwrap_or("0");
                    let value: u32 = text.parse().unwrap_or(0);
                    self.push(value)?;
                }
                Op::Return => {
                    let addr = self.pop()? as usize;
                    let len = self.pop()? as usize;
                    if addr + len > MEMORY_SIZE {
                        return Err(Error::InvalidPacket);
                    }
                    let len = len.min(output.len());
                    output[..len].copy_from_slice(&self.memory[addr..addr + len]);
                    return Ok(len);
                }
            }
        }
    }
}

/// Loader for Vibe Bytecode modules.
pub struct BytecodeLoader;

impl BytecodeLoader {
    pub const fn new() -> Self {
        Self
    }
}

impl ModuleLoader for BytecodeLoader {
    type Handle = ();

    fn load(&mut self, _package: &ModulePackage<'_>) -> Result<Self::Handle, ModuleError> {
        Ok(())
    }

    fn unload(&mut self, _handle: Self::Handle) -> Result<(), ModuleError> {
        Ok(())
    }

    fn invoke(
        &mut self,
        _handle: Self::Handle,
        input: &[u8],
        output: &mut [u8],
        capabilities: &mut dyn CapabilityRegistry,
    ) -> Result<usize, ModuleError> {
        let mut vm = Vm::new();
        // The input is the bytecode program itself.
        vm.run(input, output, capabilities)
            .map_err(|_| ModuleError::InvokeFailed)
    }
}

/// Write a simple bytecode program into `output` that writes `message` to
/// memory, logs it, and returns it. Returns the length of the generated program.
pub fn encode_log_program(message: &str, output: &mut [u8]) -> Result<usize, Error> {
    let message = message.as_bytes();
    let total = 3 + message.len() + 6;
    if output.len() < total || message.len() > u8::MAX as usize {
        return Err(Error::BufferTooSmall);
    }
    let mut offset = 0;
    output[offset] = Op::WriteMem as u8;
    offset += 1;
    output[offset] = 16;
    offset += 1;
    output[offset] = message.len() as u8;
    offset += 1;
    output[offset..offset + message.len()].copy_from_slice(message);
    offset += message.len();

    // Log: pop len, then addr.
    output[offset] = Op::PushImm8 as u8;
    offset += 1;
    output[offset] = message.len() as u8;
    offset += 1;
    output[offset] = Op::PushImm8 as u8;
    offset += 1;
    output[offset] = 16;
    offset += 1;
    output[offset] = Op::Log as u8;
    offset += 1;

    // Return: pop addr, then len, copy memory to output.
    output[offset] = Op::PushImm8 as u8;
    offset += 1;
    output[offset] = message.len() as u8;
    offset += 1;
    output[offset] = Op::PushImm8 as u8;
    offset += 1;
    output[offset] = 16;
    offset += 1;
    output[offset] = Op::Return as u8;
    offset += 1;

    Ok(offset)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::VibeMode;
    use crate::capability::{Capability, CapabilityId, CapabilityRegistry, CapabilityVersion};
    use crate::module::{ModuleFormat, ModulePackage, ModuleTarget, Version};

    struct LogCapture {
        last: [u8; 64],
        len: usize,
    }

    impl Capability for LogCapture {
        fn id(&self) -> CapabilityId {
            CapabilityId::from_str("sys:log").unwrap()
        }

        fn version(&self) -> CapabilityVersion {
            CapabilityVersion::new(1, 0)
        }

        fn invoke(&mut self, input: &[u8], _output: &mut [u8]) -> Result<usize, Error> {
            let len = input.len().min(self.last.len());
            self.last[..len].copy_from_slice(&input[..len]);
            self.len = len;
            Ok(0)
        }
    }

    struct TestRegistry {
        log: LogCapture,
    }

    impl CapabilityRegistry for TestRegistry {
        fn invoke(
            &mut self,
            id: CapabilityId,
            input: &[u8],
            output: &mut [u8],
        ) -> Result<usize, Error> {
            if id == self.log.id() {
                self.log.invoke(input, output)
            } else {
                Err(Error::CapabilityNotFound)
            }
        }

        fn has(&self, id: CapabilityId, min_version: CapabilityVersion) -> bool {
            id == self.log.id() && self.log.version() >= min_version
        }
    }

    #[test]
    fn bytecode_logs_message_and_returns_it() {
        let mut code = [0u8; 128];
        let len = encode_log_program("hello bytecode", &mut code).unwrap();

        let mut registry = TestRegistry {
            log: LogCapture {
                last: [0; 64],
                len: 0,
            },
        };
        let mut loader = BytecodeLoader::new();
        let package = ModulePackage {
            id: b"test",
            version: Version::new(1, 0, 0),
            mode: VibeMode::Cli,
            format: ModuleFormat::VibeBytecode,
            target: ModuleTarget::Portable,
            capabilities: &[],
            payload: &[],
        };
        let handle = loader.load(&package).unwrap();

        let mut output = [0u8; 64];
        let out_len = loader
            .invoke(handle, &code[..len], &mut output, &mut registry)
            .unwrap();

        assert_eq!(&output[..out_len], b"hello bytecode");
        assert_eq!(&registry.log.last[..registry.log.len], b"hello bytecode");
    }
}

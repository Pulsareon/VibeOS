#![no_std]

pub mod module;

pub const PROTOCOL_VERSION: u8 = 1;
pub const OP_VIBE_CLI: u8 = 0x01;
pub const OP_VIBE_UI: u8 = 0x02;
pub const OP_VIBE_FIX: u8 = 0x03;
pub const OP_OK: u8 = 0x80;
pub const OP_ERROR: u8 = 0xff;

#[repr(u8)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum VibeMode {
    Cli = OP_VIBE_CLI,
    Ui = OP_VIBE_UI,
    Fix = OP_VIBE_FIX,
}

impl VibeMode {
    pub const fn from_operation(operation: u8) -> Option<Self> {
        match operation {
            OP_VIBE_CLI => Some(Self::Cli),
            OP_VIBE_UI => Some(Self::Ui),
            OP_VIBE_FIX => Some(Self::Fix),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Error {
    BufferTooSmall,
    InvalidPacket,
    UnsupportedVersion,
    UnsupportedOperation,
    NotFound,
    Ai,
    Storage,
    Transport,
}

pub trait Vibe {
    fn create(&mut self, mode: VibeMode, intent: &[u8], output: &mut [u8]) -> Result<usize, Error>;
}

pub trait CapabilityStore {
    fn load(&mut self, mode: VibeMode, intent: &[u8], output: &mut [u8]) -> Result<usize, Error>;

    fn save(&mut self, mode: VibeMode, intent: &[u8], capability: &[u8]) -> Result<(), Error>;
}

pub trait Transport {
    fn receive(&mut self, buffer: &mut [u8]) -> Result<usize, Error>;
    fn send(&mut self, data: &[u8]) -> Result<(), Error>;
}

pub struct Packet<'a> {
    pub mode: VibeMode,
    pub intent: &'a [u8],
}

impl<'a> Packet<'a> {
    pub fn decode(data: &'a [u8]) -> Result<Self, Error> {
        if data.len() < 4 {
            return Err(Error::InvalidPacket);
        }
        if data[0] != PROTOCOL_VERSION {
            return Err(Error::UnsupportedVersion);
        }

        let mode = VibeMode::from_operation(data[1]).ok_or(Error::UnsupportedOperation)?;
        let intent_len = u16::from_le_bytes([data[2], data[3]]) as usize;
        if intent_len + 4 != data.len() {
            return Err(Error::InvalidPacket);
        }
        Ok(Self {
            mode,
            intent: &data[4..],
        })
    }
}

pub struct Runtime<V, S, T, const BUFFER: usize> {
    vibe: V,
    store: S,
    transport: T,
    rx: [u8; BUFFER],
    tx: [u8; BUFFER],
}

impl<V, S, T, const BUFFER: usize> Runtime<V, S, T, BUFFER>
where
    V: Vibe,
    S: CapabilityStore,
    T: Transport,
{
    pub const fn new(vibe: V, store: S, transport: T) -> Self {
        Self {
            vibe,
            store,
            transport,
            rx: [0; BUFFER],
            tx: [0; BUFFER],
        }
    }

    pub fn step(&mut self) -> Result<(), Error> {
        let received = self.transport.receive(&mut self.rx)?;
        let packet = Packet::decode(&self.rx[..received])?;

        let payload_len = match self.store.load(packet.mode, packet.intent, &mut self.tx) {
            Ok(length) => length,
            Err(Error::NotFound) => {
                let length = self
                    .vibe
                    .create(packet.mode, packet.intent, &mut self.tx)
                    .map_err(|_| Error::Ai)?;
                self.store
                    .save(packet.mode, packet.intent, &self.tx[..length])
                    .map_err(|_| Error::Storage)?;
                length
            }
            Err(_) => return self.send_error(Error::Storage),
        };

        self.send_response(OP_OK, payload_len)
    }

    pub fn into_parts(self) -> (V, S, T) {
        (self.vibe, self.store, self.transport)
    }

    fn send_response(&mut self, operation: u8, payload_len: usize) -> Result<(), Error> {
        if payload_len > u16::MAX as usize || payload_len + 4 > BUFFER {
            return Err(Error::BufferTooSmall);
        }
        self.tx.copy_within(0..payload_len, 4);
        self.tx[0] = PROTOCOL_VERSION;
        self.tx[1] = operation;
        self.tx[2..4].copy_from_slice(&(payload_len as u16).to_le_bytes());
        self.transport
            .send(&self.tx[..payload_len + 4])
            .map_err(|_| Error::Transport)
    }

    fn send_error(&mut self, error: Error) -> Result<(), Error> {
        self.tx[0] = error as u8;
        self.send_response(OP_ERROR, 1)
    }
}

#[cfg(test)]
extern crate std;

#[cfg(test)]
mod tests {
    use super::*;
    use std::vec;
    use std::vec::Vec;

    struct TestVibe;

    impl Vibe for TestVibe {
        fn create(
            &mut self,
            mode: VibeMode,
            intent: &[u8],
            output: &mut [u8],
        ) -> Result<usize, Error> {
            output[0] = mode as u8;
            output[1..intent.len() + 1].copy_from_slice(intent);
            Ok(intent.len() + 1)
        }
    }

    struct EmptyStore;

    impl CapabilityStore for EmptyStore {
        fn load(&mut self, _: VibeMode, _: &[u8], _: &mut [u8]) -> Result<usize, Error> {
            Err(Error::NotFound)
        }

        fn save(&mut self, _: VibeMode, _: &[u8], _: &[u8]) -> Result<(), Error> {
            Ok(())
        }
    }

    struct TestTransport {
        input: Vec<u8>,
        output: Vec<u8>,
    }

    impl Transport for TestTransport {
        fn receive(&mut self, buffer: &mut [u8]) -> Result<usize, Error> {
            buffer[..self.input.len()].copy_from_slice(&self.input);
            Ok(self.input.len())
        }

        fn send(&mut self, data: &[u8]) -> Result<(), Error> {
            self.output.extend_from_slice(data);
            Ok(())
        }
    }

    fn packet(operation: u8, intent: &[u8]) -> Vec<u8> {
        let mut packet = vec![
            PROTOCOL_VERSION,
            operation,
            intent.len() as u8,
            (intent.len() >> 8) as u8,
        ];
        packet.extend_from_slice(intent);
        packet
    }

    #[test]
    fn creates_and_returns_a_cli_capability() {
        let transport = TestTransport {
            input: packet(OP_VIBE_CLI, b"blink"),
            output: Vec::new(),
        };
        let mut runtime: Runtime<_, _, _, 64> = Runtime::new(TestVibe, EmptyStore, transport);
        runtime.step().unwrap();
        let (_, _, transport) = runtime.into_parts();
        assert_eq!(&transport.output[5..], b"blink");
    }
}

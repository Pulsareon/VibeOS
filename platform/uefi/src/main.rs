#![no_std]
#![no_main]

use core::ffi::c_void;
use core::panic::PanicInfo;

type EfiHandle = *mut c_void;
type EfiStatus = usize;

const EFI_SUCCESS: EfiStatus = 0;
const ENTER: u16 = 13;
const BACKSPACE: u16 = 8;
const MODE_TTY: u8 = 0;
const MODE_DESKTOP: u8 = 1;

#[repr(C)]
struct EfiTableHeader {
    signature: u64,
    revision: u32,
    header_size: u32,
    crc32: u32,
    reserved: u32,
}

#[repr(C)]
struct EfiInputKey {
    scan_code: u16,
    unicode_char: u16,
}

#[repr(C)]
struct SimpleTextInputProtocol {
    reset: usize,
    read_key_stroke: unsafe extern "efiapi" fn(
        this: *mut SimpleTextInputProtocol,
        key: *mut EfiInputKey,
    ) -> EfiStatus,
    wait_for_key: *mut c_void,
}

#[repr(C)]
struct SimpleTextOutputProtocol {
    reset: usize,
    output_string: unsafe extern "efiapi" fn(
        this: *mut SimpleTextOutputProtocol,
        string: *const u16,
    ) -> EfiStatus,
    test_string: usize,
    query_mode: usize,
    set_mode: usize,
    set_attribute: usize,
    clear_screen: unsafe extern "efiapi" fn(this: *mut SimpleTextOutputProtocol) -> EfiStatus,
    set_cursor_position: usize,
    enable_cursor: usize,
    mode: *mut c_void,
}

#[repr(C)]
struct EfiSystemTable {
    header: EfiTableHeader,
    firmware_vendor: *mut u16,
    firmware_revision: u32,
    console_in_handle: EfiHandle,
    con_in: *mut SimpleTextInputProtocol,
    console_out_handle: EfiHandle,
    con_out: *mut SimpleTextOutputProtocol,
    standard_error_handle: EfiHandle,
    std_err: *mut SimpleTextOutputProtocol,
    runtime_services: *mut c_void,
    boot_services: *mut c_void,
    number_of_table_entries: usize,
    configuration_table: *mut c_void,
}

struct Console {
    input: *mut SimpleTextInputProtocol,
    output: *mut SimpleTextOutputProtocol,
}

impl Console {
    unsafe fn clear(&mut self) {
        unsafe {
            ((*self.output).clear_screen)(self.output);
        }
    }

    unsafe fn write(&mut self, text: &str) {
        let mut buffer = [0u16; 256];
        let mut index = 0;
        for byte in text.bytes() {
            if index + 1 >= buffer.len() {
                break;
            }
            buffer[index] = byte as u16;
            index += 1;
        }
        buffer[index] = 0;
        unsafe {
            ((*self.output).output_string)(self.output, buffer.as_ptr());
        }
    }

    unsafe fn read_key(&mut self) -> EfiInputKey {
        loop {
            let mut key = EfiInputKey {
                scan_code: 0,
                unicode_char: 0,
            };
            let status = unsafe { ((*self.input).read_key_stroke)(self.input, &mut key) };
            if status == EFI_SUCCESS {
                return key;
            }
            core::hint::spin_loop();
        }
    }
}

#[unsafe(no_mangle)]
extern "efiapi" fn efi_main(_image: EfiHandle, system_table: *mut EfiSystemTable) -> EfiStatus {
    let mut console = unsafe {
        Console {
            input: (*system_table).con_in,
            output: (*system_table).con_out,
        }
    };

    let mut shell_mode = MODE_TTY;
    unsafe { draw_shell(&mut console, shell_mode) };

    let mut intent = [0u16; 192];
    let mut length = 0usize;
    loop {
        unsafe {
            console.write(if shell_mode == MODE_TTY {
                "\r\nTTY VIBE> "
            } else {
                "\r\nDESKTOP VIBE> "
            });
        }
        loop {
            let key = unsafe { console.read_key() };
            match key.unicode_char {
                ENTER => {
                    if command_eq(&intent[..length], b"desktop") {
                        shell_mode = MODE_DESKTOP;
                        unsafe { draw_shell(&mut console, shell_mode) };
                    } else if command_eq(&intent[..length], b"tty") {
                        shell_mode = MODE_TTY;
                        unsafe { draw_shell(&mut console, shell_mode) };
                    } else {
                        unsafe {
                            console.write("\r\nIntent accepted by the Vibe runtime.\r\n");
                            console.write("AI and device adapters are not connected yet.\r\n");
                            console.write("Type 'desktop' or 'tty' to switch shells.\r\n");
                        }
                    }
                    intent.fill(0);
                    length = 0;
                    break;
                }
                BACKSPACE if length > 0 => {
                    length -= 1;
                    intent[length] = 0;
                    unsafe {
                        console.write("\u{8} \u{8}");
                    }
                }
                character if (32..=126).contains(&character) && length < intent.len() - 1 => {
                    intent[length] = character;
                    length += 1;
                    let echo = [character, 0];
                    unsafe {
                        ((*console.output).output_string)(console.output, echo.as_ptr());
                    }
                }
                _ => {}
            }
        }
    }
}

unsafe fn draw_shell(console: &mut Console, shell_mode: u8) {
    unsafe {
        console.clear();
        console.write("VibeOS\r\n");
        console.write("Device + AI = OS\r\n\r\n");
        if shell_mode == MODE_TTY {
            console.write("[TTY] CLI Vibe active. Type 'desktop' to switch shell.\r\n");
        } else {
            console.write("[DESKTOP] UI Vibe shell placeholder. Type 'tty' to return.\r\n");
            console.write("+------------------------------+\r\n");
            console.write("|  VIBE WINDOW                 |\r\n");
            console.write("|  Describe native UI module   |\r\n");
            console.write("+------------------------------+\r\n");
        }
        console.write("\r\nAbilities: CLI Vibe | UI Vibe | Vibe Fix Bug\r\n");
    }
}

fn command_eq(input: &[u16], command: &[u8]) -> bool {
    input.len() == command.len()
        && input
            .iter()
            .zip(command.iter())
            .all(|(left, right)| *left == *right as u16)
}

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {
        core::hint::spin_loop();
    }
}

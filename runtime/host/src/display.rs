use std::sync::{Arc, Mutex};
use std::time::Duration;

use minifb::{Key, Window, WindowOptions};
use vibeos_core::c_abi::InputEvent;

const WIDTH: usize = 800;
const HEIGHT: usize = 600;

#[derive(Debug)]
pub struct DisplayState {
    pub width: u32,
    pub height: u32,
    pub front_buffer: Vec<u32>,
    pub events: Vec<InputEvent>,
}

impl DisplayState {
    fn new() -> Self {
        Self {
            width: WIDTH as u32,
            height: HEIGHT as u32,
            front_buffer: vec![0xFF000000; WIDTH * HEIGHT],
            events: Vec::new(),
        }
    }
}

static DISPLAY: std::sync::OnceLock<Arc<Mutex<DisplayState>>> = std::sync::OnceLock::new();

fn display() -> &'static Arc<Mutex<DisplayState>> {
    DISPLAY.get_or_init(|| Arc::new(Mutex::new(DisplayState::new())))
}

pub fn start_display_thread() {
    std::thread::spawn(|| {
        let mut window = match Window::new(
            "VibeOS",
            WIDTH,
            HEIGHT,
            WindowOptions {
                resize: false,
                scale: minifb::Scale::FitScreen,
                ..WindowOptions::default()
            },
        ) {
            Ok(w) => w,
            Err(error) => {
                eprintln!("[vibeos-display] failed to create window: {error}");
                return;
            }
        };

        loop {
            let buffer = {
                let state = display().lock().unwrap();
                state.front_buffer.clone()
            };

            if window.is_open() && !window.is_key_down(Key::Escape) {
                if let Err(error) = window.update_with_buffer(&buffer, WIDTH, HEIGHT) {
                    eprintln!("[vibeos-display] update failed: {error}");
                    break;
                }
            } else {
                break;
            }

            // Collect input events.
            {
                let mut state = display().lock().unwrap();
                state.events.clear();
                // Mouse position.
                if let Some((x, y)) = window.get_mouse_pos(minifb::MouseMode::Clamp) {
                    state.events.push(InputEvent {
                        kind: InputEvent::MOUSE_MOVE,
                        x: x as i32,
                        y: y as i32,
                        code: 0,
                    });
                }
                // Mouse buttons.
                window.get_mouse_down(minifb::MouseButton::Left).then(|| {
                    state.events.push(InputEvent {
                        kind: InputEvent::MOUSE_DOWN,
                        x: 0,
                        y: 0,
                        code: 0,
                    });
                });
                window.get_mouse_down(minifb::MouseButton::Right).then(|| {
                    state.events.push(InputEvent {
                        kind: InputEvent::MOUSE_DOWN,
                        x: 0,
                        y: 0,
                        code: 1,
                    });
                });
                // Keyboard.
                for key in [
                    Key::A,
                    Key::B,
                    Key::C,
                    Key::D,
                    Key::E,
                    Key::F,
                    Key::G,
                    Key::H,
                    Key::I,
                    Key::J,
                    Key::K,
                    Key::L,
                    Key::M,
                    Key::N,
                    Key::O,
                    Key::P,
                    Key::Q,
                    Key::R,
                    Key::S,
                    Key::T,
                    Key::U,
                    Key::V,
                    Key::W,
                    Key::X,
                    Key::Y,
                    Key::Z,
                    Key::Space,
                    Key::Enter,
                    Key::Escape,
                ] {
                    if window.is_key_down(key) {
                        state.events.push(InputEvent {
                            kind: InputEvent::KEY_DOWN,
                            x: 0,
                            y: 0,
                            code: key as u32,
                        });
                    }
                }
            }

            std::thread::sleep(Duration::from_millis(16));
        }
    });
}

pub fn present(width: u32, height: u32, pixels: *const u8) -> i32 {
    if width != WIDTH as u32 || height != HEIGHT as u32 {
        return -1;
    }
    let expected = (width * height * 4) as usize;
    let src = unsafe { std::slice::from_raw_parts(pixels, expected) };
    let mut state = display().lock().unwrap();
    for (i, chunk) in src.chunks_exact(4).enumerate() {
        let r = chunk[0] as u32;
        let g = chunk[1] as u32;
        let b = chunk[2] as u32;
        let a = chunk[3] as u32;
        state.front_buffer[i] = (a << 24) | (r << 16) | (g << 8) | b;
    }
    0
}

pub fn get_info(width: *mut u32, height: *mut u32) -> i32 {
    let state = display().lock().unwrap();
    unsafe {
        *width = state.width;
        *height = state.height;
    }
    0
}

pub fn poll(event: *mut InputEvent) -> i32 {
    let mut state = display().lock().unwrap();
    if let Some(ev) = state.events.pop() {
        unsafe { *event = ev };
        1
    } else {
        unsafe { *event = InputEvent::default() };
        0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_info_is_non_zero() {
        let mut width = 0u32;
        let mut height = 0u32;
        get_info(&mut width, &mut height);
        assert_eq!(width, WIDTH as u32);
        assert_eq!(height, HEIGHT as u32);
    }
}

use minifb::{Key, Window, WindowOptions};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;

use vibeos_core::c_abi::InputEvent;

const DEFAULT_WIDTH: usize = 800;
const DEFAULT_HEIGHT: usize = 600;

static DISPLAY_STATE: Mutex<Option<DisplayState>> = Mutex::new(None);

struct DisplayState {
    width: u32,
    height: u32,
    tx: Sender<DisplayCommand>,
    events: Arc<Mutex<Vec<InputEvent>>>,
}

enum DisplayCommand {
    Present { width: u32, height: u32, buffer: Vec<u8> },
}

pub fn start_display_thread() {
    let mut state = DISPLAY_STATE.lock().unwrap();
    if state.is_some() {
        return;
    }

    let (tx, rx): (Sender<DisplayCommand>, Receiver<DisplayCommand>) = channel();
    let events: Arc<Mutex<Vec<InputEvent>>> = Arc::new(Mutex::new(Vec::new()));
    let events_clone = Arc::clone(&events);

    thread::spawn(move || display_worker(DEFAULT_WIDTH, DEFAULT_HEIGHT, rx, events_clone));

    *state = Some(DisplayState {
        width: DEFAULT_WIDTH as u32,
        height: DEFAULT_HEIGHT as u32,
        tx,
        events,
    });
}

fn display_worker(
    width: usize,
    height: usize,
    rx: Receiver<DisplayCommand>,
    events: Arc<Mutex<Vec<InputEvent>>>,
) {
    let mut window = match Window::new(
        "VibeOS",
        width,
        height,
        WindowOptions {
            resize: true,
            ..WindowOptions::default()
        },
    ) {
        Ok(w) => w,
        Err(error) => {
            eprintln!("[VibeOS display] failed to create window: {error}");
            return;
        }
    };

    #[allow(deprecated)]
    window.limit_update_rate(Some(std::time::Duration::from_millis(16)));

    let mut frame: Vec<u32> = vec![0; width * height];
    let mut current_width = width;
    let mut current_height = height;

    while window.is_open() && !window.is_key_down(Key::Escape) {
        while let Ok(command) = rx.try_recv() {
            match command {
                DisplayCommand::Present { width, height, buffer } => {
                    if (width as usize * height as usize) != buffer.len() / 4 {
                        continue;
                    }
                    current_width = width as usize;
                    current_height = height as usize;
                    if frame.len() != current_width * current_height {
                        frame.resize(current_width * current_height, 0);
                    }
                    for (i, pixel) in buffer.chunks_exact(4).enumerate() {
                        let r = pixel[0] as u32;
                        let g = pixel[1] as u32;
                        let b = pixel[2] as u32;
                        frame[i] = (r << 16) | (g << 8) | b;
                    }
                }
            }
        }

        collect_events(&window, &mut events.lock().unwrap());

        let (w, h) = window.get_size();
        if w != current_width || h != current_height {
            current_width = w;
            current_height = h;
            frame.resize(current_width * current_height, 0);
        }

        if let Err(error) = window.update_with_buffer(&frame, current_width, current_height) {
            eprintln!("[VibeOS display] update failed: {error}");
            break;
        }
    }
}

fn collect_events(window: &Window, buffer: &mut Vec<InputEvent>) {
    for key in window.get_keys() {
        let code = key_to_code(key);
        buffer.push(InputEvent {
            kind: 1,
            code,
            x: 0,
            y: 0,
        });
    }

    if let Some((x, y)) = window.get_mouse_pos(minifb::MouseMode::Discard) {
        let mouse_down = window.get_mouse_down(minifb::MouseButton::Left);
        buffer.push(InputEvent {
            kind: if mouse_down { 3 } else { 2 },
            code: 0,
            x: x as i32,
            y: y as i32,
        });
    }
}

fn key_to_code(key: Key) -> u32 {
    match key {
        Key::A => 65,
        Key::B => 66,
        Key::C => 67,
        Key::D => 68,
        Key::E => 69,
        Key::F => 70,
        Key::G => 71,
        Key::H => 72,
        Key::I => 73,
        Key::J => 74,
        Key::K => 75,
        Key::L => 76,
        Key::M => 77,
        Key::N => 78,
        Key::O => 79,
        Key::P => 80,
        Key::Q => 81,
        Key::R => 82,
        Key::S => 83,
        Key::T => 84,
        Key::U => 85,
        Key::V => 86,
        Key::W => 87,
        Key::X => 88,
        Key::Y => 89,
        Key::Z => 90,
        Key::Enter => 13,
        Key::Space => 32,
        Key::Escape => 27,
        Key::Backspace => 8,
        Key::Up => 38,
        Key::Down => 40,
        Key::Left => 37,
        Key::Right => 39,
        _ => 0,
    }
}

pub fn get_info(width: &mut u32, height: &mut u32) {
    let state = DISPLAY_STATE.lock().unwrap();
    if let Some(display) = state.as_ref() {
        *width = display.width;
        *height = display.height;
    } else {
        *width = DEFAULT_WIDTH as u32;
        *height = DEFAULT_HEIGHT as u32;
    }
}

pub fn present(width: u32, height: u32, pixels: *const u8) {
    let state = DISPLAY_STATE.lock().unwrap();
    let Some(display) = state.as_ref() else {
        return;
    };
    let size = (width as usize * height as usize * 4) as usize;
    let buffer = unsafe { std::slice::from_raw_parts(pixels, size) }.to_vec();
    let _ = display.tx.send(DisplayCommand::Present {
        width,
        height,
        buffer,
    });
}

pub fn poll(event: &mut InputEvent) -> i32 {
    let state = DISPLAY_STATE.lock().unwrap();
    let Some(display) = state.as_ref() else {
        *event = InputEvent::default();
        return 0;
    };
    let mut events = display.events.lock().unwrap();
    if events.is_empty() {
        *event = InputEvent::default();
        return 0;
    }
    *event = events.remove(0);
    events.len() as i32 + 1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_info_matches_window_size() {
        let mut width = 0u32;
        let mut height = 0u32;
        get_info(&mut width, &mut height);
        assert_eq!(width, DEFAULT_WIDTH as u32);
        assert_eq!(height, DEFAULT_HEIGHT as u32);
    }
}

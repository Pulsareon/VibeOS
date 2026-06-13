use vibeos_core::c_abi::{VibeAbi, VIBE_MODULE_OK, InputEvent};

#[unsafe(no_mangle)]
pub unsafe extern "C" fn vibe_module_main(abi: *const VibeAbi) -> i32 {
    let abi = unsafe { &*abi };
    
    let mut width: u32 = 0;
    let mut height: u32 = 0;
    (abi.display_get_info)(abi.context, &mut width as *mut u32, &mut height as *mut u32);
    
    let mut pixels: Vec<u8> = vec![0; (width * height * 4) as usize];
    
    for y in 0..height {
        for x in 0..width {
            let i = ((y * width + x) * 4) as usize;
            pixels[i] = 255;
            pixels[i+1] = 0;
            pixels[i+2] = 0;
            pixels[i+3] = 255;
        }
    }
    
    (abi.display_present)(abi.context, width, height, pixels.as_ptr());
    
    let mut event = InputEvent { kind: 0, x: 0, y: 0, code: 0 };
    for _ in 0..3 {
        (abi.input_poll)(abi.context, &mut event);
    }
    
    VIBE_MODULE_OK
}
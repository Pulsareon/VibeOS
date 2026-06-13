use std::ffi::c_void;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

use libloading::{Library, Symbol};
use vibeos_core::c_abi::{VIBE_MODULE_OK, VibeAbi, VibeModuleMain};
use vibeos_core::module::{ModuleError, ModuleLoader, ModulePackage};

/// Compiles Rust source into a `cdylib` and loads it.
pub struct NativeLoader {
    store_root: PathBuf,
    cache_dir: PathBuf,
    libraries: Vec<Library>,
    context: *mut c_void,
}

impl NativeLoader {
    pub fn new(store_root: PathBuf, cache_dir: PathBuf) -> Self {
        let _ = std::fs::create_dir_all(&store_root);
        let _ = std::fs::create_dir_all(&cache_dir);
        let context = Box::into_raw(Box::new(store_root.clone())) as *mut c_void;
        Self {
            store_root,
            cache_dir,
            libraries: Vec::new(),
            context,
        }
    }

    fn make_abi(&self) -> VibeAbi {
        crate::c_abi::host_abi_with_context(self.context, self.store_root.clone())
    }

    fn cached_path(
        &self,
        package: &ModulePackage<'_>,
    ) -> std::result::Result<PathBuf, ModuleError> {
        let id = std::str::from_utf8(package.id).map_err(|_| ModuleError::InvalidPackage)?;
        let file_name = format!(
            "{}-{}.{}.{}{}",
            id,
            package.version.major,
            package.version.minor,
            package.version.patch,
            std::env::consts::DLL_EXTENSION
        );
        Ok(self.cache_dir.join(file_name))
    }

    fn ensure_compiled(
        &self,
        package: &ModulePackage<'_>,
        destination: &Path,
    ) -> std::result::Result<(), ModuleError> {
        if destination.exists() {
            return Ok(());
        }

        let source =
            std::str::from_utf8(package.payload).map_err(|_| ModuleError::InvalidPackage)?;
        let source_path = self.cache_dir.join(format!(
            "{}_{}_{}_{}_src.rs",
            std::str::from_utf8(package.id).unwrap_or("module"),
            package.version.major,
            package.version.minor,
            package.version.patch,
        ));
        std::fs::write(&source_path, source).map_err(|_| ModuleError::LoadFailed)?;

        let vibeos_core_rlib = locate_vibeos_core_rlib().map_err(|_| ModuleError::LoadFailed)?;

        let output = Command::new("rustc")
            .arg(&source_path)
            .arg("--crate-type=cdylib")
            .arg("--edition=2024")
            .arg("-C")
            .arg("panic=abort")
            .arg(format!(
                "--extern=vibeos_core={}",
                vibeos_core_rlib.display()
            ))
            .arg("-o")
            .arg(destination)
            .output()
            .map_err(|_| ModuleError::LoadFailed)?;

        if !output.status.success() {
            eprintln!(
                "[vibeos-native] rustc failed:\n{}",
                String::from_utf8_lossy(&output.stderr)
            );
            return Err(ModuleError::LoadFailed);
        }
        Ok(())
    }
}

impl ModuleLoader for NativeLoader {
    type Handle = usize;

    fn load(
        &mut self,
        package: &ModulePackage<'_>,
    ) -> std::result::Result<Self::Handle, ModuleError> {
        let destination = self.cached_path(package)?;
        self.ensure_compiled(package, &destination)?;
        let library = unsafe {
            Library::new(&destination).map_err(|e| {
                eprintln!(
                    "[vibeos-native] failed to load {}: {}",
                    destination.display(),
                    e
                );
                ModuleError::LoadFailed
            })?
        };
        let index = self.libraries.len();
        self.libraries.push(library);
        Ok(index)
    }

    fn unload(&mut self, _handle: Self::Handle) -> std::result::Result<(), ModuleError> {
        // Leave the slot in place to keep indices stable.
        Ok(())
    }

    fn invoke(
        &mut self,
        handle: Self::Handle,
        _input: &[u8],
        output: &mut [u8],
        _capabilities: &mut dyn vibeos_core::capability::CapabilityRegistry,
    ) -> std::result::Result<usize, ModuleError> {
        let library = self
            .libraries
            .get(handle)
            .ok_or(ModuleError::InvokeFailed)?;
        let abi = self.make_abi();
        let result = unsafe {
            let main: Symbol<VibeModuleMain> = library
                .get(b"vibe_module_main\0")
                .map_err(|_| ModuleError::InvokeFailed)?;
            main(&abi)
        };

        let message = if result == VIBE_MODULE_OK {
            "native module executed successfully"
        } else {
            "native module returned an error"
        };
        let bytes = message.as_bytes();
        let len = bytes.len().min(output.len());
        output[..len].copy_from_slice(&bytes[..len]);
        Ok(len)
    }
}

impl Drop for NativeLoader {
    fn drop(&mut self) {
        if !self.context.is_null() {
            unsafe {
                let _ = Box::from_raw(self.context as *mut PathBuf);
            }
        }
    }
}

fn locate_vibeos_core_rlib() -> io::Result<PathBuf> {
    let target_dir = workspace_root()?.join("target").join("release");
    for entry in std::fs::read_dir(&target_dir)? {
        let entry = entry?;
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if name_str.starts_with("libvibeos_core") && name_str.ends_with(".rlib") {
            return Ok(entry.path());
        }
    }
    Err(io::Error::other(format!(
        "vibeos_core rlib not found in {}. Build with cargo build --release -p vibeos-core first.",
        target_dir.display()
    )))
}

fn workspace_root() -> io::Result<PathBuf> {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest
        .parent()
        .and_then(Path::parent)
        .map(Path::to_path_buf)
        .ok_or_else(|| io::Error::other("cannot locate workspace root"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use vibeos_core::VibeMode;
    use vibeos_core::module::{ModuleFormat, ModulePackage, ModuleTarget, Version};

    #[test]
    #[ignore = "requires rustc and vibeos_core rlib"]
    fn compiles_and_invokes_sample_native_module() {
        let source = r#"
use vibeos_core::c_abi::{VibeAbi, VIBE_MODULE_OK};

#[unsafe(no_mangle)]
pub unsafe extern "C" fn vibe_module_main(abi: *const VibeAbi) -> i32 {
    let abi = unsafe { &*abi };
    let msg = b"native hello\0";
    unsafe { (abi.log)(abi.context, msg.as_ptr(), msg.len() - 1) };
    VIBE_MODULE_OK
}
"#;

        let dir = std::env::temp_dir().join(format!(
            "vibeos-native-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let mut loader = NativeLoader::new(dir.join("store"), dir.join("cache"));
        let package = ModulePackage {
            id: b"native-demo",
            version: Version::new(1, 0, 0),
            mode: VibeMode::Cli,
            format: ModuleFormat::NativeBinary,
            target: ModuleTarget::Portable,
            capabilities: &[],
            payload: source.as_bytes(),
        };
        let handle = loader.load(&package).unwrap();
        let mut output = [0u8; 128];
        let len = loader
            .invoke(
                handle,
                b"",
                &mut output,
                &mut crate::capability::HostCapabilityRegistry::new(dir.join("store")),
            )
            .unwrap();
        assert!(
            std::str::from_utf8(&output[..len])
                .unwrap()
                .contains("successfully")
        );
    }
}

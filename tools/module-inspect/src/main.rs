use std::env;
use std::fs;
use std::io;
use std::path::PathBuf;
use vibeos_core::module::ModulePackage;

fn main() -> io::Result<()> {
    let path = env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .ok_or_else(|| io::Error::other("usage: vibeos-module-inspect <module.vpk>"))?;
    let bytes = fs::read(&path)?;
    let package = ModulePackage::decode(&bytes)
        .map_err(|error| io::Error::other(format!("invalid module package: {error:?}")))?;

    println!("path={}", path.display());
    println!("id={}", String::from_utf8_lossy(package.id));
    println!(
        "version={}.{}.{}",
        package.version.major, package.version.minor, package.version.patch
    );
    println!("mode={:?}", package.mode);
    println!("format={:?}", package.format);
    println!("target={:?}", package.target);
    println!("payload_bytes={}", package.payload.len());
    Ok(())
}

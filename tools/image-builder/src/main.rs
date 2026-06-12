use std::env;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

const UEFI_TARGET: &str = "x86_64-unknown-uefi";

fn main() -> io::Result<()> {
    let root = workspace_root()?;
    run(Command::new("cargo").current_dir(&root).args([
        "build",
        "--release",
        "-p",
        "vibeos-uefi",
        "--target",
        UEFI_TARGET,
    ]))?;

    let dist = root.join("dist");
    let boot = dist.join("EFI").join("BOOT");
    fs::create_dir_all(&boot)?;

    let source = root
        .join("target")
        .join(UEFI_TARGET)
        .join("release")
        .join("vibeos-uefi.efi");
    let destination = boot.join("BOOTX64.EFI");
    fs::copy(&source, &destination)?;

    println!("Standalone VibeOS UEFI tree created at {}", dist.display());
    println!("Copy dist/EFI to a FAT32 EFI System Partition to boot on a PC.");
    println!("QEMU can boot the directory as a virtual FAT drive.");
    Ok(())
}

fn workspace_root() -> io::Result<PathBuf> {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest
        .parent()
        .and_then(Path::parent)
        .map(Path::to_path_buf)
        .ok_or_else(|| io::Error::other("cannot locate workspace root"))
}

fn run(command: &mut Command) -> io::Result<()> {
    let status = command.status()?;
    if status.success() {
        Ok(())
    } else {
        Err(io::Error::other(format!("command failed with {status}")))
    }
}

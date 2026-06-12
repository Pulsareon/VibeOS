# VibeOS

> **Device + AI = OS**

VibeOS 是一个以 AI 为核心、完全模块化的 Rust 操作系统实验。

它的最终目标不是在 Linux 上运行一个桌面，也不是为传统系统增加 AI 助手。VibeOS 应由设备固件直接启动，系统核心、模块协议、设备适配和能力运行时都使用 Rust 实现。

系统只保留三个基本能力：

| 能力 | 作用 |
| --- | --- |
| **CLI Vibe** | 通过命令行创建命令、自动化和低资源设备能力 |
| **UI Vibe** | 根据意图生成或修改界面 |
| **Vibe 改 Bug** | 分析当前能力和错误，生成新版本并支持回滚 |

其他所有功能都应作为 Vibe Module 按需生成、动态加载并永久保存在本地，而不是成为预装系统组件。

## 设计边界

### Rust Only

- 系统核心只使用 Rust。
- 单片机核心使用 `#![no_std]`，不需要操作系统、堆分配或标准库。
- 电脑裸机目标使用 Rust UEFI 程序，由固件直接启动，不经过 Linux。
- 最终插件运行时和设备驱动使用 Rust 与稳定的 Vibe Module ABI。

网页宿主只使用声明式 HTML/CSS 展示输入和结果，所有请求处理、模式映射和系统逻辑均由 Rust Host 执行。仓库不再包含 JavaScript 或 Python 可执行逻辑。

### 足够小

当前构建结果参考：

- `vibeos-core`：`no_std`、固定缓冲区、无堆分配
- 独立 UEFI 启动目标：约 **2.5 KiB**
- 桌面/网页 Rust Host：约 **193 KiB**

同一核心可用于资源很小的单片机，也可以由完整设备宿主提供显示、存储、网络和本地 AI。

### 不依赖 Linux

`platform/uefi` 是独立裸机目标。它编译为 `BOOTX64.EFI`，可由 UEFI 电脑或虚拟机直接启动。

Linux、macOS、Windows、Android、iOS 和网页是兼容宿主或开发平台，不是 VibeOS 的底层。Linux 容器仅用于方便体验 Rust Host，不用于构建最终 VibeOS 系统镜像。

## 核心架构

```text
设备 / 固件
    |
Rust Device Adapter
    |
VibeOS no_std Core
    |
CLI Vibe | UI Vibe | Vibe Fix
    |
Vibe Module Registry
    |
本地版本 / 动态加载 / 回滚
```

### Vibe Module

所有生成能力都使用统一模块包：

```text
Magic: VPK1
ABI Version
Vibe Mode: CLI / UI / Fix
Module Format: Native Binary / Portable UI / WebAssembly / Vibe Bytecode
Module Target: Portable / UEFI / Bare Metal / Android / iOS / macOS / Linux / Web
Semantic Version: major.minor.patch
Module ID
Module Payload
```

Rust Core 已提供：

- 固定容量模块注册表
- 模块包解析和 ABI 校验
- 语义化版本管理
- 产物格式与目标平台声明
- 动态加载器抽象
- 自动选择最新启用版本
- 卸载与版本回滚

不同设备可以实现不同的 `ModuleLoader`：

- 裸机或单片机：Flash 模块、紧凑字节码或受控原生模块
- 网页和移动端：WebAssembly 沙箱模块
- 桌面设备：Portable UI 或 Rust 原生二进制 UI 模块

UI Vibe 不绑定 Web UI。AI 可以按设备能力生成 Portable UI Tree、WebAssembly UI、Vibe Bytecode UI，或针对目标架构编译的 Rust Native Binary UI。原生模块作为独立能力运行，通过稳定 Vibe 消息协议与原生合成器通信。

Rust 不保证动态库 ABI 稳定，因此 VibeOS 不直接把任意 Rust 动态库当作插件 ABI。插件通过稳定的 Vibe Module 包和平台加载器运行。

## 平台状态

| 平台 | 当前方式 | 状态 |
| --- | --- | --- |
| x86_64 UEFI 电脑 | 固件直接启动 `BOOTX64.EFI` | 已可构建和启动最小 Vibe CLI |
| QEMU / UEFI 虚拟机 | 启动 `dist/EFI/BOOT/BOOTX64.EFI` | 已可构建 |
| 单片机 | `vibeos-core` + 芯片 Transport/Store/Vibe 适配 | Core 已实现，芯片适配待添加 |
| Windows / Linux / macOS | `vibeos-host` Rust 二进制 | Host 已实现 |
| 网页 | Rust Host + 声明式 HTML/CSS | 已可运行 |
| Android / iOS | 浏览器入口；原生 Rust 宿主待添加 | 响应式入口已可运行 |

## 快速运行

### 电脑、手机和网页宿主

构建并启动 Rust Host：

```bash
cargo run --release -p vibeos-host
```

访问：

```text
http://localhost:8080
```

同一局域网内的手机可访问电脑的局域网地址。Android 和 iOS 原生设备权限桥接仍需后续以 Rust 平台适配层实现。

可配置环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `VIBE_HOST` | `0.0.0.0` | 监听地址 |
| `VIBE_PORT` | `8080` | 监听端口 |
| `VIBE_ROOT` | 当前目录 | Web 宿主资源目录 |
| `VIBE_DATA_DIR` | `data/` | 本地模块持久化目录 |

提交 `/vibe` 表单时，Rust Host 会把意图封装为 `.vpk` Vibe Module 包，并保存到：

```text
VIBE_DATA_DIR/modules/<module-id>/<semver>.vpk
```

当前保存的是占位模块载荷，用于验证 ABI、版本和持久化路径。真实 AI Module Compiler 接入后，这里会保存可动态加载的 Portable UI、WebAssembly、Vibe Bytecode 或原生二进制模块。

### 容器或普通虚拟机宿主

```bash
docker compose up --build
```

这只是用于在现有系统或虚拟机内运行兼容宿主，不是独立 VibeOS 系统。

## 构建独立 VibeOS

安装 Rust UEFI 目标：

```bash
rustup target add x86_64-unknown-uefi
```

构建独立启动文件：

```bash
cargo run --release -p vibeos-image-builder
```

输出：

```text
dist/
└── EFI/
    └── BOOT/
        └── BOOTX64.EFI
```

将 `dist/EFI` 复制到 FAT32 UEFI 启动分区，即可由支持 x86_64 UEFI 的电脑或虚拟机直接启动。当前文件未签名，通常需要关闭 Secure Boot。

当前裸机目标已经脱离 Linux，但仍是最小启动阶段：它只有 Vibe CLI 入口，尚未包含完整磁盘安装器、网络、图形、AI、文件系统和硬件驱动。请先使用单独的 USB 或虚拟机测试，不要覆盖现有系统的 EFI 分区。

## 单片机接入

`runtime/core` 不依赖标准库。设备只需要实现三个 Rust trait：

```rust
pub trait Vibe {
    fn create(&mut self, mode: VibeMode, intent: &[u8], output: &mut [u8])
        -> Result<usize, Error>;
}

pub trait CapabilityStore {
    // 从 Flash 或其他本地介质读取和保存能力
}

pub trait Transport {
    // 串口、BLE、网络或设备内通信
}
```

资源不足以运行本地 AI 的设备，可以通过 `Transport` 连接旁路 AI；生成并验证过的模块仍保存在设备本地，之后可脱离 AI 重复执行。

## 项目结构

```text
vibeos/
├── runtime/
│   ├── core/             # no_std Rust Core、三种 Vibe、模块与版本系统
│   └── host/             # Rust 兼容宿主与本地 API
├── platform/
│   └── uefi/             # 不经过 Linux 的 x86_64 UEFI 裸机目标
├── tools/
│   ├── image-builder/    # Rust 独立启动目录构建器
│   └── module-inspect/   # Vibe Module 包检查工具
├── core/os.css           # 声明式界面样式
└── manifest.webmanifest  # Web 安装元数据
```

## 验证

```bash
cargo fmt --all -- --check
cargo test -p vibeos-core -p vibeos-host -p vibeos-image-builder
cargo build --release -p vibeos-host
cargo build --release -p vibeos-module-inspect
cargo build --release -p vibeos-uefi --target x86_64-unknown-uefi
cargo run --release -p vibeos-image-builder
cargo check -p vibeos-core --target wasm32-unknown-unknown
cargo check -p vibeos-core --target aarch64-linux-android
cargo check -p vibeos-core --target aarch64-apple-ios
cargo check -p vibeos-core --target thumbv7em-none-eabihf
```

## 下一步

1. 定义可被 AI 生成的受控模块指令集，并实现第一个 Rust `ModuleLoader`。
2. 为 UEFI 目标增加持久化存储、网络、图形输出和 AI Transport。
3. 为一种真实单片机增加 Rust HAL 适配和 Flash Capability Store。
4. 实现 Rust AI Module Compiler，输出 Portable UI、WASM 和原生二进制 UI。
5. 为 Android、iOS、macOS 和 Linux 增加最薄的 Rust 设备权限适配层。
6. 实现独立磁盘安装器、升级和双版本回滚。

VibeOS 的目标不是预装更多功能，而是让设备只有 Vibe，并让一切能力都可以被生成、保存、加载、升级和修复。

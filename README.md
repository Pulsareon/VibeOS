# VibeOS

> **Device + AI = OS**

VibeOS 是一个以 AI 为核心、完全模块化的 Rust 操作系统实验。

## 当前状态（实验阶段）

### 已实现功能

- **CLI Vibe**：AI 生成文本命令模块，执行后输出结果
- **UI Vibe**：AI 生成 Rust 原生模块，编译后绘制像素界面
- **Vibe 改 Bug**：AI 分析意图生成修复模块
- **模块系统**：统一 .vpk 包格式，支持版本管理和回滚
- **系统能力**：`sys:log`、`sys:store`、`sys:time`、`sys:net`、`sys:display`、`sys:input`
- **AI 集成**：支持 OpenAI Chat/Responses 和 Claude Messages 协议
- **Web 桌面**：完整窗口系统，支持拖拽、右键菜单、多应用

### 已知限制

- UI 模块依赖 minifb 窗口，在无显示器环境可能无法打开
- AI 生成的代码可能有编译错误，需要多次尝试
- 原生模块加载需要 rustc 和完整的工具链
- 能力层仍为基础实现，缺少权限控制和沙箱
- UEFI 裸机目标仅支持最小 CLI，无图形和网络

## 设计边界

### Rust Only

- 系统核心使用 Rust
- 单片机核心使用 `#![no_std]`
- 电脑目标使用 Rust UEFI 程序
- Web 宿主使用声明式 HTML/CSS/JS

### 模块系统

所有生成能力使用统一模块包：

```text
Magic: VPK1
ABI Version: 2
Vibe Mode: CLI / UI / Fix
Module Format: VibeBytecode / NativeBinary
Module Target: Portable / X86_64Uefi
Version: major.minor.patch
Capabilities: sys:log, sys:display, etc.
Module ID + Payload
```

## 快速运行

### Windows 可执行文件

```bash
cd dist/vibeos-host-windows
start.bat
```

访问 http://localhost:8080

### 从源码构建

```bash
cargo run --release -p vibeos-host
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VIBE_HOST` | `0.0.0.0` | 监听地址 |
| `VIBE_PORT` | `8080` | 监听端口 |
| `VIBE_ROOT` | 当前目录 | 资源目录 |
| `VIBE_DATA_DIR` | `data/` | 数据目录 |
| `VIBE_AI_PROTOCOL` | - | AI 协议 (openai_chat/claude_messages) |
| `VIBE_AI_BASE_URL` | - | AI API 地址 |
| `VIBE_AI_MODEL` | - | AI 模型名 |
| `VIBE_AI_API_KEY` | - | AI API Key |

## 项目结构

```text
vibeos/
├── runtime/
│   ├── core/             # no_std Core、模块、能力、字节码
│   └── host/             # Rust Host、Web UI、NativeLoader、Display
├── platform/
│   └── uefi/             # UEFI 裸机目标
├── tools/
│   ├── image-builder/    # 启动镜像构建器
│   └── module-inspect/   # 模块包检查工具
├── core/                 # 前端资源 (os.css, os.js)
└── dist/                 # 发布包
```

## 验证

```bash
cargo fmt --all -- --check
cargo test --workspace
cargo build --release -p vibeos-host
```

## 下一步

1. 完善 BytecodeLoader，支持更多指令
2. 优化 AI 提示词，提高代码生成成功率
3. 添加模块签名和权限控制
4. 实现真正的 AI Module Compiler
5. 增强 UEFI 目标的功能
6. 添加沙箱和安全隔离

VibeOS 的目标是让设备只有 Vibe，让一切能力都可以被生成、保存、加载、升级和修复。

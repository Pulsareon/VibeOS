use capability::HostCapabilityRegistry;
use native_loader::NativeLoader;
use std::env;
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use vibeos_core::bytecode::{BytecodeLoader, encode_log_program};
use vibeos_core::capability::{CapabilityId, CapabilityRequirement, CapabilityVersion};
use vibeos_core::module::{ModuleFormat, ModulePackage, ModuleRegistry, ModuleTarget, Version};
use vibeos_core::{OP_VIBE_CLI, OP_VIBE_FIX, OP_VIBE_UI, VibeMode};

mod c_abi;
mod capability;
mod native_loader;

const MAX_REQUEST_SIZE: usize = 1024 * 1024;

struct Host {
    root: PathBuf,
    data: PathBuf,
    store_lock: Mutex<()>,
    capabilities: Mutex<HostCapabilityRegistry>,
}

struct SavedModule {
    id: String,
    version: Version,
    path: PathBuf,
    bytes: usize,
}

#[derive(Clone, Debug, Default)]
struct AiConfig {
    protocol: AiProtocol,
    base_url: String,
    model: String,
    api_key: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum AiProtocol {
    OpenAiChat,
    OpenAiResponses,
    ClaudeMessages,
}

impl Default for AiProtocol {
    fn default() -> Self {
        Self::OpenAiChat
    }
}

impl AiProtocol {
    fn from_str(value: &str) -> Self {
        match value {
            "openai_responses" => Self::OpenAiResponses,
            "claude_messages" => Self::ClaudeMessages,
            _ => Self::OpenAiChat,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::OpenAiChat => "openai_chat",
            Self::OpenAiResponses => "openai_responses",
            Self::ClaudeMessages => "claude_messages",
        }
    }
}

fn main() -> std::io::Result<()> {
    if env::args().nth(1).as_deref() == Some("--healthcheck") {
        return healthcheck();
    }

    let root = env::var("VIBE_ROOT")
        .map(PathBuf::from)
        .unwrap_or(env::current_dir()?);
    let data = env::var("VIBE_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| root.join("data"));
    let address = format!(
        "{}:{}",
        env::var("VIBE_HOST").unwrap_or_else(|_| "0.0.0.0".into()),
        env::var("VIBE_PORT").unwrap_or_else(|_| "8080".into())
    );

    fs::create_dir_all(&data)?;
    let capabilities = HostCapabilityRegistry::new(data.join("store"));
    let host = Arc::new(Host {
        root: root.canonicalize()?,
        data,
        store_lock: Mutex::new(()),
        capabilities: Mutex::new(capabilities),
    });
    let listener = TcpListener::bind(&address)?;

    println!("VibeOS Rust host: http://{address}");
    println!("Persistent data: {}", host.data.display());

    for stream in listener.incoming() {
        let host = Arc::clone(&host);
        match stream {
            Ok(stream) => {
                thread::spawn(move || {
                    if let Err(error) = handle_connection(stream, &host) {
                        eprintln!("[VibeOS] request failed: {error}");
                    }
                });
            }
            Err(error) => eprintln!("[VibeOS] connection failed: {error}"),
        }
    }
    Ok(())
}

fn healthcheck() -> std::io::Result<()> {
    let address = format!(
        "127.0.0.1:{}",
        env::var("VIBE_PORT").unwrap_or_else(|_| "8080".into())
    );
    let mut stream = TcpStream::connect(address)?;
    stream
        .write_all(b"GET /api/health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")?;
    let mut response = [0u8; 32];
    let read = stream.read(&mut response)?;
    if response[..read].starts_with(b"HTTP/1.1 200") {
        Ok(())
    } else {
        Err(std::io::Error::other("VibeOS host is unhealthy"))
    }
}

fn handle_connection(mut stream: TcpStream, host: &Host) -> std::io::Result<()> {
    let mut request = Vec::with_capacity(4096);
    let mut chunk = [0u8; 4096];
    let header_end;
    loop {
        let read = stream.read(&mut chunk)?;
        if read == 0 {
            return Ok(());
        }
        request.extend_from_slice(&chunk[..read]);
        if request.len() > MAX_REQUEST_SIZE {
            return respond(
                &mut stream,
                413,
                "text/plain; charset=utf-8",
                b"request too large",
                &[],
            );
        }
        if let Some(position) = find_bytes(&request, b"\r\n\r\n") {
            header_end = position + 4;
            break;
        }
    }

    let headers = String::from_utf8_lossy(&request[..header_end]);
    let mut lines = headers.lines();
    let request_line = lines.next().unwrap_or_default();
    let mut request_parts = request_line.split_whitespace();
    let method = request_parts.next().unwrap_or_default().to_owned();
    let target = request_parts.next().unwrap_or("/");
    let path = target.split('?').next().unwrap_or("/").to_owned();
    let content_length = lines
        .find_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.eq_ignore_ascii_case("content-length")
                .then(|| value.trim().parse::<usize>().ok())
                .flatten()
        })
        .unwrap_or(0);

    while request.len() < header_end + content_length {
        let read = stream.read(&mut chunk)?;
        if read == 0 {
            break;
        }
        request.extend_from_slice(&chunk[..read]);
        if request.len() > MAX_REQUEST_SIZE {
            return respond(
                &mut stream,
                413,
                "text/plain; charset=utf-8",
                b"request too large",
                &[],
            );
        }
    }
    let body_end = (header_end + content_length).min(request.len());
    let body = &request[header_end..body_end];

    match (method.as_str(), path.as_str()) {
        ("GET", "/api/health") => {
            json_response(&mut stream, 200, r#"{"ok":true,"service":"vibeos-rust"}"#)
        }
        ("GET", "/") | ("GET", "/desktop") | ("GET", "/index.html") => {
            desktop_response(&mut stream)
        }
        ("GET", "/tty") => tty_response(&mut stream),
        ("GET", "/config") => config_response(&mut stream, host),
        ("POST", "/config") => save_config_response(&mut stream, host, body),
        ("POST", "/vibe") => vibe_response(&mut stream, host, body),
        ("OPTIONS", _) => respond(
            &mut stream,
            204,
            "text/plain",
            b"",
            &[
                ("Access-Control-Allow-Origin", "*"),
                ("Access-Control-Allow-Methods", "GET,POST,OPTIONS"),
                ("Access-Control-Allow-Headers", "Content-Type"),
            ],
        ),
        ("GET", _) => serve_static(&mut stream, host, &path),
        _ => json_response(&mut stream, 404, r#"{"ok":false,"error":"not_found"}"#),
    }
}

fn desktop_response(stream: &mut TcpStream) -> std::io::Result<()> {
    let page = html_page(
        "VibeOS Desktop",
        "desktop-body",
        r#"
<main class="desktop">
  <section class="status-bar">
    <div class="brand-pill">VibeOS</div>
    <div class="status-right"><a href="/tty">TTY</a><a href="/config">AI Config</a><span>Rust Core</span><span>Local Modules</span></div>
  </section>
  <section class="desktop-grid">
    <article class="vibe-window">
      <header><span>⚡ UI Vibe</span><a href="/tty">切换到 TTY</a></header>
      <form class="vibe-form compact" method="post" action="/vibe">
        <input type="hidden" name="mode" value="ui">
        <textarea name="intent" rows="6" required autofocus placeholder="描述要生成的原生窗口、手机界面或系统面板"></textarea>
        <button class="vibe-submit" type="submit">生成 UI 模块</button>
      </form>
    </article>
    <aside class="launcher">
      <form method="post" action="/vibe"><input type="hidden" name="mode" value="cli"><input type="hidden" name="intent" value="open tty command vibe"><button type="submit">CLI Vibe</button></form>
      <form method="post" action="/vibe"><input type="hidden" name="mode" value="ui"><input type="hidden" name="intent" value="create native dashboard"><button type="submit">UI Vibe</button></form>
      <form method="post" action="/vibe"><input type="hidden" name="mode" value="fix"><input type="hidden" name="intent" value="fix last broken module"><button type="submit">改 Bug</button></form>
      <a class="launcher-link" href="/tty">TTY</a>
      <a class="launcher-link" href="/config">AI</a>
    </aside>
  </section>
  <nav class="dock">
    <a href="/desktop">桌面</a>
    <a href="/tty">TTY</a>
    <a href="/config">AI</a>
    <a href="/api/health">Health</a>
  </nav>
</main>
"#,
    );
    respond(
        stream,
        200,
        "text/html; charset=utf-8",
        page.as_bytes(),
        &[],
    )
}

fn tty_response(stream: &mut TcpStream) -> std::io::Result<()> {
    let page = html_page(
        "VibeOS TTY",
        "tty-body",
        r#"
<main class="tty">
  <section class="tty-screen">
    <div class="tty-line">VibeOS tty0</div>
    <div class="tty-line">Press desktop by opening <a href="/desktop">/desktop</a>. Configure AI at <a href="/config">/config</a>. Submit a command below to create a CLI module.</div>
    <form class="tty-form" method="post" action="/vibe">
      <input type="hidden" name="mode" value="cli">
      <label><span>vibe@device:~$</span><input name="intent" required autofocus placeholder="build network scanner"></label>
      <button type="submit">enter</button>
    </form>
    <form class="tty-fix" method="post" action="/vibe">
      <input type="hidden" name="mode" value="fix">
      <input name="intent" required placeholder="describe a broken module">
      <button type="submit">vibe fix</button>
    </form>
  </section>
  <nav class="tty-switch"><a href="/desktop">Alt+F7 Desktop</a><span>Alt+F1 TTY</span></nav>
</main>
"#,
    );
    respond(
        stream,
        200,
        "text/html; charset=utf-8",
        page.as_bytes(),
        &[],
    )
}

fn config_response(stream: &mut TcpStream, host: &Host) -> std::io::Result<()> {
    let config = load_ai_config(host)?.unwrap_or_default();
    let key_status = if config.api_key.is_empty() {
        "未配置"
    } else {
        "已保存，页面不会回显"
    };
    let body = format!(
        r#"
<main class="vibe-shell">
  <div class="brand-mark">AI</div>
  <section class="result config-panel">
    <h2>AI Endpoint</h2>
    <p>支持 OpenAI Chat Completions、OpenAI Responses 和 Claude Messages。密钥只保存在本地数据目录，不会回显。</p>
    <form class="config-form" method="post" action="/config">
      <label>Protocol<select name="protocol">
        <option value="openai_chat" {openai_chat_selected}>OpenAI Chat Completions</option>
        <option value="openai_responses" {openai_responses_selected}>OpenAI Responses</option>
        <option value="claude_messages" {claude_messages_selected}>Claude Messages</option>
      </select></label>
      <label>Base URL<input name="base_url" required value="{base_url}" placeholder="https://api.openai.com/v1"></label>
      <label>Model<input name="model" required value="{model}" placeholder="gpt-4o-mini"></label>
      <label>SK Key<input name="api_key" type="password" placeholder="{key_status}"></label>
      <p class="hint">留空 SK Key 会保留旧密钥。Base URL 可以是 /v1，也可以直接填完整 endpoint。</p>
      <button class="vibe-submit" type="submit">保存 AI 配置</button>
    </form>
    <a class="back-link secondary" href="/desktop">返回桌面</a>
    <a class="back-link secondary" href="/tty">切换 TTY</a>
  </section>
</main>
"#,
        base_url = html_escape(if config.base_url.is_empty() {
            "https://api.openai.com/v1"
        } else {
            &config.base_url
        }),
        model = html_escape(if config.model.is_empty() {
            "gpt-4o-mini"
        } else {
            &config.model
        }),
        key_status = key_status,
        openai_chat_selected = selected(config.protocol == AiProtocol::OpenAiChat),
        openai_responses_selected = selected(config.protocol == AiProtocol::OpenAiResponses),
        claude_messages_selected = selected(config.protocol == AiProtocol::ClaudeMessages),
    );
    let page = html_page("AI Config · VibeOS", "result-body", &body);
    respond(
        stream,
        200,
        "text/html; charset=utf-8",
        page.as_bytes(),
        &[],
    )
}

fn save_config_response(stream: &mut TcpStream, host: &Host, body: &[u8]) -> std::io::Result<()> {
    let body = String::from_utf8_lossy(body);
    let existing = load_ai_config(host)?.unwrap_or_default();
    let protocol = AiProtocol::from_str(&form_field(&body, "protocol").unwrap_or_default());
    let base_url = form_field(&body, "base_url")
        .unwrap_or_default()
        .trim()
        .to_owned();
    let model = form_field(&body, "model")
        .unwrap_or_default()
        .trim()
        .to_owned();
    let api_key_input = form_field(&body, "api_key").unwrap_or_default();
    let api_key = if api_key_input.trim().is_empty() {
        existing.api_key
    } else {
        api_key_input.trim().to_owned()
    };

    if base_url.is_empty() || model.is_empty() || api_key.is_empty() {
        return json_response(stream, 400, r#"{"ok":false,"error":"missing_ai_config"}"#);
    }

    save_ai_config(
        host,
        &AiConfig {
            protocol,
            base_url,
            model,
            api_key,
        },
    )?;

    let page = html_page(
        "AI Config Saved · VibeOS",
        "result-body",
        r#"<main class="vibe-shell"><div class="brand-mark">AI</div><section class="result"><h2>AI 配置已保存</h2><p>之后提交 Vibe 会按所选协议调用 AI 接口。</p><a class="back-link" href="/desktop">返回桌面</a><a class="back-link secondary" href="/tty">切换 TTY</a></section></main>"#,
    );
    respond(
        stream,
        200,
        "text/html; charset=utf-8",
        page.as_bytes(),
        &[],
    )
}

fn html_page(title: &str, body_class: &str, body: &str) -> String {
    format!(
        "<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\"><meta name=\"theme-color\" content=\"#080816\"><title>{}</title><link rel=\"manifest\" href=\"/manifest.webmanifest\"><link rel=\"icon\" href=\"/assets/vibeos.svg\" type=\"image/svg+xml\"><link rel=\"stylesheet\" href=\"/core/os.css\"></head><body class=\"{}\">{}</body></html>",
        html_escape(title),
        body_class,
        body
    )
}

fn selected(value: bool) -> &'static str {
    if value { "selected" } else { "" }
}

fn vibe_response(stream: &mut TcpStream, host: &Host, body: &[u8]) -> std::io::Result<()> {
    let body = String::from_utf8_lossy(body);
    let mode = form_field(&body, "mode").unwrap_or_else(|| "cli".into());
    let intent = form_field(&body, "intent").unwrap_or_default();
    if intent.trim().is_empty() {
        return json_response(stream, 400, r#"{"ok":false,"error":"empty_intent"}"#);
    }

    let (vibe_mode, mode_name, output_kind) = match mode.as_str() {
        "ui" => (
            VibeMode::Ui,
            "UI Vibe",
            "Portable UI 或 Rust Native Binary UI",
        ),
        "fix" => (VibeMode::Fix, "Vibe 改 Bug", "新的已版本化修复模块"),
        _ => (VibeMode::Cli, "CLI Vibe", "命令或自动化模块"),
    };
    let ai_result = match load_ai_config(host)? {
        Some(config) if config.is_complete() => call_ai(&config, vibe_mode, intent.trim()),
        _ => Err("AI endpoint not configured".to_owned()),
    };
    let ai_text = match &ai_result {
        Ok(text) => text.as_str(),
        Err(error) => error.as_str(),
    };
    let saved = save_vibe_module(host, vibe_mode, intent.trim(), output_kind, ai_text)?;
    let execution = match execute_saved_module(host, &saved.path) {
        Ok(output) => format!(
            "
执行结果：{}",
            String::from_utf8_lossy(&output)
        ),
        Err(error) => format!(
            "
执行失败：{error}"
        ),
    };
    let ai_status = match &ai_result {
        Ok(_) => "AI 已生成模块载荷".to_owned(),
        Err(error) if error == "AI endpoint not configured" => {
            "AI 未配置，已保存离线占位模块".to_owned()
        }
        Err(error) => format!("AI 调用失败：{error}"),
    };
    let ai_text_for_display = ai_text.replace('\0', "");
    let body = format!(
        "<main class=\"vibe-shell\"><div class=\"brand-mark\">V</div><section class=\"result\"><h2>{mode_name}</h2><p>意图已由 Rust Host 接收，并被映射为 VibeMode::{vibe_mode:?}。</p><code>{intent}</code><p>目标产物：{output_kind}</p><p>{ai_status}</p><code>{ai_text}</code><p>已保存为本地 Vibe Module：</p><code>ID: {id}
Version: {major}.{minor}.{patch}
Bytes: {bytes}
Path: {path}{execution}</code><a class=\"back-link\" href=\"/desktop\">返回桌面</a><a class=\"back-link secondary\" href=\"/tty\">切换 TTY</a><a class=\"back-link secondary\" href=\"/config\">AI 配置</a></section></main>",
        intent = html_escape(intent.trim()),
        output_kind = html_escape(output_kind),
        ai_status = ai_status,
        ai_text = html_escape(&ai_text_for_display),
        id = html_escape(&saved.id),
        major = saved.version.major,
        minor = saved.version.minor,
        patch = saved.version.patch,
        bytes = saved.bytes,
        path = html_escape(&saved.path.display().to_string()),
        execution = html_escape(&execution)
    );
    let page = html_page(&format!("{mode_name} · VibeOS"), "result-body", &body);
    respond(
        stream,
        200,
        "text/html; charset=utf-8",
        page.as_bytes(),
        &[],
    )
}

fn execute_saved_module(host: &Host, path: &Path) -> std::io::Result<Vec<u8>> {
    let bytes = fs::read(path)?;
    let package = ModulePackage::decode(&bytes)
        .map_err(|error| std::io::Error::other(format!("decode failed: {error:?}")))?;

    let mut capabilities = host.capabilities.lock().unwrap();
    package
        .check_capabilities(&*capabilities)
        .map_err(|error| std::io::Error::other(format!("capability check failed: {error:?}")))?;

    let mut output = vec![0u8; 256];
    let len = match package.format {
        ModuleFormat::VibeBytecode => {
            let mut loader = BytecodeLoader::new();
            let mut registry: ModuleRegistry<(), 4> = ModuleRegistry::new();
            registry
                .install(&package, &mut loader, &mut *capabilities)
                .map_err(|error| std::io::Error::other(format!("install failed: {error:?}")))?;
            registry
                .invoke_latest(
                    package.id,
                    package.payload,
                    &mut output,
                    &mut loader,
                    &mut *capabilities,
                )
                .map_err(|error| std::io::Error::other(format!("invoke failed: {error:?}")))?
        }
        ModuleFormat::NativeBinary => {
            let cache_dir = host.data.join("native-cache");
            std::fs::create_dir_all(&cache_dir)?;
            let mut loader = NativeLoader::new(host.data.join("store"), cache_dir);
            let mut registry: ModuleRegistry<usize, 4> = ModuleRegistry::new();
            registry
                .install(&package, &mut loader, &mut *capabilities)
                .map_err(|error| std::io::Error::other(format!("install failed: {error:?}")))?;
            registry
                .invoke_latest(
                    package.id,
                    package.payload,
                    &mut output,
                    &mut loader,
                    &mut *capabilities,
                )
                .map_err(|error| std::io::Error::other(format!("invoke failed: {error:?}")))?
        }
        _ => 0,
    };
    output.truncate(len);
    Ok(output)
}

fn save_vibe_module(
    host: &Host,
    mode: VibeMode,
    intent: &str,
    output_kind: &str,
    ai_text: &str,
) -> std::io::Result<SavedModule> {
    let _guard = host.store_lock.lock().unwrap();
    let id = module_id(mode, intent);
    let module_dir = host.data.join("modules").join(&id);
    fs::create_dir_all(&module_dir)?;
    let version = next_version(&module_dir)?;
    let (format, target) = module_shape(mode);
    let payload = module_payload(mode, intent, output_kind, ai_text, version);
    let capabilities = module_capabilities(mode);
    let package = ModulePackage {
        id: id.as_bytes(),
        version,
        mode,
        format,
        target,
        capabilities: &capabilities,
        payload: &payload,
    };
    let mut encoded = vec![0; payload.len() + id.len() + capabilities.len() + 64];
    let length = package
        .encode(&mut encoded)
        .map_err(|_| std::io::Error::other("failed to encode Vibe module"))?;
    encoded.truncate(length);
    let path = module_dir.join(format!(
        "{}.{}.{}.vpk",
        version.major, version.minor, version.patch
    ));
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&path)?;
    file.write_all(&encoded)?;
    Ok(SavedModule {
        id,
        version,
        path,
        bytes: encoded.len(),
    })
}

fn module_shape(mode: VibeMode) -> (ModuleFormat, ModuleTarget) {
    match mode {
        VibeMode::Cli => (ModuleFormat::VibeBytecode, ModuleTarget::Portable),
        VibeMode::Ui => (ModuleFormat::NativeBinary, ModuleTarget::X86_64Uefi),
        VibeMode::Fix => (ModuleFormat::NativeBinary, ModuleTarget::Portable),
    }
}

fn module_capabilities(_mode: VibeMode) -> Vec<u8> {
    let req = CapabilityRequirement {
        id: CapabilityId::from_str("sys:log").unwrap(),
        min_version: CapabilityVersion::new(1, 0),
    };
    let mut buffer = vec![0u8; 64];
    let len = req.encode(&mut buffer).unwrap();
    buffer.truncate(len);
    buffer
}

fn module_payload(
    mode: VibeMode,
    intent: &str,
    _output_kind: &str,
    ai_text: &str,
    _version: Version,
) -> Vec<u8> {
    match mode {
        VibeMode::Cli => {
            let message = if ai_text.trim().is_empty() {
                format!("generated CLI module for: {}", intent)
            } else {
                ai_text.trim().chars().take(120).collect()
            };
            let mut buffer = vec![0u8; message.len() + 64];
            let len = encode_log_program(&message, &mut buffer).unwrap();
            buffer.truncate(len);
            buffer
        }
        VibeMode::Ui | VibeMode::Fix => {
            let source = ai_text.trim();
            if source.contains("vibe_module_main") {
                source.as_bytes().to_vec()
            } else {
                default_native_source(intent).into_bytes()
            }
        }
    }
}

fn default_native_source(intent: &str) -> String {
    let safe_intent = intent.replace('\\', "\\\\").replace('"', "\\\"");
    format!(
        "use vibeos_core::c_abi::{{VibeAbi, VIBE_MODULE_OK}};\n\n\
         #[unsafe(no_mangle)]\n\
         pub unsafe extern \"C\" fn vibe_module_main(abi: *const VibeAbi) -> i32 {{\n\
             let abi = unsafe {{ &*abi }};\n\
             let msg = b\"VibeOS module for: {}\\0\";\n\
             unsafe {{ (abi.log)(abi.context, msg.as_ptr(), msg.len() - 1) }};\n\
             VIBE_MODULE_OK\n\
         }}\n",
        safe_intent
    )
}

impl AiConfig {
    fn is_complete(&self) -> bool {
        !self.base_url.trim().is_empty()
            && !self.model.trim().is_empty()
            && !self.api_key.trim().is_empty()
    }
}

fn ai_config_path(host: &Host) -> PathBuf {
    host.data.join("ai.conf")
}

fn load_ai_config(host: &Host) -> std::io::Result<Option<AiConfig>> {
    let path = ai_config_path(host);
    let mut config = AiConfig::default();
    let mut any = false;
    if path.exists() {
        any = true;
        let content = fs::read_to_string(path)?;
        for line in content.lines() {
            let Some((key, value)) = line.split_once('=') else {
                continue;
            };
            let value = unescape_config(value);
            match key {
                "protocol" => config.protocol = AiProtocol::from_str(&value),
                "base_url" => config.base_url = value,
                "model" => config.model = value,
                "api_key" => config.api_key = value,
                _ => {}
            }
        }
    }
    if let Ok(protocol) = env::var("VIBE_AI_PROTOCOL") {
        any = true;
        config.protocol = AiProtocol::from_str(&protocol);
    }
    if let Ok(base_url) = env::var("VIBE_AI_BASE_URL") {
        any = true;
        config.base_url = base_url;
    }
    if let Ok(model) = env::var("VIBE_AI_MODEL") {
        any = true;
        config.model = model;
    }
    if let Ok(api_key) = env::var("VIBE_AI_API_KEY") {
        any = true;
        config.api_key = api_key;
    }
    if any { Ok(Some(config)) } else { Ok(None) }
}

fn save_ai_config(host: &Host, config: &AiConfig) -> std::io::Result<()> {
    fs::create_dir_all(&host.data)?;
    let content = format!(
        "protocol={}\nbase_url={}\nmodel={}\napi_key={}\n",
        config.protocol.as_str(),
        escape_config(&config.base_url),
        escape_config(&config.model),
        escape_config(&config.api_key)
    );
    fs::write(ai_config_path(host), content)
}

fn escape_config(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

fn unescape_config(value: &str) -> String {
    let mut output = String::new();
    let mut chars = value.chars();
    while let Some(character) = chars.next() {
        if character == '\\' {
            match chars.next() {
                Some('n') => output.push('\n'),
                Some('r') => output.push('\r'),
                Some('\\') => output.push('\\'),
                Some(other) => output.push(other),
                None => output.push('\\'),
            }
        } else {
            output.push(character);
        }
    }
    output
}

fn chat_completions_url(base_url: &str) -> String {
    endpoint_url(base_url, "chat/completions")
}

fn responses_url(base_url: &str) -> String {
    endpoint_url(base_url, "responses")
}

fn claude_messages_url(base_url: &str) -> String {
    endpoint_url(base_url, "messages")
}

fn endpoint_url(base_url: &str, endpoint: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.ends_with(endpoint) {
        trimmed.to_owned()
    } else {
        format!("{trimmed}/{endpoint}")
    }
}

fn call_ai(config: &AiConfig, mode: VibeMode, intent: &str) -> Result<String, String> {
    let prompt = match mode {
        VibeMode::Cli => format!(
            "You are the VibeOS CLI module compiler. The user intent is: {}. Respond with a single short sentence (max 120 chars, plain text, no quotes) that the module will log. Do not explain.",
            intent
        ),
        VibeMode::Ui => format!(
            "You are the VibeOS Native UI module compiler. The user intent is: {}.\n\
             Generate a minimal Rust native VibeOS module as plain source code.\n\
             Requirements:\n\
             1. Start with `use vibeos_core::c_abi::{{VibeAbi, VIBE_MODULE_OK}};`\n\
             2. Define `#[unsafe(no_mangle)] pub unsafe extern \"C\" fn vibe_module_main(abi: *const VibeAbi) -> i32`\n\
             3. Log a short message describing the UI using `(abi.log)(abi.context, msg.as_ptr(), msg.len() - 1)`\n\
             4. Return VIBE_MODULE_OK\n\
             Return ONLY the Rust source code, no markdown, no explanation.",
            intent
        ),
        VibeMode::Fix => format!(
            "You are the VibeOS Fix module compiler. The user intent is: {}.\n\
             Generate a minimal Rust native VibeOS module as plain source code.\n\
             Requirements:\n\
             1. Start with `use vibeos_core::c_abi::{{VibeAbi, VIBE_MODULE_OK}};`\n\
             2. Define `#[unsafe(no_mangle)] pub unsafe extern \"C\" fn vibe_module_main(abi: *const VibeAbi) -> i32`\n\
             3. Log a short message describing the fix using `(abi.log)(abi.context, msg.as_ptr(), msg.len() - 1)`\n\
             4. Return VIBE_MODULE_OK\n\
             Return ONLY the Rust source code, no markdown, no explanation.",
            intent
        ),
    };
    match config.protocol {
        AiProtocol::OpenAiChat => call_openai_chat(config, &prompt),
        AiProtocol::OpenAiResponses => call_openai_responses(config, &prompt),
        AiProtocol::ClaudeMessages => call_claude_messages(config, &prompt),
    }
}

fn call_openai_chat(config: &AiConfig, prompt: &str) -> Result<String, String> {
    let body = format!(
        "{{\"model\":\"{}\",\"messages\":[{{\"role\":\"system\",\"content\":\"{}\"}},{{\"role\":\"user\",\"content\":\"{}\"}}],\"temperature\":0.2,\"stream\":false}}",
        json_escape(&config.model),
        json_escape("Generate VibeOS module payloads for a Rust-only modular OS."),
        json_escape(prompt)
    );
    let text = post_json(
        chat_completions_url(&config.base_url),
        &config.api_key,
        &[],
        body,
    )?;
    extract_openai_chat_content(&text)
        .ok_or_else(|| format!("OpenAI Chat response missing content: {text}"))
}

fn call_openai_responses(config: &AiConfig, prompt: &str) -> Result<String, String> {
    let body = format!(
        "{{\"model\":\"{}\",\"instructions\":\"{}\",\"input\":\"{}\",\"temperature\":0.2,\"stream\":false}}",
        json_escape(&config.model),
        json_escape("Generate VibeOS module payloads for a Rust-only modular OS."),
        json_escape(prompt)
    );
    let text = post_json(responses_url(&config.base_url), &config.api_key, &[], body)?;
    extract_openai_responses_content(&text)
        .ok_or_else(|| format!("OpenAI Responses response missing content: {text}"))
}

fn call_claude_messages(config: &AiConfig, prompt: &str) -> Result<String, String> {
    let body = format!(
        "{{\"model\":\"{}\",\"max_tokens\":2048,\"system\":\"{}\",\"messages\":[{{\"role\":\"user\",\"content\":\"{}\"}}]}}",
        json_escape(&config.model),
        json_escape("Generate VibeOS module payloads for a Rust-only modular OS."),
        json_escape(prompt)
    );
    let text = post_json(
        claude_messages_url(&config.base_url),
        &config.api_key,
        &[("anthropic-version", "2023-06-01")],
        body,
    )?;
    extract_claude_messages_content(&text)
        .ok_or_else(|| format!("Claude Messages response missing content: {text}"))
}

fn post_json(
    url: String,
    api_key: &str,
    headers: &[(&str, &str)],
    body: String,
) -> Result<String, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|error| format!("AI client error: {error}"))?;
    let is_claude = headers.iter().any(|(name, _)| *name == "anthropic-version");
    let mut request = client.post(url).header("content-type", "application/json");
    for (name, value) in headers {
        request = request.header(*name, *value);
    }
    if is_claude {
        request = request.header("x-api-key", api_key);
    } else {
        request = request.bearer_auth(api_key);
    }
    let response = request
        .body(body)
        .send()
        .map_err(|error| format!("AI request error: {error}"))?;
    let status = response.status();
    let text = response
        .text()
        .map_err(|error| format!("AI response read error: {error}"))?;
    if !status.is_success() {
        return Err(format!("AI endpoint returned {status}: {text}"));
    }
    Ok(text)
}

fn extract_openai_chat_content(response: &str) -> Option<String> {
    let json: serde_json::Value = serde_json::from_str(response).ok()?;
    json.pointer("/choices/0/message/content")
        .and_then(serde_json::Value::as_str)
        .or_else(|| {
            json.pointer("/choices/0/text")
                .and_then(serde_json::Value::as_str)
        })
        .map(str::to_owned)
}

fn extract_openai_responses_content(response: &str) -> Option<String> {
    let json: serde_json::Value = serde_json::from_str(response).ok()?;
    if let Some(text) = json.get("output_text").and_then(serde_json::Value::as_str) {
        return Some(text.to_owned());
    }
    json.get("output")
        .and_then(serde_json::Value::as_array)?
        .iter()
        .flat_map(|item| {
            item.get("content")
                .and_then(serde_json::Value::as_array)
                .into_iter()
                .flatten()
        })
        .filter_map(|content| content.get("text").and_then(serde_json::Value::as_str))
        .next()
        .map(str::to_owned)
}

fn extract_claude_messages_content(response: &str) -> Option<String> {
    let json: serde_json::Value = serde_json::from_str(response).ok()?;
    json.get("content")?
        .as_array()?
        .iter()
        .filter_map(|content| content.get("text").and_then(serde_json::Value::as_str))
        .next()
        .map(str::to_owned)
}

fn json_escape(input: &str) -> String {
    input
        .chars()
        .flat_map(|character| match character {
            '"' => "\\\"".chars().collect::<Vec<_>>(),
            '\\' => "\\\\".chars().collect(),
            '\n' => "\\n".chars().collect(),
            '\r' => "\\r".chars().collect(),
            '\t' => "\\t".chars().collect(),
            other => vec![other],
        })
        .collect()
}

fn module_id(mode: VibeMode, intent: &str) -> String {
    let mut hash = 0xcbf29ce484222325u64;
    hash = fnv(hash, &[mode_operation(mode)]);
    hash = fnv(hash, intent.trim().to_ascii_lowercase().as_bytes());
    format!("{:02x}-{:016x}", mode_operation(mode), hash)
}

fn mode_operation(mode: VibeMode) -> u8 {
    match mode {
        VibeMode::Cli => OP_VIBE_CLI,
        VibeMode::Ui => OP_VIBE_UI,
        VibeMode::Fix => OP_VIBE_FIX,
    }
}

fn fnv(mut hash: u64, bytes: &[u8]) -> u64 {
    for byte in bytes {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

fn next_version(module_dir: &Path) -> std::io::Result<Version> {
    let mut patch = 0;
    for entry in fs::read_dir(module_dir)? {
        let entry = entry?;
        let name = entry.file_name();
        let name = name.to_string_lossy();
        let Some(name) = name.strip_suffix(".vpk") else {
            continue;
        };
        let parts: Vec<_> = name.split('.').collect();
        if parts.len() != 3 || parts[0] != "1" || parts[1] != "0" {
            continue;
        }
        if let Ok(existing) = parts[2].parse::<u16>() {
            patch = patch.max(existing.saturating_add(1));
        }
    }
    Ok(Version::new(1, 0, patch))
}

fn serve_static(stream: &mut TcpStream, host: &Host, path: &str) -> std::io::Result<()> {
    let Some(relative) = static_file(path) else {
        return respond(stream, 404, "text/plain; charset=utf-8", b"not found", &[]);
    };
    if relative.split('/').any(|part| part == "..") {
        return respond(stream, 403, "text/plain; charset=utf-8", b"forbidden", &[]);
    }

    let candidate = host.root.join(relative);
    let Ok(candidate) = candidate.canonicalize() else {
        return respond(stream, 404, "text/plain; charset=utf-8", b"not found", &[]);
    };
    if !candidate.starts_with(&host.root) || !candidate.is_file() {
        return respond(stream, 403, "text/plain; charset=utf-8", b"forbidden", &[]);
    }

    let body = fs::read(&candidate)?;
    let content_type = mime_type(&candidate);
    respond(stream, 200, content_type, &body, &[])
}

fn static_file(path: &str) -> Option<&'static str> {
    match path {
        "/manifest.webmanifest" => Some("manifest.webmanifest"),
        "/core/os.css" => Some("core/os.css"),
        "/assets/vibeos.svg" => Some("assets/vibeos.svg"),
        _ if path.contains("..") => Some("../forbidden"),
        _ => None,
    }
}

fn respond(
    stream: &mut TcpStream,
    status: u16,
    content_type: &str,
    body: &[u8],
    extra_headers: &[(&str, &str)],
) -> std::io::Result<()> {
    let reason = match status {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        403 => "Forbidden",
        404 => "Not Found",
        413 => "Payload Too Large",
        _ => "Error",
    };
    write!(
        stream,
        "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\n",
        body.len()
    )?;
    for (name, value) in extra_headers {
        write!(stream, "{name}: {value}\r\n")?;
    }
    write!(stream, "\r\n")?;
    stream.write_all(body)
}

fn json_response(stream: &mut TcpStream, status: u16, body: &str) -> std::io::Result<()> {
    respond(
        stream,
        status,
        "application/json; charset=utf-8",
        body.as_bytes(),
        &[
            ("Cache-Control", "no-store"),
            ("Access-Control-Allow-Origin", "*"),
        ],
    )
}

fn form_field(input: &str, key: &str) -> Option<String> {
    input.split('&').find_map(|part| {
        let (name, value) = part.split_once('=')?;
        (percent_decode(name) == key).then(|| percent_decode(value))
    })
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'+' => {
                output.push(b' ');
                index += 1;
            }
            b'%' if index + 2 < bytes.len() => {
                let high = hex(bytes[index + 1]);
                let low = hex(bytes[index + 2]);
                if let (Some(high), Some(low)) = (high, low) {
                    output.push((high << 4) | low);
                    index += 3;
                } else {
                    output.push(bytes[index]);
                    index += 1;
                }
            }
            byte => {
                output.push(byte);
                index += 1;
            }
        }
    }
    String::from_utf8_lossy(&output).into_owned()
}

fn hex(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn html_escape(input: &str) -> String {
    input
        .chars()
        .flat_map(|character| match character {
            '&' => "&amp;".chars().collect::<Vec<_>>(),
            '<' => "&lt;".chars().collect(),
            '>' => "&gt;".chars().collect(),
            '"' => "&quot;".chars().collect(),
            '\'' => "&#39;".chars().collect(),
            other => vec![other],
        })
        .collect()
}

fn find_bytes(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

fn mime_type(path: &Path) -> &'static str {
    match path.extension().and_then(|extension| extension.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json") | Some("webmanifest") => "application/json; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("wasm") => "application/wasm",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;
    use std::thread;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[derive(Debug)]
    struct AiRequestRecord {
        path: String,
        headers: String,
    }

    #[test]
    fn decodes_form_fields() {
        assert_eq!(
            form_field("mode=ui&intent=create+native%20window", "intent").as_deref(),
            Some("create native window")
        );
    }

    #[test]
    fn exposes_only_vibe_static_files() {
        assert_eq!(static_file("/"), None);
        assert_eq!(static_file("/core/os.css"), Some("core/os.css"));
        assert_eq!(static_file("/Cargo.toml"), None);
        assert_eq!(static_file("/../Cargo.toml"), Some("../forbidden"));
    }

    #[test]
    fn saves_versioned_modules() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let data = env::temp_dir().join(format!("vibeos-host-test-{unique}"));
        let host = Host {
            root: env::current_dir().unwrap(),
            data: data.clone(),
            store_lock: Mutex::new(()),
            capabilities: Mutex::new(HostCapabilityRegistry::new(data.join("store"))),
        };

        let first = save_vibe_module(&host, VibeMode::Ui, "native window", "ui", "ai").unwrap();
        let second = save_vibe_module(&host, VibeMode::Ui, "native window", "ui", "ai").unwrap();

        assert_eq!(first.version, Version::new(1, 0, 0));
        assert_eq!(second.version, Version::new(1, 0, 1));
        assert!(first.path.exists());
        assert!(second.path.exists());
        fs::remove_dir_all(data).unwrap();
    }

    #[test]
    fn builds_chat_completions_url() {
        assert_eq!(
            chat_completions_url("https://api.example.com/v1"),
            "https://api.example.com/v1/chat/completions"
        );
        assert_eq!(
            chat_completions_url("https://api.example.com/v1/chat/completions"),
            "https://api.example.com/v1/chat/completions"
        );
    }

    #[test]
    fn builds_responses_and_claude_urls() {
        assert_eq!(
            responses_url("https://api.example.com/v1"),
            "https://api.example.com/v1/responses"
        );
        assert_eq!(
            claude_messages_url("https://api.anthropic.com/v1"),
            "https://api.anthropic.com/v1/messages"
        );
    }

    #[test]
    fn extracts_openai_chat_content() {
        let response = r#"{"choices":[{"message":{"content":"module payload"}}]}"#;
        assert_eq!(
            extract_openai_chat_content(response).as_deref(),
            Some("module payload")
        );
    }

    #[test]
    fn extracts_openai_responses_content() {
        let response =
            r#"{"output":[{"content":[{"type":"output_text","text":"response payload"}]}]}"#;
        assert_eq!(
            extract_openai_responses_content(response).as_deref(),
            Some("response payload")
        );
    }

    #[test]
    fn extracts_claude_messages_content() {
        let response = r#"{"content":[{"type":"text","text":"claude payload"}]}"#;
        assert_eq!(
            extract_claude_messages_content(response).as_deref(),
            Some("claude payload")
        );
    }

    #[test]
    fn calls_all_ai_protocols_over_http() {
        let (base_url, handle) = spawn_fake_ai_server(3);
        let base_url = format!("{base_url}/v1");

        let chat = call_ai(
            &AiConfig {
                protocol: AiProtocol::OpenAiChat,
                base_url: base_url.clone(),
                model: "test-model".into(),
                api_key: "sk-test".into(),
            },
            VibeMode::Cli,
            "make tty command",
        )
        .unwrap();
        let responses = call_ai(
            &AiConfig {
                protocol: AiProtocol::OpenAiResponses,
                base_url: base_url.clone(),
                model: "test-model".into(),
                api_key: "sk-test".into(),
            },
            VibeMode::Ui,
            "make settings panel",
        )
        .unwrap();
        let claude = call_ai(
            &AiConfig {
                protocol: AiProtocol::ClaudeMessages,
                base_url,
                model: "test-model".into(),
                api_key: "sk-test".into(),
            },
            VibeMode::Fix,
            "fix broken module",
        )
        .unwrap();

        assert_eq!(chat, "chat-ok");
        assert_eq!(responses, "responses-ok");
        assert_eq!(claude, "claude-ok");

        let records = handle.join().unwrap();
        assert_eq!(records.len(), 3);
        assert!(
            records[0].headers.contains("authorization:")
                && records[0].headers.contains("bearer sk-test")
        );
        assert_eq!(records[1].path, "/v1/responses");
        assert!(
            records[1].headers.contains("authorization:")
                && records[1].headers.contains("bearer sk-test")
        );
        assert_eq!(records[2].path, "/v1/messages");
        assert!(
            records[2].headers.contains("x-api-key:") && records[2].headers.contains("sk-test")
        );
        assert!(records[2].headers.contains("anthropic-version: 2023-06-01"));
    }

    fn spawn_fake_ai_server(count: usize) -> (String, thread::JoinHandle<Vec<AiRequestRecord>>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let handle = thread::spawn(move || {
            let mut records = Vec::new();
            for _ in 0..count {
                let (mut stream, _) = listener.accept().unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .unwrap();

                let mut request = Vec::new();
                let mut buffer = [0u8; 1024];
                let header_end = loop {
                    let read = stream.read(&mut buffer).unwrap();
                    assert!(read > 0, "fake AI server received an empty request");
                    request.extend_from_slice(&buffer[..read]);
                    if let Some(position) = find_bytes(&request, b"\r\n\r\n") {
                        break position + 4;
                    }
                };

                let headers = String::from_utf8_lossy(&request[..header_end]).to_lowercase();
                let content_length = headers
                    .lines()
                    .find_map(|line| {
                        let (name, value) = line.split_once(':')?;
                        (name == "content-length")
                            .then(|| value.trim().parse::<usize>().ok())
                            .flatten()
                    })
                    .unwrap_or(0);
                while request.len() < header_end + content_length {
                    let read = stream.read(&mut buffer).unwrap();
                    assert!(read > 0, "fake AI server request body ended early");
                    request.extend_from_slice(&buffer[..read]);
                }

                let first_line = headers.lines().next().unwrap_or_default();
                let path = first_line
                    .split_whitespace()
                    .nth(1)
                    .unwrap_or("/")
                    .to_owned();
                let payload = match path.as_str() {
                    "/v1/chat/completions" => r#"{"choices":[{"message":{"content":"chat-ok"}}]}"#,
                    "/v1/responses" => r#"{"output_text":"responses-ok"}"#,
                    "/v1/messages" => r#"{"content":[{"type":"text","text":"claude-ok"}]}"#,
                    _ => r#"{"error":"not_found"}"#,
                };
                let status = if path == "/v1/chat/completions"
                    || path == "/v1/responses"
                    || path == "/v1/messages"
                {
                    "200 OK"
                } else {
                    "404 Not Found"
                };
                write!(
                    stream,
                    "HTTP/1.1 {status}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{payload}",
                    payload.len()
                )
                .unwrap();
                records.push(AiRequestRecord { path, headers });
            }
            records
        });
        (format!("http://{address}"), handle)
    }
}

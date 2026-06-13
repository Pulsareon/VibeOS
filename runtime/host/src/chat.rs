use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use vibeos_core::module::ModulePackage;

use crate::AiConfig;

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub execution: Option<String>,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct ChatSession {
    pub session_id: String,
    pub messages: Vec<ChatMessage>,
}

pub fn session_path(data_dir: &Path, session_id: &str) -> PathBuf {
    let safe: String = session_id
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    data_dir.join("chat").join(format!("{}.json", safe))
}

pub fn load_session(data_dir: &Path, session_id: &str) -> ChatSession {
    let path = session_path(data_dir, session_id);
    if let Ok(bytes) = fs::read(&path) {
        if let Ok(session) = serde_json::from_slice(&bytes) {
            return session;
        }
    }
    ChatSession {
        session_id: session_id.to_owned(),
        messages: Vec::new(),
    }
}

pub fn save_session(data_dir: &Path, session: &ChatSession) {
    let dir = data_dir.join("chat");
    let _ = fs::create_dir_all(&dir);
    let path = session_path(data_dir, &session.session_id);
    if let Ok(json) = serde_json::to_string_pretty(session) {
        let _ = fs::write(path, json);
    }
}

pub fn build_system_prompt(data_dir: &Path, root: &Path) -> String {
    let platform = format!("{}/{}", std::env::consts::OS, std::env::consts::ARCH);

    let mut modules_list = String::new();
    let modules_dir = data_dir.join("modules");
    if let Ok(dir) = fs::read_dir(&modules_dir) {
        for entry in dir.flatten() {
            if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                continue;
            }
            if let Ok(vpk_files) = fs::read_dir(entry.path()) {
                for vpk in vpk_files.flatten() {
                    let p = vpk.path();
                    if p.extension().and_then(|e| e.to_str()) == Some("vpk") {
                        if let Ok(bytes) = fs::read(&p) {
                            if let Ok(pkg) = ModulePackage::decode(&bytes) {
                                let id = String::from_utf8_lossy(pkg.id);
                                modules_list.push_str(&format!(
                                    "  - {} v{}.{}.{} ({:?}/{:?}) {}B\n",
                                    id, pkg.version.major, pkg.version.minor, pkg.version.patch,
                                    pkg.mode, pkg.format, bytes.len()
                                ));
                            }
                        }
                    }
                }
            }
        }
    }
    if modules_list.is_empty() {
        modules_list = "  (none)\n".to_string();
    }

    let mut file_tree = String::new();
    if let Ok(dir) = fs::read_dir(root) {
        for entry in dir.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || name == "target" || name == "Cargo.lock" {
                continue;
            }
            let kind = if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                "dir"
            } else {
                "file"
            };
            file_tree.push_str(&format!("  {} {}\n", kind, name));
        }
    }

    format!(
        r#"You are VibeOS AI Agent. You control and improve a Rust modular OS in real-time.

Current system:
- Platform: {platform}
- Installed modules:
{modules_list}
- Project structure:
{file_tree}

Available capabilities: sys:log, sys:store, sys:time, sys:net

You have full control. You can:
1. Generate Rust native modules (cdylib) - output ONLY Rust source code in ```rust blocks
2. Generate VibeBytecode programs
3. Fix and improve existing modules
4. Inspect files and system state

RULES for code generation:
- Entry point: `#[unsafe(no_mangle)] pub unsafe extern "C" fn vibe_module_main(abi: *const VibeAbi) -> i32`
- Import: `use vibeos_core::c_abi::{{VibeAbi, VIBE_MODULE_OK}};`
- Log output: `(abi.log)(abi.context, msg.as_ptr(), msg.len() - 1)` (msg must be null-terminated b"...\0")
- Store: `(abi.store_set)(abi.context, key, key_len, value, value_len)` and `(abi.store_get)(abi.context, key, key_len, out, out_cap, out_len)`
- HTTP: `(abi.http_get)(abi.context, url, url_len, out, out_cap, out_len)` and `(abi.http_post)(abi.context, url, url_len, body, body_len, out, out_cap, out_len)`
- Time: `(abi.time_unix_ms)(abi.context, &mut out_ms)`
- Return VIBE_MODULE_OK (0) on success
- Keep modules small and focused
- Explain what you generate in 1-2 sentences

Be proactive. When the user asks you to build something, generate the code AND explain it."#
    )
}

pub fn extract_code_blocks(text: &str) -> Vec<String> {
    let mut blocks = Vec::new();
    let mut remaining = text;
    while let Some(start) = remaining.find("```rust") {
        let code_start = start + "```rust\n".len();
        if let Some(end) = remaining[code_start..].find("```") {
            let code = remaining[code_start..code_start + end].trim();
            if !code.is_empty() {
                blocks.push(code.to_owned());
            }
            remaining = &remaining[code_start + end + 3..];
        } else {
            break;
        }
    }
    blocks
}

pub fn generate_session_id() -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("chat-{:016x}", ts)
}

pub fn call_ai_chat(
    config: &AiConfig,
    system_prompt: &str,
    messages: &[ChatMessage],
) -> Result<String, String> {
    let mut body_messages = Vec::new();
    for msg in messages {
        body_messages.push(format!(
            r#"{{"role":"{}","content":"{}"}}"#,
            msg.role,
            json_escape(&msg.content)
        ));
    }

    let is_claude = matches!(config.protocol, crate::AiProtocol::ClaudeMessages);
    let body = if is_claude {
        format!(
            r#"{{"model":"{}","max_tokens":4096,"system":"{}","messages":[{}],"stream":false}}"#,
            json_escape(&config.model),
            json_escape(system_prompt),
            body_messages.join(",")
        )
    } else {
        body_messages.insert(0, format!(
            r#"{{"role":"system","content":"{}"}}"#,
            json_escape(system_prompt)
        ));
        format!(
            r#"{{"model":"{}","messages":[{}],"temperature":0.3,"stream":false}}"#,
            json_escape(&config.model),
            body_messages.join(",")
        )
    };

    let url = match config.protocol {
        crate::AiProtocol::OpenAiChat => {
            crate::chat_completions_url(&config.base_url)
        }
        crate::AiProtocol::OpenAiResponses => {
            crate::responses_url(&config.base_url)
        }
        crate::AiProtocol::ClaudeMessages => {
            crate::claude_messages_url(&config.base_url)
        }
    };

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("client error: {e}"))?;

    let is_claude = matches!(config.protocol, crate::AiProtocol::ClaudeMessages);
    let mut request = client.post(&url).header("content-type", "application/json");
    if is_claude {
        request = request.header("x-api-key", &config.api_key);
        request = request.header("anthropic-version", "2023-06-01");
    } else {
        request = request.bearer_auth(&config.api_key);
    }

    let response = request
        .body(body)
        .send()
        .map_err(|e| format!("request error: {e}"))?;
    let status = response.status();
    let text = response
        .text()
        .map_err(|e| format!("response read error: {e}"))?;
    if !status.is_success() {
        return Err(format!("AI returned {status}: {text}"));
    }

    let json: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("json parse error: {e}"))?;

    let content = match config.protocol {
        crate::AiProtocol::OpenAiChat => json
            .pointer("/choices/0/message/content")
            .and_then(serde_json::Value::as_str)
            .map(str::to_owned),
        crate::AiProtocol::OpenAiResponses => json
            .get("output_text")
            .and_then(serde_json::Value::as_str)
            .map(str::to_owned)
            .or_else(|| {
                let output = json.get("output")?;
                let arr = output.as_array()?;
                arr.iter()
                    .flat_map(|item| {
                        item.get("content")
                            .and_then(serde_json::Value::as_array)
                            .into_iter()
                            .flatten()
                    })
                    .filter_map(|c| c.get("text").and_then(serde_json::Value::as_str))
                    .next()
                    .map(str::to_owned)
            }),
        crate::AiProtocol::ClaudeMessages => {
            let content_arr = json.get("content").and_then(serde_json::Value::as_array).ok_or("missing content")?;
            content_arr
                .iter()
                .filter_map(|c| c.get("text").and_then(serde_json::Value::as_str))
                .next()
                .map(str::to_owned)
        }
    };

    content.ok_or_else(|| format!("AI response missing content: {text}"))
}

fn json_escape(input: &str) -> String {
    input
        .chars()
        .flat_map(|c| match c {
            '"' => "\\\"".chars().collect::<Vec<_>>(),
            '\\' => "\\\\".chars().collect(),
            '\n' => "\\n".chars().collect(),
            '\r' => "\\r".chars().collect(),
            '\t' => "\\t".chars().collect(),
            other => vec![other],
        })
        .collect()
}

pub fn query_param_from_str(query: &str, key: &str) -> Option<String> {
    query.split('&').find_map(|part| {
        let (k, v) = part.split_once('=')?;
        if k == key {
            Some(percent_decode_str(v))
        } else {
            None
        }
    })
}

fn percent_decode_str(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => { output.push(b' '); i += 1; }
            b'%' if i + 2 < bytes.len() => {
                if let (Some(h), Some(l)) = (hex_val(bytes[i+1]), hex_val(bytes[i+2])) {
                    output.push((h << 4) | l);
                    i += 3;
                } else {
                    output.push(bytes[i]);
                    i += 1;
                }
            }
            b => { output.push(b); i += 1; }
        }
    }
    String::from_utf8_lossy(&output).into_owned()
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

pub fn handle_chat_endpoint(
    stream: &mut std::net::TcpStream,
    host: &crate::Host,
    body: &[u8],
) -> std::io::Result<()> {
    let body_str = String::from_utf8_lossy(body);

    let message = match crate::form_field(&body_str, "message") {
        Some(m) if !m.trim().is_empty() => m,
        _ => {
            return crate::json_response(stream, 400, r#"{"ok":false,"error":"empty_message"}"#);
        }
    };
    let session_id = crate::form_field(&body_str, "session_id")
        .unwrap_or_else(|| generate_session_id());

    let config = match crate::load_ai_config(host)? {
        Some(c) if c.is_complete() => c,
        _ => {
            return crate::json_response(
                stream,
                400,
                r#"{"ok":false,"error":"AI not configured. Go to /config first."}"#,
            );
        }
    };

    let mut session = load_session(&host.data, &session_id);

    let system_prompt = build_system_prompt(&host.data, &host.root);

    session.messages.push(ChatMessage {
        role: "user".into(),
        content: message.clone(),
        code: None,
        execution: None,
    });

    let ai_response = match call_ai_chat(&config, &system_prompt, &session.messages) {
        Ok(text) => text,
        Err(error) => {
            let err_msg = ChatMessage {
                role: "assistant".into(),
                content: format!("Error: {error}"),
                code: None,
                execution: None,
            };
            session.messages.push(err_msg);
            save_session(&host.data, &session);
            let json = serde_json::to_string(&session).unwrap_or_else(|_| "{}".into());
            return crate::json_response(stream, 200, &json);
        }
    };

    let code_blocks = extract_code_blocks(&ai_response);
    let mut execution_result = None;
    let mut saved_code = None;

    for code in &code_blocks {
        let saved = crate::save_vibe_module(
            host,
            vibeos_core::VibeMode::Ui,
            &message,
            "AI Agent generated",
            code,
        );
        match saved {
            Ok(saved_mod) => {
                saved_code = Some(code.clone());
                match crate::execute_saved_module(host, &saved_mod.path) {
                    Ok(output) => {
                        let out_str = String::from_utf8_lossy(&output).to_string();
                        execution_result = Some(format!("OK: {out_str}"));
                    }
                    Err(error) => {
                        execution_result = Some(format!("ERROR: {error}"));
                    }
                }
            }
            Err(error) => {
                execution_result = Some(format!("COMPILE ERROR: {error}"));
            }
        }
    }

    let exec_display = execution_result.clone().unwrap_or_default();
    let full_response = if exec_display.is_empty() {
        ai_response.clone()
    } else {
        format!("{ai_response}\n\n---\nExecution: {exec_display}")
    };

    session.messages.push(ChatMessage {
        role: "assistant".into(),
        content: full_response,
        code: saved_code,
        execution: execution_result,
    });

    save_session(&host.data, &session);

    let json = serde_json::to_string(&session).unwrap_or_else(|_| "{}".into());
    crate::json_response(stream, 200, &json)
}

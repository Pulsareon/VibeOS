(() => {
  const root = document.querySelector("[data-vibeos-desktop]");
  if (!root) return;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);

  async function api(path, options) {
    try {
      const res = await fetch(path, options);
      return await res.json();
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  function formatBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }

  function formatUptime(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  const nodes = {
    wallpaper: $("[data-wallpaper]", root),
    stage: $("[data-desktop-stage]", root),
    icons: $("[data-desktop-icons]", root),
    layer: $("[data-window-layer]", root),
    dock: $("[data-dock]", root),
    launcher: $("[data-launcher]", root),
    launcherApps: $("[data-launcher-apps]", root),
    launcherSearch: $("[data-launcher-search]", root),
    topSearch: $("[data-search-apps]", root),
    quick: $("[data-quick-panel]", root),
    notificationPanel: $("[data-notification-panel]", root),
    notifications: $("[data-notifications]", root),
    context: $("[data-context-menu]", root),
    toasts: $("[data-toasts]", root),
    clock: $("[data-clock]", root),
    quickClock: $("[data-quick-clock]", root),
  };

  const state = {
    windows: new Map(),
    activeWindow: null,
    z: 40,
    launchOffset: 0,
    wallpaper: Number(localStorage.getItem("vibe.wallpaper") || 0),
    notes: localStorage.getItem("vibe.notes") || "",
    calc: "0",
    calcMemory: "",
    terminalLines: [],
    notifications: JSON.parse(localStorage.getItem("vibe.notifications") || "[]"),
    settings: JSON.parse(localStorage.getItem("vibe.settings") || "{}"),
    fileBrowsePath: ".",
    moduleList: [],
  };

  const appOrder = [
    "vibe",
    "files",
    "terminal",
    "store",
    "calculator",
    "notes",
    "settings",
    "monitor",
    "modules",
  ];

  const appCatalog = {
    vibe: {
      title: "Vibe",
      icon: "AI",
      color: "teal",
      size: [760, 560],
      position: [170, 84],
      desktop: true,
      dock: true,
      render: renderVibe,
      bind: bindVibe,
    },
    files: {
      title: "Files",
      icon: "FS",
      color: "blue",
      size: [760, 520],
      position: [230, 124],
      desktop: true,
      dock: true,
      render: renderFiles,
      bind: bindFiles,
    },
    terminal: {
      title: "Terminal",
      icon: ">_",
      color: "green",
      size: [760, 460],
      position: [220, 178],
      desktop: true,
      dock: true,
      render: renderTerminal,
      bind: bindTerminal,
    },
    store: {
      title: "App Store",
      icon: "APP",
      color: "orange",
      size: [820, 560],
      position: [190, 108],
      desktop: true,
      dock: true,
      render: renderStore,
      bind: bindStore,
    },
    calculator: {
      title: "Calculator",
      icon: "123",
      color: "red",
      size: [360, 520],
      position: [930, 108],
      desktop: true,
      dock: true,
      render: renderCalculator,
      bind: bindCalculator,
    },
    notes: {
      title: "Notes",
      icon: "TXT",
      color: "yellow",
      size: [520, 560],
      position: [760, 188],
      desktop: true,
      dock: true,
      render: renderNotes,
      bind: bindNotes,
    },
    settings: {
      title: "Settings",
      icon: "CFG",
      color: "gray",
      size: [620, 500],
      position: [790, 126],
      desktop: true,
      dock: true,
      render: renderSettings,
      bind: bindSettings,
    },
    monitor: {
      title: "Monitor",
      icon: "CPU",
      color: "purple",
      size: [640, 500],
      position: [680, 220],
      desktop: true,
      dock: false,
      render: renderMonitor,
      bind: bindMonitor,
    },
    modules: {
      title: "Modules",
      icon: "VPK",
      color: "teal",
      size: [720, 500],
      position: [300, 170],
      desktop: true,
      dock: false,
      render: renderModules,
      bind: bindModules,
    },
  };

  function appIcon(app) {
    return `<span class="app-icon app-icon-${app.color}">${escapeHtml(app.icon)}</span>`;
  }

  function renderDesktop() {
    nodes.wallpaper.dataset.wallpaper = String(state.wallpaper);
    nodes.icons.innerHTML = appOrder
      .filter((id) => appCatalog[id].desktop)
      .map((id) => {
        const app = appCatalog[id];
        return `<button class="desktop-app" type="button" data-app-id="${id}">
          ${appIcon(app)}
          <span>${escapeHtml(app.title)}</span>
        </button>`;
      })
      .join("");

    nodes.dock.innerHTML = [
      `<button class="dock-launcher" type="button" data-action="launcher" aria-label="Launcher">${appIcon({ icon: "V", color: "teal" })}</button>`,
      ...appOrder
        .filter((id) => appCatalog[id].dock)
        .map((id) => `<button class="dock-app" type="button" data-open="${id}" title="${escapeHtml(appCatalog[id].title)}">${appIcon(appCatalog[id])}<span>${escapeHtml(appCatalog[id].title)}</span></button>`),
    ].join("");

    renderLauncher("");
    renderNotifications();
    applySettings();
  }

  function renderLauncher(filter) {
    const needle = filter.trim().toLowerCase();
    nodes.launcherApps.innerHTML = appOrder
      .filter((id) => {
        const app = appCatalog[id];
        return !needle || app.title.toLowerCase().includes(needle) || id.includes(needle);
      })
      .map((id) => {
        const app = appCatalog[id];
        return `<button type="button" data-open="${id}">
          ${appIcon(app)}
          <strong>${escapeHtml(app.title)}</strong>
        </button>`;
      })
      .join("");
  }

  function openWindow(id) {
    const app = appCatalog[id];
    if (!app) return;
    let win = state.windows.get(id);
    if (!win) {
      win = createWindow(id, app);
      state.windows.set(id, win);
      nodes.layer.append(win);
      app.bind?.(win);
    }
    win.hidden = false;
    win.classList.remove("is-minimized");
    focusWindow(id);
    updateDock();
    closePanels();
  }

  function createWindow(id, app) {
    const [width, height] = app.size;
    const offset = state.launchOffset++ % 8;
    const [left, top] = app.position || [150 + offset * 32, 78 + offset * 26];
    const win = document.createElement("article");
    win.className = "os-window";
    win.dataset.windowId = id;
    win.style.width = `${width}px`;
    win.style.height = `${height}px`;
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
    win.innerHTML = `
      <header class="window-bar" data-drag-handle>
        <div class="window-title">${appIcon(app)}<strong>${escapeHtml(app.title)}</strong></div>
        <div class="window-actions">
          <button type="button" data-window-command="minimize" aria-label="Minimize">-</button>
          <button type="button" data-window-command="maximize" aria-label="Maximize">[]</button>
          <button type="button" data-window-command="close" aria-label="Close">x</button>
        </div>
      </header>
      <section class="window-content">${app.render()}</section>
      <span class="resize-handle" data-resize-handle></span>`;
    bindWindow(win);
    return win;
  }

  function focusWindow(id) {
    const win = state.windows.get(id);
    if (!win) return;
    $$(".os-window.is-active", nodes.layer).forEach((item) => item.classList.remove("is-active"));
    win.classList.add("is-active");
    win.style.zIndex = String(++state.z);
    state.activeWindow = id;
    updateDock();
  }

  function closeWindow(id) {
    const win = state.windows.get(id);
    if (!win) return;
    win.remove();
    state.windows.delete(id);
    if (state.activeWindow === id) state.activeWindow = null;
    updateDock();
  }

  function minimizeWindow(id) {
    const win = state.windows.get(id);
    if (!win) return;
    win.classList.add("is-minimized");
    win.hidden = true;
    if (state.activeWindow === id) state.activeWindow = null;
    updateDock();
  }

  function toggleMaximize(id) {
    const win = state.windows.get(id);
    if (!win) return;
    win.classList.toggle("is-maximized");
    focusWindow(id);
  }

  function updateDock() {
    $$("[data-open]", nodes.dock).forEach((button) => {
      const id = button.dataset.open;
      const win = state.windows.get(id);
      button.classList.toggle("is-running", Boolean(win));
      button.classList.toggle("is-active", state.activeWindow === id);
    });
  }

  function bindWindow(win) {
    const id = win.dataset.windowId;
    win.addEventListener("pointerdown", () => focusWindow(id));
    win.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      openContextMenu(event, [
        ["Minimize", () => minimizeWindow(id)],
        ["Maximize", () => toggleMaximize(id)],
        ["Close", () => closeWindow(id)],
      ]);
    });

    $("[data-drag-handle]", win).addEventListener("pointerdown", (event) => startDrag(event, win));
    $("[data-resize-handle]", win).addEventListener("pointerdown", (event) => startResize(event, win));
    $$("[data-window-command]", win).forEach((button) => {
      button.addEventListener("click", () => {
        const command = button.dataset.windowCommand;
        if (command === "minimize") minimizeWindow(id);
        if (command === "maximize") toggleMaximize(id);
        if (command === "close") closeWindow(id);
      });
    });
  }

  function startDrag(event, win) {
    if (event.button !== 0 || win.classList.contains("is-maximized")) return;
    event.preventDefault();
    const rect = win.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const move = (moveEvent) => {
      const maxLeft = window.innerWidth - Math.min(220, rect.width);
      const maxTop = window.innerHeight - 100;
      win.style.left = `${Math.min(Math.max(8, moveEvent.clientX - offsetX), maxLeft)}px`;
      win.style.top = `${Math.min(Math.max(48, moveEvent.clientY - offsetY), maxTop)}px`;
    };
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  function startResize(event, win) {
    if (event.button !== 0 || win.classList.contains("is-maximized")) return;
    event.preventDefault();
    const rect = win.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const move = (moveEvent) => {
      win.style.width = `${Math.max(320, rect.width + moveEvent.clientX - startX)}px`;
      win.style.height = `${Math.max(240, rect.height + moveEvent.clientY - startY)}px`;
    };
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  function toggleLauncher(force) {
    nodes.launcher.hidden = typeof force === "boolean" ? !force : !nodes.launcher.hidden;
    nodes.quick.hidden = true;
    nodes.notificationPanel.hidden = true;
    nodes.context.hidden = true;
    if (!nodes.launcher.hidden) nodes.launcherSearch.focus();
  }

  function toggleQuick() {
    nodes.quick.hidden = !nodes.quick.hidden;
    nodes.launcher.hidden = true;
    nodes.notificationPanel.hidden = true;
    nodes.context.hidden = true;
  }

  function toggleNotifications() {
    nodes.notificationPanel.hidden = !nodes.notificationPanel.hidden;
    nodes.launcher.hidden = true;
    nodes.quick.hidden = true;
    nodes.context.hidden = true;
  }

  function closePanels() {
    nodes.launcher.hidden = true;
    nodes.quick.hidden = true;
    nodes.notificationPanel.hidden = true;
    nodes.context.hidden = true;
  }

  function openContextMenu(event, items) {
    nodes.context.innerHTML = items
      .map((item, index) => `<button type="button" data-context-index="${index}">${escapeHtml(item[0])}</button>`)
      .join("");
    nodes.context.hidden = false;
    const width = 220;
    const height = items.length * 38 + 16;
    nodes.context.style.left = `${Math.min(event.clientX, window.innerWidth - width - 8)}px`;
    nodes.context.style.top = `${Math.min(event.clientY, window.innerHeight - height - 8)}px`;
    nodes.context.dataset.actions = "";
    nodes.context._actions = items.map((item) => item[1]);
  }

  function notify(message) {
    const entry = {
      message,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    state.notifications.unshift(entry);
    state.notifications = state.notifications.slice(0, 12);
    localStorage.setItem("vibe.notifications", JSON.stringify(state.notifications));
    renderNotifications();
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    nodes.toasts.append(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    setTimeout(() => {
      toast.classList.remove("is-visible");
      setTimeout(() => toast.remove(), 180);
    }, 2200);
  }

  function renderNotifications() {
    nodes.notifications.innerHTML = state.notifications.length
      ? state.notifications
          .map((item) => `<article><strong>${escapeHtml(item.message)}</strong><span>${escapeHtml(item.time)}</span></article>`)
          .join("")
      : `<article><strong>No notifications</strong><span>VibeOS</span></article>`;
  }

  function applySettings() {
    document.body.classList.toggle("is-compact", Boolean(state.settings.compact));
    document.body.classList.toggle("is-focus", Boolean(state.settings.focus));
    document.body.classList.toggle("is-muted", Boolean(state.settings.muted));
  }

  function saveSettings() {
    localStorage.setItem("vibe.settings", JSON.stringify(state.settings));
    applySettings();
  }

  function updateClock() {
    const value = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
    nodes.clock.textContent = value;
    nodes.quickClock.textContent = value;
  }

  function renderVibe() {
    return `
      <form class="vibe-app" method="post" action="/vibe" data-vibe-form>
        <div class="segmented">
          <label><input type="radio" name="mode" value="ui" checked><span>UI App</span></label>
          <label><input type="radio" name="mode" value="cli"><span>Command</span></label>
          <label><input type="radio" name="mode" value="fix"><span>Fix</span></label>
        </div>
        <textarea name="intent" required placeholder="Create a file manager with right-click rename and delete"></textarea>
        <div class="suggestion-row">
          <button type="button" data-prompt="Create a calendar app with month view, events, reminders, and right-click edit">Calendar</button>
          <button type="button" data-prompt="Create a music player with playlists, search, queue, and volume controls">Music</button>
          <button type="button" data-prompt="Create a screenshot tool with crop, annotate, save, and copy">Screenshot</button>
          <button type="button" data-prompt="Fix the last generated module and keep its app icon, state, and shortcuts">Repair</button>
        </div>
        <footer>
          <a href="/config">Endpoint</a>
          <button class="primary" type="submit">Generate</button>
        </footer>
      </form>`;
  }

  function bindVibe(win) {
    $$("[data-prompt]", win).forEach((button) => {
      button.addEventListener("click", () => {
        const textarea = $("textarea", win);
        textarea.value = button.dataset.prompt;
        textarea.focus();
        if (button.textContent === "Repair") $("input[value='fix']", win).checked = true;
      });
    });
    $("[data-vibe-form]", win).addEventListener("submit", (e) => {
      const intent = $("textarea", win).value.trim();
      if (intent) {
        localStorage.setItem("vibe.lastIntent", intent);
        notify("Vibe request sent");
      }
    });
  }

  function renderFiles() {
    return `<div class="files-app">
      <aside>
        <button class="is-active" type="button" data-fs-nav=".">Home</button>
        <button type="button" data-fs-nav="data/modules">Modules</button>
        <button type="button" data-fs-nav="core">System</button>
        <button type="button" data-fs-nav="assets">Assets</button>
      </aside>
      <section>
        <header>
          <span class="file-breadcrumb" data-file-breadcrumb>.</span>
          <button type="button" data-file-up>Up</button>
        </header>
        <div class="file-table" data-file-table>
          <div class="file-loading">Loading...</div>
        </div>
      </section>
    </div>`;
  }

  async function loadFiles(win, path) {
    state.fileBrowsePath = path || ".";
    const table = $("[data-file-table]", win);
    const breadcrumb = $("[data-file-breadcrumb]", win);
    if (breadcrumb) breadcrumb.textContent = state.fileBrowsePath;
    table.innerHTML = `<div class="file-loading">Loading...</div>`;
    const data = await api(`/api/files?path=${encodeURIComponent(state.fileBrowsePath)}`);
    if (!data || !Array.isArray(data)) {
      table.innerHTML = `<div class="file-loading">Failed to load</div>`;
      return;
    }
    const dirs = data.filter((e) => e.is_dir).sort((a, b) => a.name.localeCompare(b.name));
    const files = data.filter((e) => !e.is_dir).sort((a, b) => a.name.localeCompare(b.name));
    const sorted = [...dirs, ...files];
    if (sorted.length === 0) {
      table.innerHTML = `<div class="file-loading">Empty directory</div>`;
      return;
    }
    table.innerHTML = sorted
      .map((entry) => {
        const kind = entry.is_dir ? "DIR" : "FILE";
        const detail = entry.is_dir ? "Folder" : formatBytes(entry.size || 0);
        return `<button class="file-row" type="button" data-file="${escapeHtml(entry.name)}" data-is-dir="${entry.is_dir}">
          <span class="file-kind">${kind}</span>
          <strong>${escapeHtml(entry.name)}</strong>
          <span>${detail}</span>
        </button>`;
      })
      .join("");
    bindFileRows(win);
  }

  function bindFileRows(win) {
    $$(".file-row", win).forEach((row) => {
      row.addEventListener("click", () => {
        const name = row.dataset.file;
        const isDir = row.dataset.isDir === "true";
        if (isDir) {
          const newPath = state.fileBrowsePath === "." ? name : `${state.fileBrowsePath}/${name}`;
          loadFiles(win, newPath);
        } else {
          notify(`${name} selected`);
        }
      });
      row.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        const name = row.dataset.file;
        openContextMenu(event, [
          ["Open", () => notify(`${name} opened`)],
          ["Copy path", () => {
            const full = state.fileBrowsePath === "." ? name : `${state.fileBrowsePath}/${name}`;
            navigator.clipboard?.writeText(full);
            notify("Path copied");
          }],
          ["Properties", () => notify(`${name} properties`)],
        ]);
      });
    });
  }

  function bindFiles(win) {
    loadFiles(win, ".");
    $("[data-file-up]", win).addEventListener("click", () => {
      const parts = state.fileBrowsePath.split("/");
      if (parts.length > 1) {
        parts.pop();
        loadFiles(win, parts.join("/") || ".");
      }
    });
    $$("[data-fs-nav]", win).forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("[data-fs-nav]", win).forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        loadFiles(win, btn.dataset.fsNav);
      });
    });
  }

  function renderTerminal() {
    return `<div class="terminal-app">
      <div class="terminal-output" data-terminal-output></div>
      <form data-terminal-form>
        <label>vibe@device:~$</label>
        <input name="command" autocomplete="off" spellcheck="false">
      </form>
    </div>`;
  }

  function bindTerminal(win) {
    const output = $("[data-terminal-output]", win);
    const form = $("[data-terminal-form]", win);
    const input = $("input", form);
    const history = [];
    let historyIndex = -1;

    const append = (line, cls) => {
      const p = document.createElement("p");
      if (cls) p.className = cls;
      p.textContent = line;
      output.append(p);
      output.scrollTop = output.scrollHeight;
    };

    const appendHtml = (html) => {
      const p = document.createElement("p");
      p.innerHTML = html;
      output.append(p);
      output.scrollTop = output.scrollHeight;
    };

    append("VibeOS terminal v1.0");
    append("Type 'help' for available commands.\n");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const command = input.value.trim();
      if (!command) return;
      history.push(command);
      historyIndex = history.length;
      input.value = "";
      append(`vibe@device:~$ ${command}`);

      const parts = command.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1).join(" ");

      if (cmd === "clear") {
        output.replaceChildren();
        return;
      }
      if (cmd === "help") {
        append("Available commands:");
        append("  help              Show this help");
        append("  clear             Clear terminal");
        append("  ls [path]         List files in directory");
        append("  cat <file>        Show file content");
        append("  modules           List installed modules");
        append("  run <module>      Execute a module");
        append("  delete <module>   Delete a module");
        append("  health            Check server health");
        append("  monitor           Show system info");
        append("  config            Show AI configuration");
        append("  vibe              Open Vibe generator");
        append("  apps              List available apps");
        append("  open <app>        Open an application");
        append("  echo <text>       Print text");
        append("");
        return;
      }
      if (cmd === "ls") {
        const path = args || ".";
        const data = await api(`/api/files?path=${encodeURIComponent(path)}`);
        if (!data || !Array.isArray(data)) {
          append("Error: failed to list files", "err");
          return;
        }
        if (data.length === 0) {
          append("(empty directory)");
          return;
        }
        const lines = data.map((e) => {
          const size = e.is_dir ? "" : `  ${formatBytes(e.size || 0)}`;
          const name = e.is_dir ? `${e.name}/` : e.name;
          return `  ${name}${size}`;
        });
        appendHtml(lines.map((l) => escapeHtml(l).replace(/\/$/, '<span class="t-dir">$&</span>')).join("\n"));
        return;
      }
      if (cmd === "cat") {
        if (!args) { append("Usage: cat <file>", "err"); return; }
        append(`(file content of ${args} would display here)`);
        append("Note: file viewing is read-only in this version");
        return;
      }
      if (cmd === "modules") {
        const data = await api("/api/modules");
        if (!data || !Array.isArray(data) || data.length === 0) {
          append("No modules installed.");
          append("Use 'vibe' to generate a new module.");
          return;
        }
        append(`Installed modules (${data.length}):`);
        data.forEach((m) => {
          append(`  ${m.id}  v${m.version}  ${m.mode}  ${m.format}  ${m.bytes}B`);
        });
        append("");
        return;
      }
      if (cmd === "run") {
        if (!args) { append("Usage: run <module_path>", "err"); return; }
        append("Executing...");
        const data = await api("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `path=${encodeURIComponent(args)}`,
        });
        if (data?.ok) {
          append(`Output: ${data.output}`);
        } else {
          append(`Error: ${data?.error || "execution failed"}`, "err");
        }
        return;
      }
      if (cmd === "delete") {
        if (!args) { append("Usage: delete <module_id> <version>", "err"); return; }
        const delParts = args.split(/\s+/);
        const id = delParts[0];
        const version = delParts[1] || "1.0.0";
        const data = await api(`/api/modules?id=${encodeURIComponent(id)}&version=${encodeURIComponent(version)}`, { method: "DELETE" });
        if (data?.ok) {
          append(`Module ${id} v${version} deleted.`);
        } else {
          append(`Error: ${data?.error || "delete failed"}`, "err");
        }
        return;
      }
      if (cmd === "health") {
        const data = await api("/api/health");
        append(data ? JSON.stringify(data) : "Server unreachable");
        return;
      }
      if (cmd === "monitor") {
        const data = await api("/api/monitor");
        if (!data || data.error) {
          append("Error: failed to get monitor data", "err");
          return;
        }
        append(`Platform:   ${data.platform}`);
        append(`PID:        ${data.pid}`);
        append(`Uptime:     ${formatUptime(data.uptime_secs)}`);
        append(`Modules:    ${data.module_count}`);
        append(`Data dir:   ${data.data_dir}`);
        append("");
        return;
      }
      if (cmd === "config") {
        const data = await api("/api/config");
        if (!data || data.error) {
          append("Error: failed to get config", "err");
          return;
        }
        append(`Protocol:   ${data.protocol}`);
        append(`Base URL:   ${data.base_url || "(not set)"}`);
        append(`Model:      ${data.model || "(not set)"}`);
        append(`API Key:    ${data.has_key ? "configured" : "not set"}`);
        append("");
        return;
      }
      if (cmd === "vibe") { openWindow("vibe"); return; }
      if (cmd === "apps") {
        append(appOrder.map((id) => `${id} (${appCatalog[id].title})`).join(", "));
        return;
      }
      if (cmd === "open") {
        const target = args.toLowerCase().replace(/\s+/g, "-");
        const id = appOrder.find((c) => c === target || appCatalog[c].title.toLowerCase().replace(/\s+/g, "-") === target);
        if (id) { openWindow(id); append(`${appCatalog[id].title} opened`); }
        else append(`unknown app: ${target}`, "err");
        return;
      }
      if (cmd === "echo") { append(args); return; }
      append(`unknown command: ${command}`, "err");
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (historyIndex > 0) { historyIndex--; input.value = history[historyIndex]; }
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex < history.length - 1) { historyIndex++; input.value = history[historyIndex]; }
        else { historyIndex = history.length; input.value = ""; }
      }
    });
  }

  function renderStore() {
    const templates = [
      ["Calendar", "ui", "Create a calendar app with month view, events, reminders, and right-click edit"],
      ["Photos", "ui", "Create a photo viewer with albums, crop, rotate, tags, and slideshow"],
      ["Music", "ui", "Create a music player with library, playlists, queue, equalizer, and mini player"],
      ["Mail", "ui", "Create an email client with inbox, compose, search, labels, and local draft cache"],
      ["File Manager", "ui", "Create a file manager with tree view, breadcrumb, rename, delete, and new folder"],
      ["Cleaner", "cli", "Create a command that scans generated modules and prints storage cleanup suggestions"],
      ["Module Fixer", "fix", "Repair the last broken module and produce a versioned replacement"],
    ];
    return `<div class="store-app">
      ${templates.map(([name, mode, intent]) => `
        <form method="post" action="/vibe" class="store-card">
          <input type="hidden" name="mode" value="${mode}">
          <input type="hidden" name="intent" value="${escapeHtml(intent)}">
          <strong>${escapeHtml(name)}</strong>
          <span>${mode.toUpperCase()}</span>
          <button type="submit">Generate</button>
        </form>`).join("")}
    </div>`;
  }

  function bindStore(win) {
    $$("form", win).forEach((form) => {
      form.addEventListener("submit", () => notify(`${$("strong", form).textContent} request sent`));
    });
  }

  function renderCalculator() {
    const buttons = ["C", "DEL", "%", "/", "7", "8", "9", "*", "4", "5", "6", "-", "1", "2", "3", "+", "0", ".", "=", ""];
    return `<div class="calculator-app">
      <output data-calc-output>${escapeHtml(state.calc)}</output>
      <div class="calc-grid">
        ${buttons.filter(Boolean).map((button) => `<button type="button" data-calc="${button}">${button}</button>`).join("")}
      </div>
      <div class="calc-history" data-calc-history>${escapeHtml(state.calcMemory)}</div>
    </div>`;
  }

  function bindCalculator(win) {
    const output = $("[data-calc-output]", win);
    const history = $("[data-calc-history]", win);
    const commit = (value) => {
      state.calc = value || "0";
      output.textContent = state.calc;
    };
    $$("[data-calc]", win).forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.dataset.calc;
        if (value === "C") {
          state.calcMemory = "";
          history.textContent = "";
          commit("0");
        } else if (value === "DEL") {
          commit(state.calc.length > 1 ? state.calc.slice(0, -1) : "0");
        } else if (value === "=") {
          try {
            if (!/^[0-9+\-*/%. ()]+$/.test(state.calc)) throw new Error();
            const result = Function(`"use strict";return (${state.calc})`)();
            state.calcMemory = `${state.calc} = ${result}`;
            history.textContent = state.calcMemory;
            commit(String(result));
          } catch {
            commit("Error");
          }
        } else {
          commit(state.calc === "0" || state.calc === "Error" ? value : state.calc + value);
        }
      });
    });
  }

  function renderNotes() {
    return `<div class="notes-app">
      <textarea data-note-text spellcheck="true">${escapeHtml(state.notes)}</textarea>
      <footer><span data-note-status>Saved locally</span><button type="button" data-note-clear>Clear</button></footer>
    </div>`;
  }

  function bindNotes(win) {
    const textarea = $("[data-note-text]", win);
    const status = $("[data-note-status]", win);
    textarea.addEventListener("input", () => {
      state.notes = textarea.value;
      localStorage.setItem("vibe.notes", state.notes);
      status.textContent = "Saved locally";
    });
    $("[data-note-clear]", win).addEventListener("click", () => {
      textarea.value = "";
      textarea.dispatchEvent(new Event("input"));
    });
  }

  function renderSettings() {
    const checked = (key) => (state.settings[key] ? "checked" : "");
    return `<div class="settings-app">
      <section>
        <h3>Appearance</h3>
        <label><span>Compact dock</span><input type="checkbox" data-setting="compact" ${checked("compact")}></label>
        <label><span>Focus wallpaper</span><input type="checkbox" data-setting="focus" ${checked("focus")}></label>
        <label><span>Mute sounds</span><input type="checkbox" data-setting="muted" ${checked("muted")}></label>
      </section>
      <section>
        <h3>System</h3>
        <a href="/config">AI endpoint</a>
        <a href="/tty">TTY</a>
        <a href="/api/health">Health</a>
      </section>
    </div>`;
  }

  function bindSettings(win) {
    $$("[data-setting]", win).forEach((input) => {
      input.addEventListener("change", () => {
        state.settings[input.dataset.setting] = input.checked;
        saveSettings();
      });
    });
  }

  function renderMonitor() {
    return `<div class="monitor-app" data-monitor>
      <div class="monitor-loading">Loading system info...</div>
    </div>`;
  }

  async function loadMonitor(win) {
    const container = $("[data-monitor]", win);
    const data = await api("/api/monitor");
    if (!data || data.error) {
      container.innerHTML = `<div class="monitor-loading">Failed to load</div>`;
      return;
    }
    container.innerHTML = `
      <div class="monitor-row"><span>Platform</span><strong>${escapeHtml(data.platform)}</strong></div>
      <div class="monitor-row"><span>PID</span><strong>${data.pid}</strong></div>
      <div class="monitor-row"><span>Uptime</span><strong>${formatUptime(data.uptime_secs)}</strong></div>
      <div class="monitor-row"><span>Modules</span><strong>${data.module_count}</strong></div>
      <div class="monitor-row"><span>Data Dir</span><strong>${escapeHtml(data.data_dir)}</strong></div>
    `;
  }

  function bindMonitor(win) {
    loadMonitor(win);
    const timer = setInterval(() => loadMonitor(win), 5000);
    win.addEventListener("remove", () => clearInterval(timer), { once: true });
  }

  function renderModules() {
    return `<div class="modules-app">
      <header><strong>Installed Modules</strong><button type="button" data-open="vibe">New</button></header>
      <div class="module-loading">Loading modules...</div>
    </div>`;
  }

  async function loadModules(win) {
    const container = $("[data-modules-list]", win) || $(".modules-app", win);
    const data = await api("/api/modules");
    const listDiv = container.querySelector(".module-loading") || container;
    if (!data || !Array.isArray(data) || data.length === 0) {
      listDiv.outerHTML = `<div class="module-row module-empty"><span>empty</span><strong>No modules installed yet</strong><em>-</em></div>`;
      return;
    }
    state.moduleList = data;
    const html = data
      .map(
        (m) => `<div class="module-row" data-module-path="${escapeHtml(m.path)}" data-module-id="${escapeHtml(m.id)}" data-module-version="${escapeHtml(m.version)}">
        <span>${escapeHtml(m.mode)}</span>
        <strong>${escapeHtml(m.id)} v${escapeHtml(m.version)}</strong>
        <em>${m.bytes}B</em>
        <button type="button" class="module-run" data-module-path="${escapeHtml(m.path)}">Run</button>
        <button type="button" class="module-delete" data-module-id="${escapeHtml(m.id)}" data-module-version="${escapeHtml(m.version)}">Del</button>
      </div>`
      )
      .join("");
    listDiv.outerHTML = html;
    bindModuleActions(win);
  }

  function bindModuleActions(win) {
    $$(".module-run", win).forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const path = btn.dataset.modulePath;
        notify("Executing module...");
        const data = await api("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `path=${encodeURIComponent(path)}`,
        });
        if (data?.ok) {
          notify(`Output: ${data.output}`);
        } else {
          notify(`Error: ${data?.error || "failed"}`);
        }
      });
    });
    $$(".module-delete", win).forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.moduleId;
        const version = btn.dataset.moduleVersion;
        if (!confirm(`Delete module ${id} v${version}?`)) return;
        const data = await api(`/api/modules?id=${encodeURIComponent(id)}&version=${encodeURIComponent(version)}`, { method: "DELETE" });
        if (data?.ok) {
          notify(`Module ${id} deleted`);
          loadModules(win);
        } else {
          notify(`Delete failed: ${data?.error || "unknown"}`);
        }
      });
    });
  }

  function bindModules(win) {
    loadModules(win);
  }

  nodes.icons.addEventListener("click", (event) => {
    const button = event.target.closest("[data-app-id]");
    if (button) openWindow(button.dataset.appId);
  });

  nodes.icons.addEventListener("contextmenu", (event) => {
    const button = event.target.closest("[data-app-id]");
    if (!button) return;
    event.preventDefault();
    const id = button.dataset.appId;
    openContextMenu(event, [
      ["Open", () => openWindow(id)],
      ["Pin to dock", () => notify(`${appCatalog[id].title} pinned`)],
      ["Properties", () => notify(`${appCatalog[id].title} properties`)],
    ]);
  });

  nodes.stage.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".os-window") || event.target.closest("[data-app-id]")) return;
    event.preventDefault();
    openContextMenu(event, [
      ["Open Vibe", () => openWindow("vibe")],
      ["New note", () => openWindow("notes")],
      ["Change wallpaper", cycleWallpaper],
      ["Settings", () => openWindow("settings")],
    ]);
  });

  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    const open = event.target.closest("[data-open]")?.dataset.open;
    const context = event.target.closest("[data-context-index]");
    const toggle = event.target.closest("[data-toggle-class]")?.dataset.toggleClass;

    if (context) {
      const fn = nodes.context._actions?.[Number(context.dataset.contextIndex)];
      nodes.context.hidden = true;
      fn?.();
      return;
    }
    if (open) {
      openWindow(open);
      return;
    }
    if (toggle) {
      const key = toggle.replace(/^is-/, "");
      state.settings[key] = !state.settings[key];
      saveSettings();
      event.target.classList.toggle("is-active", state.settings[key]);
      return;
    }
    if (action === "launcher") toggleLauncher();
    else if (action === "quick-settings") toggleQuick();
    else if (action === "notifications") toggleNotifications();
    else if (action === "cycle-wallpaper") cycleWallpaper();
    else if (action === "clear-notifications") {
      state.notifications = [];
      localStorage.removeItem("vibe.notifications");
      renderNotifications();
    } else if (!event.target.closest(".launcher-panel,.quick-panel,.notification-panel,.context-menu,.dock")) {
      closePanels();
    }
  });

  function cycleWallpaper() {
    state.wallpaper = (state.wallpaper + 1) % 4;
    nodes.wallpaper.dataset.wallpaper = String(state.wallpaper);
    localStorage.setItem("vibe.wallpaper", String(state.wallpaper));
    notify("Wallpaper changed");
  }

  nodes.launcherSearch.addEventListener("input", () => renderLauncher(nodes.launcherSearch.value));
  nodes.topSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const value = nodes.topSearch.value.trim().toLowerCase();
      if (!value) return;
      const id = appOrder.find((candidate) => appCatalog[candidate].title.toLowerCase().includes(value) || candidate.includes(value));
      if (id) openWindow(id);
      nodes.topSearch.value = "";
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePanels();
    if (event.ctrlKey && event.code === "Space") {
      event.preventDefault();
      toggleLauncher(true);
    }
    if (event.ctrlKey && event.key === "`") {
      event.preventDefault();
      openWindow("terminal");
    }
  });

  renderDesktop();
  updateClock();
  const openHash = new URLSearchParams(location.hash.replace(/^#/, "")).get("open");
  if (openHash) {
    openHash
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach(openWindow);
  }
  setInterval(updateClock, 20_000);
  notify("VibeOS ready");
})();

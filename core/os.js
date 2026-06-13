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
    terminalLines: ["VibeOS terminal ready.", "Commands: help, apps, open, health, clear."],
    notifications: JSON.parse(localStorage.getItem("vibe.notifications") || "[]"),
    settings: JSON.parse(localStorage.getItem("vibe.settings") || "{}"),
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
    $("[data-vibe-form]", win).addEventListener("submit", () => {
      const intent = $("textarea", win).value.trim();
      if (intent) {
        localStorage.setItem("vibe.lastIntent", intent);
        notify("Vibe request sent");
      }
    });
  }

  function renderFiles() {
    const rows = [
      ["Desktop", "folder", "Built-in apps and generated modules"],
      ["data/modules", "folder", "Saved VPK packages"],
      ["ai.conf", "config", "Endpoint settings"],
      ["core/os.js", "file", "Desktop runtime"],
      ["core/os.css", "file", "System style"],
      ["manifest.webmanifest", "file", "Install metadata"],
    ];
    return `<div class="files-app">
      <aside>
        <button class="is-active" type="button">Home</button>
        <button type="button">Modules</button>
        <button type="button">System</button>
        <button type="button">Devices</button>
      </aside>
      <section>
        <header><input placeholder="Search files" data-file-search><button type="button" data-open="modules">Modules</button></header>
        <div class="file-table" data-file-table>
          ${rows.map((row) => fileRow(row)).join("")}
        </div>
      </section>
    </div>`;
  }

  function fileRow([name, kind, detail]) {
    return `<button class="file-row" type="button" data-file="${escapeHtml(name)}">
      <span class="file-kind">${kind === "folder" ? "DIR" : kind === "config" ? "CFG" : "FILE"}</span>
      <strong>${escapeHtml(name)}</strong>
      <span>${escapeHtml(detail)}</span>
    </button>`;
  }

  function bindFiles(win) {
    $$(".file-row", win).forEach((row) => {
      row.addEventListener("click", () => notify(`${row.dataset.file} selected`));
      row.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        openContextMenu(event, [
          ["Open", () => notify(`${row.dataset.file} opened`)],
          ["Rename", () => notify("Rename queued")],
          ["Copy path", () => navigator.clipboard?.writeText(row.dataset.file)],
          ["Properties", () => notify(`${row.dataset.file} properties`)],
        ]);
      });
    });
  }

  function renderTerminal() {
    return `<div class="terminal-app">
      <div class="terminal-output" data-terminal-output>
        ${state.terminalLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
      </div>
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
    const append = (line) => {
      state.terminalLines.push(line);
      const p = document.createElement("p");
      p.textContent = line;
      output.append(p);
      output.scrollTop = output.scrollHeight;
    };
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const command = input.value.trim();
      if (!command) return;
      input.value = "";
      append(`vibe@device:~$ ${command}`);
      const normalized = command.toLowerCase();
      if (normalized === "clear") {
        state.terminalLines = [];
        output.replaceChildren();
        return;
      }
      if (normalized === "help") append("help, apps, open <app>, health, vibe, clear");
      else if (normalized === "apps") append(appOrder.map((id) => appCatalog[id].title).join(", "));
      else if (normalized === "vibe") openWindow("vibe");
      else if (normalized === "health") {
        try {
          const response = await fetch("/api/health");
          append(await response.text());
        } catch {
          append("health check failed");
        }
      } else if (normalized.startsWith("open ")) {
        const target = normalized.slice(5).replace(/\s+/g, "-");
        const id = appOrder.find((candidate) => candidate === target || appCatalog[candidate].title.toLowerCase().replace(/\s+/g, "-") === target);
        if (id) {
          openWindow(id);
          append(`${appCatalog[id].title} opened`);
        } else append(`unknown app: ${target}`);
      } else append(`unknown command: ${command}`);
    });
  }

  function renderStore() {
    const templates = [
      ["Calendar", "ui", "Create a calendar app with month, week, reminders, recurring events, and drag-to-reschedule"],
      ["Photos", "ui", "Create a photo viewer with albums, crop, rotate, tags, and slideshow"],
      ["Music", "ui", "Create a music player with library, playlists, queue, equalizer, and mini player"],
      ["Mail", "ui", "Create an email client with inbox, compose, search, labels, and local draft cache"],
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
      ${["CPU", "Memory", "Modules", "Network", "AI Compiler"].map((name, index) => `
        <div><span>${name}</span><meter min="0" max="100" value="${24 + index * 13}"></meter><strong>${24 + index * 13}%</strong></div>`).join("")}
    </div>`;
  }

  function bindMonitor(win) {
    const timer = setInterval(() => {
      $$("meter", win).forEach((meter) => {
        const value = Math.floor(12 + Math.random() * 78);
        meter.value = value;
        meter.nextElementSibling.textContent = `${value}%`;
      });
    }, 1500);
    win.addEventListener("remove", () => clearInterval(timer), { once: true });
  }

  function renderModules() {
    const lastIntent = localStorage.getItem("vibe.lastIntent");
    return `<div class="modules-app">
      <header><strong>Local modules</strong><button type="button" data-open="vibe">New</button></header>
      <div class="module-row"><span>latest</span><strong>${escapeHtml(lastIntent || "No module request yet")}</strong><em>VPK</em></div>
      <div class="module-row"><span>runtime</span><strong>vibeos-core ABI v2</strong><em>OK</em></div>
      <div class="module-row"><span>host</span><strong>Rust desktop shell</strong><em>OK</em></div>
    </div>`;
  }

  function bindModules() {}

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

// ============================================================
// VibeOS Core — 窗口管理、任务栏、桌面、背景、时钟、弹窗
// 这是稳定核心，不应随意修改
// ============================================================

const OS = {
  windows: [],
  windowIdCounter: 0,
  zIndexCounter: 100,
  focusedWindow: null,
  apps: {},

  registerApp(name, creator) {
    this.apps[name] = creator;
  },

  createWindow(opts) {
    const id = 'win-' + (++this.windowIdCounter);
    const w = opts.width || 600, h = opts.height || 440;
    const x = opts.x ?? Math.max(40, Math.random() * (window.innerWidth - w - 80));
    const y = opts.y ?? Math.max(40, Math.random() * (window.innerHeight - h - 120));

    const win = document.createElement('div');
    win.className = 'vibe-window';
    win.id = id;
    win.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:${++OS.zIndexCounter};`;
    win.innerHTML = `
      <div class="win-titlebar" data-win="${id}">
        <span class="win-title">${opts.title || 'App'}</span>
        <div class="win-controls">
          <button class="win-btn minimize" data-action="minimize"></button>
          <button class="win-btn maximize" data-action="maximize"></button>
          <button class="win-btn close" data-action="close"></button>
        </div>
      </div>
      <div class="win-body" id="${id}-body"></div>`;

    document.getElementById('desktop').appendChild(win);
    const state = { id, el: win, title: opts.title, icon: opts.icon || '📱', minimized: false, maximized: false };
    this.windows.push(state);
    this.focusWindow(id);
    this.setupDrag(win, id);
    this.setupControls(win, id);
    this.renderTaskbar();

    const body = document.getElementById(id + '-body');
    if (opts.loading) {
      body.innerHTML = `<div class="app-loading"><div class="spinner"></div><div class="load-text">正在生成应用...</div></div>`;
    }
    if (opts.onCreate) setTimeout(() => opts.onCreate(body, state), opts.loadDelay || 300);
    return state;
  },

  focusWindow(id) {
    this.windows.forEach(w => w.el.classList.remove('focused'));
    const s = this.windows.find(w => w.id === id);
    if (s) { s.el.classList.add('focused'); s.el.style.zIndex = ++this.zIndexCounter; this.focusedWindow = id; }
  },

  closeWindow(id) {
    const i = this.windows.findIndex(w => w.id === id);
    if (i >= 0) { this.windows[i].el.remove(); this.windows.splice(i, 1); }
    if (this.focusedWindow === id) this.focusedWindow = null;
    this.renderTaskbar();
  },

  setupDrag(win, id) {
    const bar = win.querySelector('.win-titlebar');
    let dragging = false, dx, dy;
    bar.addEventListener('mousedown', e => {
      if (e.target.closest('.win-controls')) return;
      const s = this.windows.find(w => w.id === id);
      if (s && s.maximized) return;
      dragging = true; dx = e.clientX - win.offsetLeft; dy = e.clientY - win.offsetTop;
      this.focusWindow(id);
      const onMove = e2 => { if (dragging) { win.style.left = (e2.clientX - dx) + 'px'; win.style.top = (e2.clientY - dy) + 'px'; }};
      const onUp = () => { dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    bar.addEventListener('mousedown', () => this.focusWindow(id));
  },

  setupControls(win, id) {
    win.querySelector('.win-controls').addEventListener('click', e => {
      const btn = e.target.closest('.win-btn');
      if (!btn) return;
      const action = btn.dataset.action;
      const s = this.windows.find(w => w.id === id);
      if (action === 'close') this.closeWindow(id);
      else if (action === 'minimize') { s.minimized = !s.minimized; win.classList.toggle('minimized', s.minimized); this.renderTaskbar(); }
      else if (action === 'maximize') { s.maximized = !s.maximized; win.classList.toggle('maximized', s.maximized); }
    });
    win.addEventListener('mousedown', () => this.focusWindow(id));
  },

  renderTaskbar() {
    const cont = document.getElementById('taskbar-items');
    cont.innerHTML = '';
    this.windows.forEach(w => {
      const el = document.createElement('div');
      el.className = 'taskbar-item' + (this.focusedWindow === w.id ? ' active' : '');
      el.innerHTML = `<span class="ti-icon">${w.icon}</span>${w.title}`;
      el.addEventListener('click', () => {
        if (w.minimized) { w.minimized = false; w.el.classList.remove('minimized'); }
        this.focusWindow(w.id);
      });
      cont.appendChild(el);
    });
  }
};

// ====== DESKTOP ICONS ======
const desktopIcons = [];
function addDesktopIcon(name, icon, onClick) {
  const container = document.getElementById('desktop-icons');
  const el = document.createElement('div');
  el.className = 'desktop-icon';
  el.innerHTML = `<div class="icon">${icon}</div><div class="label">${name}</div>`;
  el.addEventListener('click', onClick);
  el.addEventListener('dblclick', onClick);
  container.appendChild(el);
  desktopIcons.push(el);
}

// ====== BACKGROUND ANIMATION ======
(function initBg() {
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight - 48; }
  resize(); window.addEventListener('resize', resize);

  for (let i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 2 + 0.5, dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3, a: Math.random() * 0.5 + 0.1
    });
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(108,92,231,${p.a})`; ctx.fill();
    });
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 120) {
          ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(108,92,231,${0.08 * (1 - dist/120)})`; ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

// ====== CLOCK ======
function updateClock() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('taskbar-clock').textContent =
    `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
updateClock(); setInterval(updateClock, 1000);

// ====== VIBE BUTTON DROPDOWN ======
const vibeBtnWrap = document.getElementById('vibe-btn-wrap');
const vibeDropdown = document.getElementById('vibe-dropdown');
let vibeDdOpen = false;

document.getElementById('vibe-btn').addEventListener('click', e => {
  e.stopPropagation();
  vibeDdOpen = !vibeDdOpen;
  vibeDropdown.style.display = vibeDdOpen ? 'block' : 'none';
});

document.addEventListener('click', e => {
  if (!vibeBtnWrap.contains(e.target)) {
    vibeDdOpen = false;
    vibeDropdown.style.display = 'none';
  }
});

document.querySelectorAll('.vibe-dd-item').forEach(item => {
  item.addEventListener('click', e => {
    e.stopPropagation();
    vibeDdOpen = false;
    vibeDropdown.style.display = 'none';
    const action = item.dataset.action;
    if (action === 'generate') openVibeModal();
    else if (action === 'bug') openBugModal();
  });
});

// ====== VIBE MODAL ======
const suggestions = ['番茄钟','天气面板','计算器','记事本','Markdown编辑器','音乐播放器','待办事项','时钟','颜色拾取器','倒计时'];
const sugEl = document.getElementById('vibe-suggestions');
suggestions.forEach(s => {
  const el = document.createElement('span');
  el.className = 'vibe-sug'; el.textContent = s;
  el.addEventListener('click', () => { document.getElementById('vibe-input').value = s; });
  sugEl.appendChild(el);
});

function openVibeModal(prefill) {
  document.getElementById('vibe-overlay').classList.add('show');
  const inp = document.getElementById('vibe-input');
  inp.value = prefill || '';
  setTimeout(() => inp.focus(), 100);
}
function closeVibeModal() { document.getElementById('vibe-overlay').classList.remove('show'); }

document.getElementById('vibe-cancel').addEventListener('click', closeVibeModal);
document.getElementById('vibe-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeVibeModal(); });

document.getElementById('vibe-generate').addEventListener('click', () => {
  const val = document.getElementById('vibe-input').value.trim();
  if (!val) return;
  closeVibeModal();
  generateApp(val);
});

document.getElementById('vibe-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    document.getElementById('vibe-generate').click();
  }
});

// ====== BUG REPORT (CLI 交互式) ======
let bugCount = parseInt(localStorage.getItem('vibeos_bugs') || '0');
let bugReport = {};
let bugStep = 0;
const bugSteps = [
  { q: '你好！我是 VibeOS Bug 工具。请用一句话描述你遇到的问题：', field: 'title' },
  { q: '严重程度？(1=低/2=中/3=高/4=严重)', field: 'severity', map: v => ({'1':'low','2':'medium','3':'high','4':'critical'}[v]||'medium') },
  { q: '怎么复现这个问题？（操作步骤）', field: 'steps' },
  { q: '你期望的行为是什么？（可选，回车跳过）', field: 'expected', optional: true },
  { q: '实际发生了什么？（可选，回车跳过）', field: 'actual', optional: true },
];

function openBugModal() {
  bugReport = {};
  bugStep = 0;
  const overlay = document.getElementById('bug-overlay');
  const output = document.getElementById('bug-cli-output');
  const input = document.getElementById('bug-cli-input');
  overlay.style.display = 'flex';
  output.innerHTML = '';
  input.value = '';
  bugPrint('VibeOS BugReporter v1.0', '#e17055');
  bugPrint('输入 quit 随时退出\n', '#666');
  setTimeout(() => bugPrint(bugSteps[0].q, '#a29bfe'), 200);
  setTimeout(() => input.focus(), 100);
}

function closeBugModal() {
  document.getElementById('bug-overlay').style.display = 'none';
}

function bugPrint(text, color) {
  const output = document.getElementById('bug-cli-output');
  const line = document.createElement('div');
  if (color) line.style.color = color;
  line.textContent = text;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

function bugSubmit() {
  bugCount++;
  localStorage.setItem('vibeos_bugs', bugCount);
  const bugId = 'BUG-' + String(bugCount).padStart(4, '0');
  bugReport.id = bugId;
  bugReport.timestamp = new Date().toISOString();
  bugReport.userAgent = navigator.userAgent;
  const bugs = JSON.parse(localStorage.getItem('vibeos_bug_list') || '[]');
  bugs.push(bugReport);
  localStorage.setItem('vibeos_bug_list', JSON.stringify(bugs));
  console.log('[VibeOS Bug Report]', bugReport);
  bugPrint('\n─────────────────────────────', '#e17055');
  bugPrint('Bug 已提交! 编号: ' + bugId, '#00b894');
  bugPrint('感谢反馈，我们会尽快处理', '#00b894');
  bugPrint('─────────────────────────────\n', '#e17055');
  setTimeout(() => closeBugModal(), 1500);
}

document.getElementById('bug-cli-close').addEventListener('click', closeBugModal);
document.getElementById('bug-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeBugModal(); });
document.getElementById('bug-cli-input').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const val = e.target.value.trim();
  e.target.value = '';
  if (val.toLowerCase() === 'quit' || val.toLowerCase() === 'exit') {
    bugPrint('> ' + val, '#888');
    bugPrint('已取消提交', '#fdcb6e');
    setTimeout(() => closeBugModal(), 500);
    return;
  }
  if (bugStep >= bugSteps.length) return;
  bugPrint('> ' + val, '#888');
  const step = bugSteps[bugStep];
  if (!val && !step.optional) {
    bugPrint('此项必填，请重新输入：', '#fdcb6e');
    return;
  }
  bugReport[step.field] = step.map ? step.map(val) : val;
  bugStep++;
  if (bugStep < bugSteps.length) {
    setTimeout(() => bugPrint(bugSteps[bugStep].q, '#a29bfe'), 100);
  } else {
    setTimeout(() => {
      bugPrint('\n─────────────────────────────', '#666');
      bugPrint('Bug Report Preview:', '#e17055');
      bugPrint('  标题: ' + (bugReport.title||'(无)'), '#e0e0f0');
      bugPrint('  严重: ' + (bugReport.severity||'medium'), '#e0e0f0');
      bugPrint('  步骤: ' + (bugReport.steps||'(无)'), '#e0e0f0');
      if (bugReport.expected) bugPrint('  期望: ' + bugReport.expected, '#e0e0f0');
      if (bugReport.actual) bugPrint('  实际: ' + bugReport.actual, '#e0e0f0');
      bugPrint('─────────────────────────────', '#666');
      bugPrint('确认提交？(y/n)', '#fdcb6e');
      bugStep = 999;
    }, 100);
  }
  if (bugStep === 999) {
    if (val.toLowerCase() === 'y' || val.toLowerCase() === 'yes' || val === '') {
      bugSubmit();
    } else {
      bugPrint('已取消', '#fdcb6e');
      setTimeout(() => closeBugModal(), 500);
    }
  }
});

// ====== CONTEXT MENU (double right-click) ======
let rClicks = [];
document.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('mousedown', e => {
  if (e.button === 2) {
    const now = Date.now();
    rClicks.push(now);
    rClicks = rClicks.filter(t => now - t < 500);
    if (rClicks.length >= 2) {
      rClicks = [];
      openVibeModal();
      hideContextMenu();
    } else {
      setTimeout(() => {
        if (rClicks.length === 1 && rClicks[0] === now) {
          showContextMenu(e.clientX, e.clientY);
        }
        rClicks = rClicks.filter(t => Date.now() - t >= 500);
      }, 300);
    }
  }
});
document.addEventListener('click', () => hideContextMenu());

const ctxMenu = document.getElementById('context-menu');
function showContextMenu(x, y) {
  ctxMenu.style.left = x + 'px'; ctxMenu.style.top = y + 'px';
  ctxMenu.classList.add('show');
}
function hideContextMenu() { ctxMenu.classList.remove('show'); }

ctxMenu.querySelectorAll('.ctx-item').forEach(item => {
  item.addEventListener('click', () => {
    const action = item.dataset.action;
    hideContextMenu();
    if (action === 'vibe') openVibeModal();
    else if (action === 'bug') openBugModal();
    else if (action === 'terminal') generateApp('终端');
    else if (action === 'notepad') generateApp('记事本');
    else if (action === 'filemanager') generateApp('文件管理器');
    else if (action === 'settings') generateApp('设置');
  });
});

// ====== APP GENERATOR (VibeEngine 实时生成) ======
function generateApp(description) {
  const lower = description.toLowerCase();
  const name = description.length > 20 ? description.slice(0, 20) + '...' : description;
  const win = OS.createWindow({
    title: name, icon: '⚡', width: 640, height: 480,
    loading: false,
    onCreate: (body, state) => {
      VibeEngine.generate(description, body, state);
    }
  });
  addDesktopIcon(name, '⚡', () => OS.focusWindow(win.id));
}

// ====== BOOT ======
addDesktopIcon('终端', '🖥️', () => generateApp('终端'));
addDesktopIcon('记事本', '📝', () => generateApp('记事本'));
addDesktopIcon('文件管理器', '📁', () => generateApp('文件管理器'));
addDesktopIcon('贪吃蛇', '🐍', () => generateApp('贪吃蛇'));
addDesktopIcon('画板', '🎨', () => generateApp('画板'));

// ====== CHAT WIDGET (MiMo 实时对话) ======
(function initChat() {
  const toggle = document.getElementById('chat-toggle');
  const win = document.getElementById('chat-window');
  const msgs = document.getElementById('chat-messages');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  let chatOpen = false;
  let shownIds = new Set();

  function addMsg(sender, text, type, time) {
    const el = document.createElement('div');
    el.className = 'chat-msg ' + type;
    const ts = time ? `<span style="font-size:10px;color:#666;margin-left:6px;">${time}</span>` : '';
    el.innerHTML = `<div class="sender">${sender}${ts}</div><div>${text}</div>`;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'user', text })
    });
    // Optimistically show
    addMsg('You', text, 'user');
  }

  async function pollReplies() {
    try {
      const res = await fetch('/api/replies');
      const replies = await res.json();
      replies.forEach(r => {
        const id = r.time + r.text;
        if (!shownIds.has(id)) {
          shownIds.add(id);
          addMsg('MiMo', r.text, 'mimo', r.time);
        }
      });
    } catch(e) {}
  }

  toggle.addEventListener('click', () => {
    chatOpen = !chatOpen;
    win.style.display = chatOpen ? 'flex' : 'none';
    if (chatOpen) {
      input.focus();
      if (msgs.children.length === 0) {
        addMsg('MiMo', '你好！发消息给我，我会看到并回复你。\n\n（MiMo 通过读取 chat/messages.jsonl 文件来回复）', 'mimo');
      }
    }
  });

  document.getElementById('chat-close').addEventListener('click', () => {
    chatOpen = false;
    win.style.display = 'none';
  });

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

  // Poll for new replies every 3 seconds
  setInterval(pollReplies, 3000);
})();

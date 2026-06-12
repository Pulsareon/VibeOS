// ============================================================
// 内置应用 — 预装的应用生成器
// ============================================================

function buildPomodoro(body, state) {
  state.title = '🍅 番茄钟';
  state.el.querySelector('.win-title').textContent = state.title;
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:20px;padding:20px;">
      <div id="pomo-display" style="font-size:72px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--accent);">25:00</div>
      <div id="pomo-status" style="color:var(--muted);font-size:14px;">专注模式</div>
      <div style="display:flex;gap:12px;">
        <button id="pomo-start" style="padding:10px 28px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-size:14px;font-weight:600;cursor:pointer;">开始</button>
        <button id="pomo-reset" style="padding:10px 20px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--text);font-size:14px;cursor:pointer;">重置</button>
      </div>
      <div style="display:flex;gap:16px;margin-top:10px;">
        <span id="pomo-sessions" style="color:var(--muted);font-size:13px;">完成: 0</span>
        <span id="pomo-mode" style="color:var(--muted);font-size:13px;">工作 25min / 休息 5min</span>
      </div>
    </div>`;
  let time = 1500, running = false, interval, sessions = 0, isWork = true;
  const display = body.querySelector('#pomo-display');
  const status = body.querySelector('#pomo-status');
  const sessEl = body.querySelector('#pomo-sessions');
  function updateDisplay() {
    const m = Math.floor(time / 60), s = time % 60;
    display.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    display.style.color = isWork ? 'var(--accent)' : 'var(--success)';
  }
  body.querySelector('#pomo-start').addEventListener('click', function() {
    if (running) { clearInterval(interval); running = false; this.textContent = '继续'; status.textContent = '已暂停'; return; }
    running = true; this.textContent = '暂停'; status.textContent = isWork ? '专注中...' : '休息中...';
    interval = setInterval(() => {
      if (time <= 0) {
        clearInterval(interval); running = false;
        isWork = !isWork; time = isWork ? 1500 : 300;
        if (isWork) sessions++;
        sessEl.textContent = `完成: ${sessions}`;
        status.textContent = isWork ? '专注模式' : '休息模式';
        body.querySelector('#pomo-start').textContent = '开始';
        updateDisplay();
        try { new Audio('data:audio/wav;base64,UklGRl9vT19teleQBAABAAEAAAEAA').play(); } catch(e){}
        return;
      }
      time--; updateDisplay();
    }, 1000);
  });
  body.querySelector('#pomo-reset').addEventListener('click', () => {
    clearInterval(interval); running = false; isWork = true; time = 1500;
    body.querySelector('#pomo-start').textContent = '开始'; status.textContent = '专注模式';
    updateDisplay();
  });
  updateDisplay();
}

function buildWeather(body, state) {
  state.title = '🌤️ 天气面板';
  state.el.querySelector('.win-title').textContent = state.title;
  const cities = ['北京','上海','深圳','杭州','成都','广州'];
  const weathers = ['☀️ 晴','⛅ 多云','🌧️ 雨','🌫️ 雾','🌤️ 局部多云','⛈️ 雷阵雨'];
  body.innerHTML = `
    <div style="padding:24px;height:100%;display:flex;flex-direction:column;gap:16px;">
      <div style="display:flex;gap:12px;align-items:center;">
        <input id="w-search" placeholder="搜索城市..." style="flex:1;padding:10px 14px;border-radius:8px;border:1px solid var(--border);background:rgba(10,10,30,.6);color:var(--text);font-size:14px;outline:none;">
        <button id="w-refresh" style="padding:10px 16px;border-radius:8px;border:1px solid var(--border);background:var(--accent);color:#fff;cursor:pointer;font-size:14px;">刷新</button>
      </div>
      <div id="w-main" style="display:flex;gap:16px;flex-wrap:wrap;"></div>
      <div style="font-size:13px;color:var(--muted);">模拟数据 · 点击刷新获取新数据</div>
    </div>`;
  function render() {
    const main = body.querySelector('#w-main');
    const q = body.querySelector('#w-search').value.trim();
    const list = q ? [q] : cities;
    main.innerHTML = list.map(city => {
      const w = weathers[Math.floor(Math.random()*weathers.length)];
      const temp = Math.floor(Math.random()*30)+5;
      const hum = Math.floor(Math.random()*60)+30;
      return `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 20px;min-width:140px;flex:1;">
        <div style="font-size:13px;color:var(--muted);">${city}</div>
        <div style="font-size:32px;margin:8px 0;">${w.split(' ')[0]}</div>
        <div style="font-size:22px;font-weight:700;">${temp}°C</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">${w.split(' ')[1]} · 湿度 ${hum}%</div>
      </div>`;
    }).join('');
  }
  body.querySelector('#w-refresh').addEventListener('click', render);
  render();
}

function buildCalculator(body, state) {
  state.title = '🧮 计算器';
  state.el.querySelector('.win-title').textContent = state.title;
  body.innerHTML = `
    <div style="padding:16px;height:100%;display:flex;flex-direction:column;">
      <div id="calc-expr" style="font-size:14px;color:var(--muted);min-height:20px;text-align:right;padding:0 8px;"></div>
      <div id="calc-display" style="font-size:36px;font-weight:700;text-align:right;padding:8px 8px 16px;font-variant-numeric:tabular-nums;overflow:hidden;">0</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;flex:1;">
        ${['C','±','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','0','.','='].map(b =>
          `<button class="calc-btn" data-val="${b}" style="border:none;border-radius:8px;font-size:${b==='0'?'18px':'16px'};font-weight:600;cursor:pointer;padding:12px;
            background:${['÷','×','−','+','='].includes(b)?'var(--accent)':b==='C'||b==='±'||b==='%'?'rgba(255,255,255,.08)':'rgba(255,255,255,.05)'};
            color:${['÷','×','−','+','='].includes(b)?'#fff':'var(--text)'};">${b}</button>`
        ).join('')}
      </div>
    </div>`;
  let current = '0', prev = '', op = '', newNum = true;
  const display = body.querySelector('#calc-display');
  const expr = body.querySelector('#calc-expr');
  body.querySelectorAll('.calc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.val;
      if (v >= '0' && v <= '9' || v === '.') {
        if (newNum) { current = v === '.' ? '0.' : v; newNum = false; }
        else { current += v; }
      } else if (v === 'C') { current = '0'; prev = ''; op = ''; expr.textContent = ''; }
      else if (v === '±') { current = String(-parseFloat(current)); }
      else if (v === '%') { current = String(parseFloat(current)/100); }
      else if (['+','−','×','÷'].includes(v)) {
        if (prev && op && !newNum) { current = String(calc(parseFloat(prev),parseFloat(current),op)); }
        prev = current; op = v; expr.textContent = prev + ' ' + v; newNum = true;
      } else if (v === '=') {
        if (prev && op) {
          expr.textContent = prev + ' ' + op + ' ' + current + ' =';
          current = String(calc(parseFloat(prev),parseFloat(current),op));
          prev = ''; op = '';
        }
      }
      display.textContent = current.length > 12 ? parseFloat(current).toExponential(6) : current;
    });
  });
  function calc(a, b, op) {
    if (op === '+') return a + b;
    if (op === '−') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b !== 0 ? a / b : 'Error';
    return b;
  }
}

function buildNotepad(body, state) {
  state.title = '📝 记事本';
  state.el.querySelector('.win-title').textContent = state.title;
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;">
      <div style="padding:8px 12px;display:flex;gap:8px;border-bottom:1px solid var(--border);flex-shrink:0;">
        <button id="np-new" style="padding:4px 12px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer;font-size:12px;">新建</button>
        <button id="np-copy" style="padding:4px 12px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer;font-size:12px;">复制</button>
        <span id="np-info" style="margin-left:auto;font-size:11px;color:var(--muted);align-self:center;"></span>
      </div>
      <textarea id="np-text" style="flex:1;border:none;background:transparent;color:var(--text);font-family:Consolas,'Courier New',monospace;font-size:14px;padding:12px;resize:none;outline:none;line-height:1.6;" placeholder="在这里输入文本..."></textarea>
    </div>`;
  const ta = body.querySelector('#np-text');
  const info = body.querySelector('#np-info');
  function updateInfo() { const t = ta.value; info.textContent = `${t.length} 字符 · ${t.split('\n').length} 行`; }
  ta.addEventListener('input', updateInfo);
  body.querySelector('#np-new').addEventListener('click', () => { ta.value = ''; updateInfo(); });
  body.querySelector('#np-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(ta.value).then(() => { body.querySelector('#np-copy').textContent = '已复制!'; setTimeout(() => body.querySelector('#np-copy').textContent = '复制', 1500); });
  });
  updateInfo();
}

function buildMarkdown(body, state) {
  state.title = '📝 Markdown 编辑器';
  state.el.querySelector('.win-title').textContent = state.title;
  body.innerHTML = `
    <div style="display:flex;height:100%;">
      <textarea id="md-input" style="flex:1;border:none;border-right:1px solid var(--border);background:rgba(10,10,30,.4);color:var(--text);font-family:Consolas,monospace;font-size:14px;padding:16px;resize:none;outline:none;line-height:1.7;" placeholder="# 写 Markdown..."></textarea>
      <div id="md-preview" style="flex:1;padding:16px;overflow-y:auto;line-height:1.8;"></div>
    </div>`;
  const input = body.querySelector('#md-input');
  const preview = body.querySelector('#md-preview');
  function renderMd(text) {
    return text
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:rgba(108,92,231,.2);padding:2px 6px;border-radius:4px;">$1</code>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/\n/g, '<br>');
  }
  input.addEventListener('input', () => { preview.innerHTML = renderMd(input.value); });
}

function buildMusic(body, state) {
  state.title = '🎵 音乐播放器';
  state.el.querySelector('.win-title').textContent = state.title;
  const tracks = [
    { name: '电子脉冲', artist: 'VibeBot', dur: '3:42', color: '#6c5ce7' },
    { name: '霓虹夜行', artist: 'AI Orchestra', dur: '4:15', color: '#e17055' },
    { name: '数据之海', artist: 'SynthMind', dur: '5:01', color: '#00b894' },
    { name: '量子漫步', artist: 'Neural Beat', dur: '3:58', color: '#fdcb6e' },
    { name: '像素黄昏', artist: 'BitWave', dur: '4:33', color: '#a29bfe' },
  ];
  body.innerHTML = `
    <div style="padding:20px;height:100%;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
        <div style="width:64px;height:64px;border-radius:12px;background:linear-gradient(135deg,#6c5ce7,#a29bfe);display:flex;align-items:center;justify-content:center;font-size:28px;">🎵</div>
        <div><div style="font-size:18px;font-weight:700;" id="mu-track">电子脉冲</div><div style="color:var(--muted);font-size:13px;" id="mu-artist">VibeBot</div></div>
      </div>
      <div style="background:rgba(255,255,255,.05);border-radius:8px;height:6px;margin-bottom:8px;overflow:hidden;cursor:pointer;" id="mu-progress-bar">
        <div id="mu-progress" style="height:100%;width:35%;background:var(--accent);border-radius:8px;transition:width .3s;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:16px;">
        <span id="mu-time">1:18</span><span>3:42</span>
      </div>
      <div style="display:flex;justify-content:center;gap:20px;margin-bottom:20px;">
        <button id="mu-prev" style="background:none;border:none;color:var(--text);font-size:20px;cursor:pointer;">⏮</button>
        <button id="mu-play" style="background:var(--accent);border:none;color:#fff;width:44px;height:44px;border-radius:50%;font-size:18px;cursor:pointer;">▶</button>
        <button id="mu-next" style="background:none;border:none;color:var(--text);font-size:20px;cursor:pointer;">⏭</button>
      </div>
      <div style="flex:1;overflow-y:auto;" id="mu-list"></div>
    </div>`;
  let current = 0, playing = false;
  const list = body.querySelector('#mu-list');
  function renderList() {
    list.innerHTML = tracks.map((t, i) => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:8px;cursor:pointer;${i===current?'background:rgba(108,92,231,.2);':''}" data-idx="${i}">
        <div style="width:36px;height:36px;border-radius:8px;background:${t.color}20;display:flex;align-items:center;justify-content:center;font-size:16px;">${i===current?'▶':'🎵'}</div>
        <div style="flex:1;"><div style="font-size:13px;font-weight:600;">${t.name}</div><div style="font-size:11px;color:var(--muted);">${t.artist}</div></div>
        <div style="font-size:12px;color:var(--muted);">${t.dur}</div>
      </div>`).join('');
    list.querySelectorAll('[data-idx]').forEach(el => el.addEventListener('click', () => {
      current = parseInt(el.dataset.idx);
      body.querySelector('#mu-track').textContent = tracks[current].name;
      body.querySelector('#mu-artist').textContent = tracks[current].artist;
      renderList();
    }));
  }
  body.querySelector('#mu-play').addEventListener('click', function() {
    playing = !playing; this.textContent = playing ? '⏸' : '▶';
  });
  body.querySelector('#mu-next').addEventListener('click', () => {
    current = (current + 1) % tracks.length;
    body.querySelector('#mu-track').textContent = tracks[current].name;
    body.querySelector('#mu-artist').textContent = tracks[current].artist;
    renderList();
  });
  body.querySelector('#mu-prev').addEventListener('click', () => {
    current = (current - 1 + tracks.length) % tracks.length;
    body.querySelector('#mu-track').textContent = tracks[current].name;
    body.querySelector('#mu-artist').textContent = tracks[current].artist;
    renderList();
  });
  renderList();
}

function buildTodo(body, state) {
  state.title = '✅ 待办事项';
  state.el.querySelector('.win-title').textContent = state.title;
  body.innerHTML = `
    <div style="padding:16px;height:100%;display:flex;flex-direction:column;">
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <input id="todo-input" placeholder="添加新任务..." style="flex:1;padding:10px 14px;border-radius:8px;border:1px solid var(--border);background:rgba(10,10,30,.6);color:var(--text);font-size:14px;outline:none;">
        <button id="todo-add" style="padding:10px 16px;border-radius:8px;border:none;background:var(--accent);color:#fff;cursor:pointer;font-weight:600;">添加</button>
      </div>
      <div id="todo-list" style="flex:1;overflow-y:auto;"></div>
      <div id="todo-stats" style="padding-top:8px;border-top:1px solid var(--border);font-size:12px;color:var(--muted);"></div>
    </div>`;
  let todos = [];
  const list = body.querySelector('#todo-list');
  const stats = body.querySelector('#todo-stats');
  function render() {
    list.innerHTML = todos.length === 0 ? '<div style="text-align:center;color:var(--muted);padding:40px;font-size:14px;">暂无任务，添加一个吧</div>' :
      todos.map((t, i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;margin-bottom:4px;background:rgba(255,255,255,.03);border:1px solid var(--border);">
          <input type="checkbox" ${t.done?'checked':''} data-idx="${i}" style="accent-color:var(--accent);">
          <span style="flex:1;font-size:14px;${t.done?'text-decoration:line-through;color:var(--muted);':''}">${t.text}</span>
          <button data-del="${i}" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px;">×</button>
        </div>`).join('');
    list.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => { todos[cb.dataset.idx].done = cb.checked; render(); });
    });
    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => { todos.splice(btn.dataset.del, 1); render(); });
    });
    const done = todos.filter(t => t.done).length;
    stats.textContent = `${done}/${todos.length} 已完成`;
  }
  function addTodo() {
    const inp = body.querySelector('#todo-input');
    if (inp.value.trim()) { todos.push({ text: inp.value.trim(), done: false }); inp.value = ''; render(); }
  }
  body.querySelector('#todo-add').addEventListener('click', addTodo);
  body.querySelector('#todo-input').addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });
  render();
}

function buildClock(body, state) {
  state.title = '🕐 时钟';
  state.el.querySelector('.win-title').textContent = state.title;
  body.innerHTML = `
    <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;">
      <div id="clk-digital" style="font-size:64px;font-weight:700;font-variant-numeric:tabular-nums;"></div>
      <div id="clk-date" style="font-size:16px;color:var(--muted);"></div>
      <canvas id="clk-face" width="220" height="220" style="margin-top:10px;"></canvas>
    </div>`;
  const canvas = body.querySelector('#clk-face');
  const ctx = canvas.getContext('2d');
  function drawClock() {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
    body.querySelector('#clk-digital').textContent =
      `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    const days = ['日','一','二','三','四','五','六'];
    body.querySelector('#clk-date').textContent =
      `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 星期${days[now.getDay()]}`;
    ctx.clearRect(0, 0, 220, 220);
    ctx.beginPath(); ctx.arc(110, 110, 100, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(108,92,231,0.08)'; ctx.fill();
    ctx.strokeStyle = 'rgba(108,92,231,0.4)'; ctx.lineWidth = 2; ctx.stroke();
    for (let i = 1; i <= 12; i++) {
      const angle = (i * 30 - 90) * Math.PI / 180;
      ctx.fillStyle = '#e0e0f0'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i), 110 + 82 * Math.cos(angle), 110 + 82 * Math.sin(angle));
    }
    const drawHand = (angle, len, width, color) => {
      ctx.beginPath(); ctx.moveTo(110, 110);
      ctx.lineTo(110 + len * Math.cos(angle), 110 + len * Math.sin(angle));
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke();
    };
    const ha = ((h % 12) + m / 60) * 30 * Math.PI / 180 - Math.PI / 2;
    const ma = (m + s / 60) * 6 * Math.PI / 180 - Math.PI / 2;
    const sa = s * 6 * Math.PI / 180 - Math.PI / 2;
    drawHand(ha, 50, 4, '#a29bfe');
    drawHand(ma, 70, 3, '#6c5ce7');
    drawHand(sa, 80, 1.5, '#e17055');
    ctx.beginPath(); ctx.arc(110, 110, 5, 0, Math.PI*2);
    ctx.fillStyle = '#6c5ce7'; ctx.fill();
  }
  drawClock(); setInterval(drawClock, 1000);
}

function buildColorPicker(body, state) {
  state.title = '🎨 颜色拾取器';
  state.el.querySelector('.win-title').textContent = state.title;
  body.innerHTML = `
    <div style="padding:20px;height:100%;display:flex;flex-direction:column;gap:16px;">
      <div style="display:flex;gap:16px;align-items:flex-start;">
        <div style="flex:1;">
          <canvas id="cp-wheel" width="200" height="200" style="border-radius:12px;cursor:crosshair;"></canvas>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:12px;">
          <div id="cp-preview" style="width:100%;height:80px;border-radius:12px;background:#6c5ce7;border:1px solid var(--border);"></div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <label style="font-size:12px;color:var(--muted);">HEX</label>
            <input id="cp-hex" value="#6c5ce7" style="padding:8px;border-radius:6px;border:1px solid var(--border);background:rgba(10,10,30,.6);color:var(--text);font-family:monospace;font-size:14px;outline:none;">
            <label style="font-size:12px;color:var(--muted);">RGB</label>
            <input id="cp-rgb" value="rgb(108, 92, 231)" style="padding:8px;border-radius:6px;border:1px solid var(--border);background:rgba(10,10,30,.6);color:var(--text);font-family:monospace;font-size:14px;outline:none;" readonly>
          </div>
          <button id="cp-copy" style="padding:8px;border-radius:6px;border:none;background:var(--accent);color:#fff;cursor:pointer;font-weight:600;">复制 HEX</button>
        </div>
      </div>
    </div>`;
  const canvas = body.querySelector('#cp-wheel');
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(200, 200);
  for (let y = 0; y < 200; y++) {
    for (let x = 0; x < 200; x++) {
      const dx = x - 100, dy = y - 100;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist <= 100) {
        const angle = Math.atan2(dy, dx);
        const hue = ((angle * 180 / Math.PI) + 360) % 360;
        const sat = dist / 100;
        const [r, g, b] = hslToRgb(hue, sat, 0.55);
        const i = (y * 200 + x) * 4;
        imgData.data[i] = r; imgData.data[i+1] = g; imgData.data[i+2] = b; imgData.data[i+3] = 255;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
  function hslToRgb(h, s, l) {
    h /= 360; let r, g, b;
    if (s === 0) { r = g = b = l; } else {
      const hue2rgb = (p, q, t) => { if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p; };
      const q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
      r = hue2rgb(p,q,h+1/3); g = hue2rgb(p,q,h); b = hue2rgb(p,q,h-1/3);
    }
    return [Math.round(r*255), Math.round(g*255), Math.round(b*255)];
  }
  function pickColor(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * 200 / rect.width);
    const y = Math.round((e.clientY - rect.top) * 200 / rect.height);
    if (x < 0 || x >= 200 || y < 0 || y >= 200) return;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    if (pixel[3] === 0) return;
    const hex = '#' + [pixel[0],pixel[1],pixel[2]].map(v => v.toString(16).padStart(2,'0')).join('');
    body.querySelector('#cp-preview').style.background = hex;
    body.querySelector('#cp-hex').value = hex;
    body.querySelector('#cp-rgb').value = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
  }
  canvas.addEventListener('click', pickColor);
  body.querySelector('#cp-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(body.querySelector('#cp-hex').value);
    body.querySelector('#cp-copy').textContent = '已复制!';
    setTimeout(() => body.querySelector('#cp-copy').textContent = '复制 HEX', 1500);
  });
}

function buildCountdown(body, state) {
  state.title = '⏳ 倒计时';
  state.el.querySelector('.win-title').textContent = state.title;
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:20px;padding:20px;">
      <div style="display:flex;gap:12px;align-items:center;">
        <input id="cd-h" type="number" value="0" min="0" max="23" style="width:60px;text-align:center;padding:8px;border-radius:8px;border:1px solid var(--border);background:rgba(10,10,30,.6);color:var(--text);font-size:18px;outline:none;">
        <span style="color:var(--muted);">时</span>
        <input id="cd-m" type="number" value="5" min="0" max="59" style="width:60px;text-align:center;padding:8px;border-radius:8px;border:1px solid var(--border);background:rgba(10,10,30,.6);color:var(--text);font-size:18px;outline:none;">
        <span style="color:var(--muted);">分</span>
        <input id="cd-s" type="number" value="0" min="0" max="59" style="width:60px;text-align:center;padding:8px;border-radius:8px;border:1px solid var(--border);background:rgba(10,10,30,.6);color:var(--text);font-size:18px;outline:none;">
        <span style="color:var(--muted);">秒</span>
      </div>
      <div id="cd-display" style="font-size:64px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--accent);">05:00</div>
      <div style="display:flex;gap:12px;">
        <button id="cd-start" style="padding:10px 28px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-size:14px;font-weight:600;cursor:pointer;">开始</button>
        <button id="cd-reset" style="padding:10px 20px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--text);font-size:14px;cursor:pointer;">重置</button>
      </div>
    </div>`;
  let time = 300, running = false, interval;
  const display = body.querySelector('#cd-display');
  function updateDisplay() {
    const h = Math.floor(time / 3600), m = Math.floor((time % 3600) / 60), s = time % 60;
    display.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    display.style.color = time < 60 ? 'var(--danger)' : 'var(--accent)';
  }
  function getInputTime() {
    return parseInt(body.querySelector('#cd-h').value||0)*3600 + parseInt(body.querySelector('#cd-m').value||0)*60 + parseInt(body.querySelector('#cd-s').value||0);
  }
  body.querySelector('#cd-start').addEventListener('click', function() {
    if (running) { clearInterval(interval); running = false; this.textContent = '继续'; return; }
    if (time <= 0) { time = getInputTime(); updateDisplay(); }
    running = true; this.textContent = '暂停';
    interval = setInterval(() => {
      if (time <= 0) { clearInterval(interval); running = false; this.textContent = '开始'; return; }
      time--; updateDisplay();
    }, 1000);
  });
  body.querySelector('#cd-reset').addEventListener('click', () => {
    clearInterval(interval); running = false; time = getInputTime();
    body.querySelector('#cd-start').textContent = '开始'; updateDisplay();
  });
  updateDisplay();
}

function buildTerminal(body, state) {
  state.title = '🖥️ 终端';
  state.el.querySelector('.win-title').textContent = state.title;
  body.innerHTML = `
    <div style="padding:12px;font-family:Consolas,'Courier New',monospace;font-size:13px;height:100%;display:flex;flex-direction:column;">
      <div id="term-output" style="flex:1;overflow-y:auto;color:#00ff88;line-height:1.6;"></div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
        <span style="color:var(--accent);font-weight:700;">❯</span>
        <input id="term-input" style="flex:1;border:none;background:transparent;color:var(--text);font-family:inherit;font-size:13px;outline:none;" autofocus>
      </div>
    </div>`;
  const output = body.querySelector('#term-output');
  const input = body.querySelector('#term-input');
  let history = [], histIdx = -1;
  function print(text, color) {
    const line = document.createElement('div');
    if (color) line.style.color = color;
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }
  print('VibeOS Terminal v1.0', '#a29bfe');
  print('输入 help 查看可用命令\n');
  const commands = {
    help: () => { print('可用命令: help, clear, echo, date, uptime, ls, cat, whoami, neofetch, cowsay, matrix'); },
    clear: () => { output.innerHTML = ''; },
    echo: (args) => { print(args.join(' ')); },
    date: () => { print(new Date().toLocaleString('zh-CN')); },
    uptime: () => { print('系统运行时间: ' + Math.floor(performance.now()/1000) + ' 秒'); },
    ls: () => { print('Desktop/  Documents/  Downloads/  .config/  vibeos.app'); },
    cat: (args) => { print(args[0] ? `cat: ${args[0]}: 没有那个文件或目录` : 'cat: 缺少操作数', '#e17055'); },
    whoami: () => { print('vibeuser'); },
    neofetch: () => {
      print('        ___         vibeuser@vibeos');
      print('       /   \\        ─────────────────');
      print('      / VIBE \\       OS: VibeOS 1.0');
      print('     /_______\\      Kernel: VibeKernel');
      print('    |  |   |  |     Shell: vterm');
      print('    |  |   |  |     Resolution: ' + window.innerWidth + 'x' + window.innerHeight);
      print('    \\__/   \\__/     Theme: Neon Purple');
    },
    cowsay: (args) => {
      const msg = args.join(' ') || 'moo';
      print(' ' + '_'.repeat(msg.length + 2));
      print('< ' + msg + ' >');
      print(' ' + '‾'.repeat(msg.length + 2));
      print('        \\   ^__^');
      print('         \\  (oo)\\_______');
      print('            (__)\\       )\\/\\');
      print('                ||----w |');
      print('                ||     ||');
    },
    matrix: () => { print(' Wake up, Neo...', '#00ff41'); print(' The Matrix has you...', '#00ff41'); print(' Follow the white rabbit.', '#00ff41'); }
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const cmd = input.value.trim();
      if (cmd) { history.unshift(cmd); histIdx = -1; print('❯ ' + cmd, '#a29bfe'); }
      const parts = cmd.split(/\s+/);
      const name = parts[0].toLowerCase();
      const args = parts.slice(1);
      if (commands[name]) commands[name](args);
      else if (name) print(`命令未找到: ${name}`, '#e17055');
      input.value = '';
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (histIdx < history.length - 1) { histIdx++; input.value = history[histIdx]; }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx > 0) { histIdx--; input.value = history[histIdx]; }
      else { histIdx = -1; input.value = ''; }
    }
  });
}

function buildFileManager(body, state) {
  state.title = '📁 文件管理器';
  state.el.querySelector('.win-title').textContent = state.title;
  const fs = {
    '/': ['Desktop','Documents','Downloads','Pictures','.config','core','apps'],
    '/Desktop': ['vibeos快捷方式.txt'],
    '/Documents': ['笔记.md','项目计划.txt','README.md'],
    '/Downloads': ['image.png','archive.zip'],
    '/Pictures': ['screenshot.png','wallpaper.jpg'],
    '/.config': ['theme.json','settings.json'],
    '/core': ['os.css','os.js'],
    '/apps': ['registry.js','builtin.js','user/'],
  };
  let cwd = '/';
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;">
      <div style="padding:8px 12px;display:flex;gap:8px;border-bottom:1px solid var(--border);flex-shrink:0;">
        <button id="fm-back" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer;">←</button>
        <div id="fm-path" style="flex:1;padding:6px 10px;border-radius:6px;background:rgba(10,10,30,.4);font-size:12px;color:var(--muted);font-family:monospace;align-self:center;">/</div>
      </div>
      <div id="fm-list" style="flex:1;overflow-y:auto;padding:8px;"></div>
    </div>`;
  function render() {
    body.querySelector('#fm-path').textContent = cwd;
    const items = fs[cwd] || [];
    body.querySelector('#fm-list').innerHTML = items.map(item => {
      const isDir = item.endsWith('/') || !item.includes('.');
      const icon = isDir ? '📁' : (item.endsWith('.md') || item.endsWith('.txt') ? '📄' : item.endsWith('.json') ? '⚙️' : item.endsWith('.js') ? '📜' : item.endsWith('.css') ? '🎨' : item.endsWith('.png') || item.endsWith('.jpg') ? '🖼️' : '📦');
      return `<div class="fm-item" style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:6px;cursor:pointer;" data-name="${item}" data-isdir="${isDir}">
        <span style="font-size:20px;">${icon}</span>
        <span style="font-size:13px;">${item}</span>
      </div>`;
    }).join('') || '<div style="padding:40px;text-align:center;color:var(--muted);">空文件夹</div>';
    body.querySelectorAll('.fm-item').forEach(el => {
      el.addEventListener('click', () => {
        const name = el.dataset.name;
        if (el.dataset.isdir === 'true') {
          const dir = name.endsWith('/') ? name.slice(0, -1) : name;
          cwd = cwd === '/' ? '/' + dir : cwd + '/' + dir;
          render();
        }
      });
      el.addEventListener('mouseenter', () => el.style.background = 'rgba(108,92,231,.15)');
      el.addEventListener('mouseleave', () => el.style.background = '');
    });
  }
  body.querySelector('#fm-back').addEventListener('click', () => {
    if (cwd !== '/') { cwd = cwd.split('/').slice(0, -1).join('/') || '/'; render(); }
  });
  render();
}

function buildSettings(body, state) {
  state.title = '⚙️ 设置';
  state.el.querySelector('.win-title').textContent = state.title;
  body.innerHTML = `
    <div style="padding:20px;display:flex;flex-direction:column;gap:16px;">
      <h3 style="font-size:16px;margin-bottom:4px;">系统设置</h3>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid var(--border);">
        <span>主题颜色</span>
        <div style="display:flex;gap:8px;">
          ${['#6c5ce7','#e17055','#00b894','#fdcb6e','#74b9ff','#ff7675'].map(c =>
            `<div class="theme-dot" data-color="${c}" style="width:24px;height:24px;border-radius:50%;background:${c};cursor:pointer;border:2px solid transparent;"></div>`
          ).join('')}
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid var(--border);">
        <span>壁纸粒子数</span>
        <input id="s-particles" type="range" min="20" max="200" value="80" style="width:120px;accent-color:var(--accent);">
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid var(--border);">
        <span>系统信息</span>
        <span style="color:var(--muted);font-size:12px;">VibeOS 1.0 · Build 2026</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid var(--border);">
        <span>用户生成应用</span>
        <span style="color:var(--muted);font-size:12px;" id="s-user-app-count">加载中...</span>
      </div>
      <div style="padding:12px;border-radius:8px;background:rgba(108,92,231,.1);border:1px solid rgba(108,92,231,.2);font-size:13px;color:#a29bfe;">
        提示: 双击右键或点击任务栏 VIBE 按钮可以生成新应用！
      </div>
    </div>`;
  if (body.querySelector('#s-user-app-count')) {
    const count = Object.keys(AppRegistry.getUserApps()).length;
    body.querySelector('#s-user-app-count').textContent = count + ' 个';
  }
  body.querySelectorAll('.theme-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      document.documentElement.style.setProperty('--accent', dot.dataset.color);
      body.querySelectorAll('.theme-dot').forEach(d => d.style.borderColor = 'transparent');
      dot.style.borderColor = '#fff';
    });
  });
}

function buildPaint(body, state) {
  state.title = '🎨 画板';
  state.el.querySelector('.win-title').textContent = state.title;
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;">
      <div style="padding:8px 12px;display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--border);flex-shrink:0;">
        <input id="paint-color" type="color" value="#6c5ce7" style="width:32px;height:28px;border:none;cursor:pointer;">
        <input id="paint-size" type="range" min="1" max="20" value="3" style="width:80px;accent-color:var(--accent);">
        <span id="paint-size-label" style="font-size:11px;color:var(--muted);">3px</span>
        <div style="flex:1;"></div>
        <button id="paint-clear" style="padding:4px 12px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer;font-size:12px;">清空</button>
      </div>
      <canvas id="paint-canvas" style="flex:1;cursor:crosshair;background:#0a0a1a;"></canvas>
    </div>`;
  const canvas = body.querySelector('#paint-canvas');
  const ctx = canvas.getContext('2d');
  let painting = false;
  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width; canvas.height = rect.height - 44;
  }
  resizeCanvas();
  new ResizeObserver(resizeCanvas).observe(canvas.parentElement);
  canvas.addEventListener('mousedown', e => { painting = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); });
  canvas.addEventListener('mousemove', e => {
    if (!painting) return;
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.strokeStyle = body.querySelector('#paint-color').value;
    ctx.lineWidth = body.querySelector('#paint-size').value;
    ctx.lineCap = 'round'; ctx.stroke();
  });
  canvas.addEventListener('mouseup', () => painting = false);
  canvas.addEventListener('mouseleave', () => painting = false);
  body.querySelector('#paint-size').addEventListener('input', function() {
    body.querySelector('#paint-size-label').textContent = this.value + 'px';
  });
  body.querySelector('#paint-clear').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
}

function buildSnake(body, state) {
  state.title = '🐍 贪吃蛇';
  state.el.querySelector('.win-title').textContent = state.title;
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;padding:16px;">
      <div style="display:flex;justify-content:space-between;width:100%;max-width:400px;">
        <span id="snake-score" style="font-size:14px;color:var(--muted);">得分: 0</span>
        <button id="snake-restart" style="padding:4px 12px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer;font-size:12px;">重新开始</button>
      </div>
      <canvas id="snake-canvas" width="400" height="400" style="border:1px solid var(--border);border-radius:8px;background:rgba(10,10,30,.6);"></canvas>
      <div style="font-size:11px;color:var(--muted);">方向键 / WASD 控制</div>
    </div>`;
  const canvas = body.querySelector('#snake-canvas');
  const ctx = canvas.getContext('2d');
  const gridSize = 20;
  let snake, food, dir, nextDir, score, gameOver, interval;
  function init() {
    snake = [{x:10,y:10},{x:9,y:10},{x:8,y:10}];
    dir = {x:1,y:0}; nextDir = dir; score = 0; gameOver = false;
    body.querySelector('#snake-score').textContent = '得分: 0';
    placeFood();
    if (interval) clearInterval(interval);
    interval = setInterval(step, 120);
  }
  function placeFood() {
    do { food = {x: Math.floor(Math.random()*20), y: Math.floor(Math.random()*20)}; }
    while (snake.some(s => s.x === food.x && s.y === food.y));
  }
  function step() {
    if (gameOver) return;
    dir = nextDir;
    const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
    if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20 || snake.some(s => s.x === head.x && s.y === head.y)) {
      gameOver = true; clearInterval(interval);
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0,0,400,400);
      ctx.fillStyle = '#e17055'; ctx.font = '24px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('游戏结束!', 200, 200); return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) { score += 10; body.querySelector('#snake-score').textContent = '得分: ' + score; placeFood(); }
    else snake.pop();
    draw();
  }
  function draw() {
    ctx.clearRect(0, 0, 400, 400);
    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? '#6c5ce7' : '#a29bfe';
      ctx.fillRect(s.x * gridSize + 1, s.y * gridSize + 1, gridSize - 2, gridSize - 2);
      if (i === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(s.x*gridSize+4, s.y*gridSize+4, 4, 4); ctx.fillRect(s.x*gridSize+12, s.y*gridSize+4, 4, 4); }
    });
    ctx.fillStyle = '#e17055';
    ctx.beginPath(); ctx.arc(food.x * gridSize + gridSize/2, food.y * gridSize + gridSize/2, gridSize/2 - 2, 0, Math.PI*2); ctx.fill();
  }
  body.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if ((key === 'arrowup' || key === 'w') && dir.y !== 1) nextDir = {x:0,y:-1};
    else if ((key === 'arrowdown' || key === 's') && dir.y !== -1) nextDir = {x:0,y:1};
    else if ((key === 'arrowleft' || key === 'a') && dir.x !== 1) nextDir = {x:-1,y:0};
    else if ((key === 'arrowright' || key === 'd') && dir.x !== -1) nextDir = {x:1,y:0};
  });
  body.querySelector('#snake-restart').addEventListener('click', init);
  init();
}

function buildCamera(body, state) {
  state.title = '📷 相机';
  state.el.querySelector('.win-title').textContent = state.title;
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;">
      <video id="cam-video" autoplay playsinline style="width:100%;max-height:calc(100% - 80px);object-fit:contain;border-radius:8px;background:#000;"></video>
      <button id="cam-start" style="padding:10px 28px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-size:14px;font-weight:600;cursor:pointer;">开启摄像头</button>
    </div>`;
  body.querySelector('#cam-start').addEventListener('click', async function() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      body.querySelector('#cam-video').srcObject = stream;
      this.textContent = '已连接';
      this.style.background = 'var(--success)';
    } catch(e) {
      this.textContent = '无法访问摄像头';
      this.style.background = 'var(--danger)';
    }
  });
}

function buildBrowser(body, state) {
  state.title = '🌐 浏览器';
  state.el.querySelector('.win-title').textContent = state.title;
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;">
      <div style="padding:8px 12px;display:flex;gap:8px;border-bottom:1px solid var(--border);flex-shrink:0;">
        <input id="br-url" value="https://example.com" style="flex:1;padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:rgba(10,10,30,.6);color:var(--text);font-size:13px;outline:none;">
        <button id="br-go" style="padding:6px 14px;border-radius:8px;border:none;background:var(--accent);color:#fff;cursor:pointer;font-size:13px;">前往</button>
      </div>
      <iframe id="br-frame" src="https://example.com" sandbox="allow-same-origin allow-scripts" style="flex:1;border:none;background:#fff;"></iframe>
    </div>`;
  body.querySelector('#br-go').addEventListener('click', () => {
    body.querySelector('#br-frame').src = body.querySelector('#br-url').value;
  });
  body.querySelector('#br-url').addEventListener('keydown', e => {
    if (e.key === 'Enter') body.querySelector('#br-go').click();
  });
}

function buildStickyNotes(body, state) {
  state.title = '📋 便签';
  state.el.querySelector('.win-title').textContent = state.title;
  body.style.background = 'transparent';
  body.innerHTML = `<div id="sticky-board" style="width:100%;height:100%;position:relative;overflow:auto;padding:12px;"></div>`;
  const board = body.querySelector('#sticky-board');
  const colors = ['#fdcb6e','#ff7675','#74b9ff','#55efc4','#a29bfe','#fab1a0'];
  function addNote(text, x, y) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const note = document.createElement('div');
    note.style.cssText = `position:absolute;left:${x||Math.random()*200+20}px;top:${y||Math.random()*100+20}px;width:180px;min-height:120px;
      background:${color};color:#1a1a2e;border-radius:4px;padding:12px;font-size:13px;cursor:move;
      box-shadow:2px 2px 8px rgba(0,0,0,.2);`;
    note.innerHTML = `<div contenteditable="true" style="outline:none;min-height:80px;">${text||'点击编辑...'}</div>
      <button style="position:absolute;top:4px;right:6px;background:none;border:none;cursor:pointer;font-size:14px;opacity:.5;" onclick="this.parentElement.remove()">×</button>`;
    let dragging = false, dx, dy;
    note.addEventListener('mousedown', e => {
      if (e.target.contentEditable === 'true' || e.target.tagName === 'BUTTON') return;
      dragging = true; dx = e.offsetX; dy = e.offsetY;
      const onMove = e2 => { if (dragging) { note.style.left = (e2.clientX - dx) + 'px'; note.style.top = (e2.clientY - dy) + 'px'; }};
      const onUp = () => { dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    board.appendChild(note);
  }
  addNote('双击右键\n生成新应用!', 30, 30);
  addNote('这里写便签\n随时编辑', 240, 50);
  addNote('拖拽移动', 130, 200);
}

function buildCalendar(body, state) {
  state.title = '📅 日历';
  state.el.querySelector('.win-title').textContent = state.title;
  const now = new Date();
  let year = now.getFullYear(), month = now.getMonth();
  body.innerHTML = `<div id="cal-container" style="padding:16px;height:100%;display:flex;flex-direction:column;"></div>`;
  function render() {
    const container = body.querySelector('#cal-container');
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = ['日','一','二','三','四','五','六'];
    let html = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <button class="cal-nav" data-dir="-1" style="background:none;border:none;color:var(--text);font-size:20px;cursor:pointer;">◀</button>
        <span style="font-size:18px;font-weight:700;">${year}年${month + 1}月</span>
        <button class="cal-nav" data-dir="1" style="background:none;border:none;color:var(--text);font-size:20px;cursor:pointer;">▶</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;">
      ${days.map(d => `<div style="padding:8px;font-size:12px;color:var(--muted);font-weight:600;">${d}</div>`).join('')}
    `;
    for (let i = 0; i < firstDay; i++) html += '<div></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === now.getDate() && month === now.getMonth() && year === now.getFullYear();
      html += `<div style="padding:10px;border-radius:8px;font-size:14px;cursor:pointer;
        ${isToday ? 'background:var(--accent);color:#fff;font-weight:700;' : ''}"
        class="cal-day">${d}</div>`;
    }
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.cal-nav').forEach(btn => {
      btn.addEventListener('click', () => {
        month += parseInt(btn.dataset.dir);
        if (month > 11) { month = 0; year++; }
        if (month < 0) { month = 11; year--; }
        render();
      });
    });
  }
  render();
}

function buildPasswordGen(body, state) {
  state.title = '🔐 密码生成器';
  state.el.querySelector('.win-title').textContent = state.title;
  body.innerHTML = `
    <div style="padding:24px;display:flex;flex-direction:column;gap:16px;align-items:center;">
      <div id="pg-output" style="font-size:20px;font-family:monospace;background:rgba(10,10,30,.6);padding:16px 24px;border-radius:8px;border:1px solid var(--border);width:100%;text-align:center;word-break:break-all;min-height:56px;display:flex;align-items:center;justify-content:center;"></div>
      <div style="width:100%;display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:13px;">长度</span>
          <span id="pg-len-val" style="font-size:13px;color:var(--accent);font-weight:700;">16</span>
        </div>
        <input id="pg-len" type="range" min="4" max="64" value="16" style="width:100%;accent-color:var(--accent);">
        <label style="font-size:13px;display:flex;align-items:center;gap:8px;"><input id="pg-upper" type="checkbox" checked> 大写字母</label>
        <label style="font-size:13px;display:flex;align-items:center;gap:8px;"><input id="pg-lower" type="checkbox" checked> 小写字母</label>
        <label style="font-size:13px;display:flex;align-items:center;gap:8px;"><input id="pg-num" type="checkbox" checked> 数字</label>
        <label style="font-size:13px;display:flex;align-items:center;gap:8px;"><input id="pg-sym" type="checkbox" checked> 符号</label>
      </div>
      <div style="display:flex;gap:10px;width:100%;">
        <button id="pg-gen" style="flex:1;padding:10px;border-radius:8px;border:none;background:var(--accent);color:#fff;font-weight:600;cursor:pointer;">生成</button>
        <button id="pg-copy" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer;">复制</button>
      </div>
    </div>`;
  function gen() {
    const len = parseInt(body.querySelector('#pg-len').value);
    body.querySelector('#pg-len-val').textContent = len;
    let chars = '';
    if (body.querySelector('#pg-upper').checked) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (body.querySelector('#pg-lower').checked) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (body.querySelector('#pg-num').checked) chars += '0123456789';
    if (body.querySelector('#pg-sym').checked) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz';
    let pw = '';
    for (let i = 0; i < len; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    body.querySelector('#pg-output').textContent = pw;
  }
  body.querySelector('#pg-gen').addEventListener('click', gen);
  body.querySelector('#pg-len').addEventListener('input', () => { body.querySelector('#pg-len-val').textContent = body.querySelector('#pg-len').value; gen(); });
  body.querySelector('#pg-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(body.querySelector('#pg-output').textContent);
    body.querySelector('#pg-copy').textContent = '已复制!';
    setTimeout(() => body.querySelector('#pg-copy').textContent = '复制', 1500);
  });
  gen();
}

function buildWhiteboard(body, state) {
  state.title = '⬜ 白板';
  state.el.querySelector('.win-title').textContent = state.title;
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;">
      <div style="padding:6px 12px;display:flex;gap:6px;border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap;">
        <button class="wb-tool active" data-tool="pen" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:rgba(108,92,231,.3);color:var(--text);cursor:pointer;font-size:12px;">✏️ 画笔</button>
        <button class="wb-tool" data-tool="eraser" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer;font-size:12px;">🧹 橡皮</button>
        <input id="wb-color" type="color" value="#6c5ce7" style="width:28px;height:26px;border:none;cursor:pointer;">
        <input id="wb-size" type="range" min="1" max="30" value="4" style="width:60px;accent-color:var(--accent);">
        <div style="flex:1;"></div>
        <button id="wb-clear" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer;font-size:12px;">清空</button>
      </div>
      <canvas id="wb-canvas" style="flex:1;cursor:crosshair;background:#fafafa;"></canvas>
    </div>`;
  const canvas = body.querySelector('#wb-canvas');
  const ctx = canvas.getContext('2d');
  let drawing = false, tool = 'pen';
  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    canvas.width = r.width; canvas.height = r.height - 40;
  }
  resize(); new ResizeObserver(resize).observe(canvas.parentElement);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  canvas.addEventListener('mousedown', e => {
    drawing = true;
    ctx.strokeStyle = tool === 'eraser' ? '#fafafa' : body.querySelector('#wb-color').value;
    ctx.lineWidth = tool === 'eraser' ? 20 : body.querySelector('#wb-size').value;
    ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY);
  });
  canvas.addEventListener('mousemove', e => { if (drawing) { ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); }});
  canvas.addEventListener('mouseup', () => drawing = false);
  canvas.addEventListener('mouseleave', () => drawing = false);
  body.querySelectorAll('.wb-tool').forEach(btn => {
    btn.addEventListener('click', () => {
      tool = btn.dataset.tool;
      body.querySelectorAll('.wb-tool').forEach(b => { b.style.background = 'transparent'; b.classList.remove('active'); });
      btn.style.background = 'rgba(108,92,231,.3)'; btn.classList.add('active');
    });
  });
  body.querySelector('#wb-clear').addEventListener('click', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
}

function buildVisualizer(body, state) {
  state.title = '🎶 音乐可视化';
  state.el.querySelector('.win-title').textContent = state.title;
  body.innerHTML = `<canvas id="vis-canvas" style="width:100%;height:100%;"></canvas>`;
  const canvas = body.querySelector('#vis-canvas');
  const ctx = canvas.getContext('2d');
  function resize() { canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight; }
  resize(); new ResizeObserver(resize).observe(canvas.parentElement);
  const bars = 64;
  let data = Array(bars).fill(0).map(() => Math.random() * 0.5);
  function draw() {
    ctx.fillStyle = 'rgba(10,10,26,0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const barW = canvas.width / bars;
    for (let i = 0; i < bars; i++) {
      data[i] += (Math.random() - 0.5) * 0.08;
      data[i] = Math.max(0.05, Math.min(1, data[i]));
      const h = data[i] * canvas.height * 0.8;
      const hue = (i / bars) * 280 + 240;
      ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.8)`;
      ctx.fillRect(i * barW + 2, canvas.height - h, barW - 4, h);
      ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.3)`;
      ctx.fillRect(i * barW + 2, canvas.height - h - 4, barW - 4, 3);
    }
    requestAnimationFrame(draw);
  }
  draw();
}

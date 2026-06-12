// ============================================================
// AppRegistry — 应用注册表
// 管理内置应用 + 用户通过 Vibe 生成的应用
// ============================================================

const AppRegistry = {
  _rules: [],
  _userApps: JSON.parse(localStorage.getItem('vibeos_user_apps') || '{}'),

  register(rule) {
    this._rules.push(rule);
  },

  match(desc, lower, body, state) {
    for (const rule of this._rules) {
      if (rule.match(lower)) return () => rule.build(body, state);
    }
    return null;
  },

  saveUserApp(id, code) {
    this._userApps[id] = code;
    localStorage.setItem('vibeos_user_apps', JSON.stringify(this._userApps));
  },

  getUserApps() {
    return this._userApps;
  },

  deleteUserApp(id) {
    delete this._userApps[id];
    localStorage.setItem('vibeos_user_apps', JSON.stringify(this._userApps));
  }
};

// ====== 内置应用规则 ======
AppRegistry.register({ match: l => l.includes('番茄') || l.includes('pomodoro'), build: buildPomodoro });
AppRegistry.register({ match: l => l.includes('天气') || l.includes('weather'), build: buildWeather });
AppRegistry.register({ match: l => l.includes('计算') || l.includes('calc'), build: buildCalculator });
AppRegistry.register({ match: l => l.includes('记事') || l.includes('notepad') || l.includes('文本'), build: buildNotepad });
AppRegistry.register({ match: l => l.includes('markdown') || l.includes('md'), build: buildMarkdown });
AppRegistry.register({ match: l => l.includes('音乐') && l.includes('可视化'), build: buildVisualizer });
AppRegistry.register({ match: l => (l.includes('音乐') || l.includes('music') || l.includes('播放')) && !l.includes('可视化'), build: buildMusic });
AppRegistry.register({ match: l => l.includes('todo') || l.includes('待办') || l.includes('任务'), build: buildTodo });
AppRegistry.register({ match: l => l.includes('时钟') || l.includes('clock'), build: buildClock });
AppRegistry.register({ match: l => l.includes('颜色') || l.includes('color') || l.includes('拾取'), build: buildColorPicker });
AppRegistry.register({ match: l => l.includes('倒计时') || l.includes('countdown'), build: buildCountdown });
AppRegistry.register({ match: l => l.includes('终端') || l.includes('terminal') || l.includes('shell'), build: buildTerminal });
AppRegistry.register({ match: l => l.includes('文件') || l.includes('file') || l.includes('manager'), build: buildFileManager });
AppRegistry.register({ match: l => l.includes('设置') || l.includes('setting'), build: buildSettings });
AppRegistry.register({ match: l => l.includes('画板') || l.includes('draw') || l.includes('paint') || l.includes('画画'), build: buildPaint });
AppRegistry.register({ match: l => l.includes('游戏') || l.includes('game') || l.includes('贪吃蛇') || l.includes('snake'), build: buildSnake });
AppRegistry.register({ match: l => l.includes('相机') || l.includes('camera') || l.includes('photo'), build: buildCamera });
AppRegistry.register({ match: l => l.includes('浏览器') || l.includes('browser') || l.includes('web'), build: buildBrowser });
AppRegistry.register({ match: l => l.includes('便签') || l.includes('sticky') || l.includes('note'), build: buildStickyNotes });
AppRegistry.register({ match: l => l.includes('日历') || l.includes('calendar'), build: buildCalendar });
AppRegistry.register({ match: l => l.includes('密码') || l.includes('password') || l.includes('generator'), build: buildPasswordGen });
AppRegistry.register({ match: l => l.includes('白板') || l.includes('whiteboard'), build: buildWhiteboard });

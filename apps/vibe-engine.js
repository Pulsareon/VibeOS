// ============================================================
// VibeEngine — 实时代码生成引擎
// 根据用户描述动态组装 HTML/CSS/JS，带打字动画
// ============================================================

const VibeEngine = {
  _appIdCounter: 0,

  generate(description, body, state) {
    const appId = 'app-' + (++this._appIdCounter);
    state.title = '⚡ ' + description;
    state.el.querySelector('.win-title').textContent = state.title;

    const components = this.analyze(description);
    const code = this.assemble(description, components);

    this.showTypingAnimation(body, code, () => {
      this.renderApp(body, code.html, code.css, code.js);
      this.saveUserApp(appId, description, code);
    });
  },

  analyze(desc) {
    const l = desc.toLowerCase();
    const c = {
      hasTimer: l.includes('时') || l.includes('计时') || l.includes('倒计') || l.includes('timer') || l.includes('countdown') || l.includes('番茄') || l.includes('pomodoro'),
      hasCalc: l.includes('计算') || l.includes('calc') || l.includes('算'),
      hasInput: l.includes('输入') || l.includes('表单') || l.includes('form'),
      hasList: l.includes('列表') || l.includes('list') || l.includes('待办') || l.includes('todo') || l.includes('任务'),
      hasChart: l.includes('图表') || l.includes('chart') || l.includes('数据') || l.includes('dashboard'),
      hasColor: l.includes('颜色') || l.includes('color') || l.includes('调色') || l.includes('拾取'),
      hasGame: l.includes('游戏') || l.includes('game') || l.includes('贪吃蛇') || l.includes('snake') || l.includes('井字') || l.includes('tic'),
      hasNote: l.includes('笔记') || l.includes('note') || l.includes('记事') || l.includes('便签') || l.includes('markdown'),
      hasMusic: l.includes('音乐') || l.includes('music') || l.includes('播放') || l.includes('player'),
      hasWeather: l.includes('天气') || l.includes('weather'),
      hasClock: l.includes('时钟') || l.includes('clock') || l.includes('闹钟'),
      hasDraw: l.includes('画') || l.includes('draw') || l.includes('paint') || l.includes('白板') || l.includes('whiteboard'),
      hasCamera: l.includes('相机') || l.includes('camera') || l.includes('拍照') || l.includes('photo'),
      hasFile: l.includes('文件') || l.includes('file') || l.includes('folder'),
      hasTerminal: l.includes('终端') || l.includes('terminal') || l.includes('shell') || l.includes('控制台'),
      hasBrowser: l.includes('浏览') || l.includes('browser') || l.includes('web') || l.includes('网页'),
      hasSettings: l.includes('设置') || l.includes('setting') || l.includes('配置'),
      hasPassword: l.includes('密码') || l.includes('password') || l.includes('生成器') || l.includes('generator'),
      hasCalendar: l.includes('日历') || l.includes('calendar') || l.includes('日程'),
      hasSearch: l.includes('搜索') || l.includes('search') || l.includes('查找'),
      hasGrid: l.includes('网格') || l.includes('grid') || l.includes('布局') || l.includes('board'),
      hasPreview: l.includes('预览') || l.includes('preview') || l.includes('展示'),
      hasTimer2: l.includes('秒表') || l.includes('stopwatch') || l.includes('计时器'),
      isDark: l.includes('暗') || l.includes('dark') || l.includes('黑夜'),
      isNeon: l.includes('霓虹') || l.includes('neon') || l.includes('炫'),
      isMinimal: l.includes('简洁') || l.includes('minimal') || l.includes('简约'),
      isCute: l.includes('可爱') || l.includes('cute') || l.includes('卡通'),
      isRetro: l.includes('复古') || l.includes('retro') || l.includes('怀旧'),
    };
    return c;
  },

  assemble(desc, c) {
    const hue = Math.floor(Math.random() * 360);
    const accent = `hsl(${hue}, 70%, 55%)`;
    const accentLight = `hsl(${hue}, 70%, 65%)`;
    const accentDark = `hsl(${hue}, 80%, 40%)`;
    const bg = c.isDark ? '#0a0a0a' : c.isNeon ? '#0a001a' : c.isMinimal ? '#fafafa' : '#f5f5f5';
    const card = c.isDark ? '#1a1a2e' : c.isMinimal ? '#fff' : '#fff';
    const text = c.isDark ? '#e0e0f0' : c.isMinimal ? '#333' : '#333';
    const muted = c.isDark ? '#666' : '#999';

    let html = '', css = '', js = '';

    if (c.hasTerminal) {
      html = `<div class="vterm"><div class="t-output" id="t-out"></div><div class="t-input-row"><span class="t-prompt">&gt;</span><input id="t-in" class="t-input" autofocus></div></div>`;
      css = `.vterm{font-family:Consolas,monospace;font-size:14px;padding:16px;height:100%;display:flex;flex-direction:column;background:#0a0a1a;color:#00ff88;}.t-output{flex:1;overflow-y:auto;line-height:1.6;}.t-input-row{display:flex;gap:8px;align-items:center;}.t-prompt{color:${accent};font-weight:bold;}.t-input{flex:1;border:none;background:transparent;color:inherit;font:inherit;outline:none;}`;
      js = `(function(){var o=document.getElementById('t-out'),i=document.getElementById('t-in'),h=[];function p(t,c){var d=document.createElement('div');if(c)d.style.color=c;d.textContent=t;o.appendChild(d);o.scrollTop=o.scrollHeight;}p('${desc} Terminal v1.0','#a29bfe');p('Type help for commands\\n');var cmds={help:function(){p('Commands: help, clear, echo, date, neofetch, ascii, joke')},clear:function(){o.innerHTML=''},echo:function(a){p(a.join(' '))},date:function(){p(new Date().toLocaleString('zh-CN'))},neofetch:function(){p('    ___       user@vibeos');p('   /   \\\\      OS: VibeOS 1.0');p('  / VIBE \\\\     Apps: Dynamically Generated');p(' /_______\\\\    Resolution: '+window.innerWidth+'x'+window.innerHeight)},ascii:function(){p('  /\\\\_/\\\\  ');p(' ( o.o )  ');p('  > ^ <   ');p(' /|   |\\\\ ');p('(_|   |_)')},joke:function(){var j=['Why do programmers prefer dark mode? Because light attracts bugs!','There are 10 types of people: those who understand binary and those who don\\'t.','A SQL query walks into a bar, walks up to two tables and asks: Can I join you?'];p(j[Math.floor(Math.random()*j.length)])}};i.addEventListener('keydown',function(e){if(e.key==='Enter'){var cmd=i.value.trim();if(cmd){h.unshift(cmd);p('> '+cmd,'#a29bfe');var parts=cmd.split(/\\s+/),name=parts[0].toLowerCase(),args=parts.slice(1);if(cmds[name])cmds[name](args);else if(name)p('Command not found: '+name,'#e17055');}i.value='';}});})();`;
    }
    else if (c.hasCalc) {
      html = `<div class="calc"><div class="c-expr" id="ce"></div><div class="c-display" id="cd">0</div><div class="c-grid">${['C','±','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','0','.','='].map(b=>`<button class="c-btn${['÷','×','−','+','='].includes(b)?' op':''}" data-v="${b}">${b}</button>`).join('')}</div></div>`;
      css = `.calc{padding:16px;height:100%;display:flex;flex-direction:column;background:${bg};color:${text};}.c-expr{font-size:13px;color:${muted};min-height:18px;text-align:right;padding:0 8px;}.c-display{font-size:36px;font-weight:700;text-align:right;padding:8px 8px 16px;overflow:hidden;}.c-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;flex:1;}.c-btn{border:none;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;padding:12px;background:${card};color:${text};box-shadow:0 2px 4px rgba(0,0,0,.1);transition:transform .1s;}.c-btn:active{transform:scale(.95);}.c-btn.op{background:${accent};color:#fff;box-shadow:0 2px 8px ${accent}40;}`;
      js = `(function(){var cur='0',prev='',op='',nn=true,disp=document.getElementById('cd'),expr=document.getElementById('ce');document.querySelectorAll('.c-btn').forEach(function(b){b.addEventListener('click',function(){var v=b.dataset.v;if(v>='0'&&v<='9'||v==='.'){if(nn){cur=v==='.'?'0.':v;nn=false;}else cur+=v;}else if(v==='C'){cur='0';prev='';op='';expr.textContent='';}else if(v==='±'){cur=String(-parseFloat(cur));}else if(v==='%'){cur=String(parseFloat(cur)/100);}else if(['+','−','×','÷'].indexOf(v)>=0){if(prev&&op&&!nn)cur=String(calc(parseFloat(prev),parseFloat(cur),op));prev=cur;op=v;expr.textContent=prev+' '+v;nn=true;}else if(v==='='){if(prev&&op){expr.textContent=prev+' '+op+' '+cur+' =';cur=String(calc(parseFloat(prev),parseFloat(cur),op));prev='';op='';}}disp.textContent=cur.length>12?parseFloat(cur).toExponential(6):cur;});});function calc(a,b,o){if(o==='+')return a+b;if(o==='−')return a-b;if(o==='×')return a*b;if(o==='÷')return b!==0?a/b:'Error';return b;}})();`;
    }
    else if (c.hasTimer || c.hasTimer2) {
      html = `<div class="timer"><div class="t-time" id="tt">00:00:00</div><div class="t-ms" id="tms">.000</div><div class="t-controls"><button id="tstart" class="t-btn primary">开始</button><button id="treset" class="t-btn">重置</button><button id="tlap" class="t-btn">计次</button></div><div class="t-laps" id="tlaps"></div></div>`;
      css = `.timer{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;padding:24px;background:${bg};color:${text};}.t-time{font-size:64px;font-weight:700;font-variant-numeric:tabular-nums;color:${accent};}.t-ms{font-size:24px;color:${muted};margin-top:-8px;}.t-controls{display:flex;gap:12px;}.t-btn{padding:10px 28px;border-radius:10px;border:2px solid ${accent};background:transparent;color:${text};font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;}.t-btn:hover{background:${accent}10;}.t-btn.primary{background:${accent};color:#fff;border-color:${accent};}.t-btn.primary:hover{background:${accentDark};}.t-laps{width:100%;max-width:300px;overflow-y:auto;max-height:200px;}.t-lap{display:flex;justify-content:space-between;padding:6px 12px;border-bottom:1px solid ${accent}20;font-size:13px;}`;
      js = `(function(){var running=false,start=0,elapsed=0,interval,laps=[],lapId=0;var disp=document.getElementById('tt'),ms=document.getElementById('tms'),lapsDiv=document.getElementById('tlaps');function fmt(ms){var h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000),ml=ms%1000;return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}function tick(){var now=Date.now();elapsed=now-start;disp.textContent=fmt(elapsed);ms.textContent='.'+String(elapsed%1000).padStart(3,'0');}document.getElementById('tstart').addEventListener('click',function(){if(running){clearInterval(interval);running=false;this.textContent='继续';this.classList.remove('primary');}else{start=Date.now()-elapsed;interval=setInterval(tick,10);running=true;this.textContent='暂停';this.classList.add('primary');}});document.getElementById('treset').addEventListener('click',function(){clearInterval(interval);running=false;elapsed=0;start=0;disp.textContent='00:00:00';ms.textContent='.000';laps=[];lapId=0;lapsDiv.innerHTML='';document.getElementById('tstart').textContent='开始';document.getElementById('tstart').classList.add('primary');});document.getElementById('tlap').addEventListener('click',function(){if(!running)return;lapId++;laps.push(elapsed);var d=document.createElement('div');d.className='t-lap';d.innerHTML='<span>#'+lapId+'</span><span>'+fmt(elapsed)+'</span>';lapsDiv.insertBefore(d,lapsDiv.firstChild);});})();`;
    }
    else if (c.hasList) {
      html = `<div class="todo"><div class="t-add"><input id="tin" placeholder="添加新任务..." class="t-input"><button id="tadd" class="t-add-btn" style="background:${accent};color:#fff;border:none;padding:10px 20px;border-radius:8px;font-weight:600;cursor:pointer;">添加</button></div><div id="tlist" class="t-list"></div><div id="tstats" class="t-stats"></div></div>`;
      css = `.todo{padding:16px;height:100%;display:flex;flex-direction:column;background:${bg};color:${text};}.t-add{display:flex;gap:8px;margin-bottom:16px;}.t-input{flex:1;padding:10px 14px;border-radius:8px;border:1px solid #ddd;background:${card};color:${text};font-size:14px;outline:none;}.t-list{flex:1;overflow-y:auto;}.t-item{display:flex;align-items:center;gap:10px;padding:12px;border-radius:8px;margin-bottom:4px;background:${card};border:1px solid #eee;transition:all .2s;}.t-item.done span{text-decoration:line-through;color:${muted};}.t-item span{flex:1;font-size:14px;}.t-item .del{background:none;border:none;color:#e17055;cursor:pointer;font-size:18px;}.t-stats{padding-top:8px;border-top:1px solid #eee;font-size:12px;color:${muted};}`;
      js = `(function(){var todos=[],list=document.getElementById('tlist'),stats=document.getElementById('tstats');function render(){list.innerHTML=todos.length===0?'<div style="text-align:center;color:${muted};padding:40px;">暂无任务，添加一个吧</div>':todos.map(function(t,i){return '<div class="t-item'+(t.done?' done':'')+'"><input type="checkbox" '+((t.done)?'checked':'')+' data-i="'+i+'" style="accent-color:${accent};"><span>'+t.text+'</span><button class="del" data-d="'+i+'">×</button></div>';}).join('');list.querySelectorAll('input[type=checkbox]').forEach(function(cb){cb.addEventListener('change',function(){todos[cb.dataset.i].done=cb.checked;render();});});list.querySelectorAll('.del').forEach(function(b){b.addEventListener('click',function(){todos.splice(b.dataset.d,1);render();});});var done=todos.filter(function(t){return t.done;}).length;stats.textContent=done+'/'+todos.length+' 已完成';}function add(){var inp=document.getElementById('tin');if(inp.value.trim()){todos.push({text:inp.value.trim(),done:false});inp.value='';render();}}document.getElementById('tadd').addEventListener('click',add);document.getElementById('tin').addEventListener('keydown',function(e){if(e.key==='Enter')add();});render();})();`;
    }
    else if (c.hasColor) {
      html = `<div class="cpicker"><canvas id="cpw" width="200" height="200" class="cp-wheel"></canvas><div class="cp-right"><div id="cpp" class="cp-preview" style="background:${accent};"></div><div class="cp-row"><label>HEX</label><input id="cph" value="${accent}" class="cp-input" readonly></div><div class="cp-row"><label>RGB</label><input id="cpr" class="cp-input" readonly></div><button id="cpc" class="cp-copy" style="background:${accent};color:#fff;border:none;padding:10px;border-radius:8px;cursor:pointer;font-weight:600;">复制</button></div></div>`;
      css = `.cpicker{padding:20px;display:flex;gap:16px;height:100%;background:${bg};color:${text};}.cp-wheel{border-radius:12px;cursor:crosshair;}.cp-right{flex:1;display:flex;flex-direction:column;gap:12px;}.cp-preview{height:80px;border-radius:12px;border:1px solid #eee;}.cp-row{display:flex;flex-direction:column;gap:4px;}.cp-row label{font-size:12px;color:${muted};}.cp-input{padding:8px;border-radius:6px;border:1px solid #eee;background:${card};color:${text};font-family:monospace;font-size:14px;outline:none;}.cp-copy{flex:0;}`;
      js = `(function(){var cv=document.getElementById('cpw'),cx=cv.getContext('2d'),img=cx.createImageData(200,200);for(var y=0;y<200;y++)for(var x=0;x<200;x++){var dx=x-100,dy=y-100,d=Math.sqrt(dx*dx+dy*dy);if(d<=100){var a=Math.atan2(dy,dx),h=((a*180/Math.PI)+360)%360,s=d/100,l=.55,h2=h/360,q=l<.5?l*(1+s):l+s-l*s,p2=2*l-q;function h2r(p,q,t){if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<.5)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;}var r=Math.round(h2r(p2,q,h2+1/3)*255),g=Math.round(h2r(p2,q,h2)*255),b=Math.round(h2r(p2,q,h2-1/3)*255),i=(y*200+x)*4;img.data[i]=r;img.data[i+1]=g;img.data[i+2]=b;img.data[i+3]=255;}}cx.putImageData(img,0,0);cv.addEventListener('click',function(e){var rect=cv.getBoundingClientRect(),px=Math.round((e.clientX-rect.left)*200/rect.width),py=Math.round((e.clientY-rect.top)*200/rect.height);if(px<0||px>=200||py<0||py>=200)return;var pd=cx.getImageData(px,py,1,1).data;if(pd[3]===0)return;var hex='#'+[pd[0],pd[1],pd[2]].map(function(v){return v.toString(16).padStart(2,'0');}).join('');document.getElementById('cpp').style.background=hex;document.getElementById('cph').value=hex;document.getElementById('cpr').value='rgb('+pd[0]+','+pd[1]+','+pd[2]+')';});document.getElementById('cpc').addEventListener('click',function(){navigator.clipboard.writeText(document.getElementById('cph').value);this.textContent='已复制!';var self=this;setTimeout(function(){self.textContent='复制';},1500);});})();`;
    }
    else if (c.hasNote) {
      html = `<div class="notepad"><div class="np-bar"><button id="npnew" class="np-btn">新建</button><button id="npcopy" class="np-btn">复制</button><span id="npinfo" class="np-info"></span></div><textarea id="nptxt" class="np-text" placeholder="在这里输入文本..."></textarea></div>`;
      css = `.notepad{display:flex;flex-direction:column;height:100%;background:${bg};color:${text};}.np-bar{padding:8px 12px;display:flex;gap:8px;border-bottom:1px solid #eee;}.np-btn{padding:4px 12px;border-radius:6px;border:1px solid #ddd;background:transparent;color:${text};cursor:pointer;font-size:12px;}.np-info{margin-left:auto;font-size:11px;color:${muted};align-self:center;}.np-text{flex:1;border:none;background:transparent;color:${text};font-family:Consolas,monospace;font-size:14px;padding:12px;resize:none;outline:none;line-height:1.6;}`;
      js = `(function(){var ta=document.getElementById('nptxt'),info=document.getElementById('npinfo');function upd(){var t=ta.value;info.textContent=t.length+' chars · '+t.split('\\n').length+' lines';}ta.addEventListener('input',upd);document.getElementById('npnew').addEventListener('click',function(){ta.value='';upd();});document.getElementById('npcopy').addEventListener('click',function(){navigator.clipboard.writeText(ta.value);this.textContent='已复制!';var self=this;setTimeout(function(){self.textContent='复制';},1500);});upd();})();`;
    }
    else if (c.hasClock) {
      html = `<div class="clock"><div class="ck-digital" id="ckd"></div><div class="ck-date" id="ckdt"></div><canvas id="ckc" width="220" height="220" class="ck-face"></canvas></div>`;
      css = `.clock{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:20px;background:${bg};color:${text};}.ck-digital{font-size:56px;font-weight:700;font-variant-numeric:tabular-nums;color:${accent};}.ck-date{font-size:15px;color:${muted};}.ck-face{margin-top:10px;}`;
      js = `(function(){var cv=document.getElementById('ckc'),cx=cv.getContext('2d');function draw(){var n=new Date(),h=n.getHours(),m=n.getMinutes(),s=n.getSeconds();document.getElementById('ckd').textContent=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');var days=['日','一','二','三','四','五','六'];document.getElementById('ckdt').textContent=n.getFullYear()+'年'+(n.getMonth()+1)+'月'+n.getDate()+'日 星期'+days[n.getDay()];cx.clearRect(0,0,220,220);cx.beginPath();cx.arc(110,110,100,0,Math.PI*2);cx.fillStyle='rgba(108,92,231,0.08)';cx.fill();cx.strokeStyle='${accent}60';cx.lineWidth=2;cx.stroke();for(var i=1;i<=12;i++){var a=(i*30-90)*Math.PI/180;cx.fillStyle='${text}';cx.font='14px sans-serif';cx.textAlign='center';cx.textBaseline='middle';cx.fillText(String(i),110+82*Math.cos(a),110+82*Math.sin(a));}function hand(a,l,w,c){cx.beginPath();cx.moveTo(110,110);cx.lineTo(110+l*Math.cos(a),110+l*Math.sin(a));cx.strokeStyle=c;cx.lineWidth=w;cx.lineCap='round';cx.stroke();}hand(((h%12)+m/60)*30*Math.PI/180-Math.PI/2,50,4,'${accentLight}');hand((m+s/60)*6*Math.PI/180-Math.PI/2,70,3,'${accent}');hand(s*6*Math.PI/180-Math.PI/2,80,1.5,'#e17055');cx.beginPath();cx.arc(110,110,5,0,Math.PI*2);cx.fillStyle='${accent}';cx.fill();}draw();setInterval(draw,1000);})();`;
    }
    else if (c.hasDraw) {
      html = `<div class="draw"><div class="dr-bar"><input type="color" id="drc" value="${accent}" class="dr-color"><input type="range" id="drs" min="1" max="20" value="3" class="dr-size"><button id="drclear" class="dr-btn">清空</button></div><canvas id="drcv" class="dr-canvas"></canvas></div>`;
      css = `.draw{display:flex;flex-direction:column;height:100%;background:${bg};}.dr-bar{padding:8px 12px;display:flex;gap:8px;align-items:center;border-bottom:1px solid #eee;}.dr-color{width:32px;height:28px;border:none;cursor:pointer;}.dr-size{width:80px;accent-color:${accent};}.dr-btn{padding:4px 12px;border-radius:6px;border:1px solid #ddd;background:transparent;color:${text};cursor:pointer;font-size:12px;margin-left:auto;}.dr-canvas{flex:1;cursor:crosshair;background:${c.isMinimal?'#fff':'#0a0a1a'};}`;
      js = `(function(){var cv=document.getElementById('drcv'),cx=cv.getContext('2d'),drawing=false;function resize(){var r=cv.parentElement.getBoundingClientRect();cv.width=r.width;cv.height=r.height-44;}resize();new ResizeObserver(resize).observe(cv.parentElement);cx.lineCap='round';cv.addEventListener('mousedown',function(e){drawing=true;cx.beginPath();cx.moveTo(e.offsetX,e.offsetY);});cv.addEventListener('mousemove',function(e){if(!drawing)return;cx.lineTo(e.offsetX,e.offsetY);cx.strokeStyle=document.getElementById('drc').value;cx.lineWidth=document.getElementById('drs').value;cx.stroke();});cv.addEventListener('mouseup',function(){drawing=false;});cv.addEventListener('mouseleave',function(){drawing=false;});document.getElementById('drclear').addEventListener('click',function(){cx.clearRect(0,0,cv.width,cv.height);});})();`;
    }
    else if (c.hasPassword) {
      html = `<div class="pwdgen"><div class="pg-out" id="pgout"></div><div class="pg-controls"><div class="pg-row"><span>长度</span><span id="pglen" style="color:${accent};font-weight:700;">16</span></div><input type="range" id="pglr" min="4" max="64" value="16" style="width:100%;accent-color:${accent};"><label style="font-size:13px;display:flex;align-items:center;gap:8px;"><input type="checkbox" id="pgu" checked> 大写</label><label style="font-size:13px;display:flex;align-items:center;gap:8px;"><input type="checkbox" id="pgl" checked> 小写</label><label style="font-size:13px;display:flex;align-items:center;gap:8px;"><input type="checkbox" id="pgn" checked> 数字</label><label style="font-size:13px;display:flex;align-items:center;gap:8px;"><input type="checkbox" id="pgs" checked> 符号</label></div><div style="display:flex;gap:10px;"><button id="pggen" style="flex:1;padding:10px;border-radius:8px;border:none;background:${accent};color:#fff;font-weight:600;cursor:pointer;">生成</button><button id="pgcp" style="flex:1;padding:10px;border-radius:8px;border:1px solid #ddd;background:transparent;color:${text};cursor:pointer;">复制</button></div></div>`;
      css = `.pwdgen{padding:24px;display:flex;flex-direction:column;gap:16px;align-items:center;background:${bg};color:${text};}.pg-out{font-size:20px;font-family:monospace;background:${card};padding:16px 24px;border-radius:8px;border:1px solid #eee;width:100%;text-align:center;word-break:break-all;min-height:56px;display:flex;align-items:center;justify-content:center;}.pg-controls{width:100%;display:flex;flex-direction:column;gap:10px;}.pg-row{display:flex;justify-content:space-between;font-size:13px;}`;
      js = `(function(){function gen(){var len=parseInt(document.getElementById('pglr').value);document.getElementById('pglen').textContent=len;var chars='';if(document.getElementById('pgu').checked)chars+='ABCDEFGHIJKLMNOPQRSTUVWXYZ';if(document.getElementById('pgl').checked)chars+='abcdefghijklmnopqrstuvwxyz';if(document.getElementById('pgn').checked)chars+='0123456789';if(document.getElementById('pgs').checked)chars+='!@#$%^&*()_+-=[]{}|;:,.<>?';if(!chars)chars='abcdefghijklmnopqrstuvwxyz';var pw='';for(var i=0;i<len;i++)pw+=chars[Math.floor(Math.random()*chars.length)];document.getElementById('pgout').textContent=pw;}document.getElementById('pggen').addEventListener('click',gen);document.getElementById('pglr').addEventListener('input',function(){document.getElementById('pglen').textContent=this.value;gen();});document.getElementById('pgcp').addEventListener('click',function(){navigator.clipboard.writeText(document.getElementById('pgout').textContent);this.textContent='已复制!';var self=this;setTimeout(function(){self.textContent='复制';},1500);});gen();})();`;
    }
    else if (c.hasWeather) {
      html = `<div class="weather"><div class="w-search"><input id="ws" placeholder="搜索城市..." class="w-input"><button id="wr" style="background:${accent};color:#fff;border:none;padding:10px 16px;border-radius:8px;cursor:pointer;">刷新</button></div><div id="wmain" class="w-grid"></div></div>`;
      css = `.weather{padding:20px;height:100%;display:flex;flex-direction:column;gap:16px;background:${bg};color:${text};}.w-search{display:flex;gap:12px;}.w-input{flex:1;padding:10px 14px;border-radius:8px;border:1px solid #eee;background:${card};color:${text};font-size:14px;outline:none;}.w-grid{display:flex;gap:12px;flex-wrap:wrap;flex:1;overflow-y:auto;}.w-card{background:${card};border:1px solid #eee;border-radius:12px;padding:16px;min-width:130px;flex:1;}.w-city{font-size:12px;color:${muted};}.w-icon{font-size:32px;margin:8px 0;}.w-temp{font-size:22px;font-weight:700;}.w-desc{font-size:11px;color:${muted};margin-top:4px;}`;
      js = `(function(){var cities=['北京','上海','深圳','杭州','成都','广州','武汉','西安','南京','重庆'];var icons=['☀️','⛅','🌧️','🌫️','🌤️','⛈️','🌈','❄️','💨','🌊'];function render(){var q=document.getElementById('ws').value.trim();var list=q?[q]:cities;document.getElementById('wmain').innerHTML=list.map(function(c){var icon=icons[Math.floor(Math.random()*icons.length)];var temp=Math.floor(Math.random()*35)+0;var hum=Math.floor(Math.random()*60)+30;return '<div class="w-card"><div class="w-city">'+c+'</div><div class="w-icon">'+icon+'</div><div class="w-temp">'+temp+'°C</div><div class="w-desc">湿度 '+hum+'%</div></div>';}).join('');}document.getElementById('wr').addEventListener('click',render);render();})();`;
    }
    else if (c.hasCalendar) {
      html = `<div class="cal"><div class="cl-nav"><button id="clp" class="cl-btn">◀</button><span id="cly" class="cl-title"></span><button id="cln" class="cl-btn">▶</button></div><div id="clgrid" class="cl-grid"></div></div>`;
      css = `.cal{padding:16px;height:100%;display:flex;flex-direction:column;background:${bg};color:${text};}.cl-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}.cl-btn{background:none;border:none;color:${text};font-size:20px;cursor:pointer;}.cl-title{font-size:18px;font-weight:700;}.cl-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;}.cl-head{padding:8px;font-size:12px;color:${muted};font-weight:600;}.cl-day{padding:10px;border-radius:8px;font-size:14px;cursor:pointer;transition:background .2s;}.cl-day:hover{background:${accent}15;}.cl-day.today{background:${accent};color:#fff;font-weight:700;}`;
      js = `(function(){var now=new Date(),year=now.getFullYear(),month=now.getMonth();function render(){var grid=document.getElementById('clgrid');var first=new Date(year,month,1).getDay();var days=new Date(year,month+1,0).getDate();var names=['日','一','二','三','四','五','六'];document.getElementById('cly').textContent=year+'年'+(month+1)+'月';var h=names.map(function(n){return '<div class="cl-head">'+n+'</div>';}).join('');for(var i=0;i<first;i++)h+='<div></div>';for(var d=1;d<=days;d++){var isToday=d===now.getDate()&&month===now.getMonth()&&year===now.getFullYear();h+='<div class="cl-day'+(isToday?' today':'')+'">'+d+'</div>';}grid.innerHTML=h;}document.getElementById('clp').addEventListener('click',function(){month--;if(month<0){month=11;year--;}render();});document.getElementById('cln').addEventListener('click',function(){month++;if(month>11){month=0;year++;}render();});render();})();`;
    }
    else if (c.hasGame) {
      html = `<div class="game"><div class="g-score" id="gs">得分: 0</div><canvas id="gcv" width="400" height="400" class="g-canvas"></canvas><div class="g-hint">方向键 / WASD</div></div>`;
      css = `.game{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;padding:16px;background:${bg};color:${text};}.g-score{font-size:14px;color:${muted};}.g-canvas{border:1px solid #eee;border-radius:8px;background:${card};}.g-hint{font-size:11px;color:${muted};}`;
      js = `(function(){var cv=document.getElementById('gcv'),cx=cv.getContext('2d'),gs=20,snake,food,dir,ndir,score,over,interval;function init(){snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}];dir={x:1,y:0};ndir=dir;score=0;over=false;document.getElementById('gs').textContent='得分: 0';placeFood();if(interval)clearInterval(interval);interval=setInterval(step,120);}function placeFood(){do{food={x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*20)};}while(snake.some(function(s){return s.x===food.x&&s.y===food.y;}));}function step(){if(over)return;dir=ndir;var head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};if(head.x<0||head.x>=20||head.y<0||head.y>=20||snake.some(function(s){return s.x===head.x&&s.y===head.y;})){over=true;clearInterval(interval);cx.fillStyle='rgba(0,0,0,.5)';cx.fillRect(0,0,400,400);cx.fillStyle='#e17055';cx.font='24px sans-serif';cx.textAlign='center';cx.fillText('游戏结束!',200,200);return;}snake.unshift(head);if(head.x===food.x&&head.y===food.y){score+=10;document.getElementById('gs').textContent='得分: '+score;placeFood();}else snake.pop();draw();}function draw(){cx.clearRect(0,0,400,400);snake.forEach(function(s,i){cx.fillStyle=i===0?'${accent}':'${accentLight}';cx.fillRect(s.x*gs+1,s.y*gs+1,gs-2,gs-2);if(i===0){cx.fillStyle='#fff';cx.fillRect(s.x*gs+4,s.y*gs+4,4,4);cx.fillRect(s.x*gs+12,s.y*gs+4,4,4);}});cx.fillStyle='#e17055';cx.beginPath();cx.arc(food.x*gs+gs/2,food.y*gs+gs/2,gs/2-2,0,Math.PI*2);cx.fill();}document.addEventListener('keydown',function(e){var k=e.key.toLowerCase();if((k==='arrowup'||k==='w')&&dir.y!==1)ndir={x:0,y:-1};else if((k==='arrowdown'||k==='s')&&dir.y!==-1)ndir={x:0,y:1};else if((k==='arrowleft'||k==='a')&&dir.x!==1)ndir={x:-1,y:0};else if((k==='arrowright'||k==='d')&&dir.x!==-1)ndir={x:1,y:0};});init();})();`;
    }
    else if (c.hasSearch) {
      html = `<div class="search"><div class="s-bar"><input id="si" placeholder="搜索..." class="s-input" autofocus></div><div id="sresults" class="s-results"></div></div>`;
      css = `.search{padding:24px;height:100%;display:flex;flex-direction:column;gap:16px;background:${bg};color:${text};}.s-bar{display:flex;gap:8px;}.s-input{flex:1;padding:12px 16px;border-radius:12px;border:2px solid #eee;background:${card};color:${text};font-size:16px;outline:none;transition:border-color .2s;}.s-input:focus{border-color:${accent};}.s-results{flex:1;overflow-y:auto;}.s-item{padding:12px;border-radius:8px;margin-bottom:8px;background:${card};border:1px solid #eee;cursor:pointer;transition:all .2s;}.s-item:hover{border-color:${accent};box-shadow:0 2px 8px ${accent}20;}.s-item-title{font-weight:600;margin-bottom:4px;}.s-item-desc{font-size:13px;color:${muted};}`;
      js = `(function(){var items=[{t:'欢迎使用 VibeOS',d:'这是一个由实时代码生成引擎驱动的操作系统'},{t:'输入任意描述',d:'Vibe 引擎会根据你的描述动态生成全新应用'},{t:'实时代码生成',d:'每次生成都会创建独一无二的代码'},{t:'支持多种组件',d:'计时器、计算器、笔记、画板、游戏等'},{t:'自定义样式',d:'描述中包含颜色、风格关键词可改变外观'}];function search(q){var results=items.filter(function(it){return!q||it.t.toLowerCase().includes(q.toLowerCase())||it.d.toLowerCase().includes(q.toLowerCase());});document.getElementById('sresults').innerHTML=results.length?results.map(function(it){return '<div class="s-item"><div class="s-item-title">'+it.t+'</div><div class="s-item-desc">'+it.d+'</div></div>';}).join(''):'<div style="text-align:center;color:${muted};padding:40px;">无结果</div>';}document.getElementById('si').addEventListener('input',function(){search(this.value);});search('');})();`;
    }
    else {
      html = `<div class="gen-app"><div class="ga-icon">⚡</div><div class="ga-title">${desc}</div><div class="ga-desc">这是一个由 Vibe 引擎实时生成的应用</div><div class="ga-meta">生成时间: ${new Date().toLocaleTimeString('zh-CN')} · 样式: ${c.isDark?'暗色':c.isNeon?'霓虹':c.isMinimal?'简约':'默认'}</div><div class="ga-actions"><button id="ga1" class="ga-btn" style="background:${accent};color:#fff;border:none;padding:10px 24px;border-radius:8px;font-weight:600;cursor:pointer;">交互测试</button></div><div id="ga2" class="ga-output"></div></div>`;
      css = `.gen-app{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;padding:24px;background:${bg};color:${text};text-align:center;}.ga-icon{font-size:48px;}.ga-title{font-size:20px;font-weight:700;}.ga-desc{color:${muted};font-size:14px;max-width:300px;}.ga-meta{font-size:12px;color:${muted};background:${card};padding:8px 16px;border-radius:8px;border:1px solid #eee;}.ga-actions{margin-top:8px;}.ga-output{margin-top:8px;font-size:13px;color:${accent};min-height:20px;}`;
      js = `(function(){var n=0;document.getElementById('ga1').addEventListener('click',function(){n++;document.getElementById('ga2').textContent='点击次数: '+n+' · 随机数: '+Math.floor(Math.random()*1000);});})();`;
    }

    return { html, css, js };
  },

  showTypingAnimation(body, code, callback) {
    const fullCode = `<!DOCTYPE html><html><head><style>${code.css}</style></head><body>${code.html}<script>${code.js}<\/script></body></html>`;

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;background:#0a0a1a;color:#00ff88;font-family:Consolas,monospace;">
        <div style="padding:8px 12px;border-bottom:1px solid #1a1a3e;display:flex;align-items:center;gap:8px;">
          <span style="color:#e17055;">●</span><span style="color:#fdcb6e;">●</span><span style="color:#00b894;">●</span>
          <span style="flex:1;text-align:center;font-size:12px;color:#888;">VibeEngine — 正在生成代码...</span>
        </div>
        <div id="code-view" style="flex:1;overflow:auto;padding:12px;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-all;"></div>
        <div style="padding:8px 12px;border-top:1px solid #1a1a3e;font-size:11px;color:#666;display:flex;justify-content:space-between;">
          <span id="typing-status">生成中...</span>
          <span id="typing-pct">0%</span>
        </div>
      </div>`;

    const view = body.querySelector('#code-view');
    const status = body.querySelector('#typing-status');
    const pct = body.querySelector('#typing-pct');
    let i = 0;
    const chunk = 8;
    const speed = 3;

    function type() {
      const end = Math.min(i + chunk, fullCode.length);
      view.textContent += fullCode.slice(i, end);
      i = end;
      const progress = Math.floor((i / fullCode.length) * 100);
      pct.textContent = progress + '%';
      view.scrollTop = view.scrollHeight;

      if (i < fullCode.length) {
        setTimeout(type, speed);
      } else {
        status.textContent = '生成完成!';
        setTimeout(() => {
          body.innerHTML = '';
          callback();
        }, 400);
      }
    }
    type();
  },

  renderApp(body, html, css, js) {
    body.innerHTML = `<iframe style="width:100%;height:100%;border:none;" sandbox="allow-scripts"></iframe>`;
    const iframe = body.querySelector('iframe');
    const doc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box;}html,body{width:100%;height:100%;overflow:hidden;}</style><style>${css}</style></head><body>${html}<script>${js}<\/script></body></html>`;
    iframe.srcdoc = doc;
  },

  saveUserApp(id, description, code) {
    const apps = JSON.parse(localStorage.getItem('vibeos_user_apps') || '{}');
    apps[id] = { description, code, timestamp: Date.now() };
    localStorage.setItem('vibeos_user_apps', JSON.stringify(apps));
  }
};

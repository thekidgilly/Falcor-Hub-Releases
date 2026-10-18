// Falcor.Hub's window. Everything goes through window.hub.call(name, args); the page has no Node and no network.
// Structure is built once; each status update changes only the text, attributes and list rows that changed (Pixel.keyed),
// so animations never replay, and scroll and focus stay where they are.
const P = window.Pixel; P.sprite();
const $ = id => document.getElementById(id);
const {esc, text, attr, cls, keyed, htmlOnce, roll, icon} = P;
const time = at => new Date(at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
const when = at => { if (!at) return ''; const m = Math.round((at - Date.now()) / 60000); return m <= 0 ? 'now' : m < 60 ? 'in ' + m + ' min' : m < 36 * 60 ? 'in ' + Math.round(m / 60) + ' h' : new Date(at).toLocaleDateString(); };
const clock = ms => { const t = Math.floor(Math.max(0, ms) / 1000); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const dur = ms => { const m = Math.round(ms / 60000); return m < 60 ? m + ' m' : Math.floor(m / 60) + ' h ' + (m % 60) + ' m'; };
const money = v => '$' + (v < 0.01 && v > 0 ? v.toFixed(3) : v.toFixed(2));
const errText = e => String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
let S = null, tab = 'phone', deviceId = null, controlling = false;

async function call(name, args) {
  try { return await window.hub.call(name, args); }
  catch (e) { toast(errText(e), 'bad'); throw e; }
}
// Toasts: green done, sand attention, red errors (errors stay until closed). No layout shift.
function toast(msg, kind = 'ok') {
  const t = P.el('<div class="toast ' + (kind === 'bad' ? 'bad' : kind === 'warn' ? 'warn' : '') + '"><span class="led ' + (kind === 'bad' ? 'bad' : kind === 'warn' ? 'warn' : 'on') + '"></span><span>' + esc(msg) + '</span><button class="ghost small" title="Close">×</button></div>');
  t.querySelector('button').onclick = () => t.remove();
  $('toasts').appendChild(t);
  while ($('toasts').children.length > 4) $('toasts').firstElementChild.remove();
  if (kind !== 'bad') setTimeout(() => t.remove(), kind === 'warn' ? 7000 : 4000);
}
const flash = (m, bad) => toast(m, bad ? 'bad' : 'ok');
// −/+ pixel buttons for number inputs (the browser's spinners are hidden).
function numbers(root = document) {
  for (const inp of root.querySelectorAll('input[type=number]:not([data-num])')) {
    inp.dataset.num = '1';
    const w = P.el('<span class="num"><button type="button" class="small" tabindex="-1">' + icon('minus') + '</button><button type="button" class="small" tabindex="-1">' + icon('plus') + '</button></span>');
    inp.replaceWith(w); w.insertBefore(inp, w.lastElementChild);
    const step = d => { const s = Number(inp.step) || 1, v = (Number(inp.value) || 0) + d * (inp.step === 'any' ? 1 : s); inp.value = String(Math.max(Number(inp.min || -Infinity), v)); inp.dispatchEvent(new Event('input')); };
    w.firstElementChild.onclick = () => step(-1); w.lastElementChild.onclick = () => step(1);
  }
}
numbers();

// ------------------------------------------------------------------ tabs, keys, intro
const TABS = ['phone', 'sandbox', 'games', 'tasks', 'falcor', 'knowledge', 'stats', 'settings'];
function go(name, sub) {
  if (!TABS.includes(name)) return;
  if (name !== tab && !P.reduced()) { const w = P.el('<div class="wipe"><i></i><i></i><i></i><i></i></div>'); document.body.appendChild(w); setTimeout(() => w.remove(), 260); }
  tab = name;
  document.querySelectorAll('.tabs button').forEach(x => cls(x, 'on', x.dataset.tab === tab));
  document.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== tab; });
  if (sub) setSub(sub);
  if (window.sbPlace) sbPlace(tab);
  placeTabline(); render();
  if (tab === 'falcor') openChat();
}
function placeTabline() { const b = document.querySelector('.tabs button.on'); if (b) { $('tabline').style.width = b.offsetWidth + 'px'; $('tabline').style.transform = 'translateX(' + b.offsetLeft + 'px)'; } }
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => go(b.dataset.tab));
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const [t, s] = b.dataset.go.split(':'); go(t, s); });
window.addEventListener('resize', placeTabline);
const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
window.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && (e.key === 'X' || e.key === 'x')) { e.preventDefault(); void stopAll(); return; }
  if (e.ctrlKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); go('falcor'); $('chattext').focus(); return; }
  if (!typing() && !e.ctrlKey && !e.altKey && !e.metaKey && /^[1-8]$/.test(e.key) && document.activeElement !== $('mirrorbox')) go(TABS[Number(e.key) - 1]);
});
if (!/nointro/.test(location.search)) void P.intro({dragon: 'dragon.png', version: '', sub: 'PHONE CONTROL'});
setTimeout(placeTabline, 50);

// ------------------------------------------------------------------ status
window.hub.onStatus(s => { if (s) { S = s; render(); } });
call('status').then(s => { S = s; render(); }).catch(() => {});
setInterval(() => window.hub.call('status').then(s => { if (s) { S = s; render(); } }).catch(() => {}), 5000);
const dev = () => S && (S.devices.find(d => d.id === deviceId) || S.devices[0]) || null;
let wasEmergency = false, prevStates = new Map(), autoSeen = null;
function render() {
  if (!S) return;
  const d = dev(); deviceId = d ? d.id : null;
  const human = !!(d && d.control && d.control.kind === 'human');
  if (controlling !== human) controlling = human;
  const em = S.devices.some(x => x.emergency), auto = S.devices.some(x => x.autopilot), waiting = S.tasks.filter(t => t.state === 'NEEDS_REVIEW' || t.state === 'NEEDS_ATTENTION').length;
  // Header: the living logo's eye, the system strip, Stop and the emergency bar.
  cls($('logo'), 'live', auto && !waiting); cls($('logo'), 'wait', waiting > 0);
  setLed('led-phone', d ? d.connected && d.authorized ? 'on' : 'warn' : 'bad'); text($('sys-phone'), d ? d.connected && d.authorized ? d.label : d.connected ? 'Allow USB debugging' : 'Not connected' : 'No phone');
  setLed('led-auto', auto ? 'on' : ''); text($('sys-auto'), 'Autopilot ' + (auto ? 'on' : 'off'));
  setLed('led-kimi', S.kimi.configured ? (S.kimi.test && !S.kimi.test.ok ? 'bad' : 'on') : 'warn'); text($('sys-kimi'), S.kimi.configured ? 'Kimi' : 'Kimi not set');
  setLed('led-remote', S.remote.phones.some(p => Date.now() - p.lastSeenAt < 90_000) ? 'on' : ''); text($('sys-remote'), 'Remote' + (S.remote.phones.length ? ' · ' + S.remote.phones.length : ''));
  if (em && !wasEmergency) { document.body.classList.remove('glitch'); void document.body.offsetWidth; document.body.classList.add('glitch'); $('ebar').classList.add('stepin'); }
  wasEmergency = em; $('ebar').hidden = !em;
  // Badges.
  setBadge('badge-tasks', waiting); setBadge('badge-falcor', S.chat.unread && tab !== 'falcor' ? S.chat.unread : 0);
  // Updates: a slim strip that never moves the layout much.
  const u = S.update, running = S.devices.some(x => x.running), ready = u && u.state === 'ready';
  $('notice').hidden = !(ready || S.whatsNew);
  if (ready) { text($('noticetext'), 'Falcor.Hub ' + u.version + ' is ready.' + (running ? ' It installs when no task is running.' : ' Restart takes a few seconds; your tasks and settings are kept.')); $('updatebtn').hidden = false; $('updatebtn').disabled = running; }
  else if (S.whatsNew) { text($('noticetext'), 'What\'s new in ' + S.whatsNew.version + ': ' + (S.whatsNew.notes || 'Improvements and fixes.')); $('updatebtn').hidden = false; $('updatebtn').disabled = false; text($('updatebtn'), 'Got it'); }
  renderStatusbar(d);
  renderTeach();
  // A Teach session Falcor started for a new task: show the mirror so the owner can play.
  const learning = S.teaching && S.teaching.auto ? S.teaching.id : null, was = autoSeen;
  autoSeen = learning;
  if (learning && learning !== was) { toast('Falcor opened ' + S.teaching.name + ' and is recording. Play it on the mirror; when you leave the game, Falcor studies it and adds it to Games.'); if (tab !== 'sandbox') { go('sandbox'); if (window.sbMode) sbMode('teach'); return; } }
  if (!learning && was) toast('Teaching ended. If you played, Falcor is studying it; the game shows in Games with its guide.');
  // Success moments: a task that just became verified bursts.
  for (const t of S.tasks) { const was = prevStates.get(t.id); if (was && was !== t.state && /VERIFIED|RECEIVED/.test(t.state)) setTimeout(() => P.burst(document.querySelector('.task[data-key="' + t.id + '"]') || $('tiles') || $('logo')), 50); prevStates.set(t.id, t.state); }
  if (tab === 'phone') renderPhone(d);
  if (tab === 'sandbox' && window.renderSandbox) renderSandbox(d);
  if (tab === 'games') renderGames();
  if (tab === 'tasks') renderTasks();
  if (tab === 'falcor') renderChatMeta();
  if (tab === 'knowledge') renderLearn();
  if (tab === 'stats') renderStats();
  if (tab === 'settings') renderSettings();
}
function setLed(id, state) { const l = $(id); if (l) l.className = 'led' + (state ? ' ' + state : ''); }
function setBadge(id, n) { const b = $(id); b.hidden = !n; text(b, n || ''); }
function renderStatusbar(d) {
  const u = S.update, upd = !u ? '' : u.state === 'dev' ? 'dev build' : u.state === 'ready' ? u.version + ' ready' : u.state === 'downloading' ? 'downloading ' + (u.percent ?? 0) + '%' : u.state === 'checking' ? 'checking' : u.state === 'error' ? 'update error' : 'up to date';
  htmlOnce($('statusbar'), [
    '<span><i class="led ' + (S.adb ? 'on' : 'bad') + '"></i>adb ' + (S.adb ? 'ready' : 'missing') + '</span>',
    '<span><i class="led ' + (S.scrcpy ? 'on' : '') + '"></i>scrcpy ' + (S.scrcpy ? 'ready' : 'missing') + '</span>',
    '<span id="fps">' + esc(fpsText) + '</span>',
    '<span>' + icon('ai') + esc(S.kimi.model) + (S.kimi.lastReplyAt ? ' · last reply ' + time(S.kimi.lastReplyAt) : '') + '</span>',
    '<span>' + icon('wifi') + S.remote.phones.length + ' paired</span>',
    d && d.battery !== null && d.battery !== undefined ? '<span>battery ' + d.battery + '%</span>' : '',
    '<span class="right">v' + esc(S.version) + (S.simulated ? ' · simulated phone' : '') + ' · ' + esc(upd) + '</span>',
  ].join(''));
}
let fpsText = '';
function setFps(t) { fpsText = t; const f = $('fps'); if (f) text(f, t); }
$('updatebtn').onclick = () => S && S.update && S.update.state === 'ready' ? call('updateRestart') : call('dismissWhatsNew');
async function stopAll() {
  const em = S && S.devices.some(x => x.emergency);
  if (em) return;
  await call('stopAll'); toast('Emergency Stop: every phone stopped, Autopilot off.', 'bad');
}
$('stop').onclick = () => stopAll();
$('clear').onclick = async () => { $('ebar').classList.add('stepout'); await call('clear'); document.querySelectorAll('.toast.bad').forEach(t => t.remove()); $('ebar').classList.remove('stepout', 'stepin'); toast('Emergency Stop cleared. Turn Autopilot on again when you are ready.'); };

// ------------------------------------------------------------------ phone
function renderPhone(d) {
  const ready = !!(d && d.connected && d.authorized && !d.locked);
  const steps = [
    ['Connect the phone with a USB-C cable that carries data', !!(d && d.connected), 'Many cables only charge. Try another cable or port.'],
    ['Turn on USB debugging and tap Allow on the phone', !!(d && d.authorized), 'See "Settings for total control" below.'],
    ['Unlock the phone', !!(d && d.authorized && !d.locked), 'Falcor never unlocks it for you.'],
  ];
  const first = steps.findIndex(s => !s[1]);
  htmlOnce($('checks'), steps.map(([t, ok, hint], i) => '<li class="' + (ok ? 'done' : i === first ? 'now' : '') + '">' + (ok ? icon('check') : '<span class="led ' + (i === first ? 'warn' : '') + '"></span>') + '<span>' + esc(t) + (i === first ? '<br><span class="muted small">' + esc(hint) + '</span>' : '') + '</span></li>').join('') + (!S.adb ? '<li class="now red">Android platform tools are missing from this install. Reinstall Falcor.Hub.</li>' : ''));
  $('setup').hidden = ready; $('phonegrid').hidden = !ready;
  if (!ready) return;
  $('devpick').hidden = S.devices.length < 2;
  if (S.devices.length > 1) htmlOnce($('devpick'), S.devices.map(x => '<option value="' + esc(x.id) + '"' + (x.id === d.id ? ' selected' : '') + '>' + esc(x.label) + '</option>').join(''));
  text($('devname'), d.label);
  const st = d.emergency ? ['bad', 'Emergency Stop'] : d.teaching ? ['rec', 'Teaching'] : d.control && d.control.kind === 'human' ? ['warn', 'You have control'] : d.running ? ['on', 'Running a task'] : d.autopilot ? ['on', 'Autopilot on'] : ['', 'Ready'];
  $('devstate').firstElementChild.className = 'led ' + st[0]; text($('devstate').lastElementChild, st[1]);
  text($('d-model'), d.model || '—'); text($('d-android'), d.androidVersion || '—');
  htmlOnce($('d-app'), d.foreground ? esc(d.foregroundName || d.foreground) + '<small>' + esc(d.foreground) + '</small>' : '—');
  $('d-batt').hidden = $('d-batt-l').hidden = d.battery === null || d.battery === undefined; text($('d-batt'), d.battery != null ? d.battery + '%' : '');
  text($('d-control'), d.control ? (d.control.kind === 'human' ? 'You' : 'Falcor') : 'Falcor idle');
  text($('autolabel'), d.autopilot ? 'Stop Autopilot' : 'Start Autopilot');
  $('autopilot').className = (d.autopilot ? 'danger' : 'primary') + ' big';
  $('autopilot').firstElementChild.className = 'led' + (d.autopilot ? ' on' : '');
  $('autopilot').disabled = !!d.emergency;
  text($('autonote'), d.autopilot ? 'Autopilot · on for ' + dur(Date.now() - (d.autopilotSince || Date.now())) + '. Take Control pauses it on this phone.' : 'Autopilot runs your approved tasks when they are due. Take Control pauses it on this phone.');
  for (const p of [$('devicepanel'), $('mission')]) cls(p, 'shine', !!d.autopilot);
  $('take').hidden = controlling; $('release').hidden = !controlling || !!S.teaching;
  $('teach').disabled = !!S.teaching || !!d.emergency || d.running;
  $('viewer').disabled = S.simulated || !S.scrcpy;
  $('hint').hidden = !controlling;
  // The device frame: control (sand), recording (red), Falcor acting (brackets pulse).
  const devEl = $('device');
  cls(devEl, 'control', controlling && !S.teaching); cls(devEl, 'recording', !!S.teaching); cls(devEl, 'falcor-acting', !!(d.control && d.control.kind === 'agent'));
  $('devtag').hidden = !(controlling || S.teaching); text($('devtag'), S.teaching ? '● REC' : 'YOU HAVE CONTROL');
  renderEyes(d);
  // The live mission console.
  const run = S.tasks.find(t => t.state === 'RUNNING' && t.deviceId === d.id);
  if (run) {
    const n = run.targetLevel ? Math.min(20, run.targetLevel) : 10, done = run.targetLevel ? Math.round(Math.min(1, (run.level || 0) / run.targetLevel) * n) : 0;
    htmlOnce($('missionbody'), '<div class="mission"><div class="what"><b>' + esc(run.app) + '</b> · ' + esc(run.objective) + '</div>'
      + (run.targetLevel ? '<div class="progress" data-style="--n:' + n + '">' + Array.from({length: n}, (_, i) => '<i class="' + (i < done ? 'on' : '') + '"></i>').join('') + '</div><span class="muted small">Level ' + esc(run.level ?? '?') + ' of ' + esc(run.targetLevel) + '</span>' : '')
      + '<div class="step">' + esc(d.step || 'Working…') + '</div><div class="row"><span class="muted small">Elapsed ' + clock(Date.now() - (run.history.find(h => h.to === 'Running')?.at || Date.now())) + '</span><span class="grow"></span><button class="small" data-task="' + esc(run.id) + '" data-act="pause">' + icon('pause') + 'Pause</button></div></div>');
  } else {
    const next = S.tasks.filter(t => t.state === 'SCHEDULED' && t.nextAt).sort((a, b) => a.nextAt - b.nextAt)[0];
    htmlOnce($('missionbody'), '<div class="idle"><span class="sleep"><img src="dragon.png" alt=""></span><span>Nothing is running.' + (next ? '<br>Next: <b>' + esc(next.app) + '</b> · ' + esc(next.objective) + ' ' + esc(when(next.nextAt)) : d.autopilot ? '<br>I start approved tasks when they are due.' : '<br>Approve a task and start Autopilot.') + '</span></div>');
  }
  renderLog();
}
let logFilter = 'all';
document.querySelectorAll('#logfilter button').forEach(b => b.onclick = () => { logFilter = b.dataset.f; document.querySelectorAll('#logfilter button').forEach(x => cls(x, 'on', x === b)); $('log').innerHTML = ''; delete $('log').dataset.ready; renderLog(); });
function renderLog() {
  const box = $('log'), stick = box.scrollTop + box.clientHeight >= box.scrollHeight - 8;
  const lines = S.activity.filter(l => logFilter === 'all' || (logFilter === 'problems' ? l.tag === 'STOP' || /refused|not verified|failed|error|blocked|needs you|couldn/i.test(l.line) : l.tag === logFilter)).slice(-120);
  keyed(box, lines, l => l.at + ':' + l.line.slice(0, 40), l => P.el('<li class="' + (box.dataset.ready ? 'typein' : '') + '"><time>' + new Date(l.at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}) + '</time><span class="tag ' + esc(l.tag || 'SYSTEM') + '">' + esc(l.tag || 'SYSTEM') + '</span><span>' + esc(l.line) + '</span></li>'), () => {});
  if (stick) box.scrollTop = box.scrollHeight;
}
$('devpick').onchange = e => { deviceId = e.target.value; render(); };
$('autopilot').onclick = async () => { const d = dev(); if (d) { const r = await call('autopilot', {deviceId: d.id, on: !d.autopilot}); toast(r ? 'Autopilot on.' : 'Autopilot off.'); } };
$('take').onclick = async () => { await call('take', {deviceId}); toast('You have control. Click to tap, drag to swipe, scroll with the wheel, type with the keyboard.'); $('mirrorbox').focus(); };
$('release').onclick = () => call('release', {deviceId});
$('viewer').onclick = () => call('viewer', {deviceId}).then(() => toast('scrcpy window open. You have control while it is open.'));
$('kbd').onclick = () => { $('typeform').hidden = !$('typeform').hidden; if (!$('typeform').hidden) $('typetext').focus(); };
$('askfalcor').onclick = () => { const d = dev(); go('falcor'); if (d && d.foreground && !/launcher/.test(d.foreground)) setFocus(d.foreground); $('chattext').focus(); };
document.querySelectorAll('[data-key]').forEach(b => b.onclick = () => send({kind: 'key', key: b.dataset.key}));
$('typeform').onsubmit = async e => { e.preventDefault(); const t = $('typetext').value; if (!t) return; await send({kind: 'type', text: t}); $('typetext').value = ''; };

async function send(action) {
  if (!controlling) { toast('Take Control first.', 'warn'); return; }
  await call('input', {deviceId, action}).catch(() => {});
  nextFrame(0);
}
// Falcor's eyes: the element Falcor is about to tap, as a pixel bracket box with its label; verified flashes green.
let lastTarget = '';
function renderEyes(d) {
  const ov = $('overlay'), t = d.target, key = t ? [t.x, t.y, t.label, t.state].join(',') : '';
  if (key === lastTarget) return; lastTarget = key;
  ov.querySelectorAll('.eyes').forEach(x => x.remove());
  if (!t) return;
  const box = P.el('<div class="eyes ' + esc(t.state) + '"><span>' + esc(t.label) + ' · ' + esc(t.state === 'tapping' ? 'tapping' : t.state) + '</span></div>');
  Object.assign(box.style, {left: t.x + '%', top: t.y + '%', width: Math.max(2, t.w) + '%', height: Math.max(1.5, t.h) + '%'});
  ov.appendChild(box);
  if (t.state === 'tapping') P.tapMark(ov, t.x + t.w / 2, t.y + t.h / 2, true);
}

// The live mirror (pictures), the fallback when the video mirror cannot start.
let frameAt = 0, frameBusy = false, frameTimer = null, frames = 0, fpsAt = Date.now();
function nextFrame(delay) { clearTimeout(frameTimer); frameTimer = setTimeout(pullFrame, delay); }
async function pullFrame() {
  const d = dev();
  if ((tab !== 'phone' && tab !== 'sandbox') || !d || !d.connected || !d.authorized || document.hidden) { nextFrame(800); stopVideo(); return; }
  if (vid.on) { nextFrame(800); return; }
  // After two failed starts the picture mirror stays, but the video is tried again a minute later or on a new phone.
  if (vid.failed && (Date.now() - vid.failedAt > 60_000 || vid.deviceId !== d.id)) { vid.failed = false; vid.tries = 0; }
  if (!vid.failed && !vid.starting && !S.simulated && S.scrcpy) { void startVideo(d.id); nextFrame(800); return; }
  if (frameBusy) return;
  frameBusy = true;
  try {
    const f = await window.hub.call('frame', {deviceId: d.id});
    const img = $('mirror'); img.src = 'data:' + f.mime + ';base64,' + f.data; img.dataset.w = f.width; img.dataset.h = f.height;
    setAspect(f.width, f.height); frameAt = Date.now();
    $('mirrorwait').hidden = true;
    frames++; if (Date.now() - fpsAt > 2000) { setFps((frames / ((Date.now() - fpsAt) / 1000)).toFixed(1) + ' pictures/s' + (vid.failed && vid.error ? ' · picture mirror (' + vid.error + ')' : '')); frames = 0; fpsAt = Date.now(); }
  } catch (e) { setFps(errText(e)); }
  frameBusy = false;
  nextFrame(controlling ? 60 : 250);
}
// The device frame is sized to the phone's aspect ratio, as large as fits the column's height (and at most 46% wide).
let aspect = 9 / 20;
function setAspect(w, h) { if (w && h && Math.abs(w / h - aspect) > 0.001) { aspect = w / h; fitDevice(); } }
function fitDevice() {
  // In the Sandbox the device frame is as large as fits the Sandbox's stage.
  const host = $('device').parentElement;
  if (host && host.id === 'sbstage') {
    if (!host.clientHeight) return;
    let dh = host.clientHeight - 4, dw = (dh - 40) * aspect + 24;
    if (dw > host.clientWidth - 4) { dw = host.clientWidth - 4; dh = (dw - 24) / aspect + 40; }
    $('device').style.setProperty('--devw', Math.round(dw) + 'px'); $('device').style.setProperty('--devh', Math.round(dh) + 'px');
    if (window.sbPins) sbPins();
    return;
  }
  const stage = $('stage'); if (!stage || !stage.clientHeight) return;
  const padX = 24, padY = 40, h = stage.clientHeight, maxW = Math.max(260, Math.min(window.innerWidth * 0.46, window.innerWidth - 2 * 250 - 96));
  let dh = h, dw = (dh - padY) * aspect + padX;
  if (dw > maxW) { dw = maxW; dh = (dw - padX) / aspect + padY; }
  // The column is as wide as the phone frame or the toolbar under it, whichever is wider, so no button is ever cut off.
  const tb = $('toolbar'), need = tb ? [...tb.children].reduce((w, c) => w + c.getBoundingClientRect().width, 0) + (tb.children.length - 1) * 4 + 4 : 0;
  const g = $('phonegrid'); g.style.setProperty('--mirrorw', Math.ceil(Math.max(300, dw, need)) + 'px');
  $('device').style.setProperty('--devw', Math.round(dw) + 'px'); $('device').style.setProperty('--devh', Math.round(dh) + 'px');
}
window.addEventListener('resize', fitDevice);
new ResizeObserver(fitDevice).observe($('stage')); new ResizeObserver(fitDevice).observe($('sbstage')); new ResizeObserver(fitDevice).observe($('toolbar'));
nextFrame(300);

// The fast mirror: scrcpy's H.264 video from the phone, decoded here (WebCodecs) and drawn on a canvas. If it cannot
// start, the picture mirror stays. Live viewing does not use recording privacy checks.
const vid = {on: false, starting: false, failed: false, failedAt: 0, error: '', deviceId: null, decoder: null, config: null, codec: '', waitKey: true, frames: 0, at: Date.now(), tries: 0};
const canvas = $('video'), ctx = canvas.getContext('2d');
function codecOf(sps) {
  // avc1.PPCCLL from the sequence parameter set (after the 00 00 00 01 / 00 00 01 start code and the 0x67 header).
  for (let i = 0; i + 4 < sps.length; i++) if (sps[i] === 0 && sps[i + 1] === 0 && (sps[i + 2] === 1 || (sps[i + 2] === 0 && sps[i + 3] === 1))) { const h = i + (sps[i + 2] === 1 ? 3 : 4); if ((sps[h] & 0x1f) === 7) return 'avc1.' + [sps[h + 1], sps[h + 2], sps[h + 3]].map(b => b.toString(16).padStart(2, '0')).join(''); }
  return null;
}
function videoDecoder() {
  return new VideoDecoder({
    output: frame => {
      if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) { canvas.width = frame.displayWidth; canvas.height = frame.displayHeight; setAspect(canvas.width, canvas.height); }
      ctx.drawImage(frame, 0, 0); frame.close(); frameAt = Date.now();
      if (canvas.hidden) { canvas.hidden = false; $('mirror').hidden = true; $('mirrorwait').hidden = true; }
      vid.frames++; const now = Date.now(); if (now - vid.at > 1000) { setFps(canvas.width + '×' + canvas.height + ' · video ' + Math.round(vid.frames * 1000 / (now - vid.at)) + ' fps'); vid.frames = 0; vid.at = now; }
    },
    error: e => endVideo('the window could not decode it: ' + (e && e.message || e)),
  });
}
function feedVideo(p) {
  if (p.type === 'end') { endVideo(p.error); return; }
  if (p.type === 'session') { vid.waitKey = true; return; }
  const data = new Uint8Array(p.data);
  if (p.type === 'config') {
    const codec = codecOf(data); if (!codec) return;
    vid.config = data;
    if (!vid.decoder || vid.decoder.state === 'closed') vid.decoder = videoDecoder();
    if (codec !== vid.codec || vid.decoder.state !== 'configured') { vid.decoder.configure({codec, optimizeForLatency: true}); vid.codec = codec; }
    vid.waitKey = true; return;
  }
  if (!vid.decoder || vid.decoder.state !== 'configured') return;
  if (vid.waitKey && !p.key) return;
  // Without a description the decoder reads Annex B, so a key frame carries its SPS/PPS in front.
  let chunk = data;
  if (p.key && vid.config) { chunk = new Uint8Array(vid.config.length + data.length); chunk.set(vid.config); chunk.set(data, vid.config.length); }
  vid.waitKey = false;
  try { vid.decoder.decode(new EncodedVideoChunk({type: p.key ? 'key' : 'delta', timestamp: p.pts, data: chunk})); } catch (e) { endVideo('decode failed'); }
}
window.hub.onVideo(p => { if (p && p.deviceId === vid.deviceId) feedVideo(p); });
async function startVideo(id) {
  if (typeof VideoDecoder === 'undefined') { vid.failed = true; vid.error = 'this window cannot decode video'; return; }
  vid.starting = true; vid.deviceId = id; vid.waitKey = true;
  try { await window.hub.call('videoStart', {deviceId: id}); vid.on = true; vid.tries = 0; }
  catch (e) { vid.error = errText(e); if (++vid.tries >= 2) { vid.failed = true; vid.failedAt = Date.now(); } }
  vid.starting = false;
}
function showPictures() { canvas.hidden = true; $('mirror').hidden = false; }
function endVideo(why) {
  if (vid.decoder && vid.decoder.state !== 'closed') try { vid.decoder.close(); } catch { /* closed */ }
  vid.decoder = null; vid.codec = ''; vid.config = null;
  if (vid.on && vid.deviceId) void window.hub.call('videoStop', {deviceId: vid.deviceId}).catch(() => {});
  vid.on = false; showPictures();
  if (why) { vid.error = why; if (++vid.tries >= 2) { vid.failed = true; vid.failedAt = Date.now(); } }
}
function stopVideo() { if (vid.on) endVideo(null); }
// Mouse on the mirror (pictures or video): click = tap, hold = long press, drag = swipe, wheel = scroll. Positions are
// screen fractions; every touch goes through Falcor (and into the recording while teaching). Markers never touch the picture.
const at = e => { const el = e.currentTarget, r = el.getBoundingClientRect(); const iw = Number(el.dataset.w) || el.width || r.width, ih = Number(el.dataset.h) || el.height || r.height; const sc = Math.min(r.width / iw, r.height / ih), dw = iw * sc, dh = ih * sc, ox = (r.width - dw) / 2, oy = (r.height - dh) / 2; return {x: Math.min(1, Math.max(0, (e.clientX - r.left - ox) / dw)), y: Math.min(1, Math.max(0, (e.clientY - r.top - oy) / dh))}; };
let down = null;
for (const surface of [$('mirror'), canvas]) {
  // The Sandbox's pointer modes (view, pick a target or a gesture, a run playing) take the mouse; Control and Teach touch.
  surface.addEventListener('pointermove', e => { if (window.sbPointer && tab === 'sandbox') sbPointer('move', at(e), e); });
  surface.addEventListener('pointerdown', e => { if (window.sbPointer && tab === 'sandbox' && sbPointer('down', at(e), e)) return; if (!controlling) { toast('Take Control first to touch the phone.', 'warn'); return; } down = {...at(e), t: Date.now()}; surface.setPointerCapture(e.pointerId); });
  surface.addEventListener('pointerup', e => {
    if (window.sbPointer && tab === 'sandbox' && sbPointer('up', at(e), e)) return;
    if (!down) return; const up = at(e), ms = Date.now() - down.t, moved = Math.hypot(up.x - down.x, up.y - down.y);
    const a = moved > 0.03 ? {kind: 'swipe', x: down.x, y: down.y, toX: up.x, toY: up.y, ms: Math.min(2000, Math.max(120, ms))} : ms > 600 ? {kind: 'long_press', x: down.x, y: down.y, ms: Math.min(3000, ms)} : {kind: 'tap', x: down.x, y: down.y};
    if (a.kind === 'swipe') P.trail($('overlay'), down.x * 100, down.y * 100, up.x * 100, up.y * 100); else P.tapMark($('overlay'), down.x * 100, down.y * 100, false);
    lastTouch = {x: down.x * 100, y: down.y * 100};
    down = null; void send(a);
  });
}
let lastTouch = {x: 50, y: 50}, wheelAt = 0;
$('mirrorbox').addEventListener('wheel', e => { if (!controlling) return; e.preventDefault(); if (Date.now() - wheelAt < 400) return; wheelAt = Date.now(); void send({kind: 'scroll', direction: e.deltaY > 0 ? 'down' : 'up'}); }, {passive: false});
$('mirrorbox').addEventListener('keydown', e => {
  if (!controlling) return;
  const k = {Enter: 'ENTER', Backspace: 'DEL', Tab: 'TAB', Escape: 'BACK'}[e.key];
  if (k) { e.preventDefault(); void send({kind: 'key', key: k}); }
  else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); void send({kind: 'type', text: e.key === ' ' ? ' ' : e.key}); }
});

// ------------------------------------------------------------------ Teach Falcor
let teachSeen = null, after = null;
function renderTeach() {
  const t = S.teaching;
  $('rec').hidden = !t;
  if (t) {
    teachSeen = {at: Date.now(), ms: t.elapsedMs, state: t.state};
    cls($('rec'), 'paused', t.state === 'paused');
    text($('rectitle'), (t.state === 'paused' ? 'PAUSED · ' : 'TEACHING · ') + t.name);
    text($('recinfo'), t.screens + ' screens · ' + t.touches + ' touches · ' + t.marks + ' marks');
    $('recpause').innerHTML = icon(t.state === 'paused' ? 'play' : 'pause'); $('recpause').title = t.state === 'paused' ? 'Resume' : 'Pause';
    tickRec();
  } else teachSeen = null;
}
function tickRec() { if (!teachSeen) return; text($('rectime'), clock(teachSeen.ms + (teachSeen.state === 'recording' ? Date.now() - teachSeen.at : 0))); }
setInterval(tickRec, 500);
// Teach lives in the Sandbox (it is the Sandbox's recording mode): the Phone tab's Teach opens it there.
$('teach').onclick = () => { go('sandbox'); openTeach(); };
async function openTeach() {
  const t = await call('teachTarget', {deviceId});
  // On the home screen: Falcor records how the owner opens the app too, and learns the app from the first one opened.
  const home = !t.pkg || /launcher|systemui/.test(t.pkg);
  $('teachname').required = !home; $('teachname').placeholder = home ? 'Named after the app you open' : '';
  text($('teachpkg'), home ? 'Start here, then open the app on the mirror' : t.pkg); text($('teachapp'), home ? 'The home screen' : t.name); $('teachname').value = home ? '' : t.name; $('teachintent').value = '';
  const into = window.sbRecordTarget ? sbRecordTarget() : null;
  $('teachsb').hidden = !into; if (into) text($('teachsbname'), '"' + into.title + '"');
  $('teachform').hidden = false; $('teachname').focus();
}
$('teachcancel').onclick = () => { $('teachform').hidden = true; };
$('teachcustom').onchange = () => { $('customopts').hidden = !$('teachcustom').checked; };
$('teachform').onsubmit = async e => {
  e.preventDefault();
  const custom = $('teachcustom').checked ? {name: $('teachname').value || $('teachintent').value, times: Number($('customtimes').value) || 1, repeat: $('customrepeat').value, untilText: $('customuntil').value, home: $('customhome').checked} : null;
  // Recording into the open Sandbox sequence: it is saved first, so the blocks land on the version the owner sees.
  let sandbox = null;
  if (!$('teachsb').hidden && $('teachsbon').checked && window.sbBeforeTeach) { const id = await sbBeforeTeach(); if (id) sandbox = {sequenceId: id, launch: $('teachsblaunch').checked, waits: $('teachsbwaits').checked, check: $('teachsbcheck').checked}; }
  await call('teachStart', {deviceId, name: $('teachname').value, intent: $('teachintent').value, custom, sandbox});
  $('teachform').hidden = true; $('mirrorbox').focus();
  toast(custom ? 'Recording a custom task. Do it once on the mirror, start to finish; press Stop at the end.' : 'Recording. Play the app on the mirror; Falcor watches every touch. Press Stop when you are done.');
};
$('recpause').onclick = () => call('teachPause', {on: !(S.teaching && S.teaching.state === 'paused')});
$('markform').onsubmit = async e => {
  e.preventDefault(); await call('teachMark', {note: $('marknote').value}); $('marknote').value = '';
  const f = P.el('<div class="flagdrop">' + icon('flag') + '</div>'); f.style.left = lastTouch.x + '%'; f.style.top = lastTouch.y + '%'; $('overlay').appendChild(f); setTimeout(() => f.remove(), 1500);
  toast('Marked.');
};
$('recstop').onclick = async () => { const r = await call('teachStop'); if (r.sandbox && window.sbAfterTeach) sbAfterTeach(r.sandbox); if (!r.pkg) { toast('No app was opened, so nothing was recorded.', 'warn'); return; } if (r.customTask) toast('Saved as a custom task. Approve it in Tasks to let Falcor run it.'); if (!r.auto) showAfter(r.pkg, r.id, r.name, r.screens, r.learned); };
async function showAfter(pkg, id, name, screens, learned) {
  after = {pkg, id, screens}; $('after').hidden = false; text($('aftername'), name); text($('afterest'), 'Working out what it costs…');
  // What Falcor already worked out from the session on this computer (free, no AI): Autopilot uses it from now on.
  text($('afterlearned'), learned || ''); $('afterlearned').hidden = !learned;
  $('afterbody').hidden = false; $('afterwork').hidden = true;
  for (const b of ['afterfull', 'aftertext', 'afterlocal', 'afterclose']) $(b).disabled = false;
  const est = await call('teachEstimate', {pkg, id}).catch(() => null);
  if (!est) return;
  const spent = est.spend.teach + est.spend.chat + est.spend.autopilot;
  text($('afterest'), !est.configured ? 'Add your Kimi key in Settings to have Falcor AI write it, or save it without AI (free).'
    : 'About ' + est.tokens.toLocaleString() + ' tokens, about ' + money(est.cost) + (est.images ? ' (' + est.images + ' small pictures of screens without text)' : '') + '. Text only: about ' + money(est.textCost) + '.');
  meter($('aftermeter'), est.limit ? (spent + est.cost) / est.limit : 0, est.limit ? 'This month ' + money(spent) + ' + ' + money(est.cost) + ' of ' + money(est.limit) : '');
  $('aftermeter').hidden = !est.limit;
  $('afterfull').disabled = $('aftertext').disabled = !est.configured;
  $('aftertext').hidden = !est.images;
}
function meter(node, frac, label) {
  const n = 20, on = Math.round(Math.min(1, Math.max(0, frac)) * n);
  node.className = 'meter' + (frac >= 1 ? ' bad' : frac >= .8 ? ' warn' : '');
  htmlOnce(node, Array.from({length: n}, (_, i) => '<i class="' + (i < on ? 'on' : '') + '"></i>').join(''));
  node.title = label || '';
}
async function writeGuide(mode) {
  const a = after; if (!a) return;
  for (const b of ['afterfull', 'aftertext', 'afterlocal', 'afterclose']) $(b).disabled = true;
  $('afterwork').hidden = false; text($('afterworktext'), mode === 'local' ? 'Saving…' : 'Falcor is studying ' + (a.screens || 'the') + ' screens…');
  try { await window.hub.call('teachWrite', {...a, mode}); }
  catch (e) {
    const m = errText(e);
    if (/^LIMIT: /.test(m) && confirm(m.slice(7))) { try { await call('teachWrite', {...a, mode, overLimit: true}); } catch { showAfter(a.pkg, a.id, $('aftername').textContent, a.screens); return; } }
    else { toast(m.replace(/^LIMIT: /, ''), 'bad'); showAfter(a.pkg, a.id, $('aftername').textContent, a.screens); return; }
  }
  $('after').hidden = true; after = null; learnPkg = a.pkg; learnSig = '';
  go('knowledge');
  setTimeout(() => P.burst($('guidecard')), 300);
  toast('Guide saved. Read it, correct anything wrong, or ask Falcor about it.');
}
$('afterfull').onclick = () => writeGuide('full');
$('aftertext').onclick = () => writeGuide('text');
$('afterlocal').onclick = () => writeGuide('local');
$('afterclose').onclick = () => { $('after').hidden = true; after = null; toast('The recording is saved. Write its guide any time from Knowledge.'); };

// ------------------------------------------------------------------ games: a grid of the owner's games, and a page per game
let gamePkg = null;
const icons = new Map();   // pkg → data URL ('' while loading, null when there is none)
function iconHtml(g) {
  if (g.icon && !icons.has(g.pkg)) { icons.set(g.pkg, ''); window.hub.call('appIcon', {pkg: g.pkg}).then(u => { icons.set(g.pkg, u || null); if (tab === 'games') renderGames(true); }).catch(() => icons.set(g.pkg, null)); }
  const u = icons.get(g.pkg);
  return u ? '<img src="' + esc(u) + '" alt="">' : P.monogram(g.name, g.pkg);
}
const gameState = g => g.note ? {label: g.note, mood: 'sand'} : !g.tasks.length && (g.earning || []).length ? {label: g.earning.reduce((n, o) => n + o.progress.done, 0) + ' of ' + g.earning.reduce((n, o) => n + o.progress.of, 0) + ' milestones', mood: 'green'} : g.tasks.some(t => t.state === 'RUNNING') ? {label: 'Running', mood: 'green'} : g.needsYou ? {label: g.needsYou + ' need' + (g.needsYou === 1 ? 's' : '') + ' you', mood: 'sand'} : g.active ? {label: g.active + ' active', mood: 'green'} : g.tasks.length ? {label: 'All done', mood: 'muted'} : {label: 'Learned', mood: 'muted'};
function renderGames(force) {
  const list = S.games || [];
  if (gamePkg && !list.some(g => g.pkg === gamePkg)) gamePkg = null;
  $('gamesview').hidden = !!gamePkg; $('gamepage').hidden = !gamePkg;
  if (gamePkg) return renderGame(list.find(g => g.pkg === gamePkg), force);
  const box = $('gamegrid');
  if (!list.length) { htmlOnce(box, '<div class="panel empty" data-empty><img src="dragon.png" alt=""><span>No games yet. Create a task for a game and Falcor opens it so you can show it how to play; it shows here with its icon.</span><button class="primary" data-newgame>' + icon('plus') + 'New task</button></div>'); return; }
  if (box.querySelector('[data-empty]')) box.innerHTML = '';
  keyed(box, list, g => g.pkg, () => P.el('<button class="panel gametile"><span class="gicon"></span><b class="nm"></b><span class="m"></span><span class="earn"></span><span class="pill"></span></button>'), (n, g) => {
    const st = gameState(g);
    htmlOnce(n.querySelector('.gicon'), iconHtml(g));
    text(n.querySelector('.nm'), g.name);
    text(n.querySelector('.m'), g.tasks.length ? g.tasks.length + ' challenge' + (g.tasks.length === 1 ? '' : 's') : 'no challenges yet');
    text(n.querySelector('.earn'), P.earnLine(g) || (g.runs ? g.runs + ' runs' : ''));
    const p = n.querySelector('.pill'); p.className = 'pill ' + st.mood; text(p, st.label);
    n.title = g.name + ' · ' + g.pkg;
  });
}
function renderGame(g) {
  const st = gameState(g), d = dev();
  htmlOnce($('gpicon'), iconHtml(g));
  text($('gpname'), g.name);
  htmlOnce($('gpmeta'), (g.pkg.startsWith('offer:') ? 'Offer only' : '<code>' + esc(g.pkg) + '</code>') + ' · <span class="' + st.mood + '">' + esc(st.label) + '</span>' + (g.level !== null && g.level !== undefined ? ' · level ' + esc(g.level) : '') + (g.lastPlayed ? ' · last played ' + new Date(g.lastPlayed).toLocaleString() : '') + (g.installed ? '' : ' · <span class="sand">' + (g.pkg.startsWith('offer:') ? 'not linked to an app on the phone yet: Edit the offer once it is installed' : 'not on the phone') + '</span>'));
  $('gpopen').disabled = !d || !g.installed || !!d.running || !!d.emergency;
  $('gpopen').title = !d ? 'Plug in the phone' : !g.installed ? 'Not installed on the phone' : d.running ? 'A task is running' : d.emergency ? 'Emergency Stop is on' : 'Open it on the phone and take control';
  $('gpteach').disabled = $('gpopen').disabled || !!S.teaching;
  $('gpguide').disabled = !g.learned;
  const tiles = [{k: 'ch', label: 'Challenges', v: g.tasks.length}, {k: 'active', label: 'Active', v: g.active}, {k: 'runs', label: 'Runs', v: g.runs}, {k: 'ver', label: 'Verified', v: g.verified}];
  keyed($('gptiles'), tiles, t => t.k, () => P.el('<div class="panel tile"><span class="muted small"></span><b></b></div>'), (n, t) => { text(n.querySelector('.muted'), t.label); roll(n.querySelector('b'), t.v, String); });
  $('gpofferbox').hidden = !(g.earning || []).length;
  htmlOnce($('gpoffers'), P.offersHtml(g, true)); P.fix($('gpoffers'));
  $('gpopen').hidden = $('gpteach').hidden = $('gptask').hidden = $('gpchat').hidden = $('gpguide').hidden = $('gptiles').hidden = g.pkg.startsWith('offer:');
  htmlOnce($('gpearn'), P.rewardsHtml(g)); P.fix($('gpearn'));
  htmlOnce($('gphist'), P.historyHtml(g));
  $('gptierbox').hidden = !(g.tiers || []).length && !(g.objectives || []).length;
  htmlOnce($('gptiers'), P.tiersHtml(g));
  const box = $('gptasks');
  if (!g.tasks.length) htmlOnce(box, '<div class="empty" data-empty><span>No challenges for this game yet.</span></div>');
  else {
    if (box.querySelector('[data-empty]')) box.innerHTML = '';
    keyed(box, g.tasks, t => t.id, () => P.el('<div class="gtask"><div class="main"></div><div class="acts"></div></div>'), (n, t) => {
      const why = t.needs ? 'Needs you: ' + t.needs.reason : t.lastError || '';
      htmlOnce(n.querySelector('.main'), '<div class="obj">' + icon(TYPEICON[t.type] || 'tasks') + ' ' + esc(t.objective) + '</div><div class="meta"><span>' + esc(TYPE[t.type] || t.type) + '</span>' + (t.targetLevel ? '<span>level ' + esc(t.level ?? 0) + ' of ' + esc(t.targetLevel) + '</span>' : '') + (t.reward !== null ? '<span>' + icon(UNIT(t.unit)) + ' offer ' + esc(t.reward) + ' ' + esc(t.unit) + '</span>' : '') + (t.nextAt && t.state === 'SCHEDULED' ? '<span>next ' + when(t.nextAt) + '</span>' : '') + '<span class="pill ' + (trackOf(t.state).mood === 'needs' ? 'sand' : trackOf(t.state).mood === 'bad' ? 'red' : 'green') + '">' + esc(t.stateLabel) + '</span></div>' + P.progressHtml(t) + trackHtml(t.state) + (why ? '<div class="why sand">' + esc(why) + '</div>' : ''));
      const acts = [];
      if (!['NEEDS_REVIEW', 'DRAFT', 'RUNNING', 'BLOCKED', 'CANCELLED', 'EXPIRED', 'FAILED', 'RECEIVED', 'INVALIDATED'].includes(t.state)) acts.push('<button class="primary small" data-task="' + esc(t.id) + '" data-act="run">' + icon('play') + 'Run now</button>');
      if (['SCHEDULED', 'RUNNING', 'READY', 'NEEDS_ATTENTION'].includes(t.state)) acts.push('<button class="small" data-task="' + esc(t.id) + '" data-act="pause">' + icon('pause') + 'Pause</button>');
      if (t.state === 'PAUSED') acts.push('<button class="small" data-task="' + esc(t.id) + '" data-act="resume">' + icon('play') + 'Resume</button>');
      acts.push('<button class="small" data-gotask="' + esc(t.id) + '">' + (t.state === 'NEEDS_REVIEW' ? icon('check') + 'Approve in Tasks' : 'Open in Tasks') + '</button>');
      htmlOnce(n.querySelector('.acts'), acts.join(''));
    });
  }
  renderAds(g);
  const k = g.learned, moves = g.moves ? '<p class="small green">' + g.moves + ' step' + (g.moves === 1 ? '' : 's') + ' Falcor presses here without asking (from your teaching and its own runs).</p>' : '';
  htmlOnce($('gpknowbody'), moves + (k ? '<p>' + esc(k.summary || (k.hasGuide ? 'Guide ready.' : 'Recorded; no guide written yet.')) + '</p><p class="muted small">' + k.sessions + ' teaching session' + (k.sessions === 1 ? '' : 's') + ' · last ' + new Date(k.lastSessionAt).toLocaleDateString() + '</p><button class="small" data-link="knowledge" data-ref="' + esc(g.pkg) + '">' + icon('book') + 'Read the guide</button>'
    : '<p class="muted small">' + (g.note ? esc(g.note) + '.' : 'Falcor has not learned this game yet. Press Teach again (or Teach on the Phone tab) and play it on the mirror.') + '</p>'));
}
// Rewarded ads: on for every game. Falcor plays an ad offer while the owner is here to watch it and closes it once the
// reward is granted; a game can be turned off (and on again) here.
function renderAds(g) {
  const box = $('gpadsbody'), sig = g.pkg + ':' + g.ads + ':' + g.adsLocked + ':' + g.manual;
  $('gpads').hidden = g.pkg.startsWith('offer:');
  if (box.dataset.sig === sig) return; box.dataset.sig = sig;
  box.innerHTML = g.manual ? '<p class="muted small">This game is a ' + esc(g.manual) + ' offer: you play it, so Falcor plays no ads in it.</p>'
    : g.adsLocked ? '<p class="muted small">This app is manual only. Falcor does not play its ads.</p>'
    : g.ads ? '<p class="small"><span class="led on"></span> On. When the game offers a reward for an ad, Falcor plays it while you are at the computer or in the phone app, waits for the reward, then closes it. It never taps inside the ad or buys anything.</p><button class="small" data-ads="off">Turn off for this game</button>'
    : '<p class="muted small">Off for this game: Falcor passes by "watch an ad" offers here.</p><button class="small primary" data-ads="on">Turn on</button>';
}
$('gpadsbody').onclick = async e => {
  const b = e.target.closest('[data-ads]'); if (!b || !gamePkg) return;
  await call('setAds', {pkg: gamePkg, on: b.dataset.ads === 'on'});
  toast(b.dataset.ads === 'on' ? 'Rewarded ads on for this game.' : 'Rewarded ads off for this game.');
};
// ---------------------------------------------------------------- offers from earning apps
// Capture reads the offer page open on the phone into this form; nothing is saved until the owner checks it and saves.
let offerDraft = null;
function offerRow(m = {text: '', amount: '', unit: 'points', done: false}) {
  const r = P.el('<div class="mrow"><input data-k="text" maxlength="120" placeholder="Reach level 10"><input data-k="amount" type="number" min="0" step="any" placeholder="reward" data-num="1"><input data-k="unit" maxlength="24" placeholder="unit"><label class="check"><input type="checkbox" data-k="done"> done</label><button type="button" class="icon small ghost" title="Remove">' + icon('close') + '</button></div>');
  r.querySelector('[data-k="text"]').value = m.text; r.querySelector('[data-k="amount"]').value = m.amount ?? ''; r.querySelector('[data-k="unit"]').value = m.unit || ''; r.querySelector('[data-k="done"]').checked = !!m.done;
  r.querySelector('button').onclick = () => r.remove();
  $('offerrows').appendChild(r);
}
async function openOffer(draft, installed, where) {
  offerDraft = draft || {source: {name: '', pkg: ''}, game: {name: '', pkg: null}, milestones: [], total: null, expiresAt: null, by: 'owner'};
  const f = $('offerform');
  $('offerform').hidden = false; $('offerfields').hidden = false; $('offerstart').hidden = true;
  text($('offerwhere'), where || 'Fill in the offer as the earning app shows it.');
  if (!installed) installed = deviceId ? await window.hub.call('installedApps', {deviceId}).catch(() => []) : [];
  f.pkg.innerHTML = '<option value="">Not on the phone yet</option>' + installed.map(a => '<option value="' + esc(a.pkg) + '">' + esc(a.name) + ' · ' + esc(a.pkg) + '</option>').join('');
  f.source.value = offerDraft.source.name; f.game.value = offerDraft.game.name; f.pkg.value = offerDraft.game.pkg || '';
  f.days.value = offerDraft.expiresAt ? Math.round((offerDraft.expiresAt - Date.now()) / 8_640_000) / 10 : '';
  f.total.value = offerDraft.total ? offerDraft.total.amount : ''; f.totalunit.value = offerDraft.total ? offerDraft.total.unit : '';
  $('offerrows').innerHTML = ''; for (const m of offerDraft.milestones) offerRow(m); if (!offerDraft.milestones.length) offerRow();
  numbers(f); f.game.focus();
}
function closeOffer() { $('offerform').hidden = true; $('offerfields').hidden = true; $('offerstart').hidden = false; offerDraft = null; }
$('offeradd').onclick = () => { closeOffer(); $('offerform').hidden = false; };
$('offercancel').onclick = closeOffer;
$('offerhand').onclick = () => openOffer(null, null, 'Fill in the offer as the earning app shows it.');
$('offerrow').onclick = () => offerRow();
$('offercapture').onclick = async () => {
  if (!deviceId) { toast('Plug in the phone first.', 'warn'); return; }
  try { const r = await window.hub.call('captureOffer', {deviceId}); await openOffer(r.draft, r.installed, 'Read from ' + r.draft.source.name + ' on the phone. Check everything, fix what is wrong, then Save.'); }
  catch (e) { const m = errText(e); toast(m, 'warn'); if (/by hand/.test(m)) openOffer({source: {name: (/^(.+?)'s rules/.exec(m) || [])[1] || '', pkg: ''}, game: {name: '', pkg: null}, milestones: [], total: null, expiresAt: null, by: 'owner'}, null, m); }
};
$('offerform').onsubmit = async e => {
  e.preventDefault();
  const f = $('offerform'), days = f.days.value === '' ? null : Number(f.days.value);
  const offer = {id: offerDraft && offerDraft.id, by: offerDraft ? offerDraft.by : 'owner', source: {name: f.source.value, pkg: offerDraft && offerDraft.source.pkg || ''}, game: {name: f.game.value, pkg: f.pkg.value || null},
    total: f.total.value === '' ? null : {amount: Number(f.total.value), unit: f.totalunit.value || 'points'}, expiresAt: days === null ? null : Date.now() + days * 86_400_000,
    milestones: [...$('offerrows').querySelectorAll('.mrow')].map(r => ({text: r.querySelector('[data-k="text"]').value, amount: r.querySelector('[data-k="amount"]').value === '' ? null : Number(r.querySelector('[data-k="amount"]').value), unit: r.querySelector('[data-k="unit"]').value, done: r.querySelector('[data-k="done"]').checked})).filter(m => m.text.trim())};
  const o = await call('saveOffer', {offer});
  closeOffer(); S = await call('status'); gamePkg = o.game.pkg || 'offer:' + o.id; go('games');
  toast('Offer saved: ' + o.game.name + ' via ' + o.source.name + (o.manual ? '. You play it; Falcor tracks it.' : '.'));
};
$('gpoffers').addEventListener('change', async e => { const b = e.target.closest('[data-offer]'); if (b) await call('tickOffer', {id: b.dataset.offer, index: Number(b.dataset.i), done: b.checked}); });
$('gpoffers').addEventListener('click', async e => {
  const ed = e.target.closest('[data-offer-edit]'), rm = e.target.closest('[data-offer-remove]');
  const o = (ed || rm) && (S.games.find(g => g.pkg === gamePkg)?.earning || []).find(x => x.id === (ed || rm).dataset[ed ? 'offerEdit' : 'offerRemove']);
  if (ed && o) { gamePkg = null; renderGames(); await openOffer(o, null, 'Editing the ' + o.source.name + ' offer.'); }
  if (rm && o && confirm('Remove the ' + o.source.name + ' offer for ' + o.game.name + '?')) await call('removeOffer', {id: o.id});
});
$('gamegrid').onclick = e => { if (e.target.closest('[data-newgame]')) return openDrawer(); const t = e.target.closest('.gametile'); if (t) { gamePkg = t.dataset.key; renderGames(); $('gamepage').scrollIntoView({block: 'start'}); } };
$('gamenew').onclick = () => openDrawer();
$('gameback').onclick = () => { gamePkg = null; renderGames(); };
$('gpopen').onclick = async () => { await call('openApp', {deviceId, pkg: gamePkg}); go('phone'); toast('Opened. You have control: play it on the mirror, or press Release when you are done.'); };
$('gpteach').onclick = async () => {
  const g = S.games.find(x => x.pkg === gamePkg); if (!g) return;
  await call('openApp', {deviceId, pkg: g.pkg});
  for (let i = 0; i < 10; i++) { const t = await call('teachTarget', {deviceId}); if (t.pkg === g.pkg) break; await new Promise(r => setTimeout(r, 500)); }
  await call('teachStart', {deviceId, name: g.name, intent: ''}); go('phone'); toast('Recording. Play it on the mirror; press Stop when you are done.');
};
$('gptask').onclick = () => { openDrawer(); draft.app = gamePkg; draft.step = 2; drawStep(); };
$('gpguide').onclick = () => followLink('knowledge', gamePkg);
$('gpchat').onclick = () => { const p = gamePkg; go('falcor'); setTimeout(() => setFocus(p), 200); $('chattext').focus(); };
$('gamepage').addEventListener('click', e => { const l = e.target.closest('[data-link]'); if (l) followLink(l.dataset.link, l.dataset.ref); const t = e.target.closest('[data-gotask]'); if (t) followLink('tasks', t.dataset.gotask); });

// ------------------------------------------------------------------ tasks
const TYPE = {daily_checkin: 'Daily check-in', game_level: 'Game to a level', free_signup: 'Free signup', reward_monitor: 'Reward balance', custom: 'Custom task'};
const TYPEICON = {daily_checkin: 'checkin', game_level: 'game', free_signup: 'signup', reward_monitor: 'reward', custom: 'rec'};
const TRACK = ['Created', 'Approved', 'Scheduled', 'Running', 'Verified'];
function trackOf(state) {
  const at = {DRAFT: 0, NEEDS_REVIEW: 0, READY: 1, SCHEDULED: 2, PAUSED: 2, RUNNING: 3, NEEDS_ATTENTION: 3, ACTION_VERIFIED: 4, CREDIT_PENDING: 4, REWARD_VERIFIED: 4, RECEIVED: 4, BLOCKED: 0, FAILED: 3, CANCELLED: 0, EXPIRED: 2, INVALIDATED: 4}[state] ?? 0;
  return {at, mood: ['NEEDS_REVIEW', 'NEEDS_ATTENTION'].includes(state) ? 'needs' : ['BLOCKED', 'FAILED', 'INVALIDATED'].includes(state) ? 'bad' : ''};
}
const trackHtml = state => { const t = trackOf(state); return '<div class="track ' + t.mood + '">' + TRACK.map((l, i) => '<span class="' + (i < t.at ? 'done' : i === t.at ? 'now' : '') + '"><i></i>' + l + '</span>').join('') + '</div>'; };
let taskFilter = 'all';
document.querySelectorAll('#taskfilter button').forEach(b => b.onclick = () => { taskFilter = b.dataset.f; document.querySelectorAll('#taskfilter button').forEach(x => cls(x, 'on', x === b)); renderTasks(); });
function renderTasks() {
  const list = S.tasks.filter(t => taskFilter === 'all' || (taskFilter === 'needs' ? ['NEEDS_REVIEW', 'NEEDS_ATTENTION', 'BLOCKED'].includes(t.state) : taskFilter === 'scheduled' ? ['SCHEDULED', 'READY', 'RUNNING', 'PAUSED'].includes(t.state) : /VERIFIED|RECEIVED|CANCELLED|FAILED|EXPIRED|PENDING/.test(t.state)));
  const box = $('tasklist');
  if (!list.length) { htmlOnce(box, '<div class="panel empty" data-empty><img src="dragon.png" alt=""><span>' + (S.tasks.length ? 'Nothing here with this filter.' : 'No tasks yet. Falcor is waiting for its first job.') + '</span><button class="primary" id="emptynew">' + icon('plus') + 'New task</button></div>'); const b = $('emptynew'); if (b) b.onclick = openDrawer; return; }
  if (box.querySelector('[data-empty]')) box.innerHTML = '';
  keyed(box, list, t => t.id, t => P.el('<div class="panel task"><div class="appicon">' + icon(TYPEICON[t.type] || 'tasks') + '</div><div class="main"></div><div class="acts"></div><div class="gatebox"></div></div>'), (node, t) => {
    const why = t.needs ? 'Needs you: ' + t.needs.reason : t.lastError ? t.lastError : t.history.length ? t.history[t.history.length - 1].reason : '';
    htmlOnce(node.querySelector('.main'), '<div class="obj"><b>' + esc(t.app) + '</b></div><div class="obj">' + esc(t.objective) + '</div><div class="meta"><span>' + icon(TYPEICON[t.type] || 'tasks') + ' ' + esc(TYPE[t.type] || t.type) + '</span>' + (t.targetLevel ? '<span>level ' + esc(t.level ?? 0) + ' of ' + esc(t.targetLevel) + '</span>' : '') + (t.nextAt && t.state === 'SCHEDULED' ? '<span>next ' + when(t.nextAt) + '</span>' : '') + '<span class="pill ' + (trackOf(t.state).mood === 'needs' ? 'sand' : trackOf(t.state).mood === 'bad' ? 'red' : 'green') + '">' + esc(t.stateLabel) + '</span></div>' + trackHtml(t.state) + customHtml(t.custom) + (why ? '<div class="why ' + (t.needs || t.lastError ? 'sand' : 'muted') + '">' + esc(why) + '</div>' : ''));
    const acts = [];
    if (t.state !== 'NEEDS_REVIEW') {
      if (!['RUNNING', 'BLOCKED', 'CANCELLED', 'EXPIRED', 'FAILED', 'RECEIVED', 'INVALIDATED'].includes(t.state)) acts.push('<button class="primary small" data-task="' + esc(t.id) + '" data-act="run">' + icon('play') + 'Run now</button>');
      if (['SCHEDULED', 'RUNNING', 'READY', 'NEEDS_ATTENTION'].includes(t.state)) acts.push('<button class="small" data-task="' + esc(t.id) + '" data-act="pause">' + icon('pause') + 'Pause</button>');
      if (t.state === 'PAUSED') acts.push('<button class="small" data-task="' + esc(t.id) + '" data-act="resume">' + icon('play') + 'Resume</button>');
    }
    if (['DRAFT', 'NEEDS_REVIEW', 'READY', 'SCHEDULED', 'PAUSED', 'NEEDS_ATTENTION'].includes(t.state)) acts.push('<button class="icon small" title="Edit" data-edit="' + esc(t.id) + '">' + icon('edit') + '</button>');
    if (t.state !== 'RUNNING') acts.push('<button class="icon danger small" title="Remove" data-task="' + esc(t.id) + '" data-act="remove">' + icon('trash') + '</button>');
    htmlOnce(node.querySelector('.acts'), acts.join(''));
    // The approval gate: Approve stays off until the required ticks are done.
    const gate = node.querySelector('.gatebox');
    if (t.state === 'NEEDS_REVIEW') { if (!gate.firstChild) { gate.className = 'gatebox gate'; gate.innerHTML = gateHtml(t); wireGate(gate, t); } }
    else if (gate.firstChild) { gate.className = 'gatebox'; gate.innerHTML = ''; }
  });
}
const gateHtml = t => '<p class="eyebrow">// APPROVAL GATE</p><label class="check"><input type="checkbox" data-tick="rules"> This app\'s own rules allow this automation</label>' + (t.signup ? '<label class="check"><input type="checkbox" data-tick="zero"> The offer is $0 upfront: no card, deposit or paid trial</label><label class="check"><input type="checkbox" data-tick="consent"> Create one account with my details and accept its terms for me</label>' : '') + '<div class="row"><button class="primary" data-approve="' + esc(t.id) + '" disabled>' + icon('check') + 'Approve</button><button data-task="' + esc(t.id) + '" data-act="cancel">Reject</button><span class="missing"></span></div>';
function wireGate(gate, t) {
  const upd = () => { const q = k => gate.querySelector('[data-tick="' + k + '"]'); const miss = [!q('rules').checked && 'the app-rules tick', t.signup && !q('zero').checked && 'the $0 tick'].filter(Boolean); gate.querySelector('[data-approve]').disabled = miss.length > 0; text(gate.querySelector('.missing'), miss.length ? 'Missing: ' + miss.join(' and ') + '.' : ''); };
  gate.addEventListener('change', upd); upd();
}
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-task]');
  if (t) { await call('taskAction', {id: t.dataset.task, action: t.dataset.act}); return; }
  const a = e.target.closest('[data-approve]');
  if (a) {
    const gate = a.closest('.gate'), q = k => gate.querySelector('[data-tick="' + k + '"]');
    await call('approveTask', {id: a.dataset.approve, rulesAllow: !!(q('rules') && q('rules').checked), zeroCostConfirmed: !!(q('zero') && q('zero').checked), approvals: q('consent') && q('consent').checked ? ['account_creation', 'terms_acceptance'] : []});
    toast('Approved. Falcor runs it when it is due and Autopilot is on, or press Run now.');
  }
  const ed = e.target.closest('[data-edit]'); if (ed) { await openEditor(ed.closest('.task'), ed.dataset.edit); return; }
  const u = e.target.closest('[data-unpair]'); if (u) await call('unpairPhone', {id: u.dataset.unpair});
  const p = e.target.closest('[data-unrule]'); if (p) await call('removePolicy', {key: p.dataset.unrule});
  const s = e.target.closest('[data-unsecret]'); if (s) await call('removeSecret', {name: s.dataset.unsecret});
});

// A custom task's steps in plain words, with how it repeats.
function customHtml(c) {
  if (!c) return '';
  const steps = c.steps.length > 8 ? c.steps.slice(0, 7).concat(['… ' + (c.steps.length - 7) + ' more']) : c.steps;
  return '<div class="routine muted small"><b>' + c.steps.length + ' steps:</b> ' + steps.map(esc).join(' → ') + '<br>' + [c.times > 1 ? c.times + ' rounds' : '1 round', c.repeat === 'daily' ? 'every day' : 'once', c.done.length ? 'done when it says “' + esc(c.done[0]) + '”' : '', c.untilText ? 'stops at “' + esc(c.untilText) + '”' : '', c.home ? 'then the home screen' : ''].filter(Boolean).join(' · ') + '</div>';
}
// Edit a task in place: what it does, its target, schedule, reward note and (for a signup) the details it types.
// A change to what runs sends an approved task back to "Needs review".
async function openEditor(card, id) {
  const open = card.querySelector('.editor'); if (open) { open.remove(); return; }
  const {details: d, fields} = await call('taskFields', {id});
  const box = P.el('<form class="editor gate"><p class="eyebrow">// EDIT TASK</p><div class="grid">'
    + '<label class="wide">What should it do?<input name="objective" maxlength="300" required></label>'
    + (d.type === 'game_level' ? '<label>Target level<input name="targetLevel" type="number" min="1" max="100000"></label>' : '')
    + (d.hour !== null ? '<label>Resets daily at (hour 0–23)<input name="hour" type="number" min="0" max="23"></label>' : '')
    + '<label>Reward (as the offer says)<input name="reward" type="number" min="0" step="any"></label><label>Unit<input name="unit" maxlength="24"></label>'
    + (d.custom ? '<label>Rounds<input name="times" type="number" min="1" max="50"></label><label>Runs<select name="repeat"><option value="once">once</option><option value="daily">every day</option></select></label><label class="wide">Stop early when the screen says<input name="untilText" maxlength="80"></label><label class="check wide"><input type="checkbox" name="home"> Go back to the home screen when done</label>' : '')
    + (d.type === 'free_signup' ? '<label class="wide">Signup details (one per line, name=value; a password as vault:name; a hidden one left empty stays as saved)<textarea name="fields" rows="4"></textarea></label>' : '')
    + '</div><div class="row"><button class="primary">Save</button><button type="button" data-cancel>Cancel</button><span class="muted small">Changing what it does sends an approved task back to Needs review.</span></div></form>');
  const f = box;
  f.objective.value = d.objective;
  if (f.targetLevel) f.targetLevel.value = d.targetLevel ?? '';
  if (f.hour) f.hour.value = d.hour;
  f.reward.value = d.reward ?? ''; f.unit.value = d.unit;
  if (f.fields) f.fields.value = fields.map(x => x.key + '=' + (x.hidden ? '' : x.value)).join('\n');
  if (d.custom) { f.times.value = d.custom.times; f.repeat.value = d.custom.repeat; f.untilText.value = d.custom.untilText || ''; f.home.checked = d.custom.home; }
  box.querySelector('[data-cancel]').onclick = () => box.remove();
  box.onsubmit = async ev => {
    ev.preventDefault();
    const patch = {id, objective: f.objective.value};
    if (f.targetLevel && f.targetLevel.value !== String(d.targetLevel ?? '')) patch.targetLevel = Number(f.targetLevel.value);
    if (f.hour && f.hour.value !== String(d.hour)) { patch.hour = Number(f.hour.value); patch.minute = 0; }
    if (f.reward.value !== '' && (Number(f.reward.value) !== d.reward || f.unit.value !== d.unit)) { patch.reward = Number(f.reward.value); patch.unit = f.unit.value || 'points'; }
    if (d.custom) { patch.times = Number(f.times.value) || 1; patch.repeat = f.repeat.value; patch.untilText = f.untilText.value; patch.home = f.home.checked; }
    if (f.fields) { const out = {}; for (const line of f.fields.value.split('\n')) { const i = line.indexOf('='); if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim(); } patch.fields = out; }
    await call('editTask', patch); box.remove(); toast('Task saved.');
  };
  card.appendChild(box); numbers(box); f.objective.focus();
}

// New task: a drawer in 4 steps (app, type, details, review).
const draft = {step: 1, app: null, type: null};
function openDrawer() { draft.step = 1; draft.app = null; draft.type = null; $('taskform').reset(); $('drawer').hidden = false; drawStep(); $('appsearch').focus(); }
$('newtask').onclick = openDrawer;
$('dclose').onclick = () => { $('drawer').hidden = true; };
$('appsearch').oninput = () => drawStep();
$('refreshapps').onclick = () => deviceId && call('refreshApps', {deviceId}).then(() => { toast('App list refreshed.'); drawStep(); });
function drawStep() {
  const d = dev(), q = $('appsearch').value.trim().toLowerCase();
  text($('dstep'), draft.step); text($('dtitle'), ['Pick the app', 'What kind of task?', 'The details', 'Review'][draft.step - 1]);
  document.querySelectorAll('#dsteps i').forEach((x, i) => cls(x, 'on', i < draft.step));
  document.querySelectorAll('.dpage').forEach(p => { p.hidden = Number(p.dataset.step) !== draft.step; });
  if (draft.step === 1) {
    const recent = [...new Set(S.tasks.map(t => t.appPackage))], names = d ? d.installedNames || {} : {};
    const apps = [...new Set([...recent, ...(d ? d.installed : [])])].filter(p => !q || p.toLowerCase().includes(q) || (names[p] || '').toLowerCase().includes(q));
    $('applist').innerHTML = apps.length ? apps.map(p => '<li data-app="' + esc(p) + '" class="' + (p === draft.app ? 'on' : '') + '"><span>' + esc(names[p] || S.tasks.find(t => t.appPackage === p)?.app || p.split('.').pop()) + '</span><small>' + esc(p) + (recent.includes(p) ? ' · recent' : '') + '</small></li>').join('') : '<li class="muted">' + (d ? 'No app matches.' : 'Plug in a phone to list its apps.') + '</li>';
  }
  if (draft.step === 2) document.querySelectorAll('#typecards button').forEach(b => cls(b, 'on', b.dataset.type === draft.type));
  if (draft.step === 3) { document.querySelectorAll('[data-for]').forEach(el => { el.hidden = el.dataset.for !== draft.type; }); numbers($('taskform')); }
  if (draft.step === 4) { const f = $('taskform'); $('review').innerHTML = '<dl><dt>App</dt><dd>' + esc(appName(draft.app)) + ' <small class="muted">' + esc(draft.app) + '</small></dd><dt>Type</dt><dd>' + esc(TYPE[draft.type]) + '</dd><dt>Does</dt><dd>' + esc(f.objective.value) + '</dd>' + (draft.type === 'game_level' ? '<dt>Target</dt><dd>level ' + esc(f.targetLevel.value) + '</dd>' : '') + (f.advertised.value ? '<dt>Reward</dt><dd>' + esc(f.advertised.value) + ' ' + esc(f.unit.value || 'points') + '</dd>' : '') + '</dl><p class="muted small">It lands as Needs review. Nothing runs before you approve it.</p>'; }
  $('dback').disabled = draft.step === 1;
  text($('dnext'), draft.step === 4 ? 'Create task' : 'Next');
  $('dnext').disabled = (draft.step === 1 && !draft.app) || (draft.step === 2 && !draft.type);
}
const appName = p => { const d = dev(); return (d && d.installedNames && d.installedNames[p]) || S.tasks.find(t => t.appPackage === p)?.app || p.split('.').pop(); };
$('applist').onclick = e => { const li = e.target.closest('[data-app]'); if (li) { draft.app = li.dataset.app; drawStep(); } };
$('applist').ondblclick = () => { if (draft.app) { draft.step = 2; drawStep(); } };
document.querySelectorAll('#typecards button').forEach(b => b.onclick = () => { draft.type = b.dataset.type; draft.step = 3; drawStep(); $('taskform').objective.focus(); });
$('dback').onclick = () => { draft.step = Math.max(1, draft.step - 1); drawStep(); };
$('dnext').onclick = async () => {
  if (draft.step === 3 && !$('taskform').reportValidity()) return;
  if (draft.step < 4) { draft.step++; drawStep(); return; }
  const f = $('taskform'), type = draft.type;
  const fields = {}; for (const line of f.fields.value.split('\n')) { const i = line.indexOf('='); if (i > 0) fields[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  await call('createTask', {deviceId, type, appPackage: draft.app, appLabel: f.appLabel.value.trim() || appName(draft.app), objective: f.objective.value,
    ...(type === 'game_level' ? {game: {targetLevel: Number(f.targetLevel.value)}} : {}), ...(type === 'free_signup' ? {signup: {fields}} : {}),
    ...(f.advertised.value !== '' ? {reward: {advertised: Number(f.advertised.value), unit: f.unit.value || 'points'}} : {}),
    ...(type === 'daily_checkin' || type === 'reward_monitor' ? {reset: {kind: 'daily', tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago', hour: 0, minute: 0, source: 'owner'}} : {})});
  $('drawer').hidden = true; toast('Task created. Approve it in its approval gate.');
};

// ------------------------------------------------------------------ Falcor chat (the conductor)
const chat = {id: null, rev: 0, msgs: new Map(), focus: null, poll: null, ctx: true};
const QUICK = ['What\'s running?', 'What needs me?', 'Start Autopilot', 'What did you learn today?', 'Show Luck Daily\'s rewards', 'Create a daily check-in task'];
async function openChat(id) {
  const threads = await window.hub.call('chatThreads').catch(() => []);
  const want = id || chat.id || (threads[0] && threads[0].id) || (await call('chatNew', {})).id;
  if (want !== chat.id) { chat.id = want; chat.rev = 0; chat.msgs.clear(); $('msgs').innerHTML = ''; delete $('msgs').dataset.ready; }
  renderThreads(await window.hub.call('chatThreads').catch(() => threads));
  await pullChat(true);
  clearInterval(chat.poll); chat.poll = setInterval(() => { if (tab === 'falcor') void pullChat(true); }, 1000);
}
async function pullChat(seen) {
  if (!chat.id) return;
  let r; try { r = await window.hub.call('chatRead', {id: chat.id, after: chat.rev, seen}); } catch { chat.id = null; return; }
  chat.rev = Math.max(chat.rev, r.rev);
  for (const m of r.messages) chat.msgs.set(m.id, m);
  text($('chattitle'), r.title || 'Falcor');
  chat.focus = r.focus; $('focuschip').hidden = !r.focus; text($('focusname'), 'Talking about: ' + (r.focusName || r.focus || ''));
  renderMsgs();
}
function renderThreads(threads) {
  keyed($('threadlist'), threads, t => t.id, () => P.el('<li><span class="t"></span><span class="p"></span><span class="tacts"><button class="ghost small" data-pin title="Pin">' + icon('pin') + '</button><button class="ghost small" data-ren title="Rename">' + icon('edit') + '</button><button class="ghost small" data-del title="Delete">' + icon('trash') + '</button></span></li>'), (li, t) => {
    cls(li, 'on', t.id === chat.id); cls(li.querySelector('.t'), 'pinned', t.pinned); text(li.querySelector('.t'), t.title); text(li.querySelector('.p'), t.preview || '');
  });
}
$('threadlist').onclick = async e => {
  const li = e.target.closest('li'); if (!li) return; const id = li.dataset.key;
  if (e.target.closest('[data-pin]')) { const t = (await call('chatThreads')).find(x => x.id === id); await call('chatPin', {id, pinned: !(t && t.pinned)}); return openChat(); }
  if (e.target.closest('[data-del]')) { if (confirm('Delete this chat?')) { await call('chatDelete', {id}); if (chat.id === id) chat.id = null; return openChat(); } return; }
  if (e.target.closest('[data-ren]')) { const t = li.querySelector('.t'); t.contentEditable = 'true'; t.focus(); document.getSelection().selectAllChildren(t); t.onkeydown = async ev => { if (ev.key === 'Enter') { ev.preventDefault(); t.contentEditable = 'false'; await call('chatRename', {id, title: t.textContent}); openChat(); } if (ev.key === 'Escape') { t.contentEditable = 'false'; openChat(); } }; return; }
  void openChat(id);
};
$('newchat').onclick = async () => { const t = await call('chatNew', {focus: chat.focus}); await openChat(t.id); $('chattext').focus(); };
$('ctxtoggle').onclick = () => { chat.ctx = !chat.ctx; cls($('chatgrid'), 'noctx', !chat.ctx); };
function renderMsgs() {
  const box = $('msgs'), stick = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
  const list = [...chat.msgs.values()].sort((a, b) => a.seq - b.seq);
  if (!list.length) htmlOnce(box, '<div class="empty" data-empty><img src="dragon.png" alt=""><span>Hi, I\'m Falcor. Ask me about your games and tasks, or tell me what to do. Say "stop" any time.</span></div>');
  else { if (box.querySelector('[data-empty]')) box.innerHTML = ''; keyed(box, list, m => m.id, m => P.el('<div class="msg ' + m.role + '">' + (m.role === 'user' ? '' : '<img class="avatar" src="dragon.png" alt="">') + '<div class="body"></div></div>'), (node, m) => { if (node.dataset.rev !== String(m.rev)) { node.dataset.rev = String(m.rev); drawMsg(node, m); } }); }
  $('quick').hidden = list.length > 0;
  if (!$('quick').firstChild) $('quick').innerHTML = QUICK.map(q => '<button type="button" data-q="' + esc(q) + '">' + esc(q) + '</button>').join('');
  if (stick) box.scrollTop = box.scrollHeight;
  renderContext(list);
}
function drawMsg(node, m) {
  cls(node, 'thinking', !!m.pending); cls(node, 'error', !!m.error);
  const steps = m.steps.length && (m.pending || m.role === 'falcor') ? '<div class="stepsline">' + m.steps.map(s => '<span>' + esc(s) + '</span>').join('') + '</div>' : '';
  const body = m.pending && !m.text ? '<div class="bubble caret"></div>' : '<div class="bubble">' + chipify(m.text) + '</div>';
 node.querySelector('.body').innerHTML = (m.role === 'user' && m.who && m.who !== 'the computer' ? '<span class="who">from ' + esc(m.who) + '</span>' : '') + (m.pending ? steps : '') + body + (m.pending ? '' : steps) + m.cards.map(cardHtml).join('');
  numbers(node);
}
// Code-like details (touch points, ids, packages) in sand monospace chips.
const chipify = t => esc(t).replace(/\b(\d{1,3}(?:\.\d)?%?,\s?\d{1,3}(?:\.\d)?%?|[a-z]{2,}\.[a-z0-9_.]{3,}|t[a-z0-9]{8,}|s\d{1,3})\b/g, '<code class="chipcode">$1</code>');
function cardHtml(c) {
  const done = c.state === 'confirmed' || c.state === 'cancelled' || c.state === 'undone' ? '<span class="done">' + (c.state === 'cancelled' ? 'Cancelled' : c.state === 'undone' ? 'Undone' : 'Confirmed') + (c.doneBy ? ' on ' + esc(c.doneBy === 'the computer' ? 'this computer' : c.doneBy) : '') + (c.doneAt ? ' · ' + time(c.doneAt) : '') + (c.result && c.state === 'confirmed' ? ' · ' + esc(c.result) : '') + '</span>' : '';
  const err = c.error ? '<span class="err">' + esc(c.error) + '</span>' : '';
  const lines = c.lines.length ? '<ul>' + c.lines.map(l => '<li>' + chipify(l) + '</li>').join('') + '</ul>' : '';
  const open = c.state === 'open';
  if (c.kind === 'links') return '<div class="row">' + (c.data.links || []).map(l => '<button class="small" data-link="' + esc(l.tab) + '" data-ref="' + esc(l.ref) + '">' + esc(l.label) + '</button>').join('') + '</div>';
  if (c.kind === 'task') { const d = c.data || {}; return '<div class="card task" data-card="' + c.id + '"><div class="ct">' + icon(TYPEICON[d.type] || 'tasks') + esc(c.title) + '</div>' + trackHtml(d.state) + lines + '<div class="acts">' + (['SCHEDULED', 'PAUSED', 'READY', 'NEEDS_ATTENTION'].includes(d.state) ? '<button class="small primary" data-task="' + esc(d.id) + '" data-act="run">Run now</button>' : '') + (['SCHEDULED', 'RUNNING'].includes(d.state) ? '<button class="small" data-task="' + esc(d.id) + '" data-act="pause">Pause</button>' : '') + '<button class="small" data-link="tasks" data-ref="' + esc(d.id) + '">Open in Tasks</button>' + (c.undo && c.state === 'done' ? '<button class="small ghost" data-cact="undo" data-card="' + c.id + '">Undo</button>' : '') + '</div>' + done + err + '</div>'; }
  if (c.kind === 'stats') { const d = c.data || {}; return '<div class="card stats"><div class="ct">' + icon('stats') + esc(c.title) + '</div>' + lines + '<div class="row">' + P.spark((d.days || []).map(x => x.runs), 'var(--green)') + '</div><button class="small" data-link="stats" data-ref="">Open Stats</button></div>'; }
  if (c.kind === 'guide') return '<div class="card guide"><div class="ct">' + icon('book') + esc(c.title) + '</div>' + lines + '<div class="acts"><button class="small" data-link="knowledge" data-ref="' + esc(c.data && c.data.pkg || '') + '">Open the guide</button></div></div>';
  if (c.kind === 'emergency') return '<div class="card emergency"><div class="ct">' + icon('stop') + esc(c.title) + '</div>' + lines + '</div>';
  if (c.kind === 'result') return '<div class="card result"><div class="ct">' + icon('check') + esc(c.title) + '</div>' + lines + (c.undo && c.state === 'done' ? '<div class="acts"><button class="small ghost" data-cact="undo" data-card="' + c.id + '">Undo</button></div>' : '') + done + err + '</div>';
  if (c.kind === 'approve') { const d = c.data || {}; return '<div class="card approve gate" data-card="' + c.id + '"><p class="eyebrow">// APPROVAL GATE</p><div class="ct">' + esc(c.title) + '</div>' + lines + (open ? '<label class="check"><input type="checkbox" data-tick="rules"> This app\'s own rules allow this automation</label>' + (d.signup ? '<label class="check"><input type="checkbox" data-tick="zero"> The offer is $0 upfront: no card, deposit or paid trial</label><label class="check"><input type="checkbox" data-tick="consent"> Create one account with my details and accept its terms for me</label>' : '') + '<div class="acts"><button class="primary small" data-cact="confirm" data-card="' + c.id + '">' + icon('check') + 'Approve</button><button class="small" data-cact="cancel" data-card="' + c.id + '">Not now</button></div>' : '') + done + err + '</div>'; }
  return '<div class="card confirm" data-card="' + c.id + '"><div class="ct">' + icon('edit') + esc(c.title) + '</div>' + lines + (open ? '<div class="acts"><button class="primary small" data-cact="confirm" data-card="' + c.id + '">Confirm</button><button class="small" data-cact="cancel" data-card="' + c.id + '">Cancel</button></div>' : c.state === 'working' ? '<span class="done"><span class="spin4"><i></i><i></i><i></i><i></i></span> Working…</span>' : '') + done + err + '</div>';
}
$('msgs').addEventListener('click', async e => {
  const b = e.target.closest('[data-cact]');
  if (b) {
    const card = b.closest('.card') || b, q = k => card.querySelector('[data-tick="' + k + '"]');
    b.classList.add('busy');
    try { const c = await window.hub.call('chatAct', {card: b.dataset.card, action: b.dataset.cact, ticks: {rulesAllow: !!(q('rules') && q('rules').checked), zeroCost: !!(q('zero') && q('zero').checked), consent: !!(q('consent') && q('consent').checked)}}); if (c.state === 'confirmed' && b.dataset.cact === 'confirm') P.burst(card); if (c.error) toast(c.error, 'warn'); }
    catch (err) { toast(errText(err), 'bad'); }
    await pullChat(true); return;
  }
  const l = e.target.closest('[data-link]'); if (l) followLink(l.dataset.link, l.dataset.ref);
});
function followLink(t, ref) {
  if (t === 'knowledge' && ref) { learnPkg = ref; learnSig = ''; }
  if (t === 'settings') return go('settings', ref === 'updates' ? 'updates' : ref === 'rules' ? 'rules' : undefined);
  go(t);
  if (t === 'tasks' && ref) setTimeout(() => { const n = document.querySelector('.task[data-key="' + ref + '"]'); if (n) { n.scrollIntoView({block: 'center'}); n.classList.remove('flash'); void n.offsetWidth; n.classList.add('flash'); } }, 80);
}
$('quick').onclick = e => { const b = e.target.closest('[data-q]'); if (b) { $('chattext').value = b.dataset.q; void sendChat(); } };
$('composer').onsubmit = e => { e.preventDefault(); void sendChat(); };
$('chattext').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendChat(); } if (e.key === '@' ) setTimeout(openAt, 0); });
async function sendChat() {
  const t = $('chattext').value.trim(); if (!t) return;
  $('chattext').value = '';
  const r = await call('chatSend', {id: chat.id, text: t, focus: chat.focus}).catch(() => null);
  if (r && r.threadId !== chat.id) { chat.id = r.threadId; chat.rev = 0; chat.msgs.clear(); }
  await pullChat(true);
}
function setFocus(pkg) { if (!chat.id) return; void call('chatFocus', {id: chat.id, pkg}).then(() => pullChat(true)); }
$('focusclear').onclick = () => setFocus(null);
$('atbtn').onclick = () => openAt();
function openAt() {
  const d = dev(), known = S.knowledge.map(k => ({pkg: k.pkg, name: k.name, note: k.sessions + ' session(s)'})), more = (d ? d.installed : []).filter(p => !known.some(k => k.pkg === p)).map(p => ({pkg: p, name: appName(p), note: 'on the phone'}));
  $('atmenu').innerHTML = [...known, ...more].slice(0, 40).map(a => '<li data-focus="' + esc(a.pkg) + '">' + esc(a.name) + '<small>' + esc(a.note) + '</small></li>').join('') || '<li class="muted">Nothing learned yet.</li>';
  $('atmenu').hidden = false;
}
$('atmenu').onclick = e => { const li = e.target.closest('[data-focus]'); if (li) { setFocus(li.dataset.focus); const v = $('chattext').value; $('chattext').value = v.replace(/@$/, ''); } $('atmenu').hidden = true; $('chattext').focus(); };
document.addEventListener('click', e => { if (!e.target.closest('.focusrow')) $('atmenu').hidden = true; });
function renderChatMeta() { if (chat.id) window.hub.call('chatThreads').then(renderThreads).catch(() => {}); }
function renderContext(list) {
  const d = dev(), k = chat.focus && S.knowledge.find(x => x.pkg === chat.focus), last = [...list].reverse().find(m => m.role === 'falcor' && m.used && m.used.length);
  htmlOnce($('ctxbody'), (chat.focus ? '<div class="item"><b>' + esc(k ? k.name : appName(chat.focus)) + '</b><p class="muted small">' + (k ? (k.hasGuide ? 'Guide ready · ' : 'No guide yet · ') + k.sessions + ' session(s)' : 'Not learned yet') + '</p><a data-link="knowledge" data-ref="' + esc(chat.focus) + '">Open guide →</a></div>' : '')
    + '<div class="item"><b>Phone</b><p class="small"><span class="led ' + (d && d.connected ? 'on' : '') + '"></span> ' + esc(d ? d.label + ' · ' + (d.foregroundName || 'home') : 'not plugged in') + '<br>Autopilot ' + (d && d.autopilot ? 'on' : 'off') + (d && d.running ? ' · running a task' : '') + '</p></div>'
    + (last ? '<div class="item"><b>Last answer used</b>' + last.used.map(u => '<p class="small"><a data-link="' + esc(u.tab) + '" data-ref="' + esc(u.ref) + '">' + esc(u.label) + '</a></p>').join('') + '</div>' : ''));
}
$('ctxbody').onclick = e => { const l = e.target.closest('[data-link]'); if (l) followLink(l.dataset.link, l.dataset.ref); };

// ------------------------------------------------------------------ Knowledge: guides
let learnPkg = null, learnSig = '', L = null, editing = false;
const SRC = v => '<span class="dot ' + (v === 'seen' ? 'seen' : 'ai') + '" title="' + (v === 'seen' ? 'Seen on screen' : 'Worked out by Falcor AI') + '"></span> ';
const UNIT = u => /coin/i.test(u) ? 'coin' : /gem/i.test(u) ? 'gem' : /cash|usd|\$|dollar/i.test(u) ? 'cash' : /gift/i.test(u) ? 'gift' : 'reward';
function renderLearn() {
  const list = S.knowledge;
  if (learnPkg && !list.some(k => k.pkg === learnPkg)) learnPkg = null;
  if (!learnPkg && list.length) learnPkg = list[0].pkg;
  $('learnempty').hidden = list.length > 0;
  if (!list.length) htmlOnce($('learnempty'), '<img src="dragon.png" alt=""><span>I haven\'t learned any app yet. Open one on the phone and press <b>Teach Falcor</b>, then play it on the mirror.</span><button data-link="phone" data-ref="">Go to Phone</button>');
  keyed($('apps'), list, k => k.pkg, () => P.el('<div class="panel appcard"><span class="ai">' + icon('book') + '</span><div><b></b><div class="m"></div></div><div class="klevel"></div></div>'), (n, k) => {
    cls(n, 'on', k.pkg === learnPkg); text(n.querySelector('b'), k.name);
    text(n.querySelector('.m'), k.sessions + ' session' + (k.sessions === 1 ? '' : 's') + ' · last ' + new Date(k.lastSessionAt).toLocaleDateString() + (k.hasGuide ? '' : ' · no guide yet'));
    const lvl = Math.min(10, k.sessions * 2 + (k.hasGuide ? 3 : 0) + (k.by && k.by !== 'local' ? 2 : 0));
    htmlOnce(n.querySelector('.klevel'), Array.from({length: 10}, (_, i) => '<i class="' + (i < lvl ? 'on' : '') + '"></i>').join(''));
    n.title = 'Knowledge level ' + lvl + ' of 10';
  });
  const sig = JSON.stringify(list.find(k => k.pkg === learnPkg) || null);
  if (sig !== learnSig && !editing) { learnSig = sig; void loadApp(); }
}
$('apps').onclick = e => { const c = e.target.closest('.appcard'); if (c) { learnPkg = c.dataset.key; learnSig = ''; editing = false; renderLearn(); } };
$('learnempty').onclick = e => { const l = e.target.closest('[data-link]'); if (l) go(l.dataset.link); };
// What training taught (worked out on this computer when each session ended): what Autopilot follows in this app.
function learnedHtml(l) {
  if (!l) return '';
  const li = [];
  if (l.entry && l.entry.fromHome) li.push('Opened from the home screen' + (l.entry.launchedBy ? ' with “' + esc(l.entry.launchedBy) + '”' : ''));
  const route = (l.path || []).filter(p => !p.claim);
  if (route.length) li.push('How to get there: ' + route.map(p => p.kind === 'scroll' ? 'scroll ' + esc(p.direction || 'down') : '“' + esc(p.label) + '”').join(' → '));
  if (l.claim) li.push('Reward button: “' + esc(l.claim.label) + '” · proof: ' + l.claim.proof.map(x => '“' + esc(x) + '”').join(', '));
  if (l.reset) li.push('Next reward: ' + (l.reset.ms ? Math.round(l.reset.ms / 3600000) + ' h after a claim' : 'tomorrow'));
  if (l.loops && l.loops.length) li.push('While playing: ' + l.loops.map(p => '“' + esc(p.label) + '” ×' + p.uses).join(', '));
  if (l.level) li.push('Level ' + l.level.from + ' → ' + l.level.to);
  for (const b of l.balances || []) li.push(esc(b.unit) + ' ' + b.from + ' → ' + b.to);
  for (const a of l.avoid || []) li.push('<span class="sand">Never presses “' + esc(a.label) + '”</span>: ' + esc(a.why));
  return li.length ? '<section class="learnedbox"><h3>' + icon('ai') + 'What training taught · ' + (l.sessions || 1) + ' session(s)</h3><ul>' + li.map(x => '<li>' + x + '</li>').join('') + '</ul></section>' : '';
}
async function loadApp() {
  $('guidecard').hidden = $('sessioncard').hidden = !learnPkg;
  if (!learnPkg) { $('guide').innerHTML = ''; return; }
  L = await call('learned', {pkg: learnPkg});
  text($('guidename'), L.name);
  const g = L.guide;
  text($('guidemeta'), g ? 'Written ' + (g.by === 'local' ? 'on this computer without AI' : 'by Falcor AI' + (g.by === 'kimi-text' ? ' from text only' : '')) + ' · ' + new Date(g.updatedAt).toLocaleString() + ' · ' + L.sessions.length + ' session(s)' : 'No guide yet: write one from a session below.');
  $('guideedit').hidden = !g; $('guidesave').hidden = true; text($('guideedit'), 'Edit');
  $('guide').innerHTML = learnedHtml(L.learned) + (g ? guideHtml(g) : ''); P.fix($('guide'));
  $('guide').classList.remove('editing');
  if (g) for (const img of $('guide').querySelectorAll('img[data-shot]')) window.hub.call('shot', {id: img.dataset.shot}).then(u => { if (typeof u === 'string') img.src = u; else img.closest('.thumb').remove(); }).catch(() => {});
  $('sessions').innerHTML = L.sessions.slice().reverse().map(r => '<details><summary>' + new Date(r.startedAt).toLocaleString() + ' · ' + clock(r.activeMs) + ' · ' + r.screens + ' screens · ' + r.touches + ' touches' + (r.intent ? ' · ' + esc(r.intent) : '') + '</summary>'
    + '<div class="row gap6"><button class="small" data-write="' + esc(r.id) + '" data-screens="' + r.screens + '">' + icon('ai') + 'Write the guide from this session</button></div>'
    + '<ul class="timeline">' + r.timeline.map(m => '<li class="' + (m.what === 'mark' ? 'mark' : '') + '">' + clock(m.at - r.startedAt) + ' ' + chipify(m.line) + '</li>').join('') + '</ul></details>').join('');
}
const E = (path, v) => '<span data-path="' + path + '">' + esc(v) + '</span>';
const DEL = path => '<button type="button" class="del" data-del="' + path + '">✕</button>';
const sec = (title, body, extra = '') => '<div class="panel ' + extra + '"><p class="eyebrow">// ' + title + '</p>' + body + '</div>';
function guideHtml(g) {
  const h = [];
  h.push(sec('SUMMARY', '<p>' + SRC(g.summary.source) + E('summary.text', g.summary.text) + '</p>'));
  if (g.objectives.length) h.push(sec('OBJECTIVES', '<table><tr><th></th><th>Objective (as shown)</th><th>Requirement</th><th>Progress</th></tr>' + g.objectives.map((o, i) => '<tr data-row="objectives.' + i + '"><td>' + SRC(o.source) + DEL('objectives.' + i) + '</td><td>' + E('objectives.' + i + '.text', o.text) + '</td><td>' + E('objectives.' + i + '.requirement', o.requirement) + '</td><td>' + E('objectives.' + i + '.progress', o.progress) + '</td></tr>').join('') + '</table>'));
  if (g.rewards.length) h.push(sec('REWARD TIERS', '<table><tr><th></th><th>Tier</th><th>Requirement</th><th>Reward</th><th>Amount</th><th>Unit</th><th>Time limit</th></tr>' + g.rewards.map((o, i) => '<tr data-row="rewards.' + i + '"><td>' + SRC(o.source) + DEL('rewards.' + i) + '</td>' + ['tier', 'requirement', 'reward', 'amount', 'unit', 'timeLimit'].map(f => '<td>' + (f === 'unit' ? icon(UNIT(o.unit)) + ' ' : '') + E('rewards.' + i + '.' + f, o[f] ?? '') + '</td>').join('') + '</tr>').join('') + '</table>'));
  if (g.screens.length) {
    const points = {}; for (const r of g.recipes) for (const s of r.steps) if (s.x !== null && s.y !== null) (points[s.screen] = points[s.screen] || []).push(s);
    h.push(sec('SCREENS', '<div class="shots">' + g.screens.map((s, i) => '<div class="shotcard" data-row="screens.' + i + '">' + (s.shot ? '<div class="thumb"><img data-shot="' + esc(s.shot) + '" alt="">' + (points[s.id] || []).slice(0, 6).map(p => '<i class="pt" data-style="left:' + p.x + '%;top:' + p.y + '%" title="' + esc(p.do) + '"></i>').join('') + '</div><button type="button" class="small ghost" data-unshot="' + esc(s.shot) + '">' + icon('trash') + 'Delete picture</button>' : '') + '<b>' + SRC(s.source) + esc(s.id) + ' · ' + E('screens.' + i + '.name', s.name) + '</b>' + DEL('screens.' + i) + (s.purpose ? '<span>' + E('screens.' + i + '.purpose', s.purpose) + '</span>' : '') + (s.buttons.length ? '<span class="muted">' + s.buttons.map(b => esc(b.label) + (b.leadsTo ? ' → ' + esc(b.leadsTo) : '')).join(' · ') + '</span>' : '') + '</div>').join('') + '</div>'));
  }
  if (g.recipes.length) h.push(sec('HOW TO OPERATE IT', g.recipes.map((r, i) => '<div data-row="recipes.' + i + '"><p><b>' + SRC(r.source) + E('recipes.' + i + '.name', r.name) + '</b>' + DEL('recipes.' + i) + '</p><ol>' + r.steps.map((t, j) => '<li data-row="recipes.' + i + '.steps.' + j + '">' + E('recipes.' + i + '.steps.' + j + '.do', t.do) + (t.x !== null ? ' <code class="chipcode">' + t.x + '%, ' + t.y + '% on ' + esc(t.screen) + '</code>' : '') + DEL('recipes.' + i + '.steps.' + j) + '</li>').join('') + '</ol></div>').join('')));
  if (g.watchouts.length) h.push(sec('WATCH-OUTS · THESE COME BACK TO YOU', '<ul>' + g.watchouts.map((w, i) => '<li data-row="watchouts.' + i + '">' + SRC(w.source) + E('watchouts.' + i + '.text', w.text) + DEL('watchouts.' + i) + '</li>').join('') + '</ul>', 'watch'));
  if (g.questions.length || (g.answers || []).length) h.push(sec('QUESTIONS', (g.questions.length ? '<ul>' + g.questions.map((q, i) => '<li data-row="questions.' + i + '">' + E('questions.' + i, q) + DEL('questions.' + i) + '</li>').join('') + '</ul><p class="muted small">Answer them in the Falcor chat, or edit the guide.</p>' : '') + (g.answers || []).map(a => '<p class="small"><span class="muted">' + esc(a.q) + '</span><br>→ ' + esc(a.a) + '</p>').join('')));
  if (g.changes.length) h.push(sec('WHAT CHANGED IN THE LAST SESSION', '<ul>' + g.changes.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>'));
  return h.join('');
}
$('guideedit').onclick = () => {
  editing = !editing; $('guide').classList.toggle('editing', editing);
  for (const el of $('guide').querySelectorAll('[data-path]')) el.contentEditable = editing ? 'true' : 'false';
  $('guidesave').hidden = !editing; text($('guideedit'), editing ? 'Cancel' : 'Edit');
  if (!editing) { learnSig = ''; void loadApp(); }
};
$('guide').addEventListener('click', async e => {
  const d = e.target.closest('[data-del]'); if (d && editing) { const row = $('guide').querySelector('[data-row="' + d.dataset.del + '"]'); if (row) { row.dataset.deleted = '1'; row.hidden = true; } return; }
  const u = e.target.closest('[data-unshot]'); if (u && confirm('Delete this picture? The screen\'s text and buttons are kept.')) { await call('deleteShot', {pkg: learnPkg, id: u.dataset.unshot}); learnSig = ''; void loadApp(); return; }
  const th = e.target.closest('.thumb img'); if (th && th.src) { const lb = P.el('<div class="lightbox"><img alt=""></div>'); lb.firstChild.src = th.src; lb.onclick = () => lb.remove(); document.body.appendChild(lb); }
});
$('guidesave').onclick = async () => {
  const g = JSON.parse(JSON.stringify(L.guide));
  const set = (path, v) => { const k = path.split('.'); let o = g; while (k.length > 1) o = o[k.shift()]; o[k[0]] = k[0] === 'amount' ? (v.trim() === '' || isNaN(Number(v)) ? null : Number(v)) : v.trim(); };
  for (const el of $('guide').querySelectorAll('[data-path]')) if (!el.closest('[data-deleted]')) set(el.dataset.path, el.textContent);
  // Deleted rows, deepest and last first so the remaining indexes stay right.
  const gone = [...$('guide').querySelectorAll('[data-deleted]')].map(el => el.dataset.row).sort((a, b) => b.localeCompare(a, undefined, {numeric: true}));
  for (const path of gone) { const k = path.split('.'); let o = g; while (k.length > 1) o = o[k.shift()]; o.splice(Number(k[0]), 1); }
  await call('saveGuide', {pkg: learnPkg, guide: g});
  editing = false; learnSig = ''; void loadApp(); toast('Guide saved.');
};
// Electron has no prompt(): the name itself becomes editable; Enter saves, Escape cancels.
$('guiderename').onclick = () => { const h = $('guidename'); h.contentEditable = 'true'; h.focus(); document.getSelection().selectAllChildren(h); };
$('guidename').addEventListener('keydown', async e => {
  const h = $('guidename'); if (h.contentEditable !== 'true') return;
  if (e.key === 'Escape') { h.contentEditable = 'false'; h.textContent = L.name; }
  if (e.key === 'Enter') { e.preventDefault(); h.contentEditable = 'false'; const n = h.textContent.trim(); if (n && n !== L.name) { await call('renameApp', {pkg: learnPkg, name: n}); learnSig = ''; toast('Renamed.'); } else h.textContent = L.name; }
});
$('guideexport').onclick = async () => { if (await call('exportApp', {pkg: learnPkg})) toast('Exported.'); };
$('guidedelete').onclick = async () => { if (confirm('Delete everything Falcor learned about ' + L.name + '? Sessions, pictures and the guide are removed from this computer.')) { await call('deleteApp', {pkg: learnPkg}); learnPkg = null; learnSig = ''; toast('Deleted.'); } };
$('guidechat').onclick = () => { const p = learnPkg; go('falcor'); setTimeout(() => setFocus(p), 200); $('chattext').focus(); };
$('sessions').addEventListener('click', e => { const w = e.target.closest('[data-write]'); if (w) void showAfter(learnPkg, w.dataset.write, L.name, Number(w.dataset.screens)); });

// ------------------------------------------------------------------ stats
function renderStats() {
  const s = S.stats, days = s.days || [], last7 = days.slice(-7), y = days.at(-2) || {runs: 0, verified: 0};
  const sp = S.spend, total = sp.teach + sp.chat + sp.autopilot;
  const tiles = [
    {k: 'runs', label: 'Today: runs', v: s.today.runs, spark: last7.map(d => d.runs), delta: s.today.runs - y.runs},
    {k: 'verified', label: 'Today: verified', v: s.today.verified, spark: last7.map(d => d.verified), delta: s.today.verified - y.verified},
    {k: 'needs', label: 'Waiting on you', v: s.today.needsYou, spark: last7.map(d => d.needsYou), color: 'var(--sand)'},
    {k: 'all', label: 'All-time verified', v: s.allTime.verified, spark: last7.map((d, i) => last7.slice(0, i + 1).reduce((a, x) => a + x.verified, 0))},
    {k: 'spend', label: 'Kimi this month', v: total, money: true, spark: last7.map(d => (sp.days || {})[d.day] || 0), split: [sp.teach, sp.chat, sp.autopilot]},
  ];
  keyed($('tiles'), tiles, t => t.k, () => P.el('<div class="panel tile"><span class="muted small"></span><b></b><div class="sp"></div><span class="delta"></span><div class="splitbar"></div></div>'), (n, t) => {
    text(n.querySelector('.muted'), t.label); roll(n.querySelector('b'), t.v, t.money ? money : String);
    htmlOnce(n.querySelector('.sp'), P.spark(t.spark, t.color));
    text(n.querySelector('.delta'), t.delta === undefined ? (t.split ? 'teaching · chat · Autopilot' : '7 days') : (t.delta >= 0 ? '+' : '') + t.delta + ' vs yesterday');
    const sb = n.querySelector('.splitbar'); sb.hidden = !t.split;
    if (t.split) htmlOnce(sb, t.split.map(v => '<i data-style="flex:' + (total ? v / total : 0) + '" title="' + money(v) + '"></i>').join(''));
  });
  const max = Math.max(1, ...days.map(d => d.runs));
  cls($('bars'), 'nodata', !days.some(d => d.runs));
  htmlOnce($('bars'), days.map(d => '<div class="b" title="' + esc(d.day) + ': ' + d.runs + ' runs"><span>' + esc(d.day.slice(8)) + '</span><i data-style="height:' + (d.verified / max * 100) + '%"></i><i class="s" data-style="height:' + (d.needsYou / max * 100) + '%"></i><i class="r" data-style="height:' + (d.failed / max * 100) + '%"></i></div>').join(''));
  const rate = s.allTime.completionRate;
  meter($('rate'), rate ?? 0, '');
  htmlOnce($('ratelabel'), '<div class="meterlabel">' + (rate === null || rate === undefined ? 'No runs yet' : Math.round(rate * 100) + '%') + '</div><p class="muted small">of runs ended verified · ' + s.allTime.runs + ' runs all time' + (s.allTime.minutesPerRun ? ' · ' + s.allTime.minutesPerRun.toFixed(1) + ' min each' : '') + '</p>');
  htmlOnce($('spend'), '<p class="small">' + money(total) + ' Kimi this month' + (S.limit !== null ? ' of ' + money(S.limit) : '') + ' · teaching ' + money(sp.teach) + ' · chat ' + money(sp.chat) + ' · Autopilot ' + money(sp.autopilot) + '</p><p class="muted small">' + sp.tokens.toLocaleString() + ' tokens. Prices are Kimi\'s list prices; your Kimi account shows the exact bill.</p>');
  const units = Object.entries(s.rewards), STAGES = ['offered', 'claimed', 'pending', 'confirmed', 'received'];
  htmlOnce($('rewards'), units.length ? units.map(([u, r]) => '<div class="pipeline"><span>' + icon(UNIT(u)) + ' ' + esc(u) + '</span>' + STAGES.map(k => '<div class="st ' + (r[k] ? 'on' : '') + '"><i></i><span>' + k + ' ' + r[k] + '</span></div>').join('') + '</div>').join('') : '<div class="empty"><img src="dragon.png" alt=""><span>No rewards recorded yet. They show here per unit once a task claims one.</span></div>');
  const name = id => { const t = S.tasks.find(x => x.id === id); return t ? t.app + ' · ' + t.objective : 'Removed task'; };
  const runs = s.recentRuns;
  if (!runs.length) htmlOnce($('runs'), '<div class="empty" data-empty><img src="dragon.png" alt=""><span>No runs yet. Approve a task and press Run now, or start Autopilot.</span></div>');
  else { if ($('runs').querySelector('[data-empty]')) $('runs').innerHTML = ''; keyed($('runs'), runs, r => r.id || r.startedAt, () => P.el('<div><div class="runrow"><time></time><span class="nm"></span><span class="pill"></span><span class="muted small dur"></span></div><ul class="runsteps" hidden></ul></div>'), (n, r) => {
    text(n.querySelector('time'), time(r.startedAt)); text(n.querySelector('.nm'), name(r.missionId));
    const p = n.querySelector('.pill'); p.className = 'pill ' + (/VERIFIED|PENDING/.test(r.outcome) ? 'green' : r.outcome === 'RUNNING' ? 'green' : r.outcome === 'NO_CHANGE' ? 'muted' : 'sand'); text(p, r.outcome.replace(/_/g, ' ').toLowerCase());
    text(n.querySelector('.dur'), r.endedAt ? clock(r.endedAt - r.startedAt) : 'running');
    htmlOnce(n.querySelector('.runsteps'), (r.steps || []).map(x => '<li>' + time(x.at) + ' ' + esc(x.line) + '</li>').join('') || '<li>' + esc(r.reason) + '</li>');
  }); }
}
$('runs').onclick = e => { const row = e.target.closest('.runrow'); if (row) { const u = row.nextElementSibling; u.hidden = !u.hidden; } };

// ------------------------------------------------------------------ settings
let sub = 'ai';
function setSub(name) { sub = name; document.querySelectorAll('#submenu button').forEach(b => cls(b, 'on', b.dataset.sub === sub)); document.querySelectorAll('.settingsgrid .panel[data-sub]').forEach(p => { p.hidden = p.dataset.sub !== sub; }); }
document.querySelectorAll('#submenu button').forEach(b => b.onclick = () => setSub(b.dataset.sub));
let prevPhones = null;
function renderSettings() {
  const k = S.kimi, t = k.test;
  $('kimistate').firstElementChild.className = 'led ' + (!k.configured ? 'warn' : t && !t.ok ? 'bad' : 'on');
  text($('kimistate').lastElementChild, !k.configured ? 'No key' : t && !t.ok ? 'Error' : 'Connected');
  const known = ['kimi-k3', 'kimi-k2.5'];
  if (document.activeElement !== $('kimimodel') && document.activeElement !== $('kimicustom')) { $('kimimodel').value = known.includes(k.model) ? k.model : 'custom'; $('kimicustomwrap').hidden = known.includes(k.model); if (!known.includes(k.model)) $('kimicustom').value = k.model; }
  text($('kimiping'), t ? (t.ok ? 'Answered in ' + t.ms + ' ms · ' + time(t.at) : 'Failed: ' + t.error) : '');
  if (document.activeElement !== $('limit')) $('limit').value = S.limit ?? '';
  const spent = S.spend.teach + S.spend.chat + S.spend.autopilot;
  meter($('limitmeter'), S.limit ? spent / S.limit : 0, ''); $('limitmeter').title = money(spent) + (S.limit !== null ? ' of ' + money(S.limit) : ' this month, no limit');
  // Paired phones; a new pairing wipes the QR and builds a green check.
  if (prevPhones !== null && S.remote.phones.length > prevPhones && !$('pairbox').hidden) { $('qrframe').classList.add('wiped'); setTimeout(() => { $('qrdone').hidden = false; P.burst($('qrframe')); }, 380); clearInterval(pairTimer); text($('pairexp'), 'Paired.'); }
  prevPhones = S.remote.phones.length;
  keyed($('remotes'), S.remote.phones, p => p.id, () => P.el('<li><span class="led"></span><span class="grow"></span><button class="danger small">Unpair</button></li>'), (li, p) => { li.firstElementChild.className = 'led ' + (Date.now() - p.lastSeenAt < 60_000 ? 'on' : ''); htmlOnce(li.children[1], esc(p.name) + ' <span class="muted small">· last seen ' + (p.lastSeenAt ? time(p.lastSeenAt) : '—') + '</span>'); li.lastElementChild.dataset.unpair = p.id; });
  htmlOnce($('policies'), '<tr><th>App</th><th>Rule</th><th>Source</th><th></th></tr>' + S.profiles.map(p => '<tr><td>' + icon('lock') + ' ' + esc(p.label) + ' <code>' + esc(p.packages.join(', ')) + '</code></td><td><span class="pill red">' + esc(p.mode.replace('_', ' ').toLowerCase()) + '</span></td><td class="muted small">Built in: its rules forbid automated play</td><td></td></tr>').join('') + S.policies.map(p => '<tr><td>' + esc(appName(p.key)) + ' <code>' + esc(p.key) + '</code></td><td><span class="pill ' + (p.status === 'ALLOWED' ? 'green' : p.status === 'PROHIBITED' ? 'red' : 'sand') + '">' + esc(p.status) + '</span></td><td class="muted small">' + esc(p.source) + '</td><td><button class="small icon" title="Remove" data-unrule="' + esc(p.key) + '">' + icon('trash') + '</button></td></tr>').join(''));
  htmlOnce($('secrets'), S.secretNames.map(n => '<li>' + icon('lock') + '<code>vault:' + esc(n) + '</code><span class="grow"></span><button class="small danger" data-unsecret="' + esc(n) + '">Remove</button></li>').join('') || '<li class="muted small">No secrets saved.</li>');
  const u = S.update;
  text($('aboutver'), 'Falcor.Hub ' + S.version);
  $('updstate').firstElementChild.className = 'led ' + (!u || u.state === 'idle' ? 'on' : u.state === 'ready' || u.state === 'downloading' || u.state === 'checking' ? 'warn' : u.state === 'error' ? 'bad' : '');
  text($('updstate').lastElementChild, !u ? '' : u.state === 'dev' ? 'Checked in the installed app' : u.state === 'checking' ? 'Checking…' : u.state === 'downloading' ? 'Downloading ' + u.version : u.state === 'ready' ? u.version + ' ready: restart' : u.state === 'installer' ? u.version + ' needs a new installer' : u.state === 'error' ? 'Error: ' + u.error : 'Up to date');
  htmlOnce($('history'), '<div class="history">' + ((S.notesHistory || []).map(h => '<div><b>' + esc(h.version) + '</b><p class="muted small">' + esc(h.notes || 'Improvements and fixes.') + '</p></div>').join('') || '<p class="muted small">Notes from each update show here.</p>') + '</div>');
  text($('about'), 'Version ' + S.version + (S.simulated ? ' · simulated phone' : '') + ' · adb ' + (S.adb ? 'ready' : 'missing') + ' · scrcpy ' + (S.scrcpy ? 'ready' : 'missing'));
}
$('kimimodel').onchange = () => { $('kimicustomwrap').hidden = $('kimimodel').value !== 'custom'; };
$('kimiform').onsubmit = async e => { e.preventDefault(); const model = $('kimimodel').value === 'custom' ? $('kimicustom').value : $('kimimodel').value; await call('saveKimi', {key: $('kimikey').value, model}); $('kimikey').value = ''; toast('Kimi settings saved.'); };
$('kimitest').onclick = async () => { $('kimitest').classList.add('busy'); try { const r = await call('testKimi'); toast('Kimi answered "' + r.reply + '" in ' + r.ms + ' ms.'); } finally { $('kimitest').classList.remove('busy'); } };
$('kimiremove').onclick = async () => { await call('removeKimi'); toast('Kimi key removed.'); };
$('limitform').onsubmit = async e => { e.preventDefault(); await call('setLimit', {limit: $('limit').value === '' ? null : Number($('limit').value)}); toast('Monthly limit saved.'); };
let pairTimer = null;
$('pair').onclick = async () => {
  const p = await call('pairPhone');
  $('qrframe').classList.remove('wiped'); $('qrdone').hidden = true;
  $('qr').src = p.qrImage; $('paircode').innerHTML = p.code.split('').map(c => '<b>' + esc(c) + '</b>').join(''); text($('pairurl'), p.url || 'no home network found: connect this computer to Wi-Fi');
  $('pairbox').hidden = false; clearInterval(pairTimer);
  const total = Math.max(1, p.expiresAt - Date.now());
  const tickExp = () => { const left = Math.max(0, p.expiresAt - Date.now()), s = Math.round(left / 1000); $('paircount').style.width = (left / total * 100) + '%'; text($('pairexp'), s ? 'In Falcor.Hub Remote: Scan QR, or type the address and code. Expires in ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '.' : 'Expired. Make a new code.'); if (!s) clearInterval(pairTimer); };
  tickExp(); pairTimer = setInterval(tickExp, 1000);
};
$('firewall').onclick = async () => toast(await call('firewall'));
$('policyform').onsubmit = async e => { e.preventDefault(); const f = e.target; await call('savePolicy', {key: f.key.value, status: f.status.value, source: f.source.value}); f.reset(); toast('App rule saved.'); };
$('secretform').onsubmit = async e => { e.preventDefault(); const f = e.target; await call('setSecret', {name: f.name.value, value: f.value.value}); f.reset(); toast('Secret sealed on this computer.'); };
$('updcheck').onclick = () => call('updateCheck').then(() => toast('Checked for updates.'));


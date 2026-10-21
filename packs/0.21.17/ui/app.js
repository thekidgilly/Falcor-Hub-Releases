// Falcor.Hub's window. Everything goes through window.hub.call(name, args); the page has no Node and no network.
// Structure is built once; each status update changes only the text, attributes and list rows that changed (Pixel.keyed),
// so animations never replay, and scroll and focus stay where they are.
const P = window.Pixel; P.sprite();
let polling = false, statusSeq = 0;   // the status poll: one at a time, and older answers dropped
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
// Toasts: blue done, sand attention, red errors (errors stay until closed). No layout shift.
function toast(msg, kind = 'ok') {
  const t = P.el('<div class="toast ' + (kind === 'bad' ? 'bad' : kind === 'warn' ? 'warn' : '') + '"><span class="led ' + (kind === 'bad' ? 'bad' : kind === 'warn' ? 'warn' : 'on') + '"></span><span>' + esc(msg) + '</span><button class="ghost small" title="Close">×</button></div>');
  t.querySelector('button').onclick = () => P.motion.dismiss(t);
  $('toasts').appendChild(t);
  while ($('toasts').children.length > 4) $('toasts').firstElementChild.remove();
  if (kind !== 'bad') setTimeout(() => P.motion.dismiss(t), kind === 'warn' ? 7000 : 4000);
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
const TABS = ['phone', 'sandbox', 'games', 'tasks', 'falcor', 'stats', 'settings'];
// An app's guide (Knowledge) has no tab of its own: it opens from its game, a task, the chat or Settings → Knowledge,
// lights the tab it came from, and Back returns there.
let learnFrom = {tab: 'settings', sub: 'knowledge', pkg: null};
function go(name, sub) {
  if (!TABS.includes(name) && name !== 'knowledge') return;
  const changed = name !== tab;
  tab = name;
  if (changed && name === 'phone') setTimeout(() => watchOffers(), 0);
  const lit = tab === 'knowledge' ? learnFrom.tab : tab;
  document.querySelectorAll('.tabs button').forEach(x => cls(x, 'on', x.dataset.tab === lit));
  document.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== tab; });
  if (sub) setSub(sub);
  if (window.sbPlace) sbPlace(tab);
  if (window.deskTab) deskTab(tab);
  placeTabline(); render();
  if (changed) P.motion.enter(document.querySelector('[data-pane="' + tab + '"]'));
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === lit)));
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
  if (!typing() && !e.ctrlKey && !e.altKey && !e.metaKey && /^[1-7]$/.test(e.key) && document.activeElement !== $('mirrorbox')) go(TABS[Number(e.key) - 1]);
});
const boot = P.intro({dragon: 'dragon.png', flight: 'boot-flight.png', name: 'FALCOR HUB', skip: /nointro/.test(location.search)});
setTimeout(placeTabline, 50);

// ------------------------------------------------------------------ status
window.hub.onStatus(s => { if (s) { statusSeq++; S = s; render(); boot.finish(); } });
call('status').then(s => { S = s; render(); boot.finish(); }).catch(() => { boot.finish(); });
// The 5 s poll (pushes come in between): never two at once, and an answer older than one already shown is dropped.
setInterval(() => { if (polling) return; polling = true; const mine = ++statusSeq; window.hub.call('status').then(s => { if (s && mine === statusSeq) { S = s; render(); } }).catch(() => {}).finally(() => { polling = false; }); }, 5000);
const dev = () => S && (S.devices.find(d => d.id === deviceId) || S.devices[0]) || null;
let wasEmergency = false, prevStates = new Map(), autoSeen = null;
function render() {
  if (!S) return;
  const d = dev(); deviceId = d ? d.id : null;
  renderPhoneCap();
  const human = !!(d && d.control && d.control.kind === 'human');
  if (controlling !== human) controlling = human;
  const em = S.devices.some(x => x.emergency), auto = S.devices.some(x => x.autopilot), waiting = S.tasks.filter(t => t.state === 'NEEDS_REVIEW' || t.state === 'NEEDS_ATTENTION').length;
  // Header: the living logo's eye, the system strip, Stop and the emergency bar.
  cls($('logo'), 'live', auto && !waiting); cls($('logo'), 'wait', waiting > 0);
  setLed('led-phone', d ? d.connected && d.authorized ? 'on' : 'warn' : 'bad'); text($('sys-phone'), d ? d.connected && d.authorized ? d.label : d.connected ? 'Allow USB debugging' : 'Not connected' : 'No phone');
  // The queue is what runs: paused, or running what is scheduled (busy while something runs).
  const qd = d && S.queue && S.queue.devices ? S.queue.devices[d.id] : null, qPaused = !!(qd && qd.paused), qBusy = !!(qd && qd.current);
  setLed('led-auto', em ? 'bad' : qPaused ? 'warn' : qBusy || auto ? 'on' : ''); text($('sys-auto'), em ? 'Queue stopped' : qPaused ? 'Queue paused' : qBusy ? 'Queue running' : 'Queue ready');
  // The header shows the model that plays games now (any provider), or that none is set.
  const ga = S.ai && S.ai.active && S.ai.active.gaming; setLed('led-kimi', !ga ? 'warn' : ga.status === 'connected' ? 'on' : ga.status === 'failed' ? 'bad' : 'warn'); text($('sys-kimi'), 'API'); $('sys-kimi').parentElement.title = ga ? 'Gaming AI: ' + ga.model + ' · ' + ga.provider + (ga.status === 'connected' ? '' : ' (' + ga.status.replace('_', ' ') + ')') : 'No AI model set: Settings → AI';
  setLed('led-remote', S.remote.phones.some(p => Date.now() - p.lastSeenAt < 90_000) ? 'on' : ''); text($('sys-remote'), 'Remote' + (S.remote.phones.length ? ' · ' + S.remote.phones.length : ''));
  if (em && !wasEmergency) { document.body.classList.remove('glitch'); void document.body.offsetWidth; document.body.classList.add('glitch'); $('ebar').classList.add('stepin'); }
  wasEmergency = em; $('ebar').hidden = !em;
  // Badges.
  setBadge('badge-tasks', waiting + ((S.sandbox && S.sandbox.live) || []).filter(l => l.status === 'NEEDS_ATTENTION' && l.mode === 'run').length); setBadge('badge-falcor', S.chat.unread && tab !== 'falcor' ? S.chat.unread : 0);
  renderBell();
  renderStatusbar(d);
  renderTeach();
  // A Teach session Falcor started for a new task: show the mirror so the owner can play.
  const learning = S.teaching && S.teaching.auto && (!S.teaching.kind || S.teaching.kind === 'teach') ? S.teaching.id : null, was = autoSeen;
  autoSeen = learning;
  if (learning && learning !== was) { toast('Falcor opened ' + S.teaching.name + ' and is recording. Play it on the mirror; when you leave the game, Falcor studies it and adds it to Games.'); if (tab !== 'sandbox') { go('sandbox'); if (window.sbMode) sbMode('teach'); return; } }
  if (!learning && was) toast('Teaching ended. If you played, Falcor is studying it; the game shows in Games with its guide.');
  // Success moments: a task that just became verified bursts.
  for (const t of S.tasks) { const was = prevStates.get(t.id); if (was && was !== t.state && /VERIFIED|RECEIVED/.test(t.state)) setTimeout(() => P.burst(document.querySelector('.task[data-key="' + t.id + '"]') || $('tiles') || $('logo')), 50); prevStates.set(t.id, t.state); }
  if (tab === 'phone') renderPhone(d);
  if (tab === 'sandbox' && window.renderSandbox) renderSandbox(d);
  if (tab === 'games') { renderGames(); renderCapProgress(); }
  if (tab === 'tasks') renderTasks();
  if (tab === 'falcor') renderChatMeta();
  if (tab === 'knowledge') renderLearn();
  if (tab === 'stats' && window.renderActivity) renderActivity();
  if (tab === 'tasks' && window.renderCreations) renderCreations();
  if (tab === 'settings') { renderSettings(); renderKnowledgeList(); }
}
function setLed(id, state) { const l = $(id); if (l) l.className = 'led' + (state ? ' ' + state : ''); }
function setBadge(id, n) { const b = $(id); b.hidden = !n; text(b, n || ''); }
function renderStatusbar(d) {
  const u = S.update, upd = !u ? '' : u.state === 'dev' ? 'dev build' : u.state === 'ready' ? u.version + ' ready' : u.state === 'downloading' ? 'downloading ' + (u.percent ?? 0) + '%' : u.state === 'checking' ? 'checking' : u.state === 'error' ? 'update error' : 'up to date';
  htmlOnce($('statusbar'), [
    '<span><i class="led ' + (S.adb ? 'on' : 'bad') + '"></i>adb ' + (S.adb ? 'ready' : 'missing') + '</span>',
    '<span><i class="led ' + (S.scrcpy ? 'on' : '') + '"></i>scrcpy ' + (S.scrcpy ? 'ready' : 'missing') + '</span>',
    '<span id="fps">' + esc(fpsText) + '</span>',
    // The model that plays games now and its provider (the one that actually handles gameplay requests).
    '<span title="Gaming AI">' + icon('ai') + (S.ai && S.ai.active.gaming ? esc(S.ai.active.gaming.model) + ' · ' + esc(S.ai.active.gaming.provider) : 'no gaming AI') + (S.kimi.lastReplyAt ? ' · last reply ' + time(S.kimi.lastReplyAt) : '') + '</span>',
    '<span>' + icon('wifi') + S.remote.phones.length + ' paired</span>',
    d && d.battery !== null && d.battery !== undefined ? '<span>battery ' + d.battery + '%</span>' : '',
    '<span class="right">v' + esc(S.version) + (S.simulated ? ' · simulated phone' : '') + ' · ' + esc(upd) + '</span>',
  ].join(''));
}
let fpsText = '';
function setFps(t) { fpsText = t; const f = $('fps'); if (f) text(f, t); }
// ------------------------------------------------------------------ the bell: what Falcor told you on its own
// (an update is ready, a task needs you or was verified, a guide is ready, an offer milestone), never in the chat.
// Opening it marks them read; the ones that were new stay lit until it closes.
let bellFresh = new Set();
function renderBell() {
  const n = S.notices || {unread: 0, list: []}, u = S.update, running = S.devices.some(x => x.running), ready = !!(u && u.state === 'ready');
  const count = n.unread + (ready && !n.list.some(x => x.kind === 'update' && !x.read) ? 1 : 0), b = $('bellcount');
  b.hidden = !count; text(b, count > 9 ? '9+' : String(count)); cls($('bell'), 'lit', count > 0);
  $('bell').title = count ? count + ' new notification' + (count === 1 ? '' : 's') : 'Notifications';
  $('bellupdate').hidden = !ready;
  if (ready) { text($('noticetext'), 'Falcor.Hub ' + u.version + ' is ready. ' + (running ? 'It installs when no task is running.' : 'Restart takes a few seconds; your tasks and settings are kept.')); $('updatebtn').disabled = running; }
  if (!$('bellpanel').hidden) htmlOnce($('belllist'), P.noticesHtml(n.list, bellFresh));
}
function bellOpen(on) {
  const p = $('bellpanel'); if (on === !p.hidden) return;
  p.hidden = !on; $('bell').setAttribute('aria-expanded', String(on));
  if (on) { bellFresh = new Set((S.notices?.list || []).filter(x => !x.read).map(x => x.id)); htmlOnce($('belllist'), P.noticesHtml(S.notices?.list || [], bellFresh)); p.classList.remove('stepin'); void p.offsetWidth; p.classList.add('stepin'); if (bellFresh.size) void window.hub.call('noticesRead', {}).then(r => { S.notices = r; renderBell(); }).catch(() => {}); }
  else bellFresh = new Set();
}
$('bell').onclick = e => { e.stopPropagation(); bellOpen($('bellpanel').hidden); };
$('bellpanel').addEventListener('click', async e => {
  e.stopPropagation();
  const l = e.target.closest('[data-nlink]'), x = e.target.closest('[data-nclear]');
  if (l) { bellOpen(false); followLink(l.dataset.nlink, l.dataset.nref); return; }
  if (x) { S.notices = await call('noticesClear', {id: x.dataset.nclear}); bellFresh.delete(x.dataset.nclear); renderBell(); }
});
$('bellread').onclick = async () => { S.notices = await call('noticesRead', {}); bellFresh = new Set(); renderBell(); };
$('bellclear').onclick = async () => { S.notices = await call('noticesClear', {}); bellFresh = new Set(); renderBell(); };
document.addEventListener('click', e => { if (!$('bellpanel').hidden && !e.target.closest('#bellpanel, #bell')) bellOpen(false); });
window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('bellpanel').hidden) bellOpen(false); });
$('updatebtn').onclick = () => { if (S && S.update && S.update.state === 'ready') void call('updateRestart'); };
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
  if (!ready) { if (window.renderDesk) renderDesk(d, false); return; }
  $('devpick').hidden = S.devices.length < 2;
  if (S.devices.length > 1) htmlOnce($('devpick'), S.devices.map(x => '<option value="' + esc(x.id) + '"' + (x.id === d.id ? ' selected' : '') + '>' + esc(x.label) + '</option>').join(''));
  text($('devname'), d.label);
  const st = d.emergency ? ['bad', 'Emergency Stop'] : d.teaching ? ['rec', 'Teaching'] : d.control && d.control.kind === 'human' ? ['warn', 'You have control'] : d.running ? ['active', 'Running a task'] : d.autopilot ? ['active', 'Autopilot on'] : ['', 'Ready'];
  $('devstate').firstElementChild.className = 'led ' + st[0]; text($('devstate').lastElementChild, st[1]);
  text($('d-model'), d.model || '—'); text($('d-android'), d.androidVersion || '—');
  htmlOnce($('d-app'), d.foreground ? esc(d.foregroundName || d.foreground) + '<small>' + esc(d.foreground) + '</small>' : '—');
  $('d-batt').hidden = $('d-batt-l').hidden = d.battery === null || d.battery === undefined; text($('d-batt'), d.battery != null ? d.battery + '%' : '');
  text($('d-control'), d.control ? (d.control.kind === 'human' ? 'You' : 'Falcor') : 'Falcor idle');
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
  // The current activity (the queue's, a task run when due, or a Sandbox run) and Today's Queue (queue.js).
  if (window.renderCurrent) { renderCurrent(d); renderQueue(d); }
  renderLog();
  // The desk of windows (desk.js): laid out the first time it has a size; the windows from its menu draw themselves.
  if (window.renderDesk) renderDesk(d, true);
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
$('take').onclick = async () => { await call('take', {deviceId}); toast('You have control. Click to tap, drag to swipe, scroll with the wheel, type with the keyboard.'); $('mirrorbox').focus(); };
$('release').onclick = () => call('release', {deviceId});
$('viewer').onclick = () => call('viewer', {deviceId}).then(() => toast('scrcpy window open. You have control while it is open.'));
$('kbd').onclick = () => { $('typeform').hidden = !$('typeform').hidden; if (!$('typeform').hidden) $('typetext').focus(); };
$('askfalcor').onclick = () => { const d = dev(); chatFresh(d && d.foreground && !/launcher/.test(d.foreground) ? d.foreground : null); go('falcor'); $('chattext').focus(); };
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
// The device frame is sized to the phone's aspect ratio, as large as fits where it is.
let aspect = 9 / 20;
// A game played sideways turns the picture wide: the frame turns with it and the Phone tab's windows take their
// sideways places (desk.js); upright again, they go back.
function setAspect(w, h) {
  if (!w || !h || Math.abs(w / h - aspect) <= 0.001) return;
  aspect = w / h;
  const wide = aspect > 1;
  cls($('device'), 'landscape', wide); cls($('phonegrid'), 'landscape', wide); cls(document.body, 'phone-landscape', wide);
  if (window.deskOrient) deskOrient(wide);
  fitDevice();
}
// The frame fills its host as far as the picture's shape allows: the phone screen window's stage on the Phone tab, the
// Sandbox's stage in the Sandbox. Its padding (the speaker side) turns with it.
function fitDevice() {
  const host = $('device').parentElement;
  if (!host || !host.clientHeight || !host.clientWidth) return;
  const wide = aspect > 1, padX = wide ? 44 : 24, padY = wide ? 24 : 40;
  let dh = host.clientHeight - 4, dw = (dh - padY) * aspect + padX;
  if (dw > host.clientWidth - 4) { dw = host.clientWidth - 4; dh = (dw - padX) / aspect + padY; }
  $('device').style.setProperty('--devw', Math.max(60, Math.round(dw)) + 'px'); $('device').style.setProperty('--devh', Math.max(60, Math.round(dh)) + 'px');
  if (host.id === 'sbstage' && window.sbPins) sbPins();
}
window.addEventListener('resize', fitDevice);
new ResizeObserver(fitDevice).observe($('stage')); new ResizeObserver(fitDevice).observe($('sbstage'));
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
    teachSeen = {at: Date.now(), ms: t.elapsedMs, state: t.state, left: null};
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
  text($('afterest'), !est.configured ? 'Connect an AI provider in Settings → AI to have Falcor AI write it, or save it without AI (free).'
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
  $('after').hidden = true; after = null;
  S = await call('status').catch(() => S); // the new guide must be in the status before its page opens
  openGuide(a.pkg);
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
// A game's picture is asked for again when it changes (the app's icon read after the offer's artwork was shown).
function iconHtml(g) {
  const k = g.pkg + '@' + (g.iconAt || 0);
  if (g.icon && !icons.has(k)) { icons.set(k, ''); window.hub.call('appIcon', {pkg: g.pkg}).then(u => P.normIcon(u)).then(u => { icons.set(k, u || null); if (tab === 'games') renderGames(true); }).catch(() => icons.set(k, null)); }
  const u = icons.get(k);
  return u ? '<img src="' + esc(u) + '" alt="">' : P.monogram(g.name, g.pkg);
}
const gameState = g => g.note ? {label: g.note, mood: 'sand'} : !g.tasks.length && (g.earning || []).length ? {label: g.earning.reduce((n, o) => n + o.progress.done, 0) + ' of ' + g.earning.reduce((n, o) => n + o.progress.of, 0) + ' milestones', mood: 'green'} : g.tasks.some(t => t.state === 'RUNNING') ? {label: 'Running', mood: 'green'} : g.needsYou ? {label: g.needsYou + ' need' + (g.needsYou === 1 ? 's' : '') + ' you', mood: 'sand'} : g.active ? {label: g.active + ' active', mood: 'green'} : g.tasks.length ? {label: 'All done', mood: 'muted'} : {label: 'Learned', mood: 'muted'};
// The library: every game as a card (artwork, platform, potential, verified earnings, goals, status, deadline), filtered
// and sorted the same way on the phone.
let libFilter = 'all', libSort = 'updated';
try { libFilter = localStorage.getItem('libFilter') || 'all'; libSort = localStorage.getItem('libSort') || 'updated'; } catch { /* the defaults */ }
function renderGames(force) {
  const list = S.games || [];
  if (gamePkg && !list.some(g => g.pkg === gamePkg)) gamePkg = null;
  $('gamesview').hidden = !!gamePkg; $('gamepage').hidden = !gamePkg;
  if (gamePkg) return renderGame(list.find(g => g.pkg === gamePkg), force);
  const box = $('gamegrid');
  for (const b of $('libfilter').querySelectorAll('button')) cls(b, 'on', b.dataset.f === libFilter);
  $('libsort').value = libSort;
  if (!list.length) { htmlOnce(box, '<div class="panel empty" data-empty><img src="dragon.png" alt=""><span>No games yet. Open a game\'s offer in your earning app on the phone and press Capture game, or create a task for a game: Falcor opens it so you can show it how to play.</span><button class="primary" data-newgame>' + icon('plus') + 'New task</button></div>'); return; }
  const shown = P.library(list, libFilter, libSort);
  if (!shown.length) { htmlOnce(box, '<div class="panel empty" data-empty><span>No ' + esc(libFilter) + ' games.</span></div>'); return; }
  if (box.querySelector('[data-empty]')) box.innerHTML = '';
  keyed(box, shown, g => g.pkg, () => P.el('<button class="panel gametile gcard"></button>'), (n, g) => {
    htmlOnce(n, P.cardHtml(g, iconHtml(g)));
    n.title = g.name + (g.pkg.startsWith('offer:') ? ' · not linked to an app on the phone yet' : ' · ' + g.pkg);
  });
}
$('libfilter').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; libFilter = b.dataset.f; try { localStorage.setItem('libFilter', libFilter); } catch { /* not kept */ } renderGames(); };
$('libsort').onchange = () => { libSort = $('libsort').value; try { localStorage.setItem('libSort', libSort); } catch { /* not kept */ } renderGames(); };
function renderGame(g) {
  const st = gameState(g), d = dev();
  htmlOnce($('gpicon'), iconHtml(g));
  text($('gpname'), g.name);
  // (research done: nothing to show; the playbook below says it is ready)
  htmlOnce($('gpprep'), g.prep && g.prep.phase !== 'done' ? P.prepHtml(g.prep) : '');
  $('gpweb').hidden = !g.research; htmlOnce($('gpwebbody'), P.researchHtml(g.research));
  htmlOnce($('gpmeta'), (g.pkg.startsWith('offer:') ? 'Offer only' : '<code>' + esc(g.pkg) + '</code>') + ' · <span class="' + st.mood + '">' + esc(st.label) + '</span>' + (g.level !== null && g.level !== undefined ? ' · level ' + esc(g.level) : '') + (g.lastPlayed ? ' · last played ' + new Date(g.lastPlayed).toLocaleString() : '') + (g.installed ? '' : ' · <span class="sand">' + (g.pkg.startsWith('offer:') ? 'not installed on the phone yet: it links by itself once it is' : 'not on the phone') + '</span>'));
  $('gpopen').disabled = !d || !g.installed || !!d.running || !!d.emergency;
  $('gpopen').title = !d ? 'Plug in the phone' : !g.installed ? 'Not installed on the phone' : d.running ? 'A task is running' : d.emergency ? 'Emergency Stop is on' : 'Open it on the phone and take control';
  // Teach Falcor on this game: one press, then play; Finish & Learn while it records (or just leave the game).
  const co = g.coach || {state: 'idle'}, mine = co.state === 'recording' || co.state === 'waiting';
  $('gpteach').disabled = !mine && (!d || !g.installed || !!d.emergency || !!S.teaching);
  $('gpteach').title = mine ? 'Stop recording and learn from it now (leaving the game does the same)' : 'Play it your way: Falcor records and learns from you (no time to fill, nothing else to press)';
  $('gpteach').innerHTML = icon(mine ? 'check' : 'rec') + (co.state === 'recording' ? 'Finish & Learn' : co.state === 'waiting' ? 'Cancel Teach' : 'Teach Falcor');
  renderTrain(g);
  // Play now / Schedule run the game's own automation (its task, or a sequence that opens it); without one it needs setup.
  const au = g.automation || {ready: false, setup: false, why: '', target: null, name: ''};
  $('gpplay').disabled = !d || !au.ready || !!d.emergency; $('gpplay').title = au.ready ? 'Falcor plays it now: ' + au.name + ' (the queue does not start)' : au.why;
  $('gpsched').disabled = !au.ready; $('gpsched').title = au.ready ? 'Put "' + au.name + '" in the Daily Queue at a time' : au.why;
  $('gpauto').innerHTML = icon(au.setup ? 'plus' : 'edit') + (au.setup ? 'Set up automation' : 'Edit automation'); $('gpauto').disabled = !au.ready && !au.setup;
  htmlOnce($('gpautoline'), au.ready ? '<span class="pill green">READY</span><span>Plays: <b>' + esc(au.name) + '</b></span>' + (g.schedules || []).map(x => '<span class="muted">' + icon('calendar') + ' ' + esc(x.words) + (x.enabled && x.next ? ' · next ' + esc(when(x.next)) : x.enabled ? '' : ' · off') + '</span>').join('') : au.setup ? '<span class="pill sand">NEEDS SETUP</span><span class="muted">' + esc(au.why) + '</span>' : au.why ? '<span class="pill muted">MANUAL</span><span class="muted">' + esc(au.why) + '</span>' : '');
  $('gpguide').disabled = !g.learned;
  // The header: platform, status, the most it can pay, what was credited or paid out, and time left (when known).
  const tot = g.totals || [], stx = {active: ['Active', 'green'], completed: ['Completed', 'accent'], expired: ['Expired', 'red'], none: [st.label, st.mood]}[g.status] || [st.label, st.mood];
  const stats = [['PLATFORM', (g.platforms || []).join(' · ') || '—', ''], ['STATUS', stx[0], stx[1]], ['MAX REWARD', tot.filter(t => t.potential).map(t => P.money(t.potential, t.unit)).join(' + ') || '—', ''],
    ['VERIFIED EARNINGS', tot.filter(t => t.earned).map(t => P.money(t.earned, t.unit)).join(' + ') || '0', tot.some(t => t.earned) ? 'green' : 'muted'], ['TIME REMAINING', g.deadline ? g.deadline.text : '—', g.deadline && g.deadline.at && g.deadline.at - Date.now() < 86_400_000 ? 'sand' : '']];
  htmlOnce($('gpstats'), (g.earning || []).length ? stats.map(([k, v, c]) => '<span><em>' + k + '</em><b class="' + c + '">' + esc(v) + '</b></span>').join('') : '');
  const first = (g.earning || [])[0];
  $('gpofferedit').hidden = $('gpofferrefresh').hidden = !first;
  $('gpofferrefresh').disabled = !d || !!d.emergency; $('gpofferrefresh').title = 'Open the offer page in ' + (first ? first.source.name : 'the earning app') + ' on the phone, then read it again and see what changed';
  $('gpofferbox').hidden = !(g.earning || []).length;
  htmlOnce($('gpoffers'), P.offersHtml(g, true)); P.fix($('gpoffers'));
  htmlOnce($('gpact'), P.activityHtml(g));
  $('gpopen').hidden = $('gpteach').hidden = $('gptask').hidden = $('gpchat').hidden = $('gpguide').hidden = g.pkg.startsWith('offer:');
  // (only once something was collected or claimed: an empty explanation is noise beside the playbook)
  $('gpearnbox').hidden = !(g.rewards || []).length && !(g.history || []).length;
  htmlOnce($('gpearn'), P.rewardsHtml(g)); P.fix($('gpearn'));
  htmlOnce($('gphist'), P.historyHtml(g));
  $('gptierbox').hidden = !(g.tiers || []).length && !(g.objectives || []).length;
  htmlOnce($('gptiers'), P.tiersHtml(g));
  renderNotes(g);
  // (a game's Smart Playbook makes its tasks; the list shows only when there are some, made here or by hand from More)
  $('gptasksbox').hidden = !g.tasks.length;
  const box = $('gptasks');
  if (!g.tasks.length) htmlOnce(box, '');
  else {
    if (box.querySelector('[data-empty]')) box.innerHTML = '';
    keyed(box, g.tasks, t => t.id, () => P.el('<div class="gtask"><div class="main"></div><div class="acts"></div></div>'), (n, t) => {
      const why = t.needs ? 'Needs you: ' + t.needs.reason : t.lastError || '';
      htmlOnce(n.querySelector('.main'), '<div class="obj">' + icon(TYPEICON[t.type] || 'tasks') + ' ' + esc(t.objective) + '</div><div class="meta"><span>' + esc(TYPE[t.type] || t.type) + '</span>' + (t.targetLevel ? '<span>level ' + esc(t.level ?? 0) + ' of ' + esc(t.targetLevel) + '</span>' : '') + (t.reward !== null ? '<span>' + icon(UNIT(t.unit)) + ' offer ' + esc(t.reward) + ' ' + esc(t.unit) + '</span>' : '') + (t.nextAt && t.state === 'SCHEDULED' ? '<span>next ' + when(t.nextAt) + '</span>' : '') + '<span class="pill ' + (trackOf(t.state).mood === 'needs' ? 'sand' : trackOf(t.state).mood === 'bad' ? 'red' : 'green') + '">' + esc(t.stateLabel) + '</span></div>' + P.progressHtml(t) + trackHtml(t.state) + (why ? '<div class="why sand">' + esc(why) + '</div>' : ''));
      const acts = [];
      if (!['NEEDS_REVIEW', 'DRAFT', 'RUNNING', 'BLOCKED', 'CANCELLED', 'EXPIRED', 'FAILED', 'RECEIVED', 'INVALIDATED'].includes(t.state)) acts.push('<button class="primary small" data-qrun="mission:' + esc(t.id) + '" data-name="' + esc(t.objective) + '">' + icon('play') + 'Run now</button>');
      if (['SCHEDULED', 'RUNNING', 'READY', 'NEEDS_ATTENTION'].includes(t.state)) acts.push('<button class="small" data-task="' + esc(t.id) + '" data-act="pause">' + icon('pause') + 'Pause</button>');
      if (t.state === 'PAUSED') acts.push('<button class="small" data-task="' + esc(t.id) + '" data-act="resume">' + icon('play') + 'Resume</button>');
      acts.push('<button class="small" data-gotask="' + esc(t.id) + '">' + (t.state === 'NEEDS_REVIEW' ? icon('check') + 'Approve in Tasks' : 'Open in Tasks') + '</button>');
      htmlOnce(n.querySelector('.acts'), acts.join(''));
    });
  }
  renderAutopilot(g, d);
  renderAds(g);
  const k = g.learned, moves = g.moves ? '<p class="small green">' + g.moves + ' step' + (g.moves === 1 ? '' : 's') + ' Falcor presses here without asking (from your teaching and its own runs).</p>' : '';
  htmlOnce($('gpknowbody'), moves + (k ? '<p>' + esc(k.summary || (k.hasGuide ? 'Guide ready.' : 'Recorded; no guide written yet.')) + '</p><p class="muted small">' + k.sessions + ' teaching session' + (k.sessions === 1 ? '' : 's') + ' · last ' + new Date(k.lastSessionAt).toLocaleDateString() + '</p><button class="small" data-link="knowledge" data-ref="' + esc(g.pkg) + '">' + icon('book') + 'Read the guide</button>'
    : '<p class="muted small">' + (g.note ? esc(g.note) + '.' : 'Falcor has not learned this game yet. Press Teach again (or Teach on the Phone tab) and play it on the mirror.') + '</p>'));
}
// Game Autopilot: the goal (next level, an offer milestone that is a level, level N, or one of its tasks), Start / Pause /
// Stop, and what is true now: the verified level, the live step, inputs the phone accepted, the next return and what
// the last session taught (campaigns.ts).
function renderAutopilot(g, d) {
  $('gpap').hidden = g.pkg.startsWith('offer:');
  const c = g.campaign, on = !!c && c.active && !c.paused, goals = g.apGoals || [];
  const sig = goals.map(x => x.objective + ':' + x.label).join('|'), sel = $('gpgoal');
  renderPlan(g);
  // The model that plays (any provider), and the one that last actually answered a move.
  const ai = S.ai && S.ai.active; text($('gpai'), ai && ai.gaming ? '· ' + ai.gaming.model + ' · ' + ai.gaming.provider + (ai.lastPlan && ai.lastPlan.model !== ai.gaming.model ? ' (last move by ' + ai.lastPlan.model + ')' : '') : '· no gaming AI set');
  if (sel.dataset.sig !== sig) {
    const keep = sel.value;
    sel.innerHTML = goals.map((x, i) => '<option value="' + i + '">' + esc(x.label) + '</option>').join('') + '<option value="level">Level…</option>';
    sel.dataset.sig = sig; if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
  }
  $('gplevelbox').hidden = sel.value !== 'level'; $('gpgoalbox').hidden = on;
  // A game with a Smart Playbook: its panel is the one place to start, pause and stop; no goal to pick.
  const pb = pbMode(g); $('gpaphead').hidden = pb;
  $('gpapstart').hidden = on; $('gpappause').hidden = $('gpapstop').hidden = !on;
  if (c && c.paused) $('gpapstop').hidden = false;
  $('gpapstart').disabled = !d || !!d.emergency || !g.installed || !!g.locked;
  $('gpapstart').title = !d ? 'Plug in the phone' : d.emergency ? 'Emergency Stop is on' : !g.installed ? 'Not installed on the phone' : g.locked ? g.locked : 'Falcor plays this game toward the goal now, then comes back by itself until it is verified';
  $('gpapstart').innerHTML = icon('play') + (c && c.paused ? 'Play now' : 'Start Autopilot');
  const r = g.review, L = [];
  const state = !c ? ['OFF', 'muted'] : c.running ? ['PLAYING', 'green'] : on ? ['ON', 'green'] : c.paused ? ['PAUSED', 'sand'] : ['OFF', 'muted'];
  // (a playbook shows its own state; below it only what is happening now and what the last session taught)
  if (!pb || (c && (c.running || c.last))) L.push('<div class="gpapstate">' + (pb ? '' : '<span class="pill ' + state[1] + '">' + state[0] + '</span>') + (c ? '<span><em>Goal</em>' + esc(c.goal) + '</span>' : (pb ? '' : '<span class="muted">Pick a goal and press Start Autopilot. Falcor plays it now (or in its turn in the queue), comes back by itself, and never buys anything.</span>'))
    + (g.level !== null && g.level !== undefined ? '<span><em>Verified level</em>' + esc(g.level) + '</span>' : '')
    + (c && c.running && c.step ? '<span><em>Now</em>' + esc(c.step) + '</span>' : '')
    + (c && c.last ? '<span><em>Last session</em>' + esc(c.last.accepted) + ' input' + (c.last.accepted === 1 ? '' : 's') + ' accepted · ' + esc(String(c.last.outcome).toLowerCase().replace(/_/g, ' ')) + '</span>' : '')
    + (c && c.nextAt ? '<span><em>Next return</em>' + esc(when(c.nextAt)) + '</span>' : '')
    + (c && !c.running && c.nextWhy ? '<span class="muted">' + esc(c.ended || c.nextWhy) + '</span>' : '') + '</div>');
  if (r) L.push('<div class="gpapreview"><p class="eyebrow">// WHAT THE LAST SESSION TAUGHT · ' + esc(new Date(r.at).toLocaleString()) + '</p><ul>'
    + r.worked.map(x => '<li class="green">' + esc(x) + '</li>').join('') + r.failed.map(x => '<li class="sand">' + esc(x) + '</li>').join('') + '</ul><p class="small"><b>Next:</b> ' + esc(r.next) + '</p></div>');
  htmlOnce($('gpapbody'), L.join(''));
}
$('gpgoal').onchange = () => { $('gplevelbox').hidden = $('gpgoal').value !== 'level'; if (!$('gplevelbox').hidden) $('gplevel').focus(); };
// Smart Playbook (plans.ts): the offer's whole ladder as one plan; Run Playbook approves it once and the game's campaign
// walks it milestone after milestone, coming back by itself (also while the Phone tab's Autopilot is off).
// Smart Playbook: the premium panel (pixel.js#playbookHtml), one start button, no choices before it.
function pbMode(g) { return !!(g.smart && (g.smart.runnable || ['active', 'paused'].includes(g.smart.plan.status) || (g.campaign && g.campaign.planId && (g.campaign.active || g.campaign.paused)))); }
function renderPlan(g) {
  const v = g.smart, box = $('gpplan'), d = dev();
  const gate = !d ? {ok: false, why: 'Plug in the phone.'} : d.emergency ? {ok: false, why: 'Emergency Stop is on.'} : !g.installed ? {ok: false, why: 'Install the game on the phone first.'} : g.locked ? {ok: false, why: g.locked} : {ok: true, why: ''};
  // Being played this moment (the queue's current session is this game): its session ends by start + its minutes.
  const cur = d && S.queue && S.queue.devices && S.queue.devices[d.id] ? S.queue.devices[d.id].current : null;
  if (cur && cur.pkg === g.pkg) { gate.playing = true; gate.until = cur.durationMin ? cur.startedAt + cur.durationMin * 60000 : null; }
  const html = pbMode(g) || (v && v.plan.steps.length) ? P.playbookHtml(v, gate) : '';
  box.hidden = !html; htmlOnce(box, html);
}
$('gpplan').addEventListener('click', async e => {
  const b = e.target.closest('[data-pb]'); if (!b || b.disabled) return;
  const g = S.games.find(x => x.pkg === gamePkg), d = dev(); if (!g) return;
  const k = b.dataset.pb; b.classList.add('busy');
  try {
    if (k === 'start') { if (!d) return; await planRun(g, d); }
    else { await call('gamePlaybook', {pkg: g.pkg, op: k}); toast(k === 'pause' ? 'Playbook paused. Nothing plays until you press Play now.' : 'Playbook stopped. Its sessions are cancelled.'); }
  } finally { b.classList.remove('busy'); }
});
async function planRun(g, d, extra = {}) {
  const strategy = g.smart.plan.strategy;
  let r = await call('gamePlaybook', {pkg: g.pkg, op: 'run', deviceId: d.id, strategy, ...extra});
  if (r && r.needsApproval) { const ok = await apApprove({...r.needsApproval, run: true}); if (!ok) return; extra = {...extra, rulesAllow: true}; r = await call('gamePlaybook', {pkg: g.pkg, op: 'run', deviceId: d.id, strategy, ...extra}); }
  if (r && r.conflict) { const choice = await qAsk(r.conflict); if (!choice) return; r = await call('gamePlaybook', {pkg: g.pkg, op: 'run', deviceId: d.id, strategy, ...extra, choice}); }
  if (r && r.already) toast(g.name + ': the playbook is already running.', 'warn');
  else if (r && (r.started || r.queued)) { toast(r.queued ? g.name + ' plays next, after what is running now.' : 'Playing ' + g.name + ' now, for up to an hour. It comes back by itself until every milestone is verified.'); go('phone'); }
}
async function apStart(extra = {}) {
  const g = S.games.find(x => x.pkg === gamePkg), d = dev(); if (!g || !d) return;
  if (g.campaign && g.campaign.planId && g.campaign.paused && !extra.fresh) return planRun(g, d, extra);
  const v = $('gpgoal').value, goal = v === 'level' ? {objective: 'level', target: Number($('gplevel').value)} : (() => { const x = (g.apGoals || [])[Number(v)] || {objective: 'next'}; return {objective: x.objective, target: x.target, offerId: x.offerId, missionId: x.missionId}; })();
  if (g.campaign && g.campaign.paused && !extra.fresh) Object.assign(goal, {objective: g.campaign.objective, target: g.campaign.target, offerId: g.campaign.offerId, missionId: g.campaign.missionId});
  if (goal.objective === 'level' && !(goal.target >= 1)) { toast('Type the level to reach.', 'warn'); $('gplevel').focus(); return; }
  let r = await call('gameAutopilot', {pkg: g.pkg, op: 'start', deviceId: d.id, ...goal, ...extra});
  if (r && r.needsApproval) {
    const ok = await apApprove(r.needsApproval); if (!ok) return;
    extra = {...extra, rulesAllow: true}; r = await call('gameAutopilot', {pkg: g.pkg, op: 'start', deviceId: d.id, ...goal, ...extra});
  }
  if (r && r.conflict) { const choice = await qAsk(r.conflict); if (!choice) return; r = await call('gameAutopilot', {pkg: g.pkg, op: 'start', deviceId: d.id, ...goal, ...extra, choice}); }
  if (r && r.already) toast(g.name + ' is already running.', 'warn');
  else if (r && r.queued) toast('Game Autopilot on: ' + g.name + ' runs after what is running now.');
  else if (r && r.started) toast('Game Autopilot on: Falcor is playing ' + g.name + '.');
  // Started or lined up: the Phone tab, to watch it play (the mirror, the current activity and the queue).
  if (r && (r.started || r.queued)) go('phone');
}
// A new task for the goal: the owner reads the rules and ticks them (the same approval as Tasks); nothing runs before.
function apApprove(n) {
  return new Promise(resolve => {
    let done = false; const end = v => { if (done) return; done = true; qSheet.close(); resolve(v); };
    qSheet.open(qSheet.head(n.run ? 'RUN SMART PLAYBOOK' : 'APPROVE GAME AUTOPILOT', n.name) + '<p class="small">Goal: <b>' + esc(n.goal) + '</b>. ' + (n.existing ? 'Its task waits for your approval.' : 'A task for it is made when you approve.') + '</p><ul class="small">' + n.rules.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>'
      + '<label class="small"><input type="checkbox" id="aprules"> I approve these rules</label><div class="row"><button class="primary" id="apgo" disabled>' + icon('check') + (n.run ? 'Run Playbook' : 'Approve and start') + '</button><button data-close>Cancel</button></div>', b => {
      b.querySelector('#aprules').onchange = e => { b.querySelector('#apgo').disabled = !e.target.checked; };
      b.querySelector('#apgo').onclick = () => end(true);
      b.querySelector('[data-close]').addEventListener('click', () => end(false));
    });
    const obs = new MutationObserver(() => { if ($('qsheet').hidden) { obs.disconnect(); end(false); } });
    obs.observe($('qsheet'), {attributes: true, attributeFilter: ['hidden']});
  });
}
$('gpapstart').onclick = () => void apStart().catch(() => null);
const planOwned = () => { const g = S.games.find(x => x.pkg === gamePkg); return !!(g && g.campaign && g.campaign.planId); };
$('gpappause').onclick = async () => { await call(planOwned() ? 'gamePlaybook' : 'gameAutopilot', {pkg: gamePkg, op: 'pause'}); toast('Game Autopilot paused. Nothing plays until you press Play now.'); };
$('gpapstop').onclick = async () => { await call(planOwned() ? 'gamePlaybook' : 'gameAutopilot', {pkg: gamePkg, op: 'stop'}); toast('Game Autopilot stopped. Its returns are cancelled.'); };
// Rewarded ads: on for every game. Falcor plays an ad offer while the owner is here to watch it and closes it once the
// reward is granted; a game can be turned off (and on again) here.
function renderAds(g) {
  const box = $('gpadsbody'), sig = g.pkg + ':' + g.ads + ':' + g.adsAlways + ':' + g.adsLocked;
  $('gpads').hidden = g.pkg.startsWith('offer:');
  if (box.dataset.sig === sig) return; box.dataset.sig = sig;
  const mode = !g.ads ? 'off' : g.adsAlways ? 'always' : 'on';
  const opt = (m, label) => '<button class="small' + (mode === m ? ' primary' : '') + '" data-ads="' + m + '"' + (mode === m ? ' aria-pressed="true"' : '') + '>' + label + '</button>';
  box.innerHTML = g.adsLocked ? '<p class="muted small">Link this game to its installed app first.</p>'
    : '<p class="small">' + (mode === 'always' ? '<span class="led on"></span> Always: whenever the game offers a reward for an ad, Falcor plays it, waits for the reward, then closes it with its X or skip arrows.'
      : mode === 'on' ? '<span class="led on"></span> While you are here: Falcor plays reward ads only while you are at the computer or in the phone app.'
      : 'Off: Falcor passes by "watch an ad" offers in this game.') + ' It never taps inside an ad or buys anything.</p><div class="row">' + opt('always', 'Always') + opt('on', 'While I am here') + opt('off', 'Off') + '</div>';
}
$('gpadsbody').onclick = async e => {
  const b = e.target.closest('[data-ads]'); if (!b || !gamePkg) return;
  const m = b.dataset.ads;
  await call('setAds', {pkg: gamePkg, on: m !== 'off', always: m === 'always'});
  toast(m === 'always' ? 'Rewarded ads: always, for this game.' : m === 'on' ? 'Rewarded ads: while you are here, for this game.' : 'Rewarded ads off for this game.');
};
// The owner's notes for this game (campaigns.ts#tell): read first on every move; added and removed here.
function renderNotes(g) {
  const box = $('gpnotelist'), notes = g.ownerNotes || [];
  $('gpnotes').hidden = g.pkg.startsWith('offer:');
  htmlOnce(box, notes.length ? '<ul class="notes">' + notes.map((n, i) => '<li><span>' + esc(n) + '</span><button class="small icon" data-delnote="' + i + '" title="Remove this note">' + icon('trash') + '</button></li>').join('') + '</ul>'
    : '<p class="muted small">No notes yet. Tell Falcor what to press on a screen it gets stuck on.</p>');
}
$('gpnoteform').onsubmit = async e => {
  e.preventDefault(); if (!gamePkg) return;
  const t = $('gpnotetext').value.trim(); if (!t) return;
  await call('gameTell', {pkg: gamePkg, text: t}); $('gpnotetext').value = ''; toast('Note added: Falcor follows it from the next move.');
};
$('gpnotelist').onclick = async e => {
  const b = e.target.closest('[data-delnote]'); if (!b || !gamePkg) return;
  const g = S.games && S.games.find(x => x.pkg === gamePkg), n = g && (g.ownerNotes || [])[Number(b.dataset.delnote)]; if (!n) return;
  await call('gameTell', {pkg: gamePkg, text: '', forget: n}); toast('Note removed.');
};
// ---------------------------------------------------------------- offers from earning apps
// Capture game reads the offer page open on the phone, screen after screen, into this form; nothing is saved until the
// owner checks it and saves. Refresh offer reads a saved one again and lists what changed.
let offerDraft = null, capOffer = null;
const MSTATES = P.MSTATE;
function offerRow(m = {text: '', amount: '', unit: 'points', done: false}) {
  const stored = m.status || (m.done ? 'goal_reached' : 'not_started');
  const r = P.el('<div class="mrow"><input data-k="text" maxlength="120" placeholder="Reach level 10"><input data-k="amount" type="number" min="0" step="any" placeholder="reward" data-num="1"><input data-k="unit" maxlength="24" placeholder="unit"><select data-k="status" title="Its stage">' + MSTATES.map(([k, l]) => '<option value="' + k + '">' + l + '</option>').join('') + '</select><button type="button" class="icon small ghost" title="Remove">' + icon('close') + '</button>' + (m.review || m.paid ? '<em class="sand small">' + esc(m.paid ? 'Needs a purchase: yours to decide. ' : '') + esc(m.review || '') + '</em>' : '') + '</div>');
  r.querySelector('[data-k="text"]').value = m.text; r.querySelector('[data-k="amount"]').value = m.amount ?? ''; r.querySelector('[data-k="unit"]').value = m.unit || ''; r.querySelector('[data-k="status"]').value = stored;
  r.dataset.json = JSON.stringify(m);
  r.querySelector('button').onclick = () => r.remove();
  $('offerrows').appendChild(r);
}
function offerDl() { const k = $('offerform').dlkind.value; for (const l of $('offerform').querySelectorAll('[data-dl]')) l.hidden = k === 'unknown' || (l.dataset.dl === 'started' && k !== 'duration'); }
$('offerform').dlkind.onchange = offerDl;
const isoDay = at => { const d = new Date(at); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
async function openOffer(draft, installed, where, diff) {
  offerDraft = draft || {source: {name: '', pkg: ''}, game: {name: '', pkg: null}, milestones: [], total: null, expiresAt: null, by: 'owner'};
  const f = $('offerform');
  $('offerform').hidden = false; $('offerfields').hidden = false; $('offerstart').hidden = true;
  text($('offerwhere'), where || 'Fill in the offer as the earning app shows it.');
  // A refresh: what changed, for the owner to check before it is saved.
  $('offerdiff').hidden = !diff;
  if (diff) htmlOnce($('offerdiff'), '<p class="eyebrow">// WHAT CHANGED</p><p>' + esc(diff.summary.join(' ')) + '</p>' + (diff.added.length ? '<p class="small green">New: ' + esc(diff.added.slice(0, 8).join(' · ')) + (diff.added.length > 8 ? ' · +' + (diff.added.length - 8) + ' more' : '') + '</p>' : '')
    + (diff.changed.length ? '<p class="small sand">Changed: ' + diff.changed.slice(0, 6).map(c => esc(c.text) + ' ' + esc(c.from ?? '?') + ' → ' + esc(c.to ?? '?')).join(' · ') + '</p>' : '') + (diff.kept.length ? '<p class="small">Kept yours: ' + diff.kept.map(c => esc(c.text) + ' ' + esc(c.yours) + ' (page says ' + esc(c.page ?? '?') + ')').join(' · ') + '</p>' : '') + (diff.unseen.length ? '<p class="small muted">Not on the screens read (kept): ' + esc(diff.unseen.slice(0, 6).join(' · ')) + '</p>' : ''));
  void installed;
  // No app list to pick from: Falcor links the offer to the game by itself once it is installed on the phone.
  const gp = offerDraft.game.pkg;
  htmlOnce($('offerphone'), gp ? '<span class="led on"></span><span class="green">Installed</span> <code>' + esc(gp) + '</code>' : '<span class="led warn"></span><span class="sand">Not installed yet</span> <span class="muted small">· Falcor links it by itself once the game is on the phone</span>');
  f.source.value = offerDraft.source.name; f.game.value = offerDraft.game.name;
  const dl = offerDraft.deadline || {kind: offerDraft.expiresAt ? 'fixed' : 'unknown', durationDays: null, startedAt: null};
  f.dlkind.value = dl.kind || 'unknown';
  f.days.value = dl.kind === 'duration' ? (dl.durationDays ?? '') : offerDraft.expiresAt ? Math.round((offerDraft.expiresAt - Date.now()) / 8_640_000) / 10 : '';
  f.started.value = dl.startedAt ? isoDay(dl.startedAt) : '';
  offerDl();
  f.total.value = offerDraft.total ? offerDraft.total.amount : ''; f.totalunit.value = offerDraft.total ? offerDraft.total.unit : '';
  $('offerrows').innerHTML = ''; for (const m of offerDraft.milestones) offerRow(m); if (!offerDraft.milestones.length) offerRow();
  text($('offercount'), offerDraft.milestones.length ? '· ' + offerDraft.milestones.length + (offerDraft.milestones.some(m => m.review) ? ' · ' + offerDraft.milestones.filter(m => m.review).length + ' to check' : '') : '');
  numbers(f); f.game.focus();
}
function closeOffer() { $('offerform').hidden = true; $('offerfields').hidden = true; $('offerstart').hidden = false; $('offerdiff').hidden = true; offerDraft = null; }
$('offeradd').onclick = () => { closeOffer(); $('offerform').hidden = false; };
$('offercancel').onclick = closeOffer;
$('offerhand').onclick = () => openOffer(null, null, 'Fill in the offer as the earning app shows it.');
$('offerrow').onclick = () => offerRow();
// The capture panel: what was read so far, screen after screen.
function capShow(r) {
  $('capbox').hidden = false;
  if (!r.artPreview) htmlOnce($('capart'), P.monogram(r.draft.game.name || '?', r.draft.game.name || 'x'));
  else void P.normIcon(r.artPreview).then(u => htmlOnce($('capart'), '<img src="' + esc(u) + '" alt="">'));
  text($('capsrc'), (r.draft.source.name || '').toUpperCase()); text($('capname'), r.draft.game.name || 'Game not named on the page');
  roll($('capscreens'), r.screens, String); roll($('capcount'), r.draft.milestones.length, String);
  const line = r.end ? 'That looks like the end of the page. Review it.' : r.gaps && r.gaps.length ? 'Screen ' + r.gaps[r.gaps.length - 1] + ' shared nothing with the one before: scroll back up a little and read again, so nothing is skipped.' : r.screens === 1 ? 'Read the first screen. Press Auto-capture and Falcor scrolls the whole page and reads it all.' : r.added + ' new line' + (r.added === 1 ? '' : 's') + ' on screen ' + r.screens + '.';
  htmlOnce($('capline'), '<span class="' + (r.end ? 'green' : r.gaps && r.gaps.length ? 'sand' : 'muted') + '">' + esc(line) + '</span>' + (r.pictured ? ' <span class="sand">Read from a picture of the page: check every amount.</span>' : '') + (capOffer ? ' <span class="pill accent">REFRESH</span>' : ''));
  htmlOnce($('caplast'), r.draft.milestones.slice(-4).map(m => '<li><span class="no">' + String(m.order + 1).padStart(2, '0') + '</span><span class="t"><span>' + esc(m.text) + '</span></span><b class="amt">' + (m.amount === null ? '?' : esc(P.money(m.amount, m.unit))) + '</b></li>').join(''));
  cls($('capdone'), 'primary', r.end); cls($('capauto'), 'primary', !r.end);
}
// Auto-capture's bar: stepped, from what the computer says (status.capture), while it scrolls and reads.
let capAutoOn = false;
function renderCapProgress() {
  const p = S.capture && deviceId ? S.capture[deviceId] : null;
  $('capprog').hidden = !p || $('capbox').hidden;
  if (!p || $('capbox').hidden) return;
  const n = 24, on = Math.round(p.percent / 100 * n);
  htmlOnce($('capbar'), Array.from({length: n}, (_, i) => '<i class="' + (i < on ? 'on' : '') + (i === on && p.phase !== 'done' && p.phase !== 'stopped' ? ' now' : '') + '"></i>').join(''));
  text($('capprogline'), p.line); text($('cappct'), p.percent + '%'); cls($('capprog'), 'done', p.phase === 'done'); cls($('capprog'), 'stopped', p.phase === 'stopped');
  $('capstop').hidden = !capAutoOn;
  if (p.phase === 'reading') { roll($('capscreens'), p.screens, String); roll($('capcount'), p.milestones, String); }
}
async function capAuto() {
  if (capAutoOn) return;
  capAutoOn = true;
  for (const b of $('capacts').querySelectorAll('button')) b.disabled = b.id !== 'capcancel';
  try {
    const r = await window.hub.call('captureAuto', {deviceId});
    capShow(r);
    if (r.end) { capAutoOn = false; await capReview(); return; }
  } catch (e) { const m = errText(e); if (!/cancelled/i.test(m)) toast(m, 'warn'); if (/try Capture Game|could not read this screen/.test(m)) { $('capbox').hidden = true; capOffer = null; } }
  finally { capAutoOn = false; for (const b of $('capacts').querySelectorAll('button')) b.disabled = false; renderCapProgress(); }
}
$('capauto').onclick = () => void capAuto();
$('capstop').onclick = () => void window.hub.call('captureStop', {deviceId});
async function capStart(offerId, join, scan) {
  if (!deviceId) { toast('Plug in the phone first.', 'warn'); return null; }
  closeOffer(); capOffer = offerId || null;
  try { const r = await window.hub.call('captureStart', {deviceId, offerId: capOffer, join: !!join, scan: !!scan}); if (gamePkg) { gamePkg = null; renderGames(); } capShow(r); if (r.auto) capAutoOn = true; renderCapProgress(); return r; }
  catch (e) { capOffer = null; const m = errText(e); toast(m, 'warn'); if (/by hand/.test(m)) openOffer({source: {name: (/^(.+?)'s offer import/.exec(m) || [])[1] || '', pkg: ''}, game: {name: '', pkg: null}, milestones: [], total: null, expiresAt: null, by: 'owner'}, null, m); return null; }
}
// The Phone tab's Capture Game: what Falcor spotted on the phone (status.sense, per phone) lights it blue; a press opens
// Games and runs the same capture as there (capStart, then capAuto), one session per phone.
let phoneCapBusy = false;
function renderPhoneCap() {
  const st = S.sense && deviceId ? S.sense[deviceId] : null, d = dev(), state = !d ? 'unavailable' : st ? st.state : 'idle';
  const capturing = state === 'capturing' || !!(S.capture && deviceId && S.capture[deviceId] && !['done', 'stopped'].includes(S.capture[deviceId].phase));
  cls($('phonecap'), 'hot', state === 'new' && !capturing); cls($('phonecap'), 'saved', state === 'existing' && !capturing);
  $('phonecap').disabled = phoneCapBusy || state === 'unavailable';
  text($('phonecaplbl'), state === 'existing' && !capturing ? 'REFRESH OFFER' : 'CAPTURE GAME');
  const note = capturing ? 'CAPTURE IN PROGRESS' : state === 'new' ? (st.name ? st.name + ' · Ready to capture' : 'NEW GAME OFFER DETECTED') : state === 'existing' ? 'OFFER ALREADY SAVED' + (st.name ? ' · ' + st.name : '') : '';
  text($('capsense'), note); cls($('capsense'), 'hot', state === 'new' && !capturing);
  $('phonecap').title = state === 'new' ? 'A game offer is open on the phone: Games opens and Falcor reads the whole page' : state === 'existing' ? 'This offer is already saved: read it again and see what changed' : 'Read the game\'s offer page open on the phone (Games opens and Falcor reads the whole page)';
}
async function phoneCapture() {
  if (phoneCapBusy || !deviceId) return;
  phoneCapBusy = true; renderPhoneCap();
  try {
    const st = S.sense ? S.sense[deviceId] : null;
    go('games');
    const r = await capStart(st && st.state === 'existing' ? st.offerId : null, true, true);
    if (r && !r.active && !r.end) await capAuto();
  } finally { phoneCapBusy = false; renderPhoneCap(); }
}
$('phonecap').onclick = () => void phoneCapture();
const watchOffers = () => { if (tab === 'phone' && deviceId && !document.hidden) void window.hub.call('watchOffers', {deviceId, on: true}).catch(() => null); };
setInterval(watchOffers, 5000);
async function capStep(op, args = {}) {
  for (const b of $('capbox').querySelectorAll('button')) b.disabled = true;
  try { return await call(op, {deviceId, ...args}); }
  finally { for (const b of $('capbox').querySelectorAll('button')) b.disabled = false; }
}
// Capture game in Games: one press scans the whole page (Auto-capture), like the Phone tab's button.
let capScanBusy = false;
async function capScan() { if (capScanBusy) return; capScanBusy = true; try { const r = await capStart(null, true, true); if (r && !r.active && !r.end) await capAuto(); } finally { capScanBusy = false; } }
$('capgame').onclick = () => void capScan();
$('offercapture').onclick = () => void capScan();
$('capnext').onclick = async () => capShow(await capStep('captureMore'));
$('capcancel').onclick = async () => { await window.hub.call('captureCancel', {deviceId}).catch(() => null); $('capbox').hidden = true; capOffer = null; capAutoOn = false; };
$('capdone').onclick = () => void capReview();
async function capReview() {
  const r = await capStep('captureFinish'); $('capbox').hidden = true;
  const many = r.screens > 1 ? r.screens + ' screens' : 'one screen';
  await openOffer({...r.draft, art: r.art}, r.installed, (capOffer ? 'Read again from ' : 'Read from ') + r.draft.source.name + ' on the phone (' + many + ', ' + r.draft.milestones.length + ' milestones). Check everything, fix what is wrong, then Save.', r.diff);
  capOffer = null;
}
$('offerform').onsubmit = async e => {
  e.preventDefault();
  const f = $('offerform'), days = f.days.value === '' ? null : Number(f.days.value), kind = f.dlkind.value;
  const started = f.started.value ? new Date(f.started.value + 'T12:00:00').getTime() : null;
  const d = offerDraft || {};
  const milestones = [...$('offerrows').querySelectorAll('.mrow')].map(r => {
    const was = JSON.parse(r.dataset.json || '{}'), amount = r.querySelector('[data-k="amount"]').value === '' ? null : Number(r.querySelector('[data-k="amount"]').value), status = r.querySelector('[data-k="status"]').value;
    const stored = was.status || (was.done ? 'goal_reached' : 'not_started');
    return {...was, text: r.querySelector('[data-k="text"]').value, amount, unit: r.querySelector('[data-k="unit"]').value, status, done: status !== 'not_started',
      ...(status !== stored ? {by: 'owner'} : {}), ...(was.text !== undefined && (amount !== (was.amount ?? null)) ? {edited: true} : {})};
  }).filter(m => m.text.trim());
  const offer = {...d, id: d.id, by: d.by || 'owner', source: {name: f.source.value, pkg: d.source && d.source.pkg || ''}, game: {name: f.game.value, pkg: offerDraft.game.pkg || null},
    total: f.total.value === '' ? null : {amount: Number(f.total.value), unit: f.totalunit.value || 'points'},
    expiresAt: kind === 'fixed' && days !== null ? Date.now() + days * 86_400_000 : null,
    deadline: {kind: kind === 'unknown' || days === null ? 'unknown' : kind, durationDays: kind === 'duration' ? days : null, startedAt: kind === 'duration' ? started : null, source: (d.deadline && d.deadline.source) || ''},
    milestones};
  const o = await call('saveOffer', {offer});
  closeOffer(); S = await call('status'); gamePkg = o.game.pkg || 'offer:' + o.id; go('games');
  toast('Offer saved: ' + o.game.name + ' via ' + o.source.name + '.');
};
// A milestone's stage, set from its menu on the reward ladder (the phone app sets the same records).
$('gpoffers').addEventListener('change', async e => { const b = e.target.closest('[data-mstate]'); if (b) await call('setMilestone', {id: b.dataset.offer, key: b.dataset.mid || Number(b.dataset.i), status: b.value}); });
const offerOf = id => (S.games.find(g => g.pkg === gamePkg)?.earning || []).find(x => x.id === id);
async function editOffer(o) { gamePkg = null; renderGames(); await openOffer(o, null, 'Editing the ' + o.source.name + ' offer.'); }
$('gpoffers').addEventListener('click', async e => {
  const ed = e.target.closest('[data-offer-edit]'), rm = e.target.closest('[data-offer-remove]'), rf = e.target.closest('[data-offer-refresh]'), sd = e.target.closest('[data-offer-started]');
  if (ed) { const o = offerOf(ed.dataset.offerEdit); if (o) await editOffer(o); }
  if (rf) await capStart(rf.dataset.offerRefresh);
  if (sd) { await call('offerStarted', {id: sd.dataset.offerStarted, at: Date.now()}); toast('Its countdown starts today.'); }
  if (rm) { const o = offerOf(rm.dataset.offerRemove); if (o && confirm('Remove the ' + o.source.name + ' offer for ' + o.game.name + '?')) await call('removeOffer', {id: o.id}); }
});
$('gpofferedit').onclick = () => { const o = (S.games.find(g => g.pkg === gamePkg)?.earning || [])[0]; if (o) void editOffer(o); };
$('gpofferrefresh').onclick = () => { const o = (S.games.find(g => g.pkg === gamePkg)?.earning || [])[0]; if (o) void capStart(o.id); };
$('gamegrid').onclick = e => { if (e.target.closest('[data-newgame]')) return openDrawer(); const t = e.target.closest('.gametile'); if (t) { gamePkg = t.dataset.key; renderGames(); $('gamepage').scrollIntoView({block: 'start'}); } };
$('gamenew').onclick = () => openDrawer();
$('gameback').onclick = () => { gamePkg = null; renderGames(); };
$('gpopen').onclick = async () => { await call('openApp', {deviceId, pkg: gamePkg}); go('phone'); toast('Opened. You have control: play it on the mirror, or press Release when you are done.'); };
$('gpteach').onclick = async () => {
  const g = S.games.find(x => x.pkg === gamePkg); if (!g) return;
  if (g.coach && g.coach.state !== 'idle') { const r = await call('gameTeach', {pkg: g.pkg, op: 'finish'}); Object.assign(g, r); renderGame(g); toast(g.coach && g.coach.state === 'idle' ? 'Teach Falcor: learning from what you showed.' : 'Teach Falcor cancelled.'); return; }
  const r = await call('gameTeach', {pkg: g.pkg, op: 'start', deviceId}); Object.assign(g, r);
  if (r.note) { toast(r.note, 'warn'); return; }
  // The game opens on the phone; recording starts by itself once it is in front. The owner keeps playing their way.
  renderGame(g); toast('Teach Falcor: play ' + g.name + ' your way, on the phone or the mirror. Leave the game or press Finish & Learn when you are done.');
};
// Teach Falcor's lessons on this game. Only real states are shown.
function renderTrain(g) {
  const box = $('gptrain'), html = g.pkg.startsWith('offer:') ? '' : P.trainHtml(g);
  box.hidden = !html; if (html) { htmlOnce(box, html); P.fix(box); }
}
$('gptrain').onclick = async e => {
  const b = e.target.closest('[data-dellesson]'); if (!b) return;
  const r = await call('gameTeach', {pkg: gamePkg, op: 'delete', id: b.dataset.dellesson}); const g = S.games.find(x => x.pkg === gamePkg); if (g) { Object.assign(g, r); renderGame(g); }
};
// Remove game: its playbook and Autopilot stop, its tasks, schedules, offers and what Falcor learned are forgotten;
// the app on the phone stays installed.
$('gpremove').onclick = async () => {
  const g = S.games.find(x => x.pkg === gamePkg); if (!g) return;
  if (!confirm('Remove ' + g.name + ' from Games?\n\nIts Autopilot and playbook stop, and its tasks, schedules, offers and what Falcor learned about it are deleted. The app stays on your phone.')) return;
  try { await call('removeGame', {pkg: g.pkg}); gamePkg = null; S = await call('status'); renderGames(); toast(g.name + ' removed.'); } catch (e) { toast(e.message || String(e), 'warn'); }
};
// More: a choice closes the menu; so does a click anywhere else.
$('gpmore').addEventListener('click', ev => { if (ev.target.closest('.gmenu button')) $('gpmore').open = false; });
document.addEventListener('click', ev => { if ($('gpmore').open && !ev.target.closest('#gpmore')) $('gpmore').open = false; });
$('gptask').onclick = () => { openDrawer(); draft.app = gamePkg; draft.step = 2; drawStep(); };
const gameAuto = () => (S.games.find(x => x.pkg === gamePkg) || {}).automation || {};
$('gpplay').onclick = () => { const g = S.games.find(x => x.pkg === gamePkg), au = gameAuto(); if (au.target) void qRun(au.target, {name: g ? g.name : ''}); };
$('gpsched').onclick = () => { const g = S.games.find(x => x.pkg === gamePkg), au = gameAuto(); if (au.target) openScheduler({target: au.target, kind: 'game', name: g ? g.name : au.name, pkg: gamePkg}); };
$('gpauto').onclick = async () => {
  const au = gameAuto();
  if (au.target && au.target.type === 'sequence') { go('sandbox'); if (window.sbOpen) await sbOpen(au.target.id); return; }
  if (au.target && au.target.type === 'mission') { followLink('tasks', au.target.id); setTimeout(() => { const n = document.querySelector('.task[data-key="' + au.target.id + '"]'); if (n && !au.setup) void openEditor(n, au.target.id); }, 120); return; }
  openDrawer(); draft.app = gamePkg; draft.step = 2; drawStep();
};
$('gpguide').onclick = () => followLink('knowledge', gamePkg);
$('gpchat').onclick = () => { chatFresh(gamePkg); go('falcor'); $('chattext').focus(); };
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
// A task's schedules in the Daily Queue, each with its on/off switch.
const schedHtml = list => (list || []).length ? '<div class="tsched">' + list.map(x => '<label class="check small" title="In the Daily Queue"><input type="checkbox" data-qtoggle="' + esc(x.id) + '"' + (x.enabled ? ' checked' : '') + '>' + icon('calendar') + '<span>' + esc(x.words) + (x.autoStart ? ' · starts by itself' : '') + (x.enabled && x.next ? ' · next ' + esc(when(x.next)) : x.enabled ? '' : ' · off') + (x.lastError ? ' · ' + esc(x.lastError) : '') + '</span></label>').join('') + '</div>' : '';
// A Sandbox sequence saved as a task: Run now, Schedule, History, Edit (in the Sandbox) and its schedules.
function drawSeqTask(node, q) {
  htmlOnce(node.querySelector('.main'), '<div class="obj"><b>' + esc(q.title) + '</b></div><div class="meta"><span>' + icon('sandbox') + ' Sandbox sequence</span><span>' + q.steps + ' steps · v' + q.revision + '</span>' + (q.lastRun ? '<span>last ' + esc(q.lastRun.status.toLowerCase()) + ' ' + esc(when(q.lastRun.at) === 'now' ? time(q.lastRun.at) : new Date(q.lastRun.at).toLocaleString()) + '</span>' : '<span>never run</span>') + (q.running ? '<span class="pill green">Running</span>' : '') + '</div>' + schedHtml(q.schedules));
  const qt = 'sequence:' + q.id;
  htmlOnce(node.querySelector('.acts'), '<button class="primary small" data-qrun="' + esc(qt) + '" data-name="' + esc(q.title) + '"' + (q.running ? ' disabled' : '') + '>' + icon('play') + 'Run now</button><button class="icon small" title="Schedule it in the Daily Queue" data-qsched="' + esc(qt) + '" data-name="' + esc(q.title) + '" data-kind="sequence">' + icon('calendar') + '</button><button class="icon small" title="View history" data-qhist="' + esc(qt) + '" data-name="' + esc(q.title) + '">' + icon('clock') + '</button><button class="icon small" title="Edit in the Sandbox" data-sbopen="' + esc(q.id) + '">' + icon('edit') + '</button><button class="icon small" title="Take it out of Tasks (the sequence stays in the Sandbox)" data-unseq="' + esc(q.id) + '">' + icon('close') + '</button>');
}
function renderTasks() {
  const seqs = (S.seqTasks || []).filter(q => taskFilter === 'all' || (taskFilter === 'scheduled' && q.schedules.some(x => x.enabled)));
  const list = S.tasks.filter(t => taskFilter === 'all' || (taskFilter === 'needs' ? ['NEEDS_REVIEW', 'NEEDS_ATTENTION', 'BLOCKED'].includes(t.state) : taskFilter === 'scheduled' ? ['SCHEDULED', 'READY', 'RUNNING', 'PAUSED'].includes(t.state) : /VERIFIED|RECEIVED|CANCELLED|FAILED|EXPIRED|PENDING/.test(t.state)));
  const box = $('tasklist');
  if (!list.length && !seqs.length) { htmlOnce(box, '<div class="panel empty" data-empty><img src="dragon.png" alt=""><span>' + (S.tasks.length ? 'Nothing here with this filter.' : 'No tasks yet. Falcor is waiting for its first job.') + '</span><button class="primary" id="emptynew">' + icon('plus') + 'New task</button></div>'); const b = $('emptynew'); if (b) b.onclick = openDrawer; return; }
  if (box.querySelector('[data-empty]')) box.innerHTML = '';
  keyed(box, [...list, ...seqs.map(q => ({...q, seq: true}))], t => t.seq ? 'seq:' + t.id : t.id, t => P.el(t.seq ? '<div class="panel task seqtask"><div class="appicon">' + icon('sandbox') + '</div><div class="main"></div><div class="acts"></div></div>' : '<div class="panel task"><div class="appicon">' + icon(TYPEICON[t.type] || 'tasks') + '</div><div class="main"></div><div class="acts"></div><div class="gatebox"></div></div>'), (node, t) => {
    if (t.seq) { drawSeqTask(node, t); return; }
    const why = t.needs ? 'Needs you: ' + t.needs.reason : t.lastError ? t.lastError : t.history.length ? t.history[t.history.length - 1].reason : '';
    htmlOnce(node.querySelector('.main'), '<div class="obj"><b>' + esc(t.app) + '</b></div><div class="obj">' + esc(t.objective) + '</div><div class="meta"><span>' + icon(TYPEICON[t.type] || 'tasks') + ' ' + esc(TYPE[t.type] || t.type) + '</span>' + (t.targetLevel ? '<span>level ' + esc(t.level ?? 0) + ' of ' + esc(t.targetLevel) + '</span>' : '') + (t.nextAt && t.state === 'SCHEDULED' ? '<span>next ' + when(t.nextAt) + '</span>' : '') + '<span class="pill ' + (trackOf(t.state).mood === 'needs' ? 'sand' : trackOf(t.state).mood === 'bad' ? 'red' : 'green') + '">' + esc(t.stateLabel) + '</span></div>' + schedHtml(t.schedules) + trackHtml(t.state) + customHtml(t.custom) + (why ? '<div class="why ' + (t.needs || t.lastError ? 'sand' : 'muted') + '">' + esc(why) + '</div>' : ''));
    const acts = [], qt = 'mission:' + t.id;
    if (t.state !== 'NEEDS_REVIEW') {
      if (!['RUNNING', 'BLOCKED', 'CANCELLED', 'EXPIRED', 'FAILED', 'RECEIVED', 'INVALIDATED'].includes(t.state)) acts.push('<button class="primary small" data-qrun="' + esc(qt) + '" data-name="' + esc(t.objective) + '">' + icon('play') + 'Run now</button>');
      if (['SCHEDULED', 'RUNNING', 'READY', 'NEEDS_ATTENTION'].includes(t.state)) acts.push('<button class="small" data-task="' + esc(t.id) + '" data-act="pause">' + icon('pause') + 'Pause</button>');
      if (t.state === 'PAUSED') acts.push('<button class="small" data-task="' + esc(t.id) + '" data-act="resume">' + icon('play') + 'Resume</button>');
    }
    if (!['BLOCKED', 'CANCELLED', 'EXPIRED', 'FAILED', 'RECEIVED', 'INVALIDATED'].includes(t.state)) acts.push('<button class="icon small" title="Schedule it in the Daily Queue" data-qsched="' + esc(qt) + '" data-name="' + esc(t.objective) + '" data-kind="' + (t.type === 'game_level' ? 'game' : 'task') + '" data-pkg="' + esc(t.appPackage) + '">' + icon('calendar') + '</button>');
    acts.push('<button class="icon small" title="View history" data-qhist="' + esc(qt) + '" data-name="' + esc(t.objective) + '">' + icon('clock') + '</button>');
    if ((S.knowledge || []).some(k => k.pkg === t.appPackage)) acts.push('<button class="icon small" title="What Falcor learned about ' + esc(t.app || appName(t.appPackage)) + '" data-link="knowledge" data-ref="' + esc(t.appPackage) + '">' + icon('book') + '</button>');
    if (['DRAFT', 'NEEDS_REVIEW', 'READY', 'SCHEDULED', 'PAUSED', 'NEEDS_ATTENTION'].includes(t.state)) acts.push('<button class="icon small" title="Edit" data-edit="' + esc(t.id) + '">' + icon('edit') + '</button>');
    if (t.state !== 'RUNNING') acts.push('<button class="icon danger small" title="Remove" data-task="' + esc(t.id) + '" data-act="remove">' + icon('trash') + '</button>');
    htmlOnce(node.querySelector('.acts'), acts.join(''));
    // The approval gate: Approve stays off until the required ticks are done.
    const gate = node.querySelector('.gatebox');
    if (t.state === 'NEEDS_REVIEW') { if (!gate.firstChild) { gate.className = 'gatebox gate'; gate.innerHTML = gateHtml(t); wireGate(gate, t); } }
    else if (gate.firstChild) { gate.className = 'gatebox'; gate.innerHTML = ''; }
  });
}
const gateHtml = t => '<p class="eyebrow">// APPROVAL GATE</p>' + (t.signup ? '<label class="check"><input type="checkbox" data-tick="zero"> The offer is $0 upfront: no card, deposit or paid trial</label><label class="check"><input type="checkbox" data-tick="consent"> Create one account with my details and accept its terms for me</label>' : '') + '<div class="row"><button class="primary" data-approve="' + esc(t.id) + '" disabled>' + icon('check') + 'Approve</button><button data-task="' + esc(t.id) + '" data-act="cancel">Reject</button><span class="missing"></span></div>';
function wireGate(gate, t) {
  const upd = () => { const q = k => gate.querySelector('[data-tick="' + k + '"]'); const miss = [t.signup && !q('zero').checked && 'the $0 tick'].filter(Boolean); gate.querySelector('[data-approve]').disabled = miss.length > 0; text(gate.querySelector('.missing'), miss.length ? 'Missing: ' + miss.join(' and ') + '.' : ''); };
  gate.addEventListener('change', upd); upd();
}
document.addEventListener('click', async e => {
  const g = e.target.closest('#tasklist [data-link]'); if (g) { followLink(g.dataset.link, g.dataset.ref); return; }
  const t = e.target.closest('[data-task]');
  if (t) { await call('taskAction', {id: t.dataset.task, action: t.dataset.act}); return; }
  const a = e.target.closest('[data-approve]');
  if (a) {
    const gate = a.closest('.gate'), q = k => gate.querySelector('[data-tick="' + k + '"]');
    await call('approveTask', {id: a.dataset.approve, zeroCostConfirmed: !!(q('zero') && q('zero').checked), approvals: q('consent') && q('consent').checked ? ['account_creation', 'terms_acceptance'] : []});
    toast('Approved. Falcor runs it when it is due and Autopilot is on, or press Run now.');
  }
  const ed = e.target.closest('[data-edit]'); if (ed) { await openEditor(ed.closest('.task'), ed.dataset.edit); return; }
  const u = e.target.closest('[data-unpair]'); if (u) await call('unpairPhone', {id: u.dataset.unpair});
  const s = e.target.closest('[data-unsecret]'); if (s) await call('removeSecret', {name: s.dataset.unsecret});
  const so = e.target.closest('[data-sbopen]'); if (so) { go('sandbox'); if (window.sbOpen) await sbOpen(so.dataset.sbopen); }
  const us = e.target.closest('[data-unseq]'); if (us) { await call('queue', {op: 'saveAsTask', id: us.dataset.unseq, on: false}); toast('Taken out of Tasks. The sequence stays in the Sandbox.'); }
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
// It opens on a new chat with Falcor's greeting; the chat is kept only once something is sent (the first message makes
// it, with the focus chosen before). Notices are in the bell, never here.
const chat = {id: null, rev: 0, msgs: new Map(), focus: null, poll: null, ctx: true, greeted: null, threads: [], q: ''};
const QUICK = ['What\'s running?', 'What needs me?', 'What did you learn today?', 'How does the Daily Queue work?', 'Create a daily check-in task'];
function chatReset() { chat.rev = 0; chat.shown = 0; chat.msgs.clear(); $('msglist').innerHTML = ''; delete $('msglist').dataset.ready; }
// A new chat, not kept until the first message. focus: an app to talk about (from a game's or a guide's page).
function chatFresh(focus = null) {
  chat.id = null; chat.greeted = null; chat.focus = focus || null; chatReset();
  renderFocus(focus ? appName(focus) : null); renderMsgs(); void loadThreads();
}
async function openChat(id) {
  if (id && id !== chat.id) { chat.id = id; chat.greeted = null; chatReset(); }
  await loadThreads();
  if (chat.id && !chat.threads.some(t => t.id === chat.id)) chat.id = null;
  if (!chat.id) { renderMsgs(); renderFocus(chat.focus ? appName(chat.focus) : null); }
  await pullChat(true);
  clearInterval(chat.poll); chat.poll = setInterval(() => { if (tab === 'falcor') void pullChat(true); }, 1000);
}
async function loadThreads() { chat.threads = await window.hub.call('chatThreads').catch(() => chat.threads); renderThreads(); }
async function pullChat(seen) {
  if (!chat.id) { text($('chattitle'), 'New chat'); return; }
  let r; try { r = await window.hub.call('chatRead', {id: chat.id, after: chat.rev, seen}); } catch { chat.id = null; renderMsgs(); return; }
  chat.rev = Math.max(chat.rev, r.rev);
  for (const m of r.messages) chat.msgs.set(m.id, m);
  text($('chattitle'), r.title || 'Falcor');
  chat.focus = r.focus; renderFocus(r.focus ? r.focusName || r.focus : null);
  renderMsgs();
}
function renderFocus(name) { $('focuschip').hidden = !name; text($('focusname'), 'Talking about: ' + (name || '')); }
// The list of chats: pinned first, then by day (today, yesterday, this week, earlier); search by title and last words.
const dayOf = at => { const d = new Date(at), t = new Date(); t.setHours(0, 0, 0, 0); const n = Math.floor((t - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86_400_000); return n <= 0 ? 'TODAY' : n === 1 ? 'YESTERDAY' : n < 7 ? 'THIS WEEK' : 'EARLIER'; };
const shortAgo = at => { const m = Math.round((Date.now() - at) / 60000); return m < 1 ? 'now' : m < 60 ? m + 'm' : m < 24 * 60 ? Math.round(m / 60) + 'h' : new Date(at).toLocaleDateString([], {month: 'short', day: 'numeric'}); };
function renderThreads() {
  const q = chat.q.trim().toLowerCase(), rows = [], seen = new Set();
  const list = chat.threads.filter(t => !q || (t.title + ' ' + (t.preview || '')).toLowerCase().includes(q));
  for (const t of list) { const g = t.pinned ? 'PINNED' : dayOf(t.updatedAt); if (!seen.has(g)) { seen.add(g); rows.push({group: g}); } rows.push(t); }
  if (!rows.length) { htmlOnce($('threadlist'), '<li class="tnone">' + (q ? 'No chat matches “' + esc(chat.q.trim()) + '”.' : 'Your chats with Falcor are kept here.') + '</li>'); return; }
  if ($('threadlist').querySelector('.tnone')) $('threadlist').innerHTML = '';
  keyed($('threadlist'), rows, r => r.group ? 'g:' + r.group : r.id, r => r.group ? P.el('<li class="tgroup"></li>') : P.el('<li class="th"><span class="t"></span><time></time><span class="p"></span><span class="tacts"><button class="ghost icon small" data-pin title="Pin">' + icon('pin') + '</button><button class="ghost icon small" data-ren title="Rename">' + icon('edit') + '</button><button class="ghost icon small" data-del title="Delete">' + icon('trash') + '</button></span></li>'), (li, r) => {
    if (r.group) { text(li, r.group); return; }
    cls(li, 'on', r.id === chat.id); cls(li, 'pinned', r.pinned); text(li.querySelector('.t'), r.title); text(li.querySelector('time'), shortAgo(r.updatedAt)); text(li.querySelector('.p'), r.preview || '');
    li.querySelector('[data-pin]').title = r.pinned ? 'Unpin' : 'Pin';
  });
}
$('threadsearch').oninput = () => { chat.q = $('threadsearch').value; renderThreads(); };
$('threadlist').onclick = async e => {
  const li = e.target.closest('li.th'); if (!li) return; const id = li.dataset.key;
  if (e.target.closest('[data-pin]')) { const t = chat.threads.find(x => x.id === id); await call('chatPin', {id, pinned: !(t && t.pinned)}); return loadThreads(); }
  if (e.target.closest('[data-del]')) { if (confirm('Delete this chat?')) { await call('chatDelete', {id}); if (chat.id === id) chatFresh(); else await loadThreads(); } return; }
  if (e.target.closest('[data-ren]')) { const t = li.querySelector('.t'); t.contentEditable = 'true'; t.focus(); document.getSelection().selectAllChildren(t); t.onkeydown = async ev => { if (ev.key === 'Enter') { ev.preventDefault(); t.contentEditable = 'false'; await call('chatRename', {id, title: t.textContent}); loadThreads(); } if (ev.key === 'Escape') { t.contentEditable = 'false'; loadThreads(); } }; t.onblur = () => { if (t.contentEditable === 'true') { t.contentEditable = 'false'; loadThreads(); } }; return; }
  void openChat(id);
};
$('newchat').onclick = () => { chatFresh(); $('chattext').focus(); };
$('ctxtoggle').onclick = () => { chat.ctx = !chat.ctx; cls($('chatgrid'), 'noctx', !chat.ctx); };
function renderMsgs() {
  const box = $('msgs'), lbox = $('msglist'), stick = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
  const list = [...chat.msgs.values()].filter(m => m.role !== 'note').sort((a, b) => a.seq - b.seq);
  // Falcor's greeting: on a new chat, and above the one it became.
  const greet = !chat.id || chat.greeted === chat.id;
  if (greet !== !!$('chatintro').firstChild) { $('chatintro').innerHTML = greet ? P.introHtml() : ''; }
  keyed(lbox, list, m => m.id, m => P.el('<div class="msg ' + m.role + '">' + (m.role === 'user' ? '' : P.avatarHtml('xs')) + '<div class="body"></div></div>'), (node, m) => { if (node.dataset.rev !== String(m.rev)) { node.dataset.rev = String(m.rev); drawMsg(node, m); } });
  lbox.dataset.ready = '1';
  $('quick').hidden = list.length > 0;
  if (!$('quick').firstChild) $('quick').innerHTML = QUICK.map(q => '<button type="button" data-q="' + esc(q) + '">' + esc(q) + '</button>').join('');
  // Follow the conversation: a new message (or a longer answer) keeps it scrolled to the end, unless the owner scrolled up.
  const grew = list.length > (chat.shown || 0); chat.shown = list.length;
  cls(box, 'hasmsgs', list.length > 0);
  if (list.length && (stick || grew)) box.scrollTop = box.scrollHeight; else if (!list.length) box.scrollTop = 0;
  cls($('threadlist'), 'fresh', !chat.id);
  renderThreads();
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
  if (c.kind === 'approve') { const d = c.data || {}; return '<div class="card approve gate" data-card="' + c.id + '"><p class="eyebrow">// APPROVAL GATE</p><div class="ct">' + esc(c.title) + '</div>' + lines + (open ? '' + (d.signup ? '<label class="check"><input type="checkbox" data-tick="zero"> The offer is $0 upfront: no card, deposit or paid trial</label><label class="check"><input type="checkbox" data-tick="consent"> Create one account with my details and accept its terms for me</label>' : '') + '<div class="acts"><button class="primary small" data-cact="confirm" data-card="' + c.id + '">' + icon('check') + 'Approve</button><button class="small" data-cact="cancel" data-card="' + c.id + '">Not now</button></div>' : '') + done + err + '</div>'; }
  return '<div class="card confirm" data-card="' + c.id + '"><div class="ct">' + icon('edit') + esc(c.title) + '</div>' + lines + (open ? '<div class="acts"><button class="primary small" data-cact="confirm" data-card="' + c.id + '">Confirm</button><button class="small" data-cact="cancel" data-card="' + c.id + '">Cancel</button></div>' : c.state === 'working' ? '<span class="done"><span class="spin4"><i></i><i></i><i></i><i></i></span> Working…</span>' : '') + done + err + '</div>';
}
$('msgs').addEventListener('click', async e => {
  const b = e.target.closest('[data-cact]');
  if (b) {
    const card = b.closest('.card') || b, q = k => card.querySelector('[data-tick="' + k + '"]');
    b.classList.add('busy');
    try { const c = await window.hub.call('chatAct', {card: b.dataset.card, action: b.dataset.cact, ticks: {zeroCost: !!(q('zero') && q('zero').checked), consent: !!(q('consent') && q('consent').checked)}}); if (c.state === 'confirmed' && b.dataset.cact === 'confirm') P.burst(card); if (c.error) toast(c.error, 'warn'); }
    catch (err) { toast(errText(err), 'bad'); }
    await pullChat(true); return;
  }
  const l = e.target.closest('[data-link]'); if (l) followLink(l.dataset.link, l.dataset.ref);
});
function followLink(t, ref) {
  if (t === 'knowledge') return openGuide(ref || null);
  if (t === 'settings') return go('settings', ['updates', 'knowledge'].includes(ref) ? ref : undefined);
  go(t);
  if (t === 'tasks' && window.crShow) crShow(ref);
  if (t === 'tasks' && ref) setTimeout(() => { const n = document.querySelector('.task[data-key="' + ref + '"]'); if (n) { n.scrollIntoView({block: 'center'}); n.classList.remove('flash'); void n.offsetWidth; n.classList.add('flash'); } }, 80);
}
$('quick').onclick = e => { const b = e.target.closest('[data-q]'); if (b) { $('chattext').value = b.dataset.q; void sendChat(); } };
$('composer').onsubmit = e => { e.preventDefault(); void sendChat(); };
$('chattext').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendChat(); } if (e.key === '@' ) setTimeout(openAt, 0); });
async function sendChat() {
  const t = $('chattext').value.trim(); if (!t) return;
  $('chattext').value = '';
  const fresh = !chat.id, r = await call('chatSend', {id: chat.id, text: t, focus: chat.focus}).catch(() => null);
  if (r && r.threadId !== chat.id) { chat.id = r.threadId; chatReset(); if (fresh) chat.greeted = r.threadId; }
  await pullChat(true); void loadThreads();
}
// The app Falcor talks about: kept on the chat, or held until a new chat's first message.
function setFocus(pkg) { if (!chat.id) { chat.focus = pkg || null; renderFocus(pkg ? appName(pkg) : null); return; } void call('chatFocus', {id: chat.id, pkg}).then(() => pullChat(true)); }
$('focusclear').onclick = () => setFocus(null);
$('atbtn').onclick = () => openAt();
function openAt() {
  const d = dev(), known = S.knowledge.map(k => ({pkg: k.pkg, name: k.name, note: k.sessions + ' session(s)'})), more = (d ? d.installed : []).filter(p => !known.some(k => k.pkg === p)).map(p => ({pkg: p, name: appName(p), note: 'on the phone'}));
  $('atmenu').innerHTML = [...known, ...more].slice(0, 40).map(a => '<li data-focus="' + esc(a.pkg) + '">' + esc(a.name) + '<small>' + esc(a.note) + '</small></li>').join('') || '<li class="muted">Nothing learned yet.</li>';
  $('atmenu').hidden = false;
}
$('atmenu').onclick = e => { const li = e.target.closest('[data-focus]'); if (li) { setFocus(li.dataset.focus); const v = $('chattext').value; $('chattext').value = v.replace(/@$/, ''); } $('atmenu').hidden = true; $('chattext').focus(); };
document.addEventListener('click', e => { if (!e.target.closest('.focusrow')) $('atmenu').hidden = true; });
function renderChatMeta() { void loadThreads(); }
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
// Settings → Knowledge: every app Falcor learned; a card opens its guide.
function renderKnowledgeList() {
  const list = S.knowledge || [];
  $('learnnone').hidden = list.length > 0;
  keyed($('apps'), list, k => k.pkg, () => P.el('<button class="panel appcard"><span class="ai">' + icon('book') + '</span><div><b></b><div class="m"></div></div><div class="klevel"></div></button>'), (n, k) => {
    text(n.querySelector('b'), k.name);
    const game = (S.games || []).some(g => g.pkg === k.pkg);
    text(n.querySelector('.m'), k.sessions + ' session' + (k.sessions === 1 ? '' : 's') + ' · last ' + new Date(k.lastSessionAt).toLocaleDateString() + (k.hasGuide ? '' : ' · no guide yet') + (game ? ' · in Games' : ''));
    const lvl = Math.min(10, k.sessions * 2 + (k.hasGuide ? 3 : 0) + (k.by && k.by !== 'local' ? 2 : 0));
    htmlOnce(n.querySelector('.klevel'), Array.from({length: 10}, (_, i) => '<i class="' + (i < lvl ? 'on' : '') + '"></i>').join(''));
    n.title = 'Open the guide · knowledge level ' + lvl + ' of 10';
  });
}
$('apps').onclick = e => { const c = e.target.closest('.appcard'); if (c) openGuide(c.dataset.key, {tab: 'settings', sub: 'knowledge', pkg: null}); };
// An app's guide, opened from where the owner was (its game, a task, the chat or Settings).
function openGuide(pkg, from) {
  if (!pkg) { go('settings', 'knowledge'); return; }
  if (tab !== 'knowledge') learnFrom = from || {tab: tab === 'games' ? 'games' : tab, sub: tab === 'settings' ? sub : null, pkg: tab === 'games' ? gamePkg : null};
  if (pkg !== learnPkg) { learnPkg = pkg; learnSig = ''; editing = false; }
  go('knowledge');
}
$('learnback').onclick = () => { const f = learnFrom; if (f.tab === 'games') gamePkg = f.pkg; go(f.tab || 'settings', f.sub || undefined); };
function renderLearn() {
  const list = S.knowledge;
  if (learnPkg && !list.some(k => k.pkg === learnPkg)) learnPkg = null;
  if (!learnPkg) { go(learnFrom.tab === 'games' ? 'games' : 'settings', learnFrom.tab === 'games' ? undefined : 'knowledge'); return; }
  const f = learnFrom, game = f.tab === 'games' && (S.games || []).find(g => g.pkg === f.pkg);
  text($('learnbackname'), game ? 'Back to ' + game.name : f.tab === 'tasks' ? 'Back to Tasks' : f.tab === 'falcor' ? 'Back to Falcor' : f.tab === 'phone' ? 'Back to Phone' : f.tab === 'sandbox' ? 'Back to Sandbox' : 'Back to Knowledge');
  $('learnempty').hidden = true;
  const sig = JSON.stringify(list.find(k => k.pkg === learnPkg) || null);
  if (sig !== learnSig && !editing) { learnSig = sig; void loadApp(); }
}
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
$('guidedelete').onclick = async () => { if (confirm('Delete everything Falcor learned about ' + L.name + '? Sessions, pictures and the guide are removed from this computer.')) { await call('deleteApp', {pkg: learnPkg}); learnPkg = null; learnSig = ''; toast('Deleted.'); $('learnback').click(); } };
$('guidechat').onclick = () => { chatFresh(learnPkg); go('falcor'); $('chattext').focus(); };
$('sessions').addEventListener('click', e => { const w = e.target.closest('[data-write]'); if (w) void showAfter(learnPkg, w.dataset.write, L.name, Number(w.dataset.screens)); });

// ------------------------------------------------------------------ stats
// Activity (the old Stats tab, `stats`) is drawn by creations.js#renderActivity.

// ------------------------------------------------------------------ settings
let sub = 'ai';
function setSub(name) { sub = name; document.querySelectorAll('#submenu button').forEach(b => cls(b, 'on', b.dataset.sub === sub)); document.querySelectorAll('.settingsgrid .panel[data-sub]').forEach(p => { p.hidden = p.dataset.sub !== sub; }); }
document.querySelectorAll('#submenu button').forEach(b => b.onclick = () => setSub(b.dataset.sub));
let prevPhones = null;
function renderSettings() {
  if (window.renderAi) window.renderAi();
  if (document.activeElement !== $('limit')) $('limit').value = S.limit ?? '';
  const spent = S.spend.teach + S.spend.chat + S.spend.autopilot;
  meter($('limitmeter'), S.limit ? spent / S.limit : 0, ''); $('limitmeter').title = money(spent) + (S.limit !== null ? ' of ' + money(S.limit) : ' this month, no limit');
  // Paired phones; a new pairing wipes the QR and builds a green check.
  if (prevPhones !== null && S.remote.phones.length > prevPhones && !$('pairbox').hidden) { $('qrframe').classList.add('wiped'); setTimeout(() => { $('qrdone').hidden = false; P.burst($('qrframe')); }, 380); clearInterval(pairTimer); text($('pairexp'), 'Paired.'); }
  prevPhones = S.remote.phones.length;
  keyed($('remotes'), S.remote.phones, p => p.id, () => P.el('<li><span class="led"></span><span class="grow"></span><button class="danger small">Unpair</button></li>'), (li, p) => { li.firstElementChild.className = 'led ' + (Date.now() - p.lastSeenAt < 60_000 ? 'on' : ''); htmlOnce(li.children[1], esc(p.name) + ' <span class="muted small">· last seen ' + (p.lastSeenAt ? time(p.lastSeenAt) : '—') + '</span>'); li.lastElementChild.dataset.unpair = p.id; });
  htmlOnce($('secrets'), S.secretNames.map(n => '<li>' + icon('lock') + '<code>vault:' + esc(n) + '</code><span class="grow"></span><button class="small danger" data-unsecret="' + esc(n) + '">Remove</button></li>').join('') || '<li class="muted small">No secrets saved.</li>');
  const u = S.update;
  text($('aboutver'), 'Falcor.Hub ' + S.version);
  $('updstate').firstElementChild.className = 'led ' + (!u || u.state === 'idle' ? 'on' : u.state === 'ready' || u.state === 'downloading' || u.state === 'checking' ? 'warn' : u.state === 'error' ? 'bad' : '');
  text($('updstate').lastElementChild, !u ? '' : u.state === 'dev' ? 'Checked in the installed app' : u.state === 'checking' ? 'Checking…' : u.state === 'downloading' ? 'Downloading ' + u.version : u.state === 'ready' ? u.version + ' ready: restart' : u.state === 'installer' ? u.version + ' needs a new installer' : u.state === 'error' ? 'Error: ' + u.error : 'Up to date');
  htmlOnce($('history'), '<div class="history">' + ((S.notesHistory || []).map(h => '<div><b>' + esc(h.version) + '</b><p class="muted small">' + esc(h.notes || 'Improvements and fixes.') + '</p></div>').join('') || '<p class="muted small">Notes from each update show here.</p>') + '</div>');
  text($('about'), 'Version ' + S.version + (S.simulated ? ' · simulated phone' : '') + ' · adb ' + (S.adb ? 'ready' : 'missing') + ' · scrcpy ' + (S.scrcpy ? 'ready' : 'missing'));
}
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
$('secretform').onsubmit = async e => { e.preventDefault(); const f = e.target; await call('setSecret', {name: f.name.value, value: f.value.value}); f.reset(); toast('Secret sealed on this computer.'); };
$('updcheck').onclick = () => call('updateCheck').then(() => toast('Checked for updates.'));


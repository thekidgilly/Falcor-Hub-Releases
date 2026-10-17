// Falcor.Hub's window. Everything goes through window.hub.call(name, args); the page has no Node and no network.
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const time = at => new Date(at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
const when = at => { if (!at) return ''; const m = Math.round((at - Date.now()) / 60000); return m <= 0 ? 'now' : m < 60 ? 'in ' + m + ' min' : m < 36 * 60 ? 'in ' + Math.round(m / 60) + ' h' : new Date(at).toLocaleDateString(); };
let S = null, tab = 'phone', deviceId = null, controlling = false;

async function call(name, args) {
  try { return await window.hub.call(name, args); }
  catch (e) { flash(String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), true); throw e; }
}
let flashTimer = null;
function flash(text, bad) { const b = $('banner'); b.textContent = text; b.className = 'banner' + (bad ? '' : ' ok'); b.hidden = false; clearTimeout(flashTimer); flashTimer = setTimeout(() => { b.hidden = true; }, bad ? 7000 : 3500); }

// ------------------------------------------------------------------ tabs
document.querySelectorAll('nav button').forEach(b => b.onclick = () => {
  tab = b.dataset.tab;
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== tab; });
  render();
});

// ------------------------------------------------------------------ status
window.hub.onStatus(s => { if (s) { S = s; render(); } });
call('status').then(s => { S = s; render(); }).catch(() => {});
setInterval(() => call('status').then(s => { if (s) { S = s; render(); } }).catch(() => {}), 5000);

const dev = () => S && S.devices.find(d => d.id === deviceId) || S && S.devices[0] || null;
function render() {
  if (!S) return;
  const d = dev(); deviceId = d ? d.id : null;
  const human = !!(d && d.control && d.control.kind === 'human');
  if (controlling !== human) { controlling = human; $('mirrorbox').classList.toggle('control', human); }
  const em = S.devices.some(x => x.emergency);
  $('stop').textContent = em ? 'CLEAR EMERGENCY STOP' : 'EMERGENCY STOP';
  $('stop').classList.toggle('cleared', em);
  $('pills').innerHTML = [
    d ? (d.connected && d.authorized ? '<span class="pill green">Phone · ' + esc(d.label) + '</span>' : '<span class="pill sand">Phone · ' + (d.connected ? 'allow USB debugging' : 'not connected') + '</span>') : '<span class="pill red">No phone</span>',
    d ? (d.autopilot ? '<span class="pill green">Autopilot on</span>' : '<span class="pill muted">Autopilot off</span>') : '',
    S.kimi.configured ? '<span class="pill green">Kimi</span>' : '<span class="pill sand">Kimi not set</span>',
    S.remote.phones.length ? '<span class="pill blue">Remote · ' + S.remote.phones.length + '</span>' : '',
    S.simulated ? '<span class="pill sand">Simulated phone</span>' : '',
  ].join('');
  renderUpdate();
  if (tab === 'phone') renderPhone(d);
  if (tab === 'tasks') renderTasks();
  if (tab === 'stats') renderStats();
  if (tab === 'settings') renderSettings();
}

// ------------------------------------------------------------------ updates
function renderUpdate() {
  const u = S.update, running = S.devices.some(x => x.running);
  $('update').hidden = !(u && u.state === 'ready');
  if (u && u.state === 'ready') { $('updatetext').textContent = 'Falcor.Hub ' + u.version + ' is ready.' + (running ? ' It installs when no task is running.' : ' Restart takes a few seconds; your tasks and settings are kept.'); $('updatebtn').disabled = running; }
  const w = S.whatsNew;
  $('whatsnew').hidden = !w;
  if (w) { $('wnversion').textContent = w.version; $('wnnotes').textContent = w.notes || 'Improvements and fixes.'; }
  const st = !u ? '' : u.state === 'dev' ? 'Updates are checked in the installed app.' : u.state === 'checking' ? 'Checking for updates…' : u.state === 'downloading' ? 'Downloading ' + u.version + (u.percent !== null ? ' (' + u.percent + '%)' : '') + '…' : u.state === 'ready' ? u.version + ' is ready: restart to install it.' : u.state === 'installer' ? u.version + ' needs a new installer: download it from github.com/thekidgilly/Falcor-Hub-Releases.' : u.state === 'error' ? 'Could not check for updates: ' + u.error : 'Up to date.';
  $('updstate').textContent = st;
}
$('updatebtn').onclick = () => call('updateRestart');
$('wnclose').onclick = () => call('dismissWhatsNew');
$('updcheck').onclick = () => call('updateCheck').then(() => flash('Checked for updates.'));

// ------------------------------------------------------------------ phone
function renderPhone(d) {
  const ready = !!(d && d.connected && d.authorized && !d.locked);
  const steps = [
    ['Connect the phone with a USB-C cable that carries data', !!(d && d.connected), 'Many cables only charge. Try another cable or port.'],
    ['Turn on USB debugging and tap Allow on the phone', !!(d && d.authorized), 'See "Settings for total control" below.'],
    ['Unlock the phone', !!(d && d.authorized && !d.locked), 'Falcor never unlocks it for you.'],
  ];
  const first = steps.findIndex(s => !s[1]);
  $('checks').innerHTML = steps.map(([t, ok, hint], i) => '<li class="' + (ok ? 'done' : i === first ? 'now' : '') + '">' + (ok ? '✓ ' : (i + 1) + '. ') + esc(t) + (i === first ? '<br><span class="muted small">' + esc(hint) + '</span>' : '') + '</li>').join('') + (!S.adb ? '<li class="now red">Android platform tools are missing from this install. Reinstall Falcor.Hub.</li>' : '');
  $('setup').hidden = ready; $('phonegrid').hidden = !ready;
  if (!ready) return;
  $('devpick').hidden = S.devices.length < 2;
  if (S.devices.length > 1) $('devpick').innerHTML = S.devices.map(x => '<option value="' + esc(x.id) + '"' + (x.id === d.id ? ' selected' : '') + '>' + esc(x.label) + '</option>').join('');
  $('devname').textContent = d.label;
  const st = d.emergency ? ['red', 'Emergency Stop'] : d.control && d.control.kind === 'human' ? ['sand', 'You have control'] : d.running ? ['blue', 'Running a task'] : d.autopilot ? ['green', 'Autopilot on'] : ['muted', 'Ready'];
  $('devstate').className = 'pill ' + st[0]; $('devstate').textContent = st[1];
  $('devinfo').innerHTML = '<dt>Model</dt><dd>' + esc(d.model || '—') + '</dd><dt>Android</dt><dd>' + esc(d.androidVersion || '—') + '</dd><dt>App in front</dt><dd>' + esc(d.foreground || '—') + '</dd><dt>Control</dt><dd>' + (d.control ? (d.control.kind === 'human' ? 'You' : 'Falcor') : 'Nobody') + '</dd>';
  $('autopilot').textContent = d.autopilot ? 'Stop Autopilot' : 'Start Autopilot';
  $('autopilot').className = d.autopilot ? 'danger' : 'primary';
  $('autopilot').disabled = !!d.emergency;
  $('take').hidden = controlling; $('release').hidden = !controlling;
  $('viewer').disabled = S.simulated || !S.scrcpy;
  const run = S.tasks.find(t => t.state === 'RUNNING' && t.deviceId === d.id);
  $('running').innerHTML = run ? '<b>' + esc(run.app) + '</b> · ' + esc(run.objective) + (run.targetLevel ? '<br><span class="muted small">Level ' + esc(run.level ?? '?') + ' of ' + esc(run.targetLevel) + '</span>' : '') + '<div class="row" style="margin-top:8px"><button data-task="' + esc(run.id) + '" data-act="pause">Pause</button></div>' : 'Nothing is running.' + (d.autopilot ? ' Autopilot starts approved tasks when they are due.' : '');
  $('log').innerHTML = S.activity.slice().reverse().map(l => '<li><time>' + time(l.at) + '</time>' + esc(l.line) + '</li>').join('');
}
$('devpick').onchange = e => { deviceId = e.target.value; render(); };
$('autopilot').onclick = async () => { const d = dev(); if (d) { await call('autopilot', {deviceId: d.id, on: !d.autopilot}); } };
$('take').onclick = async () => { await call('take', {deviceId}); flash('You have control. Click to tap, drag to swipe, scroll with the wheel, type in the box below.'); $('mirrorbox').focus(); };
$('release').onclick = () => call('release', {deviceId});
$('viewer').onclick = () => call('viewer', {deviceId}).then(() => flash('scrcpy window open. You have control while it is open.'));
document.querySelectorAll('[data-key]').forEach(b => b.onclick = () => send({kind: 'key', key: b.dataset.key}));
$('typeform').onsubmit = async e => { e.preventDefault(); const t = $('typetext').value; if (!t) return; await send({kind: 'type', text: t}); $('typetext').value = ''; };
$('stop').onclick = async () => { const em = S && S.devices.some(x => x.emergency); await call(em ? 'clear' : 'stopAll'); flash(em ? 'Emergency Stop cleared. Turn Autopilot on again when you are ready.' : 'Emergency Stop: every phone stopped, Autopilot off.', !em); };

async function send(action) {
  if (!controlling) { flash('Take Control first.', true); return; }
  await call('input', {deviceId, action}).catch(() => {});
  nextFrame(0);
}

// The live mirror: as fast as the phone sends pictures, only while the Phone tab is open.
let frameBusy = false, frameTimer = null, frames = 0, fpsAt = Date.now(), fps = null;
function nextFrame(delay) { clearTimeout(frameTimer); frameTimer = setTimeout(pullFrame, delay); }
async function pullFrame() {
  const d = dev();
  if (tab !== 'phone' || !d || !d.connected || !d.authorized || document.hidden) { nextFrame(800); return; }
  if (frameBusy) return;
  frameBusy = true;
  try {
    const f = await window.hub.call('frame', {deviceId: d.id});
    const img = $('mirror'); img.src = 'data:' + f.mime + ';base64,' + f.data; img.dataset.w = f.width; img.dataset.h = f.height;
    $('mirrorwait').hidden = true;
    frames++; if (Date.now() - fpsAt > 2000) { fps = frames / ((Date.now() - fpsAt) / 1000); frames = 0; fpsAt = Date.now(); }
    $('mirrorinfo').textContent = f.width + '×' + f.height + (fps === null ? '' : ' · ' + fps.toFixed(1) + ' pictures/s') + (f.paused ? ' · privacy pause: ' + f.paused : '') + (S.scrcpy && !S.simulated ? ' · for full speed use Full-speed window' : '');
  } catch (e) { $('mirrorinfo').textContent = String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); }
  frameBusy = false;
  nextFrame(controlling ? 60 : 250);
}
nextFrame(300);

// Mouse on the mirror: click = tap, hold = long press, drag = swipe, wheel = scroll. Positions are screen fractions.
const img = $('mirror');
const at = e => { const r = img.getBoundingClientRect(); return {x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)), px: e.clientX - r.left + img.offsetLeft, py: e.clientY - r.top + img.offsetTop}; };
let down = null;
img.addEventListener('pointerdown', e => { if (!controlling) { flash('Take Control first to touch the phone.', true); return; } down = {...at(e), t: Date.now()}; img.setPointerCapture(e.pointerId); });
img.addEventListener('pointerup', e => {
  if (!down) return; const up = at(e), ms = Date.now() - down.t, moved = Math.hypot(up.x - down.x, up.y - down.y);
  const mark = document.createElement('span'); mark.className = 'tapmark'; mark.style.left = down.px + 'px'; mark.style.top = down.py + 'px'; $('mirrorbox').appendChild(mark); setTimeout(() => mark.remove(), 600);
  const a = moved > 0.03 ? {kind: 'swipe', x: down.x, y: down.y, toX: up.x, toY: up.y, ms: Math.min(2000, Math.max(120, ms))} : ms > 600 ? {kind: 'long_press', x: down.x, y: down.y, ms: Math.min(3000, ms)} : {kind: 'tap', x: down.x, y: down.y};
  down = null; void send(a);
});
let wheelAt = 0;
$('mirrorbox').addEventListener('wheel', e => { if (!controlling) return; e.preventDefault(); if (Date.now() - wheelAt < 400) return; wheelAt = Date.now(); void send({kind: 'scroll', direction: e.deltaY > 0 ? 'down' : 'up'}); }, {passive: false});
$('mirrorbox').addEventListener('keydown', e => {
  if (!controlling) return;
  const k = {Enter: 'ENTER', Backspace: 'DEL', Tab: 'TAB', Escape: 'BACK'}[e.key];
  if (k) { e.preventDefault(); void send({kind: 'key', key: k}); }
  else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); void send({kind: 'type', text: e.key === ' ' ? ' ' : e.key}); }
});

// ------------------------------------------------------------------ tasks
const TYPE = {daily_checkin: 'Daily check-in', game_level: 'Game to a level', free_signup: 'Free signup', reward_monitor: 'Reward balance'};
function renderTasks() {
  const d = dev(), pick = $('apppick'), cur = pick.value;
  const apps = d ? d.installed : [];
  if (pick.dataset.n !== String(apps.length) + (d && d.id)) { pick.innerHTML = apps.length ? apps.map(p => '<option>' + esc(p) + '</option>').join('') : '<option value="">Plug in a phone to list its apps</option>'; pick.dataset.n = String(apps.length) + (d && d.id); if (apps.includes(cur)) pick.value = cur; }
  showTypeFields();
  // Redrawn only when a task changed, so ticked approval boxes are not cleared while you read.
  const sig = JSON.stringify(S.tasks.map(t => [t.id, t.state, t.updatedAt, t.level, t.nextAt]));
  if ($('tasklist').dataset.sig === sig) return;
  $('tasklist').dataset.sig = sig;
  $('tasklist').innerHTML = S.tasks.length ? S.tasks.map(t => {
    const color = {RUNNING: 'blue', NEEDS_ATTENTION: 'sand', NEEDS_REVIEW: 'sand', BLOCKED: 'red', FAILED: 'red', ACTION_VERIFIED: 'green', REWARD_VERIFIED: 'green', SCHEDULED: 'green', PAUSED: 'muted'}[t.state] || 'muted';
    const acts = [];
    if (t.state === 'NEEDS_REVIEW') acts.push('<div class="approve"><label><input type="checkbox" data-rules="' + esc(t.id) + '"> This app\'s own rules allow this automation</label>' + (t.signup ? '<label><input type="checkbox" data-zero="' + esc(t.id) + '"> The offer is $0 upfront: no card, deposit or paid trial</label><label><input type="checkbox" data-consent="' + esc(t.id) + '"> Create one account with my details and accept its terms for me</label>' : '') + '<div class="row"><button class="primary" data-approve="' + esc(t.id) + '">Approve</button><button data-task="' + esc(t.id) + '" data-act="cancel">Reject</button></div></div>');
    else {
      if (!['RUNNING', 'BLOCKED', 'CANCELLED', 'EXPIRED', 'FAILED', 'RECEIVED', 'INVALIDATED'].includes(t.state)) acts.push('<button class="primary" data-task="' + esc(t.id) + '" data-act="run">Run now</button>');
      if (['SCHEDULED', 'RUNNING', 'READY', 'NEEDS_ATTENTION'].includes(t.state)) acts.push('<button data-task="' + esc(t.id) + '" data-act="pause">Pause</button>');
      if (t.state === 'PAUSED') acts.push('<button data-task="' + esc(t.id) + '" data-act="resume">Resume</button>');
      if (t.state !== 'RUNNING') acts.push('<button class="danger" data-task="' + esc(t.id) + '" data-act="remove">Remove</button>');
    }
    const why = t.needs ? 'Needs you: ' + t.needs.reason : t.lastError ? t.lastError : t.history.length ? t.history[t.history.length - 1].reason : '';
    return '<div class="task"><div class="top"><span><b>' + esc(t.app) + '</b> · ' + esc(t.objective) + '</span><span class="pill ' + color + '">' + esc(t.stateLabel) + '</span></div>'
      + '<div class="muted small">' + esc(TYPE[t.type] || t.type) + (t.targetLevel ? ' · level ' + esc(t.level ?? 0) + ' of ' + esc(t.targetLevel) : '') + (t.nextAt && t.state === 'SCHEDULED' ? ' · next ' + when(t.nextAt) : '') + '</div>'
      + (why ? '<div class="why ' + (t.needs || t.lastError ? 'sand' : 'muted') + '">' + esc(why) + '</div>' : '') + '<div class="row">' + acts.join('') + '</div></div>';
  }).join('') : '<p class="muted">No tasks yet. Create one above.</p>';
}
function showTypeFields() { const type = $('taskform').type.value; document.querySelectorAll('[data-for]').forEach(el => { el.hidden = el.dataset.for !== type; }); }
$('taskform').type.onchange = showTypeFields;
$('refreshapps').onclick = () => deviceId && call('refreshApps', {deviceId}).then(() => flash('App list refreshed.'));
$('taskform').onsubmit = async e => {
  e.preventDefault(); const f = e.target, type = f.type.value;
  const fields = {}; for (const line of f.fields.value.split('\n')) { const i = line.indexOf('='); if (i > 0) fields[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  const input = {deviceId, type, appPackage: f.appPackage.value, appLabel: f.appLabel.value.trim() || f.appPackage.value.split('.').pop(), objective: f.objective.value,
    ...(type === 'game_level' ? {game: {targetLevel: Number(f.targetLevel.value)}} : {}),
    ...(type === 'free_signup' ? {signup: {fields}} : {}),
    ...(f.advertised.value !== '' ? {reward: {advertised: Number(f.advertised.value), unit: f.unit.value || 'points'}} : {}),
    ...(type === 'daily_checkin' || type === 'reward_monitor' ? {reset: {kind: 'daily', tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago', hour: 0, minute: 0, source: 'owner'}} : {})};
  await call('createTask', input); f.objective.value = ''; f.fields.value = ''; f.appLabel.value = ''; flash('Task created. Approve it below.');
};
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-task]');
  if (t) { await call('taskAction', {id: t.dataset.task, action: t.dataset.act}); return; }
  const a = e.target.closest('[data-approve]');
  if (a) {
    const id = a.dataset.approve, q = s => document.querySelector('[' + s + '="' + id + '"]');
    await call('approveTask', {id, rulesAllow: !!(q('data-rules') && q('data-rules').checked), zeroCostConfirmed: !!(q('data-zero') && q('data-zero').checked), approvals: q('data-consent') && q('data-consent').checked ? ['account_creation', 'terms_acceptance'] : []});
    flash('Approved. Falcor runs it when it is due and Autopilot is on, or press Run now.');
  }
  const u = e.target.closest('[data-unpair]'); if (u) await call('unpairPhone', {id: u.dataset.unpair});
  const p = e.target.closest('[data-unrule]'); if (p) await call('removePolicy', {key: p.dataset.unrule});
  const s = e.target.closest('[data-unsecret]'); if (s) await call('removeSecret', {name: s.dataset.unsecret});
});

// ------------------------------------------------------------------ stats
function renderStats() {
  const s = S.stats;
  $('tiles').innerHTML = [['Today: runs', s.today.runs], ['Today: verified', s.today.verified], ['Waiting on you', s.today.needsYou], ['All-time verified', s.allTime.verified]].map(([k, v]) => '<div class="tile"><span class="muted small">' + esc(k) + '</span><b>' + esc(v) + '</b></div>').join('');
  const units = Object.entries(s.rewards);
  $('rewards').innerHTML = units.length ? '<tr><th>Unit</th><th>Offered</th><th>Claimed</th><th>Pending</th><th>Confirmed</th><th>Received</th></tr>' + units.map(([u, r]) => '<tr><td>' + esc(u) + '</td><td>' + r.offered + '</td><td>' + r.claimed + '</td><td>' + r.pending + '</td><td>' + r.confirmed + '</td><td>' + r.received + '</td></tr>').join('') : '<tr><td class="muted">No rewards recorded yet.</td></tr>';
  const name = id => { const t = S.tasks.find(x => x.id === id); return t ? t.app + ' · ' + t.objective : 'Removed task'; };
  $('runs').innerHTML = s.recentRuns.length ? s.recentRuns.map(r => '<li><span>' + esc(name(r.missionId)) + '<br><span class="muted small">' + time(r.startedAt) + ' · ' + esc(r.reason) + '</span></span><span class="pill ' + (/VERIFIED|PENDING/.test(r.outcome) ? 'green' : r.outcome === 'RUNNING' ? 'blue' : r.outcome === 'NO_CHANGE' ? 'muted' : 'sand') + '">' + esc(r.outcome.replace(/_/g, ' ').toLowerCase()) + '</span></li>').join('') : '<li class="muted">No runs yet.</li>';
}

// ------------------------------------------------------------------ settings
function renderSettings() {
  $('kimistate').innerHTML = S.kimi.configured ? '<span class="green">Key saved.</span> Model: <code>' + esc(S.kimi.model) + '</code>' : '<span class="sand">No key yet.</span> Without it Falcor hands unknown screens to you.';
  if (document.activeElement !== $('kimimodel')) $('kimimodel').value = S.kimi.model;
  $('remotes').innerHTML = S.remote.phones.map(p => '<li><span>' + esc(p.name) + ' <span class="muted small">· last seen ' + (p.lastSeenAt ? time(p.lastSeenAt) : '—') + '</span></span><button class="danger" data-unpair="' + esc(p.id) + '">Unpair</button></li>').join('');
  $('policies').innerHTML = S.profiles.map(p => '<li><span>' + esc(p.label) + ' <code>' + esc(p.packages.join(', ')) + '</code></span><span class="pill red">' + esc(p.mode.replace('_', ' ').toLowerCase()) + '</span></li>').join('') + S.policies.map(p => '<li><span><code>' + esc(p.key) + '</code> <span class="muted small">· ' + esc(p.source) + '</span></span><span class="row"><span class="pill ' + (p.status === 'ALLOWED' ? 'green' : p.status === 'PROHIBITED' ? 'red' : 'sand') + '">' + esc(p.status) + '</span><button data-unrule="' + esc(p.key) + '">Remove</button></span></li>').join('');
  $('secrets').innerHTML = S.secretNames.map(n => '<li><code>vault:' + esc(n) + '</code><button data-unsecret="' + esc(n) + '">Remove</button></li>').join('');
  $('about').textContent = 'Falcor.Hub ' + S.version + (S.simulated ? ' · simulated phone' : '') + ' · adb ' + (S.adb ? 'ready' : 'missing') + ' · scrcpy ' + (S.scrcpy ? 'ready' : 'missing');
}
$('kimiform').onsubmit = async e => { e.preventDefault(); await call('saveKimi', {key: $('kimikey').value, model: $('kimimodel').value}); $('kimikey').value = ''; flash('Kimi settings saved.'); };
$('kimitest').onclick = async () => { const r = await call('testKimi'); flash('Kimi answered: ' + r); };
$('kimiremove').onclick = async () => { await call('removeKimi'); flash('Kimi key removed.'); };
let pairTimer = null;
$('pair').onclick = async () => {
  const p = await call('pairPhone');
  $('qr').src = p.qrImage; $('paircode').textContent = p.code.replace(/(.{4})/, '$1 '); $('pairurl').textContent = p.url || 'no home network found: connect this computer to Wi-Fi';
  $('pairbox').hidden = false; clearInterval(pairTimer);
  const tickExp = () => { const s = Math.max(0, Math.round((p.expiresAt - Date.now()) / 1000)); $('pairexp').textContent = s ? 'In Falcor.Hub Remote: Scan QR, or type the address and code. Expires in ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '.' : 'Expired. Make a new code.'; if (!s) clearInterval(pairTimer); };
  tickExp(); pairTimer = setInterval(tickExp, 1000);
};
$('firewall').onclick = async () => flash(await call('firewall'));
$('policyform').onsubmit = async e => { e.preventDefault(); const f = e.target; await call('savePolicy', {key: f.key.value, status: f.status.value, source: f.source.value}); f.reset(); flash('App rule saved.'); };
$('secretform').onsubmit = async e => { e.preventDefault(); const f = e.target; await call('setSecret', {name: f.name.value, value: f.value.value}); f.reset(); flash('Secret sealed on this computer.'); };

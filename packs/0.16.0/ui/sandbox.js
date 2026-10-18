// Falcor.Hub's Sandbox tab: build a sequence from blocks on the live mirror, test it, run it, schedule it. Loaded after
// app.js and uses its helpers (S, call, toast, go, send, the mirror). Everything is checked again on the computer's side
// (sandbox/index.ts): this page only edits a draft, and nothing runs until the owner presses Start, Preview or Test step.
(function () {
  const SB = {cat: null, data: null, seq: null, dirty: false, sel: [], focus: null, undo: [], redo: [], merge: '', mergeAt: 0,
    mode: 'view', view: 'flow', insp: 'basic', draw: null, drag: null, pinDrag: null, libCat: 'all', libQ: '',
    check: null, error: '', loading: null, live: null, events: [], eventsFor: '', logRun: null, wasLive: null, deviceSeen: new Set()};
  const BLOCKS = () => new Map((SB.cat ? SB.cat.blocks : []).map(b => [b.type, b]));
  const CATS = {touch: 'Touch and gesture', app: 'App and device', flow: 'Time and flow', screen: 'Screen aware'};
  const KEYS = ['BACK', 'HOME', 'APP_SWITCH', 'ENTER', 'DEL', 'TAB', 'ESCAPE'], KEYNAME = {BACK: 'Back', HOME: 'Home', APP_SWITCH: 'Recent apps', ENTER: 'Enter', DEL: 'Delete', TAB: 'Tab', ESCAPE: 'Escape'};
  const POINTS = ['tap', 'doubleTap', 'longPress', 'swipe', 'path', 'multiTap'];
  const local = {get(k, d) { try { const v = localStorage.getItem('sb.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { if (v === null) localStorage.removeItem('sb.' + k); else localStorage.setItem('sb.' + k, JSON.stringify(v)); } catch { /* private window */ } }};
  const sb = (op, a = {}) => call('sandbox', {op, ...a});
  const quiet = (op, a = {}) => window.hub.call('sandbox', {op, ...a});
  const def = () => SB.seq && SB.seq.def;
  const newId = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const prefs = () => (SB.data && SB.data.prefs) || {};
  const sdev = () => S && (S.devices.find(x => x.id === deviceId) || S.devices[0]) || null;

  // ------------------------------------------------------------------ words (the same as sandbox/schema.ts#words)
  const fmtMs = ms => { ms = Number(ms) || 0; if (ms < 1000) return ms + ' ms'; if (ms < 60000) return (Math.round(ms / 100) / 10) + ' s'; if (ms < 3600000) { const m = Math.floor(ms / 60000), s = Math.round((ms % 60000) / 1000); return m + ' min' + (s ? ' ' + s + ' s' : ''); } const h = Math.floor(ms / 3600000), m = Math.round((ms % 3600000) / 60000); return h + ' h' + (m ? ' ' + m + ' min' : ''); };
  const pt = p => Array.isArray(p) ? Math.round(p[0] * 100) + '%, ' + Math.round(p[1] * 100) + '%' : '?';
  const dirOf = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); };
  const condWords = c => !c ? '…' : c.kind === 'text' ? 'the screen ' + (c.present !== false ? 'says' : 'no longer says') + ' "' + (c.text || '…') + '"' : c.kind === 'control' ? '"' + (c.text || '…') + '" is on screen' : c.kind === 'app' ? (c.packageName || '…') + ' is in front' : c.kind === 'var' ? c.name + ' ' + c.op + ' ' + c.value : 'the screen changed';
  function words(s) {
    if (s.label) return s.label;
    const p = s.params || {};
    switch (s.type) {
      case 'tap': return 'Tap ' + (p.anchor && p.anchor.text && p.anchor.mode !== 'off' ? '"' + p.anchor.text + '"' : 'at ' + pt(p.point));
      case 'doubleTap': return 'Double tap at ' + pt(p.point);
      case 'longPress': return 'Long press at ' + pt(p.point) + ' for ' + fmtMs(p.durationMs);
      case 'swipe': return 'Swipe ' + (p.start && p.end ? dirOf(p.start, p.end) : '');
      case 'path': return 'Draw a path through ' + (p.points || []).length + ' points';
      case 'scroll': return 'Scroll ' + p.direction + (Number(p.amount) > 1 ? ' ×' + p.amount : '');
      case 'multiTap': return 'Tap ' + (p.points || []).length + ' points in order';
      case 'key': return 'Press ' + (KEYNAME[p.key] || p.key);
      case 'typeText': return 'Enter text (' + String(p.text || '').length + ' characters)';
      case 'clearText': return 'Clear ' + p.count + ' characters';
      case 'launchApp': return 'Open ' + (appName(p.packageName) || '…');
      case 'waitForApp': return 'Wait for ' + (appName(p.packageName) || '…') + ' (up to ' + fmtMs(p.timeoutMs) + ')';
      case 'screenshot': return 'Screenshot' + (p.label ? ' "' + p.label + '"' : '');
      case 'wait': return 'Wait ' + fmtMs(p.durationMs);
      case 'waitRandom': return 'Wait ' + fmtMs(p.minMs) + '–' + fmtMs(p.maxMs);
      case 'repeat': return 'Repeat ' + p.times + ' times';
      case 'repeatFor': return 'Repeat for ' + fmtMs(p.durationMs);
      case 'repeatUntil': return 'Repeat until ' + condWords(p.condition);
      case 'if': return 'If ' + condWords(p.condition);
      case 'waitUntil': return 'Wait until ' + condWords(p.condition);
      case 'callSequence': { const q = SB.data && SB.data.sequences.find(x => x.id === p.sequenceId); return 'Run "' + (q ? q.title : '…') + '"'; }
      case 'setVar': return 'Set ' + p.name + ' = ' + p.value;
      case 'incVar': return 'Add ' + p.by + ' to ' + p.name;
      case 'tapText': return 'Tap "' + (p.text || '…') + '"';
      case 'verifyText': return 'Check the screen says "' + (p.text || '…') + '"';
    }
    const b = BLOCKS().get(s.type); return b ? b.name : s.type;
  }
  function appName(pkg) { if (!pkg) return ''; const d = sdev(); return (d && d.installedNames && d.installedNames[pkg]) || pkg; }
  function meta(s) {
    const m = [];
    if (s.waitBeforeMs) m.push('wait ' + fmtMs(s.waitBeforeMs) + ' first'); if (s.waitAfterMs) m.push('then ' + fmtMs(s.waitAfterMs));
    if (s.retry && s.retry.max) m.push('retry ×' + s.retry.max); if (s.onError && s.onError !== 'inherit') m.push('on error: ' + s.onError);
    if (s.expect) m.push('expects ' + (s.expect.kind === 'changed' ? 'a change' : s.expect.kind === 'gone' ? '"' + s.expect.text + '" gone' : '"' + s.expect.text + '"'));
    if (s.note) m.push(s.note);
    return m.join(' · ') || (BLOCKS().get(s.type) || {name: ''}).name;
  }

  // ------------------------------------------------------------------ the sequence's tree
  function each(list, fn, parent = null, slot = 'root') { list.forEach((s, i) => { fn(s, parent, slot, i, list); if (s.children) each(s.children, fn, s, 'children'); if (s.else) each(s.else, fn, s, 'else'); }); }
  function locate(id) { let out = null; if (def()) each(def().steps, (s, parent, slot, i, list) => { if (s.id === id) out = {step: s, parent, slot, i, list}; }); return out; }
  function flat() { const out = []; if (def()) each(def().steps, s => out.push(s)); return out; }
  function listOf(into) { if (into === 'root') return def().steps; const [id, slot] = into.split(':'), l = locate(id); if (!l) return null; if (!l.step[slot]) l.step[slot] = []; return l.step[slot]; }
  function inside(step, id) { let yes = false; each([step], s => { if (s.id === id) yes = true; }); return yes; }
  const fresh = steps => JSON.parse(JSON.stringify(steps)).map(function re(s) { s.id = newId(); if (s.children) s.children = s.children.map(re); if (s.else) s.else = s.else.map(re); return s; });
  function make(type) {
    const b = BLOCKS().get(type), p = prefs(), params = {};
    for (const spec of b.params) if (spec.def !== undefined && !(spec.optional && (spec.kind === 'anchor' || spec.key === 'offset'))) params[spec.key] = JSON.parse(JSON.stringify(spec.def));
    if (type === 'wait' && p.defaultWaitMs) params.durationMs = p.defaultWaitMs;
    if (type === 'longPress' && p.defaultHoldMs) params.durationMs = p.defaultHoldMs;
    if ((type === 'swipe' || type === 'path') && p.gestureMs) params.durationMs = p.gestureMs;
    const d = sdev();
    if ((type === 'launchApp' || type === 'waitForApp') && d && d.foreground && !/launcher|systemui/.test(d.foreground)) params.packageName = d.foreground;
    const s = {id: newId(), type, params};
    if (b.group) s.children = []; if (b.group === 'branch') s.else = [];
    return s;
  }
  // Where a new block goes: after the step in focus (inside it, if it is an empty group), else at the end.
  function placeAfterFocus() {
    const l = SB.focus && locate(SB.focus);
    if (!l) return {into: 'root', at: def().steps.length};
    const b = BLOCKS().get(l.step.type);
    if (b && b.group && !(l.step.children || []).length) return {into: l.step.id + ':children', at: 0};
    return {into: l.parent ? l.parent.id + ':' + l.slot : 'root', at: l.i + 1};
  }

  // ------------------------------------------------------------------ edits, undo, autosave
  function edit(fn, o = {}) {
    if (!def()) return;
    const now = Date.now();
    if (!(o.merge && o.merge === SB.merge && now - SB.mergeAt < 1500)) { SB.undo.push(JSON.stringify(def())); if (SB.undo.length > 100) SB.undo.shift(); SB.redo = []; }
    SB.merge = o.merge || ''; SB.mergeAt = now;
    fn(def());
    dirty(true);
    draw({insp: o.insp !== false});
  }
  function undo() { if (!SB.undo.length || !def()) return; SB.redo.push(JSON.stringify(def())); SB.seq.def = JSON.parse(SB.undo.pop()); SB.merge = ''; keepSel(); dirty(true); draw(); }
  function redo() { if (!SB.redo.length || !def()) return; SB.undo.push(JSON.stringify(def())); SB.seq.def = JSON.parse(SB.redo.pop()); SB.merge = ''; keepSel(); dirty(true); draw(); }
  function keepSel() { SB.sel = SB.sel.filter(id => locate(id)); if (SB.focus && !locate(SB.focus)) SB.focus = null; }
  let checkTimer = null;
  function dirty(on) {
    SB.dirty = on;
    if (SB.seq) local.set('draft.' + SB.seq.id, on && prefs().autosave !== false ? {at: Date.now(), revision: SB.seq.revision.number, def: def()} : null);
    clearTimeout(checkTimer);
    if (on) checkTimer = setTimeout(recheck, 350);
  }
  async function recheck() {
    if (!def()) return;
    try { SB.check = await quiet('check', {definition: def()}); SB.error = ''; } catch (e) { SB.error = errText(e); }
    if (!SB.focus) drawInsp(); drawSum();
  }

  // ------------------------------------------------------------------ opening, saving
  async function load() {
    if (SB.loading) return SB.loading;
    SB.loading = (async () => {
      const [cat, data] = await Promise.all([sb('catalog'), sb('list')]);
      SB.cat = cat; SB.data = data;
      drawLib();
      const last = local.get('last', null);
      if (!SB.seq && last && data.sequences.some(q => q.id === last)) await open(last);
      draw();
    })();
    return SB.loading.catch(() => { SB.loading = null; });
  }
  async function refresh() { SB.data = await quiet('list').catch(() => SB.data); drawHead(); drawLib(); }
  async function open(id, o = {}) {
    const g = await sb('get', {id});
    SB.seq = {id: g.id, title: g.title, def: g.definition, revision: g.revision, revisions: g.revisions, meta: g.meta};
    SB.check = {warnings: g.warnings, estimate: g.estimate}; SB.error = '';
    SB.undo = []; SB.redo = []; SB.dirty = false; SB.merge = '';
    if (!o.keepSel) { SB.sel = []; SB.focus = null; } else keepSel();
    if (g.definition.target.deviceId && S && S.devices.some(x => x.id === g.definition.target.deviceId)) deviceId = g.definition.target.deviceId;
    local.set('last', g.id);
    const draft = local.get('draft.' + g.id, null);
    if (draft && !o.discardDraft && draft.revision === g.revision.number && JSON.stringify(draft.def) !== JSON.stringify(g.definition)) { SB.seq.def = draft.def; SB.dirty = true; toast('Your unsaved changes to "' + g.title + '" are back. Save keeps them; Undo is empty.', 'warn'); }
    else local.set('draft.' + g.id, null);
    SB.events = []; SB.eventsFor = ''; SB.logRun = null;
    draw();
  }
  async function save(o = {}) {
    if (!def()) return null;
    if (!SB.dirty && !o.force) return SB.seq.revision;
    const r = await sb('save', {id: SB.seq.id, definition: def()});
    SB.seq.revision = {id: r.id, number: r.number, at: Date.now()}; SB.check = {warnings: r.warnings, estimate: r.estimate}; SB.error = '';
    dirty(false); local.set('draft.' + SB.seq.id, null);
    if (!o.silent) toast(r.unchanged ? 'Nothing changed since version ' + r.number + '.' : 'Saved as version ' + r.number + '.');
    const g = await quiet('get', {id: SB.seq.id}).catch(() => null); if (g) SB.seq.revisions = g.revisions;
    await refresh(); draw();
    return SB.seq.revision;
  }
  async function saveAs() {
    if (!def()) return;
    const r = await sb('create', {definition: {...def(), title: (def().title + ' (copy)').slice(0, 80)}});
    await refresh(); await open(r.id); toast('Saved as a new sequence. Rename it at the top.');
  }

  // ------------------------------------------------------------------ the phone's state and runs
  function liveRun() { const d = sdev(); return d && d.sandbox ? d.sandbox : null; }
  async function start(mode) {
    if (!def()) return;
    const d = sdev(); if (!d) { toast('Plug in the phone first.', 'warn'); return; }
    if (mode === 'test' && !SB.focus) { toast('Select the step to test.', 'warn'); return; }
    if (SB.dirty) await save({silent: true});
    // One controller per phone: while the Daily Queue runs something else, the owner chooses (queue.js).
    if (window.qGuard && !(await qGuard({type: 'sequence', id: SB.seq.id}, def().title))) return;
    if (controlling && !S.teaching) await call('release', {deviceId: d.id}).catch(() => {});
    const r = await sb('start', {id: SB.seq.id, deviceId: d.id, mode, stepId: mode === 'test' ? SB.focus : undefined});
    SB.events = []; SB.eventsFor = r.id; SB.logRun = r.id;
    toast(mode === 'test' ? 'Testing one step on the phone.' : mode === 'preview' ? 'Preview: watch the phone. Pause or Stop any time.' : 'Running "' + def().title + '" (version ' + r.revision + ').');
  }
  const ctl = (op, label) => async () => { const l = liveRun(); if (!l) return; await sb(op, {runId: l.runId}); if (label) toast(label); };
  let pollTimer = null;
  function poll() {
    clearTimeout(pollTimer);
    const l = liveRun(), want = l ? l.runId : SB.view === 'log' ? SB.logRun : null;
    if (!want || tab !== 'sandbox') { pollTimer = setTimeout(poll, 1500); return; }
    quiet('run', {runId: want}).then(r => { if (r.id === want) { SB.events = r.events; SB.eventsFor = r.id; SB.runInfo = r; marks(); if (SB.view === 'log') drawLog(); } }).catch(() => {}).finally(() => { pollTimer = setTimeout(poll, l ? 1000 : 3000); });
  }
  poll();

  // ------------------------------------------------------------------ the render: called by app.js on every status
  window.renderSandbox = function (d) {
    if (!SB.cat) { void load(); return; }
    const l = liveRun();
    // A run that just ended: a burst when it completed, a red flash when it failed.
    if (SB.wasLive && !l) {
      const id = SB.wasLive;
      quiet('run', {runId: id}).then(r => { SB.events = r.events; SB.eventsFor = r.id; SB.runInfo = r; marks(); if (r.status === 'COMPLETED') P.burst($('sbsteps')); else if (r.status !== 'STOPPED') toast('Sandbox: ' + r.title + ' · ' + r.reason, r.status === 'FAILED' ? 'bad' : 'warn'); if (SB.view === 'log') drawLog(); }).catch(() => {});
      void refresh();
    }
    SB.wasLive = l ? l.runId : null;
    if (l && SB.mode !== 'run') setMode('run', true); else if (!l && SB.mode === 'run') setMode(S.teaching ? 'teach' : 'view', true);
    if (S.teaching && SB.mode !== 'teach' && !l) setMode('teach', true); else if (!S.teaching && SB.mode === 'teach') setMode('view', true);
    if (!S.teaching && !l && SB.mode === 'view' && controlling) setMode('control', true);
    drawHead(); drawRunbar(); marks(); devFrame(d);
  };
  function devFrame(d) {
    const devEl = $('device');
    cls(devEl, 'control', controlling && !S.teaching); cls(devEl, 'recording', !!S.teaching); cls(devEl, 'falcor-acting', !!(d && d.control && d.control.kind === 'agent'));
    $('devtag').hidden = !(controlling || S.teaching || liveRun()); text($('devtag'), S.teaching ? '● REC' : liveRun() ? 'SANDBOX RUN' : 'YOU HAVE CONTROL');
    const off = !d || !d.connected || !d.authorized;
    cls($('sbstage'), 'offline', off && !!$('mirror').getAttribute('src')); $('offtag').hidden = !(off && tab === 'sandbox' && $('mirror').getAttribute('src'));
    $('sbnophone').hidden = !(off && !$('mirror').getAttribute('src'));
    $('device').hidden = !!(off && !$('mirror').getAttribute('src'));
  }
  function draw(o = {}) {
    if (tab !== 'sandbox') return;
    drawHead(); drawSteps(); if (o.insp !== false) drawInsp(); drawSum(); sbPins(); drawRunbar(); marks();
    if (SB.view === 'log') drawLog();
  }
  function drawHead() {
    const d = sdev(), q = SB.seq;
    if (document.activeElement !== $('sbtitle')) $('sbtitle').value = q ? def().title : '';
    $('sbtitle').disabled = !q; $('sbdirty').hidden = !SB.dirty; text($('sbrev'), q ? 'v' + q.revision.number + (SB.dirty ? ' · unsaved' : '') : '');
    htmlOnce($('sbdev'), (S.devices.length ? S.devices : [{id: '', label: 'No phone'}]).map(x => '<option value="' + esc(x.id) + '"' + (d && x.id === d.id ? ' selected' : '') + '>' + esc(x.label) + '</option>').join(''));
    // Connection, the picture's age, rotation.
    if (d) SB.deviceSeen.add(d.id);
    const conn = !d ? (SB.deviceSeen.size ? ['bad', 'Disconnected'] : ['bad', 'No phone']) : !d.connected ? ['warn', 'Reconnecting'] : !d.authorized ? ['bad', 'Input unavailable · allow USB debugging'] : d.locked ? ['warn', 'Input unavailable · unlock it'] : d.emergency ? ['bad', 'Emergency Stop'] : ['ok', 'Connected'];
    const age = frameAt ? Math.round((Date.now() - frameAt) / 1000) : null;
    htmlOnce($('sbchips'), '<span class="' + conn[0] + '"><i class="led ' + (conn[0] === 'ok' ? 'on' : conn[0]) + '"></i>' + esc(conn[1]) + '</span>'
      + (age !== null ? '<span class="' + (age > 5 ? 'warn' : '') + '">Frame ' + (age < 1 ? 'live' : age + ' s old') + '</span>' : '')
      + (d ? '<span>' + (d.rotation % 2 ? 'Landscape' : 'Portrait') + '</span>' : '')
      + (q && def().target.rotation !== null && d && def().target.rotation !== d.rotation ? '<span class="warn">Drawn ' + (def().target.rotation % 2 ? 'landscape' : 'portrait') + '</span>' : ''));
    const l = liveRun(), mine = l && q && l.sequenceId === q.id;
    for (const id of ['sbsave', 'sbsaveas', 'sbtest', 'sbpreview', 'sbsched', 'sbqueue', 'sbsavetask']) $(id).disabled = !q;
    if (q) { const listed = SB.data && SB.data.sequences.find(x => x.id === q.id); $('sbsavetask').innerHTML = icon(listed && listed.task ? 'check' : 'tasks') + (listed && listed.task ? 'In Tasks' : 'Save as task'); }
    $('sbsave').disabled = !q || !SB.dirty; $('sbundo').disabled = !SB.undo.length; $('sbredo').disabled = !SB.redo.length;
    $('sbstart').hidden = !!l; $('sbpreview').hidden = !!l; $('sbtest').hidden = !!l;
    $('sbstart').disabled = !q || !d || !!S.teaching || !!(d && (d.running || d.emergency));
    $('sbpreview').disabled = $('sbtest').disabled = $('sbstart').disabled; if (!SB.focus) $('sbtest').disabled = true;
    for (const id of ['sbpause', 'sbstop', 'sbafter', 'sbskip']) $(id).hidden = !l;
    if (l) { const paused = l.status === 'PAUSED' || l.status === 'NEEDS_ATTENTION'; $('sbpause').innerHTML = icon(paused ? 'play' : 'pause') + (paused ? 'Resume' : 'Pause'); $('sbskip').hidden = !paused; $('sbafter').hidden = !mine; }
    setBadge('badge-sandbox', S.sandbox && S.sandbox.live.length ? '▶' : 0);
  }
  function drawRunbar() {
    const l = liveRun(), r = !l && SB.runInfo && SB.seq && SB.runInfo.sequenceId === SB.seq.id ? SB.runInfo : null, x = l || r;
    $('sbrun').hidden = !x; if (!x) return;
    cls($('sbrun'), 'done', !l && x.status === 'COMPLETED'); cls($('sbrun'), 'bad', !l && /FAILED|NEEDS/.test(x.status));
    $('sbrun').firstElementChild.className = 'led ' + (l ? (x.status === 'RUNNING' ? 'on' : 'warn') : x.status === 'COMPLETED' ? 'on' : 'bad');
    text($('sbrunstate'), ({RUNNING: 'RUNNING', PAUSED: 'PAUSED', NEEDS_ATTENTION: 'NEEDS YOU', STARTING: 'STARTING', WAITING_FOR_DEVICE: 'WAITING FOR THE PHONE', COMPLETED: 'COMPLETED', STOPPED: 'STOPPED', FAILED: 'FAILED'})[x.status] || x.status);
    text($('sbrunstep'), (l ? l.step || l.reason : x.reason) || ''); text($('sbruntime'), clock(x.elapsedMs || 0) + ' · ' + (x.actions || 0) + ' actions');
  }
  function drawSum() {
    const q = SB.seq; if (!q) { text($('sbsum'), ''); return; }
    const n = flat().length, e = SB.check && SB.check.estimate;
    text($('sbsum'), n + ' step' + (n === 1 ? '' : 's') + (e ? ' · about ' + fmtMs(e.ms) + (e.actions !== null ? ' · ' + e.actions + ' actions' : '') : '') + (SB.error ? ' · ' + SB.error : SB.check && SB.check.warnings && SB.check.warnings.length ? ' · ' + SB.check.warnings.length + ' warning' + (SB.check.warnings.length === 1 ? '' : 's') : ''));
    cls($('sbsum'), 'red', !!SB.error);
  }

  // ------------------------------------------------------------------ library
  function drawLib() {
    if (!SB.cat) return;
    const favs = local.get('favs', []), recent = local.get('recent', []), q = SB.libQ.toLowerCase();
    htmlOnce($('sbcats'), [['all', 'All'], ['fav', '★'], ['recent', 'Recent'], ['touch', 'Touch'], ['app', 'App'], ['flow', 'Flow'], ['screen', 'Screen'], ['presets', 'Presets'], ['mine', 'My presets']].map(([k, n]) => '<button class="small' + (SB.libCat === k ? ' on' : '') + '" data-c="' + k + '">' + n + '</button>').join(''));
    const match = b => !q || (b.name + ' ' + b.help).toLowerCase().includes(q);
    const item = b => '<div class="lib' + (b.unavailable ? ' off' : '') + '" draggable="' + (!b.unavailable) + '" data-type="' + esc(b.type) + '" title="' + esc(b.unavailable || b.help) + '">' + icon(b.icon) + '<span>' + esc(b.name) + '</span><button class="fav' + (favs.includes(b.type) ? ' on' : '') + '" data-fav="' + esc(b.type) + '" title="Favourite">' + icon('star') + '</button></div>';
    const preset = p => '<div class="lib preset" draggable="true" data-preset="' + esc(p.id) + '" title="' + esc(p.help || '') + '">' + icon(p.icon || 'sandbox') + '<span>' + esc(p.name) + '</span>' + (p.builtin ? '<span></span>' : '<button class="fav" data-unpreset="' + esc(p.id) + '" title="Delete this preset">' + icon('trash') + '</button>') + '</div>';
    const B = SB.cat.blocks.filter(match), presets = SB.cat.presets.filter(p => !q || (p.name + ' ' + (p.help || '')).toLowerCase().includes(q));
    let h = '';
    if (SB.libCat === 'fav') h = B.filter(b => favs.includes(b.type)).map(item).join('') || '<p class="muted small">Star a block to keep it here.</p>';
    else if (SB.libCat === 'recent') h = recent.map(t => B.find(b => b.type === t)).filter(Boolean).map(item).join('') || '<p class="muted small">Blocks you add show here.</p>';
    else if (SB.libCat === 'presets') h = presets.filter(p => p.builtin).map(preset).join('');
    else if (SB.libCat === 'mine') h = presets.filter(p => !p.builtin).map(preset).join('') || '<p class="muted small">Select steps and press "Save as preset" in the inspector.</p>';
    else for (const [c, name] of Object.entries(CATS)) { if (SB.libCat !== 'all' && SB.libCat !== c) continue; const list = B.filter(b => b.cat === c); if (list.length) h += '<h4>' + esc(name) + '</h4>' + list.filter(b => !b.unavailable).map(item).join('') + list.filter(b => b.unavailable).map(item).join(''); }
    if (SB.libCat === 'all' && presets.length) h += '<h4>Presets</h4>' + presets.map(preset).join('');
    htmlOnce($('sbliblist'), h);
  }
  function addBlocks(steps, where) {
    if (!def()) { toast('Open or create a sequence first.', 'warn'); return; }
    const w = where || placeAfterFocus();
    edit(() => { const list = listOf(w.into); list.splice(Math.min(w.at, list.length), 0, ...steps); });
    SB.sel = steps.map(s => s.id); SB.focus = steps[0].id;
    draw();
    for (const s of steps) {
      const el = $('sbsteps').querySelector('.blk[data-id="' + s.id + '"]'); if (!el) continue;
      el.scrollIntoView({block: 'nearest', inline: 'nearest'});
      if (P.reduced()) continue;
      el.classList.add('dropin');
      const z = (el.parentElement.classList.contains('grp') ? el.parentElement : el).nextElementSibling; if (z && z.classList.contains('dz')) z.classList.add('flash');
    }
  }
  function addType(type, where) {
    const b = BLOCKS().get(type); if (!b) return;
    if (b.unavailable) { toast(b.name + ': ' + b.unavailable, 'warn'); return; }
    const recent = [type, ...local.get('recent', []).filter(t => t !== type)].slice(0, 8); local.set('recent', recent);
    addBlocks([make(type)], where);
    if (b.touches && b.params.some(p => p.kind === 'point' || p.kind === 'points') && SB.mode !== 'run') setMode(type === 'swipe' || type === 'path' ? 'gesture' : 'target');
  }
  function addPreset(id, where) { const p = SB.cat.presets.find(x => x.id === id); if (p) addBlocks(fresh(p.steps), where); }
  $('sbcats').onclick = e => { const b = e.target.closest('[data-c]'); if (b) { SB.libCat = b.dataset.c; drawLib(); } };
  $('sblibq').oninput = e => { SB.libQ = e.target.value; drawLib(); };
  $('sblibfold').onclick = () => { const g = $('sbgrid'); if (window.innerWidth <= 1180) g.classList.toggle('libopen'); else g.classList.toggle('libfold'); setTimeout(fitDevice, 30); };
  $('sbliblist').onclick = async e => {
    const f = e.target.closest('[data-fav]'); if (f) { e.stopPropagation(); const favs = local.get('favs', []), t = f.dataset.fav; local.set('favs', favs.includes(t) ? favs.filter(x => x !== t) : [...favs, t]); drawLib(); return; }
    const u = e.target.closest('[data-unpreset]'); if (u) { e.stopPropagation(); await sb('presetRemove', {id: u.dataset.unpreset}); SB.cat = await sb('catalog'); drawLib(); return; }
    const it = e.target.closest('.lib'); if (!it) return;
    if (it.dataset.type) addType(it.dataset.type); else if (it.dataset.preset) addPreset(it.dataset.preset);
  };
  $('sbliblist').addEventListener('dragstart', e => { const it = e.target.closest('.lib'); if (!it || it.classList.contains('off')) { e.preventDefault(); return; } SB.drag = it.dataset.type ? {type: it.dataset.type} : {preset: it.dataset.preset}; e.dataTransfer.setData('text/plain', 'sandbox'); e.dataTransfer.effectAllowed = 'copy'; $('sbsteps').classList.add('dragging'); });
  $('sbliblist').addEventListener('dragend', () => endDrag());

  // ------------------------------------------------------------------ timeline: flow and tree
  function drawSteps() {
    const box = $('sbsteps'), before = P.motion.snapshot(box); box.className = 'steps ' + (SB.view === 'tree' ? 'tree' : 'flow') + (SB.drag ? ' dragging' : ''); box.hidden = SB.view === 'log'; $('sblog').hidden = SB.view !== 'log';
    if (!SB.seq) { htmlOnce(box, '<div class="empty">No sequence open. <button class="small primary" data-do="new">' + icon('plus') + 'New sequence</button> <button class="small" data-do="open">' + icon('book') + 'Open</button> <button class="small" data-do="example">Try the example</button></div>'); return; }
    const B = BLOCKS();
    const dz = (into, at) => '<i class="dz" data-into="' + into + '" data-at="' + at + '"></i>';
    const lane = (list, into) => { let h = dz(into, 0); list.forEach((s, i) => { h += block(s) + dz(into, i + 1); }); return h; };
    const block = s => {
      const b = B.get(s.type) || {icon: 'sandbox', name: s.type};
      const card = '<div class="blk' + (SB.sel.includes(s.id) ? ' sel' : '') + (s.enabled === false ? ' off' : '') + (s.color ? ' c-' + s.color : '') + '" data-id="' + esc(s.id) + '" draggable="true" title="' + esc(b.name + (s.note ? ' · ' + s.note : '')) + '">' + icon(b.icon) + '<span class="w">' + esc(words(s)) + '</span><span class="m">' + esc(meta(s)) + '</span></div>';
      if (!b.group) return card;
      return '<div class="grp" data-g="' + esc(s.id) + '">' + card + '<div class="lane" data-l="' + (b.group === 'branch' ? 'THEN' : 'DO') + '">' + lane(s.children || [], s.id + ':children') + '</div>' + (b.group === 'branch' ? '<div class="lane" data-l="ELSE">' + lane(s.else || [], s.id + ':else') + '</div>' : '') + '</div>';
    };
    htmlOnce(box, def().steps.length ? lane(def().steps, 'root') : '<div class="empty">Drag blocks here from the library, click one to add it, or press Teach and show Falcor on the mirror.</div>' + dz('root', 0));
    P.motion.settle(box, before);
  }
  // The run's marks: the step being played glows, done steps tick, a failed one flashes red.
  function marks() {
    const box = $('sbsteps'); if (!box || !SB.seq) return;
    const l = liveRun(), mine = (l && l.sequenceId === SB.seq.id) || (SB.runInfo && SB.runInfo.sequenceId === SB.seq.id && SB.eventsFor === SB.runInfo.id);
    const done = new Set(), fail = new Set();
    if (mine) for (const e of SB.events) { if (e.type === 'done' && e.stepId) { done.add(e.stepId); fail.delete(e.stepId); } if (e.type === 'fail' && e.stepId) fail.add(e.stepId); }
    for (const el of box.querySelectorAll('.blk')) {
      const id = el.dataset.id;
      cls(el, 'now', !!(l && l.sequenceId === SB.seq.id && l.stepId === id)); cls(el, 'done', done.has(id)); cls(el, 'fail', fail.has(id));
    }
    const now = l && box.querySelector('.blk.now'); if (now && SB.follow !== l.stepId) { SB.follow = l.stepId; now.scrollIntoView({block: 'nearest', inline: 'center'}); }
    sbPins();
  }
  $('sbviews').onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; SB.view = b.dataset.v; document.querySelectorAll('#sbviews button').forEach(x => cls(x, 'on', x === b)); draw(); poll(); };
  $('sbsteps').addEventListener('click', e => {
    const doit = e.target.closest('[data-do]'); if (doit) { ({new: newSheet, open: openSheet, example: () => sb('create', {template: 'starter', deviceId: sdev() ? sdev().id : null}).then(r => refresh().then(() => open(r.id)))})[doit.dataset.do](); return; }
    const el = e.target.closest('.blk'); if (!el) { if (e.target === $('sbsteps')) { SB.sel = []; SB.focus = null; draw(); } return; }
    select(el.dataset.id, e);
  });
  function select(id, e = {}) {
    if (e.ctrlKey || e.metaKey) SB.sel = SB.sel.includes(id) ? SB.sel.filter(x => x !== id) : [...SB.sel, id];
    else if (e.shiftKey && SB.focus) { const ids = flat().map(s => s.id), a = ids.indexOf(SB.focus), b = ids.indexOf(id); SB.sel = ids.slice(Math.min(a, b), Math.max(a, b) + 1); }
    else SB.sel = [id];
    SB.focus = id; draw();
  }
  // Drag to reorder (several selected move together), and drop library blocks into place.
  $('sbsteps').addEventListener('dragstart', e => { const el = e.target.closest('.blk'); if (!el || SB.mode === 'run') { e.preventDefault(); return; } const id = el.dataset.id; SB.drag = {ids: SB.sel.includes(id) ? SB.sel.slice() : [id]}; e.dataTransfer.setData('text/plain', 'sandbox'); e.dataTransfer.effectAllowed = 'move'; el.classList.add('drag-source'); setTimeout(() => $('sbsteps').classList.add('dragging'), 0); });
  $('sbsteps').addEventListener('dragover', e => { if (!SB.drag) return; const z = dropZone(e); e.preventDefault(); $('sbsteps').querySelectorAll('.dz.hot').forEach(x => x !== z && x.classList.remove('hot')); if (z) z.classList.add('hot'); });
  $('sbsteps').addEventListener('drop', e => {
    e.preventDefault(); const z = dropZone(e), d = SB.drag; endDrag(); if (!d || !def()) return;
    const where = z ? {into: z.dataset.into, at: Number(z.dataset.at)} : {into: 'root', at: def().steps.length};
    if (d.type) addType(d.type, where); else if (d.preset) addPreset(d.preset, where); else if (d.ids) move(d.ids, where);
  });
  $('sbsteps').addEventListener('dragend', () => endDrag());
  // Preview and commit use the same nearby insertion slot, so the visual snap is truthful.
  function dropZone(e) {
    const exact = e.target.closest('.dz');
    const valid = z => {
      const parent = z.dataset.into.split(':')[0];
      return !SB.drag?.ids?.some(id => id === parent || $('sbsteps').querySelector('.grp[data-g="' + id + '"]')?.contains(z));
    };
    if (exact && valid(exact)) return exact;
    let best = null, distance = 25;
    for (const z of $('sbsteps').querySelectorAll('.dz')) {
      if (!valid(z)) continue;
      const r = z.getBoundingClientRect();
      const d = Math.hypot(Math.max(r.left - e.clientX, 0, e.clientX - r.right), Math.max(r.top - e.clientY, 0, e.clientY - r.bottom));
      if (d < distance) { best = z; distance = d; }
    }
    return best;
  }
  function endDrag() { $('sbsteps').querySelectorAll('.drag-source').forEach(x => x.classList.remove('drag-source')); SB.drag = null; $('sbsteps').classList.remove('dragging'); $('sbsteps').querySelectorAll('.dz.hot').forEach(x => x.classList.remove('hot')); }
  function move(ids, where) {
    const into = where.into === 'root' ? null : where.into.split(':')[0];
    const moving = ids.map(id => locate(id)).filter(Boolean).map(l => l.step);
    // Only the outermost selected steps move (a selected child moves with its group); never into itself.
    const top = moving.filter(s => !moving.some(o => o !== s && inside(o, s.id)));
    if (into && top.some(s => inside(s, into))) { toast('A group cannot go inside itself.', 'warn'); return; }
    edit(() => {
      const list = listOf(where.into), marker = {id: '__drop__'}; list.splice(where.at, 0, marker);
      for (const s of top) { const l = locate(s.id); l.list.splice(l.i, 1); }
      each(def().steps, (s, p, slot, i, lst) => { if (s === marker) lst.splice(i, 1, ...top); });
      if (def().steps.includes(marker)) def().steps.splice(def().steps.indexOf(marker), 1, ...top);
    });
    const z = $('sbsteps').querySelector('.blk[data-id="' + top[0].id + '"]'); if (z && !P.reduced()) z.classList.add('dropin');
  }
  function removeSel() { const ids = SB.sel.length ? SB.sel : SB.focus ? [SB.focus] : []; if (!ids.length) return; edit(() => { for (const id of ids) { const l = locate(id); if (l) l.list.splice(l.i, 1); } }); SB.sel = []; SB.focus = null; draw(); }
  function copySel(cut) { const ids = SB.sel.length ? SB.sel : SB.focus ? [SB.focus] : []; const steps = ids.map(id => locate(id)).filter(Boolean).map(l => l.step); if (!steps.length) return; local.set('clip', steps); toast((cut ? 'Cut ' : 'Copied ') + steps.length + ' step' + (steps.length === 1 ? '' : 's') + '.'); if (cut) removeSel(); }
  function paste() { const c = local.get('clip', null); if (!c || !c.length) { toast('Nothing copied yet.', 'warn'); return; } addBlocks(fresh(c)); }
  function duplicate() { const ids = SB.sel.length ? SB.sel : SB.focus ? [SB.focus] : []; const steps = ids.map(id => locate(id)).filter(Boolean).map(l => l.step); if (steps.length) { const l = locate(ids[ids.length - 1]); addBlocks(fresh(steps), {into: l.parent ? l.parent.id + ':' + l.slot : 'root', at: l.i + 1}); } }
  function group() {
    const ids = SB.sel.length ? SB.sel : SB.focus ? [SB.focus] : []; const ls = ids.map(id => locate(id)).filter(Boolean);
    if (!ls.length) return; if (ls.some(l => l.list !== ls[0].list)) { toast('Select steps side by side to group them.', 'warn'); return; }
    const g = make('group');
    edit(() => { const list = ls[0].list, sorted = ls.slice().sort((a, b) => a.i - b.i), at = sorted[0].i; g.children = sorted.map(l => l.step); for (const l of sorted.reverse()) list.splice(l.i, 1); list.splice(at, 0, g); });
    SB.sel = [g.id]; SB.focus = g.id; draw();
  }
  function nudgeOrder(dir) { const l = SB.focus && locate(SB.focus); if (!l) return; const j = l.i + dir; if (j < 0 || j >= l.list.length) return; edit(() => { const x = locate(SB.focus); x.list.splice(x.i, 1); x.list.splice(j, 0, x.step); }); }

  // ------------------------------------------------------------------ inspector
  const MS_UNITS = [['ms', 1], ['s', 1000], ['min', 60000]];
  function msField(k, label, v, lo, hi) {
    const u = v && v % 60000 === 0 && v >= 60000 ? 60000 : v && v % 1000 === 0 && v >= 1000 ? 1000 : v >= 1000 ? 1000 : 1;
    return '<label>' + esc(label) + '<span class="unit"><input type="number" step="any" min="0" data-k="' + k + '" data-ms="' + u + '" value="' + (v === undefined || v === null || v === '' ? '' : String(Math.round(v / u * 1000) / 1000)) + '"' + (lo !== undefined ? ' title="' + esc(fmtMs(lo) + ' to ' + fmtMs(hi)) + '"' : '') + '><select data-unit="' + k + '">' + MS_UNITS.map(([n, f]) => '<option value="' + f + '"' + (f === u ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></span></label>';
  }
  const sel = (k, label, v, opts) => '<label>' + esc(label) + '<select data-k="' + k + '">' + opts.map(o => { const [val, name] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(val) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(name) + '</option>'; }).join('') + '</select></label>';
  const inp = (k, label, v, extra = '') => '<label>' + esc(label) + '<input data-k="' + k + '" value="' + esc(v ?? '') + '"' + extra + '></label>';
  const num = (k, label, v, lo, hi, step = 1) => '<label>' + esc(label) + '<input type="number" data-k="' + k + '" value="' + esc(v ?? '') + '" min="' + lo + '" max="' + hi + '" step="' + step + '"></label>';
  function pointField(k, label, v) {
    const off = k === 'offset', p = Array.isArray(v) ? v : off ? [0, 0] : [0.5, 0.5], lim = off ? ' min="-20" max="20"' : ' min="0" max="100"';
    return '<div class="ptrow"><label>' + esc(label) + ' x %<input type="number" step="0.1"' + lim + ' data-k="p.' + k + '.0" value="' + Math.round(p[0] * 1000) / 10 + '"></label><label>y %<input type="number" step="0.1"' + lim + ' data-k="p.' + k + '.1" value="' + Math.round(p[1] * 1000) / 10 + '"></label>' + (off ? '<span></span>' : '<button type="button" class="small" data-pick="' + k + '" title="Click the mirror to set it">' + icon('target') + 'Pick</button>') + '</div>'
      + '<div class="row"><span class="muted small">Nudge</span><span class="nudge"><button type="button" data-nudge="' + k + '" data-dx="-1" title="Left">←</button><button type="button" data-nudge="' + k + '" data-dy="-1" title="Up">↑</button><button type="button" data-nudge="' + k + '" data-dy="1" title="Down">↓</button><button type="button" data-nudge="' + k + '" data-dx="1" title="Right">→</button></span></div>';
  }
  function condField(c) {
    c = c || {kind: 'text', text: '', present: true};
    let h = sel('p.condition.kind', 'When', c.kind, [['text', 'the screen says / no longer says'], ['control', 'a control with a label is on screen'], ['app', 'an app is in front'], ['var', 'a variable compares'], ['changed', 'the screen changed']]);
    if (c.kind === 'text') h += '<div class="pair">' + sel('p.condition.present', 'It', c.present !== false ? 'true' : 'false', [['true', 'says'], ['false', 'no longer says']]) + inp('p.condition.text', 'Words', c.text, ' maxlength="120"') + '</div>';
    if (c.kind === 'control') h += inp('p.condition.text', 'Label', c.text, ' maxlength="120"');
    if (c.kind === 'app') h += inp('p.condition.packageName', 'App', c.packageName, ' list="sbapps"');
    if (c.kind === 'var') h += '<div class="pair">' + inp('p.condition.name', 'Variable', c.name) + sel('p.condition.op', 'Is', c.op || '>=', ['<', '<=', '==', '!=', '>=', '>']) + '</div>' + num('p.condition.value', 'Value', c.value ?? 0, -1e9, 1e9, 'any');
    return h;
  }
  function paramField(spec, s) {
    const v = s.params[spec.key], k = 'p.' + spec.key;
    switch (spec.kind) {
      case 'point': return pointField(spec.key, spec.label, v === undefined && spec.key === 'offset' ? [0, 0] : v);
      case 'points': return '<label>' + esc(spec.label) + ' (x%, y% per line)<textarea rows="3" data-k="' + k + '">' + esc((v || []).map(p => Math.round(p[0] * 1000) / 10 + ', ' + Math.round(p[1] * 1000) / 10).join('\n')) + '</textarea></label><div class="row"><button type="button" class="small" data-pickg="' + spec.key + '">' + icon('swipe') + 'Draw on the mirror</button></div>';
      case 'ms': return msField(k, spec.label, v, spec.min, spec.max);
      case 'int': return num(k, spec.label, v, spec.min, spec.max);
      case 'num': return num(k, spec.label, v, spec.min, spec.max, 'any');
      case 'text': return s.type === 'typeText' ? '<label>' + esc(spec.label) + '<textarea rows="2" maxlength="500" data-k="' + k + '">' + esc(v || '') + '</textarea></label><p class="help">Never put a password here: the log shows only how many characters.</p>' : inp(k, spec.label, v, ' maxlength="200"');
      case 'pkg': return inp(k, spec.label, v, ' list="sbapps" placeholder="com.example.app"');
      case 'key': return sel(k, spec.label, v, KEYS.map(x => [x, KEYNAME[x]]));
      case 'dir': return sel(k, spec.label, v, ['up', 'down', 'left', 'right']);
      case 'select': return sel(k, spec.label, v, spec.options);
      case 'name': return inp(k, spec.label, v, ' maxlength="24"');
      case 'bool': return '<label class="check"><input type="checkbox" data-k="' + k + '"' + (v ? ' checked' : '') + '>' + esc(spec.label) + '</label>';
      case 'seq': return sel(k, spec.label, v, [['', 'Pick a sequence'], ...(SB.data ? SB.data.sequences.filter(q => q.id !== SB.seq.id).map(q => [q.id, q.title]) : [])]);
      case 'condition': return condField(v);
      case 'anchor': { const a = v || {text: '', id: '', mode: 'prefer'}; return '<div class="pair">' + inp('p.anchor.text', 'Anchor (control label)', a.text, ' maxlength="120" placeholder="none"') + sel('p.anchor.mode', 'If it moved', a.mode || 'prefer', [['prefer', 'tap the control, else the point'], ['require', 'stop if it is not there'], ['off', 'tap the point only']]) + '</div><p class="help">' + esc(spec.help || '') + '</p>'; }
    }
    return '';
  }
  function drawInsp() {
    const box = $('sbinspbody'), s = SB.focus && locate(SB.focus) && locate(SB.focus).step;
    document.querySelectorAll('#sbinsptabs button').forEach(b => cls(b, 'on', b.dataset.t === SB.insp));
    $('sbinsptabs').hidden = !s;
    if (!SB.seq) { text($('sbinsptitle'), '// SANDBOX'); box.innerHTML = '<p class="muted small">A sequence is a list of blocks Falcor plays on the phone, step by step, through the same safety gate as Autopilot: never a purchase, a payment, an ad or a private screen.</p><div class="row"><button class="primary small" data-do="new">' + icon('plus') + 'New sequence</button><button class="small" data-do="open">' + icon('book') + 'Open</button></div>'; return; }
    if (!s) {
      const d = def(), st = d.settings, w = SB.check && SB.check.warnings || [], e = SB.check && SB.check.estimate;
      text($('sbinsptitle'), '// SEQUENCE');
      box.innerHTML = '<h3>' + icon(d.icon || 'sandbox') + esc(d.title) + '</h3>'
        + '<label>Description<textarea rows="2" maxlength="500" data-k="seq.description">' + esc(d.description) + '</textarea></label>'
        + sel('seq.deviceId', 'Phone', d.target.deviceId || '', [['', 'Any phone'], ...S.devices.map(x => [x.id, x.label])])
        + '<div class="pair">' + msField('seq.maxDurationMs', 'Maximum run time', st.maxDurationMs) + num('seq.maxActions', 'Maximum actions', st.maxActions, 1, 20000) + '</div>'
        + '<div class="pair">' + sel('seq.onError', 'When a step fails', st.onError, [['review', 'pause for me'], ['stop', 'stop the run'], ['skip', 'skip it']]) + num('seq.speed', 'Speed (×)', st.speed, 0.25, 4, 0.25) + '</div>'
        + msField('seq.reconnectMs', 'Wait for the phone to come back', st.reconnectMs)
        + (SB.error ? '<p class="err">' + esc(SB.error) + '</p>' : '')
        + (w.length ? '<ul class="warns">' + w.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '')
        + '<p class="muted small">' + flat().length + ' steps' + (e ? ' · about ' + fmtMs(e.ms) + (e.actions !== null ? ' · ' + e.actions + ' actions' : ' · open-ended within the caps') : '') + '</p>'
        + '<div class="acts"><button class="small" data-do="sched">' + icon('calendar') + 'Schedule</button><button class="small" data-do="history">History</button><button class="small" data-do="export">' + icon('export') + 'Export</button></div>';
      return;
    }
    const b = BLOCKS().get(s.type) || {name: s.type, params: [], help: '', icon: 'sandbox'};
    text($('sbinsptitle'), '// ' + b.name.toUpperCase());
    let h = '<h3>' + icon(b.icon) + esc(words(s)) + '</h3>';
    if (SB.insp === 'basic') {
      h += '<p class="help">' + esc(b.help) + '</p>' + inp('label', 'Name (optional)', s.label, ' maxlength="80" placeholder="' + esc(words({...s, label: ''})) + '"');
      for (const spec of b.params) h += paramField(spec, s);
    } else {
      h += '<label class="check"><input type="checkbox" data-k="enabled"' + (s.enabled !== false ? ' checked' : '') + '> On (an off step is skipped)</label>'
        + '<div class="pair">' + msField('waitBeforeMs', 'Wait before', s.waitBeforeMs) + msField('waitAfterMs', 'Wait after', s.waitAfterMs) + '</div>'
        + msField('timeoutMs', 'Step timeout', s.timeoutMs)
        + '<div class="pair">' + num('retry.max', 'Retries', s.retry ? s.retry.max : 0, 0, 5) + msField('retry.delayMs', 'Between retries', s.retry ? s.retry.delayMs : 1000) + '</div>'
        + '<label class="check"><input type="checkbox" data-k="retry.backoff"' + (s.retry && s.retry.backoff ? ' checked' : '') + '> Wait longer each retry</label>'
        + sel('onError', 'If it fails', s.onError || 'inherit', [['inherit', 'as the sequence says'], ['review', 'pause for me'], ['stop', 'stop the run'], ['skip', 'skip it']])
        + sel('expect.kind', 'Expected result', s.expect ? s.expect.kind : '', [['', 'none'], ['changed', 'the screen changes'], ['text', 'the screen says…'], ['gone', 'words disappear…']])
        + (s.expect && s.expect.kind !== 'changed' ? inp('expect.text', 'Words', s.expect.text, ' maxlength="120"') : '') + (s.expect ? msField('expect.timeoutMs', 'Within', s.expect.timeoutMs) : '')
        + sel('color', 'Colour', s.color || '', [['', 'none'], 'green', 'sand', 'red', 'blue', 'grey'])
        + '<label>Note<textarea rows="2" maxlength="300" data-k="note">' + esc(s.note || '') + '</textarea></label>';
    }
    if (SB.error) h += '<p class="err">' + esc(SB.error) + '</p>';
    h += '<div class="acts"><button class="small" data-do="test">' + icon('target') + 'Test step</button><button class="small" data-do="dup">' + icon('copy') + 'Duplicate</button><button class="small" data-do="group">Group</button><button class="small" data-do="preset">Save as preset</button><button class="small danger" data-do="del">' + icon('trash') + 'Delete</button></div>';
    box.innerHTML = h;
  }
  $('sbinsptabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { SB.insp = b.dataset.t; drawInsp(); } };
  // A field changed: the value is written into the draft (checked again when saved).
  function setPath(o, path, v) { const ks = path.split('.'); let x = o; for (let i = 0; i < ks.length - 1; i++) { if (x[ks[i]] === undefined || x[ks[i]] === null || typeof x[ks[i]] !== 'object') x[ks[i]] = {}; x = x[ks[i]]; } x[ks[ks.length - 1]] = v; }
  function fieldValue(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.dataset.ms) { const n = Number(el.value); return el.value === '' ? '' : Math.round(n * Number(el.dataset.ms)); }
    if (el.type === 'number') return el.value === '' ? '' : Number(el.value);
    return el.value;
  }
  function onField(el, structural) {
    const k = el.dataset.k; if (!k) return;
    let v = fieldValue(el);
    if (k.startsWith('seq.')) {
      const key = k.slice(4);
      edit(d => { if (key === 'description') d.description = v; else if (key === 'deviceId') d.target.deviceId = v || null; else d.settings[key] = v; }, {merge: k, insp: structural});
      return;
    }
    edit(() => {
      const s = locate(SB.focus).step;
      if (k.startsWith('p.')) {
        const path = k.slice(2), [key, sub] = path.split('.');
        const spec = (BLOCKS().get(s.type).params || []).find(x => x.key === key);
        if (spec && spec.kind === 'point' && (sub === '0' || sub === '1')) { const p = Array.isArray(s.params[key]) ? s.params[key].slice() : key === 'offset' ? [0, 0] : [0.5, 0.5]; p[Number(sub)] = Math.round(Number(v) * 10) / 1000; s.params[key] = p; }
        else if (spec && spec.kind === 'points') s.params[key] = String(v).split(/\n+/).map(l => l.split(/[,\s]+/).filter(Boolean).map(Number)).filter(p => p.length === 2 && p.every(Number.isFinite)).map(p => [p[0] / 100, p[1] / 100]);
        else if (key === 'condition' && sub === 'kind') s.params.condition = v === 'text' ? {kind: 'text', text: '', present: true} : v === 'control' ? {kind: 'control', text: ''} : v === 'app' ? {kind: 'app', packageName: ''} : v === 'var' ? {kind: 'var', name: 'count', op: '>=', value: 1} : {kind: 'changed'};
        else if (key === 'condition' && sub === 'present') s.params.condition.present = v === 'true';
        else if (key === 'anchor') { const a = s.params.anchor || {text: '', id: '', mode: 'prefer'}; a[sub] = v; if (sub === 'text') a.id = ''; if (!a.text && !a.id) delete s.params.anchor; else s.params.anchor = a; }
        else setPath(s.params, path, v);
      } else if (k === 'enabled') { if (v) delete s.enabled; else s.enabled = false; }
      else if (k.startsWith('retry.')) { s.retry = s.retry || {max: 0, delayMs: 1000, backoff: false}; setPath(s, k, v); if (!s.retry.max) delete s.retry; }
      else if (k === 'expect.kind') { if (!v) delete s.expect; else s.expect = {kind: v, timeoutMs: (s.expect && s.expect.timeoutMs) || 3000, ...(v !== 'changed' ? {text: (s.expect && s.expect.text) || ''} : {})}; }
      else if (k.startsWith('expect.')) setPath(s, k, v);
      else if (k === 'onError') { if (v === 'inherit') delete s.onError; else s.onError = v; }
      else if (['label', 'note', 'color'].includes(k)) { if (v) s[k] = v; else delete s[k]; }
      else { if (v === '' || v === 0 && /^wait/.test(k)) delete s[k]; else s[k] = v; }
    }, {merge: SB.focus + k, insp: structural});
    // Keep the block's words in step with what is typed, without rebuilding the inspector.
    const h = $('sbinspbody').querySelector('h3'); const st = locate(SB.focus); if (h && st) h.lastChild.textContent = words(st.step);
  }
  $('sbinspbody').addEventListener('input', e => { if (e.target.dataset.k && e.target.tagName !== 'SELECT') onField(e.target, false); });
  $('sbinspbody').addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.unit) { const i = $('sbinspbody').querySelector('[data-k="' + t.dataset.unit + '"]'); const ms = Number(i.value) * Number(i.dataset.ms); i.dataset.ms = t.value; i.value = String(Math.round(ms / Number(t.value) * 1000) / 1000); return; }
    if (t.tagName === 'SELECT' || t.type === 'checkbox') onField(t, true);
  });
  $('sbinspbody').addEventListener('click', async e => {
    const pk = e.target.closest('[data-pick]'); if (pk) { SB.pickKey = pk.dataset.pick; setMode('target'); return; }
    const pg = e.target.closest('[data-pickg]'); if (pg) { setMode('gesture'); return; }
    const n = e.target.closest('[data-nudge]'); if (n) { const k = n.dataset.nudge, dx = Number(n.dataset.dx || 0) * 0.005, dy = Number(n.dataset.dy || 0) * 0.005; edit(() => { const s = locate(SB.focus).step, p = s.params[k] || [0.5, 0.5], lo = k === 'offset' ? -0.2 : 0, hi = k === 'offset' ? 0.2 : 1; s.params[k] = [Math.min(hi, Math.max(lo, Math.round((p[0] + dx) * 10000) / 10000)), Math.min(hi, Math.max(lo, Math.round((p[1] + dy) * 10000) / 10000))]; }, {merge: 'nudge' + k}); return; }
    const d = e.target.closest('[data-do]'); if (!d) return;
    ({test: () => start('test'), dup: duplicate, group, del: removeSel, preset: presetSheet, sched: () => schedule(), history: historySheet, export: () => sb('export', {id: SB.seq.id}).then(ok => ok && toast('Exported.')), new: newSheet, open: openSheet})[d.dataset.do]();
  });

  // ------------------------------------------------------------------ the mirror: modes, picking, pins
  function setMode(m, auto) {
    if (m === SB.mode && !auto) { if (m === 'target' || m === 'gesture') return; }
    const l = liveRun();
    if (l && m !== 'run') { if (!auto) toast('A run is playing: pause or stop it first.', 'warn'); return; }
    if (m === 'teach' && !auto && !S.teaching) { openTeach(); }
    if (m === 'control' && !auto && !controlling) { const d = sdev(); if (d) void call('take', {deviceId: d.id}).then(() => toast('You have control. Click to tap, drag to swipe, wheel to scroll.')); }
    if (!auto && SB.mode === 'control' && m !== 'control' && controlling && !S.teaching) { const d = sdev(); if (d) void call('release', {deviceId: d.id}); }
    SB.mode = m; SB.draw = null;
    document.querySelectorAll('#sbmodes button').forEach(b => { cls(b, 'on', b.dataset.mode === m); if (b.dataset.mode !== 'run') b.disabled = !!l; });
    const st = $('sbstage'); for (const c of ['view', 'control', 'target', 'gesture', 'teach', 'run']) cls(st, 'm-' + c, c === m);
    const f = SB.focus && locate(SB.focus) && locate(SB.focus).step;
    text($('sbhint'), {view: 'View: look only. Pick target or gesture to draw steps; Control to touch the phone yourself.', control: 'Control: click tap · drag swipe · hold press · wheel scroll. Nothing is recorded.',
      target: f && pointKeys(f).length ? 'Click the mirror to set "' + words(f) + '". Nothing is sent to the phone.' : 'Click the mirror to add a Tap there. Nothing is sent to the phone.',
      gesture: f && ['swipe', 'path', 'multiTap'].includes(f.type) ? 'Drag on the mirror to draw "' + words(f) + '".' : 'Drag on the mirror to add a Swipe (a curve becomes a path).',
      teach: S.teaching ? 'Recording: play the app on the mirror. Stop adds what you did as blocks.' : 'Teach: Falcor records what you do on the mirror and adds it as blocks.', run: 'A run is playing. Pause, Stop or Stop after group above.'}[m]);
    sbPins();
  }
  window.sbMode = m => setMode(m, false);
  $('sbmodes').onclick = e => { const b = e.target.closest('[data-mode]'); if (b && !b.disabled) setMode(b.dataset.mode); };
  document.querySelectorAll('[data-sbkey]').forEach(b => b.onclick = () => { if (!controlling) { toast('Choose Control first.', 'warn'); return; } void send({kind: 'key', key: b.dataset.sbkey}); });
  $('sbgridbtn').onclick = () => { void sb('setPrefs', {prefs: {grid: !prefs().grid}}).then(p => { SB.data.prefs = p; sbPins(); }); };
  const pointKeys = s => (BLOCKS().get(s.type) || {params: []}).params.filter(p => p.kind === 'point' && p.key !== 'offset').map(p => p.key);
  // The mouse on the mirror while the Sandbox is open. True: handled here (nothing is sent to the phone).
  window.sbPointer = function (kind, p, e) {
    if (SB.mode === 'control' || SB.mode === 'teach') return false;
    if (SB.pinDrag) return true;
    if (SB.mode === 'run') { if (kind === 'down') toast('A run is playing; the mirror is locked.', 'warn'); return true; }
    if (SB.mode === 'view') { if (kind === 'down') text($('sbhint'), 'View mode: choose Control to touch the phone, or Pick target to set a point.'); return true; }
    if (SB.mode === 'target') { if (kind === 'up') void pickPoint(p); return true; }
    if (SB.mode === 'gesture') {
      if (kind === 'down') { SB.draw = [[p.x, p.y]]; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* fine */ } drawDots(); }
      else if (kind === 'move' && SB.draw) { const last = SB.draw[SB.draw.length - 1]; if (Math.hypot(p.x - last[0], p.y - last[1]) > 0.015 && SB.draw.length < 200) { SB.draw.push([p.x, p.y]); drawDots(); } }
      else if (kind === 'up' && SB.draw) { SB.draw.push([p.x, p.y]); const pts = SB.draw; SB.draw = null; drawDots(); pickGesture(pts); }
      return true;
    }
    return false;
  };
  const r4 = v => Math.round(Math.min(1, Math.max(0, v)) * 10000) / 10000;
  async function pickPoint(p) {
    if (!def()) { toast('Open or create a sequence first.', 'warn'); return; }
    const pnt = [r4(p.x), r4(p.y)], f = SB.focus && locate(SB.focus) && locate(SB.focus).step, keys = f ? pointKeys(f) : [];
    const d = sdev();
    let id = f && f.id;
    if (f && (f.type === 'multiTap' || f.type === 'path')) { edit(() => { const s = locate(id).step; s.params.points = [...(s.params.points || []), pnt].slice(-20); }); }
    else if (f && keys.length) {
      const key = SB.pickKey && keys.includes(SB.pickKey) ? SB.pickKey : f.type === 'swipe' ? (SB.swipeEnd ? 'end' : 'start') : keys[0];
      if (f.type === 'swipe' && !SB.pickKey) SB.swipeEnd = !SB.swipeEnd;
      SB.pickKey = null;
      edit(() => { locate(id).step.params[key] = pnt; if (def().target.rotation === null && d) def().target.rotation = d.rotation; });
    } else { const s = make('tap'); s.params.point = pnt; addBlocks([s]); id = s.id; if (def().target.rotation === null && d) edit(x => { x.target.rotation = d.rotation; }, {merge: 'rot'}); }
    if (!P.reduced()) P.tapMark($('sbpins'), pnt[0] * 100, pnt[1] * 100, false);
    // The control under the point becomes the tap's anchor (it is found again if it moves).
    const st = locate(id) && locate(id).step;
    if (st && st.type === 'tap' && d) {
      const hit = await quiet('controlAt', {deviceId: d.id, x: pnt[0], y: pnt[1]}).catch(() => null);
      if (hit && (hit.text || hit.id) && locate(id)) edit(() => { const s = locate(id).step; s.params.anchor = {text: (hit.text || '').slice(0, 120), id: hit.id || '', mode: (s.params.anchor && s.params.anchor.mode) || 'prefer'}; if (def().target.width === null && hit.width) { def().target.width = hit.width; def().target.height = hit.height; } }, {merge: 'anchor' + id});
    }
  }
  function simplify(pts, n) { if (pts.length <= n) return pts; const out = []; for (let i = 0; i < n; i++) out.push(pts[Math.round(i * (pts.length - 1) / (n - 1))]); return out; }
  function pickGesture(raw) {
    if (!def()) { toast('Open or create a sequence first.', 'warn'); return; }
    const pts = raw.map(p => [r4(p[0]), r4(p[1])]), a = pts[0], b = pts[pts.length - 1];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.02 && pts.length < 4) { void pickPoint({x: a[0], y: a[1]}); return; }
    // How far the stroke strays from the straight line: a curve is a path.
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, off = Math.max(...pts.map(p => Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len));
    const f = SB.focus && locate(SB.focus) && locate(SB.focus).step;
    if (f && f.type === 'swipe') edit(() => { const s = locate(f.id).step; s.params.start = a; s.params.end = b; });
    else if (f && (f.type === 'path' || f.type === 'multiTap')) edit(() => { locate(f.id).step.params.points = simplify(pts, f.type === 'path' ? 8 : 20); });
    else { const s = make(off > 0.06 ? 'path' : 'swipe'); if (s.type === 'path') s.params.points = simplify(pts, 8); else { s.params.start = a; s.params.end = b; } addBlocks([s]); }
    if (!P.reduced()) P.trail($('sbpins'), a[0] * 100, a[1] * 100, b[0] * 100, b[1] * 100);
  }
  function drawDots() { const box = $('sbpins'); box.querySelectorAll('.sbdraw').forEach(x => x.remove()); for (const p of SB.draw || []) { const d = document.createElement('i'); d.className = 'sbdraw'; d.style.left = p[0] * 100 + '%'; d.style.top = p[1] * 100 + '%'; box.appendChild(d); } }
  // The pins: every step with a point, numbered in play order; the selected one white, the next one to run sand.
  window.sbPins = function () {
    const box = $('sbpins'), on = tab === 'sandbox';
    box.hidden = !on; if (!on) return;
    const scr = $('mirrorbox'), img = !$('video').hidden ? $('video') : $('mirror');
    const iw = Number(img.dataset.w) || img.width || 9, ih = Number(img.dataset.h) || img.height || 20, r = scr.getBoundingClientRect();
    if (!r.width) return;
    const s = Math.min(r.width / iw, r.height / ih), w = iw * s, h = ih * s;
    Object.assign(box.style, {left: (r.width - w) / 2 + 'px', top: (r.height - h) / 2 + 'px', width: w + 'px', height: h + 'px', opacity: String(prefs().overlay || 1)});
    cls(box, 'grid', !!prefs().grid);
    const l = liveRun(), nextId = l && SB.seq && l.sequenceId === SB.seq.id ? l.stepId : null, locked = SB.mode === 'run';
    let html = '', n = 0;
    const arrow = (a, b, next) => { const dx = (b[0] - a[0]) * w, dy = (b[1] - a[1]) * h; return '<i class="sbarrow' + (next ? ' next' : '') + '" data-style="left:' + a[0] * 100 + '%;top:' + a[1] * 100 + '%;width:' + Math.hypot(dx, dy).toFixed(1) + 'px;transform:rotate(' + Math.atan2(dy, dx).toFixed(3) + 'rad)"></i>'; };
    const pin = (st, key, p, label, idx) => '<b class="pin' + (SB.sel.includes(st.id) ? ' sel' : '') + (st.id === nextId ? ' next' : '') + (st.enabled === false ? ' dim' : '') + (locked ? ' locked' : '') + '" data-pin="' + esc(st.id) + '" data-key="' + key + '"' + (idx !== undefined ? ' data-i="' + idx + '"' : '') + ' data-style="left:' + p[0] * 100 + '%;top:' + p[1] * 100 + '%" title="' + esc(words(st)) + '">' + esc(label) + '</b>';
    if (SB.seq) for (const st of flat()) {
      if (!POINTS.includes(st.type)) continue;
      n++; const p = st.params;
      if (st.type === 'swipe' && p.start && p.end) html += (prefs().arrows !== false ? arrow(p.start, p.end, st.id === nextId) : '') + pin(st, 'start', p.start, n) + pin(st, 'end', p.end, '›');
      else if ((st.type === 'path' || st.type === 'multiTap') && Array.isArray(p.points)) { p.points.forEach((q, i) => { if (st.type === 'path' && i && prefs().arrows !== false) html += arrow(p.points[i - 1], q, st.id === nextId); html += pin(st, 'points', q, i ? n + '.' + (i + 1) : n, i); }); }
      else if (p.point) html += pin(st, 'point', p.point, n);
    }
    // Keep the drawing dots and marks (they are not part of the pins' html).
    const keep = [...box.querySelectorAll('.sbdraw, .tapx, .trail')];
    if (box.dataset.h !== html) { box.dataset.h = html; box.innerHTML = html; P.fix(box); for (const k of keep) box.appendChild(k); }
  };
  // Pins can be dragged to move a point (one undo step); the inspector follows.
  $('sbpins').addEventListener('pointerdown', e => {
    const p = e.target.closest('.pin'); if (!p || SB.mode === 'run') return;
    e.stopPropagation(); e.preventDefault();
    SB.pinDrag = {id: p.dataset.pin, key: p.dataset.key, i: p.dataset.i, el: p, moved: false};
    if (SB.focus !== p.dataset.pin) { SB.focus = p.dataset.pin; SB.sel = [p.dataset.pin]; drawSteps(); drawInsp(); }
    p.setPointerCapture(e.pointerId);
  });
  $('sbpins').addEventListener('pointermove', e => {
    const d = SB.pinDrag; if (!d) return;
    const r = $('sbpins').getBoundingClientRect(), x = r4((e.clientX - r.left) / r.width), y = r4((e.clientY - r.top) / r.height);
    d.el.style.left = x * 100 + '%'; d.el.style.top = y * 100 + '%'; d.to = [x, y]; d.moved = true;
  });
  $('sbpins').addEventListener('pointerup', () => {
    const d = SB.pinDrag; SB.pinDrag = null; if (!d || !d.moved) return;
    edit(() => { const s = locate(d.id).step; if (d.key === 'points') s.params.points[Number(d.i)] = d.to; else s.params[d.key] = d.to; });
  });

  // Where the mirror lives: in the Sandbox's stage while the Sandbox is open, under the Phone tab otherwise.
  window.sbPlace = function (t) {
    const devEl = $('device'), host = t === 'sandbox' ? $('sbstage') : $('stage');
    if (devEl.parentElement !== host) host.appendChild(devEl);
    if (t !== 'sandbox') { devEl.hidden = false; $('offtag').hidden = true; $('sbpins').hidden = true; }
    else { void load(); setMode(SB.mode === 'run' || SB.mode === 'teach' ? SB.mode : controlling ? 'control' : SB.mode, true); }
    setTimeout(fitDevice, 0);
    if (t === 'sandbox') { draw(); poll(); }
  };
  // Teach records into the open sequence (app.js's Teach form asks first).
  window.sbRecordTarget = () => SB.seq ? {id: SB.seq.id, title: def().title} : null;
  window.sbBeforeTeach = async () => { if (!SB.seq) return null; if (SB.dirty) await save({silent: true}); return SB.seq.id; };
  window.sbAfterTeach = async r => {
    if (r.error) { toast('The recorded blocks were not added: ' + r.error, 'bad'); return; }
    if (SB.seq && SB.seq.id === r.sequenceId) {
      const before = new Set(flat().map(s => s.id));
      await open(r.sequenceId, {keepSel: true, discardDraft: true});
      const added = flat().filter(s => !before.has(s.id));
      SB.sel = added.map(s => s.id); draw();
      for (const s of added) { const el = $('sbsteps').querySelector('.blk[data-id="' + s.id + '"]'); if (el && !P.reduced()) el.classList.add('dropin'); }
      if (added[0]) { const el = $('sbsteps').querySelector('.blk[data-id="' + added[0].id + '"]'); if (el) el.scrollIntoView({block: 'nearest', inline: 'nearest'}); }
    }
    toast(r.added ? 'Added ' + r.added + ' block' + (r.added === 1 ? '' : 's') + ' from what you showed (version ' + r.revision + '). Press Preview to watch them play.' + (r.skipped.length ? ' Left out: ' + r.skipped.join(', ') + '.' : '') : 'Nothing to add: no touches were recorded in the app.', r.added ? 'ok' : 'warn');
    setMode('view', true);
  };

  // ------------------------------------------------------------------ the header's buttons
  $('sbtitle').oninput = e => { if (def()) edit(d => { d.title = e.target.value.slice(0, 80) || 'Untitled'; }, {merge: 'title', insp: false}); };
  $('sbdev').onchange = e => { deviceId = e.target.value; if (def() && e.target.value) edit(d => { d.target.deviceId = e.target.value; }, {merge: 'dev'}); render(); };
  $('sbnew').onclick = () => newSheet(); $('sbopen').onclick = () => openSheet();
  $('sbsave').onclick = () => save(); $('sbsaveas').onclick = () => saveAs();
  $('sbundo').onclick = undo; $('sbredo').onclick = redo;
  $('sbtest').onclick = () => start('test'); $('sbpreview').onclick = () => start('preview'); $('sbstart').onclick = () => start('run');
  $('sbpause').onclick = () => { const l = liveRun(); if (!l) return; const paused = l.status === 'PAUSED' || l.status === 'NEEDS_ATTENTION'; void ctl(paused ? 'resume' : 'pause', paused ? 'Resumed.' : 'Paused. Resume or Stop when you are ready.')(); };
  $('sbskip').onclick = ctl('skip', 'Skipped that step.'); $('sbstop').onclick = ctl('stop', 'Stopped.'); $('sbafter').onclick = ctl('stopAfterGroup', 'It stops when this group or loop ends.');
  // Schedules are the Daily Queue's (queue.js#openScheduler, the same editor as Games and Tasks).
  const schedule = async () => { if (!SB.seq) { toast('Open a sequence first.', 'warn'); return; } if (SB.dirty) await save({silent: true}); openScheduler({target: {type: 'sequence', id: SB.seq.id}, name: def().title, kind: 'sequence'}); };
  $('sbsched').onclick = schedule; $('sbprefs').onclick = () => prefsSheet(); $('sbhelp').onclick = () => helpSheet();
  $('sbqueue').onclick = async () => { if (!SB.seq) return; if (SB.dirty) await save({silent: true}); const d = sdev(); await call('queue', {op: 'add', target: {type: 'sequence', id: SB.seq.id}, deviceId: d && d.id}); toast('Added to today\'s queue: it runs in its turn while Autopilot runs (or press Run Ready on the Phone tab).'); };
  $('sbsavetask').onclick = async () => { if (!SB.seq) return; await save({silent: true, force: SB.dirty}); await call('queue', {op: 'saveAsTask', id: SB.seq.id, on: true}); await refresh(); toast('Saved, and listed in Tasks with Run now, Schedule and its history.'); };
  window.sbOpen = id => load().then(() => open(id));
  window.addEventListener('keydown', e => {
    if (tab !== 'sandbox' || $('sbsheet').hidden === false && e.key !== 'Escape') return;
    if (e.key === 'Escape' && !$('sbsheet').hidden) { closeSheet(); return; }
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod && k === 's') { e.preventDefault(); void save(); return; }
    if (mod && k === 'enter') { e.preventDefault(); void start('run'); return; }
    if (mod && k === 'n') { e.preventDefault(); newSheet(); return; }
    if (mod && k === 'o') { e.preventDefault(); openSheet(); return; }
    if (typing() || document.activeElement === $('mirrorbox') && controlling) return;
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (mod && (k === 'y' || k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    else if (mod && k === 'c') { e.preventDefault(); copySel(false); }
    else if (mod && k === 'x') { e.preventDefault(); copySel(true); }
    else if (mod && k === 'v') { e.preventDefault(); paste(); }
    else if (mod && k === 'd') { e.preventDefault(); duplicate(); }
    else if (mod && k === 'g') { e.preventDefault(); group(); }
    else if (mod && k === 'a') { e.preventDefault(); SB.sel = flat().map(s => s.id); draw(); }
    else if (k === 'delete' || k === 'backspace') { e.preventDefault(); removeSel(); }
    else if (e.altKey && (k === 'arrowup' || k === 'arrowleft')) { e.preventDefault(); nudgeOrder(-1); }
    else if (e.altKey && (k === 'arrowdown' || k === 'arrowright')) { e.preventDefault(); nudgeOrder(1); }
    else if (!mod && (k === 'arrowleft' || k === 'arrowright' || k === 'arrowup' || k === 'arrowdown')) { const ids = flat().map(s => s.id); if (!ids.length) return; e.preventDefault(); const i = ids.indexOf(SB.focus), j = Math.max(0, Math.min(ids.length - 1, i < 0 ? 0 : i + (k === 'arrowleft' || k === 'arrowup' ? -1 : 1))); select(ids[j], {shiftKey: e.shiftKey}); }
    else if (!mod && k === 'e' && SB.focus) { edit(() => { const s = locate(SB.focus).step; if (s.enabled === false) delete s.enabled; else s.enabled = false; }); }
    else if (!mod && k === 't') void start('test');
    else if (!mod && ({v: 'view', c: 'control', p: 'target', g: 'gesture', r: 'teach'})[k]) setMode(({v: 'view', c: 'control', p: 'target', g: 'gesture', r: 'teach'})[k]);
    else if (e.key === '?') helpSheet();
    else if (k === 'escape') { if (SB.mode === 'target' || SB.mode === 'gesture') setMode('view'); else { SB.sel = []; SB.focus = null; draw(); } }
  });

  // ------------------------------------------------------------------ sheets
  function sheet(html, wire) { const b = $('sbsheetbody'); b.innerHTML = html; P.fix(b); numbers(b); $('sbsheet').hidden = false; b.classList.remove('stepin'); void b.offsetWidth; b.classList.add('stepin'); if (wire) wire(b); const f = b.querySelector('input, select, button.primary'); if (f) f.focus(); }
  function closeSheet() { $('sbsheet').hidden = true; $('sbsheetbody').innerHTML = ''; }
  $('sbsheet').addEventListener('mousedown', e => { if (e.target === $('sbsheet')) closeSheet(); });
  const head = (eye, title) => '<div class="top"><div><p class="eyebrow">// ' + esc(eye) + '</p><h2>' + esc(title) + '</h2></div><button class="ghost icon" data-close title="Close">' + icon('close') + '</button></div>';
  $('sbsheetbody').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });

  function newSheet() {
    if (!SB.cat) return;
    const d = sdev(), tpl = [['blank', 'Blank', 'Start with nothing.'], ['starter', 'Example', SB.cat.starter.description], ...SB.cat.presets.map(p => [p.id, p.name, p.help || ''])];
    let pick = 'blank';
    sheet(head('NEW SEQUENCE', 'New sequence') + '<div class="grid2"><label>Name<input id="sbnname" maxlength="80" placeholder="e.g. Morning check-in"></label>' + '<label>Phone<select id="sbndev">' + S.devices.map(x => '<option value="' + esc(x.id) + '"' + (d && x.id === d.id ? ' selected' : '') + '>' + esc(x.label) + '</option>').join('') + '<option value="">No phone yet (a draft)</option></select></label></div>'
      + '<p class="eyebrow">// START FROM</p><div class="opts" id="sbntpl">' + tpl.map(([id, n, h]) => '<button type="button" class="opt' + (id === pick ? ' on' : '') + '" data-tpl="' + esc(id) + '"><b>' + esc(n) + '</b><small>' + esc(h) + '</small></button>').join('') + '</div>'
      + '<p class="muted small">Or press Teach after creating it and show Falcor on the mirror: what you do becomes blocks.</p><div class="row"><button class="primary" id="sbncreate">' + icon('plus') + 'Create</button><button data-close>Cancel</button></div>', b => {
      b.querySelector('#sbntpl').onclick = e => { const o = e.target.closest('[data-tpl]'); if (!o) return; pick = o.dataset.tpl; b.querySelectorAll('.opt').forEach(x => cls(x, 'on', x === o)); };
      b.querySelector('#sbncreate').onclick = async () => {
        if (SB.dirty && !confirmLeave()) return;
        const r = await sb('create', {title: b.querySelector('#sbnname').value, deviceId: b.querySelector('#sbndev').value || null, template: pick});
        closeSheet(); await refresh(); await open(r.id); toast('Created. Add blocks from the library, pick points on the mirror, then Preview.');
      };
    });
  }
  function confirmLeave() { return window.confirm('Your changes to "' + def().title + '" are not saved. Leave them? (They stay as a draft for this sequence.)'); }
  function openSheet() {
    if (!SB.data) return;
    let q = '', sort = local.get('sort', 'updated'), folder = '';
    const draw = b => {
      const L = SB.data.sequences.filter(s => (!q || (s.title + ' ' + s.description + ' ' + s.folder).toLowerCase().includes(q)) && (!folder || s.folder === folder))
        .sort((a, c) => (c.favorite - a.favorite) || (sort === 'name' ? a.title.localeCompare(c.title) : sort === 'last' ? (c.lastRunAt || 0) - (a.lastRunAt || 0) : sort === 'next' ? (a.nextRunAt || Infinity) - (c.nextRunAt || Infinity) : c.updatedAt - a.updatedAt));
      b.querySelector('#sbolist').innerHTML = L.map(s => '<li class="' + (s.running ? 'run' : '') + '" data-id="' + esc(s.id) + '"><button class="ghost icon small" data-act="star" title="Star">' + icon('star', s.favorite ? 'sand' : '') + '</button><div><b>' + esc(s.title) + '</b>' + (s.folder ? ' <span class="chipcode">' + esc(s.folder) + '</span>' : '') + '<div class="meta">' + s.steps + ' steps · about ' + fmtMs(s.estimateMs) + ' · v' + s.revision + (s.lastRun ? ' · last ' + esc(s.lastRun.status.toLowerCase()) + ' ' + new Date(s.lastRun.at).toLocaleString() : ' · never run') + (s.nextRunAt ? ' · next ' + new Date(s.nextRunAt).toLocaleString() : '') + '</div></div>'
        + '<div class="row"><button class="small primary" data-act="start" title="Run it now">' + icon('play') + '</button><button class="small" data-act="edit">Edit</button><button class="small icon" data-act="sched" title="Schedule">' + icon('calendar') + '</button><button class="small icon" data-act="clone" title="Clone">' + icon('copy') + '</button><button class="small icon" data-act="folder" title="Folder">' + icon('tasks') + '</button><button class="small icon danger" data-act="del" title="Delete">' + icon('trash') + '</button></div></li>').join('') || '<li class="muted small">No sequences' + (q ? ' match' : ' yet') + '.</li>';
      P.fix(b);
    };
    const folders = [...new Set(SB.data.sequences.map(s => s.folder).filter(Boolean))];
    sheet(head('MY SEQUENCES', 'My sequences') + '<div class="row"><input id="sboq" placeholder="Search" class="grow"><select id="sbosort"><option value="updated">Last edited</option><option value="name">Name</option><option value="last">Last run</option><option value="next">Next run</option></select>' + (folders.length ? '<select id="sbofolder"><option value="">All folders</option>' + folders.map(f => '<option>' + esc(f) + '</option>').join('') + '</select>' : '') + '</div>'
      + '<ul class="seqlist" id="sbolist"></ul><div class="row"><button class="primary small" id="sbonew">' + icon('plus') + 'New</button><button class="small" id="sboimport">' + icon('export') + 'Import .json</button><span class="grow"></span><span class="muted small">' + SB.data.schedules.filter(s => s.enabled).length + ' schedules on · ' + SB.data.runs.length + ' recent runs</span></div>', b => {
      b.querySelector('#sbosort').value = sort; draw(b);
      b.querySelector('#sboq').oninput = e => { q = e.target.value.toLowerCase(); draw(b); };
      b.querySelector('#sbosort').onchange = e => { sort = e.target.value; local.set('sort', sort); draw(b); };
      const fsel = b.querySelector('#sbofolder'); if (fsel) fsel.onchange = e => { folder = e.target.value; draw(b); };
      b.querySelector('#sbonew').onclick = () => newSheet();
      b.querySelector('#sboimport').onclick = async () => { const r = await sb('import'); if (r) { await refresh(); closeSheet(); await open(r.id); toast('Imported. Check the app and points before you run it.'); } };
      b.querySelector('#sbolist').onclick = async e => {
        const a = e.target.closest('[data-act]'), li = e.target.closest('li[data-id]'); if (!a || !li) return;
        const id = li.dataset.id, s = SB.data.sequences.find(x => x.id === id);
        if (a.dataset.act === 'edit') { if (SB.dirty && SB.seq && SB.seq.id !== id && !confirmLeave()) return; closeSheet(); await open(id); }
        if (a.dataset.act === 'start') { const d = sdev(); if (!d) { toast('Plug in the phone first.', 'warn'); return; } const r = await sb('start', {id, deviceId: d.id}); toast('Running "' + s.title + '" (version ' + r.revision + ').'); closeSheet(); if (!SB.seq || SB.seq.id !== id) await open(id); }
        if (a.dataset.act === 'sched') { closeSheet(); if (!SB.seq || SB.seq.id !== id) await open(id); schedule(); }
        if (a.dataset.act === 'clone') { await sb('clone', {id}); await refresh(); draw(b); toast('Cloned.'); }
        if (a.dataset.act === 'star') { await sb('meta', {id, favorite: !s.favorite}); await refresh(); draw(b); }
        if (a.dataset.act === 'folder') { const inpEl = P.el('<input maxlength="40" placeholder="Folder name, Enter to keep" value="' + esc(s.folder) + '">'); a.replaceWith(inpEl); inpEl.focus(); inpEl.onkeydown = async ev => { if (ev.key === 'Enter') { await sb('meta', {id, folder: inpEl.value}); await refresh(); draw(b); } if (ev.key === 'Escape') { ev.stopPropagation(); draw(b); } }; }
        if (a.dataset.act === 'del') { if (!window.confirm('Delete "' + s.title + '"? Its schedules turn off. Run logs are kept.')) return; await sb('remove', {id}); local.set('draft.' + id, null); if (SB.seq && SB.seq.id === id) { SB.seq = null; local.set('last', null); } await refresh(); draw(b); renderAll(); }
      };
    });
  }
  function renderAll() { draw(); }
  function historySheet() {
    if (!SB.seq) return;
    const runs = SB.data.runs.filter(r => r.sequenceId === SB.seq.id);
    sheet(head('HISTORY', def().title) + '<p class="eyebrow">// VERSIONS</p><ul class="seqlist">' + SB.seq.revisions.map(v => '<li><span>v' + v.number + '</span><div class="meta">' + new Date(v.at).toLocaleString() + (v.number === SB.seq.revision.number ? ' · current' : '') + '</div><div class="row">' + (v.number !== SB.seq.revision.number ? '<button class="small" data-rev="' + esc(v.id) + '">Restore</button>' : '') + '</div></li>').join('') + '</ul>'
      + '<p class="eyebrow">// RUNS</p><ul class="seqlist">' + (runs.map(r => '<li><span>' + esc(r.status.toLowerCase()) + '</span><div class="meta">' + new Date(r.startedAt).toLocaleString() + ' · v' + r.revision + ' · ' + esc(r.reason || '') + ' · ' + (r.actions || 0) + ' actions</div><div class="row"><button class="small" data-log="' + esc(r.id) + '">Log</button></div></li>').join('') || '<li class="muted small">Not run yet.</li>') + '</ul>', b => {
      b.onclick = async e => {
        const rv = e.target.closest('[data-rev]'); if (rv) { if (SB.dirty && !confirmLeave()) return; const r = await sb('restore', {id: SB.seq.id, revisionId: rv.dataset.rev}); closeSheet(); await open(SB.seq.id, {discardDraft: true}); toast('Restored as version ' + r.number + '.'); }
        const lg = e.target.closest('[data-log]'); if (lg) { closeSheet(); SB.logRun = lg.dataset.log; SB.view = 'log'; document.querySelectorAll('#sbviews button').forEach(x => cls(x, 'on', x.dataset.v === 'log')); draw(); poll(); }
      };
    });
  }
  function presetSheet() {
    const ids = SB.sel.length ? SB.sel : SB.focus ? [SB.focus] : []; const steps = ids.map(id => locate(id)).filter(Boolean).map(l => l.step).filter((s, i, all) => !all.some(o => o !== s && inside(o, s.id)));
    if (!steps.length) { toast('Select the steps to keep as a preset.', 'warn'); return; }
    sheet(head('PRESET', 'Save as preset') + '<label>Name<input id="sbpname" maxlength="60" value="' + esc(steps.length === 1 ? words(steps[0]) : '') + '"></label><label>What it does (optional)<input id="sbphelp" maxlength="200"></label><p class="muted small">' + steps.length + ' step' + (steps.length === 1 ? '' : 's') + '. It shows in the library under My presets.</p><div class="row"><button class="primary" id="sbpsave">Save preset</button><button data-close>Cancel</button></div>', b => {
      b.querySelector('#sbpsave').onclick = async () => { await sb('presetSave', {name: b.querySelector('#sbpname').value, help: b.querySelector('#sbphelp').value, icon: (BLOCKS().get(steps[0].type) || {}).icon, steps}); SB.cat = await sb('catalog'); SB.libCat = 'mine'; drawLib(); closeSheet(); toast('Preset saved.'); };
    });
  }

  function prefsSheet() {
    const p = prefs();
    const chk = (k, l) => '<label class="check"><input type="checkbox" data-pref="' + k + '"' + (p[k] ? ' checked' : '') + '> ' + esc(l) + '</label>';
    sheet(head('SANDBOX SETTINGS', 'Settings') + '<div class="grid2">' + chk('grid', 'Grid over the mirror') + chk('arrows', 'Arrows for swipes and paths') + chk('autosave', 'Keep unsaved changes as a draft') + chk('trail', 'Show touch trails') + '</div>'
      + '<div class="grid3"><label>Pins\' opacity<input type="number" data-pref="overlay" min="0.2" max="1" step="0.1" value="' + p.overlay + '"></label><label>New Wait (ms)<input type="number" data-pref="defaultWaitMs" min="50" max="600000" value="' + p.defaultWaitMs + '"></label><label>New long press (ms)<input type="number" data-pref="defaultHoldMs" min="400" max="8000" value="' + p.defaultHoldMs + '"></label>'
      + '<label>New swipe (ms)<input type="number" data-pref="gestureMs" min="50" max="3000" value="' + p.gestureMs + '"></label><label>New sequences: on error<select data-pref="onError"><option value="review">pause for me</option><option value="stop">stop</option><option value="skip">skip the step</option></select></label><label>New sequences: max run (min)<input type="number" data-pref="maxRunMin" min="1" max="360" value="' + p.maxRunMin + '"></label>'
      + '<label>Run log<select data-pref="logLevel"><option value="steps">steps</option><option value="actions">every action</option></select></label><label>Pictures kept per run<input type="number" data-pref="keepShots" min="0" max="500" value="' + p.keepShots + '"></label><label>Time zone<input data-pref="tz" value="' + esc(p.tz || '') + '"></label></div>'
      + '<div class="row"><button class="primary" id="sbprefsave">Save settings</button><button data-close>Close</button></div>', b => {
      b.querySelector('[data-pref="onError"]').value = p.onError; b.querySelector('[data-pref="logLevel"]').value = p.logLevel;
      b.querySelector('#sbprefsave').onclick = async () => {
        const out = {}; for (const el of b.querySelectorAll('[data-pref]')) out[el.dataset.pref] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
        if (!out.tz) delete out.tz;
        SB.data.prefs = await sb('setPrefs', {prefs: out}); closeSheet(); sbPins(); toast('Settings saved.');
      };
    });
  }
  function helpSheet() {
    const keys = [['Ctrl+S', 'Save a new version'], ['Ctrl+Z / Ctrl+Y', 'Undo / redo (100 steps)'], ['Ctrl+C / X / V / D', 'Copy, cut, paste, duplicate'], ['Ctrl+G', 'Group the selected steps'], ['Delete', 'Delete the selected steps'], ['← → ↑ ↓', 'Select the previous / next step (Shift adds)'], ['Alt+↑ / Alt+↓', 'Move the step'], ['E', 'Turn the step on or off'], ['T', 'Test the selected step'], ['Ctrl+Enter', 'Save and start'], ['V C P G R', 'View, Control, Pick target, Pick gesture, Teach'], ['Esc', 'Cancel picking / clear the selection'], ['Ctrl+Shift+X', 'Emergency Stop (everything)']];
    sheet(head('HELP', 'Sandbox') + '<p class="eyebrow">// FIVE STEPS</p><ol class="walk"><li><b>New</b>: name it and pick the phone (or start from the example or a preset).</li><li><b>Add blocks</b>: click or drag them from the library. Taps and swipes ask for a point: click or drag on the mirror (nothing is sent to the phone while picking).</li><li><b>Or Teach</b>: press Teach and use the app on the mirror; Stop adds what you did as blocks.</li><li><b>Test step / Preview</b>: watch it on the phone; Pause, Stop and Stop after group are always at the top.</li><li><b>Save, Run now or Schedule</b>: every save is a version; a schedule puts it in the Daily Queue (it runs while Autopilot runs, or by itself with Automatic Start).</li></ol>'
      + '<p class="eyebrow">// SHORTCUTS</p><div class="keys">' + keys.map(([k, v]) => '<kbd>' + esc(k) + '</kbd><span>' + esc(v) + '</span>').join('') + '</div>'
      + '<p class="eyebrow">// IF SOMETHING IS WRONG</p><ul class="walk"><li>A tap lands in the wrong place: the screen may have turned, or the button moved. Give the tap an anchor (Pick sets one from the button under the point) or use Tap by label.</li><li>It pauses with "needs you": a sign-in, payment, code or permission screen came up. Those are always yours. Do it on the phone, then Resume.</li><li>"Input unavailable": unlock the phone and allow USB debugging. Falcor never unlocks it.</li><li>The queue says missed: the phone was not ready or Autopilot was off while its start window was open.</li><li>Some blocks are greyed out: the phone link does not offer them (the reason is on the block).</li></ul><div class="row"><button class="primary" data-close>Got it</button></div>');
  }

  // ------------------------------------------------------------------ run log
  async function drawLog() {
    const box = $('sblog'); if (!SB.seq) { box.innerHTML = ''; return; }
    const runs = (SB.data ? SB.data.runs : []).filter(r => r.sequenceId === SB.seq.id).slice(0, 12), l = liveRun();
    if (!SB.logRun && runs[0]) { SB.logRun = runs[0].id; poll(); }
    const evs = SB.eventsFor === SB.logRun ? SB.events : [];
    const html = '<div class="runs">' + (l && l.sequenceId === SB.seq.id && !runs.some(r => r.id === l.runId) ? '<button class="small on" data-run="' + esc(l.runId) + '">now</button>' : '') + runs.map(r => '<button class="small' + (r.id === SB.logRun ? ' on' : '') + '" data-run="' + esc(r.id) + '">' + esc(new Date(r.startedAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})) + ' · ' + esc(r.status.toLowerCase()) + '</button>').join('') + '</div>'
      + (evs.length ? '<ol>' + evs.slice(-300).map(e => '<li><time>' + new Date(e.at).toLocaleTimeString([], {hour12: false}) + '</time><span class="t-' + esc(e.type) + '">' + esc(e.type) + '</span><span>' + esc(e.text) + (e.ms !== undefined ? ' · ' + fmtMs(e.ms) : '') + '</span>' + (e.shot ? '<img data-shot="' + esc(e.shot) + '" alt="">' : '<span></span>') + '</li>').join('') + '</ol>' : '<p class="muted small">' + (runs.length ? 'Loading…' : 'No runs yet. Press Preview or Start.') + '</p>');
    if (box.dataset.h !== html) { const stick = box.scrollTop + box.clientHeight >= box.scrollHeight - 8; box.dataset.h = html; box.innerHTML = html; if (stick) box.scrollTop = box.scrollHeight; }
    for (const img of box.querySelectorAll('img[data-shot]:not([src])')) { const id = img.dataset.shot; const u = shots.get(id) || await quiet('shot', {shotId: id}).catch(() => null); if (u) { shots.set(id, u); img.src = u; } }
  }
  const shots = new Map();
  $('sblog').onclick = e => {
    const b = e.target.closest('[data-run]'); if (b) { SB.logRun = b.dataset.run; SB.events = []; drawLog(); poll(); return; }
    const i = e.target.closest('img[data-shot]'); if (i && i.src) sheet(head('SCREENSHOT', 'From the run') + '<img src="' + esc(i.src) + '" alt="" data-style="max-width:100%;max-height:70vh;image-rendering:auto">');
  };

  // Installed apps for the app fields.
  const dl = document.createElement('datalist'); dl.id = 'sbapps'; document.body.appendChild(dl);
  setInterval(() => { const d = sdev(); if (!d || tab !== 'sandbox') return; const html = Object.entries(d.installedNames || {}).map(([p, n]) => '<option value="' + esc(p) + '">' + esc(n) + '</option>').join(''); if (dl.dataset.h !== html) { dl.dataset.h = html; dl.innerHTML = html; } }, 3000);
  setInterval(() => { if (tab === 'sandbox' && S) drawHead(); }, 1000);
})();

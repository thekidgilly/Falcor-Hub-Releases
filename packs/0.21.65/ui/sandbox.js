// Falcor.Hub's Sandbox tab: build a sequence from blocks on the live mirror, test it, run it, schedule it. Loaded after
// app.js and uses its helpers (S, call, toast, go, send, the mirror). Everything is checked again on the computer's side
// (sandbox/index.ts): this page only edits a draft, and nothing runs until the owner presses Play sequence or Test step.
(function () {
  const SB = {cat: null, data: null, seq: null, dirty: false, sel: [], focus: null, undo: [], redo: [], merge: '', mergeAt: 0,
    mode: 'build', view: 'flow', insp: 'basic', draw: null, drag: null, pinDrag: null, libCat: 'all', libQ: '',
    check: null, error: '', loading: null, live: null, events: [], eventsFor: '', logRun: null, wasLive: null, folded: new Set(), deviceSeen: new Set()};
  const workspace = document.querySelector('section[data-pane="sandbox"]');
  function setFocus(on) {
    workspace.classList.toggle('studio-focus', on);
    $('sbfocus').setAttribute('aria-pressed', String(on));
    $('sbfocus').textContent = on ? 'Exit focus' : 'Focus';
    requestAnimationFrame(() => fitDevice());
  }
  $('sbfocus').onclick = () => setFocus(!workspace.classList.contains('studio-focus'));
  $('sbpanels').onclick = () => { workspace.classList.toggle('studio-panels-hidden'); requestAnimationFrame(() => fitDevice()); };
  new ResizeObserver(() => { if (!workspace.hidden) requestAnimationFrame(() => fitDevice()); }).observe($('sbtl'));
  const BLOCKS = () => new Map((SB.cat ? SB.cat.blocks : []).map(b => [b.type, b]));
  const CATS = {ai: 'AI', touch: 'Touch and gesture', app: 'App and device', flow: 'Time and flow', screen: 'Screen aware'};
  const KEYS = ['BACK', 'HOME', 'APP_SWITCH', 'ENTER', 'DEL', 'TAB', 'ESCAPE'], KEYNAME = {BACK: 'Back', HOME: 'Home', APP_SWITCH: 'Recent apps', ENTER: 'Enter', DEL: 'Delete', TAB: 'Tab', ESCAPE: 'Escape'};
  const POINTS = ['tap', 'doubleTap', 'longPress', 'swipe', 'path', 'multiTap'];
  const local = {get(k, d) { try { const v = localStorage.getItem('sb.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { if (v === null) localStorage.removeItem('sb.' + k); else localStorage.setItem('sb.' + k, JSON.stringify(v)); } catch { /* private window */ } }};
  const sb = (op, a = {}) => call('sandbox', {op, ...a});
  const quiet = (op, a = {}) => window.hub.call('sandbox', {op, ...a});
  const def = () => SB.seq && SB.seq.def;
  const newId = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const prefs = () => (SB.data && SB.data.prefs) || {};
  const sdev = () => S && (S.devices.find(x => x.id === deviceId) || S.devices[0]) || null;
  let buildQueue = Promise.resolve(), buildPending = 0, buildPointer = null;

  // ------------------------------------------------------------------ words (the same as sandbox/schema.ts#words)
  const fmtMs = ms => { ms = Number(ms) || 0; if (ms < 1000) return ms + ' ms'; if (ms < 60000) return (Math.round(ms / 100) / 10) + ' s'; if (ms < 3600000) { const m = Math.floor(ms / 60000), s = Math.round((ms % 60000) / 1000); return m + ' min' + (s ? ' ' + s + ' s' : ''); } const h = Math.floor(ms / 3600000), m = Math.round((ms % 3600000) / 60000); return h + ' h' + (m ? ' ' + m + ' min' : ''); };
  const pt = p => Array.isArray(p) ? Math.round(p[0] * 100) + '%, ' + Math.round(p[1] * 100) + '%' : '?';
  const dirOf = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); };
  const condWords = c => !c ? '…' : c.kind === 'text' ? 'the screen ' + (c.present !== false ? 'says' : 'no longer says') + ' "' + (c.text || '…') + '"' : c.kind === 'control' ? '"' + (c.text || '…') + '" is on screen' : c.kind === 'app' ? (c.packageName || '…') + ' is in front' : c.kind === 'var' ? c.name + ' ' + c.op + ' ' + c.value : 'the screen changed';
  function words(s) {
    if (s.label) return s.label;
    const p = s.params || {};
    switch (s.type) {
      case 'falcorRequest': return 'Falcor: ' + String(p.prompt || 'Write your instructions').slice(0, 100);
      case 'tap': return 'Tap ' + (p.anchor && p.anchor.text && p.anchor.mode !== 'off' ? '"' + p.anchor.text + '"' : 'at ' + pt(p.point));
      case 'doubleTap': return 'Double tap at ' + pt(p.point);
      case 'longPress': return 'Long press at ' + pt(p.point) + ' for ' + fmtMs(p.durationMs);
      case 'swipe': return 'Swipe ' + (p.start && p.end ? dirOf(p.start, p.end) : '');
      case 'path': return 'Draw a path through ' + (p.points || []).length + ' points';
      case 'scroll': return 'Scroll ' + p.direction + (Number(p.amount) > 1 ? ' ×' + p.amount : '');
      case 'multiTap': return 'Tap ' + (p.points || []).length + ' points in order';
      case 'key': return 'Press ' + (KEYNAME[p.key] || p.key);
      case 'typeText': { const n = String(p.text || '').length; return 'Enter text (' + n + ' character' + (n === 1 ? '' : 's') + ')'; }
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
  function appName(pkg) { if (!pkg) return ''; const d = sdev(); return (d && d.installedNames && d.installedNames[pkg]) || (/^[\w.]+\.\w+$/.test(pkg) ? pkg.split('.').pop().replace(/[_-]+/g, ' ').replace(/^\w/, c => c.toUpperCase()) : pkg); }
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
      if (!SB.seq && SB.home === undefined) SB.home = 'start';   // (the owner, 2026-10-21: the tab opens on the start box, never on Drafts)
      draw();
    })();
    return SB.loading.catch(() => { SB.loading = null; });
  }
  async function refresh() { SB.data = await quiet('list').catch(() => SB.data); if (SB.home) { if (tab === 'sandbox') drawHome(true); return; } drawHead(); drawLib(); }
  async function open(id, o = {}) {
    await buildQueue;
    const g = await sb('get', {id});
    SB.seq = {id: g.id, title: g.title, def: g.definition, revision: g.revision, revisions: g.revisions, meta: g.meta};
    SB.check = {warnings: g.warnings, estimate: g.estimate}; SB.error = '';
    SB.undo = []; SB.redo = []; SB.dirty = false; SB.merge = '';
    each(g.definition.steps, s => { if (s.type === 'group') SB.folded.add(s.id); });
    if (!o.keepSel) { SB.sel = []; SB.focus = null; } else keepSel();
    if (g.definition.target.deviceId && S && S.devices.some(x => x.id === g.definition.target.deviceId)) deviceId = g.definition.target.deviceId;
    local.set('last', g.id);
    const draft = local.get('draft.' + g.id, null);
    if (draft && !o.discardDraft && draft.revision === g.revision.number && JSON.stringify(draft.def) !== JSON.stringify(g.definition)) { SB.seq.def = draft.def; SB.dirty = true; toast('Your unsaved changes to "' + g.title + '" are back. Save keeps them; Undo is empty.', 'warn'); }
    else local.set('draft.' + g.id, null);
    SB.events = []; SB.eventsFor = ''; SB.logRun = null; SB.home = null;
    if (!S.teaching && !liveRun()) setMode('build', true);
    if (!o.keepSel) {
      if (!window.sbWindows?.isMinimized('sblib')) window.sbWorkspace?.openDrawer('blocks', !flat().length);
      if (!window.sbWindows?.isMinimized('sbinsp')) window.sbWorkspace?.openDrawer('settings', false);
    }
    window.sbWorkspace?.resetView();
    if ((o.newWorkspace || !flat().length) && !window.sbWindows?.isMinimized('sbinsights')) window.sbWindows?.show('sbinsights', true);
    draw();
  }
  async function save(o = {}) {
    await buildQueue;
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
    await refresh(); await open(r.id); toast('Saved as a new chain. Rename it at the top.');
  }

  // ------------------------------------------------------------------ the phone's state and runs
  function liveRun() { const d = sdev(); return d && d.sandbox ? d.sandbox : null; }
  async function start(mode) {
    await buildQueue;
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
    go('phone');
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
    drawHead(); drawRunbar(); marks(); devFrame(d); drawInsights();
    text($('sbteachlbl'), S.teaching ? 'End Teach' : 'Teach'); cls($('sbteach'), 'on', !!S.teaching);
    $('sbteach').disabled = SB.ending || !!l || (!S.teaching && !d);
  };
  function devFrame(d) {
    const devEl = $('device');
    cls(devEl, 'control', controlling && !S.teaching); cls(devEl, 'recording', !!S.teaching); cls(devEl, 'falcor-acting', !!(d && d.control && d.control.kind === 'agent'));
    $('devtag').hidden = !(controlling || S.teaching || liveRun()); text($('devtag'), S.teaching ? '● REC' : liveRun() ? 'SANDBOX RUN' : 'YOU HAVE CONTROL');
    renderMirrorState(d);
    cls($('sbstage'), 'offline', false); $('offtag').hidden = true;
    $('sbnophone').hidden = true;
    $('device').hidden = false;
  }
  function draw(o = {}) {
    if (tab !== 'sandbox') return;
    drawHome(); if (SB.home) return;
    drawHead(); drawSteps(); if (o.insp !== false) drawInsp(); drawSum(); sbPins(); drawRunbar(); marks();
    if (SB.view === 'log') drawLog();
  }
  function drawHead() {
    const d = sdev(), q = SB.seq;
    if (document.activeElement !== $('sbtitle')) $('sbtitle').value = q ? def().title : '';
    $('sbtitle').disabled = !q; $('sbdirty').hidden = !SB.dirty; text($('sbrev'), q ? 'v' + q.revision.number + (SB.dirty ? ' · unsaved' : '') : '');
    htmlOnce($('sbdev'), (S.devices.length ? S.devices : [{id: '', label: 'No phone'}]).map(x => '<option value="' + esc(x.id) + '"' + (d && x.id === d.id ? ' selected' : '') + '>' + esc(x.label) + '</option>').join(''));
    // Connection and rotation (the picture's age is gone: the owner found it noise, and it redrew the header every second).
    if (d) SB.deviceSeen.add(d.id);
    const conn = !d ? (SB.deviceSeen.size ? ['bad', 'Disconnected'] : ['bad', 'No phone']) : !d.connected ? ['warn', 'Reconnecting'] : !d.authorized ? ['bad', 'Input unavailable · allow USB debugging'] : d.locked ? ['warn', 'Input unavailable · unlock it'] : d.emergency ? ['bad', 'Emergency Stop'] : ['ok', 'Connected'];
    htmlOnce($('sbchips'), '<span class="' + conn[0] + '"><i class="led ' + (conn[0] === 'ok' ? 'on' : conn[0]) + '"></i>' + esc(conn[1]) + '</span>'
      + (d ? '<span>' + (d.rotation % 2 ? 'Landscape' : 'Portrait') + '</span>' : '')
      + (q && def().target.rotation !== null && d && def().target.rotation !== d.rotation ? '<span class="warn">Drawn ' + (def().target.rotation % 2 ? 'landscape' : 'portrait') + '</span>' : ''));
    const l = liveRun(), mine = l && q && l.sequenceId === q.id && l.runId !== SB.resetRunId;
    for (const id of ['sbsave', 'sbsaveas', 'sbtest', 'sbpublish']) $(id).disabled = !q;
    // A draft can be played by hand; only a published one (in the Library) can be scheduled or queued.
    const mineRow = q && SB.data ? SB.data.sequences.find(x => x.id === q.id) : null, isPub = !!(mineRow && mineRow.published);
    htmlOnce($('sbpublish'), icon('check') + (isPub ? 'In Library' : 'Publish to Library')); cls($('sbpublish'), 'done', isPub);
    htmlOnce($('sbsave'), icon('check') + (isPub ? 'Save changes' : 'Save draft'));
    $('sbsave').title = isPub ? 'Save changes to this published chain (Ctrl+S)' : 'Save this draft without publishing (Ctrl+S)';
    $('sbpublish').title = isPub ? 'Published: it is in the Library. Click to unpublish it.' : 'Put it in the Library, where it can be scheduled';
    $('sbsave').disabled = !q || !SB.dirty; $('sbundo').disabled = !SB.undo.length; $('sbredo').disabled = !SB.redo.length;
    $('sbtest').hidden = !!l;
    const cannotPlay = !q || !flat().length || !d || !d.connected || !d.authorized || d.locked || !!S.teaching || !!(d && (d.running || d.emergency));
    $('sbtest').disabled = cannotPlay || !SB.focus;
    for (const id of ['sbafter', 'sbskip']) $(id).hidden = !mine;
    if (mine) $('sbskip').hidden = l.status !== 'NEEDS_ATTENTION';
    $('sbplayback').querySelector('.sbplayeroptions').hidden = !mine;
    const paused = l && (l.status === 'PAUSED' || l.status === 'NEEDS_ATTENTION');
    htmlOnce($('sbplay'), icon('play') + (mine && paused ? 'Resume chain' : 'Play chain'));
    $('sbplay').disabled = l ? !mine || !paused : cannotPlay;
    $('sbpause').disabled = !mine || paused || l.status !== 'RUNNING';
    $('sbplaystop').disabled = !mine && !(SB.runInfo && SB.runInfo.sequenceId === q?.id && SB.resetRunId !== SB.runInfo.id);
    const steps = flat(), at = mine ? steps.findIndex(s => s.id === l.stepId) : -1;
    const ended = !l && SB.runInfo && SB.runInfo.sequenceId === q?.id && SB.runInfo.id !== SB.resetRunId ? SB.runInfo : null;
    text($('sbplaystate'), mine ? (paused ? 'Paused · holding position' : l.status === 'RUNNING' ? 'Playing' : l.status.replaceAll('_', ' ').toLowerCase()) + (at >= 0 ? ' · Block ' + (at + 1) + ' of ' + steps.length : '') : ended?.status === 'COMPLETED' ? 'Complete · Play to start again' : ended ? ended.reason : 'Ready · ' + steps.length + ' blocks');
    $('sbprogress').max = Math.max(1, steps.length);
    $('sbprogress').value = mine ? Math.max(0, at + 1) : ended?.status === 'COMPLETED' ? steps.length : 0;
    setBadge('badge-sandbox', S.sandbox && S.sandbox.live.length ? '▶' : 0);
  }
  function drawRunbar() {
    const active = liveRun(), l = active && SB.seq && active.sequenceId === SB.seq.id && active.runId !== SB.resetRunId ? active : null, r = !l && SB.runInfo && SB.seq && SB.runInfo.sequenceId === SB.seq.id && SB.runInfo.id !== SB.resetRunId ? SB.runInfo : null, x = l || r;
    $('sbrun').hidden = !x; if (!x) return;
    cls($('sbrun'), 'done', !l && x.status === 'COMPLETED'); cls($('sbrun'), 'bad', !l && /FAILED|NEEDS/.test(x.status));
    $('sbrun').firstElementChild.className = 'led ' + (l ? (x.status === 'RUNNING' ? 'on' : 'warn') : x.status === 'COMPLETED' ? 'on' : 'bad');
    text($('sbrunstate'), ({RUNNING: 'RUNNING', PAUSED: 'PAUSED', NEEDS_ATTENTION: 'NEEDS YOU', STARTING: 'STARTING', WAITING_FOR_DEVICE: 'WAITING FOR THE PHONE', COMPLETED: 'COMPLETED', STOPPED: 'STOPPED', FAILED: 'FAILED'})[x.status] || x.status);
    text($('sbrunstep'), (l ? l.step || l.reason : x.reason) || ''); text($('sbruntime'), clock(x.elapsedMs || 0) + ' · ' + (x.actions || 0) + ' actions');
  }
  function drawSum() {
    drawInsights();
    const q = SB.seq; if (!q) { text($('sbsum'), ''); return; }
    const n = flat().length, e = SB.check && SB.check.estimate;
    text($('sbsum'), n + ' step' + (n === 1 ? '' : 's') + (e ? ' · about ' + fmtMs(e.ms) + (e.actions !== null ? ' · ' + e.actions + ' actions' : '') : '') + (SB.error ? ' · ' + SB.error : SB.check && SB.check.warnings && SB.check.warnings.length ? ' · ' + SB.check.warnings.length + ' warning' + (SB.check.warnings.length === 1 ? '' : 's') : ''));
    cls($('sbsum'), 'red', !!SB.error);
  }
  let insightsKey = '', insightsAt = 0, insightsVersion = 0;
  function drawInsights() {
    const box = $('sbinsightsbody'); if (!box) return;
    const definition = def(), key = JSON.stringify([definition, S?.ai]);
    if (key === insightsKey && Date.now() - insightsAt < 15000) return;
    insightsKey = key; insightsAt = Date.now(); const version = ++insightsVersion;
    if (!definition) { box.innerHTML = '<p class="muted small">Open a chain to see its one-run estimate.</p>'; return; }
    htmlOnce(box, '<p class="muted small" role="status">Calculating this draft...</p>');
    quiet('insights', {definition}).then(r => {
      if (version !== insightsVersion || key !== JSON.stringify([def(), S?.ai])) return;
      const money = n => '$' + n.toFixed(n > 0 && n < .01 ? 6 : 4);
      const row = (label, value) => '<div><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>';
      const cost = r.cost ? r.cost.full === 0 ? '$0.00' : money(r.cost.quick) + ' - ' + money(r.cost.full) : 'Not available';
      htmlOnce(box, '<p class="eyebrow">ONE RUN · CURRENT DRAFT</p><strong class="sbinsightcost">' + esc(cost) + '</strong><p class="small muted">Estimated AI/API cost (USD)</p>'
        + '<p class="small">' + esc(r.costReason) + '</p><dl class="sbinsightstats">'
        + row('Gaming model', r.model ? r.model.name + ' · ' + r.model.provider + (r.model.local ? ' · local' : '') : 'Not configured')
        + row('Blocks in this draft', r.blocks)
        + row('Enabled blocks incl. linked chains', r.enabled)
        + row('Falcor request blocks', r.aiBlocks)
        + row('AI decisions scenario', r.calls.full === null ? 'Dynamic / unknown' : r.calls.quick + ' - ' + r.calls.full)
        + row('Rough runtime', r.runtimeMs === null ? 'Unknown' : fmtMs(r.runtimeMs))
        + row('Estimated phone actions', r.actions === null ? 'Dynamic / bounded by cap' : r.actions)
        + row('Chain runtime cap', fmtMs(r.limits.durationMs))
        + row('Chain action cap', r.limits.actions)
        + (r.aiBlocks ? row('Per-block decision maximum', r.limits.maxDecisions) + row('Per-block timeout maximum', fmtMs(r.limits.maxAiTimeoutMs)) : '')
        + (r.model?.price ? row('Price / 1M tokens', '$' + r.model.price.input + ' input · $' + r.model.price.output + ' output')
          + row('Pricing source', r.model.priceSource || 'Provider listing') : '')
        + '</dl><div class="sbinsightnotes">' + r.notes.map(n => '<p class="muted small">' + esc(n) + '</p>').join('') + '</div>');
    }).catch(e => {
      if (version === insightsVersion) htmlOnce(box, '<p class="small red" role="alert">Cannot calculate this draft: ' + esc(errText(e)) + '</p>');
    });
  }

  // ------------------------------------------------------------------ library
  function drawLib() {
    if (!SB.cat) return;
    const favs = local.get('favs', []), recent = local.get('recent', []), q = SB.libQ.toLowerCase();
    htmlOnce($('sbcats'), [['all', 'All'], ['fav', '★'], ['recent', 'Recent'], ['ai', 'AI'], ['touch', 'Touch'], ['app', 'App'], ['flow', 'Flow'], ['screen', 'Screen'], ['presets', 'Presets'], ['mine', 'My presets']].map(([k, n]) => '<button class="small' + (SB.libCat === k ? ' on' : '') + '" data-c="' + k + '">' + n + '</button>').join(''));
    const match = b => !q || (b.name + ' ' + b.help).toLowerCase().includes(q);
    const item = b => '<div class="lib' + (b.unavailable ? ' off' : '') + '" draggable="' + (!b.unavailable) + '" data-type="' + esc(b.type) + '" title="' + esc(b.unavailable || b.help) + '">' + (b.type === 'falcorRequest' ? '<img class="falcor-avatar" src="dragon.png" alt="">' : icon(b.icon)) + '<span>' + esc(b.name) + '</span><button class="fav' + (favs.includes(b.type) ? ' on' : '') + '" data-fav="' + esc(b.type) + '" title="Favourite">' + icon('star') + '</button></div>';
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
    if (!def()) { toast('Open or create a chain first.', 'warn'); return; }
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
    const box = $('sbcontent'), before = P.motion.snapshot(box);
    $('sbsteps').className = 'steps ' + (SB.view === 'tree' ? 'tree' : 'flow') + (SB.drag ? ' dragging' : ''); $('sbsteps').hidden = SB.view === 'log'; $('sblog').hidden = SB.view !== 'log';
    $('sbcanvas').hidden = SB.view === 'log';
    $('sbintro').hidden = !SB.seq || !!def().steps.length;
    if (!SB.seq) { htmlOnce(box, '<div class="empty">No chain open. <button class="small primary" data-do="new">' + icon('plus') + 'New chain</button> <button class="small" data-do="open">' + icon('book') + 'Open</button> <button class="small" data-do="example">Try the example</button></div>'); return; }
    const B = BLOCKS();
    const dz = (into, at) => '<i class="dz" data-into="' + into + '" data-at="' + at + '"></i>';
    const lane = (list, into) => { let h = dz(into, 0); list.forEach((s, i) => { h += block(s, i) + dz(into, i + 1); }); return h; };
    // A card per step: its number, a glowing icon in its kind's colour (touch, app, flow, screen), what it does in its own
    // words, its details, and one line on what this kind of step is for (the catalog's help, first sentence).
    const about = b => String(b.help || '').split(/(?<=\.)\s/)[0].slice(0, 90);
    const block = (s, i) => {
      const b = B.get(s.type) || {icon: 'sandbox', name: s.type, cat: 'flow', help: ''};
      const card = '<div class="blk cat-' + esc(b.cat || 'flow') + (s.type === 'falcorRequest' ? ' falcor-request' : '') + (SB.sel.includes(s.id) ? ' sel' : '') + (s.enabled === false ? ' off' : '') + (s.color ? ' c-' + s.color : '') + '" data-id="' + esc(s.id) + '" role="button" tabindex="0" aria-pressed="' + SB.sel.includes(s.id) + '" aria-label="Step ' + (i + 1) + ': ' + esc(words(s) + (meta(s) ? ', ' + meta(s) : '')) + '" draggable="true" title="' + esc(b.name + (s.note ? ' · ' + s.note : '')) + '">'
        + '<span class="bn">' + String(i + 1).padStart(2, '0') + '</span><span class="bico"><span class="tile">' + (s.type === 'falcorRequest' ? '<img class="falcor-avatar" src="dragon.png" alt="">' : icon(s.type === 'key' ? ({HOME: 'home', BACK: 'back', APP_SWITCH: 'apps', ENTER: 'check', DEL: 'close'})[s.params && s.params.key] || b.icon : b.icon)) + '</span></span><span class="w">' + esc(s.type === 'group' && s.label ? s.label : b.name) + '</span><span class="boverview">' + esc(words(s)) + '</span><span class="m">' + esc(s.type === 'group' ? (s.children || []).length + ' actions inside' : words(s)) + '</span><span class="bd">' + esc(meta(s) === b.name ? about(b) : meta(s)) + '</span>'
        + (s.type === 'falcorRequest' ? '<span class="falcor-magic" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' : '') + '</div>';
      if (!b.group) return card;
      if (SB.folded.has(s.id)) return '<div class="grp" data-g="' + esc(s.id) + '">' + card + '</div>';
      return '<div class="grp" data-g="' + esc(s.id) + '">' + card + '<div class="lane" data-l="' + (b.group === 'branch' ? 'THEN' : 'DO') + '">' + lane(s.children || [], s.id + ':children') + '</div>' + (b.group === 'branch' ? '<div class="lane" data-l="ELSE">' + lane(s.else || [], s.id + ':else') + '</div>' : '') + '</div>';
    };
    htmlOnce(box, def().steps.length ? lane(def().steps, 'root') : dz('root', 0));
    P.motion.settle(box, before);
  }
  // The run's marks: the step being played glows, done steps tick, a failed one flashes red.
  function marks() {
    const box = $('sbsteps'); if (!box || !SB.seq) return;
    const active = liveRun(), l = active?.runId === SB.resetRunId ? null : active, mine = (l && l.sequenceId === SB.seq.id) || (SB.runInfo && SB.runInfo.id !== SB.resetRunId && SB.runInfo.sequenceId === SB.seq.id && SB.eventsFor === SB.runInfo.id);
    if (l && l.sequenceId === SB.seq.id) {
      let expanded = false;
      for (const id of SB.folded) { const group = locate(id)?.step; if (group && group.id !== l.stepId && inside(group, l.stepId)) { SB.folded.delete(id); expanded = true; } }
      if (expanded) drawSteps();
    }
    const done = new Set(), fail = new Set();
    if (mine) for (const e of SB.events) { if (e.type === 'done' && e.stepId) { done.add(e.stepId); fail.delete(e.stepId); } if (e.type === 'fail' && e.stepId) fail.add(e.stepId); }
    for (const el of box.querySelectorAll('.blk')) {
      const id = el.dataset.id;
      cls(el, 'now', !!(l && l.sequenceId === SB.seq.id && l.stepId === id)); cls(el, 'done', done.has(id)); cls(el, 'fail', fail.has(id));
      if (l && l.sequenceId === SB.seq.id && l.stepId === id) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
    }
    const now = l && box.querySelector('.blk.now'); if (now && SB.follow !== l.stepId) { SB.follow = l.stepId; now.scrollIntoView({block: 'nearest', inline: 'center'}); }
    sbPins();
  }
  $('sbviews').onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; SB.view = b.dataset.v; $('sbviews').querySelectorAll('button').forEach(x => cls(x, 'on', x === b)); draw(); poll(); };
  $('sbsteps').addEventListener('click', e => {
    const doit = e.target.closest('[data-do]'); if (doit) { ({new: newSheet, open: openSheet, example: () => sb('create', {template: 'starter', deviceId: sdev() ? sdev().id : null}).then(r => refresh().then(() => open(r.id)))})[doit.dataset.do](); return; }
    const el = e.target.closest('.blk'); if (!el) { if (e.target === $('sbsteps') || e.target === $('sbcontent')) { SB.sel = []; SB.focus = null; draw(); } return; }
    select(el.dataset.id, e);
  });
  $('sbsteps').addEventListener('keydown', e => {
    const el = e.target.closest('.blk'); if (!el || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault(); select(el.dataset.id, e);
  });
  function select(id, e = {}) {
    if (e.ctrlKey || e.metaKey) SB.sel = SB.sel.includes(id) ? SB.sel.filter(x => x !== id) : [...SB.sel, id];
    else if (e.shiftKey && SB.focus) { const ids = flat().map(s => s.id), a = ids.indexOf(SB.focus), b = ids.indexOf(id); SB.sel = ids.slice(Math.min(a, b), Math.max(a, b) + 1); }
    else SB.sel = [id];
    SB.focus = id; window.sbWorkspace?.openDrawer('settings', true); draw(); if (e.type === 'keydown') $('sbsteps').querySelector('.blk[data-id="' + id + '"]')?.focus({preventScroll: true});
  }
  import('./sandbox-menu.js').then(({mountSandboxMenu}) => mountSandboxMenu($('sbsteps'), e => {
    const block = e.target.closest('.blk[data-id]'), target = block && locate(block.dataset.id);
    if (target) {
      if (!SB.sel.includes(target.step.id)) SB.sel = [target.step.id];
      SB.focus = target.step.id;
      $('sbsteps').querySelectorAll('.blk').forEach(el => {
        const selected = SB.sel.includes(el.dataset.id); cls(el, 'sel', selected); el.setAttribute('aria-pressed', String(selected));
      });
      drawInsp(); sbPins();
      const move = delta => edit(() => {
        const found = locate(target.step.id); if (!found) return;
        found.list.splice(found.i, 1); found.list.splice(found.i + delta, 0, found.step);
      });
      return {title: SB.sel.length > 1 ? SB.sel.length + ' selected blocks' : (BLOCKS().get(target.step.type)?.name || target.step.type), items: [
        {label: 'Block details', run: () => window.sbWorkspace?.openDrawer('settings', true)},
        {label: 'Test block on phone', disabled: !!liveRun() || !!S.teaching || !!buildPending, run: () => start('test')},
        {label: 'Duplicate', run: duplicate},
        {label: target.step.enabled === false ? 'Enable selected blocks' : 'Disable selected blocks', run: () => edit(() => {
          const enabled = target.step.enabled === false;
          for (const id of SB.sel) { const found = locate(id); if (found) found.step.enabled = enabled; }
        })},
        {label: 'Move up', disabled: SB.sel.length !== 1 || target.i === 0, run: () => move(-1)},
        {label: 'Move down', disabled: SB.sel.length !== 1 || target.i === target.list.length - 1, run: () => move(1)},
        {label: 'Delete selected blocks', danger: true, run: removeSel}
      ]};
    }
    return {title: 'Workspace', items: [
      {label: 'Block catalog', run: () => window.sbWorkspace?.openDrawer('blocks', true)},
      {label: 'Build with Falcor', run: () => $('sbai').click()},
      {label: 'Undo', disabled: !SB.undo.length, run: undo},
      {label: 'Redo', disabled: !SB.redo.length, run: redo},
      {label: 'Reset canvas zoom', run: () => $('sbzoomreset').click()},
      {label: 'Reset tool layout', run: () => $('sbwindowsreset').click()}
    ]};
  })).catch(e => toast('Could not load workspace menu: ' + errText(e), 'bad'));
  // Drag to reorder (several selected move together), and drop library blocks into place.
  $('sbsteps').addEventListener('dragstart', e => { const el = e.target.closest('.blk'); if (!el || SB.mode === 'run') { e.preventDefault(); return; } const id = el.dataset.id; SB.drag = {ids: SB.sel.includes(id) ? SB.sel.slice() : [id]}; e.dataTransfer.setData('text/plain', 'sandbox'); e.dataTransfer.effectAllowed = 'move'; el.classList.add('drag-source'); setTimeout(() => $('sbsteps').classList.add('dragging'), 0); });
  let dragPoint = null, dragFrame = 0, dragTick = 0;
  function dragScroll(time) {
    if (!SB.drag || !dragPoint) return;
    const box = $('sbsteps'), r = box.getBoundingClientRect(), p = dragPoint;
    const dt = Math.min(32, time - dragTick || 16); dragTick = time;
    const speed = (v, lo, hi) => v < lo + 44 ? -Math.min(1, (lo + 44 - v) / 44) : v > hi - 44 ? Math.min(1, (v - hi + 44) / 44) : 0;
    if (p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom) {
      box.scrollLeft += speed(p.x, r.left, r.right) * dt * .65;
      box.scrollTop += speed(p.y, r.top, r.bottom) * dt * .65;
      const z = dropZone({target: document.elementFromPoint(p.x, p.y) || box, clientX: p.x, clientY: p.y});
      box.querySelectorAll('.dz.hot').forEach(x => x !== z && x.classList.remove('hot')); if (z) z.classList.add('hot');
    }
    dragFrame = requestAnimationFrame(dragScroll);
  }
  $('sbsteps').addEventListener('dragover', e => {
    if (!SB.drag) return; e.preventDefault(); e.dataTransfer.dropEffect = SB.drag.ids ? 'move' : 'copy';
    dragPoint = {x: e.clientX, y: e.clientY};
    if (!dragFrame) { dragTick = 0; dragFrame = requestAnimationFrame(dragScroll); }
    const z = dropZone(e); $('sbsteps').querySelectorAll('.dz.hot').forEach(x => x !== z && x.classList.remove('hot')); if (z) z.classList.add('hot');
  });
  $('sbsteps').addEventListener('drop', e => {
    e.preventDefault(); const z = dropZone(e), d = SB.drag; endDrag(); if (!d || !def() || !z) return;
    const where = {into: z.dataset.into, at: Number(z.dataset.at)};
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
    const card = e.target.closest('.blk');
    if (card) {
      const holder = card.parentElement.classList.contains('grp') ? card.parentElement : card, r = card.getBoundingClientRect();
      const after = SB.view === 'tree' ? e.clientY > (r.top + r.bottom) / 2 : e.clientX > (r.left + r.right) / 2;
      const slot = after ? holder.nextElementSibling : holder.previousElementSibling;
      if (slot?.classList.contains('dz') && valid(slot)) return slot;
    }
    let best = null, distance = 48;
    for (const z of $('sbsteps').querySelectorAll('.dz')) {
      if (!valid(z)) continue;
      const r = z.getBoundingClientRect();
      const d = Math.hypot(Math.max(r.left - e.clientX, 0, e.clientX - r.right), Math.max(r.top - e.clientY, 0, e.clientY - r.bottom));
      if (d < distance) { best = z; distance = d; }
    }
    return best || (e.target === $('sbsteps') || e.target === $('sbcontent') || e.target.closest('.empty') ? [...$('sbsteps').querySelectorAll('.dz[data-into="root"]')].filter(valid).at(-1) : null);
  }
  function endDrag() { cancelAnimationFrame(dragFrame); dragFrame = 0; dragPoint = null; $('sbsteps').querySelectorAll('.drag-source').forEach(x => x.classList.remove('drag-source')); SB.drag = null; $('sbsteps').classList.remove('dragging'); $('sbsteps').querySelectorAll('.dz.hot').forEach(x => x.classList.remove('hot')); }
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
      case 'text':
        if (s.type === 'falcorRequest' && spec.key === 'prompt') return '<label>' + esc(spec.label) + '<textarea rows="5" maxlength="2000" data-k="' + k + '" placeholder="Describe what Falcor should do on the current screen...">' + esc(v || '') + '</textarea></label><p class="help">Current app only. Uses your gaming AI model and budget. Never include passwords or private information. Write a clear Done when goal below; add required screen words for an independent text check.</p>';
        return s.type === 'typeText' ? '<label>' + esc(spec.label) + '<textarea rows="2" maxlength="500" data-k="' + k + '">' + esc(v || '') + '</textarea></label><p class="help">Never put a password here: the log shows only how many characters.</p>' : inp(k, spec.label, v, ' maxlength="' + (spec.max || 200) + '"');
      case 'pkg': return inp(k, spec.label, v, ' list="sbapps" placeholder="com.example.app"');
      case 'key': return sel(k, spec.label, v, KEYS.map(x => [x, KEYNAME[x]]));
      case 'dir': return sel(k, spec.label, v, ['up', 'down', 'left', 'right']);
      case 'select': return sel(k, spec.label, v, spec.options);
      case 'name': return inp(k, spec.label, v, ' maxlength="24"');
      case 'bool': return '<label class="check"><input type="checkbox" data-k="' + k + '"' + (v ? ' checked' : '') + '>' + esc(spec.label) + '</label>';
      case 'seq': return sel(k, spec.label, v, [['', 'Pick a chain'], ...(SB.data ? SB.data.sequences.filter(q => q.id !== SB.seq.id).map(q => [q.id, q.title]) : [])]);
      case 'condition': return condField(v);
      case 'anchor': { const a = v || {text: '', id: '', mode: 'prefer'}; return '<div class="pair">' + inp('p.anchor.text', 'Anchor (control label)', a.text, ' maxlength="120" placeholder="none"') + sel('p.anchor.mode', 'If it moved', a.mode || 'prefer', [['prefer', 'tap the control, else the point'], ['require', 'stop if it is not there'], ['off', 'tap the point only']]) + '</div><p class="help">' + esc(spec.help || '') + '</p>'; }
    }
    return '';
  }
  function drawInsp() {
    const box = $('sbinspbody'), s = SB.focus && locate(SB.focus) && locate(SB.focus).step;
    $('sbinsptabs').querySelectorAll('button').forEach(b => cls(b, 'on', b.dataset.t === SB.insp));
    $('sbinsptabs').hidden = !s;
    if (!SB.seq) { text($('sbinsptitle'), '// SANDBOX'); box.innerHTML = '<p class="muted small">A chain is a list of blocks Falcor plays on the phone, step by step, through the same safety gate as Autopilot: never a purchase, a payment, an ad or a private screen.</p><div class="row"><button class="primary small" data-do="new">' + icon('plus') + 'New chain</button><button class="small" data-do="open">' + icon('book') + 'Open</button></div>'; return; }
    if (!s) {
      const d = def(), st = d.settings, w = SB.check && SB.check.warnings || [], e = SB.check && SB.check.estimate;
      text($('sbinsptitle'), '// CHAIN');
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
        + sel('onError', 'If it fails', s.onError || 'inherit', [['inherit', 'as the chain says'], ['review', 'pause for me'], ['stop', 'stop the run'], ['skip', 'skip it']])
        + sel('expect.kind', 'Expected result', s.expect ? s.expect.kind : '', [['', 'none'], ['changed', 'the screen changes'], ['text', 'the screen says…'], ['gone', 'words disappear…']])
        + (s.expect && s.expect.kind !== 'changed' ? inp('expect.text', 'Words', s.expect.text, ' maxlength="120"') : '') + (s.expect ? msField('expect.timeoutMs', 'Within', s.expect.timeoutMs) : '')
        + sel('color', 'Colour', s.color || '', [['', 'none'], 'green', 'sand', 'red', 'blue', 'grey'])
        + '<label>Note<textarea rows="2" maxlength="300" data-k="note">' + esc(s.note || '') + '</textarea></label>';
    }
    if (SB.error) h += '<p class="err">' + esc(SB.error) + '</p>';
    // Reteach from here: this step and the ones after it are replaced by what the owner shows next (top-level steps only).
    const at = locate(s.id), top = !!at && at.list === def().steps;
    if (b.group) h += '<button class="small" data-do="fold">' + (SB.folded.has(s.id) ? 'Show actions inside' : 'Fold into one block') + '</button>';
    h += '<div class="reteach"><button class="sbteachbtn" data-do="reteach"' + (top && !S.teaching && !liveRun() ? '' : ' disabled') + ' title="' + esc(top ? 'Remove this step and the ones after it, then show Falcor again from here' : 'Reteach works on steps outside groups and loops') + '">' + icon('rec') + 'Reteach from here</button>'
      + '<p class="muted small">' + (top ? 'Steps ' + (at.i + 1) + ' to ' + def().steps.length + ' are replaced by what you show. Teach starts at once, from the screen the phone is on now (no Home step).' : 'Reteach works on steps outside groups and loops.') + '</p></div>';
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
    ({fold: () => { if (SB.folded.has(SB.focus)) SB.folded.delete(SB.focus); else SB.folded.add(SB.focus); draw(); }, test: () => start('test'), reteach: () => reteach(SB.focus), dup: duplicate, group, del: removeSel, preset: presetSheet, sched: () => schedule(), history: historySheet, export: () => sb('export', {id: SB.seq.id}).then(ok => ok && toast('Exported.')), new: newSheet, open: openSheet})[d.dataset.do]();
  });

  // ------------------------------------------------------------------ the mirror: modes, picking, pins
  function setMode(m, auto) {
    if (m === SB.mode && !auto) { if (m === 'target' || m === 'gesture') return; }
    const l = liveRun();
    if (l && m !== 'run') { if (!auto) toast('A run is playing: pause or stop it first.', 'warn'); return; }
    if (S.teaching && m !== 'teach') { if (!auto) toast('End Teach before changing the phone mode.', 'warn'); return; }
    if (buildPending && !auto) { toast('Wait for the phone action to finish before changing modes.', 'warn'); return; }
    if (m === 'teach' && !auto) { void toggleTeach(); return; }
    if (m === 'control' && !auto && !controlling) { const d = sdev(); if (d) void call('take', {deviceId: d.id}).then(() => toast('You have control. Click to tap, drag to swipe, wheel to scroll.')); }
    if (!auto && ['control', 'build'].includes(SB.mode) && !['control', 'build'].includes(m) && controlling && !S.teaching) { const d = sdev(); if (d) void call('release', {deviceId: d.id}); }
    SB.mode = m; SB.draw = null;
    $('sbmodes').querySelectorAll('button').forEach(b => { cls(b, 'on', b.dataset.mode === m); if (b.dataset.mode !== 'run') b.disabled = !!l || !!S.teaching; });
    const st = $('sbstage'); for (const c of ['build', 'view', 'control', 'target', 'gesture', 'teach', 'run']) cls(st, 'm-' + c, c === m);
    const f = SB.focus && locate(SB.focus) && locate(SB.focus).step;
    text($('sbhint'), {build: 'Build: use the phone. Each tap, swipe, key or typed text adds a block to the grid. Nothing plays automatically.', view: 'View: look only. Build adds actions as blocks; Control uses the phone without adding blocks.', control: 'Control: click tap · drag swipe · hold press · wheel scroll. Nothing is recorded.',
      target: f && pointKeys(f).length ? 'Click the mirror to set "' + words(f) + '". Nothing is sent to the phone.' : 'Click the mirror to add a Tap there. Nothing is sent to the phone.',
      gesture: f && ['swipe', 'path', 'multiTap'].includes(f.type) ? 'Drag on the mirror to draw "' + words(f) + '".' : 'Drag on the mirror to add a Swipe (a curve becomes a path).',
      teach: S.teaching ? 'Recording: play the app on the mirror. Stop adds what you did as blocks.' : 'Teach: Falcor records what you do on the mirror and adds it as blocks.', run: 'A run is playing. Pause or Stop beside the blocks; Stop after group is in the toolbar.'}[m]);
    sbPins();
  }
  window.sbMode = m => setMode(m, false);
  $('sbmodes').onclick = e => { const b = e.target.closest('[data-mode]'); if (b && !b.disabled) setMode(b.dataset.mode); };
  document.querySelectorAll('[data-sbkey]').forEach(b => b.onclick = () => {
    if (SB.mode === 'build') { buildAction({kind: 'key', key: b.dataset.sbkey}); return; }
    if (!['control', 'teach'].includes(SB.mode) || !controlling) { toast('Choose Build or Control first.', 'warn'); return; }
    void send({kind: 'key', key: b.dataset.sbkey});
  });
  $('sbgridbtn').onclick = () => { void sb('setPrefs', {prefs: {grid: !prefs().grid}}).then(p => { SB.data.prefs = p; sbPins(); }); };
  const pointKeys = s => (BLOCKS().get(s.type) || {params: []}).params.filter(p => p.kind === 'point' && p.key !== 'offset').map(p => p.key);
  // The mouse on the mirror while the Sandbox is open. True: handled here (nothing is sent to the phone).
  window.sbPointer = function (kind, p, e) {
    if (SB.mode === 'build') {
      if (kind === 'down' && e.button === 0) {
        buildPointer = {x: p.x, y: p.y, at: Date.now(), pointer: e.pointerId};
        $('mirrorbox').focus({preventScroll: true});
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (kind === 'up' && buildPointer?.pointer === e.pointerId) {
        const from = buildPointer; buildPointer = null;
        const ms = Date.now() - from.at, moved = Math.hypot(p.x - from.x, p.y - from.y);
        const action = moved > .03 ? {kind: 'swipe', x: from.x, y: from.y, toX: p.x, toY: p.y, ms: Math.min(2000, Math.max(120, ms))}
          : from.y >= .935 && !document.body.classList.contains('phone-landscape') && ms <= 600 ? {kind: 'key', key: from.x < .37 ? 'APP_SWITCH' : from.x > .63 ? 'BACK' : 'HOME'}
          : ms > 600 ? {kind: 'long_press', x: from.x, y: from.y, ms: Math.min(3000, ms)} : {kind: 'tap', x: from.x, y: from.y};
        buildAction(action);
      } else if (kind === 'cancel') buildPointer = null;
      return true;
    }
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
  window.sbBuildAction = action => {
    if (tab !== 'sandbox' || SB.mode !== 'build') return false;
    buildAction(action); return true;
  };
  window.sbManualMode = () => SB.mode === 'control' || SB.mode === 'teach';
  function buildAction(action) {
    const q = SB.seq, d = sdev();
    if (!q || SB.home || !d) { toast('Open a chain and connect a phone before building from its mirror.', 'warn'); return; }
    if (liveRun() || S.teaching || SB.pendingTeach) { toast('Finish playback or the pending Teach review before building.', 'warn'); return; }
    buildPending++;
    buildQueue = buildQueue.then(async () => {
      if (SB.seq !== q || tab !== 'sandbox' || SB.mode !== 'build') throw new Error('Phone action cancelled because the workspace changed. No block was added.');
      const status = await quietStatus();
      const phone = status.devices.find(x => x.id === d.id);
      if (!phone?.connected || !phone.authorized || phone.locked || phone.emergency || phone.teaching || phone.running || phone.sandbox || status.teaching) throw new Error('The phone is not ready for Build. Finish Teach or playback and unlock it first.');
      if (!phone?.control || phone.control.kind !== 'human') await window.hub.call('take', {deviceId: d.id});
      controlling = true;
      // Use the existing acknowledged Human input path. A refused action never becomes a successful-looking block.
      await window.hub.call('input', {deviceId: d.id, action});
      if (SB.seq !== q) throw new Error('The workspace closed before the phone action completed.');
      const type = {tap: 'tap', long_press: 'longPress', swipe: 'swipe', scroll: 'scroll', key: 'key', type: 'typeText'}[action.kind];
      if (!type) throw new Error('This phone action cannot be represented as a block.');
      const step = make(type), p = step.params, point = [r4(action.x), r4(action.y)];
      if (type === 'tap' || type === 'longPress') p.point = point;
      if (type === 'longPress') p.durationMs = action.ms;
      if (type === 'swipe') { p.start = point; p.end = [r4(action.toX), r4(action.toY)]; p.durationMs = action.ms; }
      if (type === 'scroll') { p.direction = action.direction; p.amount = 1; }
      if (type === 'key') p.key = action.key;
      if (type === 'typeText') p.text = action.text;
      const last = def().steps.at(-1);
      if (type === 'typeText' && last?.type === 'typeText' && String(last.params.text).length + action.text.length <= 2000) {
        edit(() => { last.params.text += action.text; }, {merge: 'build-type-' + last.id});
      } else addBlocks([step], {into: 'root', at: def().steps.length});
      text($('sbhint'), 'Added ' + words(step) + '. Keep using the phone to build the next block.');
      nextFrame(0);
    }).catch(e => { toast('Build: ' + errText(e) + ' No new block was saved for this action.', 'bad'); })
      .finally(() => { buildPending--; });
  }
  const quietStatus = () => window.hub.call('status');
  const r4 = v => Math.round(Math.min(1, Math.max(0, v)) * 10000) / 10000;
  async function pickPoint(p) {
    if (!def()) { toast('Open or create a chain first.', 'warn'); return; }
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
    if (!def()) { toast('Open or create a chain first.', 'warn'); return; }
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
    else { void load(); setMode(SB.mode, true); }
    setTimeout(fitDevice, 0);
    if (t === 'sandbox') { draw(); poll(); }
  };
  // Teach records into the open sequence (app.js's Teach form asks first).
  window.sbRecordTarget = () => SB.seq && !SB.home ? {id: SB.seq.id, title: def().title} : null;
  window.sbBeforeTeach = async () => { if (!SB.seq) return null; if (SB.dirty) await save({silent: true}); return SB.seq.id; };

  // ------------------------------------------------------------------ Teach → a run, in one press each way
  // Recorded lessons: Falcor watches the phone on the mirror at once, no form. It records into the open
  // sequence while that is still empty, else into a new one. End Teach stops it: a progress bar follows the engine's real
  // stages (engine.ts#teachWork), then the panel says what Falcor saw (the app, taps, typing, pauses, swipes) beside the
  // blocks it built in the timeline, where each can be edited, moved or deleted, and Save to Library names and keeps it.
  const pause = ms => new Promise(r => setTimeout(r, ms));
  async function toggleTeach() { if (SB.ending) return; window.sbWindows?.show('sbteachtools', true); if (S.teaching) await endTeach(); else await beginTeach(); }
  // Reteach from a step: it and the steps after it are removed (a new version, so History can bring them back), then
  // Teach starts at once on the screen the phone is on, without going Home and without opening the app again; End Teach
  // adds what was shown where the removed steps were.
  async function reteach(stepId) {
    const d = sdev(); if (!d) { toast('Plug in the phone first.', 'warn'); return; }
    if (liveRun() || S.teaching) return;
    const at = locate(stepId); if (!at || at.list !== def().steps) return;
    const n = def().steps.length - at.i;
    if (!window.confirm('Reteach from step ' + (at.i + 1) + '? ' + n + ' step' + (n === 1 ? '' : 's') + ' (this one and after) will be replaced by what you show next. History keeps the old version.')) return;
    edit(x => { x.steps.splice(at.i); }); SB.sel = []; SB.focus = null; SB.reteachFrom = at.i + 1;
    await save({force: true, silent: true});
    $('sbtaught').hidden = true;
    try { S.teaching = await call('teachStart', {deviceId: d.id, name: '', intent: '', home: false, sandbox: {sequenceId: SB.seq.id, launch: false, waits: true, check: true}}); } catch { return; }
    window.sbWindows?.show('sbteachtools', true);
    setMode('teach', true); render(); draw();
    $('mirrorbox').focus();
    toast('Reteaching from step ' + (at.i + 1) + ': carry on from this screen on the mirror. Press End Teach when you are done.');
  }
  async function beginTeach() {
    await buildQueue;
    const d = sdev(); if (!d) { toast('Plug in the phone first.', 'warn'); return; }
    if (liveRun()) { toast('A run is playing: pause or stop it first.', 'warn'); return; }
    SB.reteachFrom = null;
    let id = SB.seq && !SB.home && !flat().length ? SB.seq.id : null;
    if (id && SB.dirty) await save({silent: true});
    if (!id) {
      if (SB.seq && SB.dirty && !confirmLeave()) return;
      const r = await sb('create', {title: 'Taught run ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}), deviceId: d.id, template: 'blank'});
      await refresh(); await open(r.id); id = r.id;
    }
    $('sbtaught').hidden = true;
    // (the phone goes to its home screen first, and the run will start there too)
    try { S.teaching = await call('teachStart', {deviceId: d.id, name: '', intent: '', home: true, sandbox: {sequenceId: id, launch: true, waits: true, check: true}}); } catch { return; }
    setMode('teach', true); render();
    $('mirrorbox').focus();
    toast('Teaching from the home screen: open an app on the mirror, then tap, swipe, type. Press End Teach when you are done.');
  }
  function workHtml(stage, pct) {
    return '<p class="eyebrow">// ANALYZING YOUR RECORDING</p><h2>' + icon('rec') + 'Building your run</h2><div class="tbar"><i id="sbtbar"></i></div><p class="small" id="sbtstage">' + esc(stage) + '</p>';
  }
  async function endTeach() {
    SB.ending = true; render();
    const box = $('sbtaught'); box.innerHTML = '<p class="eyebrow">// STOPPING TEACH</p><h2>' + icon('stop') + 'Saving your recording</h2><p class="muted small">The recording is kept on this computer until you choose to analyze or discard it.</p>'; box.hidden = false;
    try {
      const r = await call('teachStop', {deferSandbox: true});
      S.teaching = null; SB.pendingTeach = r.pending || null; SB.ending = false;
      setMode('view', true); await refresh();
      if (SB.pendingTeach) showTeachDecision();
      else { box.innerHTML = '<p class="eyebrow">// TEACH</p><h2>Recording stopped</h2><p class="muted small">No pending recording was returned. You can close this message and continue editing the draft.</p><div class="row"><button data-t="close">Close</button></div>'; box.hidden = false; }
    } catch (e) {
      S.teaching = null; SB.ending = false;
      box.innerHTML = '<p class="eyebrow">// TEACH</p><h2>Could not stop recording</h2><p class="red small">' + esc(e.message || e) + '</p><div class="row"><button data-t="close">Close</button></div>'; box.hidden = false;
    }
    render();
  }
  function showTeachDecision(error) {
    const p = SB.pendingTeach; if (!p) return;
    const box = $('sbtaught');
    box.innerHTML = '<p class="eyebrow">// RECORDING STOPPED · ' + Math.max(0, Math.round(p.elapsedMs / 1000)) + ' S</p><h2>' + icon('rec') + 'What would you like to do?</h2>'
      + '<p class="small">Falcor recorded ' + p.touches + ' interaction' + (p.touches === 1 ? '' : 's') + ' across ' + p.screens + ' screen' + (p.screens === 1 ? '' : 's') + (p.name ? ' in <b>' + esc(p.name) + '</b>' : '') + '.</p>'
      + '<p class="muted small">Nothing has been analyzed or added to your chain yet. The empty draft stays in Sandbox if you discard this recording.</p>'
      + (error ? '<p class="red small">' + esc(error) + '</p>' : '')
      + '<div class="row"><button class="primary" data-t="analyze">' + icon('rec') + 'Send for analysis</button><button class="ghost danger" data-t="discard-recording">' + icon('trash') + 'Delete recording</button></div>';
    box.hidden = false;
  }
  async function analyzeTeach() {
    const p = SB.pendingTeach; if (!p || SB.ending) return;
    SB.ending = true; render();
    const box = $('sbtaught'); box.innerHTML = workHtml('Reading your touches, taps and typing', 4); box.hidden = false;
    const paint = (stage, pct) => { const b = $('sbtbar'); if (b) b.style.width = Math.max(4, Math.min(100, pct)) + '%'; text($('sbtstage'), stage); };
    let done = false, shown = 0;
    const poll = (async () => { while (!done) { const w = await window.hub.call('teachProgress').catch(() => null); if (w && w.pct > shown && w.pct < 100) { shown = w.pct; paint(w.stage, w.pct); await pause(350); } else await pause(120); } })();
    try {
      const r = await call('teachAnalyze', {id: p.id});
      done = true; await poll;
      for (const [st, pct] of [['Reading your touches, taps and typing', 30], ['Learning the screens of ' + ((r && r.name) || 'the app'), 55], ['Building the steps', 82]]) if (pct > shown) { paint(st, pct); await pause(380); }
      paint('Done', 100); await pause(350);
      SB.pendingTeach = null; SB.ending = false;
      await showTaught(r); render();
    } catch (e) {
      done = true; await poll; SB.ending = false;
      showTeachDecision(e.message || e); render();
    }
  }
  async function discardTeach() {
    const p = SB.pendingTeach; if (!p) return;
    try { await call('teachDiscard', {id: p.id}); SB.pendingTeach = null; $('sbtaught').hidden = true; await refresh(); toast('Recording deleted. The empty draft is still in Sandbox.'); }
    catch (e) { showTeachDecision(e.message || e); }
  }
  window.sbEndTeach = endTeach;
  $('sbteach').onclick = () => void toggleTeach();
  async function showTaught(r) {
    const box = $('sbtaught'), s = r && r.sandbox;
    if (!r || !r.pkg || !s) { box.innerHTML = '<p class="eyebrow">// TEACH</p><h2>Nothing was recorded</h2><p class="muted small">' + (r ? 'No app was opened on the mirror. Press Teach, open an app, use it, then End Teach.' : 'The recording could not be stopped cleanly.') + '</p><div class="row"><button data-t="close">Close</button></div>'; box.hidden = false; setMode('view', true); return; }
    if (s.error) { box.innerHTML = '<p class="eyebrow">// TEACH</p><h2>The run was not built</h2><p class="red small">' + esc(s.error) + '</p><div class="row"><button data-t="close">Close</button></div>'; box.hidden = false; setMode('view', true); return; }
    let added = [];
    if (!SB.seq || SB.seq.id !== s.sequenceId) await open(s.sequenceId);
    else { const before = new Set(flat().map(x => x.id)); await open(s.sequenceId, {keepSel: true, discardDraft: true}); added = flat().filter(x => !before.has(x.id)); }
    if (!added.length) added = flat();
    SB.sel = added.map(x => x.id); draw();
    added.forEach((x, i) => { const el = $('sbsteps').querySelector('.blk[data-id="' + x.id + '"]'); if (el && !P.reduced()) { el.style.animationDelay = Math.min(i * 60, 900) + 'ms'; el.classList.add('dropin'); } });
    if (added[0]) { const el = $('sbsteps').querySelector('.blk[data-id="' + added[0].id + '"]'); if (el) el.scrollIntoView({block: 'nearest', inline: 'nearest'}); }
    const f = s.found || {}, n = (k, one, many) => f[k] ? '<li>' + f[k] + ' ' + (f[k] === 1 ? one : many) + '</li>' : '';
    const secs = ms => ms >= 60000 ? Math.round(ms / 60000) + ' min' : Math.round(ms / 1000) + ' s';
    const from = SB.reteachFrom; SB.reteachFrom = null;
    const seen = (from ? '<li>Carried on in <b>' + esc(f.app || r.name) + '</b> from step ' + from + '</li>' : '<li>Opened <b>' + esc(f.app || r.name) + '</b></li>') + n('taps', 'tap', 'taps') + n('holds', 'long press', 'long presses') + n('swipes', 'swipe', 'swipes') + n('scrolls', 'scroll', 'scrolls')
      + n('typed', 'text typed', 'texts typed') + n('keys', 'key (Back, Enter…)', 'keys (Back, Enter…)') + (f.waits ? '<li>' + f.waits + ' pause' + (f.waits === 1 ? '' : 's') + ' kept as waits (' + secs(f.waitedMs) + ')</li>' : '') + (f.check ? '<li>A check that it ends like you showed</li>' : '');
    const title = /^Taught run /.test(def().title) ? (f.app || r.name) + ' run' : def().title;
    box.innerHTML = '<p class="eyebrow">// TAUGHT RUN · ' + esc(secs(s.ms || 0)) + ' recorded</p><h2>' + icon('check') + 'Your run is ready</h2>'
      + '<p class="small">Falcor saw:</p><ul class="taughtlist">' + seen + '</ul>'
      + '<p class="muted small">' + s.added + ' step' + (s.added === 1 ? ' is' : 's are') + ' on the workspace grid. Click one to change it, drag to reorder, Delete removes it, Play chain previews it.</p>'
      + (s.skipped && s.skipped.length ? '<p class="sand small">Left out: ' + esc(s.skipped.join(', ')) + '.</p>' : '')
      + '<label>Name<input id="sbtname" maxlength="80" value="' + esc(title) + '"></label>'
      + '<p class="muted small">It is a draft until you publish it: drafts can be edited and run by hand; published runs are in the Library and can be scheduled.</p><div class="row"><button class="primary" data-t="publish">' + icon('check') + 'Publish to Library</button><button data-t="close">' + icon('edit') + 'Keep as draft</button><button class="ghost danger" data-t="discard">' + icon('trash') + 'Discard</button></div>';
    box.hidden = false; setMode('view', true);
  }
  $('sbtaught').onclick = async e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    const act = b.dataset.t;
    if (act === 'close') { $('sbtaught').hidden = true; return; }
    if (act === 'analyze') { await analyzeTeach(); return; }
    if (act === 'discard-recording') { await discardTeach(); return; }
    if (act === 'library') { $('sbtaught').hidden = true; go('games'); const c = document.querySelector('#libfilter [data-f="creations"]'); if (c) c.click(); return; }
    if (!SB.seq) return;
    if (act === 'discard') {
      if (!window.confirm('Discard "' + def().title + '"? It is removed from the Sandbox and the Library.')) return;
      const id = SB.seq.id; await sb('remove', {id}); local.set('draft.' + id, null); SB.seq = null; local.set('last', null);
      $('sbtaught').hidden = true; await refresh(); goHome('mine'); toast('Discarded.'); return;
    }
    if (act === 'publish') {
      const name = ($('sbtname').value || '').trim().slice(0, 80) || def().title;
      if (name !== def().title) edit(d => { d.title = name; }, {merge: 'title', insp: false});
      if (!await publishSeq({force: true, quiet: true})) return;
      $('sbtaught').innerHTML = '<p class="eyebrow">// SAVED</p><h2>' + icon('check') + 'In your Library</h2><p class="small">"' + esc(name) + '" is saved under Creations in the Library. Run it, schedule it or edit it any time.</p><div class="row"><button class="primary" data-t="library">Open Library</button><button data-t="close">Keep editing</button></div>';
      P.burst($('sbtaught'));
    }
  };
  window.sbAfterTeach = r => showTaught({pkg: 'x', name: '', sandbox: r});

  // ------------------------------------------------------------------ the header's buttons
  $('sbtitle').oninput = e => { if (def()) edit(d => { d.title = e.target.value.slice(0, 80) || 'Untitled'; }, {merge: 'title', insp: false}); };
  $('sbdev').onchange = e => { deviceId = e.target.value; if (def() && e.target.value) edit(d => { d.target.deviceId = e.target.value; }, {merge: 'dev'}); render(); };
  $('sbnew').onclick = () => newSheet(); $('sbopen').onclick = () => goHome('mine');
  $('sbsave').onclick = () => save(); $('sbsaveas').onclick = () => saveAs();
  // Publish (draft → Library) or, when it is already there, Unpublish (back to Drafts, its schedules off).
  async function publishSeq(o = {}) {
    if (!SB.seq) return false;
    if (SB.dirty || o.force) await save({force: !!o.force, silent: true});
    const row = SB.data.sequences.find(x => x.id === SB.seq.id);
    if (row && row.published && !o.force) {
      if (!window.confirm('Unpublish "' + def().title + '"? It leaves the Library and its schedules turn off. It stays here as a draft.')) return false;
      await sb('unpublish', {id: SB.seq.id}); await refresh(); toast('"' + def().title + '" is a draft again.'); return false;
    }
    try { await sb('publish', {id: SB.seq.id}); } catch { return false; }
    await refresh(); if (!o.quiet) toast('"' + def().title + '" is in your Library now. Schedule it or run it from there.');
    return true;
  }
  $('sbpublish').onclick = () => void publishSeq();
  $('sbundo').onclick = undo; $('sbredo').onclick = redo;
  $('sbtest').onclick = () => start('test');
  $('sbplay').onclick = () => { const l = liveRun(); if (!l) return start('preview'); if (l.sequenceId === SB.seq?.id && ['PAUSED', 'NEEDS_ATTENTION'].includes(l.status)) return ctl('resume', 'Resumed from the current position.')(); };
  $('sbpause').onclick = ctl('pause', 'Paused. Your chain position is held.');
  $('sbplaystop').onclick = async () => {
    const l = liveRun();
    if (l && l.sequenceId !== SB.seq?.id) return;
    if (l) await sb('stop', {runId: l.runId});
    SB.resetRunId = l?.runId || SB.runInfo?.id; SB.follow = null;
    marks(); drawHead(); drawRunbar(); window.sbWorkspace?.resetView();
    toast('Player reset to the start. Actions already performed on the phone are not undone.');
  };
  $('sbskip').onclick = ctl('skip', 'Skipped that step.'); $('sbafter').onclick = ctl('stopAfterGroup', 'It stops when this group or loop ends.');
  // Schedules are the Daily Queue's (queue.js#openScheduler, the same editor as Games and Tasks).
  const schedule = async () => { if (!SB.seq) { toast('Open a chain first.', 'warn'); return; } if (SB.dirty) await save({silent: true}); const row = SB.data.sequences.find(x => x.id === SB.seq.id); if (row && !row.published) { toast('"' + def().title + '" is a draft. Publish it to the Library first, then schedule it.', 'warn'); return; } openScheduler({target: {type: 'sequence', id: SB.seq.id}, name: def().title, kind: 'sequence'}); };
  $('sbprefs').onclick = () => prefsSheet(); $('sbhelp').onclick = () => helpSheet();
  window.sbOpen = id => load().then(() => open(id));
  window.addEventListener('keydown', e => {
    if (tab !== 'sandbox' || $('sbsheet').hidden === false && e.key !== 'Escape') return;
    if (e.key === 'Escape' && !$('sbsheet').hidden) { closeSheet(); return; }
    if (e.key === 'Escape' && workspace.classList.contains('studio-focus')) { e.preventDefault(); setFocus(false); return; }
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod && k === 's') { e.preventDefault(); void save(); return; }
    if (mod && k === 'enter') { e.preventDefault(); void start('run'); return; }
    if (mod && k === 'n') { e.preventDefault(); newSheet(); return; }
    if (mod && k === 'o') { e.preventDefault(); openSheet(); return; }
    if (typing() || document.activeElement === $('mirrorbox') && (controlling || S.teaching)) return;
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
  function sheet(html, wire, into) {
    if (into) { into.innerHTML = html; P.fix(into); numbers(into); if (wire) wire(into); return; }
    const b = $('sbsheetbody'); b.innerHTML = html; P.fix(b); numbers(b); $('sbsheet').hidden = false; b.classList.remove('stepin'); void b.offsetWidth; b.classList.add('stepin'); if (wire) wire(b); const f = b.querySelector('input, select, button.primary'); if (f) f.focus();
  }
  function closeSheet() { $('sbsheet').hidden = true; $('sbsheetbody').innerHTML = ''; }
  $('sbsheet').addEventListener('mousedown', e => { if (e.target === $('sbsheet')) closeSheet(); });
  const head = (eye, title) => '<div class="top"><div><p class="eyebrow">// ' + esc(eye) + '</p><h2>' + esc(title) + '</h2></div><button class="ghost icon" data-close title="Close">' + icon('close') + '</button></div>';
  $('sbsheetbody').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });

  $('sbai').onclick = () => aiSheet();
  function aiSheet() {
    const editor = SB.seq;
    let generated = null, pending = false;
    sheet(head('FALCOR CHAT', 'What shall we build?') + '<div class="sbaichat"><p>Describe the actions you want. I will build an editable draft for you to review.</p></div>'
      + '<label>Build<select id="sbaikind"><option value="block"' + (!editor ? ' disabled' : '') + '>Custom block · add to this chain</option><option value="sequence"' + (!editor ? ' selected' : '') + '>New chain · individual action blocks</option></select></label>'
      + '<label>Your idea<textarea id="sbaiprompt" rows="4" maxlength="3000" placeholder="Tap Daily reward, wait 2 seconds, then tap Claim and check for Success"></textarea></label>'
      + '<p class="muted small">Uses your Settings > AI chat model. Only this description is sent, not your current chain. Nothing runs or publishes automatically.</p>'
      + '<div class="row"><button class="primary" id="sbaigenerate">' + icon('chat') + 'Build draft</button><button data-close>Cancel</button></div>'
      + '<p id="sbaistatus" role="status"></p><div class="sbaipreview" id="sbaipreview" hidden></div><button class="primary" id="sbaiapply" hidden></button>', b => {
      const kind = b.querySelector('#sbaikind'), prompt = b.querySelector('#sbaiprompt'), status = b.querySelector('#sbaistatus'), preview = b.querySelector('#sbaipreview'), apply = b.querySelector('#sbaiapply'), generate = b.querySelector('#sbaigenerate');
      const active = () => b.contains(status) && !$('sbsheet').hidden;
      const reset = () => { generated = null; apply.hidden = preview.hidden = true; status.textContent = ''; };
      kind.onchange = prompt.oninput = reset;
      generate.onclick = async () => {
        if (pending || !prompt.value.trim()) { if (!pending) status.textContent = 'Describe what you want Falcor to build first.'; return; }
        pending = true; generated = null; apply.hidden = preview.hidden = true; generate.disabled = kind.disabled = prompt.disabled = true; status.textContent = 'Falcor is building your draft...';
        try {
          const result = await quiet('generate', {kind: kind.value, prompt: prompt.value});
          if (!active()) return;
          generated = result; status.textContent = result.warnings.join(' ');
          const outline = steps => '<ol>' + steps.map(s => '<li>' + esc(words(s)) + (s.children ? outline(s.children) : '') + (s.else?.length ? '<b>Else</b>' + outline(s.else) : '') + '</li>').join('') + '</ol>';
          preview.innerHTML = '<h3>' + esc(result.definition.title) + '</h3><p>' + esc(result.definition.description) + '</p>' + outline(result.definition.steps);
          preview.hidden = apply.hidden = false; apply.textContent = result.kind === 'block' ? 'Add custom block to this chain' : 'Open as a new draft';
        } catch (e) { if (active()) status.textContent = errText(e); }
        finally { pending = false; if (active()) generate.disabled = kind.disabled = prompt.disabled = false; }
      };
      apply.onclick = async () => {
        if (!generated || pending) return;
        const result = generated; pending = true; apply.disabled = true;
        try {
          if (result.kind === 'block') {
            if (!editor || SB.seq !== editor) throw new Error('The editor changed. Open Falcor from the chain you want to add to.');
            const snapshot = JSON.stringify(def()), candidate = JSON.parse(snapshot), at = placeAfterFocus(), items = fresh(result.definition.steps);
            const list = at.into === 'root' ? candidate.steps : (() => { let found; each(candidate.steps, s => { if (s.id === at.into.split(':')[0]) found = s; }); return found[at.into.split(':')[1]]; })();
            list.splice(at.at, 0, ...items);
            await quiet('check', {definition: candidate});
            if (!active() || SB.seq !== editor || JSON.stringify(def()) !== snapshot) throw new Error('Your chain changed. Review it and press Add again.');
            items.forEach(s => SB.folded.add(s.id)); addBlocks(items, at); closeSheet(); toast('Custom block added. Your existing blocks are unchanged.');
          } else {
            if (SB.dirty && !confirmLeave()) return;
            const definition = {...result.definition, target: {...result.definition.target, deviceId: sdev()?.id || null}};
            const r = await quiet('create', {definition}); if (!active()) return;
            closeSheet(); await refresh(); await open(r.id, {newWorkspace: true}); toast('AI draft ready. Review the actions before playing.');
          }
        } catch (e) { if (active()) status.textContent = errText(e); }
        finally { pending = false; if (active()) apply.disabled = false; }
      };
      prompt.focus();
    });
  }

  function newSheet(into) {
    if (!SB.cat) return;
    const d = sdev(), tpl = [['blank', 'Blank', 'Start with nothing.'], ['starter', 'Example', SB.cat.starter.description], ...SB.cat.presets.map(p => [p.id, p.name, p.help || ''])];
    let pick = 'blank';
    sheet(head('NEW CHAIN', 'New chain') + '<div class="grid2"><label>Name<input id="sbnname" maxlength="80" placeholder="e.g. Morning check-in"></label>' + '<label>Phone<select id="sbndev">' + S.devices.map(x => '<option value="' + esc(x.id) + '"' + (d && x.id === d.id ? ' selected' : '') + '>' + esc(x.label) + '</option>').join('') + '<option value="">No phone yet (a draft)</option></select></label></div>'
      + '<p class="eyebrow">// START FROM</p><div class="opts" id="sbntpl">' + tpl.map(([id, n, h]) => '<button type="button" class="opt' + (id === pick ? ' on' : '') + '" data-tpl="' + esc(id) + '"><b>' + esc(n) + '</b><small>' + esc(h) + '</small></button>').join('') + '</div>'
      + '<p class="muted small">Or press Teach after creating it and show Falcor on the mirror: what you do becomes blocks.</p><div class="row"><button class="primary" id="sbncreate">' + icon('plus') + 'Create</button><button data-close>Cancel</button>' + (into ? '<button id="sbnimport">' + icon('export') + 'Import .json</button>' : '') + '</div>', b => {
      const imp = b.querySelector('#sbnimport'); if (imp) imp.onclick = async () => { const r = await sb('import'); if (r) { await refresh(); await open(r.id); toast('Imported. Check the app and points before you run it.'); } };
      b.querySelector('#sbntpl').onclick = e => { const o = e.target.closest('[data-tpl]'); if (!o) return; pick = o.dataset.tpl; b.querySelectorAll('.opt').forEach(x => cls(x, 'on', x === o)); };
      b.querySelector('#sbncreate').onclick = async () => {
        if (SB.dirty && !confirmLeave()) return;
        const r = await sb('create', {title: b.querySelector('#sbnname').value, deviceId: b.querySelector('#sbndev').value || null, template: pick});
        closeSheet(); await refresh(); await open(r.id, {newWorkspace: true}); toast('Created. Add blocks from the library, pick points on the mirror, then Play chain.');
      };
    }, into);
  }
  function confirmLeave() { return window.confirm('Your changes to "' + def().title + '" are not saved. Leave them? (They stay as a draft for this chain.)'); }
  function openSheet(into) {
    if (!SB.data) return;
    let q = '', sort = local.get('sort', 'updated'), folder = '';
    const draw = b => {
      const pub = SB.listPub === true;
      b.querySelectorAll('#sbopub [data-p]').forEach(x => cls(x, 'on', (x.dataset.p === 'pub') === pub));
      const L = SB.data.sequences.filter(s => !!s.published === pub && (!q || (s.title + ' ' + s.description + ' ' + s.folder).toLowerCase().includes(q)) && (!folder || s.folder === folder))
        .sort((a, c) => (c.favorite - a.favorite) || (sort === 'name' ? a.title.localeCompare(c.title) : sort === 'last' ? (c.lastRunAt || 0) - (a.lastRunAt || 0) : sort === 'next' ? (a.nextRunAt || Infinity) - (c.nextRunAt || Infinity) : c.updatedAt - a.updatedAt));
      b.querySelector('#sbolist').innerHTML = L.map(s => '<li class="' + (s.running ? 'run' : '') + '" data-id="' + esc(s.id) + '"><button class="ghost icon small" data-act="star" title="Star">' + icon('star', s.favorite ? 'sand' : '') + '</button><div><b>' + esc(s.title) + '</b>' + (s.folder ? ' <span class="chipcode">' + esc(s.folder) + '</span>' : '') + '<div class="meta">' + s.steps + ' steps · about ' + fmtMs(s.estimateMs) + ' · v' + s.revision + (s.lastRun ? ' · last ' + esc(s.lastRun.status.toLowerCase()) + ' ' + new Date(s.lastRun.at).toLocaleString() : ' · never run') + (s.nextRunAt ? ' · next ' + new Date(s.nextRunAt).toLocaleString() : '') + '</div></div>'
        + '<div class="row"><button class="small primary" data-act="start" title="Run it now">' + icon('play') + '</button><button class="small" data-act="edit">Edit</button>'
        + (s.published ? '<button class="small icon" data-act="sched" title="Schedule">' + icon('calendar') + '</button><button class="small ghost" data-act="unpub" title="Take it out of the Library (its schedules turn off)">Unpublish</button>' : '<button class="small pubbtn" data-act="pub" title="Put it in the Library, where it can be scheduled"' + (s.steps ? '' : ' disabled') + '>' + icon('check') + 'Publish</button>')
        + '<button class="small icon" data-act="clone" title="Clone">' + icon('copy') + '</button><button class="small icon" data-act="folder" title="Folder">' + icon('tasks') + '</button><button class="small icon danger" data-act="del" title="Delete">' + icon('trash') + '</button></div></li>').join('')
        || '<li class="muted small">' + (q ? 'Nothing matches.' : pub ? 'Nothing published yet. Publish a draft to put it in the Library.' : 'No drafts. Everything you build or teach starts here until you publish it.') + '</li>';
      P.fix(b);
    };
    const folders = [...new Set(SB.data.sequences.map(s => s.folder).filter(Boolean))];
    sheet(head('DRAFTS', 'Drafts') + '<div class="row"><div class="seg" id="sbopub"><button data-p="draft">Drafts · ' + SB.data.sequences.filter(s => !s.published).length + '</button><button data-p="pub">Published · ' + SB.data.sequences.filter(s => s.published).length + '</button></div><input id="sboq" placeholder="Search" class="grow"><select id="sbosort"><option value="updated">Last edited</option><option value="name">Name</option><option value="last">Last run</option><option value="next">Next run</option></select>' + (folders.length ? '<select id="sbofolder"><option value="">All folders</option>' + folders.map(f => '<option>' + esc(f) + '</option>').join('') + '</select>' : '') + '</div>'
      + '<ul class="seqlist" id="sbolist"></ul><div class="row"><button class="primary small" id="sbonew">' + icon('plus') + 'New</button><button class="small" id="sboimport">' + icon('export') + 'Import .json</button><span class="grow"></span><span class="muted small">' + SB.data.schedules.filter(s => s.enabled).length + ' schedules on · ' + SB.data.runs.length + ' recent runs</span></div>', b => {
      b.querySelector('#sbosort').value = sort; draw(b);
      b.querySelector('#sboq').oninput = e => { q = e.target.value.toLowerCase(); draw(b); };
      b.querySelector('#sbopub').onclick = e => { const p = e.target.closest('[data-p]'); if (p) { SB.listPub = p.dataset.p === 'pub'; draw(b); } };
      b.querySelector('#sbosort').onchange = e => { sort = e.target.value; local.set('sort', sort); draw(b); };
      const fsel = b.querySelector('#sbofolder'); if (fsel) fsel.onchange = e => { folder = e.target.value; draw(b); };
      b.querySelector('#sbonew').onclick = () => newSheet();
      b.querySelector('#sboimport').onclick = async () => { const r = await sb('import'); if (r) { await refresh(); closeSheet(); await open(r.id); toast('Imported. Check the app and points before you run it.'); } };
      b.querySelector('#sbolist').onclick = async e => {
        const a = e.target.closest('[data-act]'), li = e.target.closest('li[data-id]'); if (!a || !li) return;
        const id = li.dataset.id, s = SB.data.sequences.find(x => x.id === id);
        if (a.dataset.act === 'edit') { if (SB.dirty && SB.seq && SB.seq.id !== id && !confirmLeave()) return; closeSheet(); await open(id); }
        if (a.dataset.act === 'start') { const d = sdev(); if (!d) { toast('Plug in the phone first.', 'warn'); return; } const r = await sb('start', {id, deviceId: d.id}); toast('Running "' + s.title + '" (version ' + r.revision + ').'); closeSheet(); go('phone'); }
        if (a.dataset.act === 'sched') { closeSheet(); if (!SB.seq || SB.seq.id !== id) await open(id); schedule(); }
        if (a.dataset.act === 'pub') { await sb('publish', {id}); await refresh(); draw(b); toast('"' + s.title + '" is in your Library now.'); }
        if (a.dataset.act === 'unpub') { if (!window.confirm('Unpublish "' + s.title + '"? It leaves the Library and its schedules turn off. It stays here as a draft.')) return; await sb('unpublish', {id}); await refresh(); draw(b); toast('"' + s.title + '" is a draft again.'); }
        if (a.dataset.act === 'clone') { await sb('clone', {id}); await refresh(); draw(b); toast('Cloned as a draft.'); }
        if (a.dataset.act === 'star') { await sb('meta', {id, favorite: !s.favorite}); await refresh(); draw(b); }
        if (a.dataset.act === 'folder') { const inpEl = P.el('<input maxlength="40" placeholder="Folder name, Enter to keep" value="' + esc(s.folder) + '">'); a.replaceWith(inpEl); inpEl.focus(); inpEl.onkeydown = async ev => { if (ev.key === 'Enter') { await sb('meta', {id, folder: inpEl.value}); await refresh(); draw(b); } if (ev.key === 'Escape') { ev.stopPropagation(); draw(b); } }; }
        if (a.dataset.act === 'del') { if (!window.confirm('Delete "' + s.title + '"? Its schedules turn off. Run logs are kept.')) return; await sb('remove', {id}); local.set('draft.' + id, null); if (SB.seq && SB.seq.id === id) { SB.seq = null; local.set('last', null); } await refresh(); draw(b); renderAll(); }
      };
    }, into);
  }
  function renderAll() { draw(); }
  // The tab's landing: Create (what the Sandbox is, and ways to start) and My sequences. The editor is its own page.
  function goHome(v) { if (buildPending) { toast('Wait for the phone action to finish before leaving this draft.', 'warn'); return; } setFocus(false); SB.home = v || (SB.data && SB.data.sequences.length ? 'mine' : 'create'); SB.homeDrawn = ''; draw(); }
  function drawHome(force) {
    if (SB.home && !$('rec').hidden) SB.home = null; // Teach records on the mirror: the editor's stage stays in view.
    const on = !!SB.home; cls(document.querySelector('[data-pane="sandbox"]'), 'home', on); $('sbhome').hidden = !on;
    if (!on || !SB.cat || !SB.data) return;
    text($('sbminecount'), '· ' + SB.data.sequences.filter(s => !s.published).length);
    $('sbhometabs').parentElement.hidden = SB.home === 'start'; cls($('sbhome'), 'start', SB.home === 'start');
    document.querySelectorAll('#sbhometabs button').forEach(x => cls(x, 'on', x.dataset.home === SB.home));
    const b = $('sbhomebody');
    if (!force && SB.homeDrawn === SB.home) return;
    if (!force || !b.contains(document.activeElement)) SB.homeDrawn = SB.home; else return;
    if (SB.home === 'start') { startBox(b); return; }
    if (SB.home === 'create') {
      newSheet(b);
      // (the tab's own heading, // SANDBOX, introduces it: no second heading here)
    } else openSheet(b);
  }
  // The start box offers entry points; AI drafting and Teach live inside every workspace.
  function startBox(b) {
    const drafts = SB.data.sequences.filter(s => !s.published).length;
    const opt = (k, ic, t, sub, cls = '') => '<button class="sbsopt ' + cls + '" data-start="' + k + '" aria-label="' + esc(t + '. ' + sub) + '">' + icon(ic) + '<span><b>' + esc(t) + '</b><small>' + esc(sub) + '</small></span></button>';
    b.innerHTML = '<div class="sbstart rise"><p class="eyebrow">// SANDBOX</p><h2>What do you want to create?</h2><p class="muted small">Start fresh, explore a template or continue a draft. Build automatically adds blocks as you use the phone. Build with Falcor can also draft a chain from your idea.</p>'
      + '<div class="sbsopts">' + opt('blank', 'plus', 'Blank workspace', 'Start fresh and build your own chain') + opt('templates', 'book', 'Templates', 'Explore examples and ready-made starting points')
      + opt('drafts', 'sandbox', 'My drafts' + (drafts ? ' · ' + drafts : ''), drafts ? 'Pick up where you left off' : 'Your saved work will appear here')
      + opt('tour', 'help', 'Quick tour', 'A one-minute guide to the workspace', 'tour') + '</div></div>';
    b.onclick = async e => {
      const o = e.target.closest('[data-start]'); if (!o) return; const k = o.dataset.start;
      if (k === 'drafts') { SB.listPub = false; goHome('mine'); return; }
      if (k === 'templates') { goHome('create'); return; }
      const d = sdev(), r = await sb('create', {title: '', deviceId: d ? d.id : null, template: 'blank'});
      await refresh(); await open(r.id);
      if (k === 'tour') tour(0);
    };
  }
  // The quick tour: a light on each part of the editor in turn, with Back, Next and Skip.
  const TOUR = [['sblib', 'Blocks', 'Click a block to add it to your run, or drag it onto the grid.'], ['sbstage', 'Your phone, live', 'Build uses the phone and adds each action as a block. Unlock its window to move, resize or pop it out. View is look-only.'],
    ['sbpanels', 'Build tools', 'Build mode adds blocks automatically for each phone action. Add blocks opens the catalog; Build with Falcor turns a written idea into blocks. Windows opens optional tools and restores hidden windows.'], ['sbtl', 'Your workspace', 'Your blocks live on the grid. Roll the mouse wheel or pinch to zoom, drag empty space to pan, and click a block for settings. Drag a block to reorder it.'],
    ['sbplay', 'Chain player', 'Play runs the chain on your phone. Pause holds your place; Resume continues. Stop resets the player, not the phone. Publish separately when your chain is ready.']];
  function tour(i) {
    let ov = document.getElementById('sbtour'); if (!ov) { ov = document.createElement('div'); ov.id = 'sbtour'; ov.className = 'sbtour'; document.body.appendChild(ov); }
    const step = TOUR[i], el = step && document.getElementById(step[0]);
    if (step?.[0] === 'sblib') window.sbWorkspace?.openDrawer('blocks', true);
    else window.sbWorkspace?.openDrawer('blocks', false);
    if (!step) { ov.remove(); toast('That is the tour. Use the phone in Build mode to add your first block automatically.'); return; }
    if (!el || !el.offsetParent) { tour(i + 1); return; }
    const r = el.getBoundingClientRect(), W = innerWidth, H = innerHeight, cw = 320;
    const below = r.bottom + 190 < H, x = Math.min(Math.max(12, r.left + r.width / 2 - cw / 2), W - cw - 12), y = below ? r.bottom + 12 : Math.max(12, r.top - 182);
    ov.innerHTML = '<i class="sbtourlight" data-style="left:' + (r.left - 6) + 'px;top:' + (r.top - 6) + 'px;width:' + (r.width + 12) + 'px;height:' + (r.height + 12) + 'px"></i>'
      + '<div class="sbtourcard" data-style="left:' + x + 'px;top:' + y + 'px;width:' + cw + 'px"><p class="eyebrow">// TOUR · ' + (i + 1) + ' OF ' + TOUR.length + '</p><b>' + esc(step[1]) + '</b><p class="small">' + esc(step[2]) + '</p>'
      + '<div class="row"><button class="small ghost" data-t="skip">Skip</button><span class="grow"></span>' + (i ? '<button class="small" data-t="back">Back</button>' : '') + '<button class="small primary" data-t="next">' + (i === TOUR.length - 1 ? 'Done' : 'Next') + '</button></div></div>';
    P.fix(ov);
    ov.onclick = e => { const t = e.target.closest('[data-t]'); if (!t) return; if (t.dataset.t === 'skip') ov.remove(); else tour(i + (t.dataset.t === 'next' ? 1 : -1)); };
  }
  $('sbhometabs').onclick = e => { const t = e.target.closest('[data-home]'); if (t) goHome(t.dataset.home); };
  $('sbtohome').onclick = () => goHome('mine');
  function historySheet() {
    if (!SB.seq) return;
    const runs = SB.data.runs.filter(r => r.sequenceId === SB.seq.id);
    sheet(head('HISTORY', def().title) + '<p class="eyebrow">// VERSIONS</p><ul class="seqlist">' + SB.seq.revisions.map(v => '<li><span>v' + v.number + '</span><div class="meta">' + new Date(v.at).toLocaleString() + (v.number === SB.seq.revision.number ? ' · current' : '') + '</div><div class="row">' + (v.number !== SB.seq.revision.number ? '<button class="small" data-rev="' + esc(v.id) + '">Restore</button>' : '') + '</div></li>').join('') + '</ul>'
      + '<p class="eyebrow">// RUNS</p><ul class="seqlist">' + (runs.map(r => '<li><span>' + esc(r.status.toLowerCase()) + '</span><div class="meta">' + new Date(r.startedAt).toLocaleString() + ' · v' + r.revision + ' · ' + esc(r.reason || '') + ' · ' + (r.actions || 0) + ' actions</div><div class="row"><button class="small" data-log="' + esc(r.id) + '">Log</button></div></li>').join('') || '<li class="muted small">Not run yet.</li>') + '</ul>', b => {
      b.onclick = async e => {
        const rv = e.target.closest('[data-rev]'); if (rv) { if (SB.dirty && !confirmLeave()) return; const r = await sb('restore', {id: SB.seq.id, revisionId: rv.dataset.rev}); closeSheet(); await open(SB.seq.id, {discardDraft: true}); toast('Restored as version ' + r.number + '.'); }
        const lg = e.target.closest('[data-log]'); if (lg) { closeSheet(); SB.logRun = lg.dataset.log; SB.view = 'log'; $('sbviews').querySelectorAll('button').forEach(x => cls(x, 'on', x.dataset.v === 'log')); draw(); poll(); }
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
      + '<label>New swipe (ms)<input type="number" data-pref="gestureMs" min="50" max="3000" value="' + p.gestureMs + '"></label><label>New chains: on error<select data-pref="onError"><option value="review">pause for me</option><option value="stop">stop</option><option value="skip">skip the step</option></select></label><label>New chains: max run (min)<input type="number" data-pref="maxRunMin" min="1" max="360" value="' + p.maxRunMin + '"></label>'
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
    sheet(head('HELP', 'Sandbox') + '<p class="eyebrow">// FIVE STEPS</p><ol class="walk"><li><b>New</b>: name your chain and pick the phone (or start from an example). Focus opens a larger workspace; Exit focus or Escape restores it.</li><li><b>Build</b>: Add blocks opens the action catalog. Block details edits your selection. Build with Falcor drafts blocks from an idea. Roll your mouse wheel or pinch to zoom; drag empty grid to pan.</li><li><b>Phone tools</b>: Build records successful phone actions as blocks. Pick target and Pick gesture only edit points; View sends no input. Teach records a lesson for you to review and analyze.</li><li><b>Chain player</b>: Play chain operates the phone. Pause holds the current step; Resume continues. Stop / reset returns the player to the beginning, without undoing phone actions. Test selected block runs just your selection.</li><li><b>Chain tools</b>: Save draft keeps your work in Sandbox. Publish to Library makes it available to run or schedule there. Run log shows the history, separately from the player.</li></ol>'
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
      + (evs.length ? '<ol>' + evs.slice(-300).map(e => '<li><time>' + new Date(e.at).toLocaleTimeString([], {hour12: false}) + '</time><span class="t-' + esc(e.type) + '">' + esc(e.type) + '</span><span>' + esc(e.text) + (e.ms !== undefined ? ' · ' + fmtMs(e.ms) : '') + '</span>' + (e.shot ? '<img data-shot="' + esc(e.shot) + '" alt="">' : '<span></span>') + '</li>').join('') + '</ol>' : '<p class="muted small">' + (runs.length ? 'Loading…' : 'No runs yet. Press Play chain.') + '</p>');
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
  setInterval(() => { const d = sdev(); if (!d || tab !== 'sandbox') return; const html = Object.entries(d.installedNames || {}).map(([p, n]) => '<option value="' + esc(p) + '">' + esc(n) + '</option>').join(''); if (dl.dataset.h !== html) { dl.dataset.h = html; dl.innerHTML = html; } }, 3000);})();

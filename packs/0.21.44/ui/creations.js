// Creations (the tab once called Tasks, internally still `tasks`) and Activity (once Stats, internally `stats`).
// Creations: every saved Sandbox sequence as a card (views.ts#creations), with Run now through the Daily Queue (qRun:
// the one-controller question), Schedule (the queue's editor), History and Edit in Sandbox; Other automations is the
// former Tasks list, unchanged. Activity: what ran, newest first, one row per execution (views.ts#activity), with filters,
// Load more and details on demand. Loaded after app.js; uses its helpers. Read on demand only while the tab is open,
// one request at a time, and an answer that arrives after a newer one is ignored.
(() => {
  const CR = {view: 'creations', filter: 'all', q: '', list: null, error: '', at: 0, busy: false, seq: 0};
  const OUT_CLS = {completed: 'green', attention: 'sand', waiting: 'sand', running: 'accent', failed: 'red', stopped: 'muted', interrupted: 'sand', skipped: 'muted'};
  const ago = at => { const m = Math.round((Date.now() - at) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 36 * 60 ? Math.round(m / 60) + ' h ago' : new Date(at).toLocaleDateString(); };
  const len = ms => ms === null || ms === undefined ? '' : ms < 60000 ? Math.max(1, Math.round(ms / 1000)) + ' s' : dur(ms);

  // ------------------------------------------------------------------ Creations
  async function loadCreations(force) {
    if (CR.busy || (!force && Date.now() - CR.at < 1500)) return;
    CR.busy = true; const mine = ++CR.seq;
    try { const list = await call('views', {op: 'creations'}); if (mine === CR.seq) { CR.list = list; CR.error = ''; } }
    catch (e) { if (mine === CR.seq) CR.error = errText(e); }
    finally { CR.busy = false; CR.at = Date.now(); if (tab === 'tasks') drawCreations(); }
  }
  function matches(c) {
    const q = CR.q.trim().toLowerCase();
    if (q && !(c.title + ' ' + c.description + ' ' + (c.tags || []).join(' ')).toLowerCase().includes(q)) return false;
    if (CR.filter === 'fav') return c.favorite;
    if (CR.filter === 'scheduled') return !!c.nextRunAt;
    if (CR.filter === 'attention') return c.needsAttention;
    return true;
  }
  function deviceLine(c) { const d = c.device; return '<span class="crdev ' + d.state + '" title="' + esc(d.why || d.label) + '">' + icon('phone') + esc(d.label) + (d.state === 'ready' ? '' : ' · ' + esc(d.state === 'busy' ? 'busy' : d.state === 'offline' ? 'not ready' : 'no phone')) + '</span>'; }
  function cardBody(c) {
    const last = c.last ? '<span class="pill ' + OUT_CLS[c.last.outcome] + '">' + esc(c.last.label) + '</span> <span class="muted small">' + esc(ago(c.last.at)) + '</span>' + (c.last.reason ? '<span class="muted small crreason" title="' + esc(c.last.reason) + '"> · ' + esc(c.last.reason) + '</span>' : '') : '<span class="muted small">Not run yet</span>';
    const state = c.live ? '<div class="crlive"><span class="led on"></span><b>' + esc(c.live.label) + '</b>' + (c.live.step ? '<span class="muted small"> · ' + esc(c.live.step) + '</span>' : '') + '</div>'
      : c.needsSetup ? '<div class="crlive sand">' + icon('edit') + 'Needs setup: add blocks in Sandbox</div>' : '<div class="crlast">' + last + '</div>';
    return '<div class="crtop"><span class="cricon">' + icon(c.icon || 'sandbox') + '</span><div class="crname"><h3>' + esc(c.title) + '</h3>' + (c.description ? '<p class="muted small">' + esc(c.description) + '</p>' : '') + '</div>'
      + '<button class="icon ghost crstar' + (c.favorite ? ' on' : '') + '" data-cr="fav" aria-pressed="' + c.favorite + '" aria-label="' + (c.favorite ? 'Remove from favorites' : 'Add to favorites') + '" title="Favorite">' + icon('star', c.favorite ? 'sand' : '') + '</button></div>'
      + '<div class="crmeta small"><span>' + c.steps + ' step' + (c.steps === 1 ? '' : 's') + '</span><span>v' + c.revision + '</span>' + deviceLine(c) + (c.nextRunAt ? '<span>' + icon('calendar') + 'next ' + esc(when(c.nextRunAt)) + '</span>' : '') + '</div>'
      + state;
  }
  function cardActs(c) {
    if (c.live) {
      const paused = c.live.status === 'PAUSED' || c.live.status === 'NEEDS_ATTENTION';
      return '<button class="small" data-cr="' + (paused ? 'resume' : 'pause') + '">' + icon(paused ? 'play' : 'pause') + (paused ? 'Resume' : 'Pause') + '</button><button class="small danger" data-cr="stop">' + icon('stop') + 'Stop</button><button class="small ghost" data-cr="history">History</button>';
    }
    const off = c.needsSetup ? 'Add blocks in Sandbox first' : c.device.state === 'none' || c.device.state === 'offline' ? c.device.why : '';
    return '<button class="small primary" data-cr="run"' + (off ? ' disabled title="' + esc(off) + '"' : '') + '>' + icon('play') + 'Run now</button>'
      + '<button class="small" data-cr="schedule">' + icon('calendar') + 'Schedule</button><button class="small" data-cr="history">History</button><button class="small ghost" data-cr="edit">' + icon('edit') + 'Edit in Sandbox</button><button class="small ghost danger" data-cr="delete" title="Delete this creation (its schedules are turned off)">' + icon('trash') + 'Delete</button>';
  }
  function drawCreations() {
    const box = $('crlist'); if (!box) return;
    const all = CR.list;
    text($('crcount'), all ? String(all.length) : '');
    text($('crothercount'), String((S.tasks || []).length));
    if (!all) { htmlOnce(box, CR.error ? '<div class="empty" data-empty><span class="red">Creations could not be loaded: ' + esc(CR.error) + '</span><button data-cr="retry">Try again</button></div>' : '<div class="empty" data-empty><span class="load10"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="muted small">Loading creations…</span></div>'); return; }
    const shown = all.filter(matches);
    if (!all.length) { htmlOnce(box, '<div class="empty" data-empty><img src="dragon.png" alt=""><span>No creations yet. Build one in Sandbox: line up taps, swipes and waits, or press Teach and show Falcor.</span><button class="primary" data-cr="new">' + icon('plus') + 'New in Sandbox</button></div>'); return; }
    if (!shown.length) { htmlOnce(box, '<div class="empty" data-empty><span>Nothing matches' + (CR.q ? ' "' + esc(CR.q) + '"' : '') + ' in ' + esc({all: 'All', fav: 'Favorites', scheduled: 'Scheduled', attention: 'Needs attention'}[CR.filter]) + '.</span><button data-cr="clear">Show all</button></div>'); return; }
    if (box.querySelector('[data-empty]')) box.innerHTML = '';
    keyed(box, shown, c => c.id, () => P.el('<article class="panel crcard"><div class="crbody"></div><div class="cracts"></div></article>'), (n, c) => {
      n.dataset.seq = c.seqId; cls(n, 'run', !!c.live); cls(n, 'needs', c.needsAttention && !c.live);
      htmlOnce(n.querySelector('.crbody'), cardBody(c)); htmlOnce(n.querySelector('.cracts'), cardActs(c)); P.fix(n);
    });
  }
  window.renderCreations = function () {
    setView(CR.view, true);
    if (CR.view === 'creations') { drawCreations(); void loadCreations(false); }
  };
  function setView(v, quiet) {
    CR.view = v;
    document.querySelectorAll('#crview [data-v]').forEach(b => { cls(b, 'on', b.dataset.v === v); b.setAttribute('aria-selected', String(b.dataset.v === v)); });
    $('crmain').hidden = v !== 'creations'; $('crother').hidden = v !== 'other';
    if (!quiet && v === 'creations') void loadCreations(true);
    if (!quiet && v === 'other' && typeof renderTasks === 'function') renderTasks();
  }
  // Links that carry a mission (a task from Games, Falcor or a notice) open Other automations; a sequence id opens its card.
  window.crShow = function (ref) {
    const seq = typeof ref === 'string' && /^sq\w+$/.test(ref);
    setView(ref && !seq ? 'other' : 'creations');
    if (seq) setTimeout(() => { const n = document.querySelector('.crcard[data-seq="' + ref + '"]'); if (n) { n.scrollIntoView({block: 'center'}); n.classList.remove('flash'); void n.offsetWidth; n.classList.add('flash'); } }, 250);
  };
  $('crview').onclick = e => { const b = e.target.closest('[data-v]'); if (b) setView(b.dataset.v); };
  $('crfilter').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; CR.filter = b.dataset.f; $('crfilter').querySelectorAll('button').forEach(x => cls(x, 'on', x === b)); drawCreations(); };
  $('crsearch').oninput = e => { CR.q = e.target.value; drawCreations(); };
  $('crnew').onclick = () => { go('sandbox'); };
  $('crlist').addEventListener('click', async e => {
    const b = e.target.closest('[data-cr]'); if (!b || b.disabled) return;
    const act = b.dataset.cr, card = b.closest('.crcard'), c = card && CR.list ? CR.list.find(x => x.seqId === card.dataset.seq) : null;
    if (act === 'retry') return void loadCreations(true);
    if (act === 'new') return go('sandbox');
    if (act === 'clear') { CR.q = ''; CR.filter = 'all'; $('crsearch').value = ''; $('crfilter').querySelectorAll('button').forEach(x => cls(x, 'on', x.dataset.f === 'all')); return drawCreations(); }
    if (!c) return;
    b.disabled = true;
    try {
      if (act === 'run') await window.qRun({type: 'sequence', id: c.seqId}, {name: c.title});
      if (act === 'schedule') await window.openScheduler({target: {type: 'sequence', id: c.seqId}});
      if (act === 'edit') { go('sandbox'); if (window.sbOpen) await window.sbOpen(c.seqId); }
      if (act === 'history') history(c, b);
      if (act === 'fav') await call('sandbox', {op: 'meta', id: c.seqId, favorite: !c.favorite});
      if (act === 'delete' && confirm('Delete "' + c.title + '"? Its schedules are turned off.')) { await call('sandbox', {op: 'remove', id: c.seqId}); toast('Deleted "' + c.title + '".'); }
      if (c.live && (act === 'pause' || act === 'resume' || act === 'stop')) await call('sandbox', {op: act, runId: c.live.runId});
    } catch (err) { toast(errText(err), 'warn'); }
    finally { b.disabled = false; void loadCreations(true); }
  });

  // ------------------------------------------------------------------ one dialog: a creation's history, a run's details
  let returnFocus = null;
  function openSheet(title, html, wire) {
    returnFocus = document.activeElement;
    const b = $('crsheetbody');
    b.innerHTML = '<div class="top"><div><p class="eyebrow">// HISTORY</p><h2 id="crsheettitle">' + esc(title) + '</h2></div><button class="ghost icon" data-close aria-label="Close">' + icon('close') + '</button></div>' + html;
    P.fix(b); $('crsheet').hidden = false; if (wire) wire(b); b.focus();
  }
  function closeSheet() { $('crsheet').hidden = true; $('crsheetbody').innerHTML = ''; if (returnFocus && returnFocus.focus) returnFocus.focus(); returnFocus = null; }
  $('crsheet').addEventListener('mousedown', e => { if (e.target === $('crsheet')) closeSheet(); });
  $('crsheetbody').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
  window.addEventListener('keydown', e => {
    if ($('crsheet').hidden) return;
    if (e.key === 'Escape') { e.stopPropagation(); closeSheet(); return; }
    if (e.key === 'Tab') { const f = [...$('crsheetbody').querySelectorAll('button:not([disabled]), [href], input, select, [tabindex="0"]')]; if (!f.length) return; const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
  }, true);
  function history(c) {
    openSheet(c.title, '<div class="actlist" id="crhist"></div><div class="actmore"><button id="crhistmore" hidden>Load more</button><p class="muted small" id="crhistnote"></p></div>', async b => {
      const st = {rows: [], next: null, seq: 0};
      const page = async () => {
        const mine = ++st.seq;
        try { const r = await call('views', {op: 'activity', query: {seqId: c.seqId, before: st.next || undefined, limit: 20}}); if (mine !== st.seq || $('crsheet').hidden) return; st.rows.push(...r.rows); st.next = r.next; drawRows(b.querySelector('#crhist'), st.rows, 'This creation has not run yet.'); b.querySelector('#crhistmore').hidden = !r.next; text(b.querySelector('#crhistnote'), r.retention); }
        catch (e) { htmlOnce(b.querySelector('#crhist'), '<p class="red small">' + esc(errText(e)) + '</p>'); }
      };
      b.querySelector('#crhistmore').onclick = page;
      b.querySelector('#crhist').addEventListener('click', onRowClick);
      await page();
    });
  }

  // ------------------------------------------------------------------ Activity
  const AC = {outcome: 'all', from: '', to: '', tests: false, rows: [], next: null, pages: 0, at: 0, busy: false, seq: 0, error: '', loaded: false};
  function rowHtml(r) {
    return '<button class="actrow" data-key="' + esc(r.key) + '" aria-expanded="false"><time>' + esc(r.time) + '</time><span class="nm"><b>' + esc(r.name) + '</b><span class="muted small">' + esc(r.type) + (r.mode !== 'run' ? ' · ' + esc(r.mode) : '') + ' · ' + esc(r.device) + (r.trigger ? ' · ' + esc(r.trigger) : '') + (r.attempt > 1 ? ' · attempt ' + r.attempt : '') + '</span></span>'
      + '<span class="muted small dur">' + esc(r.endedAt ? len(r.durationMs) : r.outcome === 'running' ? 'running' : '') + '</span><span class="pill ' + OUT_CLS[r.outcome] + '">' + esc(r.label) + '</span></button>'
      + (r.reason ? '<p class="muted small actwhy">' + esc(r.reason) + '</p>' : '') + '<div class="actdetail" hidden></div>';
  }
  const dayName = d => { const t = new Date(d + 'T12:00:00'); const today = new Date(); const y = new Date(Date.now() - 86400000); const k = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); return d === k(today) ? 'Today' : d === k(y) ? 'Yesterday' : t.toLocaleDateString([], {weekday: 'long', month: 'short', day: 'numeric'}); };
  function drawRows(box, rows, empty) {
    if (!rows.length) { htmlOnce(box, '<div class="empty" data-empty><span>' + esc(empty) + '</span></div>'); return; }
    if (box.querySelector('[data-empty]')) box.innerHTML = '';
    const items = []; let day = '';
    for (const r of rows) { if (r.day !== day) { day = r.day; items.push({key: 'day:' + day, day}); } items.push(r); }
    keyed(box, items, x => x.key, x => P.el(x.day && !x.name ? '<h4 class="actday"></h4>' : '<div class="actitem"></div>'), (n, x) => { if (x.day && !x.name) text(n, dayName(x.day)); else { const sig = x.outcome + x.endedAt + x.reason; if (n.dataset.sig !== sig) { n.dataset.sig = sig; n.innerHTML = rowHtml(x); } } });
  }
  async function onRowClick(e) {
    const b = e.target.closest('.actrow'); if (!b) return;
    const d = b.parentElement.querySelector('.actdetail'), open = d.hidden;
    d.hidden = !open; b.setAttribute('aria-expanded', String(open));
    if (!open || d.dataset.loaded) return;
    d.innerHTML = '<p class="muted small">Loading…</p>';
    try {
      const r = await call('views', {op: 'detail', key: b.dataset.key});
      d.dataset.loaded = '1';
      d.innerHTML = (r.revision ? '<p class="small muted">Version ' + r.revision + ' · ' + (r.actions || 0) + ' actions</p>' : '') + (r.events && r.events.length ? '<ol class="actevents">' + r.events.map(ev => '<li><time>' + esc(time(ev.at)) + '</time> ' + esc(ev.text || ev.type) + '</li>').join('') + '</ol>' : '') + (r.note ? '<p class="small muted">' + esc(r.note) + '</p>' : '');
    } catch (err) { d.innerHTML = '<p class="small red">' + esc(errText(err)) + '</p>'; }
  }
  function query(extra) { return {outcome: AC.outcome, from: AC.from || undefined, to: AC.to || undefined, includeTests: AC.tests, limit: 30, ...extra}; }
  async function loadActivity(more) {
    if (AC.busy) return; AC.busy = true; const mine = ++AC.seq;
    try {
      const r = await call('views', {op: 'activity', query: query(more ? {before: AC.next} : {})});
      if (mine !== AC.seq) return;
      AC.rows = more ? [...AC.rows, ...r.rows.filter(x => !AC.rows.some(y => y.key === x.key))] : r.rows; AC.next = r.next; AC.pages = more ? AC.pages + 1 : 1; AC.error = ''; AC.loaded = true;
      text($('actnote'), r.retention + ' Dates are in ' + r.tz + '.');
    } catch (e) { if (mine === AC.seq) AC.error = errText(e); }
    finally { AC.busy = false; AC.at = Date.now(); if (tab === 'settings' && sub === 'activity') drawActivity(); }
  }
  function drawActivity() {
    const box = $('actlist');
    if (AC.error && !AC.loaded) htmlOnce(box, '<div class="empty" data-empty><span class="red">Activity could not be loaded: ' + esc(AC.error) + '</span></div>');
    else if (!AC.loaded) htmlOnce(box, '<div class="empty" data-empty><span class="muted small">Loading activity…</span></div>');
    else drawRows(box, AC.rows, AC.outcome !== 'all' || AC.from || AC.to ? 'Nothing matches these filters.' : 'Nothing has run yet. Run a creation, or start Autopilot on the Phone tab.');
    $('actmore').hidden = !AC.next;
    const sp = S.spend || {teach: 0, chat: 0, autopilot: 0}, total = sp.teach + sp.chat + sp.autopilot;
    text($('actusage'), 'AI this month (estimated): ' + money(total) + (S.limit !== null && S.limit !== undefined ? ' of ' + money(S.limit) : '') + ' · the provider\'s bill is exact');
  }
  window.renderActivity = function () {
    drawActivity();
    // Fresh rows while only the first page is shown; with more pages loaded, the owner's place is kept.
    if (AC.pages <= 1 && Date.now() - AC.at > 3000) void loadActivity(false);
  };
  const refilter = () => { AC.pages = 0; AC.next = null; AC.loaded = false; drawActivity(); void loadActivity(false); };
  $('actfilter').onclick = e => { const b = e.target.closest('[data-o]'); if (!b) return; AC.outcome = b.dataset.o; $('actfilter').querySelectorAll('button').forEach(x => cls(x, 'on', x === b)); refilter(); };
  $('actfrom').onchange = e => { AC.from = e.target.value; refilter(); };
  $('actto').onchange = e => { AC.to = e.target.value; refilter(); };
  $('acttests').onchange = e => { AC.tests = e.target.checked; refilter(); };
  $('actmore').onclick = () => void loadActivity(true);
  $('actlist').addEventListener('click', onRowClick);
})();

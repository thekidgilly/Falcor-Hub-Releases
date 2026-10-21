// Falcor.Hub's Daily Queue in the window: Today's Queue and the current activity on the Phone tab, the one schedule
// editor (the queue, Games, Tasks and the Sandbox all open it), Play now / Run now with the one-controller question,
// and the details and history sheets. Loaded after app.js and sandbox.js and uses their helpers (S, call, toast, go,
// dev, icons). Everything is checked again on the computer's side (queue/index.ts); this page only asks.
(function () {
  const Q = {view: 'today', data: null, dataAt: 0, loading: false, fold: true, menuFor: null};
  const qcall = (op, a = {}) => call('queue', {op, ...a});
  const quiet = (op, a = {}) => window.hub.call('queue', {op, ...a});
  const qs = () => S && S.queue || null;
  const qdev = () => { const q = qs(), d = dev(); return q && d ? q.devices[d.id] || null : null; };
  const KIND = {game: ['game', 'Game'], task: ['tasks', 'Task'], sequence: ['sandbox', 'Sequence']};
  const MOOD = {SCHEDULED: 'muted', READY: 'ready', RUNNING: 'run', PAUSED: 'sand', BLOCKED: 'red', WAITING_FOR_USER: 'sand', COMPLETED: 'green', FAILED: 'red', SKIPPED: 'muted', MISSED: 'sand', CANCELLED: 'muted', INTERRUPTED: 'sand'};
  const ENDED = new Set(['COMPLETED', 'FAILED', 'SKIPPED', 'MISSED', 'CANCELLED', 'INTERRUPTED']);
  const PRI = ['', 'Lowest', 'Low', 'Normal', 'High', 'Highest'];
  const hm = at => new Date(at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hourCycle: 'h23'});
  const dayOf = at => { const d = new Date(at), t = new Date(), y = new Date(Date.now() + 86_400_000); return d.toDateString() === t.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Tomorrow' : d.toLocaleDateString([], {weekday: 'short', month: 'short', day: 'numeric'}); };
  const pad2 = n => String(n).padStart(2, '0');
  const tgt = v => { const i = String(v).indexOf(':'); return {type: v.slice(0, i), id: v.slice(i + 1)}; };
  const tv = t => t.type + ':' + t.id;
  const kindIcon = (kind, pkg) => { const u = pkg && icons.get(pkg); return u ? '<img src="' + esc(u) + '" alt="">' : icon((KIND[kind] || KIND.task)[0]); };
  const pill = (status, label) => '<span class="qpill s-' + (MOOD[status] || 'muted') + '">' + (status === 'RUNNING' ? '<i class="led active"></i>' : '') + esc(String(label || status).toUpperCase()) + '</span>';
  const minsOf = ms => Math.max(0, Math.floor(ms / 60000));
  // The run's step line; while Falcor AI is asked, how long it has been thinking, so a slow answer never looks frozen.
  let seenStep = {t: '', at: 0};
  const stepLine = t => { if (t !== seenStep.t) seenStep = {t, at: Date.now()}; return '<div class="step">' + esc(t) + (/^Asking Falcor AI/.test(t) ? ' <span class="muted" data-since="' + seenStep.at + '"></span>' : '') + '</div>'; };

  // ------------------------------------------------------------------ the current activity (a window on the Phone tab)
  window.renderCurrent = function (d) {
    const q = qdev(), cur = q && q.current, run = !cur && S.tasks.find(t => t.state === 'RUNNING' && t.deviceId === d.id), sbl = !cur && d.sandbox, next = q && q.next;
    const mode = !q ? '' : q.mode === 'autopilot' ? (q.paused ? 'QUEUE PAUSED' : 'AUTOPILOT') : q.mode === 'ready' ? 'RUN READY · ' + q.batch : q.paused ? 'QUEUE PAUSED' : '';
    text($('qmode'), mode); $('qmode').className = 'winx qmode' + (q && q.paused ? ' sand' : q && q.mode ? ' on' : '');
    const nextLine = next ? '<div class="qnext">Next: <b>' + esc(next.name) + '</b> · ' + (dayOf(next.at) === 'Today' ? '' : esc(dayOf(next.at)) + ' ') + esc(hm(next.at)) + ' <span class="muted">(' + esc(when(next.at)) + ')</span></div>' : '';
    let html;
    if (cur) {
      const [ic, word] = KIND[cur.kind] || KIND.task, paused = cur.status === 'PAUSED' || cur.status === 'WAITING_FOR_USER';
      const n = 20, on = cur.durationMin ? Math.round(Math.min(1, (Date.now() - cur.startedAt) / (cur.durationMin * 60000)) * n) : 0;
      html = '<div class="qcur s-' + (MOOD[cur.status] || 'run') + '"><div class="qhead"><span class="qico">' + kindIcon(cur.kind, cur.pkg) + '</span><b>' + esc(cur.name) + '</b><span class="qtime" data-start="' + cur.startedAt + '" data-dur="' + (cur.durationMin || '') + '"></span></div>'
        + '<div class="qsub">' + pill(cur.status, cur.label) + '<span>' + esc(word) + ' · ' + esc(cur.triggerLabel) + (cur.attempt > 1 ? ' · attempt ' + cur.attempt : '') + '</span></div>'
        + (cur.durationMin ? '<div class="progress qprog" data-style="--n:' + n + '">' + Array.from({length: n}, (_, i) => '<i class="' + (i < on ? 'on' : '') + '"></i>').join('') + '</div>' : '')
        + stepLine(cur.reason || d.step || 'Working…') + perfLine(d.perf)
        // (Resume only for this activity itself paused; the schedule's own pause is the queue bar's switch)
        + '<div class="row qctl">' + (paused ? '<button class="small primary" data-qctl="resume">' + icon('play') + 'Resume</button>' : '<button class="small" data-qctl="pause">' + icon('pause') + 'Pause</button>')
        + (cur.key ? '<button class="small" data-qctl="skip" title="Skip it and go on with the next">' + icon('skip') + 'Skip</button>' : '')
        + '<button class="small danger" data-qctl="stop" title="Stop it' + (cur.key ? ' and the queue' : '') + '">' + icon('stop') + 'Stop</button>'
        + (!controlling ? '<button class="small icon" data-qctl="take" title="Take control of the phone (the run pauses for you)">' + icon('control') + '</button>' : '') + '</div>' + nextLine + '</div>';
      void ic;
    } else if (run) {
      const n = run.targetLevel ? Math.min(20, run.targetLevel) : 10, done = run.targetLevel ? Math.round(Math.min(1, (run.level || 0) / run.targetLevel) * n) : 0;
      html = '<div class="mission"><div class="what"><b>' + esc(run.app) + '</b> · ' + esc(run.objective) + ' <span class="muted small">· when due</span></div>'
        + (run.targetLevel ? '<div class="progress" data-style="--n:' + n + '">' + Array.from({length: n}, (_, i) => '<i class="' + (i < done ? 'on' : '') + '"></i>').join('') + '</div><span class="muted small">Level ' + esc(run.level ?? '?') + ' of ' + esc(run.targetLevel) + '</span>' : '')
        + stepLine(d.step || 'Working…') + '<div class="row"><span class="muted small">Elapsed ' + clock(Date.now() - (run.history.find(h => h.to === 'Running')?.at || Date.now())) + '</span><span class="grow"></span><button class="small" data-task="' + esc(run.id) + '" data-act="pause">' + icon('pause') + 'Pause</button></div></div>';
    } else if (sbl) {
      const paused = sbl.status === 'PAUSED' || sbl.status === 'NEEDS_ATTENTION';
      html = '<div class="qcur s-run"><div class="qhead"><span class="qico">' + icon('sandbox') + '</span><b>' + esc(sbl.title) + '</b><span class="qtime">' + clock(sbl.elapsedMs || 0) + '</span></div><div class="qsub">' + pill(paused ? 'PAUSED' : 'RUNNING', paused ? 'Paused' : 'Running') + '<span>Sequence · Sandbox</span></div><div class="step">' + esc(sbl.step || sbl.reason || '') + '</div>'
        + '<div class="row qctl"><button class="small" data-sbctl="' + (paused ? 'resume' : 'pause') + '">' + icon(paused ? 'play' : 'pause') + (paused ? 'Resume' : 'Pause') + '</button><button class="small danger" data-sbctl="stop">' + icon('stop') + 'Stop</button></div>' + nextLine + '</div>';
    } else if (q && q.mode === 'autopilot') {
      const all = S.queue.counts, done = all.total > 0 && all.left === 0;
      html = '<div class="qidle"><b class="qbig">AUTOPILOT ACTIVE</b><span class="qwait">' + (q.paused ? 'QUEUE PAUSED' : done ? 'ALL OF TODAY\'S ACTIVITIES DONE' : 'WAITING FOR NEXT ACTIVITY') + '</span>'
        + (next ? '<span>Next: <b>' + esc(next.name) + '</b> · ' + (dayOf(next.at) === 'Today' ? '' : esc(dayOf(next.at)) + ' ') + esc(hm(next.at)) + ' <span class="muted">(' + esc(when(next.at)) + ')</span></span>' : '<span class="muted small">Nothing else is scheduled. Approved tasks without a schedule still run when they are due.</span>')
        + (q.paused ? '<div class="row"><button class="small primary" data-qctl="resume">' + icon('play') + 'Resume scheduled runs</button></div>' : '') + '</div>';
    } else {
      const todo = S.queue ? S.queue.items.filter(i => i.deviceId === d.id && i.status === 'READY').length : 0;
      html = '<div class="idle"><span class="sleep"><img src="dragon.png" alt=""></span><span>Nothing is running.' + (next ? '<br>Next: <b>' + esc(next.name) + '</b> · ' + esc(hm(next.at)) + ' ' + esc(when(next.at)) : '<br>Schedule a game, a playbook or a creation: it runs here at its time.') + (todo ? '<br><span class="sand">' + todo + ' due now' + (q && q.paused ? ': the queue is paused.' : ': starting in turn.') + '</span>' : '') + '</span></div>'
        + (q && q.paused ? '<div class="row"><button class="small primary" data-qctl="resume">' + icon('play') + 'Resume scheduled runs</button></div>' : '');
    }
    htmlOnce($('missionbody'), html); tickTimes();
    // The queue's one switch: paused, nothing new starts by itself; running, what is scheduled starts at its time.
    const paused = !!(q && q.paused);
    text($('qtogglelabel'), paused ? 'Resume schedule' : 'Pause schedule');
    $('qtoggle').className = 'small' + (paused ? ' primary' : ''); $('qtoggle').firstElementChild.className = 'led' + (paused ? '' : ' active');
    $('qtoggle').disabled = !!d.emergency; $('qtoggle').dataset.op = paused ? 'resume' : 'pause';
    ticker(d, q, cur, next, paused);
  };
  // The run measured as it goes (engine.ts#perf): AI asks and their average time, moves made without the AI, words
  // placed and time lost to ads. Nothing shown before the first count.
  function perfLine(p) {
    if (!p || !p.running) return '';
    const sec = ms => ms == null ? '–' : (ms / 1000).toFixed(ms < 10000 ? 1 : 0) + ' s', mins = Math.max(p.minutes, 1 / 60);
    const parts = [['AI', p.aiCalls + (p.aiCalls ? ' · ' + sec(p.aiAvgMs) + ' avg' : '')], ['Local', p.local + (p.burst ? ' · ' + p.burst + ' fast' : '')]];
    if (p.words) parts.push(['Words', p.words + ' · ' + (p.words / mins).toFixed(1) + '/min']);
    parts.push(['Ads', clock(p.adMs)]);
    // (how fast the phone is looked at: the average look, how many took the video frame, and what the UI dumps cost)
    if (p.looks) parts.push(['Look', sec(p.looks.avgMs) + (p.looks.video ? ' · ' + Math.round(100 * p.looks.video / p.looks.n) + '% video' : '') + (p.looks.dumps ? ' · ' + p.looks.dumps + ' dumps ' + sec(p.looks.dumpAvgMs) : '')]);
    return '<div class="qperf">' + parts.map(([k, v]) => '<span><b>' + esc(k) + '</b> ' + esc(v) + '</span>').join('') + '</div>';
  }
  // The LED ticker over the queue: where the schedule stands, and in passing what it is for.
  function ticker(d, q, cur, next, paused) {
    const box = $('qticker'); if (!box) return;
    // (while paused the queue names no next time: what is lined up is counted instead)
    const waiting = S.queue ? S.queue.items.filter(i => i.deviceId === d.id && ['READY', 'SCHEDULED', 'WAITING'].includes(i.status)).length
      + (S.queue.whenDue || []).filter(w => w.deviceId === d.id && ['READY', 'SCHEDULED'].includes(w.state)).length : 0;
    const up = next ? 'NEXT UP: ' + next.name + ' AT ' + hm(next.at) + (dayOf(next.at) === 'Today' ? ' (' + when(next.at) + ')' : ' ' + dayOf(next.at))
      : waiting ? waiting + ' IN THE LINE-UP' : 'NOTHING LINED UP YET';
    const msg = (d.emergency ? ['EMERGENCY STOP IS ON', 'NOTHING RUNS UNTIL YOU CLEAR IT']
      : cur ? ['NOW PLAYING: ' + cur.name, cur.durationMin ? 'UP TO ' + cur.durationMin + ' MIN, LESS IF THE GAME RUNS DRY' : 'RUNNING', paused ? 'SCHEDULE PAUSED: NOTHING ELSE STARTS BY ITSELF' : next || waiting ? up : 'NOTHING ELSE LINED UP AFTER IT', 'ONE AT A TIME ON THIS PHONE']
      : paused ? ['SCHEDULE PAUSED', 'NOTHING STARTS BY ITSELF', up, 'PLAY NOW ON A GAME STILL WORKS', 'RESUME SCHEDULE TO LET THE LINE-UP RUN']
      : ['SCHEDULE ON', up, 'GAMES AND PLAYBOOKS TAKE TURNS BY THEMSELVES', 'AN HOUR OF PLAY AT MOST, THEN THE NEXT ONE GOES']).join('   ✦   ').toUpperCase();
    // (its colour is the schedule's: gold while paused, green while on)
    box.className = 'ticker' + (d.emergency ? ' red' : paused ? ' sand' : '');
    if (box.dataset.msg === msg) return;
    box.dataset.msg = msg;
    // Twice in a row, so the loop is seamless; its speed follows its length.
    box.firstElementChild.textContent = msg + '   ✦   ' + msg + '   ✦   ';
    box.style.setProperty('--dur', Math.max(12, Math.round(msg.length / 5)) + 's');
  }
  function tickTimes() {
    for (const el of document.querySelectorAll('[data-start]')) { const ms = Date.now() - Number(el.dataset.start), dur = Number(el.dataset.dur); text(el, dur ? minsOf(ms) + ' / ' + dur + ' MIN' : clock(ms)); }
    for (const el of document.querySelectorAll('[data-since]')) text(el, '· thinking ' + Math.max(0, Math.round((Date.now() - Number(el.dataset.since)) / 1000)) + ' s');
  }
  setInterval(() => { if (tab === 'phone') tickTimes(); }, 1000);
  $('missionbody').addEventListener('click', async e => {
    const b = e.target.closest('[data-qctl]'), sbc = e.target.closest('[data-sbctl]'), d = dev(); if (!d) return;
    if (b) {
      const op = b.dataset.qctl;
      if (op === 'take') { await call('take', {deviceId: d.id}); toast('You have control. The run pauses; release the phone to let it carry on.'); return; }
      b.classList.add('busy');
      try { await qcall(op, {deviceId: d.id}); toast({pause: 'Queue paused. Nothing new starts until you resume it.', resume: 'Queue resumed.', skip: 'Skipped. The next activity starts in its turn.', stop: 'Stopped. Autopilot is off on this phone.'}[op]); } finally { b.classList.remove('busy'); }
    }
    if (sbc && d.sandbox) { await call('sandbox', {op: sbc.dataset.sbctl, runId: d.sandbox.runId}); }
  });
  $('qtoggle').onclick = async () => { const d = dev(); if (!d) return; const op = $('qtoggle').dataset.op || 'pause'; const r = await qcall(op, {deviceId: d.id}); toast(op === 'pause' ? 'Schedule paused. Nothing starts by itself until you resume it; Play now still works.' : r && r.started ? 'Schedule resumed: ' + r.started + ' is playing now; the rest follow in turn.' : 'Schedule resumed: nothing else is lined up today, so the next one starts at its time.'); };

  // ------------------------------------------------------------------ Today's Queue (a window on the Phone tab)
  document.querySelectorAll('#qviews button').forEach(b => b.onclick = () => { Q.view = b.dataset.v; Q.data = null; document.querySelectorAll('#qviews button').forEach(x => cls(x, 'on', x === b)); $('qlist').innerHTML = ''; delete $('qlist').dataset.ready; void load(true); });
  async function load(force) {
    if (Q.view === 'today' || Q.loading || (!force && Date.now() - Q.dataAt < 4000)) return;
    const d = dev(); if (!d) return;
    Q.loading = true;
    try { Q.data = await quiet('view', {range: Q.view, deviceId: d.id}); Q.dataAt = Date.now(); } catch { /* the next status tries again */ }
    Q.loading = false;
    if (tab === 'phone') renderQueue(d);
  }
  window.renderQueue = function (d) {
    const q = qs(); if (!q || !d) return;
    if (Q.view !== 'today') { void load(false); if (!Q.data) { htmlOnce($('qlist'), '<li class="qempty" data-empty>Loading…</li>'); return; } }
    const v = Q.view === 'today' ? {items: q.items.filter(i => i.deviceId === d.id), counts: q.counts, notes: q.notes, doneBy: q.doneBy, whenDue: q.whenDue.filter(w => w.deviceId === d.id)} : Q.data;
    const box = $('qlist'), rows = [];
    if (Q.view === 'history') {
      const st = v.stats;
      text($('qsum'), st.runs ? st.completed + ' of ' + st.runs + ' completed · 14 days' : '14 days');
      for (const r of v.items) rows.push({k: 'h:' + r.id, h: r});
    } else {
      const items = v.items.slice().sort((a, b) => a.at - b.at), ended = items.filter(i => ENDED.has(i.status) && !i.live), left = items.length - ended.length;
      text($('qsum'), Q.view === 'today' ? (v.counts.total ? 'COMPLETED ' + v.counts.completed + ' / ' + v.counts.total + (v.doneBy ? ' · done ≈ ' + hm(v.doneBy) : '') : '') : items.length + ' planned');
      const num = new Map(items.map((i, n) => [i.key, n + 1]));
      if (Q.view === 'today' && ended.length && Q.fold) rows.push({k: 'fold', fold: ended});
      let day = '';
      for (const i of items) {
        if (Q.view === 'today' && Q.fold && ENDED.has(i.status) && !i.live) continue;
        if (Q.view === 'upcoming' && i.day !== day) { day = i.day; rows.push({k: 'd:' + day, head: dayOf(i.at)}); }
        rows.push({k: i.key, i, n: num.get(i.key)});
      }
      if (Q.view === 'today' && ended.length && !Q.fold) rows.push({k: 'unfold', unfold: true});
      if (Q.view === 'today' && v.whenDue.length) { rows.push({k: 'g:due', head: v.whenDue.every(w => w.state === 'RUNNING') ? 'PLAYING NOW' : 'READY · NO SET TIME · ' + v.whenDue.length, tip: 'Approved tasks with no time of their own: Play now or Resume schedule starts them; schedule one (···) to give it a time.'}); for (const w of v.whenDue) rows.push({k: 'w:' + w.id, w}); }
      if (!items.length && !v.whenDue?.length) rows.push({k: 'empty', empty: S.queue.schedules ? (Q.view === 'today' ? 'Nothing scheduled today.' : 'Nothing scheduled ' + (Q.view === 'tomorrow' ? 'tomorrow' : 'in the next 7 days') + '.') + (qdev() && qdev().next ? ' Next: ' + qdev().next.name + ', ' + dayOf(qdev().next.at).toLowerCase() + ' ' + hm(qdev().next.at) + '.' : '') : 'No activities scheduled yet. Press + (or Schedule on a game, a task or a sequence).'});
      else if (Q.view === 'today' && !left && items.length) rows.push({k: 'alldone', empty: 'All of today\'s activities are done.'});
    }
    keyed(box, rows, r => r.k, r => P.el(r.i || r.h ? '<li class="qrow"><span class="qn"></span><span class="qico"></span><div class="qmain"><span class="qname"></span><span class="qmeta"></span><span class="qwhy"></span></div><span class="qst"></span><button class="ghost icon small qmore" title="Actions">' + icon('dots') + '</button></li>'
      : r.w ? '<li class="qrow due"><span class="qn"></span><span class="qico"></span><div class="qmain"><span class="qname"></span><span class="qmeta"></span></div><span class="qst"></span><button class="ghost icon small qmore" title="Actions">' + icon('dots') + '</button></li>'
      : r.fold || r.unfold ? '<li class="qfold"><button class="ghost small"></button></li>' : r.head ? '<li class="qhead2"></li>' : '<li class="qempty"></li>'), (n, r) => {
      if (r.i) drawItem(n, r.i, r.n);
      else if (r.h) drawHist(n, r.h);
      else if (r.w) { const qn = n.querySelector('.qn'); text(qn, r.w.state === 'RUNNING' ? 'NOW' : r.w.nextAt && r.w.nextAt > Date.now() ? hm(r.w.nextAt) : 'READY'); qn.classList.add('qtimecol'); htmlOnce(n.querySelector('.qico'), kindIcon(r.w.type === 'game_level' ? 'game' : 'task', r.w.pkg)); text(n.querySelector('.qname'), r.w.name); text(n.querySelector('.qmeta'), r.w.app + ' · ' + (r.w.nextAt && r.w.nextAt > Date.now() ? 'from ' + hm(r.w.nextAt) : 'no set time')); htmlOnce(n.querySelector('.qst'), pill(r.w.state === 'RUNNING' ? 'RUNNING' : r.w.state === 'NEEDS_ATTENTION' ? 'WAITING_FOR_USER' : r.w.state === 'ACTION_VERIFIED' ? 'COMPLETED' : 'SCHEDULED', r.w.state === 'NEEDS_ATTENTION' ? 'Waiting for user' : r.w.stateLabel)); n.dataset.w = r.w.id; }
      else if (r.fold) { const c = r.fold.filter(i => i.status === 'COMPLETED').length; htmlOnce(n.firstElementChild, icon('check') + esc(r.fold.length + ' finished today' + (c !== r.fold.length ? ' (' + c + ' completed)' : '') + ' · show')); }
      else if (r.unfold) htmlOnce(n.firstElementChild, icon('chevron') + 'Hide finished');
      else if (r.head) { text(n, r.head); n.title = r.tip || ''; }
      else text(n, r.empty);
    });
    // Advice from the queue's own record: never applied by itself.
    const notes = v.notes || [];
    htmlOnce($('qnotes'), notes.slice(0, 2).map(x => '<p class="qnote ' + esc(x.kind) + '"' + (x.key ? ' data-qkey="' + esc(x.key) + '"' : '') + ' title="' + esc(x.text) + '">' + icon(x.kind === 'overlap' || x.kind === 'long' ? 'clock' : x.kind === 'failing' ? 'stop' : 'lock') + '<span>' + esc(x.text) + '</span></p>').join('') + (notes.length > 2 ? '<p class="qnote more" data-allnotes>+' + (notes.length - 2) + ' more</p>' : ''));
  };
  function drawItem(n, i, num) {
    n.className = 'qrow s-' + (MOOD[i.status] || 'muted') + (i.live ? ' live' : '');
    // (its time first and plain: when it runs, or NOW while it runs)
    text(n.querySelector('.qn'), i.live ? 'NOW' : ENDED.has(i.status) ? pad2(num) : hm(i.at)); n.querySelector('.qn').classList.toggle('qtimecol', !ENDED.has(i.status) || i.live);
    htmlOnce(n.querySelector('.qico'), kindIcon(i.kind, i.pkg)); n.querySelector('.qico').title = (KIND[i.kind] || KIND.task)[1];
    text(n.querySelector('.qname'), i.name);
    const dep = (i.deps || []).filter(x => x.state !== 'ok').map(x => x.name);
    htmlOnce(n.querySelector('.qmeta'), esc((Q.view === 'today' && dayOf(i.at) !== 'Today' ? dayOf(i.at) + ' ' : '') + i.time) + (i.durationMin ? ' · ' + i.durationMin + ' min' : i.estMin ? ' · ≈' + i.estMin + ' min' : '') + (i.priority > 3 ? ' · <span class="sand">' + icon('up', 'sand') + PRI[i.priority].toLowerCase() + '</span>' : i.priority < 3 ? ' · ' + icon('down') + PRI[i.priority].toLowerCase() : '') + (i.autoStart ? ' · auto' : '') + (i.adhoc ? ' · added' : '') + (dep.length ? ' · after ' + esc(dep.join(', ')) : '') + (i.live && i.elapsedMs !== null ? ' · <span class="qtime" data-start="' + i.startedAt + '" data-dur="' + (i.durationMin || '') + '"></span>' : ''));
    const why = i.status === 'COMPLETED' ? (i.verified ? '✓ ' : '') + (i.result || i.reason) : i.status === 'SCHEDULED' && !i.reason ? '' : i.reason;
    text(n.querySelector('.qwhy'), why || ''); n.querySelector('.qwhy').hidden = !why; n.title = i.name + ' · ' + i.label + (why ? ': ' + why : '');
    htmlOnce(n.querySelector('.qst'), pill(i.status, i.label));
  }
  function drawHist(n, h) {
    n.className = 'qrow hist s-' + (MOOD[h.status] || 'muted');
    text(n.querySelector('.qn'), new Date(h.at).toLocaleDateString([], {month: 'numeric', day: 'numeric'}));
    htmlOnce(n.querySelector('.qico'), kindIcon(h.kind, h.pkg));
    text(n.querySelector('.qname'), h.name);
    text(n.querySelector('.qmeta'), hm(h.at) + ' · ' + h.triggerLabel + (h.durationMs !== null ? ' · ' + (h.durationMs < 60000 ? Math.max(1, Math.round(h.durationMs / 1000)) + ' s' : minsOf(h.durationMs) + ' min') : '') + (h.retries ? ' · retry ' + h.retries : ''));
    const why = h.status === 'COMPLETED' ? (h.verified ? '✓ ' : '') + (h.result || h.reason) : h.reason;
    text(n.querySelector('.qwhy'), why || ''); n.querySelector('.qwhy').hidden = !why; n.title = why || '';
    htmlOnce(n.querySelector('.qst'), pill(h.status, h.label));
    n.querySelector('.qmore').hidden = !h.key;
  }
  $('qlist').addEventListener('click', e => {
    const f = e.target.closest('.qfold'); if (f) { Q.fold = !Q.fold; renderQueue(dev()); return; }
    const m = e.target.closest('.qmore'), li = e.target.closest('.qrow'); if (!li) return;
    if (m) { e.stopPropagation(); openMenu(m, li); return; }
    if (li.dataset.w) { followLink('tasks', li.dataset.w); return; }
    const key = li.dataset.key.startsWith('h:') ? (Q.data && Q.data.items.find(x => 'h:' + x.id === li.dataset.key) || {}).key : li.dataset.key;
    if (key) void qDetails(key);
  });
  $('qnotes').addEventListener('click', e => {
    if (e.target.closest('[data-allnotes]')) { const v = Q.view === 'today' ? qs() : Q.data; sheet(head('ADVICE', 'From the queue\'s own record') + '<ul class="qenotes">' + ((v && v.notes) || []).map(x => '<li>' + icon('clock') + esc(x.text) + '</li>').join('') + '</ul><p class="muted small">Nothing here is changed by itself: edit a schedule to act on it.</p><div class="row"><button data-close>Close</button></div>'); return; }
    const p = e.target.closest('[data-qkey]'); if (p) void qDetails(p.dataset.qkey);
  });
  $('qadd').onclick = () => openScheduler({});

  // The row menu: details, run now, edit, priority, skip today, remove from the queue, schedule off, history.
  function itemOf(key) { const q = qs(); return (q && q.items.find(i => i.key === key)) || (Q.data && Q.data.items && Q.data.items.find(i => i.key === key)) || null; }
  function openMenu(btn, li) {
    const menu = $('qmenu'), w = li.dataset.w, key = li.dataset.key.startsWith('h:') ? (Q.data && Q.data.items.find(x => 'h:' + x.id === li.dataset.key) || {}).key : li.dataset.key, i = key && itemOf(key);
    if (Q.menuFor === li.dataset.key && !menu.hidden) { closeMenu(); return; }
    Q.menuFor = li.dataset.key;
    const opt = (act, label, ic, extra = '') => '<button class="small ghost" data-m="' + act + '"' + extra + '>' + icon(ic) + esc(label) + '</button>';
    if (w) menu.innerHTML = opt('wrun', 'Run now', 'play') + opt('wsched', 'Schedule…', 'calendar') + opt('wopen', 'Open in Tasks', 'tasks');
    else if (i) {
      const live = i.live, ended = ENDED.has(i.status) && i.status !== 'WAITING_FOR_USER', skipped = i.status === 'SKIPPED' && /today by you/.test(i.reason);
      menu.innerHTML = opt('details', 'View details', 'eye') + (!live && !ended ? opt('run', 'Run now', 'play') : '') + (!i.adhoc ? opt('edit', 'Edit schedule', 'calendar') : '')
        + '<div class="qpri"><span class="muted small">Priority</span>' + [1, 2, 3, 4, 5].map(p => '<button class="small' + (p === i.priority ? ' on' : '') + '" data-m="pri" data-p="' + p + '" title="' + PRI[p] + '">' + p + '</button>').join('') + '</div>'
        + (!i.adhoc ? opt('skip', skipped ? 'Back in today\'s queue' : 'Skip today', 'skip') : '') + (!live && !ended ? opt('cancel', 'Remove from queue', 'close') : '')
        + (!i.adhoc ? opt('off', 'Disable schedule', 'pause') : '') + opt('history', 'View history', 'clock');
    } else return;
    menu.hidden = false; P.fix(menu);
    const r = btn.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(innerWidth - mw - 8, r.right - mw)) + 'px'; menu.style.top = (r.bottom + mh + 8 > innerHeight ? Math.max(8, r.top - mh - 4) : r.bottom + 4) + 'px';
    menu.onclick = async e => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      const a = b.dataset.m; closeMenu();
      if (a === 'wrun') return qRun({type: 'mission', id: w});
      if (a === 'wsched') return openScheduler({target: {type: 'mission', id: w}});
      if (a === 'wopen') return followLink('tasks', w);
      if (a === 'details') return qDetails(i.key);
      if (a === 'run') return qRun(i.target, {key: i.key, name: i.name});
      if (a === 'edit') return openScheduler({target: i.target, scheduleId: i.scheduleId});
      if (a === 'pri') { await qcall('priority', {scheduleId: i.scheduleId, priority: Number(b.dataset.p)}); toast('Priority: ' + PRI[Number(b.dataset.p)] + '.'); return; }
      if (a === 'skip') { const on = !(i.status === 'SKIPPED' && /today by you/.test(i.reason)); await qcall('skipToday', {scheduleId: i.scheduleId, on}); toast(on ? i.name + ' is skipped today. Its schedule stays.' : i.name + ' is back in today\'s queue.'); return; }
      if (a === 'cancel') { await qcall('cancel', {key: i.key}); toast('Removed from the queue. Its schedule (and its other times) stay.'); return; }
      if (a === 'off') { await qcall('toggle', {scheduleId: i.scheduleId, on: false}); toast(i.name + ': schedule off. Turn it on again in its schedule.'); return; }
      if (a === 'history') return qHistory({scheduleId: i.scheduleId, name: i.name});
    };
  }
  function closeMenu() { $('qmenu').hidden = true; Q.menuFor = null; }
  document.addEventListener('click', e => { if (!e.target.closest('#qmenu') && !e.target.closest('.qmore')) closeMenu(); });
  window.addEventListener('resize', closeMenu);

  // ------------------------------------------------------------------ sheets
  function sheet(html, wire) { const b = $('qsheetbody'); b.innerHTML = html; P.fix(b); numbers(b); $('qsheet').hidden = false; b.classList.remove('stepin'); void b.offsetWidth; b.classList.add('stepin'); if (wire) wire(b); const f = b.querySelector('input:not([type=checkbox]), select, button.primary'); if (f) f.focus(); }
  function closeSheet() { $('qsheet').hidden = true; $('qsheetbody').innerHTML = ''; }
  $('qsheet').addEventListener('mousedown', e => { if (e.target === $('qsheet')) closeSheet(); });
  $('qsheetbody').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('qsheet').hidden) { closeSheet(); e.stopPropagation(); } }, true);
  const head = (eye, title) => '<div class="top"><div><p class="eyebrow">// ' + esc(eye) + '</p><h2>' + esc(title) + '</h2></div><button class="ghost icon" data-close title="Close">' + icon('close') + '</button></div>';

  // Play now / Run now: one activity on its own. While the queue runs something else on that phone, the owner chooses.
  window.qRun = async function (target, o = {}) {
    const d = dev(); if (!d) { toast('Plug in the phone first.', 'warn'); return null; }
    let r = await qcall('runNow', {target, key: o.key, deviceId: d.id});
    if (r.conflict) {
      const choice = await ask(r.conflict); if (!choice) return null;
      r = await qcall('runNow', {target, key: o.key, deviceId: d.id, choice});
    }
    if (r.already) toast((o.name || 'It') + ' is already running.', 'warn');
    else if (r.queued) toast('Added to the queue: it runs in its turn.');
    else if (r.started) toast('Running ' + (r.session.name || o.name || 'it') + ' now. The queue itself does not start.');
    return r;
  };
  // The one-controller question: pause the queue and run this, add this to the queue, or cancel.
  function ask(c) {
    return new Promise(resolve => {
      const word = (KIND[c.wantKind] || KIND.task)[1].toUpperCase();
      sheet(head('ONE CONTROLLER PER PHONE', 'The queue is running ' + c.name) + '<p class="small">Only one activity can use the phone at a time. ' + esc(c.name) + ' is ' + esc(String(c.status || 'running').toLowerCase().replace(/_/g, ' ')) + ' now. What should Falcor do with ' + esc(c.want) + '?</p>'
        + '<div class="qask"><button class="primary" data-a="pause">' + icon('pause') + 'PAUSE QUEUE AND RUN ' + esc(word) + '</button><button data-a="queue">' + icon('queue') + 'ADD TO QUEUE</button><button data-a="cancel" data-close>CANCEL</button></div>'
        + '<p class="muted small">Pausing keeps the queue where it is: a task starts again on Resume (its claims are never repeated), a sequence that already acted waits for you.</p>', b => {
        b.querySelectorAll('[data-a]').forEach(x => x.onclick = () => { const a = x.dataset.a; closeSheet(); resolve(a === 'cancel' ? null : a); });
      });
      const obs = new MutationObserver(() => { if ($('qsheet').hidden) { obs.disconnect(); resolve(null); } });
      obs.observe($('qsheet'), {attributes: true, attributeFilter: ['hidden']});
    });
  }
  // The Sandbox's own Run now asks the same question (sandbox.js): true to go on, false when added or cancelled.
  window.qGuard = async function (target, name) {
    const q = qdev(), d = dev(); if (!q || !q.current || !d) return true;
    if (q.current.target.type === target.type && q.current.target.id === target.id) return true;
    const choice = await ask({name: q.current.name, status: q.current.status, want: name, wantKind: target.type === 'sequence' ? 'sequence' : 'task'});
    if (choice === 'queue') { await qcall('add', {target, deviceId: d.id}); toast('Added to the queue: it runs in its turn.'); return false; }
    if (choice === 'pause') { await qcall('yield', {deviceId: d.id, name}); return true; }
    return false;
  };

  // ------------------------------------------------------------------ the schedule editor (one for every tab)
  const RULES = [['once', 'Once'], ['daily', 'Daily'], ['weekdays', 'Weekdays'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['interval', 'Every…']];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  window.openScheduler = async function (o = {}) {
    const d = dev(), tz = (S.queue && S.queue.tz) || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const [targets, all] = await Promise.all([o.target ? Promise.resolve(null) : qcall('targets'), quiet('schedules').catch(() => [])]);
    const list = o.target ? all.filter(s => s.target.type === o.target.type && s.target.id === o.target.id) : [];
    const cur = o.scheduleId ? all.find(s => s.id === o.scheduleId) || null : null;
    const now = new Date(), next = new Date(Math.ceil((now.getTime() + 5 * 60000) / 900000) * 900000);
    const s = cur || {rule: {kind: 'daily', time: pad2(next.getHours()) + ':' + pad2(next.getMinutes())}, tz, durationMin: null, priority: 3, enabled: true, autoStart: false, earlyMin: 0, lateMin: 30, missed: 'skip', maxAttempts: 2, retry: 'safe', retryMin: 5, startDate: null, endDate: null, maxRuns: null, deps: [], revisionId: null, name: o.name || ''};
    const r = s.rule, today = new Date().toISOString().slice(0, 10);
    const title = o.title || (cur ? cur.name : o.name) || 'Schedule an activity';
    const pick = targets ? '<label>Activity<select id="qe-target"><option value="">Pick a game, a task or a sequence…</option>' + ['game', 'task', 'sequence'].map(k => { const g = targets.filter(t => t.kind === k); return g.length ? '<optgroup label="' + (KIND[k][1] + 's') + '">' + g.map(t => '<option value="' + esc(tv(t.target)) + '"' + (t.approved ? '' : ' disabled') + '>' + esc(t.name) + ' · ' + esc(t.app) + (t.approved ? '' : ' (approve it first)') + '</option>').join('') + '</optgroup>' : ''; }).join('') + '</select></label>' : '';
    const others = all.filter(x => !cur || x.id !== cur.id);
    const depRow = dp => '<div class="qdep"><select data-dep>' + '<option value="">—</option>' + others.map(x => '<option value="' + esc(x.id) + '"' + (dp && dp.scheduleId === x.id ? ' selected' : '') + '>' + esc(x.name) + ' · ' + esc(x.words) + '</option>').join('') + '</select><select data-mode>' + [['success', 'succeeds'], ['skip', 'succeeds (else skip this)'], ['finish', 'finishes, either way'], ['wait', 'is done or not due']].map(([v, n]) => '<option value="' + v + '"' + (dp && dp.mode === v ? ' selected' : '') + '>' + n + '</option>').join('') + '</select><button type="button" class="small icon ghost" data-deldep title="Remove">' + icon('close') + '</button></div>';
    const existing = list.length ? '<ul class="seqlist qexisting">' + list.map(x => '<li data-id="' + esc(x.id) + '"><label class="check"><input type="checkbox" data-sx="toggle"' + (x.enabled ? ' checked' : '') + ' title="In the queue"></label><div><b>' + esc(x.name) + '</b> <span class="muted small">' + esc(x.words) + (x.autoStart ? ' · starts by itself' : '') + '</span><div class="meta">' + (x.enabled && x.next ? 'next ' + esc(dayOf(x.next)) + ' ' + esc(hm(x.next)) : x.enabled ? 'no upcoming time' : 'off') + (x.lastError ? ' · <span class="sand">' + esc(x.lastError) + '</span>' : '') + '</div></div><div class="row"><button class="small" data-sx="edit">Edit</button><button class="small icon danger" data-sx="del" title="Delete">' + icon('trash') + '</button></div></li>').join('') + '</ul><p class="eyebrow">// ' + (cur ? 'EDIT' : 'ADD ANOTHER TIME') + '</p>' : '';
    const seqTarget = (o.target && o.target.type === 'sequence') || (cur && cur.target.type === 'sequence');
    sheet(head(cur ? 'EDIT SCHEDULE' : 'SCHEDULE', title) + existing + '<div class="qform">'
      + '<div class="grid2">' + pick + '<label>Name in the queue<input id="qe-name" maxlength="80" value="' + esc(s.name || '') + '" placeholder="' + esc(o.name || 'Named after the activity') + '"></label>'
      + (S.devices.length > 1 ? '<label>Phone<select id="qe-dev">' + S.devices.map(x => '<option value="' + esc(x.id) + '"' + ((cur ? cur.deviceId : d && d.id) === x.id ? ' selected' : '') + '>' + esc(x.label) + '</option>').join('') + '</select></label>' : '') + '</div>'
      + '<div class="seg qrules" id="qe-kind">' + RULES.map(([v, n]) => '<button type="button" data-k="' + v + '" class="' + (r.kind === v ? 'on' : '') + '">' + n + '</button>').join('') + '</div>'
      + '<div class="grid3"><label>Starts at<input id="qe-time" type="time" value="' + esc(r.time || '09:00') + '"></label><label>Runs for (min)<input id="qe-dur" type="number" min="1" max="360" placeholder="its own" value="' + esc(s.durationMin ?? '') + '"></label><label>Priority<select id="qe-pri">' + [1, 2, 3, 4, 5].map(p => '<option value="' + p + '"' + (s.priority === p ? ' selected' : '') + '>' + PRI[p] + '</option>').join('') + '</select></label></div>'
      + '<div class="grid3" id="qe-extra"></div>'
      + '<div class="qchecks"><label class="check"><input type="checkbox" id="qe-on"' + (s.enabled ? ' checked' : '') + '> Add to the Daily Queue: it starts by itself at its time, one after another with the rest (while this computer is on, Falcor.Hub is open and the phone is plugged in and unlocked)</label>'
      + '</div>'
      + '<details class="qadv"' + (cur && (cur.deps.length || cur.earlyMin || cur.missed !== 'skip' || cur.retry !== 'safe') ? ' open' : '') + '><summary>Advanced: window, missed runs, retries, prerequisites</summary>'
      + '<div class="grid3"><label>May start early (min)<input id="qe-early" type="number" min="0" max="240" value="' + s.earlyMin + '"></label><label>May start late (min)<input id="qe-late" type="number" min="1" max="1440" value="' + s.lateMin + '"></label><label>If it was missed<select id="qe-missed"><option value="skip">skip it (missed)</option><option value="late">run when available</option><option value="ask">ask me before running</option></select></label></div>'
      + '<div class="grid3"><label>Attempts<input id="qe-att" type="number" min="1" max="5" value="' + s.maxAttempts + '"></label><label>Try again<select id="qe-retry"><option value="safe">only when safe</option><option value="never">never</option><option value="always">always (it may repeat steps)</option></select></label><label>Minutes between tries<input id="qe-rmin" type="number" min="1" max="120" value="' + s.retryMin + '"></label></div>'
      + '<div class="grid3"><label>Starting (optional)<input id="qe-start" type="date" value="' + esc(s.startDate || '') + '"></label><label>Until (optional)<input id="qe-end" type="date" value="' + esc(s.endDate || '') + '"></label><label>At most (runs)<input id="qe-max" type="number" min="1" placeholder="no limit" value="' + esc(s.maxRuns ?? '') + '"></label></div>'
      + '<div class="grid3"><label>Time zone<input id="qe-tz" value="' + esc(s.tz || tz) + '"></label>' + (seqTarget ? '<label>Version<select id="qe-ver"><option value="">the latest saved</option></select></label>' : '') + '</div>'
      + '<p class="eyebrow">// RUNS AFTER (OPTIONAL)</p><div id="qe-deps">' + (s.deps || []).map(depRow).join('') + '</div><button type="button" class="small ghost" id="qe-adddep"' + (others.length ? '' : ' disabled title="Schedule another activity first"') + '>' + icon('plus') + 'Waits for another activity</button>'
      + '</details>'
      + '<p class="eyebrow">// NEXT RUNS</p><ul class="upc" id="qe-upc"><li class="muted">…</li></ul><ul class="qenotes" id="qe-notes"></ul>'
      + '<div class="row"><button class="primary" id="qe-save">' + icon('calendar') + (cur ? 'Save schedule' : 'Save') + '</button>' + (cur ? '<button id="qe-now">' + icon('play') + 'Run now</button>' : '') + '<button data-close>Cancel</button>' + (cur ? '<span class="grow"></span><button class="danger" id="qe-del">' + icon('trash') + 'Delete schedule</button>' : '') + '</div></div>', b => {
      b.querySelector('#qe-missed').value = s.missed; b.querySelector('#qe-retry').value = s.retry;
      let kind = r.kind;
      const target = () => o.target || cur && cur.target || (b.querySelector('#qe-target') && b.querySelector('#qe-target').value ? tgt(b.querySelector('#qe-target').value) : null);
      const extra = () => {
        const x = b.querySelector('#qe-extra');
        x.innerHTML = kind === 'once' ? '<label>Date<input id="qe-date" type="date" value="' + esc(r.date || today) + '"></label>'
          : kind === 'weekdays' ? '<label class="wide3">Days<span class="days">' + DAYS.map((n, i) => '<label class="check"><input type="checkbox" data-day="' + i + '"' + ((r.days || [1, 2, 3, 4, 5]).includes(i) ? ' checked' : '') + '>' + n + '</label>').join('') + '</span></label>'
          : kind === 'weekly' ? '<label>Day<select id="qe-wday">' + DAYS.map((n, i) => '<option value="' + i + '"' + ((r.day ?? new Date().getDay()) === i ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>'
          : kind === 'monthly' ? '<label>Day of the month<input id="qe-mday" type="number" min="1" max="31" value="' + (r.day || new Date().getDate()) + '"></label><label>A short month<select id="qe-short"><option value="last">runs on its last day</option><option value="skip"' + (r.missing === 'skip' ? ' selected' : '') + '>is skipped</option></select></label>'
          : kind === 'interval' ? '<label>Every (minutes, 15 or more)<input id="qe-every" type="number" min="15" max="10080" value="' + (r.minutes || 60) + '"></label><label>Starting<input id="qe-date" type="date" value="' + esc(r.date || today) + '"></label>' : '';
        numbers(x);
      };
      const plan = () => {
        const rule = {kind, time: b.querySelector('#qe-time').value};
        if (kind === 'once') rule.date = b.querySelector('#qe-date').value;
        if (kind === 'weekdays') rule.days = [...b.querySelectorAll('[data-day]')].filter(c => c.checked).map(c => Number(c.dataset.day));
        if (kind === 'weekly') rule.day = Number(b.querySelector('#qe-wday').value);
        if (kind === 'monthly') { rule.day = Number(b.querySelector('#qe-mday').value); rule.missing = b.querySelector('#qe-short').value; }
        if (kind === 'interval') { rule.minutes = Number(b.querySelector('#qe-every').value); rule.date = b.querySelector('#qe-date').value; }
        const v = id => b.querySelector(id) ? b.querySelector(id).value : '', t = target(), info = targets && t ? targets.find(x => tv(x.target) === tv(t)) : null;
        const deps = [...b.querySelectorAll('.qdep')].map(row => ({scheduleId: row.querySelector('[data-dep]').value, mode: row.querySelector('[data-mode]').value})).filter(x => x.scheduleId);
        return {target: t, kind: info ? info.kind : o.kind, pkg: info ? info.pkg : o.pkg, name: v('#qe-name').trim() || (info ? info.name : o.name || ''), deviceId: v('#qe-dev') || (cur && cur.deviceId) || (d && d.id), rule, tz: v('#qe-tz').trim() || tz,
          durationMin: v('#qe-dur') === '' ? null : Number(v('#qe-dur')), priority: Number(v('#qe-pri')), enabled: b.querySelector('#qe-on').checked, autoStart: true,
          earlyMin: Number(v('#qe-early') || 0), lateMin: Number(v('#qe-late') || 30), missed: v('#qe-missed'), maxAttempts: Number(v('#qe-att') || 2), retry: v('#qe-retry'), retryMin: Number(v('#qe-rmin') || 5),
          startDate: v('#qe-start') || null, endDate: v('#qe-end') || null, maxRuns: v('#qe-max') === '' ? null : Number(v('#qe-max')), deps, revisionId: v('#qe-ver') || null, scheduleId: cur ? cur.id : null};
      };
      let pv = null;
      const preview = () => { clearTimeout(pv); pv = setTimeout(async () => {
        const u = b.querySelector('#qe-upc'), nt = b.querySelector('#qe-notes'); if (!u) return;
        const p = plan();
        try {
          const x = await quiet('preview', {plan: {...p, target: p.target || {type: 'sequence', id: 'preview'}, name: p.name || 'Preview', deviceId: p.deviceId || 'preview'}});
          u.innerHTML = '<li class="muted">' + esc(x.words) + (x.window && x.upcoming[0] ? ' · it may start ' + esc(hm(x.window.start)) + '–' + esc(hm(x.window.late)) : '') + '</li>' + x.upcoming.map(t => '<li>' + esc(new Date(t).toLocaleString([], {weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})) + '</li>').join('') + (x.upcoming.length ? '' : '<li class="sand">No upcoming time with these settings.</li>');
          nt.innerHTML = x.notes.map(t => '<li>' + icon('clock') + esc(t) + '</li>').join('');
        } catch (err) { u.innerHTML = '<li class="red">' + esc(errText(err)) + '</li>'; nt.innerHTML = ''; }
      }, 180); };
      extra(); preview();
      if (seqTarget) { const t = o.target || cur.target; window.hub.call('sandbox', {op: 'get', id: t.id}).then(g => { const sel = b.querySelector('#qe-ver'); if (!sel) return; sel.innerHTML = '<option value="">the latest saved (v' + g.revision.number + ' now)</option>' + g.revisions.map(x => '<option value="' + esc(x.id) + '"' + (cur && cur.revisionId === x.id ? ' selected' : '') + '>v' + x.number + ' only</option>').join(''); }).catch(() => {}); }
      b.querySelector('#qe-kind').onclick = e => { const k = e.target.closest('[data-k]'); if (!k) return; kind = k.dataset.k; b.querySelectorAll('#qe-kind button').forEach(x => cls(x, 'on', x === k)); extra(); preview(); };
      b.addEventListener('input', preview); b.addEventListener('change', preview);
      b.querySelector('#qe-adddep').onclick = () => { if (b.querySelectorAll('.qdep').length >= 3) return; b.querySelector('#qe-deps').insertAdjacentHTML('beforeend', depRow(null)); };
      b.querySelector('#qe-deps').onclick = e => { const x = e.target.closest('[data-deldep]'); if (x) { x.closest('.qdep').remove(); preview(); } };
      const tsel = b.querySelector('#qe-target'); if (tsel) tsel.onchange = () => { const t = targets.find(x => tv(x.target) === tsel.value); if (t && !b.querySelector('#qe-name').value) b.querySelector('#qe-name').placeholder = t.name; preview(); };
      b.querySelector('#qe-save').onclick = async () => {
        const p = plan();
        if (!p.target) { toast('Pick the activity it runs.', 'warn'); return; }
        const saved = cur ? await qcall('update', {scheduleId: cur.id, plan: p}) : await qcall('create', {plan: p});
        closeSheet();
        toast((cur ? 'Schedule saved: ' : 'Scheduled: ') + saved.name + ' · ' + saved.words + (saved.next ? ' · next ' + dayOf(saved.next).toLowerCase() + ' ' + hm(saved.next) : '') + (saved.enabled ? saved.autoStart ? '. It starts by itself.' : '. It is in the Daily Queue.' : '. It is off.'));
        if (tab === 'phone' && Q.view !== 'today') void load(true);
      };
      const now2 = b.querySelector('#qe-now'); if (now2) now2.onclick = async () => { closeSheet(); await qRun(cur.target, {name: cur.name}); };
      const del = b.querySelector('#qe-del'); if (del) del.onclick = async () => { if (!confirm('Delete the schedule "' + cur.name + '"? Its history is kept.')) return; await qcall('remove', {scheduleId: cur.id}); closeSheet(); toast('Schedule deleted.'); };
      const ex = b.querySelector('.qexisting');
      if (ex) ex.onclick = async e => {
        const a = e.target.closest('[data-sx]'), li = e.target.closest('li[data-id]'); if (!a || !li) return;
        const x = list.find(y => y.id === li.dataset.id);
        if (a.dataset.sx === 'toggle') { await qcall('toggle', {scheduleId: x.id, on: a.checked}).catch(() => { a.checked = !a.checked; }); return; }
        if (a.dataset.sx === 'edit') return openScheduler({...o, scheduleId: x.id});
        if (a.dataset.sx === 'del') { if (!confirm('Delete this schedule? Its history is kept.')) return; await qcall('remove', {scheduleId: x.id}); openScheduler(o); }
      };
    });
  };

  // ------------------------------------------------------------------ details and history
  async function qDetails(key) {
    const r = await qcall('details', {key}), i = r.item, s = r.schedule, live = i.live, ended = ['COMPLETED', 'FAILED', 'SKIPPED', 'MISSED', 'CANCELLED', 'INTERRUPTED'].includes(i.status);
    const dl = [['Status', pill(i.status, i.label) + (i.reason ? ' <span class="small">' + esc(i.reason) + '</span>' : '')], ['What it runs', esc((KIND[i.kind] || KIND.task)[1])], ['When', esc(dayOf(i.at) + ' ' + i.time) + (i.window ? ' <span class="muted small">(may start ' + esc(hm(i.window.start)) + '–' + esc(hm(i.window.late)) + (i.window.cutoff > i.window.late ? ', at the latest ' + esc(hm(i.window.cutoff)) : '') + ')</span>' : '')],
      ['Schedule', esc(s ? s.words + (s.enabled ? '' : ' (off)') : 'deleted')], ['Runs for', esc(i.durationMin ? i.durationMin + ' min' : i.estMin ? 'about ' + i.estMin + ' min (from its runs)' : 'its own limit')], ['Priority', esc(PRI[i.priority] || 'Normal')],
      ['Attempts', esc(i.attempts + ' of ' + i.maxAttempts + (i.failures ? ' (' + i.failures + ' failed)' : ''))], ['Starts by itself', 'Yes, at its time (unless the queue is paused)'],
      ...(i.deps.length ? [['Waits for', i.deps.map(x => esc(x.name) + ' <span class="muted small">(' + esc({success: 'succeeds', skip: 'succeeds, else skip', finish: 'finishes', wait: 'is done or not due'}[x.mode]) + ': ' + esc(x.state === 'ok' ? 'ready' : x.why || x.state) + ')</span>').join('<br>')]] : []),
      ...(i.result ? [['Result', (i.verified ? '<span class="green">✓ verified</span> ' : '<span class="muted">not verified</span> ') + esc(i.result)]] : [])];
    sheet(head('ACTIVITY', i.name) + '<dl class="qdl">' + dl.map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + v + '</dd>').join('') + '</dl>'
      + '<p class="eyebrow">// RUNS OF THIS TIME</p><ul class="seqlist">' + (r.sessions.map(x => '<li><span>' + pill(x.status, x.label) + '</span><div><b>' + esc(x.triggerLabel) + ' · ' + esc(hm(x.startedAt)) + (x.endedAt ? '–' + esc(hm(x.endedAt)) : '') + '</b><div class="meta">' + esc(x.reason || '') + (x.result ? ' · ' + esc(x.result) : '') + '</div></div><span></span></li>').join('') || '<li class="muted small">Not run yet.</li>') + '</ul>'
      + '<div class="row">' + (!live && !ended ? '<button class="primary" data-d="run">' + icon('play') + 'Run now</button>' : '') + (s && !s.adhoc ? '<button data-d="edit">' + icon('calendar') + 'Edit schedule</button>' : '') + (!live && !ended ? '<button data-d="cancel">' + icon('close') + 'Remove from queue</button>' : '') + '<button data-d="hist">' + icon('clock') + 'History</button><span class="grow"></span><button data-close>Close</button></div>', b => {
      b.onclick = async e => {
        const a = e.target.closest('[data-d]'); if (!a) return;
        if (a.dataset.d === 'run') { closeSheet(); await qRun(i.target, {key: i.key, name: i.name}); }
        if (a.dataset.d === 'edit') openScheduler({target: i.target, scheduleId: i.scheduleId});
        if (a.dataset.d === 'cancel') { await qcall('cancel', {key: i.key}); closeSheet(); toast('Removed from the queue. Its schedule stays.'); }
        if (a.dataset.d === 'hist') qHistory({scheduleId: i.scheduleId, name: i.name});
      };
    });
  }
  window.qDetails = qDetails;
  async function qHistory(o) {
    const r = await qcall('history', {scheduleId: o.scheduleId, target: o.target});
    const rows = r.sessions.map(x => '<li><span>' + pill(x.status, x.label) + '</span><div><b>' + esc(new Date(x.startedAt).toLocaleString([], {weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})) + ' · ' + esc(x.triggerLabel) + (x.attempt > 1 ? ' · attempt ' + x.attempt : '') + '</b><div class="meta">' + (x.durationMs !== null ? esc(x.durationMs < 60000 ? Math.max(1, Math.round(x.durationMs / 1000)) + ' s' : minsOf(x.durationMs) + ' min') + ' · ' : '') + esc(x.reason || '') + (x.result ? ' · ' + (x.verified ? '✓ ' : '') + esc(x.result) : '') + '</div></div><span></span></li>');
    const older = (r.runs || []).filter(x => !r.sessions.some(y => y.startedAt <= x.startedAt + 2000 && y.startedAt >= x.startedAt - 2000)).map(x => '<li><span class="qpill s-' + (/VERIFIED|PENDING/.test(x.outcome) ? 'green' : x.outcome === 'RUNNING' ? 'run' : 'muted') + '">' + esc(x.outcome.replace(/_/g, ' ')) + '</span><div><b>' + esc(new Date(x.startedAt).toLocaleString([], {weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})) + ' · Autopilot (when due)</b><div class="meta">' + esc(x.reason || '') + '</div></div><span></span></li>');
    sheet(head('HISTORY', o.name || 'History') + '<ul class="seqlist">' + ([...rows, ...older].join('') || '<li class="muted small">No runs yet.</li>') + '</ul><div class="row"><button data-close>Close</button></div>');
  }
  window.qHistory = qHistory;
  window.qAsk = ask; window.qSheet = {open: sheet, head, close: closeSheet};

  // ------------------------------------------------------------------ the Tasks, Games and Sandbox tabs' buttons
  document.addEventListener('click', async e => {
    const run = e.target.closest('[data-qrun]'), sch = e.target.closest('[data-qsched]'), hist = e.target.closest('[data-qhist]'), tog = e.target.closest('[data-qtoggle]');
    if (run) { e.stopPropagation(); run.classList.add('busy'); try { await qRun(tgt(run.dataset.qrun), {name: run.dataset.name}); } finally { run.classList.remove('busy'); } }
    if (sch) { e.stopPropagation(); openScheduler({target: tgt(sch.dataset.qsched), name: sch.dataset.name, kind: sch.dataset.kind, pkg: sch.dataset.pkg || null}); }
    if (hist) { e.stopPropagation(); qHistory({target: tgt(hist.dataset.qhist), name: hist.dataset.name}); }
    if (tog) { e.stopPropagation(); await qcall('toggle', {scheduleId: tog.dataset.qtoggle, on: tog.checked}).catch(() => { tog.checked = !tog.checked; }); toast(tog.checked ? 'Schedule on: it is in the Daily Queue.' : 'Schedule off: it stays saved.'); }
  });
})();

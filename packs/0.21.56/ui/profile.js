// The Profile tab (the owner, 2026-10-21): your picture, name, credentials and About me (kept on this computer and shared
// with the phone app, IPC `profile`), the games you are active in, your record and rank, your workshop, and what Falcor
// recommends next. A fixed page (a bento, nothing moves). Loaded after app.js and uses its helpers (S, call, go, $, P).
(() => {
  const RANKS = [[0, 'Hatchling'], [5, 'Apprentice'], [25, 'Adept'], [100, 'Master of the Craft'], [500, 'Dragon Rider']];
  let me = null, loading = false, saveT = 0, pending = {};   // (changes typed in quick succession are saved together)
  const num = v => (Number(v) || 0).toLocaleString();
  const tile = (v, label, cls = '') => '<div class="ptile ' + cls + '"><b>' + esc(v) + '</b><span>' + esc(label) + '</span></div>';
  async function load() {
    if (loading) return; loading = true;
    try { me = await call('profile', {op: 'get'}); fill(); } catch { /* shown empty */ } finally { loading = false; }
  }
  // The form gets the saved values once (never while the owner is typing in it).
  function fill() {
    if (!me) return;
    for (const [id, k] of [['profname', 'name'], ['profcred', 'cred'], ['profabout', 'about']]) if (document.activeElement !== $(id)) $(id).value = me[k] || '';
    drawPic(); look();
    text($('profsince'), 'With Falcor since ' + new Date(me.since).toLocaleDateString([], {month: 'long', year: 'numeric'}));
  }
  // The page's look: accent, picture frame and banner, chosen in Customize.
  const LOOK = {accent: [['green', '#5CE59A'], ['sand', '#F5B544'], ['red', '#F0544F'], ['blue', '#7AA7FF'], ['white', '#EDEDED']], frame: [['glow', 'Glow'], ['pixel', 'Pixel'], ['round', 'Round']], cover: [['grid', 'Grid'], ['stars', 'Stars'], ['embers', 'Embers'], ['plain', 'Plain']]};
  function look() {
    const pane = document.querySelector('.profpane'); for (const k of ['accent', 'frame', 'cover']) pane.dataset[k] = me[k];
    htmlOnce($('pcaccent'), LOOK.accent.map(([k, c]) => '<button class="pcdot' + (me.accent === k ? ' on' : '') + '" data-look="accent:' + k + '" title="' + k + '" data-style="background:' + c + '"></button>').join(''));
    htmlOnce($('pcframe'), LOOK.frame.map(([k, l]) => '<button class="small' + (me.frame === k ? ' on' : '') + '" data-look="frame:' + k + '">' + l + '</button>').join(''));
    htmlOnce($('pccover'), LOOK.cover.map(([k, l]) => '<button class="small' + (me.cover === k ? ' on' : '') + '" data-look="cover:' + k + '">' + l + '</button>').join(''));
    P.fix($('pcaccent'));
  }
  $('profcustpanel').addEventListener('click', e => { const b = e.target.closest('[data-look]'); if (!b) return; const [k, v] = b.dataset.look.split(':'); me[k] = v; look(); void save({[k]: v}); });
  // Customize opens the choices; Done (or leaving the page) folds them away again.
  const custom = open => { $('profcustpanel').hidden = !open; $('profcustom').hidden = open; };
  $('profcustom').onclick = () => custom(true); $('profcustdone').onclick = () => custom(false);
  window.profileLeave = () => custom(false);
  $('profpicnew').onclick = () => $('proffile').click();
  function drawPic() {
    const has = !!(me && me.pic);
    $('profimg').hidden = !has; if (has) $('profimg').src = me.pic;
    $('profinit').hidden = has; text($('profinit'), ((me && me.name) || '?').trim().slice(0, 1).toUpperCase() || '?');
    text($('profshow'), (me && me.name) || 'Your name'); text($('profcredshow'), (me && me.cred) || 'Add your credentials in About you');
    $('profpicdel').hidden = !has;
  }
  async function save(patch) {
    try { me = await call('profile', {op: 'save', patch}); text($('profsaved'), 'Saved'); setTimeout(() => text($('profsaved'), ''), 1600); drawPic(); look(); }
    catch (e) { toast(errText(e), 'bad'); }
  }
  for (const [id, k] of [['profname', 'name'], ['profcred', 'cred'], ['profabout', 'about']]) $(id).addEventListener('input', () => { pending[k] = $(id).value; clearTimeout(saveT); text($('profsaved'), '…'); saveT = setTimeout(() => { const p = pending; pending = {}; void save(p); }, 600); });
  $('profavatar').onclick = () => $('proffile').click();
  $('profpicdel').onclick = () => void save({pic: null});
  // Any picture: a GIF up to 1.5 MB is kept as it is (it keeps moving); anything else is cut to its centre square at 512 px.
  const asUrl = f => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = bad; r.readAsDataURL(f); });
  $('proffile').onchange = async () => {
    const f = $('proffile').files && $('proffile').files[0]; $('proffile').value = ''; if (!f) return;
    try {
      if (f.type === 'image/gif' && f.size <= 1_400_000) { await save({pic: await asUrl(f)}); return; }
      const bmp = await createImageBitmap(f), s = Math.min(bmp.width, bmp.height), side = Math.min(512, s), c = document.createElement('canvas'); c.width = c.height = side;
      c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, side, side);
      await save({pic: c.toDataURL('image/webp', 0.9)});
    } catch { toast('That picture could not be read.', 'warn'); }
  };

  function rank(verified) {
    let i = 0; while (i + 1 < RANKS.length && verified >= RANKS[i + 1][0]) i++;
    const next = RANKS[i + 1];
    return {name: RANKS[i][1], pct: next ? Math.round((verified - RANKS[i][0]) / (next[0] - RANKS[i][0]) * 100) : 100, next: next ? (next[0] - verified) + ' verified run' + (next[0] - verified === 1 ? '' : 's') + ' to ' + next[1] : 'The highest rank'};
  }
  const running = g => (g.tasks || []).some(t => t.state === 'RUNNING');
  function recs(list) {
    const out = [], d = S.devices || [], q = S.queue && S.queue.devices ? Object.values(S.queue.devices) : [];
    const review = (S.tasks || []).filter(t => t.state === 'NEEDS_REVIEW').length, needs = list.filter(g => g.needsYou).length;
    const soon = list.filter(g => g.deadline && g.deadline.at && g.deadline.at - Date.now() < 2 * 864e5 && g.deadline.at > Date.now());
    if (!me || !me.pic) out.push(['camera', 'Add your picture', 'Make the Hub yours.', 'pic']);
    if (review) out.push(['check', review + ' task' + (review === 1 ? '' : 's') + ' to approve', 'Nothing runs before you approve it.', 'tasks']);
    if (needs) out.push(['bell', needs + ' game' + (needs === 1 ? ' needs' : 's need') + ' you', 'A step only you can take.', 'games']);
    for (const g of soon.slice(0, 2)) out.push(['clock', g.name + ' ends soon', 'Its offer ends in ' + Math.max(1, Math.round((g.deadline.at - Date.now()) / 36e5)) + ' h.', 'game:' + g.pkg]);
    if (q.some(x => x.paused)) out.push(['play', 'Your queue is paused', 'Resume it on the Hub when you are ready.', 'phone']);
    if (!d.length) out.push(['usb', 'Plug in your phone', 'Falcor plays on the phone plugged into this computer.', 'phone']);
    if (S.remote && !(S.remote.phones || []).length) out.push(['wifi', 'Pair your everyday phone', 'Run everything from the phone app.', 'settings:phoneapp']);
    if (S.kimi && !S.kimi.configured) out.push(['ai', 'Connect an AI', 'Falcor plans and learns with it.', 'settings:ai']);
    out.push(['rec', 'Teach Falcor a new run', 'Show him once in Sandbox; he builds it.', 'sandbox']);
    return out.slice(0, 4);
  }
  window.renderProfile = function () {
    if (!S) return;
    if (!me) void load(); else fill();
    const st = S.stats || {}, all = st.allTime || {}, today = st.today || {}, list = (S.games || []).filter(g => g.kind !== 'creation');
    const r = rank(all.verified || 0);
    text($('profrank'), r.name); $('profbar').style.width = r.pct + '%'; text($('profnext'), r.next);
    // Active now: running first, then what has open goals or needs the owner.
    const act = list.filter(g => running(g) || g.active || g.needsYou || g.status === 'active').sort((a, b) => Number(running(b)) - Number(running(a)) || (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 6);
    htmlOnce($('profactive'), act.length ? act.map(g => { const s = gameState(g); return '<button class="pgame" data-pkg="' + esc(g.pkg) + '"><span class="pgicon">' + iconHtml(g) + '</span><span class="pgtxt"><b>' + esc(g.name) + '</b><span class="' + esc(s.mood) + '">' + esc(s.label) + '</span></span></button>'; }).join('') : '<p class="muted small">Nothing active. Capture an offer or start a game\'s Autopilot.</p>');
    htmlOnce($('proftiles'), tile(num(all.runs), 'runs') + tile(num(all.verified), 'verified', 'g') + tile(Math.round((all.completionRate || 0) * 100) + '%', 'complete') + tile(num(today.runs), 'today'));
    const earned = {}; for (const g of list) for (const t of g.totals || []) if (t.earned) earned[t.unit] = (earned[t.unit] || 0) + t.earned;
    htmlOnce($('profearn'), Object.keys(earned).length ? '<span class="muted small">Verified earnings</span><div class="pearn">' + Object.entries(earned).map(([u, v]) => '<span>' + esc(P.money(v, u)) + '</span>').join('') + '</div>' : '<span class="muted small">Verified earnings show here once a goal pays out.</span>');
    const sp = S.spend || {}, ai = (sp.teach || 0) + (sp.chat || 0) + (sp.autopilot || 0);
    htmlOnce($('profwork'), tile(num(list.filter(g => !g.kind || g.kind === 'game').length), 'games') + tile(num(list.filter(g => g.kind === 'app').length), 'apps') + tile(num(S.sandbox ? S.sandbox.sequences : 0), 'creations') + tile(num(S.remote ? (S.remote.phones || []).length : 0), 'paired phones') + tile('$' + ai.toFixed(2), 'AI this month', 's'));
    htmlOnce($('profrecs'), recs(list).map(([ic, t, s, to]) => '<button class="prec" data-to="' + esc(to) + '">' + icon(ic) + '<span><b>' + esc(t) + '</b><small>' + esc(s) + '</small></span></button>').join(''));
  };
  $('profactive').addEventListener('click', e => { const b = e.target.closest('[data-pkg]'); if (b) { gamePkg = b.dataset.pkg; go('games'); } });
  $('profrecs').addEventListener('click', e => {
    const b = e.target.closest('[data-to]'); if (!b) return; const to = b.dataset.to;
    if (to === 'pic') $('proffile').click();
    else if (to.startsWith('game:')) { gamePkg = to.slice(5); go('games'); }
    else { const [t, s] = to.split(':'); go(t, s); }
  });
})();

// The Hub's extra windows (the owner, 2026-10-21: "a cyber workspace, Falcor style"): Clock, AI meter and Phone vitals
// read the status the window already has (S); LED sign, Data rain, Radar and Signal are decor. Each draws only while it
// is seen (its window shown, the Hub in front, or popped out into its own window), in stepped frames like the rest.
// Loaded after desk.js; uses app.js's $, P, S, dev and deviceId.
(() => {
  const VOICE = getComputedStyle(document.documentElement).getPropertyValue('--voice').trim() || 'monospace';
  const COLORS = {green: '#5CE59A', sand: '#F5B544', red: '#F0544F', blue: '#7AA7FF', white: '#EDEDED'};
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');
  const seen = id => { const n = $(id); return n && n.offsetParent && !n.ownerDocument.hidden ? n : null; };
  // A canvas at its box's size in device pixels; returns its 2D context and size in CSS pixels.
  function fit(c) {
    const r = c.ownerDocument.defaultView.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * r) || c.height !== Math.round(h * r)) { c.width = Math.round(w * r); c.height = Math.round(h * r); }
    const g = c.getContext('2d'); g.setTransform(r, 0, 0, r, 0, 0); return {g, w, h};
  }
  const money = v => '$' + (v >= 100 ? v.toFixed(0) : v.toFixed(2));
  const ago = at => at ? P.ago(at) : 'never';

  // ------------------------------------------------------------------ LED sign: the owner's words in dots
  const TK = 'falcor.ticker.v1';
  let tk = {text: 'FALCOR.HUB  //  THE MAINFRAME IS AWAKE', color: 'green', speed: 2};
  try { Object.assign(tk, JSON.parse(localStorage.getItem(TK) || '{}')); } catch { /* the default sign */ }
  let bits = null, bitsFor = '', off = 0;
  // The message drawn once in the pixel font at its own size, read back as lit dots (any character the font has).
  function bitmap(text) {
    const c = document.createElement('canvas'), g = c.getContext('2d'), font = '11px ' + VOICE;
    g.font = font; const w = Math.max(1, Math.ceil(g.measureText(text).width)) + 2;
    c.width = w; c.height = 14; g.font = font; g.textBaseline = 'top'; g.fillStyle = '#fff'; g.fillText(text, 1, 1);
    const d = g.getImageData(0, 0, w, 14).data, rows = [];
    for (let y = 0; y < 14; y++) { const row = new Uint8Array(w); for (let x = 0; x < w; x++) row[x] = d[(y * w + x) * 4 + 3] > 110 ? 1 : 0; rows.push(row); }
    let a = 0, b = 13; while (a < b && !rows[a].some(Boolean)) a++; while (b > a && !rows[b].some(Boolean)) b--;
    a = Math.max(0, Math.min(a, 2)); b = Math.min(13, Math.max(b, 11));   // keep the font's band steady from word to word
    return {w, rows: rows.slice(a, b + 1)};
  }
  function ticker() {
    const c = seen('tkcanvas'); if (!c) return;
    const key = tk.text + '|' + VOICE; if (bitsFor !== key) { bits = bitmap(tk.text || ' '); bitsFor = key; off = 0; }
    const {g, w, h} = fit(c), n = bits.rows.length, p = Math.max(3, Math.floor(h / (n + 2))), cols = Math.ceil(w / p) + 1;
    const total = bits.w + cols, col = rgb(COLORS[tk.color] || COLORS.green), y0 = (h - n * p) / 2, rad = p * .36;
    g.fillStyle = '#050605'; g.fillRect(0, 0, w, h);
    off = (off + tk.speed) % total;
    g.fillStyle = 'rgba(' + col + ',.07)';
    for (let x = 0; x < cols; x++) for (let y = 0; y < n; y++) { g.beginPath(); g.arc(x * p + p / 2, y0 + y * p + p / 2, rad, 0, 7); g.fill(); }
    g.fillStyle = 'rgb(' + col + ')'; g.shadowColor = 'rgba(' + col + ',.9)'; g.shadowBlur = p * 1.1;
    for (let x = 0; x < cols; x++) {
      const bx = (off + x) % total - cols; if (bx < 0 || bx >= bits.w) continue;   // the sign starts empty and the words come in from the right
      for (let y = 0; y < n; y++) if (bits.rows[y][bx]) { g.beginPath(); g.arc(x * p + p / 2, y0 + y * p + p / 2, rad, 0, 7); g.fill(); }
    }
    g.shadowBlur = 0;
  }
  function tkForm() {
    const f = $('tkform'); if (!f) return;
    $('tktext').value = tk.text; $('tkspeed').value = String(tk.speed);
    $('tkcolors').innerHTML = Object.entries(COLORS).map(([k, v]) => '<button type="button" class="tkdot' + (k === tk.color ? ' on' : '') + '" data-c="' + k + '" title="' + k + '" data-style="background:' + v + '"></button>').join('');
    P.fix($('tkcolors'));
  }
  // The pencil sits with the window's own buttons on the right; a double-click on the sign opens the same form (also
  // when the sign is popped out, where the title bar stays behind). Listeners are on the elements, so they travel with them.
  const tkEdit = () => { const f = $('tkform'); f.hidden = !f.hidden; if (!f.hidden) { tkForm(); $('tktext').focus(); } };
  const pen = $('tkedit'), btns = pen && pen.parentElement.querySelector('.winbtns');
  if (pen) { pen.className = ''; pen.type = 'button'; if (btns) btns.prepend(pen); pen.onclick = tkEdit; }
  $('tkcanvas').addEventListener('dblclick', tkEdit);
  $('tkcolors').addEventListener('click', e => { const dot = e.target.closest('[data-c]'); if (dot) { tk.color = dot.dataset.c; keepTk(); tkForm(); } });
  $('tkform').addEventListener('submit', e => {
    e.preventDefault();
    tk.text = $('tktext').value.trim().slice(0, 160) || 'FALCOR.HUB'; tk.speed = Number($('tkspeed').value) || 2; keepTk(); $('tkform').hidden = true;
  });
  function keepTk() { try { localStorage.setItem(TK, JSON.stringify(tk)); } catch { /* this session only */ } }

  // ------------------------------------------------------------------ Data rain
  const GLYPHS = '01<>/\\#*+=:;ABCDEFXYZ$%&@', drops = [];
  function rain() {
    const c = seen('raincanvas'); if (!c) return;
    const {g, w, h} = fit(c), fs = 12, cols = Math.ceil(w / fs);
    while (drops.length < cols) drops.push(Math.random() * -h / fs);
    g.fillStyle = 'rgba(8,10,9,.22)'; g.fillRect(0, 0, w, h);
    g.font = fs + 'px ' + VOICE; g.textBaseline = 'top';
    for (let i = 0; i < cols; i++) {
      const y = drops[i] * fs, ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      g.fillStyle = 'rgba(92,229,154,.55)'; g.fillText(ch, i * fs, y - fs);
      g.fillStyle = '#d9ffe9'; g.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * fs, y);
      drops[i] = y > h && Math.random() > .96 ? 0 : drops[i] + 1;
    }
  }

  // ------------------------------------------------------------------ Radar: a blip for each phone (this one and the paired ones)
  let sweep = 0;
  const spot = id => { let x = 7; for (const ch of String(id)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return {a: (x % 360) * Math.PI / 180, r: .3 + (x % 55) / 100}; };
  function radar() {
    const c = seen('radarcanvas'); if (!c) return;
    const {g, w, h} = fit(c), R = Math.min(w, h) / 2 - 8, cx = w / 2, cy = h / 2;
    g.fillStyle = '#050706'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(92,229,154,.22)'; g.lineWidth = 1;
    for (const k of [1, .66, .33]) { g.beginPath(); g.arc(cx, cy, R * k, 0, 7); g.stroke(); }
    g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
    sweep = (sweep + .07) % (Math.PI * 2);
    const cone = g.createConicGradient(sweep - Math.PI * .5, cx, cy);
    cone.addColorStop(0, 'rgba(92,229,154,0)'); cone.addColorStop(.75, 'rgba(92,229,154,0)'); cone.addColorStop(.995, 'rgba(92,229,154,.38)'); cone.addColorStop(1, 'rgba(92,229,154,0)');
    g.fillStyle = cone; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    const blips = [...(S ? S.devices.map(d => ({id: d.id, name: d.label, on: d.connected})) : []), ...(S && S.remote ? S.remote.phones.map(p => ({id: p.id, name: p.name, on: Date.now() - p.lastSeenAt < 5 * 60e3})) : [])];
    g.font = '10px ' + VOICE; g.textBaseline = 'middle';
    for (const b of blips) {
      const s = spot(b.id), x = cx + Math.cos(s.a) * R * s.r, y = cy + Math.sin(s.a) * R * s.r;
      const since = ((sweep - s.a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2), glow = Math.max(.25, 1 - since / (Math.PI * 2));
      const col = b.on ? '92,229,154' : '245,181,68';
      g.fillStyle = 'rgba(' + col + ',' + glow + ')'; g.shadowColor = 'rgba(' + col + ',.9)'; g.shadowBlur = 8 * glow;
      g.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6); g.shadowBlur = 0;
      g.fillStyle = 'rgba(237,237,237,' + (.35 + glow * .5) + ')'; g.fillText(String(b.name || '').slice(0, 14), x + 7, y);
    }
    const t = $('radarcount'); if (t) P.text(t, blips.filter(b => b.on).length + ' in range');
  }

  // ------------------------------------------------------------------ Signal: a scope line, livelier while Falcor works
  let phase = 0, amp = .3;
  function scope() {
    const c = seen('scopecanvas'); if (!c) return;
    const {g, w, h} = fit(c), busy = !!(S && S.devices.some(d => d.running || d.control)), live = !!(S && S.videos && S.videos.length);
    amp += ((busy ? .85 : live ? .45 : .15) - amp) * .08; phase += .22;
    g.fillStyle = '#050706'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(92,229,154,.10)'; g.lineWidth = 1;
    for (let x = 0; x < w; x += 20) { g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, h); g.stroke(); }
    for (let y = 0; y < h; y += 20) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(w, y + .5); g.stroke(); }
    g.strokeStyle = '#5CE59A'; g.shadowColor = 'rgba(92,229,154,.9)'; g.shadowBlur = 6; g.lineWidth = 2; g.beginPath();
    for (let x = 0; x <= w; x += 3) {
      const t = x / w * Math.PI * 6 + phase, y = h / 2 + (Math.sin(t) * .55 + Math.sin(t * 2.7 + phase * .4) * .3 + (Math.random() - .5) * .25) * amp * h * .42;
      if (x) g.lineTo(x, Math.round(y)); else g.moveTo(x, Math.round(y));
    }
    g.stroke(); g.shadowBlur = 0;
    const t = $('scopehz'); if (t) P.text(t, busy ? 'BUSY' : live ? 'LIVE' : 'IDLE');
  }

  // ------------------------------------------------------------------ Clock, AI meter, Phone vitals (once a second)
  function clock() {
    if (!seen('clockt')) return;
    // (Minnesota time, 12-hour, the owner 2026-10-21)
    const now = new Date(), tz = 'America/Chicago';
    P.text($('clockt'), now.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, timeZone: tz}));
    P.text($('clockd'), (now.toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric', timeZone: tz}) + ' · Minnesota').toUpperCase());
    const q = S && S.queue && deviceId ? S.queue.devices[deviceId] || Object.values(S.queue.devices)[0] : S && S.queue ? Object.values(S.queue.devices)[0] : null;
    const nx = q && q.next, m = nx ? Math.round((nx.at - Date.now()) / 60000) : 0;
    P.text($('clockn'), !q ? 'No phone yet' : q.current ? 'NOW · ' + q.current.name : !nx ? 'Nothing more today' : (q.paused ? 'Queue paused · next ' : 'Next · ') + nx.name + (m > 0 ? ' · in ' + (m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min') : ' · now'));
  }
  function spend() {
    const box = seen('spendbox'); if (!box || !S || !S.spend) return;
    const s = S.spend, total = (s.teach || 0) + (s.chat || 0) + (s.autopilot || 0), days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5), k = d.toLocaleDateString('en-CA'); days.push({k, label: d.toLocaleDateString([], {weekday: 'narrow'}), v: (s.days || {})[k] || 0}); }
    const top = Math.max(.01, ...days.map(d => d.v));
    P.text($('spendmonth'), s.month || '');
    P.htmlOnce(box, '<div class="spendtop"><b>' + money(total) + '</b><span>this month · ' + Math.round((s.tokens || 0) / 1000).toLocaleString() + 'k tokens</span></div>'
      + '<div class="spendbars">' + days.map(d => '<i title="' + d.k + ': ' + money(d.v) + '" data-style="height:' + Math.max(4, Math.round(d.v / top * 100)) + '%"><em>' + d.label + '</em></i>').join('') + '</div>'
      + '<dl class="spec"><dt>Autopilot</dt><dd>' + money(s.autopilot || 0) + '</dd><dt>Teach</dt><dd>' + money(s.teach || 0) + '</dd><dt>Chat</dt><dd>' + money(s.chat || 0) + '</dd><dt>Last reply</dt><dd>' + P.esc(ago(s.lastReplyAt)) + '</dd></dl>');
    P.fix(box);
  }
  function vitals() {
    const box = seen('vitalsbox'); if (!box || !S) return;
    const d = dev(), phones = (S.remote && S.remote.phones) || [];
    const batt = d && d.battery != null ? d.battery : null, bc = batt == null ? '' : batt < 20 ? 'bad' : batt < 45 ? 'warn' : 'ok';
    P.htmlOnce(box, !d ? '<p class="muted small">No phone plugged in.</p>' :
      '<div class="vbatt ' + bc + '"><span>' + P.esc(d.label) + '</span><b>' + (batt == null ? '—' : batt + '%') + '</b><i><u data-style="width:' + (batt || 0) + '%"></u></i></div>'
      + '<dl class="spec"><dt>Screen</dt><dd>' + (d.locked ? 'Locked' : 'Awake') + ' · ' + (d.rotation % 2 ? 'sideways' : 'upright') + '</dd>'
      + '<dt>In front</dt><dd>' + P.esc(String(d.foreground || '—').split('.').slice(-2).join('.')) + '</dd>'
      + '<dt>Control</dt><dd>' + (d.emergency ? 'Emergency Stop' : d.control ? P.esc(String(d.control.holder || d.control.kind || d.control).slice(0, 24)) : 'Free') + '</dd>'
      + '<dt>Mirror</dt><dd>' + (S.videos && S.videos.includes(d.id) ? 'Live video' : 'Pictures') + '</dd>'
      + '<dt>Paired</dt><dd>' + (phones.length ? phones.map(p => P.esc(p.name) + ' <span class="muted">' + P.esc(ago(p.lastSeenAt)) + '</span>').join('<br>') : 'None') + '</dd></dl>');
    P.fix(box);
  }

  // Stepped frames: decor at ~12 per second, the reading windows once a second. Nothing runs while nothing is seen.
  let beat = 0;
  setInterval(() => { try { ticker(); rain(); radar(); scope(); } catch { /* a window closing mid-frame */ } }, 80);
  setInterval(() => { beat++; try { clock(); if (beat % 2 === 1) { spend(); vitals(); } } catch { /* the status not here yet */ } }, 1000);
})();

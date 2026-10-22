// The Phone tab is a desk of windows: the phone's screen, Device, Current activity, Today's queue and the Activity log,
// and from the Windows menu Needs you, Apps, Creations, Today and Connection. A window moves by its title bar, resizes
// by its edges and corners, comes to the front when touched, maximizes (double-click its title) and hides (×); Layout
// arranges them (Classic, Focus, Grid) and Lock keeps them where they are. Places are kept as fractions of the desk, one
// arrangement per orientation (upright, and sideways while a game is played sideways), in this computer's storage. A
// layout still as a preset left it follows the desk and the windows shown; one the owner arranged keeps its places.
// Loaded after app.js and queue.js and uses their helpers (S, call, toast, go, dev, qRun). The Phone tab only.
(() => {
  const KEY = 'falcor.desk.v1', GAP = 12, SNAP = 10, STEP = 8;
  const WINS = [
    {id: 'mirror', name: 'Phone screen', about: 'The live mirror and its tools (always shown)', core: true, fixed: true, min: [240, 300]},
    {id: 'device', name: 'Device', about: 'The phone plugged into this computer', core: true, min: [220, 140]},
    {id: 'current', name: 'Current activity', about: 'What runs now and what comes next', core: true, min: [220, 110], weight: 1},
    {id: 'queue', name: 'Today\'s queue', about: 'Everything planned for today', core: true, min: [240, 150], weight: 1.7},
    {id: 'log', name: 'Activity log', about: 'What Falcor and you did, line by line', core: true, min: [220, 110], weight: 1.1},
    {id: 'needs', name: 'Needs you', about: 'Approvals, stuck runs and anything waiting on you', min: [220, 110], size: [300, 220], weight: .9},
    {id: 'apps', name: 'Apps', about: 'Open any app on the phone', min: [220, 160], size: [300, 360], weight: 1.3},
    {id: 'creations', name: 'Creations', about: 'Run or stop your Sandbox sequences', min: [240, 140], size: [320, 300], weight: 1.1},
    {id: 'today', name: 'Today', about: 'How today went, what is next, AI spending', min: [220, 130], size: [300, 270], weight: 1},
    {id: 'link', name: 'Connection', about: 'The cable, the mirror, the tools and paired phones', min: [220, 140], size: [300, 290], weight: 1},
  ];
  const byId = Object.fromEntries(WINS.map(w => [w.id, w]));
  const LAYOUTS = {
    classic: {name: 'Classic', about: 'The phone in the middle, panels on either side', make: classic},
    focus: {name: 'Focus', about: 'The phone large on the left, panels stacked on the right', make: focus},
    grid: {name: 'Grid', about: 'The phone on the left, panels in an even grid', make: grid},
  };
  // Classic's two columns: where each panel goes, before the columns are evened out.
  const LEFT = ['device', 'current', 'needs', 'today', 'link'], RIGHT = ['queue', 'log', 'creations', 'apps'];
  const blank = () => ({v: 1, visible: Object.fromEntries(WINS.map(w => [w.id, !!w.core])), z: [...WINS.map(w => w.id).filter(id => id !== 'mirror'), 'mirror'], locked: false, snap: false, snapV: 1, maxed: null,
    slots: {upright: {preset: 'classic', rects: {}}, sideways: {preset: 'focus', rects: {}}}});
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const desk = $('phonegrid'), wins = Object.fromEntries(WINS.map(w => [w.id, desk.querySelector('[data-win="' + w.id + '"]')]));
  let D = load(), slot = 'upright', laid = false, drag = null, menu = null, saveT = 0, animT = 0;

  // ------------------------------------------------------------------ kept on this computer
  function load() {
    const d = blank();
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!s || s.v !== 1) return d;
      for (const w of WINS) if (typeof (s.visible || {})[w.id] === 'boolean') d.visible[w.id] = !!w.fixed || s.visible[w.id];
      if (Array.isArray(s.z)) d.z = [...new Set([...s.z.filter(id => byId[id]), ...d.z])];
      // (windows move freely by default, the owner 2026-10-21: a snap setting kept from before is turned off once)
      d.locked = s.locked === true; d.snap = s.snapV === 1 ? s.snap === true : false; d.snapV = 1; d.headV = s.headV === 1 ? 1 : 0; d.maxed = byId[s.maxed] && d.visible[s.maxed] ? s.maxed : null;
      for (const k of ['upright', 'sideways']) {
        const sl = (s.slots || {})[k]; if (!sl) continue;
        d.slots[k].preset = LAYOUTS[sl.preset] ? sl.preset : null;
        for (const [id, r] of Object.entries(sl.rects || {})) if (byId[id] && fine(r)) d.slots[k].rects[id] = {x: r.x, y: r.y, w: r.w, h: r.h};
      }
    } catch { /* storage is unavailable or unreadable: the defaults */ }
    return d;
  }
  function fine(r) { return !!r && [r.x, r.y, r.w, r.h].every(Number.isFinite) && r.w > .02 && r.h > .02 && r.w <= 1.001 && r.h <= 1.001 && r.x > -1 && r.x < 1 && r.y > -1 && r.y < 1; }
  function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch { /* not kept */ } }, 150); }

  // ------------------------------------------------------------------ the windows' frames: title bar buttons and edges
  for (const w of WINS) {
    const el = wins[w.id], bar = el.querySelector('.winbar');
    bar.tabIndex = 0; bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', w.name + ' window: Enter maximizes it, the arrow keys move it, Shift with the arrows resizes it');
    bar.insertAdjacentHTML('afterbegin', '<span class="wingrip" aria-hidden="true"></span>');
    bar.insertAdjacentHTML('beforeend', '<span class="winbtns">' + (w.id === 'mirror' ? '' : '<button type="button" data-wact="pop" title="Pop out to its own window (put it on another monitor)" aria-label="Pop out ' + esc(w.name) + '">' + icon('popout') + '</button>') + '<button type="button" data-wact="max" title="Maximize" aria-label="Maximize ' + esc(w.name) + '">' + icon('max') + '</button>'
      + (w.fixed ? '' : '<button type="button" data-wact="hide" title="Hide it (Windows shows it again)" aria-label="Hide ' + esc(w.name) + '">' + icon('close') + '</button>') + '</span>');
    el.insertAdjacentHTML('beforeend', ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'].map(k => '<i class="rz ' + k + '" data-rz="' + k + '" aria-hidden="true"></i>').join(''));
    el.hidden = !D.visible[w.id];
    bar.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button, input, select, a, label')) return;
      e.preventDefault(); bar.focus({preventScroll: true});
      if (!D.locked) begin(w.id, 'move', e, bar);
    });
    bar.addEventListener('dblclick', e => { if (!e.target.closest('button')) toggleMax(w.id); });
    bar.addEventListener('keydown', e => keys(w.id, e));
    bar.querySelector('.winbtns').addEventListener('click', e => {
      const b = e.target.closest('[data-wact]'); if (!b) return;
      if (b.dataset.wact === 'pop') { if (window.popOut) window.popOut('hub-' + w.id, el.querySelector('.winbody'), w.name); return; }
      if (b.dataset.wact === 'max') toggleMax(w.id);
      else { show(w.id, false); $('deskwins').focus(); }
    });
    for (const h of el.querySelectorAll('.rz')) h.addEventListener('pointerdown', e => {
      if (e.button !== 0 || D.locked || D.maxed === w.id) return;
      e.preventDefault(); e.stopPropagation(); begin(w.id, h.dataset.rz, e, h);
    });
  }
  // Touching a window brings it to the front (only its stacking changes, so nothing inside it reloads or loses focus).
  desk.addEventListener('pointerdown', e => {
    const el = e.target.closest('.win');
    if (!el) { if (!unfocused) { unfocused = true; stackZ(); if (document.activeElement && desk.contains(document.activeElement)) document.activeElement.blur(); } return; }
    if (topShown() !== el.dataset.win || unfocused) { raise(el.dataset.win); save(); }
  }, true);
  new ResizeObserver(() => { if (!drag) apply(false); }).observe(desk);

  // ------------------------------------------------------------------ placing
  const shown = () => WINS.filter(w => D.visible[w.id]).map(w => w.id);
  const topShown = () => D.maxed || [...D.z].reverse().find(id => D.visible[id]);
  const mins = (id, W, H) => ({w: Math.min(byId[id].min[0], W), h: Math.min(byId[id].min[1], H)});
  const rectOf = id => { const el = wins[id]; return {x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight}; };
  // A kept place in pixels, inside the desk. The owner's own resizing keeps each window at least its smallest size; a
  // layout with more windows than room shares the room (tighter than that, never overlapping), and a desk that shrank
  // scales every place alike; a title bar always shows.
  function px(id, W, H) {
    const r = D.slots[slot].rects[id]; if (!r) return null;
    const w = clamp(r.w * W, Math.min(120, W), W), h = clamp(r.h * H, Math.min(40, H), H);
    return {x: clamp(r.x * W, 0, W - w), y: clamp(r.y * H, 0, H - h), w, h};
  }
  function put(id, r) { const s = wins[id].style; s.left = Math.round(r.x) + 'px'; s.top = Math.round(r.y) + 'px'; s.width = Math.round(r.w) + 'px'; s.height = Math.round(r.h) + 'px'; }
  function keep(id, r, W, H) { const f = v => Math.round(v * 1e5) / 1e5; D.slots[slot].rects[id] = {x: f(r.x / W), y: f(r.y / H), w: f(r.w / W), h: f(r.h / H)}; }
  const keepAll = (rects, W, H) => { for (const [id, r] of Object.entries(rects)) keep(id, r, W, H); };
  function apply(anim) {
    const W = desk.clientWidth, H = desk.clientHeight;
    for (const w of WINS) wins[w.id].hidden = !D.visible[w.id];
    cls(desk, 'locked', D.locked); attr($('desklock'), 'aria-pressed', String(D.locked));
    if (desk.hidden || !W || !H) return false;
    const sl = D.slots[slot];
    // The desk runs up behind the tab's heading, so a window can be moved over it; a layout still as a preset starts
    // below the heading (its windows are laid out in the height under it, then moved down by it).
    const head = desk.parentElement && desk.parentElement.querySelector(':scope > .pagehead'), top = head && head.offsetHeight ? Math.min(H / 3, head.offsetHeight + GAP) : 0;
    const under = rects => { for (const r of Object.values(rects)) { r.y = (r.y * (H - top) + top) / H; r.h = r.h * (H - top) / H; } };
    // (once: an arrangement kept from before the desk ran up behind the heading moves down by it, so nothing jumps over it)
    if (!D.headV && top) { for (const k of ['upright', 'sideways']) if (!D.slots[k].preset) under(D.slots[k].rects); D.headV = 1; save(); }
    if (sl.preset) { LAYOUTS[sl.preset].make(W, H - top); if (top) under(sl.rects); }
    for (const id of shown()) if (!sl.rects[id]) place(id, W, H);
    if (anim && laid && !P.reduced()) { desk.classList.add('anim'); clearTimeout(animT); animT = setTimeout(() => desk.classList.remove('anim'), 340); }
    for (const id of shown()) { frame(id); put(id, D.maxed === id ? {x: 0, y: 0, w: W, h: H} : px(id, W, H)); }
    stackZ(); syncMenu();
    laid = true;
    return true;
  }
  // A window's frame says what it can do now: maximize or restore, and whether its title bar moves it.
  function frame(id) {
    const max = D.maxed === id, b = wins[id].querySelector('[data-wact="max"]');
    cls(wins[id], 'maxed', max); htmlOnce(b, icon(max ? 'restore' : 'max')); b.title = max ? 'Restore' : 'Maximize';
    wins[id].querySelector('.winbar').title = D.locked || max ? 'Double-click to ' + (max ? 'restore' : 'maximize') + (D.locked ? ' · the layout is locked' : '') : 'Drag to move · double-click to maximize';
  }
  // (a click on the empty grid clears the highlight until a window is touched again; the stacking order is kept)
  let unfocused = false;
  function stackZ() { const top = topShown(); for (const w of WINS) { wins[w.id].style.zIndex = String(D.maxed === w.id ? 60 : 10 + D.z.indexOf(w.id)); cls(wins[w.id], 'front', !unfocused && w.id === top); } }
  function raise(id) { unfocused = false; if (D.z[D.z.length - 1] !== id) D.z = [...D.z.filter(x => x !== id), id]; stackZ(); }
  // A window shown in an arranged layout goes where nothing else is, at its usual size, else its smallest. With no room
  // left it goes where it covers the least, at its usual size; covering the phone's screen counts four times over.
  function place(id, W, H) {
    const w = byId[id], others = shown().filter(o => o !== id && D.slots[slot].rects[o]).map(o => ({id: o, ...px(o, W, H)}));
    const cover = r => others.reduce((s, o) => s + Math.max(0, Math.min(r.x + r.w, o.x + o.w + GAP / 2) - Math.max(r.x, o.x - GAP / 2)) * Math.max(0, Math.min(r.y + r.h, o.y + o.h + GAP / 2) - Math.max(r.y, o.y - GAP / 2)) * (o.id === 'mirror' ? 4 : 1), 0);
    const sizes = [w.size || w.min, w.min].map(s => [Math.min(s[0], W), Math.min(s[1], H)]);
    let least = null;
    for (const [i, [fw, fh]] of sizes.entries())
      for (let y = 0; y + fh <= H; y += 16) for (let x = 0; x + fw <= W; x += 16) {
        const r = {x, y, w: fw, h: fh}, c = cover(r);
        if (!c) { keep(id, r, W, H); return; }
        if (i === 0 && (!least || c < least.c)) least = {r, c};
      }
    keep(id, least ? least.r : {x: 0, y: 0, w: sizes[1][0], h: sizes[1][1]}, W, H);
  }

  // ------------------------------------------------------------------ layouts
  // The phone screen window's width for a height: the phone's picture as tall as fits, and its tools on one row.
  function mirrorWidth(H) {
    const body = wins.mirror.querySelector('.winbody'), cs = getComputedStyle(body), tb = $('toolbar'), gap = parseFloat(cs.rowGap) || 8;
    const row = Math.max(30, ...[...tb.children].map(c => c.offsetHeight));
    const tools = [...tb.children].reduce((s, c) => s + c.getBoundingClientRect().width, 0) + (tb.children.length - 1) * 4 + 10;
    const under = [...body.children].filter(c => c.id !== 'stage' && !c.hidden).reduce((s, c) => s + (c === tb ? row : c.offsetHeight + 4) + gap, 0);
    const stageH = H - (wins.mirror.querySelector('.winbar').offsetHeight || 31) - 2 - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - under;
    const wide = aspect > 1, phone = (Math.max(80, stageH) - 4 - (wide ? 24 : 40)) * aspect + (wide ? 44 : 24) + 4;
    return Math.ceil(Math.max(phone, tools) + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 2);
  }
  // How tall a window wants to be at a width: its title bar and its content as laid out.
  function natural(id, w) {
    const el = wins[id], body = el.querySelector('.winbody'), inner = body.firstElementChild, was = el.style.width;
    el.style.width = Math.round(w) + 'px';
    const cs = getComputedStyle(body), h = el.querySelector('.winbar').offsetHeight + (inner ? inner.offsetHeight : 0) + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + 2;
    el.style.width = was;
    return Math.ceil(h);
  }
  // Windows one above another: Device at the height its content needs (leaving the others their smallest heights), the
  // others sharing the rest by weight, each at least its smallest height while there is room; with too many, all shrink.
  function column(ids, x, w, H, out) {
    const avail = H - (ids.length - 1) * GAP, fixed = {}, flex = ids.filter(id => byId[id].weight), min = id => byId[id].min[1], sum = o => Object.values(o).reduce((s, v) => s + v, 0);
    const need = flex.reduce((s, id) => s + min(id), 0);
    for (const id of ids) if (!byId[id].weight) fixed[id] = Math.min(natural(id, w), Math.max(min(id), avail - need));
    let used = sum(fixed);
    if (used + need > avail) {
      const give = Object.keys(fixed).reduce((s, id) => s + Math.max(0, fixed[id] - min(id)), 0);
      if (give > 0) { const f = Math.min(1, (used + need - avail) / give); for (const id in fixed) fixed[id] -= Math.max(0, fixed[id] - min(id)) * f; }
      used = sum(fixed);
    }
    let extra = avail - used - need, scale = 1;
    if (extra < 0) { scale = avail / (used + need); extra = 0; }
    const weights = flex.reduce((s, id) => s + byId[id].weight, 0);
    let y = 0;
    for (const id of ids) {
      const h = id in fixed ? fixed[id] * scale : min(id) * scale + (weights ? extra * byId[id].weight / weights : 0);
      out[id] = {x, y, w, h}; y += h + GAP;
    }
  }
  // An even grid: as many columns as gives the roomiest cells; a short last row spreads across the width.
  function tiles(ids, x, y, w, h, out) {
    const n = ids.length; let best = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols), cw = (w - (cols - 1) * GAP) / cols, ch = (h - (rows - 1) * GAP) / rows, score = Math.min(cw / 280, ch / 160);
      if (!best || score > best.score + 1e-6) best = {cols, ch, score};
    }
    ids.forEach((id, i) => {
      const row = Math.floor(i / best.cols), col = i % best.cols, inRow = Math.min(best.cols, n - row * best.cols), cw = (w - (inRow - 1) * GAP) / inRow;
      out[id] = {x: x + col * (cw + GAP), y: y + row * (best.ch + GAP), w: cw, h: best.ch};
    });
  }
  // Tracks ({v, max}) grow evenly into the free width until each reaches its max; returns what is left.
  function fill(tracks, free) {
    let open = tracks.filter(t => t.v < t.max - .5);
    while (free > .5 && open.length) {
      const inc = free / open.length;
      for (const t of open) { const add = Math.min(inc, t.max - t.v); t.v += add; free -= add; }
      open = open.filter(t => t.v < t.max - .5);
    }
    return free;
  }
  // Classic: the phone in the middle, panels on either side, centred. Everything starts at its smallest and grows evenly
  // until the sides are 300 px wide, then the phone screen grows to its natural width (its tools on one row), then the
  // sides to 400 px; what is left stays around them.
  function classic(W, H) {
    const panels = shown().filter(id => id !== 'mirror'), out = {}, mm = byId.mirror.min[0];
    const left = LEFT.filter(id => panels.includes(id)), right = RIGHT.filter(id => panels.includes(id));
    while (left.length > right.length + 1 && !byId[left[left.length - 1]].core) right.push(left.pop());
    while (right.length > left.length + 1 && !byId[right[right.length - 1]].core) left.push(right.pop());
    const cols = (left.length ? 1 : 0) + (right.length ? 1 : 0), want = Math.max(mm, mirrorWidth(H));
    let M = W, S = 0;
    if (cols) {
      const m = {v: Math.min(want, 360), max: want}, sides = Array.from({length: cols}, () => ({v: 250, max: 300}));
      let free = W - m.v - cols * (250 + GAP);
      if (free >= 0) { free = fill([m, ...sides], free); free = fill([m], free); for (const s of sides) s.max = 400; fill(sides, free); M = m.v; S = sides[0].v; }
      else { S = Math.max(200, 250 + free / cols); M = Math.max(mm, Math.min(m.v, W - cols * (S + GAP))); }
    }
    let x = Math.max(0, (W - M - cols * (S + GAP)) / 2);
    if (left.length) { column(left, x, S, H, out); x += S + GAP; }
    out.mirror = {x, y: 0, w: M, h: H}; x += M + GAP;
    if (right.length) column(right, x, S, H, out);
    keepAll(out, W, H);
  }
  // Focus: the phone large on the left (sideways: most of the desk), the panels stacked on the right, in two columns
  // when one column cannot hold them (Device at its height, the others at their smallest).
  function focus(W, H) {
    const panels = shown().filter(id => id !== 'mirror'), out = {}, mm = byId.mirror.min[0];
    if (!panels.length) { out.mirror = {x: 0, y: 0, w: W, h: H}; return keepAll(out, W, H); }
    const wide = aspect > 1;
    let cols, P, M;
    if (wide) {
      const one = clamp(W * .3, 280, 420), tall = panels.reduce((s, id) => s + (byId[id].weight ? byId[id].min[1] : natural(id, one)), 0) + (panels.length - 1) * GAP;
      cols = panels.length > 1 && tall > H ? 2 : 1;
      P = cols === 1 ? one : clamp(W * .21, 220, 360);
      M = Math.max(W * .52, W - cols * (P + GAP)); P = (W - M) / cols - GAP;
    } else {
      M = clamp(mirrorWidth(H), mm, Math.max(mm, W - 260 - GAP));
      cols = panels.length > 1 && W - M - GAP >= 2 * 280 + GAP ? 2 : 1;
      P = (W - M) / cols - GAP;
    }
    out.mirror = {x: 0, y: 0, w: M, h: H};
    const half = Math.ceil(panels.length / cols);
    column(panels.slice(0, half), M + GAP, P, H, out);
    if (cols === 2) column(panels.slice(half), M + GAP + P + GAP, P, H, out);
    keepAll(out, W, H);
  }
  // Grid: the phone on the left (sideways: most of the width), every panel in an even grid beside it.
  function grid(W, H) {
    const panels = shown().filter(id => id !== 'mirror'), out = {}, mm = byId.mirror.min[0];
    if (!panels.length) { out.mirror = {x: 0, y: 0, w: W, h: H}; return keepAll(out, W, H); }
    const M = aspect > 1 ? clamp(W * .58, mm, Math.max(mm, W - 260 - GAP)) : clamp(mirrorWidth(H), mm, Math.max(mm, W * .5));
    out.mirror = {x: 0, y: 0, w: M, h: H};
    tiles(panels, M + GAP, 0, W - M - GAP, H, out);
    keepAll(out, W, H);
  }

  // ------------------------------------------------------------------ moving and resizing
  function begin(id, kind, e, el) {
    drag = {id, kind, x0: e.clientX, y0: e.clientY, r0: rectOf(id), W: desk.clientWidth, H: desk.clientHeight, box: desk.getBoundingClientRect(), moved: false, r: null};
    try { el.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
  }
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved) {
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      drag.moved = true; desk.classList.add(drag.kind === 'move' ? 'dragging' : 'resizing');
      if (D.maxed === drag.id) unmax(drag);
    }
    // Free by default; Snap on (Layout menu) catches edges, Alt then moves freely; Shift snaps while it is held.
    const snap = (D.snap && !e.altKey) || e.shiftKey;
    drag.r = drag.kind === 'move' ? moveTo(drag, dx, dy, snap) : sizeTo(drag, dx, dy, snap);
    put(drag.id, drag.r);
  });
  function finish() {
    if (!drag) return;
    const d = drag; drag = null;
    desk.classList.remove('dragging', 'resizing'); guide(null, null);
    if (!d.moved || !d.r) return;
    keep(d.id, d.r, d.W, d.H); D.slots[slot].preset = null; save(); syncMenu();
  }
  window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', finish);
  // Dragging a maximized window's title brings it back to its own size, under the pointer.
  function unmax(d) {
    D.maxed = null;
    const r = px(d.id, d.W, d.H) || {w: Math.min(d.W, 480), h: Math.min(d.H, 360)}, fx = (d.x0 - d.box.left) / d.W;
    d.r0 = {x: clamp(d.x0 - d.box.left - fx * r.w, 0, d.W - r.w), y: 0, w: r.w, h: r.h};
    frame(d.id); stackZ();
  }
  // Where edges catch: the desk's edges, and every other window's edges, lined up with them or a gap apart (read once
  // per drag: the other windows stay put meanwhile).
  function targets(id, W, H) {
    const t = {left: [0], right: [W], top: [0], bottom: [H]};
    for (const o of shown()) {
      if (o === id) continue;
      const r = rectOf(o);
      t.left.push(r.x, r.x + r.w + GAP); t.right.push(r.x + r.w, r.x - GAP);
      t.top.push(r.y, r.y + r.h + GAP); t.bottom.push(r.y + r.h, r.y - GAP);
    }
    return t;
  }
  function nearest(pairs) { let b = null; for (const [v, list] of pairs) for (const at of list) { const d = at - v; if (Math.abs(d) <= SNAP && (!b || Math.abs(d) < Math.abs(b.d))) b = {d, at}; } return b; }
  function moveTo(d, dx, dy, snap) {
    const w = d.r0.w, h = d.r0.h;
    let x = clamp(d.r0.x + dx, 0, d.W - w), y = clamp(d.r0.y + dy, 0, d.H - h), gx = null, gy = null;
    if (snap) {
      const t = d.t || (d.t = targets(d.id, d.W, d.H)), sx = nearest([[x, t.left], [x + w, t.right]]), sy = nearest([[y, t.top], [y + h, t.bottom]]);
      if (sx) { x = clamp(x + sx.d, 0, d.W - w); gx = sx.at; }
      if (sy) { y = clamp(y + sy.d, 0, d.H - h); gy = sy.at; }
    }
    guide(gx, gy);
    return {x, y, w, h};
  }
  function sizeTo(d, dx, dy, snap) {
    const m = mins(d.id, d.W, d.H), t = snap ? d.t || (d.t = targets(d.id, d.W, d.H)) : null, k = d.kind;
    let l = d.r0.x, top = d.r0.y, r = l + d.r0.w, b = top + d.r0.h, gx = null, gy = null;
    const catchAt = (v, list, ok) => { const s = t && nearest([[v, list]]); return s && ok(v + s.d) ? s : null; };
    if (k.includes('e')) { r = clamp(r + dx, l + m.w, d.W); const s = catchAt(r, t && t.right, v => v - l >= m.w && v <= d.W); if (s) { r += s.d; gx = s.at; } }
    if (k.includes('w')) { l = clamp(l + dx, 0, r - m.w); const s = catchAt(l, t && t.left, v => r - v >= m.w && v >= 0); if (s) { l += s.d; gx = s.at; } }
    if (k.includes('s')) { b = clamp(b + dy, top + m.h, d.H); const s = catchAt(b, t && t.bottom, v => v - top >= m.h && v <= d.H); if (s) { b += s.d; gy = s.at; } }
    if (k.includes('n')) { top = clamp(top + dy, 0, b - m.h); const s = catchAt(top, t && t.top, v => b - v >= m.h && v >= 0); if (s) { top += s.d; gy = s.at; } }
    guide(gx, gy);
    return {x: l, y: top, w: r - l, h: b - top};
  }
  function guide(gx, gy) {
    const a = $('deskgx'), b = $('deskgy');
    a.hidden = gx === null; if (gx !== null) a.style.left = Math.round(clamp(gx, 0, desk.clientWidth - 1)) + 'px';
    b.hidden = gy === null; if (gy !== null) b.style.top = Math.round(clamp(gy, 0, desk.clientHeight - 1)) + 'px';
  }
  // A focused title bar: Enter maximizes and restores, the arrows move by 8 px, Shift with the arrows resizes.
  function keys(id, e) {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMax(id); return; }
    if (e.key === 'Escape' && D.maxed === id) { e.preventDefault(); toggleMax(id); return; }
    const v = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[e.key];
    if (!v) return;
    e.preventDefault();
    if (D.locked || D.maxed === id) return;
    const W = desk.clientWidth, H = desk.clientHeight, r = rectOf(id), m = mins(id, W, H);
    const n = e.shiftKey ? {x: r.x, y: r.y, w: clamp(r.w + v[0] * STEP, m.w, W - r.x), h: clamp(r.h + v[1] * STEP, m.h, H - r.y)}
      : {x: clamp(r.x + v[0] * STEP, 0, W - r.w), y: clamp(r.y + v[1] * STEP, 0, H - r.h), w: r.w, h: r.h};
    put(id, n); keep(id, n, W, H); D.slots[slot].preset = null; save(); syncMenu();
  }
  function toggleMax(id) { D.maxed = D.maxed === id ? null : id; if (D.maxed) raise(id); save(); apply(true); }
  function show(id, on) {
    if (byId[id].fixed || !!D.visible[id] === on) return;
    D.visible[id] = on;
    if (on || D.maxed === id) D.maxed = null;   // a window shown is never behind a maximized one
    if (on) raise(id);
    save(); apply(true);
    if (on) { paint(); P.motion.enter(wins[id]); }
  }

  // ------------------------------------------------------------------ the menu beside the tabs
  $('deskwins').onclick = e => { e.stopPropagation(); toggleMenu('wins', e.currentTarget); };
  $('desklayout').onclick = e => { e.stopPropagation(); toggleMenu('layout', e.currentTarget); };
  $('desklock').onclick = () => {
    D.locked = !D.locked; save(); apply(false);
    toast(D.locked ? 'Layout locked: the windows stay where they are.' : 'Layout unlocked: drag a title to move a window, an edge or a corner to resize it.');
  };
  function toggleMenu(kind, btn) {
    const was = menu && menu.kind; closeMenu();
    if (was === kind) return;
    menu = {kind, btn};
    const pop = $('deskpop'); drawMenu(); pop.hidden = false; btn.setAttribute('aria-expanded', 'true');
    const r = btn.getBoundingClientRect();
    pop.style.top = Math.round(r.bottom + 4) + 'px';
    pop.style.left = Math.round(clamp(r.right - pop.offsetWidth, 8, window.innerWidth - pop.offsetWidth - 8)) + 'px';
    const first = pop.querySelector('button:not(:disabled)'); if (first) first.focus();
  }
  function closeMenu(back) { if (!menu) return; const b = menu.btn; menu = null; $('deskpop').hidden = true; b.setAttribute('aria-expanded', 'false'); if (back) b.focus(); }
  function drawMenu() {
    if (!menu) return;
    const pop = $('deskpop'), had = pop.contains(document.activeElement) ? document.activeElement.dataset.k : null;
    const box = '<i class="box" aria-hidden="true"></i>', line = (b, s) => '<span><b>' + esc(b) + '</b>' + (s ? '<small>' + esc(s) + '</small>' : '') + '</span>';
    const group = (label, items) => '<div role="group" aria-label="' + esc(label) + '"><p class="eyebrow" aria-hidden="true">// ' + esc(label.toUpperCase()) + '</p>' + items + '</div>';
    if (menu.kind === 'wins') {
      const item = w => '<button type="button" role="menuitemcheckbox" data-k="w:' + w.id + '" aria-checked="' + !!D.visible[w.id] + '"' + (w.fixed ? ' disabled' : '') + '>' + box + line(w.name, w.about) + '</button>';
      pop.innerHTML = group('Windows', WINS.filter(w => w.core).map(item).join('')) + '<hr>' + group('More windows', WINS.filter(w => !w.core).map(item).join(''))
        + '<hr><div class="duo" role="group" aria-label="Show"><button type="button" role="menuitem" data-k="all">' + line('Show all') + '</button><button type="button" role="menuitem" data-k="usual">' + line('Only the usual five') + '</button></div>';
    } else {
      const cur = D.slots[slot].preset;
      pop.innerHTML = group('Layout · ' + (slot === 'sideways' ? 'sideways game' : 'upright') + (cur ? '' : ' · arranged by you'), Object.entries(LAYOUTS).map(([k, l]) => '<button type="button" role="menuitemradio" data-k="l:' + k + '" aria-checked="' + (cur === k) + '">' + box.replace('box', 'box dot') + line(l.name, l.about) + '</button>').join(''))
        + '<hr><button type="button" role="menuitemcheckbox" data-k="snap" aria-checked="' + D.snap + '">' + box + line('Snap', 'Edges catch the desk and other windows. Off: windows move freely (hold Shift to snap once)') + '</button>'
        + '<button type="button" role="menuitem" data-k="reset">' + line('Reset', 'The usual five windows in the classic layout, upright and sideways') + '</button>';
    }
    if (had) { const f = pop.querySelector('[data-k="' + had + '"]'); if (f) f.focus(); }
  }
  function syncMenu() { attr($('desklock'), 'aria-pressed', String(D.locked)); drawMenu(); }
  $('deskpop').addEventListener('click', e => {
    const b = e.target.closest('button[data-k]'); if (!b || b.disabled) return;
    const k = b.dataset.k;
    if (k.startsWith('w:')) { show(k.slice(2), !D.visible[k.slice(2)]); return; }   // the menu stays open for more
    if (k === 'all' || k === 'usual') { for (const w of WINS) D.visible[w.id] = k === 'all' || !!w.core; D.maxed = null; save(); apply(true); paint(); return; }
    if (k.startsWith('l:')) { D.slots[slot].preset = k.slice(2); D.maxed = null; save(); apply(true); closeMenu(true); return; }
    if (k === 'snap') { D.snap = !D.snap; save(); drawMenu(); return; }
    if (k === 'reset') { D = blank(); save(); apply(true); closeMenu(true); toast('Phone tab reset: the usual five windows in the classic layout.'); }
  });
  $('deskpop').addEventListener('keydown', e => {
    const items = [...$('deskpop').querySelectorAll('button:not(:disabled)')], i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]; if (n) n.focus(); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); const n = e.key === 'Home' ? items[0] : items[items.length - 1]; if (n) n.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
    else if (e.key === 'Tab') closeMenu();
  });
  document.addEventListener('pointerdown', e => { if (menu && !e.target.closest('#deskpop, #deskwins, #desklayout')) closeMenu(); }, true);
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && menu) closeMenu(!document.activeElement || document.activeElement === document.body); });
  window.addEventListener('resize', () => closeMenu());

  // ------------------------------------------------------------------ what app.js calls
  // The phone's picture turned (a game played sideways, or back): its own arrangement; a small change of shape only
  // moves a layout that is still a preset.
  window.deskOrient = function (wide) {
    const want = wide ? 'sideways' : 'upright';
    if (want !== slot) { slot = want; apply(true); return; }
    if (D.slots[slot].preset) apply(false);
  };
  window.deskTab = function (t) { if (t !== 'phone') closeMenu(); $('deskmenu').hidden = t !== 'phone' || desk.hidden; };
  window.renderDesk = function (d, ready) {
    $('deskmenu').hidden = !ready || tab !== 'phone';
    if (!ready) { closeMenu(); return; }
    if (!laid) apply(false);
    paint(d);
  };
  function paint(d = dev()) {
    if (!d || !S) return;
    if (D.visible.needs) drawNeeds(d);
    if (D.visible.apps) drawApps(d);
    if (D.visible.creations) { drawCreations(); void loadCreations(false); }
    if (D.visible.today) { drawToday(d); void loadToday(false); }
    if (D.visible.link) drawLink(d);
  }
  // A list that was empty (one note in it) becomes rows: the note goes, and so does its memory in htmlOnce.
  function rowsFrom(box) { if (box.querySelector('[data-empty]')) { box.innerHTML = ''; delete box.dataset.h; } }

  // ------------------------------------------------------------------ Needs you
  function needsOf(d) {
    const out = [];
    for (const x of S.devices) if (x.emergency) out.push({k: 'em:' + x.id, mood: 'red', ic: 'stop', t: 'Emergency Stop is on' + (S.devices.length > 1 ? ' · ' + x.label : ''), s: 'Autopilot and tasks stay stopped until you clear it.', a: [['clear', 'Clear']]});
    for (const t of S.tasks) {
      if (t.state === 'NEEDS_REVIEW') out.push({k: 't:' + t.id, mood: 'sand', ic: 'check', t: 'Approve ' + t.app, s: t.objective, a: [['task:' + t.id, 'Review']]});
      else if (t.state === 'NEEDS_ATTENTION') out.push({k: 't:' + t.id, mood: 'sand', ic: 'flag', t: t.app + ' needs you', s: t.lastError || (t.history[t.history.length - 1] || {}).reason || t.objective, a: [['task:' + t.id, 'Open']]});
    }
    for (const l of (S.sandbox && S.sandbox.live) || []) if (l.status === 'NEEDS_ATTENTION') out.push({k: 'sb:' + l.id, mood: 'sand', ic: 'sandbox', t: l.title + ' is waiting', s: l.reason || 'The sequence waits for you.', a: [['sbresume:' + l.id, 'Resume'], ['sbstop:' + l.id, 'Stop']]});
    for (const i of (S.queue && S.queue.items) || []) if (i.deviceId === d.id && (i.status === 'WAITING_FOR_USER' || i.status === 'BLOCKED')) out.push({k: 'q:' + i.key, mood: i.status === 'BLOCKED' ? 'red' : 'sand', ic: 'queue', t: i.name, s: i.reason || (i.status === 'BLOCKED' ? 'Blocked' : 'Waiting for you'), a: [['qd:' + i.key, 'Details']]});
    const n = (S.notices && S.notices.unread) || 0;
    if (n) out.push({k: 'bell', mood: 'muted', ic: 'bell', t: n + ' new notification' + (n === 1 ? '' : 's'), s: 'Updates, guides and milestones from Falcor.', a: [['bell', 'Open']]});
    return out;
  }
  function drawNeeds(d) {
    const list = needsOf(d), box = $('needslist'), c = $('needscount');
    c.hidden = !list.length; text(c, list.length);
    if (!list.length) { htmlOnce(box, '<li class="none" data-empty><img src="dragon.png" alt=""><span>Nothing needs you right now.</span></li>'); return; }
    rowsFrom(box);
    keyed(box, list, x => x.k, () => P.el('<li class="need"></li>'), (n, x) => {
      n.dataset.mood = x.mood;
      htmlOnce(n, '<span class="needi">' + icon(x.ic) + '</span><span class="needt"><b>' + esc(x.t) + '</b><span>' + esc(x.s) + '</span></span><span class="needa">' + x.a.map(([k, l]) => '<button class="small" data-n="' + esc(k) + '">' + esc(l) + '</button>').join('') + '</span>');
    });
  }
  $('needslist').addEventListener('click', async e => {
    const b = e.target.closest('[data-n]'); if (!b || b.disabled) return;
    const k = b.dataset.n, op = k.split(':')[0], id = k.slice(k.indexOf(':') + 1);
    if (k === 'bell') { e.stopPropagation(); bellOpen(true); return; }
    if (k === 'clear') { $('clear').click(); return; }
    if (op === 'task') { followLink('tasks', id); return; }
    if (op === 'qd') { if (window.qDetails) void window.qDetails(id); return; }
    if (op === 'sbresume' || op === 'sbstop') { b.disabled = true; try { await call('sandbox', {op: op === 'sbresume' ? 'resume' : 'stop', runId: id}); } catch { /* call() said why */ } finally { b.disabled = false; } }
  });

  // ------------------------------------------------------------------ Apps: open any app on the phone
  function drawApps(d) {
    const q = $('appsq').value.trim().toLowerCase(), names = d.installedNames || {}, box = $('appslist');
    const all = (d.installed || []).filter(p => !/launcher|systemui/.test(p)).map(p => ({pkg: p, name: names[p] || p}));
    const list = all.filter(a => !q || a.name.toLowerCase().includes(q) || a.pkg.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
    const busy = d.emergency ? 'Emergency Stop is on' : d.running ? 'A task is running on the phone' : d.sandbox ? 'A Sandbox sequence is running on the phone' : '';
    text($('appscount'), all.length ? all.length + ' app' + (all.length === 1 ? '' : 's') : '');
    if (!list.length) { htmlOnce(box, '<li class="none" data-empty><span>' + (all.length ? 'No app matches "' + esc(q) + '".' : 'No apps read yet. Press the arrows to read the phone\'s app list.') + '</span></li>'); return; }
    rowsFrom(box);
    keyed(box, list, a => a.pkg, () => P.el('<li class="lrow"><span class="gicon xs"></span><span class="lnm"><b></b><small></small></span><span class="lfront">IN FRONT</span><button class="small" data-open="">Open</button></li>'), (n, a) => {
      const g = (S.games || []).find(x => x.pkg === a.pkg);
      htmlOnce(n.firstElementChild, g && g.icon ? iconHtml(g) : P.monogram(a.name, a.pkg));
      text(n.querySelector('.lnm b'), a.name); text(n.querySelector('.lnm small'), a.pkg);
      cls(n, 'front', d.foreground === a.pkg);
      const b = n.querySelector('[data-open]'); b.dataset.open = a.pkg; b.disabled = !!busy; b.title = busy ? busy + '.' : 'Open ' + a.name + ' on the phone; you get control';
    });
  }
  $('appsq').addEventListener('input', () => { const d = dev(); if (d) drawApps(d); });
  $('appsrefresh').onclick = async () => { const d = dev(); if (!d) return; try { await call('refreshApps', {deviceId: d.id}); toast('The phone\'s app list was read again.'); } catch { /* call() said why */ } };
  $('appslist').addEventListener('click', async e => {
    const b = e.target.closest('[data-open]'), d = dev(); if (!b || b.disabled || !b.dataset.open || !d) return;
    const pkg = b.dataset.open; b.disabled = true;
    try { await call('openApp', {deviceId: d.id, pkg}); toast('Opened ' + ((d.installedNames || {})[pkg] || pkg) + '. You have control: use it on the mirror, then press Release.'); }
    catch { /* call() said why */ } finally { b.disabled = false; }
  });

  // ------------------------------------------------------------------ Creations: run or stop a sequence from here
  const CW = {list: null, err: '', at: 0, busy: false, seq: 0};
  async function loadCreations(force) {
    if (CW.busy || (!force && Date.now() - CW.at < 6000)) return;
    CW.busy = true; const mine = ++CW.seq;
    try { const l = await window.hub.call('views', {op: 'creations'}); if (mine === CW.seq) { CW.list = l; CW.err = ''; } }
    catch (e) { if (mine === CW.seq) CW.err = errText(e); }
    finally { CW.busy = false; CW.at = Date.now(); if (tab === 'phone' && D.visible.creations) drawCreations(); }
  }
  function drawCreations() {
    const box = $('crwlist'), all = CW.list;
    text($('crwcount'), all ? String(all.length) : '');
    if (!all || !all.length) { htmlOnce(box, '<li class="none" data-empty><span>' + (all ? 'No creations yet. Build one in Sandbox.' : CW.err ? 'Creations could not be read: ' + esc(CW.err) : 'Reading your creations…') + '</span></li>'); return; }
    rowsFrom(box);
    keyed(box, [...all].sort((a, b) => Number(b.favorite) - Number(a.favorite)), c => c.seqId, () => P.el('<li class="lrow"><span class="lic"></span><span class="lnm"><b></b><small></small></span><span class="lacts"></span></li>'), (n, c) => {
      const off = c.needsSetup ? 'Add blocks in Sandbox first' : c.device.state === 'none' || c.device.state === 'offline' ? c.device.why : '';
      n.dataset.seq = c.seqId; cls(n, 'live', !!c.live); cls(n, 'needs', !!c.needsAttention && !c.live);
      htmlOnce(n.firstElementChild, icon(c.icon || 'sandbox'));
      text(n.querySelector('.lnm b'), c.title);
      text(n.querySelector('.lnm small'), c.live ? c.live.label + (c.live.step ? ' · ' + c.live.step : '') : c.needsSetup ? 'Needs setup: add blocks in Sandbox' : c.last ? c.last.label + ' · ' + P.ago(c.last.at) : c.nextRunAt ? 'Next ' + when(c.nextRunAt) : 'Not run yet');
      htmlOnce(n.querySelector('.lacts'), c.live ? '<button class="small danger" data-cw="stop" title="Stop the run">' + icon('stop') + 'Stop</button>'
        : '<button class="small primary" data-cw="run"' + (off ? ' disabled title="' + esc(off) + '"' : ' title="Run it now (if something else runs, the queue asks first)"') + '>' + icon('play') + 'Run</button>');
    });
  }
  $('crwlist').addEventListener('click', async e => {
    const b = e.target.closest('[data-cw]'); if (!b || b.disabled) return;
    const row = b.closest('[data-seq]'), c = row && CW.list && CW.list.find(x => x.seqId === row.dataset.seq); if (!c) return;
    b.disabled = true;
    try {
      if (b.dataset.cw === 'run') await window.qRun({type: 'sequence', id: c.seqId}, {name: c.title});
      else if (c.live) await call('sandbox', {op: 'stop', runId: c.live.runId});
    } catch (err) { toast(errText(err), 'warn'); }
    finally { b.disabled = false; void loadCreations(true); }
  });

  // ------------------------------------------------------------------ Today: how the day went, in the queue's time zone
  const TD = {rows: null, more: false, day: '', at: 0, busy: false, err: ''};
  function dayIn(tz) {
    try { return new Intl.DateTimeFormat('en-CA', {timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date()); }
    catch { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); }
  }
  async function loadToday(force) {
    const day = dayIn(S.queue && S.queue.tz);
    if (TD.busy || (!force && day === TD.day && Date.now() - TD.at < 20000)) return;
    TD.busy = true;
    try { const r = await window.hub.call('views', {op: 'activity', query: {from: day, to: day, limit: 100}}); TD.rows = r.rows; TD.more = !!r.next; TD.day = day; TD.err = ''; }
    catch (e) { TD.err = errText(e); }
    finally { TD.busy = false; TD.at = Date.now(); if (tab === 'phone' && D.visible.today) drawToday(dev()); }
  }
  function drawToday(d) {
    if (!d) return;
    const rows = TD.rows || [], plus = TD.more ? '+' : '', count = outs => rows.filter(r => outs.includes(r.outcome)).length;
    const q = S.queue, c = q && q.counts, nx = q && q.devices[d.id] && q.devices[d.id].next;
    const sp = S.spend || {teach: 0, chat: 0, autopilot: 0}, spent = sp.teach + sp.chat + sp.autopilot, lim = S.limit, frac = lim ? Math.min(1, spent / lim) : 0;
    text($('todaydate'), new Date().toLocaleDateString([], {weekday: 'short', month: 'short', day: 'numeric'}));
    htmlOnce($('todaybody'), (TD.err && !TD.rows ? '<p class="small red">Today\'s runs could not be read: ' + esc(TD.err) + '</p>' : '')
      + '<div class="ttiles">' + [['Completed', count(['completed']), 'green'], ['Needs you', count(['attention', 'waiting']), 'sand'], ['Failed', count(['failed']), 'red'], ['Stopped', count(['stopped', 'interrupted', 'skipped']), 'muted']]
        .map(([l, v, m]) => '<span class="tt" data-mood="' + m + '"><b>' + (TD.rows ? v + (v ? plus : '') : '·') + '</b><em>' + l + '</em></span>').join('') + '</div>'
      + '<dl class="spec"><dt>Queue</dt><dd>' + (c && c.total ? c.completed + ' of ' + c.total + ' done' + (c.left ? ' · ' + c.left + ' left' : '') : 'Nothing planned today') + '</dd>'
      + '<dt>Next</dt><dd>' + (nx ? esc(nx.name) + '<small>' + esc(time(nx.at)) + ' · ' + esc(when(nx.at)) + '</small>' : '—') + '</dd>'
      + '<dt>Runs</dt><dd>' + (TD.rows ? rows.length + plus + ' today' : 'Reading…') + '</dd>'
      + '<dt>AI</dt><dd>' + esc(money(spent)) + (lim !== null && lim !== undefined ? ' of ' + esc(money(lim)) : '') + ' this month<small>estimated; the provider\'s bill is exact</small></dd></dl>'
      + (lim ? '<div class="meter' + (frac >= 1 ? ' bad' : frac >= .8 ? ' warn' : '') + '">' + Array.from({length: 20}, (_, i) => '<i class="' + (i < Math.round(frac * 20) ? 'on' : '') + '"></i>').join('') + '</div>' : ''));
  }

  // ------------------------------------------------------------------ Connection
  function drawLink(d) {
    const video = vid.on && !$('video').hidden, img = $('mirror'), w = video ? $('video').width : Number(img.dataset.w) || img.naturalWidth, h = video ? $('video').height : Number(img.dataset.h) || img.naturalHeight;
    const online = S.remote.phones.filter(p => Date.now() - p.lastSeenAt < 90_000).length, led = ok => '<i class="led ' + (ok ? 'on' : 'bad') + '"></i>';
    htmlOnce($('linkspec'), '<dt>Phone</dt><dd>' + esc(d.label) + (d.model && d.model !== d.label ? '<small>' + esc(d.model) + (d.androidVersion ? ' · Android ' + esc(d.androidVersion) : '') + '</small>' : '') + '</dd>'
      + '<dt>Cable</dt><dd>' + led(d.connected && d.authorized) + (d.connected ? d.authorized ? 'Connected, USB debugging allowed' : 'Allow USB debugging on the phone' : 'Not connected') + '</dd>'
      + '<dt>Screen</dt><dd>' + (w && h ? w + ' × ' + h + ' · ' + (w > h ? 'sideways' : 'upright') : '—') + '</dd>'
      + '<dt>Mirror</dt><dd>' + (video ? 'Video from scrcpy' : 'Pictures') + (fpsText ? '<small>' + esc(fpsText) + '</small>' : '') + '</dd>'
      + (d.battery !== null && d.battery !== undefined ? '<dt>Battery</dt><dd>' + d.battery + '%</dd>' : '')
      + '<dt>Tools</dt><dd>' + led(S.adb) + 'adb ' + (S.adb ? 'ready' : 'missing') + ' · ' + led(S.scrcpy) + 'scrcpy ' + (S.scrcpy ? 'ready' : 'missing') + '</dd>'
      + '<dt>Phone app</dt><dd>' + (S.remote.phones.length ? S.remote.phones.length + ' paired · ' + online + ' online now' : 'Not paired yet') + '</dd>');
    $('linkviewer').disabled = $('viewer').disabled;
  }
  $('linkviewer').onclick = () => $('viewer').click();
  $('linkmirror').onclick = () => { endVideo(null); vid.failed = false; vid.tries = 0; vid.error = ''; $('mirrorwait').hidden = false; nextFrame(0); toast('Starting the live mirror again…'); };
  $('linkapps').onclick = () => $('appsrefresh').click();
})();

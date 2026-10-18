// Falcor's pixel kit, shared by Falcor.Hub's window and the phone app (remote/ imports this same file): the pixel icon
// set, render-in-place helpers (build once, then update only what changed), stepped number counters, success bursts,
// tap markers and the launch intro. Plain JS, no framework, no network.
(function () {
  // ------------------------------------------------------------------ icons: 12×12 pixel maps drawn on a 16×16 grid
  const MAPS = {
    phone: ['...######...', '..#......#..', '..#.####.#..', '..#.#..#.#..', '..#.#..#.#..', '..#.#..#.#..', '..#.#..#.#..', '..#.####.#..', '..#......#..', '..#..##..#..', '..#......#..', '...######...'],
    tasks: ['............', '.##.#######.', '.##.........', '............', '.##.#######.', '.##.........', '............', '.##.#######.', '.##.........', '............', '.##.#####...', '.##.........'],
    stats: ['..........##', '..........##', '.......##.##', '.......##.##', '.......##.##', '....##.##.##', '....##.##.##', '.##.##.##.##', '.##.##.##.##', '.##.##.##.##', '............', '############'],
    settings: ['.....##.....', '..#.####.#..', '.##########.', '..###..###..', '.###....###.', '###......###', '###......###', '.###....###.', '..###..###..', '.##########.', '..#.####.#..', '.....##.....'],
    autopilot: ['.....##.....', '....####....', '...#.##.#...', '..#..##..#..', '.#...##...#.', '#....##....#', '#....##....#', '.#........#.', '..#......#..', '...#....#...', '....####....', '............'],
    stop: ['...######...', '..#......#..', '.#........#.', '#..######..#', '#..######..#', '#..######..#', '#..######..#', '#..######..#', '#..######..#', '.#........#.', '..#......#..', '...######...'],
    back: ['............', '....#.......', '...##.......', '..###.......', '.##########.', '###########.', '.##########.', '..###.......', '...##.......', '....#.......', '............', '............'],
    home: ['.....##.....', '....####....', '...######...', '..########..', '.##########.', '############', '..########..', '..##....##..', '..##....##..', '..##....##..', '..##....##..', '..########..'],
    apps: ['............', '.####..####.', '.####..####.', '.####..####.', '.####..####.', '............', '............', '.####..####.', '.####..####.', '.####..####.', '.####..####.', '............'],
    keyboard: ['............', '............', '############', '#..........#', '#.#.#.#.#..#', '#..........#', '#.#.#.#.#.##', '#..........#', '#..######..#', '#..........#', '############', '............'],
    control: ['.#..........', '.##.........', '.###........', '.####.......', '.#####......', '.######.....', '.#######....', '.########...', '.#####......', '.##.##......', '.#...##.....', '.....##.....'],
    speed: ['......####..', '.....####...', '....####....', '...####.....', '..#########.', '.#########..', '......###...', '.....###....', '....###.....', '...###......', '..##........', '.#..........'],
    checkin: ['..#......#..', '############', '#..........#', '############', '#..........#', '#.......#..#', '#......##..#', '#.#...##...#', '#.##.##....#', '#..###.....#', '#...#......#', '############'],
    game: ['............', '............', '.##########.', '#..........#', '#.#......#.#', '###.####.###', '#.#......#.#', '#..........#', '#....##....#', '.##########.', '............', '............'],
    signup: ['...####.....', '..######....', '..######....', '..######....', '...####.....', '............', '.########...', '##########.#', '#########.###', '#########..#.', '##########..', '............'],
    reward: ['...######...', '..#......#..', '.#..####..#.', '#..#....#..#', '#..#.##.#..#', '#..#.##.#..#', '#..#.##.#..#', '#..#....#..#', '.#..####..#.', '..#......#..', '...######...', '............'],
    ai: ['.....##.....', '.....##.....', '....####....', '.##########.', '..########..', '...######...', '...######...', '..##....##..', '.##......##.', '............', '.#........#.', '##........##'],
    wifi: ['............', '..########..', '.#........#.', '#..######..#', '..#......#..', '.#..####..#.', '...#....#...', '..#..##..#..', '.....##.....', '.....##.....', '............', '............'],
    usb: ['.....##.....', '....####....', '.....##.....', '.#...##..###', '###..##..###', '.#...##...#.', '.#...##..#..', '..##.##.#...', '....###.....', '.....##.....', '....####....', '....####....'],
    lock: ['...######...', '..#......#..', '..#......#..', '..#......#..', '############', '############', '#####..#####', '#####..#####', '######.#####', '############', '############', '............'],
    update: ['...######.#.', '..#......##.', '.#......###.', '#...........', '#...........', '#..........#', '#..........#', '...........#', '.###......#.', '.##......#..', '.#.######...', '............'],
    chat: ['############', '#..........#', '#..........#', '#.##.##.##.#', '#..........#', '#..........#', '############', '...##.......', '...#........', '..#.........', '............', '............'],
    book: ['.####..####.', '#....##....#', '#.##.##.##.#', '#....##....#', '#.##.##.##.#', '#....##....#', '#.##.##.##.#', '#....##....#', '#....##....#', '.####..####.', '............', '............'],
    rec: ['............', '....####....', '..########..', '..########..', '.##########.', '.##########.', '.##########.', '.##########.', '..########..', '..########..', '....####....', '............'],
    flag: ['.#..........', '.########...', '.#########..', '.##########.', '.#########..', '.########...', '.#..........', '.#..........', '.#..........', '.#..........', '.#..........', '.#..........'],
    pause: ['............', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '............'],
    play: ['............', '..#.........', '..###.......', '..#####.....', '..#######...', '..#########.', '..#########.', '..#######...', '..#####.....', '..###.......', '..#.........', '............'],
    edit: ['.........##.', '........####', '.......####.', '......####..', '.....####...', '....####....', '...####.....', '..####......', '.####.......', '.##.........', '##..........', '#...........'],
    trash: ['....####....', '############', '............', '.##########.', '.#.#.##.#.#.', '.#.#.##.#.#.', '.#.#.##.#.#.', '.#.#.##.#.#.', '.#.#.##.#.#.', '.#.#.##.#.#.', '.##########.', '............'],
    export: ['.....#......', '....###.....', '...#####....', '..#######...', '.....#......', '.....#......', '.....#......', '#....#.....#', '#..........#', '#..........#', '############', '............'],
    laptop: ['............', '.##########.', '.#........#.', '.#........#.', '.#........#.', '.#........#.', '.#........#.', '.##########.', '############', '#..........#', '############', '............'],
    check: ['............', '..........##', '.........###', '........###.', '.......###..', '#.....###...', '##...###....', '###.###.....', '.#####......', '..###.......', '...#........', '............'],
    close: ['............', '.##......##.', '..##....##..', '...##..##...', '....####....', '.....##.....', '....####....', '...##..##...', '..##....##..', '.##......##.', '............', '............'],
    plus: ['............', '.....##.....', '.....##.....', '.....##.....', '.....##.....', '.##########.', '.##########.', '.....##.....', '.....##.....', '.....##.....', '.....##.....', '............'],
    minus: ['............', '............', '............', '............', '............', '.##########.', '.##########.', '............', '............', '............', '............', '............'],
    search: ['..#####.....', '.#.....#....', '#.......#...', '#.......#...', '#.......#...', '#.......#...', '.#.....#....', '..#####.#...', '.........#..', '..........#.', '...........#', '............'],
    chevron: ['............', '............', '............', '.#........#.', '.##......##.', '..##....##..', '...##..##...', '....####....', '.....##.....', '............', '............', '............'],
    pin: ['....####....', '...######...', '...######...', '...######...', '..########..', '.##########.', '.....##.....', '.....##.....', '.....##.....', '.....##.....', '.....#......', '............'],
    eye: ['............', '............', '...######...', '.##......##.', '#....##....#', '#...####...#', '#...####...#', '#....##....#', '.##......##.', '...######...', '............', '............'],
    send: ['............', '#...........', '###.........', '#####.......', '#######.....', '#########...', '###########.', '#########...', '#######.....', '#####.......', '###.........', '#...........'],
    coin: ['...######...', '..##....##..', '.#..####..#.', '#..##..##..#', '#..##......#', '#...####...#', '#......##..#', '#..##..##..#', '.#..####..#.', '..##....##..', '...######...', '............'],
    gem: ['............', '..########..', '.#..#..#..#.', '############', '#...#..#...#', '.#..#..#..#.', '..#.#..#.#..', '...##..##...', '....#..#....', '.....##.....', '............', '............'],
    cash: ['............', '############', '#..........#', '#.#..##..#.#', '#...#..#...#', '#...#..#...#', '#.#..##..#.#', '#..........#', '############', '............', '............', '............'],
    gift: ['...##..##...', '..#..##..#..', '############', '#....##....#', '############', '.#....#...#.', '.#....#...#.', '.#....#...#.', '.#....#...#.', '.#....#...#.', '.##########.', '............'],
    sandbox: ['....####....', '...#....#...', '..#..##..#..', '.#..#..#..#.', '#..#....#..#', '#.#..##..#.#', '#.#..##..#.#', '#..#....#..#', '.#..#..#..#.', '..#..##..#..', '...#....#...', '....####....'],
    swipe: ['............', '.........#..', '.........##.', '############', '.........##.', '.........#..', '............', '..#.........', '.##.........', '############', '.##.........', '..#.........'],
    wait: ['############', '.#........#.', '.#........#.', '..#......#..', '...#....#...', '....#..#....', '....#..#....', '...#.##.#...', '..#.####.#..', '.#.######.#.', '.#.######.#.', '############'],
    loop: ['....####....', '..##....##..', '.#........#.', '.#.........#', '#.........##', '#.........#.', '#...........', '#..........#', '.#........#.', '.#........#.', '..##....##..', '....####....'],
    branch: ['..##........', '..##........', '..##.....##.', '..##.....##.', '..##....##..', '..##...##...', '..##..##....', '..##.##.....', '..####......', '..###.......', '..##........', '..##........'],
    camera: ['............', '....####....', '.##########.', '#..........#', '#...####...#', '#..#....#..#', '#..#.##.#..#', '#..#.##.#..#', '#..#....#..#', '#...####...#', '#..........#', '.##########.'],
    var: ['............', '..##....##..', '.#........#.', '.#.#...#..#.', '.#..#.#...#.', '#....#.....#', '#....#.....#', '.#..#.#...#.', '.#.#...#..#.', '.#........#.', '..##....##..', '............'],
    undo: ['............', '...#........', '..##........', '.#########..', '..##......#.', '...#.......#', '...........#', '...........#', '..........#.', '.....#####..', '............', '............'],
    redo: ['............', '........#...', '........##..', '..#########.', '.#......##..', '#.......#...', '#...........', '#...........', '.#..........', '..#####.....', '............', '............'],
    star: ['.....##.....', '.....##.....', '....####....', '....####....', '############', '.##########.', '..########..', '...######...', '..########..', '..###..###..', '.###....###.', '.##......##.'],
    calendar: ['..#.....#...', '############', '#..........#', '############', '#..........#', '#.##.##.##.#', '#.##.##.##.#', '#..........#', '#.##.##.##.#', '#.##.##.##.#', '#..........#', '############'],
    target: ['.....##.....', '...######...', '..#..##..#..', '.#...##...#.', '.#..####..#.', '######..####', '######..####', '.#..####..#.', '.#...##...#.', '..#..##..#..', '...######...', '.....##.....'],
    help: ['...######...', '..##....##..', '.##......##.', '.......##...', '......##....', '.....##.....', '.....##.....', '.....##.....', '............', '.....##.....', '.....##.....', '............'],
    copy: ['.#######....', '.#.....#....', '.#..#######.', '.#..#.....#.', '.#..#.....#.', '.#..#.....#.', '.####.....#.', '....#.....#.', '....#.....#.', '....#.....#.', '....#######.', '............'],
    grid: ['#..#..#..#..', '............', '............', '#..#..#..#..', '............', '............', '#..#..#..#..', '............', '............', '#..#..#..#..', '............', '............'],
  };
  const pathOf = rows => { let d = ''; rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '#') { let w = 1; while (r[x + w] === '#') w++; d += 'M' + (x + 2) + ' ' + (y + 2) + 'h' + w + 'v1h-' + w + 'z'; x += w - 1; } }); return d; };
  // The sprite: one <symbol> per icon. Use with icon('stop').
  function sprite() {
    if (document.getElementById('pixel-sprite')) return;
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('id', 'pixel-sprite'); svg.setAttribute('aria-hidden', 'true'); svg.style.display = 'none';
    for (const [name, rows] of Object.entries(MAPS)) {
      const sym = document.createElementNS(ns, 'symbol'); sym.setAttribute('id', 'i-' + name); sym.setAttribute('viewBox', '0 0 16 16');
      const p = document.createElementNS(ns, 'path'); p.setAttribute('d', pathOf(rows)); p.setAttribute('fill', 'currentColor'); p.setAttribute('shape-rendering', 'crispEdges');
      sym.appendChild(p); svg.appendChild(sym);
    }
    document.body.prepend(svg);
  }
  const icon = (name, cls) => '<svg class="ico' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';

  // ------------------------------------------------------------------ render in place
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  // Inline styles are written as data-style and applied through the CSSOM, which the page's CSP allows.
  function fix(root) { if (!root) return root; const all = root.querySelectorAll ? [...(root.matches && root.matches('[data-style]') ? [root] : []), ...root.querySelectorAll('[data-style]')] : []; for (const n of all) { n.style.cssText = n.dataset.style; n.removeAttribute('data-style'); } return root; }
  function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return fix(t.content.firstElementChild); }
  const text = (node, v) => { if (node && node.textContent !== String(v)) node.textContent = String(v); };
  const attr = (node, k, v) => { if (!node) return; if (v === null || v === false || v === undefined) { if (node.hasAttribute(k)) node.removeAttribute(k); } else if (node.getAttribute(k) !== String(v === true ? '' : v)) node.setAttribute(k, v === true ? '' : v); };
  const cls = (node, c, on) => { if (node && node.classList.contains(c) !== !!on) node.classList.toggle(c, !!on); };
  // Keyed list: new items are created (and rise in once), gone ones removed, the rest updated where they are. Order kept.
  function keyed(box, items, key, make, update) {
    const have = new Map([...box.children].filter(c => c.dataset.key).map(c => [c.dataset.key, c]));
    const want = new Set();
    let prev = null;
    items.forEach((it, i) => {
      const k = String(key(it)); want.add(k);
      let node = have.get(k);
      if (!node) { node = make(it, i); node.dataset.key = k; if (box.dataset.ready) node.classList.add('rise'); node.style.setProperty('--i', String(Math.min(i, 8))); }
      update(node, it, i);
      const at = prev ? prev.nextElementSibling : box.firstElementChild;
      if (at !== node) box.insertBefore(node, at);
      prev = node;
    });
    for (const [k, node] of have) if (!want.has(k)) node.remove();
    for (const c of [...box.children]) if (!c.dataset.key && c.dataset.empty === undefined) c.remove();
    box.dataset.ready = '1';
  }
  // Same, for a list whose whole content is one string per item (cheap rows).
  function htmlOnce(node, html) { if (node && node.dataset.h !== html) { node.dataset.h = html; node.innerHTML = html; fix(node); } }

  // ------------------------------------------------------------------ motion helpers
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Numbers roll up in steps like an arcade counter.
  function roll(node, to, fmt = v => String(v)) {
    if (!node) return;
    const from = Number(node.dataset.v ?? to);
    node.dataset.v = String(to);
    if (from === to || reduced() || !Number.isFinite(from) || !Number.isFinite(to)) { text(node, fmt(to)); return; }
    let i = 0; const steps = 8;
    clearInterval(node._roll);
    node._roll = setInterval(() => { i++; const v = i >= steps ? to : from + (to - from) * i / steps; text(node, fmt(Number.isInteger(to) ? Math.round(v) : v)); if (i >= steps) clearInterval(node._roll); }, 45);
  }
  // A pixel burst of sand and white squares from an element (a task verified, a reward claimed, pairing done).
  function burst(node) {
    if (!node || reduced()) return;
    const r = node.getBoundingClientRect(), box = document.createElement('div');
    box.className = 'burst'; box.style.left = (r.left + r.width / 2) + 'px'; box.style.top = (r.top + r.height / 2) + 'px';
    for (let i = 0; i < 12; i++) { const p = document.createElement('i'); const a = i / 12 * Math.PI * 2; p.style.setProperty('--dx', Math.round(Math.cos(a) * (28 + (i % 3) * 14)) + 'px'); p.style.setProperty('--dy', Math.round(Math.sin(a) * (28 + (i % 3) * 14)) + 'px'); if (i % 3 === 0) p.className = 'w'; box.appendChild(p); }
    document.body.appendChild(box); setTimeout(() => box.remove(), 700);
    node.classList.remove('flash'); void node.offsetWidth; node.classList.add('flash');
  }
  // A pixel crosshair snapping in from 4 directions, with falling dust: for every tap, the owner's or Falcor's.
  function tapMark(layer, x, y, falcor) {
    if (!layer) return;
    const m = document.createElement('div'); m.className = 'tapx' + (falcor ? ' falcor' : ''); m.style.left = x + '%'; m.style.top = y + '%';
    m.innerHTML = '<i class="n"></i><i class="s"></i><i class="e"></i><i class="w"></i><b></b><b></b><b></b>';
    layer.appendChild(m); setTimeout(() => m.remove(), 520);
  }
  function trail(layer, x, y, x2, y2) {
    if (!layer) return;
    for (let i = 0; i <= 6; i++) { const d = document.createElement('div'); d.className = 'trail'; d.style.left = (x + (x2 - x) * i / 6) + '%'; d.style.top = (y + (y2 - y) * i / 6) + '%'; d.style.animationDelay = (i * 40) + 'ms'; layer.appendChild(d); setTimeout(() => d.remove(), 700); }
  }
  // A 7-or-14-day sparkline as stepped pixel bars (inline SVG, crisp).
  function spark(values, color) {
    const max = Math.max(1, ...values), w = values.length * 4;
    return '<svg class="spark" viewBox="0 0 ' + w + ' 12" preserveAspectRatio="none" aria-hidden="true">' + values.map((v, i) => { const hgt = v ? Math.max(1, Math.round(v / max * 12)) : 0; return hgt ? '<rect x="' + (i * 4) + '" y="' + (12 - hgt) + '" width="3" height="' + hgt + '" fill="' + (color || 'currentColor') + '" shape-rendering="crispEdges"/>' : '<rect x="' + (i * 4) + '" y="11" width="3" height="1" fill="currentColor" opacity=".25"/>'; }).join('') + '</svg>';
  }

  // ------------------------------------------------------------------ the launch intro (one canvas, about 3.5 s)
  // A pixel night: navy sky, twinkling stars, a moon, slow cloud streaks, mountains and a pine tree line. The white
  // luckdragon materializes at the left edge as a green glitch inside targeting brackets, flies to the centre leaving a
  // green pixel trail, flaps and settles; a green line draws under it and the name types in; then it dissolves away.
  // Drawn on a small canvas scaled up with hard pixels. Click or a key skips it.
  // The flying dragon, facing right: W white, G light shade, D wing membrane, K eye. Two wing frames.
  const BODY = [
    '..........................W.W...',
    '..........................WWW...',
    '.........................WWWWW..',
    '........................WWKWWWW.',
    '.......................WWWWWWWWW',
    '..........WWWWW.......WWWW...GG.',
    '...WW...WWWWWWWWWWWWWWWWW.......',
    '..WWWW.WWWWWWWWWWWWWWWWW........',
    '.W..WWWWWWGGGGGGWWWWWW..........',
    'W....WWWWGG....GGWW.WW..........',
    '.........WW.....WW...WW.........',
    '........WW.....WW....W..........',
  ];
  const WING_UP = ['DDD...........', '.GGDDD........', '..GGGGDDD.....', '...GGGGGGDDD..', '....GDGGDGGGDW', '.....D..D..GWW'];
  const WING_DOWN = ['.....GGGGGGGWW', '....GGGGGGDD..', '...GGGGDD.....', '..GDDD........', '.D............'];
  const COL = {W: '#EDEDED', G: '#BFC3CC', D: '#6F7584', K: '#0A0A0A'};
  // Each sprite pixel is drawn as Z×Z canvas pixels (the dragon is drawn at twice the scene's pixel size).
  const Z = 2;
  function drawRows(g, rows, x, y, map) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = r[i]; if (c !== '.') { g.fillStyle = map ? map(c, i, j) : COL[c]; g.fillRect(x + i * Z, y + j * Z, Z, Z); } } }); }
  function dragonAt(g, x, y, flap, glitch) {
    const wing = flap ? WING_DOWN : WING_UP, wy = flap ? y + 6 * Z : y + (6 - WING_UP.length) * Z;
    const tint = glitch ? (c, i, j) => ((i + j + glitch) % 3 === 0 ? 'rgba(0,0,0,0)' : (i * 7 + j * 3 + glitch) % 5 < 2 ? '#5CE59A' : c === 'K' ? '#0A0A0A' : '#9FF0C4') : null;
    drawRows(g, BODY, x, y, tint);
    drawRows(g, wing, x + 8 * Z, wy, tint);
  }
  function intro({version, sub, name = 'FALCOR.HUB'}) {
    return new Promise(resolve => {
      if (reduced()) { resolve(); return; }
      const c = document.createElement('canvas'); c.className = 'intro'; document.body.appendChild(c);
      const scale = Math.max(2, Math.round(Math.min(innerWidth, innerHeight * 1.6) / 420));
      const W = Math.ceil(innerWidth / scale), H = Math.ceil(innerHeight / scale);
      c.width = W; c.height = H;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const stars = Array.from({length: Math.round(W * H / 90)}, () => ({x: rnd() * W, y: rnd() * H * 0.82, b: rnd(), p: rnd() * 6}));
      const sparkles = stars.filter(s => s.b > 0.975);
      const clouds = Array.from({length: 6}, () => ({x: rnd() * W, y: H * (0.15 + rnd() * 0.45), w: 10 + rnd() * 18, v: 1 + rnd() * 2}));
      const peaks = Array.from({length: Math.ceil(W / 60) + 2}, (_, i) => ({x: i * 60 + rnd() * 10, h: 26 + rnd() * 12}));
      const pines = Array.from({length: Math.ceil(W / 3)}, (_, i) => ({x: i * 3, h: 6 + Math.floor(rnd() * 11)}));
      const cx = Math.round(W / 2 - 32), cy = Math.round(H * 0.4 - 12), trail = [];
      const start = performance.now(); let done = false;
      const end = () => { if (done) return; done = true; c.classList.add('out'); setTimeout(() => { c.remove(); resolve(); }, 320); };
      c.addEventListener('pointerdown', end); window.addEventListener('keydown', end, {once: true});
      const frame = now => {
        if (done) return;
        const t = (now - start) / 1000, f = Math.floor(t * 12);
        // Sky, a faint dither, stars that twinkle, sparkle crosses.
        const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#090B12'); sky.addColorStop(0.75, '#0E1220'); sky.addColorStop(1, '#121728');
        g.fillStyle = sky; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(120,140,190,.05)'; for (let y = 0; y < H; y += 2) for (let x = (y / 2) % 2; x < W; x += 2) if (y > H * 0.5) g.fillRect(x, y, 1, 1);
        for (const s of stars) { const tw = Math.sin(t * 2 + s.p) > 0.6 ? 1 : 0.55; g.globalAlpha = (0.25 + s.b * 0.6) * tw; g.fillStyle = '#EDEDED'; g.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1); }
        g.globalAlpha = 1; g.fillStyle = '#EDEDED';
        for (const s of sparkles) if (Math.sin(t * 3 + s.p) > -0.2) { const x = Math.floor(s.x), y = Math.floor(s.y); g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
        // The moon, with a few craters, and slow cloud streaks.
        const mx = Math.round(W * 0.79), my = Math.round(H * 0.19);
        for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) { const d = x * x + y * y; if (d <= 49) { g.fillStyle = d > 36 ? '#C9CDD5' : (x === -2 && y === -2) || (x === 3 && y === 1) || (x === -1 && y === 3) ? '#B4B9C3' : '#E8EAEE'; g.fillRect(mx + x, my + y, 1, 1); } }
        g.fillStyle = 'rgba(70,80,105,.55)';
        for (const cl of clouds) { const x = Math.floor((cl.x + t * cl.v) % (W + 40)) - 20; g.fillRect(x, Math.floor(cl.y), Math.floor(cl.w), 2); g.fillRect(x + 3, Math.floor(cl.y) - 1, Math.floor(cl.w * 0.6), 1); }
        // Mountains, then the pine tree line.
        for (const pk of peaks) for (let i = -30; i <= 30; i++) { const hgt = Math.max(0, pk.h - Math.abs(i) * pk.h / 30), top = Math.floor(H - 8 - hgt); g.fillStyle = '#161B2A'; g.fillRect(Math.floor(pk.x + i), top, 1, Math.ceil(hgt) + 8); g.fillStyle = '#262D42'; g.fillRect(Math.floor(pk.x + i), top, 1, 1); }
        g.fillStyle = '#0B0D14';
        for (const p of pines) { for (let k = 0; k < p.h; k++) { const w = Math.max(1, Math.floor((p.h - k) / 3)); g.fillRect(p.x + 1 - Math.floor(w / 2), H - 4 - k, w, 1); } }
        g.fillRect(0, H - 4, W, 4);
        // The dragon: a glitch at the left edge inside brackets, then flight to the centre with a green trail, then a hover.
        const fly = Math.min(1, Math.max(0, (t - 0.55) / 1.1)), ease = 1 - Math.pow(1 - fly, 3);
        const x = Math.round(2 + (cx - 2) * ease), bob = fly >= 1 ? (Math.floor(t * 4) % 2 ? -1 : 0) : (f % 4 < 2 ? -1 : 1), y = cy + bob;
        const glitch = t < 0.55 ? f + 1 : 0;
        if (t < 0.55) {
          g.fillStyle = 'rgba(92,229,154,.25)'; g.fillRect(0, y + 8 * Z, W, 1);
          g.fillStyle = '#C8CCD6';
          const bx = x - 4, by = y - 12, bw = 32 * Z + 8, bh = 12 * Z + 16;
          for (const [px, py, dx, dy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]]) { g.fillRect(px, py, 3 * dx || 1, 1); g.fillRect(px, py, 1, 3 * dy || 1); }
          for (let i = 0; i < 3; i++) { const sy = y + ((f * 5 + i * 4) % (12 * Z)), sx = (f % 2 ? 3 : -3); g.save(); g.beginPath(); g.rect(0, sy, W, 3); g.clip(); dragonAt(g, x + sx, y, f % 2, glitch); g.restore(); }
        }
        if (t >= 0.45 && fly < 1) trail.push({x: x + 8, y: y + 7 * Z, a: 1});
        for (const p of trail) { p.a -= 0.045; if (p.a <= 0) continue; for (let k = 0; k < 10; k++) if ((k + Math.floor(p.x)) % 2 === 0) { g.fillStyle = 'rgba(92,229,154,' + (p.a * 0.75).toFixed(2) + ')'; g.fillRect(Math.floor(p.x - k * 2), p.y - 5 + ((k * 3 + Math.floor(p.x)) % 10), 1, 1); } }
        dragonAt(g, x, y, fly < 1 ? f % 2 : Math.floor(t * 2.5) % 3 === 2 ? 1 : 0, glitch);
        // The green line draws under it, then the name types in, with the subtitle under it.
        const mid = cx + 16 * Z, below = cy + 12 * Z;
        if (t > 1.75) { const lw = Math.min(64, Math.floor((t - 1.75) * 160)); g.fillStyle = '#5CE59A'; g.fillRect(mid - Math.floor(lw / 2), below + 4, lw, 1); }
        if (t > 2.05) {
          const shown = Math.min(name.length, Math.floor((t - 2.05) * 16));
          g.font = '12px "Departure Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'top';
          g.fillStyle = '#0A0A0A'; g.fillText(name.slice(0, shown), mid + 1, below + 9);
          g.fillStyle = '#EDEDED'; g.fillText(name.slice(0, shown), mid, below + 8);
          if (shown >= name.length && sub) { g.font = '6px "Departure Mono", monospace'; g.fillStyle = '#5CE59A'; g.fillText((sub + (version ? ' ' + version : '')).toUpperCase(), mid, below + 21); }
        }
        if (t > 3.45) { end(); return; }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }

  // ------------------------------------------------------------------ games (the Games tab on both apps)
  // A game without an icon gets a pixel monogram in one of the four colors (always the same for the same app).
  const monogram = (name, pkg) => '<b class="mono c' + [...String(pkg)].reduce((n, c) => n + c.charCodeAt(0), 0) % 4 + '">' + esc((String(name).match(/[A-Za-z0-9]/) || ['?'])[0].toUpperCase()) + '</b>';
  // The Games tab's reward parts, the same on both apps. g.rewards: per unit {unit, collected, pending, offered, unknown}
  // (collected: the app showed it claimed or credited; never added across units).
  const num = v => Number.isInteger(v) ? v.toLocaleString() : Number(v).toFixed(2);
  const unitIcon = u => /coin|gold/i.test(u) ? 'coin' : /gem|diamond/i.test(u) ? 'gem' : /cash|usd|\$|dollar/i.test(u) ? 'cash' : /gift/i.test(u) ? 'gift' : 'reward';
  const day = at => new Date(at).toLocaleDateString([], {month: 'short', day: 'numeric'}) + ' ' + new Date(at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  // A tile's one line: what it collected, else an earning app's offer (collected of possible), else what is pending,
  // else what its challenges offer.
  const earnLine = g => {
    const r = g.rewards || [], got = r.filter(x => x.collected), wait = r.filter(x => x.pending), offer = (g.earning || [])[0];
    return got.length ? got.map(x => num(x.collected) + ' ' + x.unit).join(' · ')
      : offer ? 'via ' + offer.source.name + (offer.progress.units[0] ? ' · ' + num(offer.progress.units[0].collected) + ' / ' + num(offer.progress.units[0].possible) + ' ' + offer.progress.units[0].unit : '')
      : wait.length ? wait.map(x => '+' + num(x.pending) + ' ' + x.unit + ' pending').join(' · ') : Object.entries(g.offers || {}).map(([u, a]) => 'offers ' + num(a) + ' ' + u).join(' · ');
  };
  // Offers from earning apps: where from, what each milestone pays, what is done, the earnings so far and the deadline.
  // Each milestone's box ticks it done (data-offer, data-i); edit: Edit and Remove buttons (the computer).
  const ends = at => { const d = Math.round((at - Date.now()) / 86_400_000), h = Math.round((at - Date.now()) / 3_600_000); return at < Date.now() ? '<span class="red">ended</span>' : d >= 2 ? 'ends in ' + d + ' days' : 'ends in ' + Math.max(1, h) + ' h'; };
  const offersHtml = (g, edit) => (g.earning || []).map(o => '<div class="offer"><div class="top"><b>via ' + esc(o.source.name) + '</b><span class="muted small">' + (o.manual ? '<span class="pill sand">you play it</span> ' : '') + (o.expiresAt ? ends(o.expiresAt) + ' · ' : '') + o.progress.done + ' of ' + o.progress.of + ' done</span></div>'
    + o.progress.units.map(u => '<div class="ounit">' + icon(unitIcon(u.unit)) + ' <b>' + num(u.collected) + '</b> of ' + num(u.possible) + ' ' + esc(u.unit) + '<span class="rbar"><i class="c" data-style="flex:' + u.collected + '"></i><i data-style="flex:' + Math.max(0, u.possible - u.collected) + '"></i></span></div>').join('')
    + (o.total ? '<p class="muted small">The app says: up to ' + num(o.total.amount) + ' ' + esc(o.total.unit) + '</p>' : '')
    + '<ul class="mstones">' + o.milestones.map((m, i) => '<li class="' + (m.done ? 'done' : '') + '"><label><input type="checkbox" data-offer="' + esc(o.id) + '" data-i="' + i + '"' + (m.done ? ' checked' : '') + '> <span>' + esc(m.text) + '</span></label><b>' + (m.amount === null ? '' : num(m.amount) + ' ' + esc(m.unit)) + '</b>'
      + (m.paid ? '<em class="sand">needs a purchase: yours to decide</em>' : m.reached ? '<em class="green">level seen: confirm it in ' + esc(o.source.name) + '</em>' : '') + '</li>').join('') + '</ul>'
    + (edit ? '<div class="row"><button class="small" data-offer-edit="' + esc(o.id) + '">' + icon('edit') + 'Edit</button><button class="small danger" data-offer-remove="' + esc(o.id) + '">' + icon('trash') + 'Remove</button></div>' : '') + '</div>').join('');
  const rewardsHtml = g => (g.rewards || []).length ? '<div class="earns">' + g.rewards.map(x => '<div class="earn"><span class="u">' + icon(unitIcon(x.unit)) + ' ' + esc(x.unit) + '</span><b>' + num(x.collected) + '</b><span class="muted small">collected'
    + (x.pending ? ' · ' + num(x.pending) + ' pending' : '') + (x.offered ? ' · offer ' + num(x.offered) : '') + (x.unknown ? ' · ' + x.unknown + ' without an amount' : '') + '</span>'
    + '<span class="rbar">' + (x.collected + x.pending ? '<i class="c" data-style="flex:' + x.collected + '"></i><i class="p" data-style="flex:' + x.pending + '"></i>' : '<i></i>') + '</span></div>').join('') + '</div>'
    : '<p class="muted small">Nothing collected yet. Each reward the game shows claimed, credited or pending is added here per unit.</p>';
  const STAGE = {claimed: 'collected', confirmed: 'credited', received: 'received', pending: 'pending'};
  const historyHtml = g => (g.history || []).length ? '<ul class="rhist">' + g.history.map(h => '<li><time>' + esc(day(h.at)) + '</time><b class="' + (h.stage === 'pending' ? 'sand' : 'green') + '">' + (h.amount === null ? '?' : '+' + num(h.amount)) + ' ' + esc(h.unit) + '</b><span class="pill ' + (h.stage === 'pending' ? 'sand' : 'green') + '">' + esc(STAGE[h.stage] || h.stage) + '</span><span class="muted small">' + esc(h.task) + (h.source ? ' · ' + esc(h.source) : '') + '</span></li>').join('') + '</ul>'
    : '<p class="muted small">No rewards yet.</p>';
  const tiersHtml = g => ((g.objectives || []).length ? '<ul class="objs">' + g.objectives.map(o => '<li>' + icon('check') + ' ' + esc(o) + '</li>').join('') + '</ul>' : '')
    + ((g.tiers || []).length ? '<table class="tiers"><tr><th>Tier</th><th>To get it</th><th>Reward</th><th>Time</th></tr>' + g.tiers.map(t => '<tr><td>' + esc(t.tier) + '</td><td>' + esc(t.requirement) + '</td><td>' + esc(t.reward) + (t.amount !== null && t.amount !== undefined ? ' · ' + icon(unitIcon(t.unit)) + ' ' + num(t.amount) + ' ' + esc(t.unit) : '') + '</td><td>' + esc(t.timeLimit || '—') + '</td></tr>').join('') + '</table>' : '');
  // A level challenge's progress: level now of the target, as blocks (at most 20).
  const progressHtml = t => { if (!t.targetLevel) return ''; const n = Math.min(20, t.targetLevel), on = Math.round(Math.min(1, (t.level || 0) / t.targetLevel) * n); return '<div class="lvbar" title="Level ' + (t.level ?? 0) + ' of ' + t.targetLevel + '">' + Array.from({length: n}, (_, i) => '<i class="' + (i < on ? 'on' : '') + '"></i>').join('') + '</div>'; };

  // Pause idle loops while the window or tab is hidden.
  document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('idle-off', document.hidden));

  window.Pixel = {MAPS, sprite, icon, esc, el, fix, text, attr, cls, keyed, htmlOnce, roll, burst, tapMark, trail, spark, intro, reduced, monogram, num, unitIcon, earnLine, offersHtml, rewardsHtml, historyHtml, tiersHtml, progressHtml};
})();

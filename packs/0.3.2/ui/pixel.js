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

  // ------------------------------------------------------------------ the launch intro (one canvas, about 3 s)
  // A night sky of twinkling scrolling stars; the white pixel dragon glitches in at the left, flaps to the centre and
  // settles; FALCOR.HUB unfolds letter by letter with the version under it; then it fades out in 4 steps. Click to skip.
  function intro({dragon, version, sub}) {
    return new Promise(resolve => {
      if (reduced()) { resolve(); return; }
      const c = document.createElement('canvas'); c.className = 'intro'; document.body.appendChild(c);
      const W = 240, H = 150; c.width = W; c.height = H;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      const img = new Image(); img.src = dragon;
      const stars = Array.from({length: 70}, (_, i) => ({x: (i * 97) % W, y: (i * 53) % H, s: i % 7 === 0 ? 2 : 1, t: i % 5}));
      const word = 'FALCOR.HUB', start = performance.now();
      let done = false;
      const end = () => { if (done) return; done = true; c.classList.add('out'); setTimeout(() => { c.remove(); resolve(); }, 260); };
      c.addEventListener('pointerdown', end); window.addEventListener('keydown', end, {once: true});
      const frame = now => {
        if (done) return;
        const t = (now - start) / 1000, f = Math.floor(t * 12);
        g.fillStyle = '#0A0A0A'; g.fillRect(0, 0, W, H);
        for (const s of stars) { const on = (f + s.t) % 9 !== 0; g.fillStyle = on ? (s.s > 1 ? '#F5B544' : '#EDEDED') : '#333'; g.globalAlpha = on ? .8 : .4; g.fillRect(Math.floor((s.x - t * 6 * s.s + W) % W), s.y, s.s, s.s); }
        g.globalAlpha = 1;
        if (img.complete && img.naturalWidth) {
          const size = 48, p = Math.min(1, t / 1.3), ease = 1 - Math.pow(1 - p, 2), x = Math.round(8 + (W / 2 - size / 2 - 8) * ease), flap = p < 1 ? (f % 4 < 2 ? -3 : 0) : (f % 24 < 12 ? -1 : 0), y = 28 + flap;
          if (t < .45) { for (let i = 0; i < 6; i++) { const sh = (f + i) % 3 === 0 ? (i % 2 ? 6 : -6) : 0; g.drawImage(img, 0, i * img.naturalHeight / 6, img.naturalWidth, img.naturalHeight / 6, x + sh, y + i * size / 6, size, size / 6); } }
          else g.drawImage(img, x, y, size, size);
        }
        const shown = Math.max(0, Math.min(word.length, Math.floor((t - 1.1) * 9)));
        g.font = '14px "Departure Mono", monospace'; g.textAlign = 'center'; g.fillStyle = '#EDEDED';
        g.fillText(word.slice(0, shown), W / 2, 100);
        if (shown >= word.length) { g.font = '7px "Departure Mono", monospace'; g.fillStyle = '#5CE59A'; g.fillText((sub || '') + ' ' + (version || ''), W / 2, 114); }
        if (t > 2.9) { end(); return; }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }

  // Pause idle loops while the window or tab is hidden.
  document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('idle-off', document.hidden));

  window.Pixel = {MAPS, sprite, icon, esc, el, fix, text, attr, cls, keyed, htmlOnce, roll, burst, tapMark, trail, spark, intro, reduced};
})();

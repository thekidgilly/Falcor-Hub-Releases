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
    queue: ['............', '.#..#######.', '.##.........', '.###.######.', '.##.........', '.#..#######.', '............', '....#######.', '............', '....#######.', '............', '............'],
    menu: ['............', '............', '.##########.', '.##########.', '............', '............', '.##########.', '.##########.', '............', '............', '.##########.', '.##########.'],
    bell: ['.....##.....', '....####....', '...######...', '..########..', '..########..', '..########..', '..########..', '.##########.', '############', '............', '....####....', '.....##.....'],
    clock: ['...######...', '..#......#..', '.#...#....#.', '#....#.....#', '#....#.....#', '#....####..#', '#..........#', '#..........#', '.#........#.', '..#......#..', '...######...', '............'],
    skip: ['............', '.#......##..', '.##.....##..', '.###....##..', '.####...##..', '.#####..##..', '.#####..##..', '.####...##..', '.###....##..', '.##.....##..', '.#......##..', '............'],
    dots: ['............', '............', '............', '............', '............', '.##..##..##.', '.##..##..##.', '............', '............', '............', '............', '............'],
    up: ['............', '............', '.....##.....', '....####....', '...######...', '..###..###..', '.###....###.', '.##......##.', '............', '............', '............', '............'],
    down: ['............', '............', '............', '.##......##.', '.###....###.', '..###..###..', '...######...', '....####....', '.....##.....', '............', '............', '............'],
    grid: ['#..#..#..#..', '............', '............', '#..#..#..#..', '............', '............', '#..#..#..#..', '............', '............', '#..#..#..#..', '............', '............'],
    windows: ['########....', '########....', '#......#....', '#......#....', '#...########', '#...########', '#####......#', '....#......#', '....#......#', '....#......#', '....########', '............'],
    layout: ['############', '#....#.....#', '#....#.....#', '#....#.....#', '#....#######', '#....#.....#', '#....#.....#', '#....#.....#', '#....#######', '#....#.....#', '#....#.....#', '############'],
    max: ['............', '############', '############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '############', '............'],
    restore: ['...#########', '...#########', '...#.......#', '#########..#', '#########..#', '#.......#..#', '#.......#..#', '#.......####', '#.......#...', '#.......#...', '#########...', '............'],
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
  // Shared finite motion: never changes application state or delays an action.
  const moving = new Set();
  const motion = {
    play(node, frames, token = '--motion-base') {
      if (!node || reduced() || document.hidden || !node.animate) return null;
      if (node._falcorMotion) node._falcorMotion.cancel();
      const css = getComputedStyle(document.documentElement);
      const a = node.animate(frames, {duration: parseFloat(css.getPropertyValue(token)) || 200, easing: css.getPropertyValue('--ease-out').trim() || 'ease-out'});
      node._falcorMotion = a; moving.add(a);
      const done = () => { moving.delete(a); if (node._falcorMotion === a) delete node._falcorMotion; };
      a.addEventListener('finish', done, {once: true}); a.addEventListener('cancel', done, {once: true});
      return a;
    },
    enter(node) { return motion.play(node, [{opacity: .55, transform: 'translateY(4px)'}, {opacity: 1, transform: 'none'}]); },
    dismiss(node) {
      if (!node || node.dataset.leaving) return;
      node.dataset.leaving = '1';
      const a = motion.play(node, [{opacity: 1, transform: 'none'}, {opacity: 0, transform: 'translateY(5px)'}], '--motion-fast');
      if (a) a.finished.catch(() => {}).then(() => node.remove()); else node.remove();
    },
    snapshot(box) { return reduced() || !box ? new Map() : new Map([...box.querySelectorAll('.blk')].map(n => [n.dataset.id, n.getBoundingClientRect()])); },
    settle(box, before) {
      if (reduced() || !before.size) return;
      for (const n of box.querySelectorAll('.blk')) {
        const old = before.get(n.dataset.id); if (!old) continue;
        const now = n.getBoundingClientRect(), x = old.x - now.x, y = old.y - now.y;
        if ((Math.abs(x) > 1 || Math.abs(y) > 1) && Math.abs(x) < box.clientWidth && Math.abs(y) < box.clientHeight)
          motion.play(n, [{transform: `translate(${x}px,${y}px)`}, {transform: 'none'}], '--motion-panel');
      }
    }
  };
  const stopMotion = () => { for (const a of moving) a.cancel(); };
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => { if (e.matches) stopMotion(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopMotion(); });

  // A pixel burst of sand and white squares from an element (a task verified, a reward claimed, pairing done).
  function burst(node) {
    if (!node || reduced()) return;
    const r = node.getBoundingClientRect(), box = document.createElement('div');
    box.className = 'burst'; box.style.left = (r.left + r.width / 2) + 'px'; box.style.top = (r.top + r.height / 2) + 'px';
    for (let i = 0; i < 6; i++) { const p = document.createElement('i'); const a = i / 6 * Math.PI * 2; p.style.setProperty('--dx', Math.round(Math.cos(a) * (14 + (i % 3) * 5)) + 'px'); p.style.setProperty('--dy', Math.round(Math.sin(a) * (14 + (i % 3) * 5)) + 'px'); if (i % 3 === 0) p.className = 'w'; box.appendChild(p); }
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

  // Startup presentation shared by Hub and Companion. Fast readiness must not erase the branded sequence.
  // Local sprite frames are registered to the same head position before drawing on the device pixel grid.
  function intro({dragon, flight, name = 'FALCOR HUB', status = 'INITIALIZING', skip = false}) {
    const root = document.getElementById('boot-screen') || document.createElement('div');
    root.id = 'boot-screen'; root.className = 'boot-screen';
    root.setAttribute('role', 'status'); root.setAttribute('aria-label', name + ' — ' + status.toLowerCase());
    if (!root.isConnected) document.body.appendChild(root);
    let done = false, ready = false, raf = 0, timeout = 0, readyTimer = 0, removeTimer = 0, resolveFinished;
    const finished = new Promise(resolve => { resolveFinished = resolve; });
    const canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');
    const label = document.createElement('div'); label.className = 'boot-label';
    const title = document.createElement('b'); title.textContent = name;
    const detail = document.createElement('span'); detail.textContent = status;
    const skipButton = document.createElement('button'); skipButton.className = 'boot-skip';
    skipButton.type = 'button'; skipButton.textContent = 'Skip intro'; skipButton.onclick = () => close();
    label.append(title, detail); root.replaceChildren(canvas, label, skipButton);
    const g = canvas.getContext('2d'), preference = matchMedia('(prefers-reduced-motion: reduce)');
    let W = 0, H = 0, D = 1, size = 0, start = performance.now(), reducedMotion = preference.matches;
    const icon = new Image(), sheet = new Image();
    // Capped backing density keeps memory bounded; transforms and destinations always use whole device pixels.
    function resize() {
      D = Math.min(3, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
      canvas.width = Math.round(W * D); canvas.height = Math.round(H * D);
      if (g) g.imageSmoothingEnabled = false;
      size = W < 600 ? Math.min(128, W * .34, H * .23) : Math.min(160, H * .25);
      label.style.top = Math.round(H * .46 + size * .5 + 22) + 'px';
      draw(performance.now());
    }
    function dispose() {
      clearTimeout(removeTimer); root.remove(); resolveFinished();
    }
    // Initialization proceeds independently. Its first response requests an exit after arrival and brand reveal.
    function finish() {
      if (done || ready) return;
      ready = true; detail.textContent = ''; root.setAttribute('aria-label', name);
      const remaining = skip || reducedMotion ? 0 : Math.max(0, 2350 - (performance.now() - start));
      if (!remaining) close(); else readyTimer = setTimeout(close, remaining);
    }
    function close() {
      if (done) return;
      done = true; cancelAnimationFrame(raf); clearTimeout(timeout); clearTimeout(readyTimer);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pagehide', close);
      preference.removeEventListener('change', changeMotion);
      icon.onload = sheet.onload = icon.onerror = sheet.onerror = null;
      root.classList.add('boot-out'); root.setAttribute('aria-hidden', 'true'); skipButton.disabled = true;
      // The usable interface receives input immediately, including during this short visual fade.
      removeTimer = setTimeout(dispose, skip || reducedMotion ? 0 : 160);
    }
    function changeMotion() { reducedMotion = preference.matches; if (reducedMotion && ready) { close(); return; } cancelAnimationFrame(raf); draw(performance.now()); }
    const clamp = n => Math.max(0, Math.min(1, n));
    const smooth = n => 1 - Math.pow(1 - clamp(n), 3);
    const loaded = img => img.complete && img.naturalWidth > 0;
    function blit(img, sx, sy, sw, sh, x, y, w, h, alpha = 1) {
      if (!g || !loaded(img)) return;
      g.globalAlpha = alpha;
      g.drawImage(img, sx, sy, sw, sh, Math.round(x * D), Math.round(y * D), Math.round(w * D), Math.round(h * D));
    }
    function draw(now) {
      if (done) return;
      cancelAnimationFrame(raf);
      const t = (now - start) / 1000, settled = reducedMotion || t >= 2.15;
      if (g) g.clearRect(0, 0, canvas.width, canvas.height);
      const cx = W / 2, cy = H * .46, fly = smooth((t - .12) / 1.42), arrival = smooth((t - 1.5) / .5);
      const flightSize = size * 1.8;
      const x = -flightSize + (cx + flightSize) * fly;
      const y = cy - Math.sin((1 - fly) * Math.PI) * Math.min(100, H * .12);
      if (!reducedMotion && t < 2.15 && g) {
        // Only six fragments, with a time-based fade. No persistent particle loop.
        for (let i = 0; i < 6; i++) {
          g.globalAlpha = .14 * (1 - arrival) * clamp((t - .12) * 5);
          g.fillStyle = '#EDEFF3';
          const px = x - flightSize * .32 - i * 11, py = y + flightSize * .18 + (i % 3 - 1) * 5;
          g.fillRect(Math.round(px * D), Math.round(py * D), Math.max(1, Math.round(D)), Math.max(1, Math.round(D)));
        }
        if (loaded(sheet)) {
          const frame = t > 1.35 ? 3 : [0, 1, 2, 1][Math.floor(t * 7) % 4];
          const cell = sheet.naturalWidth / 2;
          // Source art's lower poses have a higher head baseline; register them without stretching the body.
          const sx = frame % 2 ? cell - 10 * cell / 640 : 0;
          const sy = frame > 1 ? cell : 0;
          const dy = frame > 1 ? 100 / 640 : 0;
          const dx = frame % 2 ? 32 / 640 : 0;
          blit(sheet, sx, sy, cell, cell, x - flightSize / 2 + dx * flightSize, y - flightSize * .65 + dy * flightSize, flightSize, flightSize, 1 - arrival);
        } else {
          blit(icon, 0, 0, icon.naturalWidth, icon.naturalHeight, x - size / 2, y - size / 2, size, size, 1 - arrival);
        }
      }
      const alpha = reducedMotion ? 1 : arrival;
      blit(icon, 0, 0, icon.naturalWidth, icon.naturalHeight, cx - size / 2, cy - size / 2 - (1 - alpha) * 5, size, size, alpha);
      if (g) g.globalAlpha = 1;
      const reveal = reducedMotion ? 1 : clamp((t - 1.82) / .28);
      label.style.opacity = String(reveal);
      title.style.clipPath = 'inset(0 ' + (100 - Math.floor(reveal * name.length) / name.length * 100) + '% 0 0)';
      detail.style.opacity = settled ? '.48' : '0';
      root.dataset.phase = settled ? 'waiting' : t < .12 ? 'black' : t < 1.5 ? 'flight' : 'arrival';
      // A slow connection holds a static completed mark. No hidden/background animation work after arrival.
      if (!settled) raf = requestAnimationFrame(draw);
    }
    icon.onload = sheet.onload = () => draw(performance.now());
    icon.onerror = sheet.onerror = () => draw(performance.now());
    icon.src = dragon; if (flight) sheet.src = flight;
    window.addEventListener('resize', resize);
    window.addEventListener('pagehide', close, {once: true});
    preference.addEventListener('change', changeMotion);
    resize();
    // Presentation must never trap the user if an IPC response or frame load is lost.
    timeout = setTimeout(close, 8000);
    if (skip) close();
    return {finish, finished};
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
  // ---------------------------------------------------------------- Game Intelligence (both apps): library cards, the
  // reward ladder and what an offer stands at. A goal reached in the game is not money: only credited and paid out are
  // earnings; pending is the earning app saying it is on its way. Each unit stays apart.
  const CASH = {usd: '$', eur: '€', gbp: '£'};
  const money = (a, u) => a === null || a === undefined ? '?' : CASH[u] ? CASH[u] + Number(a).toFixed(2) : num(a) + ' ' + u;
  const MSTATE = [['not_started', 'Not started'], ['goal_reached', 'Goal reached'], ['provider_confirmed', 'Provider confirmed'], ['pending_credit', 'Pending credit'], ['credited', 'Credited'], ['paid_out', 'Paid out']];
  const MOOD = {not_started: 'muted', in_progress: 'accent', goal_reached: 'green', provider_confirmed: 'sand', pending_credit: 'sand', credited: 'green', paid_out: 'green', expired: 'red'};
  const BY = {screen: 'observed', owner: 'you', falcor: 'Falcor'};
  const GSTATUS = {active: ['ACTIVE', 'green'], completed: ['COMPLETED', 'accent'], expired: ['EXPIRED', 'red'], none: ['TRACKED', 'muted']};
  // A game's library card: artwork, name, platform, what its offers advertise and paid, goals reached as blocks, status
  // and the soonest known deadline. icon: the card's picture (the app's icon, the offer's artwork, or the monogram).
  const cardHtml = (g, icon) => {
    const totals = g.totals || [], st = GSTATUS[g.status] || GSTATUS.none, goals = g.goals || {reached: 0, of: 0};
    // Without an earning-app offer: what its challenges offer, and what the game showed collected.
    const pot = totals.length ? totals.filter(t => t.potential).map(t => money(t.potential, t.unit)) : Object.entries(g.offers || {}).filter(([, a]) => a).map(([u, a]) => money(a, u));
    const earned = totals.length ? totals.filter(t => t.earned).map(t => money(t.earned, t.unit)) : (g.rewards || []).filter(x => x.collected).map(x => money(x.collected, x.unit));
    const n = Math.min(24, goals.of), on = goals.of ? Math.round(goals.reached / goals.of * n) : 0;
    const plat = (g.platforms || []).length ? 'via ' + g.platforms.join(' · ') : (g.tasks || []).length ? g.tasks.length + ' challenge' + (g.tasks.length === 1 ? '' : 's') : 'no offers yet';
    return '<span class="gicon">' + icon + '</span><span class="gc"><span class="gtop"><b class="nm">' + esc(g.name) + '</b><span class="pill ' + st[1] + '">' + st[0] + '</span></span>'
      + '<span class="m">' + esc(plat) + '</span>'
      + (g.prep ? '<span class="gprep ' + g.prep.phase + '">' + (g.prep.phase === 'running' ? 'RESEARCHING · ' + Math.round(g.prep.percent) + '%<span class="bar"><i data-style="width:' + Math.max(2, Math.round(g.prep.percent)) + '%"></i></span>' : g.prep.phase === 'failed' ? 'READY TO PLAY · no online tips' : '✓ READY TO PLAY') + '</span>' : '')
      + '<span class="gnums"><span><em>POTENTIAL</em><b>' + (pot.length ? esc(pot.join(' + ')) : '—') + '</b></span><span><em>VERIFIED</em><b class="' + (earned.length ? 'green' : 'muted') + '">' + (earned.length ? esc(earned.join(' + ')) : '0') + '</b></span></span>'
      + (goals.of ? '<span class="lad" title="' + goals.reached + ' of ' + goals.of + ' goals reached">' + Array.from({length: n}, (_, i) => '<i class="' + (i < on ? 'on' : '') + '"></i>').join('') + '</span>' : '<span class="lad none"></span>')
      + '<span class="gfoot"><span>' + (goals.of ? goals.reached + ' of ' + goals.of + ' goals' : esc(earnLine(g) || '')) + '</span><span class="' + (g.deadline && g.deadline.at && g.deadline.at - Date.now() < 86_400_000 ? 'sand' : 'muted') + '">' + esc(g.deadline ? g.deadline.text : '') + '</span></span></span>';
  };
  // The library's filters and sorts, the same on both apps.
  const cashFirst = g => { const t = (g.totals || []).map(x => ({c: CASH[x.unit] ? 1 : 0, a: x.potential})).sort((a, b) => b.c - a.c || b.a - a.a)[0]; return t ? [t.c, t.a] : [0, 0]; };
  const library = (list, filter, sort) => list.filter(g => filter === 'all' || !filter || (filter === 'active' ? g.status === 'active' || g.status === 'none' : g.status === filter)).slice().sort((a, b) =>
    sort === 'deadline' ? ((a.deadline && a.deadline.at) || Infinity) - ((b.deadline && b.deadline.at) || Infinity) || b.updatedAt - a.updatedAt
    : sort === 'reward' ? cashFirst(b)[0] - cashFirst(a)[0] || cashFirst(b)[1] - cashFirst(a)[1]
    : sort === 'progress' ? ((b.goals || {}).of ? b.goals.reached / b.goals.of : -1) - ((a.goals || {}).of ? a.goals.reached / a.goals.of : -1)
    : b.updatedAt - a.updatedAt);
  // What one offer stands at, per unit: what it advertises, goals reached, pending, credited and paid out.
  const earnTiles = o => (o.earnings || []).map(u => '<div class="oearn"><span class="u">' + icon(unitIcon(u.unit)) + ' ' + esc(u.unit) + '</span>'
    + [['OFFER POTENTIAL', u.advertised ?? u.sum, ''], ['GOALS REACHED', u.reached, 'green'], ['PENDING REWARDS', u.pending, 'sand'], ['CREDITED REWARDS', u.credited, 'green'], ['PAID OUT', u.paid, 'green']].map(([k, v, c]) => '<span class="ot"><em>' + k + '</em><b class="' + (v ? c : 'muted') + '">' + money(v, u.unit) + '</b></span>').join('')
    + (u.mismatch !== null ? '<span class="onote sand">The app advertises ' + money(u.advertised, u.unit) + '; its milestones add up to ' + money(u.sum, u.unit) + (u.extra ? ' (+' + money(u.extra, u.unit) + ' bonus)' : '') + '. Check the offer.</span>' : '')
    + (u.purchase ? '<span class="onote sand">' + money(u.purchase, u.unit) + ' of it needs a purchase: yours to decide, never a sure reward.</span>' : '')
    + (u.unknown ? '<span class="onote muted">' + u.unknown + ' milestone' + (u.unknown === 1 ? ' shows' : 's show') + ' no reward.</span>' : '') + '</div>').join('');
  // The reward ladder: every milestone once, in the offer's order, with its reward and its stage (who said so).
  // A stage is set from its menu (data-mstate, data-offer, data-mid) on either device.
  const ladderHtml = o => '<ol class="ladder">' + (o.milestones || []).map((m, i) => {
    const stored = m.status || (m.done ? 'goal_reached' : 'not_started'), shown = m.state || stored;
    return '<li class="st-' + esc(shown) + (m.next ? ' next' : '') + '"><span class="no">' + String(i + 1).padStart(2, '0') + '</span>'
      + '<span class="t"><span>' + esc(m.text) + '</span>' + (m.paid ? '<em class="sand">needs a purchase: yours to decide</em>' : '') + (m.review ? '<em class="sand">' + esc(m.review) + '</em>' : '') + (m.note && shown !== stored ? '<em class="' + MOOD[shown] + '">' + esc(m.note) + '</em>' : '') + '</span>'
      + '<b class="amt">' + (m.was !== undefined && m.was !== null ? '<s>' + esc(money(m.was, m.unit)) + '</s> ' : '') + (m.amount === null ? '<span class="muted">?</span>' : esc(money(m.amount, m.unit))) + (m.extra ? '<small>+' + esc(money(m.extra.amount, m.extra.unit)) + ' bonus</small>' : '') + '</b>'
      + '<span class="ms"><select class="mst ' + MOOD[shown] + '" data-mstate data-offer="' + esc(o.id) + '" data-mid="' + esc(m.id || '') + '" data-i="' + i + '" title="Set its stage">' + MSTATE.map(([k, l]) => '<option value="' + k + '"' + (k === stored ? ' selected' : '') + '>' + (shown !== stored && k === stored ? l + ' · ' + (shown === 'expired' ? 'ended' : shown === 'in_progress' ? 'in progress' : 'level seen') : l) + '</option>').join('') + '</select><small class="by">' + esc(BY[m.stateBy || m.by] || 'you') + '</small></span></li>';
  }).join('') + '</ol>';
  // An earning app's offer on a game's page: where from, its status and deadline, what it stands at, and its ladder.
  // edit (the computer): Refresh offer, Edit offer and Remove.
  const offersHtml = (g, edit) => (g.earning || []).map((o, _i, all) => {
    const st = GSTATUS[o.status] || GSTATUS.active, dl = o.deadlineInfo || {}, many = all.length > 1;
    return '<div class="offer" data-oid="' + esc(o.id) + '"><div class="top"><b>via ' + esc(o.source.name) + '</b><span class="pill ' + st[1] + '">' + st[0] + '</span>' + ''
      + '<span class="muted small">' + esc((o.goals ? o.goals.reached + ' of ' + o.goals.of + ' goals' : '') + (dl.text ? ' · ' + dl.text : '') + (o.total ? ' · up to ' + money(o.total.amount, o.total.unit) : '')) + '</span><span class="grow"></span>'
      + (edit && many && true ? '<button class="small" data-offer-refresh="' + esc(o.id) + '" title="Read the offer page on the phone again and list what changed">' + icon('update') + 'Refresh offer</button>' : '') + (edit && many ? '<button class="small" data-offer-edit="' + esc(o.id) + '">' + icon('edit') + 'Edit offer</button>' : '') + (edit ? '<button class="small icon danger" data-offer-remove="' + esc(o.id) + '" title="Remove this offer">' + icon('trash') + '</button>' : '') + '</div>'
      + (dl.kind === 'duration' && !dl.at ? '<p class="small sand">Ends ' + esc(o.deadline.durationDays) + ' days after you start it. ' + (edit ? '<button class="small ghost" data-offer-started="' + esc(o.id) + '">I started it today</button>' : 'Say when you started it on the computer.') + '</p>' : '')
      + '<div class="oearns">' + earnTiles(o) + '</div>' + ladderHtml(o) + '</div>';
  }).join('');
  // ---------------------------------------------------------------- a game's picture, in one shape everywhere (both apps)
  // Transparent margins are trimmed (a launcher icon's layer is often a small shape in a large square). A picture that
  // fills its square is used whole; a shape on a transparent background sits on a dark tile at the same share of it.
  // The tile's rounded square is the CSS's (.gicon), so every game looks alike in size and shape.
  const normed = new Map();
  function normIcon(url) {
    if (!url) return Promise.resolve(url);
    if (normed.has(url)) return normed.get(url);
    const p = new Promise(done => {
      const img = new Image();
      img.onload = () => {
        try {
          const S = 256, N = 192, w = img.naturalWidth || S, h = img.naturalHeight || S, k = Math.min(S / w, S / h);
          const c = document.createElement('canvas'); c.width = S; c.height = S;
          const x = c.getContext('2d', {willReadFrequently: true}); x.drawImage(img, (S - w * k) / 2, (S - h * k) / 2, w * k, h * k);
          const d = x.getImageData(0, 0, S, S).data; let l = S, t = S, r = -1, b = -1, clear = 0;
          for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) { if (d[(yy * S + xx) * 4 + 3] > 24) { if (xx < l) l = xx; if (xx > r) r = xx; if (yy < t) t = yy; if (yy > b) b = yy; } else clear++; }
          if (r < 0) { done(url); return; }
          const o = document.createElement('canvas'); o.width = N; o.height = N; const ox = o.getContext('2d');
          const bw = r - l + 1, bh = b - t + 1;
          if (clear / (S * S) < 0.04) ox.drawImage(c, l, t, bw, bh, 0, 0, N, N);
          else { ox.fillStyle = '#141821'; ox.fillRect(0, 0, N, N); const f = N * 0.78 / Math.max(bw, bh); ox.drawImage(c, l, t, bw, bh, (N - bw * f) / 2, (N - bh * f) / 2, bw * f, bh * f); }
          done(o.toDataURL('image/png'));
        } catch { done(url); }
      };
      img.onerror = () => done(url);
      img.src = url;
    });
    normed.set(url, p);
    return p;
  }

  // ---------------------------------------------------------------- Falcor's picture and his greeting (both apps)
  // The phone app has the dragon built in (setDragon); the computer serves dragon.png.
  let dragonUrl = 'dragon.png';
  const setDragon = u => { dragonUrl = u; }, dragonSrc = () => dragonUrl;
  const avatarHtml = (cls = '') => '<span class="favatar' + (cls ? ' ' + cls : '') + '"><img src="' + esc(dragonSrc()) + '" alt="Falcor"></span>';
  // A new chat opens with this, before anything is sent; it is not kept in the chat.
  const INTRO = {hello: 'Well met, friend. I am Falcor.', text: 'I keep watch over this Hub and conduct all that moves in it: your phone and its mirror, the Daily Queue, your games and their rewards, and every task you have approved. Ask me anything about the tool, how a thing works, what runs today or what waits on you, or tell me what you would have done. I shall see to it, or tell you plainly why I will not.', stop: 'Say "stop" at any hour, and all falls still.'};
  const introHtml = () => '<div class="fhero" data-intro>' + avatarHtml('big') + '<b class="fname">FALCOR</b><span class="frole">Keeper of the Hub · your conductor</span></div>'
    + '<div class="msg falcor intro" data-intro>' + avatarHtml() + '<div class="body"><div class="bubble"><b class="fhello">' + esc(INTRO.hello) + '</b><p>' + esc(INTRO.text) + '</p><p class="fstop">' + esc(INTRO.stop) + '</p></div></div></div>';
  // ---------------------------------------------------------------- the bell (both apps): what Falcor told the owner on
  // its own, newest first. links: the buttons a notice offers (data-nlink, data-nref, data-nid); fresh: ids unread when
  // the list was opened.
  const NICON = {update: 'update', task: 'tasks', guide: 'book', training: 'rec', offer: 'reward'};
  const ago = at => { const m = Math.round((Date.now() - at) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 24 * 60 ? Math.round(m / 60) + ' h ago' : new Date(at).toLocaleDateString([], {month: 'short', day: 'numeric'}); };
  const noticesHtml = (list, fresh, linkOk) => (list || []).length ? (list || []).map(n => '<li class="nt k-' + esc(n.kind) + (fresh.has(n.id) ? ' fresh' : '') + '" data-nid="' + esc(n.id) + '"><span class="ni">' + icon(NICON[n.kind] || 'flag') + '</span><span class="nb"><span class="nx">' + esc(n.text) + '</span><span class="nm"><time>' + esc(ago(n.at)) + '</time>'
    + (n.links || []).filter(l => !linkOk || linkOk(l)).map(l => '<button class="small ghost" data-nlink="' + esc(l.tab) + '" data-nref="' + esc(l.ref) + '" data-nid="' + esc(n.id) + '">' + esc(l.label) + '</button>').join('') + '</span></span><button class="ghost icon small nclose" data-nclear="' + esc(n.id) + '" title="Dismiss">' + icon('close') + '</button></li>').join('')
    : '<li class="nt none"><img src="' + esc(dragonSrc()) + '" alt=""><span class="nb"><span class="nx">All is quiet. I shall ring when something needs you.</span></span></li>';
  // Recent activity on a game: offers captured, refreshed and set, and runs.
  const activityHtml = g => (g.activity || []).length ? '<ul class="rhist act">' + g.activity.map(a => '<li><time>' + esc(day(a.at)) + '</time><span class="small">' + esc(a.text) + '</span></li>').join('') + '</ul>' : '<p class="muted small">Nothing yet.</p>';
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

  // What the web said about a game (looked up during Auto-capture): a summary, tips, things to avoid and the sources.
  // A captured game's online research: a bar with its steps while it runs, then Ready to play.
  const PREP = [['instructions', 'How to play and its controls'], ['tips', 'Tips, tricks and hints'], ['guide', 'A guide and its screenshots'], ['notes', 'Falcor\'s notes for this game']];
  // A newly captured game's setup checklist (training.ts on the computer) and Teach Falcor's lessons, the same on both
  // apps; only real states are shown. Empty when there is nothing to show.
  const trainHtml = g => {
    const t = g.training, lessons = g.lessons || [];
    if (!t && !lessons.length && !(g.coach && g.coach.state !== 'idle')) return '';
    const row = (ok, label, extra) => '<li class="' + (ok === true ? 'green' : ok === 'part' ? 'sand' : 'muted') + '"><span>' + (ok === true ? '[✓]' : ok === 'part' ? '[~]' : '[ ]') + '</span> ' + label + (extra ? ' <em>' + extra + '</em>' : '') + '</li>';
    const L = [];
    if (t) {
      const done = t.status === 'done', wait = !g.installed;
      L.push('<div class="top"><p class="eyebrow">// SET UP ' + esc(g.name.toUpperCase()) + '</p>' + (t.recording ? '<span class="pill red rec">● RECORDING</span>' : done ? '<span class="pill green">TRAINED</span>' : t.status === 'analyzing' ? '<span class="pill sand">ANALYZING</span>' : '<span class="pill muted">' + (wait ? 'WAITING FOR GAME ON PHONE' : 'PLAY TO TEACH') + '</span>') + '</div>');
      L.push('<ul class="checklist">' + row(!!(g.earning && g.earning.length), 'Game captured and offer reviewed')
        + row(g.research ? true : g.prep && g.prep.phase === 'running' ? 'part' : false, g.research ? 'Game guide and research ready' : g.prep && g.prep.phase === 'running' ? 'Researching the game online…' : 'Research not available (offline): Falcor learns from you instead')
        + row(t.entry.state === 'learned' ? true : t.entry.state === 'partial' ? 'part' : false, t.entry.state === 'learned' ? 'Game opening learned' + (t.entry.guest ? ' (as a guest, as you did)' : '') : t.entry.state === 'partial' ? 'Game opening partly seen: Falcor checks the rest on its first run' : 'Game opening and guest entry: captured automatically as you open the game')
        + row(t.creditedMs >= t.needMs ? true : t.creditedMs > 0 ? 'part' : false, 'Play five minutes to teach Falcor', esc(t.progress) + ' · gameplay only')
        + row(done ? true : t.status === 'analyzing' ? 'part' : false, done ? 'Falcor learned how to enter and play' : t.status === 'analyzing' ? 'Analyzing your play…' : 'Falcor learns how to enter and play', t.ai && done ? esc(t.ai.note) : '')
        + row(done && g.smart && g.smart.runnable ? true : false, 'Recommended Playbook ready', done && g.smart && g.smart.runnable ? 'review and press Start Autopilot' : '') + '</ul>');
      if (!done) L.push('<div class="bar"><i data-style="width:' + t.percent + '%"></i></div><p class="small muted">' + (wait ? 'Waiting for the game on the phone: install it, then open it and play.' : 'Open the game and play normally for five minutes. Falcor automatically learns how you enter and play — no extra steps. Loading, sign-in choices and menus are recorded but do not count.') + '</p>');
      else L.push('<p class="small muted">Trained ' + esc(new Date(t.completedAt).toLocaleString()) + ' · ' + (t.footage.segments ? esc(t.footage.seconds) + ' s of video in ' + t.footage.segments + ' file' + (t.footage.segments === 1 ? '' : 's') : 'no video (screens and ' + t.footage.frames + ' pictures)') + (t.local ? ' · ' + esc(t.local.summary) : '') + '</p>');
    }
    const co = g.coach || {state: 'idle'};
    if (co.state === 'recording') L.push('<p class="small"><span class="pill red rec">● TEACHING</span> Recording your play · ' + esc(Math.round(co.elapsedMs / 1000)) + ' s. Leave the game or press Finish & Learn when you are done.</p>');
    else if (co.state === 'waiting') L.push('<p class="small sand">Teach Falcor: open ' + esc(g.name) + ' on the phone; recording starts when it is in front.</p>');
    if (lessons.length || g.skill) L.push('<p class="eyebrow">// TEACH FALCOR LESSONS' + (g.skill ? ' · SKILL VERSION ' + esc(g.skill.version) + ' (' + esc(g.skill.state) + ')' : '') + '</p><ul class="lessons">' + lessons.map(x => '<li><span>' + esc(new Date(x.at).toLocaleString()) + ' · ' + esc(Math.round(x.ms / 60000) || '<1') + ' min · ' + esc({learned: 'Learned', no_change: 'No actionable change detected', analyzing: 'Analyzing', recording: 'Recording', error: 'Error', waiting: 'Waiting'}[x.status] || x.status) + '</span><span class="muted">' + esc(x.note) + (x.input === 'phone' ? ' Played on the phone itself: presses were inferred from the screens, not recorded as touches.' : '') + '</span><button class="small" data-dellesson="' + esc(x.id) + '" title="Delete this lesson and its footage (what it taught stays)">Delete</button></li>').join('') + '</ul>'
      + (g.revisions || []).filter(x => x.state === 'rolled_back').slice(0, 2).map(x => '<p class="small sand">Skill version ' + esc(x.v) + ' rolled back: ' + esc(x.reason) + '</p>').join(''));
    return L.join('');
  };
  const prepHtml = p => {
    if (!p) return '';
    if (p.phase === 'done') return '<div class="prep done"><b class="green">' + icon('check') + 'READY TO PLAY</b><span class="muted small">' + esc(p.line) + '</span></div>';
    const at = PREP.findIndex(x => x[0] === (p.stage === 'more' ? 'tips' : p.stage));
    return '<div class="prep ' + (p.phase === 'failed' ? 'failed' : 'running') + '"><b>' + (p.phase === 'failed' ? 'RESEARCH FAILED · READY TO PLAY WITHOUT IT' : 'RESEARCHING ONLINE · ' + Math.round(p.percent) + '%') + '</b>'
      + '<span class="bar"><i data-style="width:' + Math.max(2, Math.min(100, Math.round(p.percent))) + '%"></i></span>'
      + '<ul class="steps">' + PREP.map((x, i) => '<li class="' + (p.phase === 'failed' ? '' : i < at ? 'ok' : i === at ? 'now' : '') + '">' + (i < at && p.phase !== 'failed' ? '✓ ' : i === at && p.phase !== 'failed' ? '… ' : '· ') + esc(x[1]) + '</li>').join('') + '</ul>'
      + '<span class="muted small">' + esc(p.line) + '</span><span class="muted small">A light search: a few web lookups and one AI request (about 1.5¢).</span></div>';
  };
  const researchHtml = r => !r ? '' : '<div class="research">' + (r.summary ? '<p>' + esc(r.summary) + '</p>' : '')
    + (r.instructions && r.instructions.length ? '<p class="eyebrow">// HOW TO PLAY</p><ul class="tips">' + r.instructions.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '')
    + (r.levels ? '<p class="small"><b>How long:</b> ' + esc(r.levels) + '</p>' : '')
    + (r.tips && r.tips.length ? '<p class="eyebrow">// TIPS</p><ul class="tips">' + r.tips.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '')
    + (r.watchOuts && r.watchOuts.length ? '<p class="eyebrow">// WATCH OUT</p><ul class="tips warn">' + r.watchOuts.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '')
    + (r.screenshots && r.screenshots.length ? '<p class="muted small">Screenshots found: ' + r.screenshots.map((u, i) => '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + (i + 1) + '</a>').join(' · ') + '</p>' : '')
    + '<p class="muted small">Looked up ' + new Date(r.at).toLocaleDateString() + (r.sources && r.sources.length ? ' · ' + r.sources.map(u => { let h = u; try { h = new URL(u).hostname.replace(/^www\./, ''); } catch { /* keep */ } return esc(h); }).join(' · ') : '') + '</p></div>';
  const editFeedback = (() => {
    const modes = ['Off', 'Haptic', 'Sound', 'Both']; let context, last = 0;
    const mode = () => { try { const m = localStorage.getItem('sb.feedback'); return modes.includes(m) ? m : 'Off'; } catch { return 'Off'; } };
    const cycle = () => { try { localStorage.setItem('sb.feedback', modes[(modes.indexOf(mode()) + 1) % modes.length]); } catch {} };
    const pulse = () => { const m = mode(), now = Date.now(); if (m === 'Off' || now - last < 100) return; last = now;
      if (m === 'Haptic' || m === 'Both') { try { navigator.vibrate?.(10); } catch {} }
      if (m === 'Sound' || m === 'Both') { try { context ||= new AudioContext(); if (context.state === 'suspended') void context.resume(); const o = context.createOscillator(), g = context.createGain(); o.frequency.value = 700; g.gain.setValueAtTime(.025, context.currentTime); g.gain.exponentialRampToValueAtTime(.001, context.currentTime + .025); o.connect(g); g.connect(context.destination); o.start(); o.stop(context.currentTime + .03); } catch {} }
    }; return {mode, cycle, pulse};
  })();
  window.Pixel = {editFeedback, MAPS, sprite, icon, esc, el, fix, text, attr, cls, keyed, htmlOnce, roll, burst, tapMark, trail, spark, intro, reduced, monogram, num, unitIcon, earnLine, offersHtml, prepHtml, rewardsHtml, historyHtml, tiersHtml, progressHtml, motion, money, cardHtml, library, earnTiles, ladderHtml, activityHtml, MSTATE, noticesHtml, ago, setDragon, dragonSrc, avatarHtml, introHtml, INTRO, normIcon, researchHtml, trainHtml};
})();

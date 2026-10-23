(() => {
  const grid = $('sbgrid'), head = $('sbhead'), key = 'falcor.sandbox.windows.v1';
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const definitions = [
    {id: 'sbbuildtools', name: 'Chain editor', about: 'Build, edit, save and publish your chain', core: true, min: [340, 130]},
    {id: 'sbplayback', name: 'Chain player', about: 'Play on the phone, pause in place or stop and reset', core: true, min: [340, 80]},
    {id: 'sblib', name: 'Block catalog', about: 'Search and add actions to the chain', min: [240, 220]},
    {id: 'sbinsp', name: 'Block details', about: 'Selected block settings, chain settings and Teach review', min: [290, 250]},
    {id: 'sbviewtools', name: 'Workspace', about: 'Canvas views, recorded lessons, preferences and help', min: [300, 180]},
    {id: 'sbinsights', name: 'Chain insights', about: 'Estimated one-run AI cost, runtime, blocks and safety limits', defaultOpen: true, min: [280, 180]},
  ];
  let saved = {rects: {}, visible: {}, minimized: {}, locks: {}, locked: false, compactPlayer: true, grouping: 0}, moving = null, top = 8, maxed = null, compactOnLoad = true;
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    if (value && typeof value === 'object') {
      compactOnLoad = value.compactPlayer !== true; saved.grouping = value.grouping || 0;
      saved.locked = value.locked === true;
      for (const d of definitions) {
        if (typeof value.visible?.[d.id] === 'boolean') saved.visible[d.id] = value.visible[d.id];
        if (value.minimized?.[d.id] === true) saved.minimized[d.id] = true;
        if (value.locks?.[d.id] === true) saved.locks[d.id] = true;
        const r = value.rects?.[d.id];
        if (r && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(r[k])) && r.w > 0 && r.h > 0) saved.rects[d.id] = r;
      }
    }
  } catch { toast('The Sandbox window layout could not be read. Using the default layout.', 'warn'); }
  const keep = () => { try { localStorage.setItem(key, JSON.stringify(saved)); } catch { toast('The Sandbox window layout could not be saved.', 'warn'); } };
  if (saved.grouping !== 2) {
    delete saved.rects.sbbuildtools; delete saved.rects.sbviewtools;
    saved.grouping = 2;
  }
  keep();
  const create = (id, node) => {
    const el = document.createElement('section'); el.id = id; grid.appendChild(el); el.appendChild(node); return el;
  };
  const groups = [...head.querySelectorAll('.sbtoolgroup')];
  const editor = create('sbbuildtools', groups[1]); editor.appendChild(groups[2]);
  const lesson = document.createElement('div');
  lesson.innerHTML = '<p class="small muted">Record a demonstration for Falcor to turn into a reusable task.</p>';
  lesson.appendChild($('sbteach')); lesson.className = 'sbworkspace-lesson';
  const insights = document.createElement('div'); insights.id = 'sbinsightsbody';
  insights.innerHTML = '<p class="muted small">Open a chain to see its one-run estimate.</p>';
  create('sbinsights', insights);
  const workspaceTools = create('sbviewtools', $('sbtl').querySelector(':scope > .top'));
  workspaceTools.append(groups[3], lesson);
  grid.appendChild($('sbplayback'));
  const focus = $('sbfocus'); head.appendChild(focus); head.querySelector('.sbacts').remove();
  const minimizeAll = document.createElement('button'); minimizeAll.id = 'sbminimizeall'; minimizeAll.className = 'small';
  minimizeAll.innerHTML = icon('minus') + 'Minimize windows';
  minimizeAll.title = 'Minimize unlocked windows to the bottom bar; locked windows and blocks stay visible';
  head.appendChild(minimizeAll);
  const tray = document.createElement('div'); tray.id = 'sbminimized'; tray.className = 'sbminimized'; tray.hidden = true;
  tray.setAttribute('role', 'group'); tray.setAttribute('aria-label', 'Minimized Sandbox windows'); grid.appendChild(tray);
  const menu = document.createElement('details'); menu.className = 'sbwindowmenu';
  menu.innerHTML = '<summary>' + icon('apps') + 'Windows</summary><div class="sbwindowlist"></div>';
  head.appendChild(menu);
  const list = menu.querySelector('div');
  list.innerHTML = definitions.map(d => '<label><input type="checkbox" data-window="' + d.id + '"><span><b>' + esc(d.name) + '</b><small>' + esc(d.about) + '</small></span></label>').join('')
    + '<label><input type="checkbox" id="sbwindowslock"><span>Lock tool windows</span></label><button class="small" id="sbwindowsreset">Reset organized layout</button>';
  const windows = new Map();
  function front(el) {
    for (const win of windows.values()) win.classList.toggle('front', win === el);
    $('sbcenter').classList.toggle('front', $('sbcenter') === el);
  }
  $('sbcenter').addEventListener('pointerdown', () => { if ($('sbcenter').parentElement === grid) { $('sbcenter').style.zIndex = String(++top); front($('sbcenter')); } });
  grid.addEventListener('pointerdown', e => { if (e.target === grid || e.target === $('sbsteps')) front(null); });
  const size = () => ({w: Math.max(1, grid.clientWidth - parseFloat(getComputedStyle(grid).getPropertyValue('--phone-reserve') || '0')), h: Math.max(1, grid.clientHeight)});
  const headSpace = () => head.offsetParent ? Math.max(0, Math.min(grid.clientHeight / 2, head.offsetTop + head.offsetHeight)) : 0;
  function defaults(id) {
    const {w, h: full} = size(), gap = 10, t = headSpace(), h = full - t;
    const narrow = w < 760;
    const map = {
      sbbuildtools: {x: gap, y: t + gap, w: w - 2 * gap, h: narrow ? 190 : 138},
      sbplayback: {x: gap, y: t + (narrow ? 210 : 158), w: w - 2 * gap, h: narrow ? 130 : 98},
      sblib: {x: gap, y: t + (narrow ? 350 : 266), w: 260, h: Math.max(220, Math.min(420, h - (narrow ? 360 : 276)))},
      sbinsp: {x: Math.max(gap, w - 340), y: t + Math.min(290, h / 3), w: 330, h: Math.min(440, h * .65)},
      sbviewtools: {x: gap, y: Math.max(t + gap, full - 230), w: 440, h: 220},
      sbinsights: {x: Math.max(gap, w - (narrow ? 310 : 350)), y: t + (narrow ? 350 : 266), w: narrow ? 300 : 340, h: Math.max(180, Math.min(460, h - (narrow ? 360 : 276)))},
    };
    return map[id];
  }
  function bounded(r, d) {
    const {w, h} = size();
    const width = clamp(r.w, Math.min(d.min[0], w), w), height = clamp(r.h, Math.min(d.min[1], h), h);
    return {x: clamp(r.x, 0, w - width), y: clamp(r.y, 0, h - height), w: width, h: height};
  }
  function put(el, r) { Object.assign(el.style, {left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px'}); }
  function remember(d, el) {
    const {w, h} = size(); saved.rects[d.id] = {x: el.offsetLeft / w, y: el.offsetTop / h, w: el.offsetWidth / w, h: el.offsetHeight / h}; keep();
  }
  function layout() {
    if (!grid.clientWidth || !grid.clientHeight) return;
    const {w, h} = size();
    for (const d of definitions) {
      const el = windows.get(d.id);
      if (el.parentElement !== grid) continue;
      const r = saved.rects[d.id];
      if (d.id === 'sbplayback' && compactOnLoad) {
        if (r) r.h = defaults(d.id).h / h;
        compactOnLoad = false; keep();
      }
      put(el, maxed === d.id ? {x: 0, y: headSpace(), w, h: h - headSpace()} : bounded(r ? {x: r.x * w, y: r.y * h, w: r.w * w, h: r.h * h} : defaults(d.id), d));
      el.classList.toggle('maxed', maxed === d.id);
      const button = el.querySelector('[data-toolmax]'); button.title = (maxed === d.id ? 'Restore ' : 'Maximize ') + d.name;
      htmlOnce(button, icon(maxed === d.id ? 'restore' : 'max'));
    }
    const space = headSpace() + 'px';
    if (grid.parentElement.style.getPropertyValue('--head-space') !== space) grid.parentElement.style.setProperty('--head-space', space);
    const clearance = Math.max(0, Math.min(h - 130, w < 760 ? 350 : 266)) + 'px';
    if (grid.style.getPropertyValue('--tool-clearance') !== clearance) grid.style.setProperty('--tool-clearance', clearance);
    grid.classList.toggle('tools-locked', saved.locked);
    $('sbwindowslock').checked = saved.locked;
    for (const d of definitions) {
      const el = windows.get(d.id), locked = saved.locked || saved.locks[d.id] === true;
      el.classList.toggle('tool-locked', locked);
      const button = el.querySelector('[data-toollock]');
      button.setAttribute('aria-pressed', String(locked));
      button.title = (locked ? 'Unlock ' : 'Lock ') + d.name;
      button.disabled = saved.locked;
      htmlOnce(button, icon(locked ? 'lock' : 'unlock'));
    }
  }
  function drawTray() {
    const items = definitions.filter(d => saved.minimized[d.id]);
    tray.innerHTML = items.map(d => '<button class="small" data-restore="' + d.id + '" title="Restore ' + esc(d.name) + '">' + icon('restore') + esc(d.name) + '</button>').join('')
      + ($('sbcenter').hidden ? '<button class="small" data-restore="sbcenter" title="Restore Phone">' + icon('phone') + 'Phone</button>' : '');
    tray.hidden = !tray.children.length;
    grid.style.setProperty('--minimized-height', tray.hidden ? '0px' : '38px');
  }
  function minimize(id) {
    const el = windows.get(id); if (!el || el.hidden) return;
    window.popBack('sb-' + id);
    el.hidden = true; el.dataset.minimized = ''; saved.minimized[id] = true; saved.visible[id] = true;
    keep(); drawTray(); layout();
    tray.querySelector('[data-restore="' + id + '"]')?.focus({preventScroll: true});
  }
  function show(id, force) {
    id = ({sbchaintools: 'sbbuildtools', sbhelptools: 'sbviewtools', sbteachtools: 'sbviewtools'})[id] || id;
    const el = windows.get(id); if (!el) return;
    if (window.popIsOut?.('sb-' + id)) {
      if (force !== false) { window.popOut('sb-' + id); return; }
      window.popBack('sb-' + id);
    }
    const on = force === undefined ? el.hidden : force;
    delete saved.minimized[id];
    delete el.dataset.minimized;
    el.hidden = !on; saved.visible[id] = on;
    list.querySelector('[data-window="' + id + '"]').checked = on;
    if (id === 'sblib') $('sbpanels').setAttribute('aria-expanded', String(on));
    if (id === 'sbinsp') $('sbsettings').setAttribute('aria-expanded', String(on));
    if (on) el.style.zIndex = String(++top);
    keep(); drawTray(); layout();
  }
  function begin(d, e, kind, target) {
    const el = windows.get(d.id);
    if (saved.locked || saved.locks[d.id] || maxed === d.id || e.button !== 0 || el.parentElement !== grid) return;
    el.style.zIndex = String(++top);
    front(el);
    e.preventDefault(); e.stopPropagation(); target.setPointerCapture(e.pointerId);
    el.classList.toggle('is-grabbed', kind === 'move');
    moving = {d, el, id: e.pointerId, kind, x: e.clientX, y: e.clientY, r: {x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight}};
  }
  for (const d of definitions) {
    const el = $(d.id); windows.set(d.id, el); el.classList.add('sbtoolwindow', 'win');
    const children = [...el.childNodes], body = document.createElement('div'); body.className = 'winbody';
    body.append(...children);
    const bar = document.createElement('div'); bar.className = 'winbar'; bar.tabIndex = 0;
    bar.setAttribute('aria-label', d.name + ' window: drag or use arrows to move; Shift and arrows resize');
    bar.innerHTML = '<span class="wingrip"></span><b class="wintitle">' + esc(d.name) + '</b><span class="grow"></span><span class="winbtns"><button title="Lock ' + esc(d.name) + '" data-toollock>' + icon('unlock') + '</button><button title="Pop out ' + esc(d.name) + '" data-toolpop>' + icon('popout') + '</button><button title="Maximize ' + esc(d.name) + '" data-toolmax>' + icon('max') + '</button><button title="Minimize ' + esc(d.name) + '" data-toolmin>' + icon('minus') + '</button><button title="Hide ' + esc(d.name) + '" data-toolhide>' + icon('close') + '</button></span>';
    el.append(bar, body); el.hidden = !!saved.minimized[d.id] || !(saved.visible[d.id] ?? d.core ?? d.defaultOpen);
    if (saved.minimized[d.id]) el.dataset.minimized = '';
    list.querySelector('[data-window="' + d.id + '"]').checked = !el.hidden || !!saved.minimized[d.id];
    bar.querySelector('[data-toolmin]').onclick = () => minimize(d.id);
    bar.querySelector('[data-toollock]').onclick = () => { saved.locks[d.id] = !saved.locks[d.id]; keep(); layout(); };
    bar.querySelector('[data-toolhide]').onclick = () => show(d.id, false);
    const toggleMax = () => { if (el.parentElement !== grid) return; maxed = maxed === d.id ? null : d.id; el.style.zIndex = String(++top); layout(); };
    bar.querySelector('[data-toolmax]').onclick = toggleMax;
    bar.addEventListener('dblclick', e => { if (!e.target.closest('button')) toggleMax(); });
    bar.querySelector('[data-toolpop]').onclick = () => pop(d.id);
    bar.addEventListener('pointerdown', e => { if (!e.target.closest('button')) begin(d, e, 'move', bar); });
    el.addEventListener('pointerdown', () => { if (el.parentElement === grid) { el.style.zIndex = String(++top); front(el); } });
    bar.addEventListener('keydown', e => {
      if (e.target !== bar || el.parentElement !== grid) return;
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); toggleMax(); return; }
      if (saved.locked || saved.locks[d.id] || maxed === d.id || !e.key.startsWith('Arrow')) return;
      e.preventDefault(); e.stopPropagation();
      const r = {x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight}, dx = e.key === 'ArrowRight' ? 8 : e.key === 'ArrowLeft' ? -8 : 0, dy = e.key === 'ArrowDown' ? 8 : e.key === 'ArrowUp' ? -8 : 0;
      if (e.shiftKey) { r.w += dx; r.h += dy; } else { r.x += dx; r.y += dy; }
      put(el, bounded(r, d)); remember(d, el);
    });
    for (const kind of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
      const handle = document.createElement('i'); handle.className = 'rz ' + kind; handle.setAttribute('aria-hidden', 'true'); el.appendChild(handle);
      handle.addEventListener('pointerdown', e => begin(d, e, kind, handle));
    }
    el.addEventListener('pointermove', e => {
      if (!moving || moving.id !== e.pointerId) return;
      const m = moving, r = {...m.r}, dx = e.clientX - m.x, dy = e.clientY - m.y;
      if (m.kind === 'move') { r.x += dx; r.y += dy; }
      else {
        if (m.kind.includes('e')) r.w += dx; if (m.kind.includes('s')) r.h += dy;
        if (m.kind.includes('w')) { r.w = clamp(r.w - dx, d.min[0], m.r.x + m.r.w); r.x = m.r.x + m.r.w - r.w; }
        if (m.kind.includes('n')) { r.h = clamp(r.h - dy, d.min[1], m.r.y + m.r.h); r.y = m.r.y + m.r.h - r.h; }
      }
      put(el, bounded(r, d));
    });
    const end = e => { if (moving?.id !== e.pointerId) return; if (e.type === 'pointercancel') put(el, moving.r); el.classList.remove('is-grabbed'); moving = null; remember(d, el); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  }
  list.onchange = e => { const id = e.target.dataset.window; if (id) show(id, e.target.checked); else { saved.locked = $('sbwindowslock').checked; keep(); layout(); } };
  $('sbwindowsreset').onclick = () => {
    saved.rects = {}; saved.locks = {}; saved.locked = false; maxed = null;
    for (const d of definitions) { window.popBack('sb-' + d.id); show(d.id, !!(d.core || d.defaultOpen)); }
    keep(); layout(); menu.open = false;
  };
  const phoneMin = document.createElement('button'); phoneMin.id = 'sbphonemin'; phoneMin.title = 'Minimize Phone'; phoneMin.innerHTML = icon('minus');
  $('sbphonebar').querySelector('.winbtns').appendChild(phoneMin);
  phoneMin.onclick = () => {
    window.popBack('sb-sbcenter'); $('sbcenter').hidden = true;
    window.sbWorkspace.layout(); drawTray();
    tray.querySelector('[data-restore="sbcenter"]').focus({preventScroll: true});
  };
  tray.onclick = e => {
    const button = e.target.closest('[data-restore]'); if (!button) return;
    if (button.dataset.restore === 'sbcenter') { $('sbcenter').hidden = false; window.sbWorkspace.layout(); drawTray(); $('sbphonemin').focus({preventScroll: true}); }
    else { show(button.dataset.restore, true); windows.get(button.dataset.restore).querySelector('.winbar').focus({preventScroll: true}); }
  };
  minimizeAll.onclick = () => {
    for (const d of definitions) if (!saved.locked && !saved.locks[d.id]) minimize(d.id);
    if (!$('sbcenter').hidden && !$('sbcenter').classList.contains('phone-locked')) phoneMin.onclick();
    minimizeAll.focus({preventScroll: true});
  };
  grid.classList.add('floating-tools');
  new ResizeObserver(() => { if (!moving) layout(); }).observe(grid);
  new MutationObserver(() => { if (!moving) layout(); }).observe(grid, {attributes: true, attributeFilter: ['style']});
  function pop(id, at) {
    const el = windows.get(id), d = definitions.find(d => d.id === id);
    if (!el || !d) return;
    show(id, true);
    window.popOut('sb-' + id, el, d.name, {free: true, at, onOut: () => { el.style.cssText = ''; el.classList.remove('maxed'); }, onBack: layout});
  }
  window.sbWindows = {show, layout, pop, minimize, isMinimized: id => !!saved.minimized[id]};
  $('sbpanels').setAttribute('aria-expanded', String(!windows.get('sblib').hidden));
  $('sbsettings').setAttribute('aria-expanded', String(!windows.get('sbinsp').hidden));
  drawTray(); layout();
  front($('sbcenter').hidden ? [...windows.values()].find(el => !el.hidden) || null : $('sbcenter'));
})();

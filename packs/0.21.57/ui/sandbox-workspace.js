(() => {
  const grid = $('sbgrid'), phone = $('sbcenter'), bar = $('sbphonebar'), viewport = $('sbsteps'), content = $('sbcontent');
  const KEY = 'falcor.sandbox.workspace.v1', clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  let state = {locked: true, docked: true, rect: null, zoom: 1}, maxed = false, drag = null;
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s) {
      state.locked = s.locked !== false; state.docked = s.docked !== false;
      if (Number.isFinite(s.zoom)) state.zoom = clamp(s.zoom, .4, 2);
      if (s.rect && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(s.rect[k])) && s.rect.w > 0 && s.rect.h > 0) state.rect = s.rect;
    }
  } catch { /* No saved layout. */ }
  const keep = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch { toast('The workspace layout could not be saved on this computer.', 'warn'); }
  };
  function openDrawer(which, force) {
    const out = window.popIsOut?.('sb-' + (which === 'blocks' ? 'sblib' : 'sbinsp'));
    if (out) { window.popOut('sb-' + (which === 'blocks' ? 'sblib' : 'sbinsp')); return; }
    const on = force === undefined ? !grid.classList.contains(which + '-open') : force;
    grid.classList.toggle('blocks-open', which === 'blocks' && on);
    grid.classList.toggle('settings-open', which === 'settings' && on);
    $('sbpanels').setAttribute('aria-expanded', String(which === 'blocks' && on));
    $('sbsettings').setAttribute('aria-expanded', String(which === 'settings' && on));
  }
  $('sbpanels').onclick = () => openDrawer('blocks');
  $('sblibfold').onclick = () => { openDrawer('blocks', false); $('sbpanels').focus(); };
  $('sbsettings').onclick = () => openDrawer('settings');
  $('sbinspclose').onclick = () => { openDrawer('settings', false); $('sbsettings').focus(); };
  // Teach review must not disappear inside a closed settings drawer.
  new MutationObserver(() => {
    if (!$('sbtaught').hidden || !$('teachform').hidden) openDrawer('settings', true);
  }).observe($('sbinsp'), {attributes: true, attributeFilter: ['hidden'], subtree: true});

  function put(r) {
    Object.assign(phone.style, {left: Math.round(r.x) + 'px', top: Math.round(r.y) + 'px', width: Math.round(r.w) + 'px', height: Math.round(r.h) + 'px', right: 'auto'});
  }
  function rect() { return {x: phone.offsetLeft, y: phone.offsetTop, w: phone.offsetWidth, h: phone.offsetHeight}; }
  function bounded(r) {
    const W = grid.clientWidth, H = grid.clientHeight, w = clamp(r.w, Math.min(280, W), W), h = clamp(r.h, Math.min(320, H), H);
    return {x: clamp(r.x, 0, W - w), y: clamp(r.y, 0, H - h), w, h};
  }
  function saveRect() {
    const r = rect();
    state.rect = {x: r.x / grid.clientWidth, y: r.y / grid.clientHeight, w: r.w / grid.clientWidth, h: r.h / grid.clientHeight};
    keep();
  }
  function layout() {
    if (!grid.clientWidth || !grid.clientHeight) return;
    const home = phone.parentElement === grid;
    grid.style.setProperty('--phone-reserve', home && state.docked && !maxed ? Math.min(360, grid.clientWidth * .36) + 12 + 'px' : '0px');
    if (!home) { phone.removeAttribute('style'); return; }
    const W = grid.clientWidth, H = grid.clientHeight, w = Math.min(360, W * .36);
    const r = maxed ? {x: 0, y: 0, w: W, h: H} : state.docked || !state.rect ? {x: W - w, y: 0, w, h: H} : bounded({x: state.rect.x * W, y: state.rect.y * H, w: state.rect.w * W, h: state.rect.h * H});
    put(r);
    cls(phone, 'phone-locked', state.locked); cls(phone, 'phone-maxed', maxed);
    $('sbphonelock').setAttribute('aria-pressed', String(state.locked));
    $('sbphonelock').title = state.locked ? 'Unlock phone window to move or resize' : 'Lock phone window in place';
    $('sbphonemax').title = maxed ? 'Restore phone window' : 'Maximize phone window';
    htmlOnce($('sbphonemax'), icon(maxed ? 'restore' : 'max'));
    fitDevice();
  }
  $('sbphonelock').onclick = () => { state.locked = !state.locked; keep(); layout(); };
  $('sbphonedock').onclick = () => { state.docked = true; state.locked = true; maxed = false; keep(); layout(); };
  function toggleMax() { if (state.locked) { toast('Unlock the phone window to maximize it.', 'warn'); return; } maxed = !maxed; layout(); }
  $('sbphonemax').onclick = toggleMax;
  bar.addEventListener('dblclick', e => { if (!e.target.closest('button')) toggleMax(); });
  function begin(e, kind, target) {
    if (e.button !== 0 || state.locked || maxed || phone.parentElement !== grid) return;
    e.preventDefault(); bar.focus({preventScroll: true});
    drag = {id: e.pointerId, x: e.clientX, y: e.clientY, start: rect(), kind};
    target.setPointerCapture(e.pointerId);
  }
  bar.addEventListener('pointerdown', e => { if (!e.target.closest('button')) begin(e, 'move', bar); });
  for (const kind of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
    const handle = document.createElement('i'); handle.className = 'sbphonerz ' + kind;
    handle.setAttribute('aria-hidden', 'true'); phone.appendChild(handle);
    handle.addEventListener('pointerdown', e => begin(e, kind, handle));
  }
  phone.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag, dx = e.clientX - d.x, dy = e.clientY - d.y, r = {...d.start};
    if (d.kind === 'move') { r.x += dx; r.y += dy; }
    else {
      if (d.kind.includes('e')) r.w += dx;
      if (d.kind.includes('s')) r.h += dy;
      if (d.kind.includes('w')) { r.w = clamp(r.w - dx, Math.min(280, grid.clientWidth), d.start.x + d.start.w); r.x = d.start.x + d.start.w - r.w; }
      if (d.kind.includes('n')) { r.h = clamp(r.h - dy, Math.min(320, grid.clientHeight), d.start.y + d.start.h); r.y = d.start.y + d.start.h - r.h; }
    }
    state.docked = false;
    grid.style.setProperty('--phone-reserve', '0px'); put(bounded(r)); fitDevice();
  });
  function end(e) {
    if (!drag || drag.id !== e.pointerId) return;
    if (e.type === 'pointercancel') put(drag.start);
    drag = null; saveRect(); layout();
  }
  phone.addEventListener('pointerup', end); phone.addEventListener('pointercancel', end);
  bar.addEventListener('keydown', e => {
    if (e.target !== bar || phone.parentElement !== grid) return;
    if (e.key === 'Enter') { e.preventDefault(); toggleMax(); return; }
    if (state.locked || maxed || !e.key.startsWith('Arrow')) return;
    e.preventDefault(); e.stopPropagation(); state.docked = false;
    const r = rect(), dx = e.key === 'ArrowRight' ? 8 : e.key === 'ArrowLeft' ? -8 : 0, dy = e.key === 'ArrowDown' ? 8 : e.key === 'ArrowUp' ? -8 : 0;
    if (e.shiftKey) { r.w += dx; r.h += dy; } else { r.x += dx; r.y += dy; }
    put(bounded(r)); saveRect(); layout();
  });
  new ResizeObserver(() => { if (!drag) layout(); }).observe(grid);
  new MutationObserver(layout).observe(grid, {childList: true});

  function zoom(to, x = viewport.clientWidth / 2, y = viewport.clientHeight / 2) {
    const before = state.zoom, after = Math.round(clamp(to, .4, 2) * 1000) / 1000;
    const left = (viewport.scrollLeft + x) / before, top = (viewport.scrollTop + y) / before;
    state.zoom = after; content.style.zoom = String(after);
    grid.style.setProperty('--canvas-scale', after);
    text($('sbzoomreset'), Math.round(after * 100) + '%');
    viewport.scrollLeft = left * after - x; viewport.scrollTop = top * after - y; keep();
  }
  $('sbzoomin').onclick = () => zoom(state.zoom + .1);
  $('sbzoomout').onclick = () => zoom(state.zoom - .1);
  $('sbzoomreset').onclick = () => { zoom(1, 0, 0); viewport.scrollTo(0, 0); };
  viewport.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault(); const r = viewport.getBoundingClientRect();
    zoom(state.zoom * Math.exp(-e.deltaY * .005), e.clientX - r.left, e.clientY - r.top);
  }, {passive: false});
  const pointers = new Map();
  let pan = null, pinch = null;
  const pair = () => { const [a, b] = [...pointers.values()]; return {distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}; };
  viewport.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') {
      pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
      if (pointers.size === 2) { pinch = {...pair(), zoom: state.zoom}; pan = null; e.preventDefault(); return; }
    }
    if (e.button !== 0 && e.button !== 1 || e.target.closest('.blk, .grp, button, input')) return;
    e.preventDefault(); viewport.focus({preventScroll: true});
    pan = {id: e.pointerId, x: e.clientX, y: e.clientY, left: viewport.scrollLeft, top: viewport.scrollTop};
    viewport.setPointerCapture(e.pointerId); viewport.classList.add('panning');
  });
  viewport.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pinch && pointers.size === 2) {
      e.preventDefault(); const p = pair(), r = viewport.getBoundingClientRect();
      zoom(pinch.zoom * p.distance / Math.max(1, pinch.distance), p.x - r.left, p.y - r.top);
    } else if (pan && pan.id === e.pointerId) {
      viewport.scrollLeft = pan.left + pan.x - e.clientX; viewport.scrollTop = pan.top + pan.y - e.clientY;
    }
  });
  function endPan(e) {
    pointers.delete(e.pointerId); pinch = null;
    if (pan?.id === e.pointerId || !pointers.size) { pan = null; viewport.classList.remove('panning'); }
  }
  viewport.addEventListener('pointerup', endPan); viewport.addEventListener('pointercancel', endPan);
  viewport.addEventListener('lostpointercapture', endPan);
  viewport.addEventListener('click', e => { if (e.target === content) openDrawer('settings', false); });
  window.sbWorkspace = {openDrawer, layout, resetView: () => viewport.scrollTo(0, 0)};
  zoom(state.zoom, 0, 0); layout();
})();

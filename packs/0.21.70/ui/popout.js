// Pop out (the owner, 2026-10-21): a Hub window or a Sandbox panel in a window of its own, to put on another monitor and
// build a full workspace. The panel itself moves (the same elements, so it keeps updating and its buttons keep working);
// its spot says where it went, with Bring it back. Closing that window, or Back into Falcor.Hub, brings it home.
// The page's styles and icons go with it; its ancestors are copied (classes, never ids) so the same rules still apply.
// What is out, and where its window stands, is kept (localStorage falcor.pops.v1): Falcor.Hub closed with panels out
// opens them again in the same places (Hub windows at start, Sandbox panels when the editor is open).
(() => {
  const KEY = 'falcor.pops.v1', pops = new Map(); // key -> {w, back}
  let leaving = false, kept = {};
  try { kept = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { kept = {}; }
  const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(kept)); } catch { /* not kept */ } };
  window.__popFind = id => { for (const p of pops.values()) { try { const n = p.w.document.getElementById(id); if (n) return n; } catch { /* closing */ } } return null; };
  window.popIsOut = key => pops.has(key);
  window.popBack = key => pops.get(key)?.back();
  window.popOut = function (key, node, title, opts = {}) {
    if (pops.has(key)) { try { pops.get(key).w.focus(); } catch { /* gone */ } return; }
    if (!node) return;
    const r = node.getBoundingClientRect(), at = opts.at;
    const W = at ? at.w : Math.max(380, Math.round((opts.width || r.width) + 32)), H = at ? at.h : Math.max(300, Math.round((opts.height || r.height) + 90));
    const w = window.open('', 'falcor-pop-' + key, 'width=' + W + ',height=' + H + (at ? ',left=' + at.x + ',top=' + at.y : ''));
    if (!w) { toast('That window could not open.', 'warn'); return; }
    const d = w.document;
    d.title = title + ' · Falcor.Hub';
    for (const l of document.querySelectorAll('link[rel="stylesheet"]')) { const c = d.createElement('link'); c.rel = 'stylesheet'; c.href = l.href; d.head.appendChild(c); }
    for (const a of document.documentElement.attributes) if (a.name.startsWith('data-') || a.name === 'class') d.documentElement.setAttribute(a.name, a.value);
    d.body.className = document.body.className + ' popbody';
    const sprite = document.getElementById('pixel-sprite'); if (sprite) d.body.appendChild(d.importNode(sprite, true));
    const head = d.createElement('div'); head.className = 'pophead';
    head.innerHTML = '<span class="popdot"></span><b>// ' + P.esc(title.toUpperCase()) + '</b><span class="grow"></span><button class="small" data-back>' + P.icon('restore') + 'Back into Falcor.Hub</button>';
    d.body.appendChild(head);
    const stage = d.createElement('div'); stage.className = 'popstage'; d.body.appendChild(stage);
    let host = stage;
    const ancestors = []; for (let a = node.parentElement; a && a !== document.body; a = a.parentElement) ancestors.unshift(a);
    for (const a of ancestors) {
      const c = d.createElement(a.tagName); c.className = (typeof a.className === 'string' ? a.className.replace(/\b(home|hidden|maxed|anim|dragging|resizing)\b/g, '') : '') + ' popchain';
      for (const at of a.attributes) if (at.name.startsWith('data-') && at.name !== 'data-style') c.setAttribute(at.name, at.value);
      host.appendChild(c); host = c;
    }
    const home = node.parentElement, place = document.createElement('div');
    // (free: its space goes to the workspace, nothing marks it)
    place.className = 'popplace' + (opts.free ? ' popfree' : '');
    place.innerHTML = P.icon('popout') + '<span>' + P.esc(title) + ' is in its own window.</span><button class="small" data-popback>Bring it back</button>';
    home.insertBefore(place, node);
    host.appendChild(d.adoptNode(node));
    // Where its window stands, read every two seconds while it is out.
    const where = () => { try { if (!w.closed) { kept[key] = {title, free: !!opts.free, x: w.screenX, y: w.screenY, w: w.outerWidth, h: w.outerHeight}; keep(); } } catch { /* closing */ } };
    where(); const tick = setInterval(where, 2000);
    let done = false;
    const back = () => {
      if (done) return; done = true; pops.delete(key); clearInterval(tick);
      if (!leaving) { delete kept[key]; keep(); }   // Falcor.Hub closing keeps it out for next time
      try { home.insertBefore(document.adoptNode(node), place); } catch { try { home.appendChild(node); } catch { /* the page is going */ } }
      place.remove();
      try { if (!w.closed) w.close(); } catch { /* already closed */ }
      if (opts.onBack) opts.onBack();
    };
    place.querySelector('[data-popback]').onclick = back;
    head.querySelector('[data-back]').onclick = back;
    w.addEventListener('pagehide', back); w.addEventListener('beforeunload', back);
    pops.set(key, {w, back});
    if (opts.onOut) opts.onOut();
  };
  // The Sandbox's panels (Blocks, Phone stage, Step settings, Timeline): their pop-out buttons. Their space goes to the stage's grid.
  const sbPop = (id, title, at) => {
    const el = document.getElementById(id);
    if (el?.classList.contains('sbtoolwindow') && window.sbWindows) { window.sbWindows.pop(id, at); return; }
    window.popOut('sb-' + id, el, title || 'Panel', {free: true, at});
  };
  document.addEventListener('click', e => { const b = e.target.closest('[data-pop]'); if (b) sbPop(b.dataset.pop, b.dataset.poptitle); });
  // The page going away (closing or a reload) brings every panel home first; closing keeps the list for the next start.
  window.addEventListener('beforeunload', () => { leaving = true; for (const p of [...pops.values()]) p.back(); });
  // Reopening: Hub windows once the desk is laid out (only those still shown), Sandbox panels when the editor is open.
  window.addEventListener('load', () => setTimeout(() => {
    for (const [key, k] of Object.entries(kept)) {
      if (!key.startsWith('hub-')) continue;
      const win = document.querySelector('[data-win="' + key.slice(4) + '"]');
      if (win && !win.hidden) window.popOut(key, win.querySelector('.winbody'), k.title, {at: k});
      else { delete kept[key]; keep(); }
    }
  }, 1200));
  setInterval(() => {
    const grid = document.getElementById('sbgrid'); if (!grid || !grid.offsetParent) return;
    for (const [key, k] of Object.entries(kept)) if (key.startsWith('sb-') && !pops.has(key) && document.getElementById(key.slice(3))) sbPop(key.slice(3), k.title, k);
  }, 1000);
})();

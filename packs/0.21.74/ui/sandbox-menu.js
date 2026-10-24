export function mountSandboxMenu(root, resolve) {
  const doc = root.ownerDocument, win = doc.defaultView;
  let menu = null, origin = null, hold = null, timer = 0, suppress = 0;
  const clearHold = () => { win.clearTimeout(timer); hold = null; };
  function close(restore = false) {
    menu?.remove(); menu = null;
    if (restore && origin?.isConnected) origin.focus({preventScroll: true});
  }
  function open(event, x, y) {
    const source = event.target.closest('[data-id], [data-s]');
    const attribute = source?.hasAttribute('data-s') ? 'data-s' : 'data-id', id = source?.getAttribute(attribute);
    const context = resolve(event); if (!context || !context.items.length) return;
    close(); origin = id ? root.querySelector('[' + attribute + '="' + win.CSS.escape(id) + '"]') : event.target.closest('button, [tabindex]') || root;
    menu = doc.createElement('div'); menu.className = 'sandbox-context-menu';
    menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', context.title);
    const heading = doc.createElement('b'); heading.textContent = context.title; menu.append(heading);
    for (const item of context.items) {
      const button = doc.createElement('button'); button.type = 'button';
      button.textContent = item.label; button.disabled = !!item.disabled;
      button.setAttribute('role', 'menuitem');
      if (item.danger) button.className = 'danger';
      button.onclick = () => { close(); item.run(); };
      menu.append(button);
    }
    doc.body.append(menu);
    const box = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, win.innerWidth - box.width - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, win.innerHeight - box.height - 8)) + 'px';
    menu.querySelector('button:not(:disabled)')?.focus({preventScroll: true});
  }
  const context = e => { e.preventDefault(); clearHold(); open(e, e.clientX, e.clientY); };
  const down = e => {
    suppress = 0;
    if (e.pointerType === 'touch' && !e.isPrimary) { clearHold(); return; }
    if (e.pointerType !== 'touch' || !e.isPrimary || !e.target.closest('[data-s], .blk[data-id]') || e.target.closest('.sbgrip, input, textarea, select')) return;
    clearHold(); hold = {id: e.pointerId, x: e.clientX, y: e.clientY};
    timer = win.setTimeout(() => { hold = null; suppress = Infinity; open(e, e.clientX, e.clientY); }, 600);
  };
  const move = e => { if (hold && (e.pointerId !== hold.id || Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 8)) clearHold(); };
  const up = () => { clearHold(); if (suppress === Infinity) suppress = performance.now() + 500; };
  const click = e => { if (performance.now() < suppress) { e.preventDefault(); e.stopImmediatePropagation(); } };
  const outside = e => { if (menu && !menu.contains(e.target)) close(); };
  const key = e => {
    if (menu) {
      if (menu.contains(e.target) && !(e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'x')) e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (menu.contains(e.target) && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const buttons = [...menu.querySelectorAll('button:not(:disabled)')], at = buttons.indexOf(doc.activeElement);
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (at + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      } else if (e.key === 'Tab') close();
    } else if (root.contains(e.target) && (e.key === 'ContextMenu' || e.shiftKey && e.key === 'F10')) {
      e.preventDefault(); e.stopPropagation(); const r = e.target.getBoundingClientRect(); open(e, r.left, r.bottom);
    }
  };
  const scroll = e => {
    const target = e.target;
    if (menu && (target === doc || target instanceof win.Element && (target.contains(root) || root.contains(target)))) close();
  };
  const blur = () => { clearHold(); close(); };
  const owner = root.closest('.sbed, .sandbox') || root;
  owner.addEventListener('sandbox-hide', blur);
  root.addEventListener('contextmenu', context);
  root.addEventListener('pointerdown', down);
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  root.addEventListener('click', click, true);
  doc.addEventListener('pointerdown', outside, true);
  doc.addEventListener('keydown', key, true);
  doc.addEventListener('scroll', scroll, true);
  win.addEventListener('resize', blur); win.addEventListener('blur', blur);
  return () => {
    clearHold(); close();
    root.removeEventListener('contextmenu', context);
    root.removeEventListener('pointerdown', down);
    root.removeEventListener('pointermove', move);
    root.removeEventListener('pointerup', up);
    root.removeEventListener('pointercancel', up);
    root.removeEventListener('click', click, true);
    doc.removeEventListener('pointerdown', outside, true);
    doc.removeEventListener('keydown', key, true);
    doc.removeEventListener('scroll', scroll, true);
    win.removeEventListener('resize', blur); win.removeEventListener('blur', blur);
    owner.removeEventListener('sandbox-hide', blur);
  };
}

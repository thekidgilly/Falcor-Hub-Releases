// Settings → AI Control Center: Providers, Model Library, Intelligent Routing, Usage and Limits (the computer's ai/
// library through the `ai` IPC). Keys go in and never come back: the page only ever sees names, states and models.
// Loaded after app.js and uses its helpers ($, call, esc, icon, toast, keyed, htmlOnce, text, cls, P, time, money, meter).
(() => {
  const STATUS = {connected: ['Connected', 'on'], not_configured: ['Not configured', 'warn'], failed: ['Test failed', 'bad'], unavailable: ['Unavailable', 'bad']};
  const KINDS = [['gemini', 'Google Gemini', 'G'], ['openai', 'OpenAI', 'O'], ['anthropic', 'Anthropic Claude', 'A'], ['kimi', 'Moonshot Kimi', 'K'], ['openrouter', 'OpenRouter', 'R'], ['xai', 'xAI', 'X'], ['deepseek', 'DeepSeek', 'D'], ['groq', 'Groq', 'Q'], ['together', 'Together AI', 'T'], ['fireworks', 'Fireworks AI', 'F'], ['custom', 'Custom OpenAI-compatible', '⚙'], ['ollama', 'Ollama (local)', 'L']];
  let tab = 'providers', lib = null, libBusy = false, managing = null;
  const dirty = new Map();   // Advanced routing edits not saved yet: op -> {ref, fallback}
  const chip = (on, label) => '<span class="chip ' + (on === true ? 'yes' : on === false ? 'no' : 'unk') + '" title="' + label + ': ' + (on === true ? 'verified' : on === false ? 'not supported' : 'unknown, test it first') + '">' + label + (on === null ? '?' : '') + '</span>';
  const capsHtml = m => chip(m.caps.vision, 'Vision') + chip(m.caps.tools, 'Tools') + chip(m.caps.json, 'JSON') + (m.local ? '<span class="chip yes">Local</span>' : '') + (m.measured && m.measured.avgMs < 2500 ? '<span class="chip yes" title="Measured in Falcor">Fast</span>' : '');
  const priceHtml = m => m.price ? '$' + m.price.input + ' / $' + m.price.output + ' per M <span class="muted">(' + esc(m.priceSource || 'verified') + ')</span>' : '<span class="muted">price unknown</span>';
  const perfHtml = m => m.measured ? m.measured.avgMs + ' ms · ' + m.measured.okPct + '% ok · ' + m.measured.calls + ' requests' : '<span class="muted">Not tested</span>';
  async function loadLib(force) {
    if (libBusy || (lib && !force)) return;
    libBusy = true;
    try { lib = await call('ai', {op: 'library'}); } catch (e) { lib = lib || []; } finally { libBusy = false; }
    draw();
  }
  function setTab(t) { tab = t; document.querySelectorAll('#aiseg button').forEach(b => { cls(b, 'on', b.dataset.ai === t); b.setAttribute('aria-selected', String(b.dataset.ai === t)); }); document.querySelectorAll('.aicc [data-aip]').forEach(s => { s.hidden = s.dataset.aip !== t; }); if (t !== 'providers') void loadLib(); draw(); }
  $('aiseg').onclick = e => { const b = e.target.closest('[data-ai]'); if (b) setTab(b.dataset.ai); };

  // ---------------------------------------------------------------- providers
  function drawProviders() {
    const list = S.ai.connections;
    htmlOnce($('aicards'), list.length ? list.map(c => {
      const st = STATUS[c.status] || STATUS.not_configured;
      return '<div class="aicard conn" data-conn="' + esc(c.id) + '"><span class="aiicon">' + esc(c.icon) + '</span><div class="grow"><b>' + esc(c.name) + '</b><span class="muted small">' + esc(c.provider) + (c.migrated ? ' · your earlier Kimi setup' : '') + '</span>'
        + '<span class="small"><span class="led ' + st[1] + '"></span>' + st[0] + (c.status === 'connected' ? ' · ' + c.models + ' model' + (c.models === 1 ? '' : 's') : '') + (c.lastOkAt ? ' · tested ' + time(c.lastOkAt) : '') + '</span>'
        + (c.lastError && c.status !== 'connected' ? '<span class="small red">' + esc(c.lastError) + '</span>' : '') + (c.needsKey && !c.hasKey ? '<span class="small sand">No key saved</span>' : '') + '</div>'
        + '<button class="small" data-manage="' + esc(c.id) + '">Manage</button></div>';
    }).join('') : '<p class="muted small">No AI provider yet. Add one: Falcor needs a model to read new screens, write guides and chat.</p>');
  }
  const drawer = $('aidrawer');
  function openAdd() {
    managing = null; drawer.hidden = false;
    drawer.innerHTML = '<div class="top"><p class="eyebrow">// ADD PROVIDER · 1 CHOOSE</p><button class="ghost icon" data-dclose aria-label="Close">' + icon('close') + '</button></div><div class="aikinds">'
      + KINDS.map(k => '<button data-kind="' + k[0] + '"><span class="aiicon">' + esc(k[2]) + '</span>' + esc(k[1]) + '</button>').join('') + '</div>';
  }
  function addForm(kind) {
    const k = KINDS.find(x => x[0] === kind), custom = kind === 'custom', local = kind === 'ollama';
    drawer.innerHTML = '<div class="top"><p class="eyebrow">// ADD ' + esc(k[1].toUpperCase()) + ' · 2 KEY · 3 SAVE · 4 TEST · 5 MODELS</p><button class="ghost icon" data-dclose aria-label="Close">' + icon('close') + '</button></div>'
      + '<form class="grid" id="aiaddform"><input type="hidden" name="kind" value="' + kind + '"><label>Name<input name="name" maxlength="40" placeholder="' + esc(k[1]) + '"></label>'
      + (custom ? '<label class="wide">API address<input name="baseUrl" placeholder="https://api.example.com/v1" required></label><label>Authentication<select name="auth"><option value="bearer">Bearer key</option><option value="x-api-key">x-api-key header</option><option value="none">No key</option></select></label><label>Model discovery<select name="listing"><option value="list">From its /models list</option><option value="manual">I enter model ids</option></select></label><label class="wide">Extra header (optional)<input name="hname" placeholder="Header-Name" maxlength="40"><input name="hvalue" placeholder="value" maxlength="200"></label>' : '')
      + (local ? '<label class="wide">Address<input name="baseUrl" value="http://localhost:11434/v1"></label>' : '')
      + (local || false ? '' : '<label class="wide">API key<input name="key" type="password" autocomplete="off" placeholder="' + (custom ? 'its key, if it needs one' : 'paste your ' + esc(k[1]) + ' key') + '"></label>')
      + '<div class="wide row"><button class="primary">Save and test</button><span class="muted small" id="aiaddmsg">The key is sealed on this computer and sent only to ' + esc(k[1]) + '.</span></div></form>'
      + (custom ? '<p class="small muted">A custom provider must speak OpenAI\'s chat completions. A service with its own request format needs an adapter in Falcor first.</p>' : '');
  }
  async function submitAdd(f) {
    const d = Object.fromEntries(new FormData(f)), msg = $('aiaddmsg');
    const headers = d.hname ? {[d.hname]: d.hvalue || ''} : undefined;
    let c;
    try { text(msg, 'Saving…'); c = await call('ai', {op: 'add', kind: d.kind, name: d.name, key: d.key, baseUrl: d.baseUrl, auth: d.auth, listing: d.listing, headers}); }
    catch (e) { text(msg, e.message); return; }
    f.querySelector('[name=key]') && (f.querySelector('[name=key]').value = '');
    try { text(msg, 'Testing the connection…'); const r = await call('ai', {op: 'test', id: c.id}); text(msg, 'Connected: ' + r.models + ' models found.'); P.burst(f); toast(c.name + ' connected: ' + r.models + ' models in the library.'); lib = null; setTimeout(() => { drawer.hidden = true; }, 900); }
    catch (e) { text(msg, 'Saved, but the test failed: ' + e.message); }
  }
  function openManage(id) {
    const c = S.ai.connections.find(x => x.id === id); if (!c) return;
    managing = id; drawer.hidden = false;
    const budget = S.ai.budgets[id];
    drawer.innerHTML = '<div class="top"><p class="eyebrow">// ' + esc(c.name.toUpperCase()) + '</p><button class="ghost icon" data-dclose aria-label="Close">' + icon('close') + '</button></div>'
      + '<p class="small muted">' + esc(c.provider) + ' · ' + esc(c.baseUrl) + (c.headers.length ? ' · headers ' + esc(c.headers.join(', ')) : '') + '</p>'
      + '<form class="grid" id="aimanform"><label>Name<input name="name" value="' + esc(c.name) + '" maxlength="40"></label>'
      + (c.needsKey ? '<label class="wide">API key<input name="key" type="password" autocomplete="off" placeholder="' + (c.hasKey ? '•••••••• saved (paste a new one to replace it)' : 'paste the key') + '"></label>' : '<p class="small muted wide">This connection needs no key.</p>')
      + '<label>Monthly budget ($)<input name="budget" type="number" min="0" step="0.5" value="' + (budget ?? '') + '" placeholder="none"></label>'
      + '<div class="wide row"><button class="primary">Save</button><button type="button" data-mtest>Test connection</button><button type="button" data-mrefresh>Refresh models</button>' + (c.needsKey && c.hasKey ? '<button type="button" class="danger" data-mrmkey>Remove key</button>' : '') + '<button type="button" class="danger" data-mrm>Remove connection</button></div></form>'
      + '<form class="row" id="aimodelform"><input name="model" placeholder="Add a model id by hand" maxlength="160"><button>Add model</button></form><p class="small muted" id="aimanmsg"></p>';
  }
  drawer.addEventListener('click', async e => {
    const t = e.target;
    if (t.closest('[data-dclose]')) { drawer.hidden = true; managing = null; return; }
    const k = t.closest('[data-kind]'); if (k) return addForm(k.dataset.kind);
    const msg = $('aimanmsg'), id = managing; if (!id) return;
    try {
      if (t.closest('[data-mtest]') || t.closest('[data-mrefresh]')) { text(msg, 'Testing…'); const r = await call('ai', {op: 'test', id}); text(msg, 'Connected · ' + r.models + ' models · ' + r.ms + ' ms'); P.burst(t); lib = null; void loadLib(true); }
      if (t.closest('[data-mrmkey]') && confirm('Remove the saved key?')) { await call('ai', {op: 'removeKey', id}); toast('Key removed.'); openManage(id); }
      if (t.closest('[data-mrm]') && confirm('Remove this connection and its key? Operations using its models go back to what you had before.')) { await call('ai', {op: 'remove', id}); drawer.hidden = true; managing = null; lib = null; toast('Connection removed.'); }
    } catch (err) { text(msg, err.message); }
  });
  drawer.addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target;
    if (f.id === 'aiaddform') return submitAdd(f);
    const id = managing, msg = $('aimanmsg'); if (!id) return;
    try {
      if (f.id === 'aimanform') {
        const d = Object.fromEntries(new FormData(f));
        await call('ai', {op: 'rename', id, name: d.name});
        if (d.key) { await call('ai', {op: 'setKey', id, key: d.key}); f.querySelector('[name=key]').value = ''; }
        await call('ai', {op: 'setBudget', id, budget: d.budget === '' ? null : Number(d.budget)});
        text(msg, 'Saved.' + (d.key ? ' Press Test connection to check the new key.' : '')); P.burst(f.querySelector('.primary'));
      }
      if (f.id === 'aimodelform') { await call('ai', {op: 'addModel', id, model: f.model.value}); f.model.value = ''; text(msg, 'Added. Test it in the Model Library before giving it work that needs pictures, tools or JSON.'); lib = null; }
    } catch (err) { text(msg, err.message); }
  });
  $('aicards').onclick = e => { const b = e.target.closest('[data-manage]'); if (b) openManage(b.dataset.manage); };
  $('aiadd').onclick = openAdd;

  // ---------------------------------------------------------------- model library
  function filtered() {
    const q = $('libq').value.trim().toLowerCase(), prov = $('libprov').value, caps = [...document.querySelectorAll('.aifilters [data-cap]:checked')].map(x => x.dataset.cap);
    return (lib || []).filter(m => (!q || (m.name + ' ' + m.id + ' ' + m.provider + ' ' + m.connName).toLowerCase().includes(q)) && (!prov || m.conn === prov)
      && caps.every(c => c === 'local' ? m.local : m.caps[c] === true) && (!$('libavail').checked || m.available) && (!$('libchat').checked || m.chat));
  }
  function drawLibrary() {
    const provs = '<option value="">All providers</option>' + S.ai.connections.map(c => '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>').join('');
    const sel = $('libprov'); if (sel.dataset.h !== provs) { const v = sel.value; sel.dataset.h = provs; sel.innerHTML = provs; sel.value = v; }
    if (!lib) { htmlOnce($('ailib'), '<li class="muted small">Loading models…</li>'); return; }
    const list = filtered().slice(0, 200);
    htmlOnce($('ailib'), list.map(m => '<li data-ref="' + esc(m.ref) + '"><div class="grow"><b>' + esc(m.name) + '</b> <span class="muted small">' + esc(m.connName) + '</span><code class="small">' + esc(m.id) + '</code>'
      + '<span class="small">' + capsHtml(m) + (m.context ? ' · ' + Math.round(m.context / 1000) + 'k context' : '') + ' · ' + priceHtml(m) + '</span><span class="small">' + perfHtml(m) + (m.tested ? ' · capabilities tested ' + time(m.tested.at) : '') + '</span>'
      + (!m.available ? '<span class="small sand">Its connection is ' + esc((STATUS[m.status] || STATUS.not_configured)[0].toLowerCase()) + '.</span>' : '') + '</div>'
      + (m.available && m.chat ? '<button class="small" data-mtestref="' + esc(m.ref) + '" title="Sends three tiny requests (JSON, a picture, a tool call): uses a little credit">Test model</button>' : '') + '</li>').join('') || '<li class="muted small">No model matches. Add a provider, or change the filters.</li>');
    text($('libnote'), (lib || []).length + ' models in the library. Capabilities with ? are unknown until tested; only verified prices are shown.');
  }
  ['libq', 'libprov', 'libavail', 'libchat'].forEach(id => $(id).addEventListener('input', drawLibrary));
  document.querySelectorAll('.aifilters [data-cap]').forEach(x => x.addEventListener('change', drawLibrary));
  $('ailib').onclick = async e => {
    const b = e.target.closest('[data-mtestref]'); if (!b) return;
    if (!confirm('Test this model? It sends three tiny requests on your account.')) return;
    b.classList.add('busy');
    try { const r = await call('ai', {op: 'testModel', ref: b.dataset.mtestref}); toast('Tested: pictures ' + (r.vision ? 'yes' : 'no') + ', tools ' + (r.tools ? 'yes' : 'no') + ', JSON ' + (r.json ? 'yes' : 'no') + ' · ' + r.ms + ' ms.'); P.burst(b); await loadLib(true); }
    catch (err) { toast(err.message, 'warn'); } finally { b.classList.remove('busy'); }
  };

  // ---------------------------------------------------------------- routing
  const opt = (m, why) => '<option value="' + esc(m.ref) + '"' + (why ? ' disabled' : '') + '>' + esc(m.name + ' · ' + m.connName) + (why ? ' — ' + esc(why) : '') + '</option>';
  function drawRouting() {
    const r = S.ai.routing, ops = Object.fromEntries(r.ops.map(o => [o.id, o]));
    if (document.activeElement !== $('aiadv')) $('aiadv').checked = r.mode === 'advanced';
    $('aiadvbox').hidden = r.mode !== 'advanced';
    htmlOnce($('airec'), (S.ai.recommend || []).length ? '<p class="eyebrow">// RECOMMENDED</p>' + S.ai.recommend.map(x => '<div class="small"><b>' + esc(x.category) + ':</b> ' + esc(x.name) + ' <span class="muted">— ' + esc(x.why) + '</span></div>').join('') : '');
    if (!lib) return;
    // Simple: the gaming model (searchable), what changes, and the chat model.
    const q = $('gamq').value.trim().toLowerCase(), plan = lib.filter(m => m.available && m.chat && !m.fits.plan && (!q || (m.name + m.id + m.connName).toLowerCase().includes(q)));
    const gs = $('gamsel'), cur = ops.plan && ops.plan.ref, html = plan.map(m => opt(m)).join('') || '<option disabled>No compatible model: add a provider and test its models</option>';
    if (gs.dataset.h !== html) { const v = gs.value; gs.dataset.h = html; gs.innerHTML = html; gs.value = v || cur || ''; }
    const pick = lib.find(m => m.ref === (gs.value || cur));
    htmlOnce($('gaminfo'), pick ? '<b>' + esc(pick.name) + '</b> · ' + esc(pick.provider) + ' · screenshots ' + (pick.caps.vision === true ? 'yes' : pick.caps.vision === false ? 'no (text only)' : 'unknown') + ' · ' + perfHtml(pick) + ' · ' + priceHtml(pick) : '<span class="muted">Pick a model above.</span>');
    if (pick) { const will = ['plan', 'guide', 'learn', 'offer', 'research'].filter(o => !pick.fits[o]).map(o => ops[o].label), skip = ['offer', 'research'].filter(o => pick.fits[o]).map(o => ops[o].label + ' stays on ' + (ops[o].name || 'its own model'));
      text($('gamsummary'), 'Use for Gaming sets: ' + will.join(', ') + '.' + (skip.length ? ' ' + skip.join('; ') + ' (' + esc(pick.name) + ' cannot do it).' : '') + ' Your games\' knowledge stays with each game, whatever model plays.'); }
    $('gamuse').disabled = !pick || pick.ref === cur && ops.guide.ref === cur;
    const chat = lib.filter(m => m.available && m.chat && !m.fits.chat), cs = $('chatsel'), ch = chat.map(m => opt(m)).join('') || '<option disabled>No model with tool calls yet</option>';
    if (cs.dataset.h !== ch) { cs.dataset.h = ch; cs.innerHTML = ch; cs.value = ops.chat.ref || ''; }
    // Advanced: one row per operation, with its fallback.
    const showAll = $('showunavail').checked;
    keyed($('airoutes'), r.ops, o => o.id, () => P.el('<li><div class="grow"><b></b><span class="small"></span></div><select data-r="ref"></select><select data-r="fallback"></select><button type="button" class="small" data-optest>Test</button><span class="small muted"></span></li>'), (li, o) => {
      li.querySelector('b').textContent = o.label;
      const d = dirty.get(o.id) || {}, ref = d.ref !== undefined ? d.ref : o.ref, fb = d.fallback !== undefined ? d.fallback : o.fallback;
      const cand = lib.filter(m => m.chat && (showAll || (m.available && !m.fits[o.id])));
      const opts = (refSel, allowNone) => (allowNone ? '<option value="">' + (allowNone === 'fb' ? 'No fallback' : 'Use what you had before') + '</option>' : '') + cand.map(m => opt(m, m.available ? m.fits[o.id] : 'its connection is not connected')).join('') + (refSel && !cand.some(m => m.ref === refSel) ? '<option value="' + esc(refSel) + '">' + esc(refSel) + '</option>' : '');
      const [s1, s2] = li.querySelectorAll('select'), h1 = opts(ref, 'inherit'), h2 = opts(fb, 'fb');
      if (s1.dataset.h !== h1) { s1.dataset.h = h1; s1.innerHTML = h1; } if (s2.dataset.h !== h2) { s2.dataset.h = h2; s2.innerHTML = h2; }
      if (document.activeElement !== s1) s1.value = o.assigned || d.ref !== undefined ? ref || '' : ''; if (document.activeElement !== s2) s2.value = fb || '';
      s1.onchange = () => { dirty.set(o.id, {...(dirty.get(o.id) || {}), ref: s1.value || null}); text($('advmsg'), 'Not saved yet.'); };
      s2.onchange = () => { dirty.set(o.id, {...(dirty.get(o.id) || {}), fallback: s2.value || null}); text($('advmsg'), 'Not saved yet.'); };
      text(li.querySelector('.grow .small'), (o.name ? o.name + (o.inherited ? ' (your earlier Kimi routing)' : '') : 'No model') + (o.status && o.status !== 'connected' ? ' · ' + (STATUS[o.status] || [o.status])[0] : '') + (o.ref && o.why ? ' · ' + o.why : ''));
      li.querySelector('[data-optest]').dataset.optest = o.id;
    });
  }
  $('gamq').addEventListener('input', drawRouting); $('gamsel').addEventListener('change', drawRouting);
  $('gamuse').onclick = async () => { const ref = $('gamsel').value; if (!ref) return; try { const r = await call('ai', {op: 'setRouting', gaming: ref}); toast('Gaming AI set: ' + r.changed.join(', ') + '.'); P.burst($('gamuse')); } catch (e) { toast(e.message, 'warn'); } };
  $('chatuse').onclick = async () => { const ref = $('chatsel').value; if (!ref) return; try { await call('ai', {op: 'setRouting', chat: ref}); toast('Falcor chat set.'); P.burst($('chatuse')); } catch (e) { toast(e.message, 'warn'); } };
  $('aiadv').onchange = async () => { try { await call('ai', {op: 'setRouting', mode: $('aiadv').checked ? 'advanced' : 'simple'}); } catch (e) { $('aiadv').checked = !$('aiadv').checked; toast(e.message, 'warn'); } };
  $('showunavail').onchange = drawRouting;
  $('advsave').onclick = async () => { if (!dirty.size) return; try { await call('ai', {op: 'setRouting', mode: 'advanced', ops: Object.fromEntries(dirty)}); dirty.clear(); text($('advmsg'), ''); toast('Routing saved.'); P.burst($('advsave')); } catch (e) { text($('advmsg'), e.message); } };
  $('advcancel').onclick = () => { dirty.clear(); text($('advmsg'), ''); $('airoutes').querySelectorAll('select').forEach(s => { s.dataset.h = ''; }); drawRouting(); };
  $('advreset').onclick = async () => { if (!confirm('Restore defaults? Every operation goes back to what you had before; connections and keys stay.')) return; await call('ai', {op: 'setRouting', reset: true}); dirty.clear(); toast('Routing restored.'); };
  $('airoutes').onclick = async e => { const b = e.target.closest('[data-optest]'); if (!b || !b.dataset.optest) return; b.classList.add('busy'); try { const r = await call('ai', {op: 'testOp', operation: b.dataset.optest}); toast(r.provider + ' · ' + r.model + ': ' + r.reply + ' (' + r.ms + ' ms).'); P.burst(b); } catch (err) { toast(err.message, 'warn'); } finally { b.classList.remove('busy'); } };

  // ---------------------------------------------------------------- usage
  function drawUsage() {
    if (document.activeElement !== $('limit')) $('limit').value = S.limit ?? '';
    const sp = S.spend, spent = sp.teach + sp.chat + sp.autopilot;
    meter($('limitmeter'), S.limit ? spent / S.limit : 0, ''); $('limitmeter').title = money(spent) + (S.limit !== null ? ' of ' + money(S.limit) : ' this month, no limit');
    const names = Object.fromEntries(S.ai.connections.map(c => [c.id, c.name]));
    const prov = Object.entries(sp.providers || {}), models = Object.entries(sp.models || {}), days = Object.entries(sp.days || {}).sort().slice(-7);
    htmlOnce($('aiusage'), '<p class="eyebrow">// THIS MONTH · ' + esc(money(spent)) + (sp.estimated ? ' (part estimated)' : '') + '</p>'
      + '<table class="aitable"><tr><th>Provider</th><th>Requests</th><th>Tokens</th><th>Cost</th><th>Budget</th></tr>' + (prov.map(([id, v]) => '<tr><td>' + esc(names[id] || id) + '</td><td>' + v.requests + '</td><td>' + v.tokens + '</td><td>' + esc(money(v.cost)) + (v.unpriced ? ' + Unknown' : '') + '</td><td>' + (S.ai.budgets[id] !== undefined ? '$' + S.ai.budgets[id] : '—') + '</td></tr>').join('') || '<tr><td colspan="5" class="muted">No requests this month.</td></tr>') + '</table>'
      + '<table class="aitable"><tr><th>Model</th><th>Requests</th><th>In / out tokens</th><th>Cost</th></tr>' + models.map(([m, v]) => '<tr><td>' + esc(m.replace('::', ' · ')) + '</td><td>' + v.requests + '</td><td>' + v.input + ' / ' + v.output + '</td><td>' + (v.unpriced ? 'Unknown' : esc(money(v.cost))) + '</td></tr>').join('') + '</table>'
      + (days.length ? '<p class="small muted">By day: ' + days.map(([d, c]) => esc(d.slice(5)) + ' ' + esc(money(c))).join(' · ') + '</p>' : '') + (sp.search ? '<p class="small muted">Web searches: ' + sp.search.calls + ' · ' + esc(money(sp.search.cost)) + '</p>' : ''));
  }

  function draw() {
    if (!S || !S.ai) return;
    const ga = S.ai.active.gaming;
    $('aistate').firstElementChild.className = 'led ' + (!ga ? 'warn' : ga.status === 'connected' ? 'on' : ga.status === 'failed' ? 'bad' : 'warn');
    text($('aistate').lastElementChild, ga ? 'Gaming: ' + ga.model + ' · ' + ga.connection : 'No gaming model yet');
    drawProviders();
    if (tab === 'library') drawLibrary();
    if (tab === 'routing') drawRouting();
    if (tab === 'usage') drawUsage();
  }
  window.renderAi = draw;
})();

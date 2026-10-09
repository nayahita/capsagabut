/*
 * Reaction engine. Listens to every CapsaEvents event and turns it into a "judgement card"
 * (roast text + stat line), a sound from a local file, and visual effects, following
 * the rules in reactions.config.js.
 *
 * Anti-spam, in order:
 *   1. Events arriving within settings.batchWindowMs are judged together.
 *   2. Per event type, only the instance with the best `pickBy` value is kept.
 *   3. Cooldowns (per event type, per player) drop repeats, unless priority >= overridePriority.
 *   4. One card per `group`; lower priority events in the same group become tags on it.
 *   5. At most settings.maxPerBatch cards per batch, shown one after another.
 *   6. The queue holds settings.maxQueue cards; the lowest priority one is dropped first.
 * Stats in `track` are counted for every event, even ones that never get a card.
 *
 * Extend: CapsaReactions.defineEffect('name', (fx, event, cardEl) => { ... })
 * Preview: CapsaReactions.test('BAD_BEAT')
 * Text: config strings may be { en, id } pairs; they are resolved in this phone's language when the card is shown.
 */
(function () {
  'use strict';
  const C = window.CAPSA_REACTIONS || { settings: {}, sounds: {}, events: {} };
  const S = Object.assign({ enabled: true, batchWindowMs: 350, maxPerBatch: 2, displayMs: 3200, gapMs: 400, maxQueue: 4,
    playerCooldownMs: 0, overridePriority: 90, volume: 0.9 }, C.settings || {});
  const FX = () => window.CapsaFX || null;
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const fill = (str, ctx) => String(str || '').replace(/\{(\w+)\}/g, (m, k) => (ctx[k] != null ? ctx[k] : ''));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const say = (v) => (window.CapsaI18n ? window.CapsaI18n.pick(v) : v && typeof v === 'object' ? (v.en != null ? v.en : v.id) : v);

  const lastType = {}, lastPlayer = {}, lastText = {};
  const queue = [];
  let batch = null, showing = false;

  /* ---------- stats ---------- */
  function applyTrack(def, ev) {
    const st = window.CapsaStats;
    if (!st || !def.track || !ev.name) return;
    for (const t of [].concat(def.track)) {
      if (t.inc) st.inc(ev.name, t.inc, 1);
      if (t.max) st.max(ev.name, t.max[0], Number(ev[t.max[1]]) || 0);
    }
  }

  /* ---------- selection ---------- */
  function score(def, ev) {
    if (!def.pickBy) return 0;
    const neg = def.pickBy[0] === '-', v = Number(ev[neg ? def.pickBy.slice(1) : def.pickBy]) || 0;
    return neg ? -v : v;
  }
  function onEvent(ev) {
    const def = C.events && C.events[ev.type];
    if (!def) return;
    applyTrack(def, ev);
    if (!S.enabled || def.enabled === false) return;
    try { if (def.when && !def.when(ev)) return; } catch (e) { return; }
    if (!batch) { batch = { items: [] }; setTimeout(flush, Math.max(S.batchWindowMs, ev.delay || 0)); }
    batch.items.push({ ev, def, score: score(def, ev) });
  }
  function cooled(c, now) {
    if ((c.def.priority || 0) >= S.overridePriority) return true;
    if (c.def.cooldownMs && now - (lastType[c.ev.type] || -1e12) < c.def.cooldownMs) return false;
    if (S.playerCooldownMs && c.ev.name && now - (lastPlayer[c.ev.name] || -1e12) < S.playerCooldownMs) return false;
    return true;
  }
  function flush() {
    const items = batch ? batch.items : [];
    batch = null;
    const now = Date.now(), best = {};
    for (const it of items) { const cur = best[it.ev.type]; if (!cur || it.score > cur.score) best[it.ev.type] = it; }
    const cands = Object.values(best).filter((c) => cooled(c, now)).sort((a, b) => (b.def.priority || 0) - (a.def.priority || 0));
    const groups = {}, chosen = [];
    for (const c of cands) {
      const g = c.def.group || c.ev.type;
      if (groups[g]) { if (groups[g].ev.name === c.ev.name) groups[g].tags.push(c); continue; }
      if (chosen.length >= S.maxPerBatch) continue;
      c.tags = []; groups[g] = c; chosen.push(c);
    }
    for (const c of chosen) { lastType[c.ev.type] = now; if (c.ev.name) lastPlayer[c.ev.name] = now; queue.push(c); }
    while (queue.length > S.maxQueue) {
      let lo = 0;
      queue.forEach((q, i) => { if ((q.def.priority || 0) < (queue[lo].def.priority || 0)) lo = i; });
      queue.splice(lo, 1);
    }
    pump();
  }
  function pump() {
    if (showing || !queue.length) return;
    showing = true;
    show(queue.shift());
    setTimeout(() => { showing = false; pump(); }, S.displayMs + S.gapMs);
  }

  /* ---------- card ---------- */
  let layerEl = null;
  function layer() {
    if (!layerEl || !layerEl.isConnected) { layerEl = document.createElement('div'); layerEl.className = 'rx-layer'; document.body.appendChild(layerEl); }
    return layerEl;
  }
  function pickText(type, list) {
    if (!list || !list.length) return '';
    const idx = list.map((_, i) => i), opts = list.length > 1 ? idx.filter((i) => i !== lastText[type]) : idx;
    const i = pick(opts); lastText[type] = i; return say(list[i]);
  }
  function show(c) {
    const fx = FX(), ev = c.ev, def = c.def;
    const stats = window.CapsaStats && ev.name ? window.CapsaStats.get(ev.name) : {};
    const ctx = Object.assign({}, stats, ev, { name: ev.name || '', winner: ev.winnerName || '', target: ev.target || '', cards: ev.cardsLeft });
    const el = document.createElement('div');
    el.className = `rx-card rx-${def.tone || 'win'}`;
    el.setAttribute('role', 'status');
    const text = pickText(ev.type, def.texts);
    el.innerHTML = `<div class="rx-mascot">${fx && fx.mascotSVG ? fx.mascotSVG(def.mascot || 'laugh') : ''}</div>
      <div class="rx-body"><div class="rx-title">${esc(fill(say(def.title) || ev.type, ctx))}</div>
      ${text ? `<p class="rx-text">${esc(fill(text, ctx))}</p>` : ''}
      <div class="rx-meta">${def.stat ? `<span class="rx-stat">${esc(fill(say(def.stat), ctx))}</span>` : ''}${(c.tags || []).map((t) => `<span class="rx-tag">+ ${esc(fill(say(t.def.tag || t.def.title) || t.ev.type, Object.assign({}, ctx, t.ev)))}</span>`).join('')}</div></div>`;
    layer().appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    setTimeout(() => { el.classList.remove('in'); el.classList.add('out'); setTimeout(() => el.remove(), 450); }, S.displayMs);
    if (def.sound) playSound(def.sound);
    if (def.effect && fx && !reduced()) {
      for (const name of [].concat(def.effect)) { const f = EFFECTS[name]; if (f) { try { f(fx, ev, el); } catch (e) { console.warn('[CapsaReactions] effect', name, e); } } }
    }
  }

  /* ---------- effects ---------- */
  const CRACK = (() => {
    const lines = [];
    for (let i = 0; i < 9; i++) {
      let x = 50, y = 42, a = (i / 9) * Math.PI * 2 + Math.random() * 0.4, pts = [`${x},${y}`];
      for (let k = 0; k < 6; k++) { a += (Math.random() - 0.5) * 0.8; const r = 6 + Math.random() * 9; x += Math.cos(a) * r; y += Math.sin(a) * r; pts.push(`${x.toFixed(1)},${y.toFixed(1)}`); }
      lines.push(`<polyline vector-effect="non-scaling-stroke" points="${pts.join(' ')}"/>`);
    }
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke-linejoin="round">
      <g stroke="rgba(0,0,0,.55)" stroke-width="4">${lines.join('')}</g>
      <g stroke="rgba(255,255,255,.9)" stroke-width="1.6">${lines.join('')}</g></g></svg>`;
  })();
  function overlay(cls, ms, html) {
    const d = document.createElement('div'); d.className = cls; d.setAttribute('aria-hidden', 'true');
    if (html) d.innerHTML = html;
    document.body.appendChild(d); setTimeout(() => d.remove(), ms);
  }
  const EFFECTS = {
    confetti: (fx) => fx.confetti(130),
    fireworks: (fx) => {
      const w = innerWidth, h = innerHeight;
      [[0.25, 0.32], [0.75, 0.3], [0.5, 0.2]].forEach(([a, b], i) => setTimeout(() => {
        fx.explode(w * a, h * b, ['#ffd166', '#fbf7ee', '#7cc7ff', '#9be3b4', '#e8564d'], 90, 9); fx.ring(w * a, h * b, '#ffd166');
      }, i * 260));
    },
    sparkle: (fx) => { const [x, y] = fx.boardCenter(); fx.explode(x, y, ['#ffd166', '#fbf7ee'], 50, 6); },
    shine: (fx, ev, card) => { if (card) card.classList.add('rx-shine'); },
    fire: (fx) => {
      for (let i = 0; i < 90; i++) fx.particle({ x: Math.random() * innerWidth, y: innerHeight + 10, vx: (Math.random() - 0.5) * 1.2, vy: -(3 + Math.random() * 5),
        g: -0.02, drag: 0.99, max: 90 + Math.random() * 60, size: 2 + Math.random() * 4, color: pick(['#ff6b35', '#ffd166', '#e2b04f', '#c2312a']) });
    },
    gloom: () => overlay('rx-gloom', 1900),
    crack: () => overlay('rx-crack', 1300, CRACK),
    shake: (fx) => fx.shake(),
    flash: (fx) => fx.flash(),
  };

  /* ---------- audio (local files) ---------- */
  const buffers = {};
  function audioOut() { const fx = FX(); return fx && fx.audio ? fx.audio() : null; }
  function load(k) {
    if (buffers[k]) return buffers[k];
    const url = C.sounds && C.sounds[k];
    if (!url) return (buffers[k] = Promise.resolve(null));
    buffers[k] = (async () => {
      try {
        const o = audioOut(); if (!o || !o.ctx) throw new Error('no audio');
        const r = await fetch(url); if (!r.ok) throw new Error(r.status);
        const ab = await r.arrayBuffer();
        return await new Promise((res, rej) => o.ctx.decodeAudioData(ab, res, rej));
      } catch (e) { return { fallback: url }; }   // e.g. opened from file:// — use a plain <audio> instead
    })();
    return buffers[k];
  }
  function playSound(k) {
    const fx = FX();
    if (!fx || !fx.soundOn()) return;
    load(k).then((b) => {
      if (!b) return;
      if (b.fallback) { try { const a = new Audio(b.fallback); a.volume = Math.min(1, S.volume); a.play().catch(() => {}); } catch (e) {} return; }
      const o = audioOut(); if (!o || !o.ctx) return;
      const src = o.ctx.createBufferSource(), g = o.ctx.createGain();
      src.buffer = b; g.gain.value = S.volume; src.connect(g).connect(o.out || o.ctx.destination); src.start();
    });
  }
  // nothing to load while the Comedy Director has replaced the cards (only the Statistik test chips use these)
  function preload() { if (S.enabled === false) return; Object.keys(C.sounds || {}).forEach(load); }

  /* ---------- styles ---------- */
  const css = document.createElement('style');
  css.textContent = `
.rx-layer{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 74px);transform:translateX(-50%);z-index:48;display:grid;gap:8px;width:min(440px,calc(100vw - 32px));pointer-events:none}
.rx-card{position:relative;overflow:hidden;display:grid;grid-template-columns:64px minmax(0,1fr);gap:12px;align-items:center;padding:12px 16px 12px 10px;border-radius:16px;background:linear-gradient(180deg,#221c15,#15110d);border:3px solid var(--rx-c);box-shadow:0 6px 0 rgba(0,0,0,.45),0 18px 40px rgba(0,0,0,.45);color:#fff;transform:translateY(-34px) scale(.9);opacity:0;transition:transform .38s cubic-bezier(.2,1.5,.4,1),opacity .25s}
.rx-card.in{transform:none;opacity:1}
.rx-card.out{transform:translateY(-22px) scale(.96);opacity:0;transition-duration:.3s}
.rx-win{--rx-c:#e2b04f}.rx-lose{--rx-c:#8ea3b8}.rx-spicy{--rx-c:#ff7a45}.rx-legend{--rx-c:#9be3b4}
.rx-mascot svg{width:64px;height:auto;display:block;filter:drop-shadow(0 3px 0 rgba(0,0,0,.4))}
.rx-body{min-width:0}
.rx-title{font-family:var(--f-game,"Lilita One"),system-ui,sans-serif;font-size:25px;line-height:1.05;color:var(--rx-c);text-shadow:0 2px 0 #000}
.rx-text{margin:5px 0 0;font-size:14px;line-height:1.38;color:#f3efe6}
.rx-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:7px}
.rx-stat{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#bfb4a3}
.rx-tag{font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;background:rgba(255,255,255,.09);color:var(--rx-c)}
.rx-shine::after{content:"";position:absolute;top:-40%;bottom:-40%;left:-60%;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.45),transparent);transform:skewX(-20deg);animation:rxShine 1.1s .3s ease-out forwards}
@keyframes rxShine{to{left:130%}}
.rx-gloom{position:fixed;inset:0;z-index:41;pointer-events:none;background:radial-gradient(circle at 50% 40%,transparent 25%,rgba(8,12,20,.78));animation:rxGloom 1.9s ease forwards}
@keyframes rxGloom{0%{opacity:0}25%{opacity:1}100%{opacity:0}}
.rx-crack{position:fixed;inset:0;z-index:44;pointer-events:none;animation:rxCrack 1.3s ease forwards}
.rx-crack svg{width:100%;height:100%;display:block}
@keyframes rxCrack{0%{opacity:0}6%{opacity:1}70%{opacity:1}100%{opacity:0}}
@media (max-width:600px){.rx-layer{top:calc(env(safe-area-inset-top,0px) + 54px)}.rx-card{grid-template-columns:48px minmax(0,1fr);gap:10px}.rx-mascot svg{width:48px}.rx-title{font-size:21px}.rx-text{font-size:13px}}
@media (prefers-reduced-motion:reduce){.rx-card,.rx-card.in,.rx-card.out{transform:none;transition:opacity .2s}.rx-shine::after,.rx-gloom,.rx-crack{animation:none;display:none}}`;
  document.head.appendChild(css);

  /* ---------- wiring ---------- */
  if (window.CapsaEvents) {
    window.CapsaEvents.on('*', onEvent);
    window.CapsaEvents.on('fact:round:start', preload);
  }
  window.CapsaReactions = {
    settings: S,
    config: C,
    defineEffect: (name, fn) => { EFFECTS[name] = fn; },
    playSound,
    test(type, over) {
      const def = C.events && C.events[type];
      if (!def) return false;
      const ev = Object.assign({ type, name: 'Budi', winnerName: 'Ana', target: 'Ana', cardsLeft: 1, penalty: 12, streak: 4, deficit: 6, gap: 15 }, over || {});
      queue.push({ ev, def, tags: [] }); pump(); return true;
    },
  };
})();

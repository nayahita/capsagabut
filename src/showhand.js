/*
 * "Pamer kartu" (online only): show your own hand to the whole table, just to taunt.
 *   tap  → everyone sees your cards for 3 seconds
 *   hold → everyone sees them while you hold (up to 8 seconds)
 * Each press is also a 'reveal' fact, so the comedy memory knows who showed off (and how that ended).
 */
(function () {
  'use strict';
  const TAP_MS = 3000, MAX_MS = 8000, TAP_LIMIT = 300, COOLDOWN = 6000;
  const FX = () => window.CapsaFX;
  const shown = {};          // seat → { el, timer, id }
  let press = null, coolUntil = 0;

  function canShow() {
    const fx = FX(); if (!fx) return false;
    const v = fx.view();
    return v.online && v.me != null && ['turn', 'end'].includes(v.phase) && Array.isArray(v.hand) && v.hand.length > 0;
  }
  function start() {
    if (!canShow() || press || Date.now() < coolUntil) return;
    const v = FX().view(), id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const cards = v.hand.slice().sort((a, b) => a - b);
    press = { id, t: Date.now() };
    FX().broadcast('showhand', { id, seat: v.me, name: v.names[v.me], cards, ms: MAX_MS });
    FX().fact('reveal', { seat: v.me, name: v.names[v.me], count: cards.length, cards });
    syncBtn();
  }
  function stop() {
    if (!press) return;
    const p = press, held = Date.now() - p.t; press = null;
    const wait = held < TAP_LIMIT ? TAP_MS - held : 0;
    setTimeout(() => { const v = FX().view(); FX().broadcast('showhand-end', { id: p.id, seat: v.me }); }, wait);
    coolUntil = Date.now() + wait + COOLDOWN;
    syncBtn(); setTimeout(syncBtn, wait + COOLDOWN + 50);
  }
  function syncBtn() {
    const b = document.querySelector('[data-showhand]'); if (!b) return;
    const cool = Date.now() < coolUntil && !press;
    b.disabled = cool; b.setAttribute('aria-pressed', !!press);
    b.textContent = press ? 'Lagi pamer…' : cool ? 'Bentar…' : 'Pamer kartu';
  }

  // release is watched on the document: the core may redraw the button while it is held
  ['pointerup', 'pointercancel'].forEach((t) => document.addEventListener(t, () => { if (press) stop(); }));
  document.addEventListener('keyup', (e) => { if (press && (e.key === 'Enter' || e.key === ' ')) stop(); });
  addEventListener('blur', () => { if (press) stop(); });

  document.addEventListener('capsa:render', () => {
    const head = document.querySelector('.zone .zone-head');
    if (!canShow() || !head) { if (press) stop(); return; }
    if (head.querySelector('[data-showhand]')) return syncBtn();
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn showhand-btn'; b.dataset.showhand = '1';
    b.title = 'Tap: semua orang lihat kartu lu 3 detik. Tahan: selama ditahan.';
    b.setAttribute('aria-label', 'Pamer kartu ke semua pemain');
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) {} start(); });
    b.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); start(); } });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    head.appendChild(b); syncBtn();
  });

  /* every phone: draw the shown hand under that player's seat */
  function hide(seat, id) {
    const s = shown[seat]; if (!s || (id && s.id !== id)) return;
    clearTimeout(s.timer); s.el.classList.add('out'); setTimeout(() => s.el.remove(), 250); delete shown[seat];
  }
  function show(d) {
    const fx = FX(); if (!fx || d.seat == null) return;
    hide(d.seat);
    const seat = document.getElementById('seat-' + d.seat), r = seat ? seat.getBoundingClientRect() : null;
    const el = document.createElement('div');
    el.className = 'showhand'; el.setAttribute('role', 'status');
    el.innerHTML = `<div class="sh-head"><b></b> pamer kartu · ${d.cards.length}</div><div class="sh-cards">${d.cards.map((c) => fx.cardHTML(c)).join('')}</div>`;
    el.querySelector('b').textContent = d.name || '';
    document.body.appendChild(el);
    const w = el.offsetWidth, x = r ? r.left + r.width / 2 : innerWidth / 2;
    el.style.left = Math.min(Math.max(x - w / 2, 8), innerWidth - w - 8) + 'px';
    el.style.top = (r ? Math.min(r.bottom + 6, innerHeight - el.offsetHeight - 8) : 80) + 'px';
    shown[d.seat] = { el, id: d.id, timer: setTimeout(() => hide(d.seat, d.id), Math.min(d.ms || MAX_MS, MAX_MS) + 300) };
  }
  document.addEventListener('capsa:mod', (e) => {
    const t = e.detail && e.detail.type, d = e.detail && e.detail.data; if (!d) return;
    if (t === 'showhand') show(d);
    else if (t === 'showhand-end') hide(d.seat, d.id);
  });
  document.addEventListener('capsa:render', () => {
    const v = FX() && FX().view();
    if (!v || !v.online || !['turn', 'end'].includes(v.phase)) Object.keys(shown).forEach((s) => hide(+s));
  });

  const css = document.createElement('style');
  css.textContent = `
.showhand-btn{margin-left:auto;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.showhand-btn[aria-pressed="true"]{border-color:#e2b04f;color:#e2b04f}
.showhand{position:fixed;z-index:48;max-width:calc(100vw - 16px);background:rgba(8,22,15,.94);border:1px solid #e2b04f;border-radius:12px;padding:8px 10px;box-shadow:0 10px 26px rgba(0,0,0,.5);animation:shIn .22s ease-out both;transition:opacity .25s;pointer-events:none}
.showhand.out{opacity:0}
.sh-head{font:500 12px/1.2 Rubik,system-ui,sans-serif;color:#9dbcae;margin-bottom:6px}.sh-head b{color:#e2b04f}
.sh-cards{display:flex;--cw:34px}.sh-cards .card{margin-left:-12px;box-shadow:-2px 0 4px rgba(0,0,0,.35)}.sh-cards .card:first-child{margin-left:0}
@keyframes shIn{from{transform:translateY(-6px);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.showhand{animation:none}}`;
  document.head.appendChild(css);
})();

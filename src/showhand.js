/*
 * "Show cards" / "Pamer kartu" (online only): show your own hand to the whole table, just to taunt.
 * Works like a scope button in mobile shooters:
 *   tap  (press < 0.25 s) → cards stay shown; tap again to hide
 *   hold                   → cards shown while you hold; release to hide
 *   pressing while shown   → hides on release
 * No cooldown. Network updates are coalesced (≤ 5 per second); a shown hand is kept alive every 4 s, so if a
 * phone drops out its cards disappear from everyone's screen by themselves.
 * The first show in a round is also a 'reveal' fact, so the comedy memory knows who showed off.
 */
(function () {
  'use strict';
  const TAP_LIMIT = 250, KEEPALIVE = 4000, TTL = 7000, MIN_GAP = 200;
  const FX = () => window.CapsaFX;
  const shown = {};            // receiver side: seat → { el, timer, id, sig }
  let mode = 'off';            // sender side: 'off' | 'hold' | 'latched'
  let press = null;            // { t, wasLatched }
  let cur = null;              // { id, sig } of what we are showing
  let lastSent = 0, pending = null, keep = 0, revealedRound = null;

  function view() { const fx = FX(); return fx ? fx.view() : null; }
  function canShow() {
    const v = view();
    return !!(v && v.online && v.me != null && ['turn', 'end'].includes(v.phase) && Array.isArray(v.hand) && v.hand.length > 0);
  }
  const sigOf = (cards) => cards.join(',');

  /* ---------- sending (coalesced) ---------- */
  function want(on) { pending = on; flush(); }
  function flush() {
    if (pending == null) return;
    const wait = lastSent + MIN_GAP - Date.now();
    if (wait > 0) { clearTimeout(flush.t); flush.t = setTimeout(flush, wait); return; }
    const on = pending; pending = null; lastSent = Date.now();
    const v = view(); if (!v || v.me == null) return;
    if (on && canShow()) {
      const cards = v.hand.slice().sort((a, b) => a - b), sig = sigOf(cards);
      if (!cur) cur = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), sig: '' };
      if (cur.sig !== sig || on === 'keep') {
        cur.sig = sig;
        FX().broadcast('showhand', { id: cur.id, seat: v.me, name: v.names[v.me], cards, ms: TTL });
        if (revealedRound !== v.round) { revealedRound = v.round; FX().fact('reveal', { seat: v.me, name: v.names[v.me], count: cards.length, cards }); }
      }
      clearInterval(keep); keep = setInterval(() => { if (mode !== 'off') want('keep'); else clearInterval(keep); }, KEEPALIVE);
    } else if (cur) {
      FX().broadcast('showhand-end', { id: cur.id, seat: v.me });
      cur = null; clearInterval(keep);
    }
  }

  /* ---------- input: tap / hold ---------- */
  function down() {
    if (!canShow() || press) return;
    press = { t: Date.now(), wasLatched: mode === 'latched' };
    if (mode === 'off') { mode = 'hold'; want(true); }
    syncBtn();
  }
  function up() {
    if (!press) return;
    const held = Date.now() - press.t, wasLatched = press.wasLatched; press = null;
    if (wasLatched) mode = 'off';                       // any press while shown closes it
    else mode = held < TAP_LIMIT ? 'latched' : 'off';   // quick tap keeps it open, hold closes on release
    want(mode !== 'off');
    syncBtn();
  }
  function forceOff() { if (mode !== 'off' || cur) { mode = 'off'; press = null; want(false); syncBtn(); } }

  function syncBtn() {
    const b = document.querySelector('[data-showhand]'); if (!b) return;
    const on = mode !== 'off';
    b.setAttribute('aria-pressed', on);
    b.textContent = mode === 'hold' ? tr('Showing…', 'Lagi pamer…') : mode === 'latched' ? tr('Hide cards', 'Tutup kartu') : tr('Show cards', 'Pamer kartu');
    b.title = tr('Tap: your cards stay shown until you tap again. Hold: shown while you hold.', 'Tap: kartu lu kebuka sampai lu tap lagi. Tahan: kebuka selama ditahan.');
    b.setAttribute('aria-label', tr('Show your cards to everyone', 'Pamer kartu ke semua pemain'));
  }

  // release is watched on the document: the core may redraw the button while it is held
  ['pointerup', 'pointercancel'].forEach((t) => document.addEventListener(t, up));
  document.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') up(); });
  addEventListener('blur', () => { if (press) up(); });

  document.addEventListener('capsa:render', () => {
    const head = document.querySelector('.zone .zone-head');
    if (!canShow()) { forceOff(); return; }
    if (mode !== 'off') want(true);                     // the hand changed (a card was played): resend if different
    if (!head) return;
    if (head.querySelector('[data-showhand]')) return syncBtn();
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn showhand-btn'; b.dataset.showhand = '1';
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) {} down(); });
    b.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); down(); } });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    head.appendChild(b); syncBtn();
  });

  /* ---------- every phone: draw the shown hand under that player's seat ---------- */
  function hide(seat, id) {
    const s = shown[seat]; if (!s || (id && s.id !== id)) return;
    clearTimeout(s.timer); s.el.classList.add('out'); setTimeout(() => s.el.remove(), 250); delete shown[seat];
  }
  function place(el, seatNo) {
    const seat = document.getElementById('seat-' + seatNo), r = seat ? seat.getBoundingClientRect() : null;
    const w = el.offsetWidth, x = r ? r.left + r.width / 2 : innerWidth / 2;
    el.style.left = Math.min(Math.max(x - w / 2, 8), innerWidth - w - 8) + 'px';
    el.style.top = (r ? Math.min(r.bottom + 6, innerHeight - el.offsetHeight - 8) : 80) + 'px';
  }
  const shLabel = () => tr('is showing off', 'pamer kartu');
  function show(d) {
    const fx = FX(); if (!fx || d.seat == null || !Array.isArray(d.cards)) return;
    const cards = d.cards.filter((c) => Number.isInteger(c) && c >= 0 && c < 52).slice(0, 13);
    const sig = sigOf(cards), s = shown[d.seat];
    const ttl = Math.min(Math.max(+d.ms || TTL, 1000), TTL) + 500;
    if (s && s.id === d.id) {                           // same show: refresh cards / lifetime in place
      if (s.sig !== sig) { s.sig = sig; s.el.querySelector('.sh-cards').innerHTML = cards.map((c) => fx.cardHTML(c)).join(''); s.el.querySelector('.sh-n').textContent = cards.length; }
      clearTimeout(s.timer); s.timer = setTimeout(() => hide(d.seat, d.id), ttl);
      return;
    }
    hide(d.seat);
    const el = document.createElement('div');
    el.className = 'showhand'; el.setAttribute('role', 'status');
    el.innerHTML = `<div class="sh-head"><b></b> <span class="sh-lbl">${shLabel()}</span> · <span class="sh-n">${cards.length}</span></div><div class="sh-cards">${cards.map((c) => fx.cardHTML(c)).join('')}</div>`;
    el.querySelector('b').textContent = d.name || '';
    document.body.appendChild(el); place(el, d.seat);
    shown[d.seat] = { el, id: d.id, sig, timer: setTimeout(() => hide(d.seat, d.id), ttl) };
  }
  document.addEventListener('capsa:mod', (e) => {
    const t = e.detail && e.detail.type, d = e.detail && e.detail.data; if (!d) return;
    if (t === 'showhand') show(d);
    else if (t === 'showhand-end') hide(d.seat, d.id);
  });
  // language switched on this phone: the button and any hand on screen follow
  document.addEventListener('capsa:lang', () => {
    syncBtn();
    Object.keys(shown).forEach((s) => { const l = shown[s].el.querySelector('.sh-lbl'); if (l) l.textContent = shLabel(); });
  });
  document.addEventListener('capsa:render', () => {
    const v = view();
    if (!v || !v.online || !['turn', 'end'].includes(v.phase)) Object.keys(shown).forEach((s) => hide(+s));
    else Object.keys(shown).forEach((s) => place(shown[s].el, +s));
  });

  const css = document.createElement('style');
  css.textContent = `
.showhand-btn{margin-left:auto;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.showhand-btn[aria-pressed="true"]{border-color:#e2b04f;color:#1a1206;background:#e2b04f}
.showhand{position:fixed;z-index:48;max-width:calc(100vw - 16px);background:rgba(8,22,15,.94);border:1px solid #e2b04f;border-radius:12px;padding:8px 10px;box-shadow:0 10px 26px rgba(0,0,0,.5);animation:shIn .16s ease-out both;transition:opacity .2s;pointer-events:none}
.showhand.out{opacity:0}
.sh-head{font:500 12px/1.2 Rubik,system-ui,sans-serif;color:#9dbcae;margin-bottom:6px}.sh-head b{color:#e2b04f}
.sh-cards{display:flex;--cw:34px}.sh-cards .card{margin-left:-12px;box-shadow:-2px 0 4px rgba(0,0,0,.35)}.sh-cards .card:first-child{margin-left:0}
@media (max-width:600px){.showhand-btn{padding:4px 10px;font-size:12px}.sh-cards{--cw:28px}.sh-cards .card{margin-left:-11px}}
@keyframes shIn{from{transform:translateY(-6px);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.showhand{animation:none}}`;
  document.head.appendChild(css);
  window.CapsaShowHand = { state: () => mode };
})();

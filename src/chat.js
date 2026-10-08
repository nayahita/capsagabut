/*
 * Quick chat: preset lines, shown as a bubble at the speaker's seat on every phone.
 * Sends a 'chat' fact; lines marked `trash` are remembered so the comedy layer can bring them back later.
 * Edit PRESETS freely.
 */
(function () {
  'use strict';
  const PRESETS = [
    { id: 'ez', text: 'EZ', trash: true },
    { id: 'santai', text: 'Santai, masih panjang', trash: true },
    { id: 'punya', text: 'Ronde ini punya gua', trash: true },
    { id: 'hoki', text: 'Hoki doang itu', trash: true },
    { id: 'awas', text: 'Awas lu ya', trash: true },
    { id: 'wkwk', text: 'WKWKWK', trash: true },
    { id: 'gg', text: 'GG', trash: false },
    { id: 'sabar', text: 'Sabar…', trash: false },
    { id: 'kok', text: 'Kok gitu sih', trash: false },
    { id: 'ampun', text: 'Ampun bang', trash: false },
  ];
  const FX = () => window.CapsaFX;
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  let open = false, speaker = null;
  const cool = {};

  function sheet() {
    let el = document.querySelector('.chat-sheet');
    if (!open) { if (el) el.remove(); return; }
    const v = FX().view();
    if (!el) { el = document.createElement('div'); el.className = 'chat-sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Chat cepat'); document.body.appendChild(el); }
    if (speaker == null || speaker >= (v.names || []).length) speaker = v.online ? v.me : v.turn;
    el.innerHTML = `${v.online ? '' : `<div class="chat-row"><span class="chat-lbl">Yang ngomong</span>${v.names.map((n, i) => `<button class="chip" data-chat-seat="${i}" aria-pressed="${i === speaker}">${esc(n)}</button>`).join('')}</div>`}
      <div class="chat-row">${PRESETS.map((p) => `<button class="chip${p.trash ? ' chat-trash' : ''}" data-chat-say="${p.id}">${esc(p.text)}</button>`).join('')}</div>
      <button class="btn" data-chat-close>Tutup</button>`;
  }
  function say(id) {
    const p = PRESETS.find((x) => x.id === id), v = FX().view();
    if (!p || !v.names || !v.names.length) return;
    const seat = v.online ? v.me : speaker;
    if (seat == null || (cool[seat] || 0) > Date.now()) return;
    cool[seat] = Date.now() + 2500;
    FX().fact('chat', { seat, name: v.names[seat], text: p.text, preset: p.id, trash: p.trash });
    open = false; sheet(); syncBtn();
  }
  function syncBtn() { const b = document.querySelector('[data-chat-toggle]'); if (b) { b.textContent = open ? 'Tutup chat' : 'Chat'; b.setAttribute('aria-expanded', open); } }

  document.addEventListener('capsa:render', () => {
    const fx = FX(); if (!fx) return;
    const v = fx.view(), playing = ['turn', 'handoff', 'end'].includes(v.phase);
    if (!playing) { open = false; sheet(); return; }
    const top = document.querySelector('.top-actions');
    if (top && !top.querySelector('[data-chat-toggle]')) {
      const b = document.createElement('button'); b.className = 'btn'; b.dataset.chatToggle = '1';
      top.insertBefore(b, top.firstChild); syncBtn();
    }
    if (open) sheet();
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-chat-toggle],[data-chat-say],[data-chat-seat],[data-chat-close]');
    if (!t) return;
    e.stopPropagation();
    if (t.dataset.chatToggle) { open = !open; sheet(); syncBtn(); }
    else if (t.dataset.chatClose != null) { open = false; sheet(); syncBtn(); }
    else if (t.dataset.chatSeat != null) { speaker = +t.dataset.chatSeat; sheet(); }
    else if (t.dataset.chatSay) say(t.dataset.chatSay);
  }, true);

  // bubble on every phone
  if (window.CapsaEvents) window.CapsaEvents.on('fact:chat', (d) => {
    const s = document.getElementById('seat-' + d.seat);
    const r = s ? s.getBoundingClientRect() : { left: innerWidth / 2 - 50, width: 100, bottom: innerHeight / 3 };
    const b = document.createElement('div'); b.className = 'chat-bubble'; b.textContent = d.text;
    b.style.left = Math.min(Math.max(r.left + r.width / 2, 70), innerWidth - 70) + 'px'; b.style.top = (r.bottom + 6) + 'px';
    document.body.appendChild(b); setTimeout(() => b.classList.add('out'), 2600); setTimeout(() => b.remove(), 3000);
  });

  const css = document.createElement('style');
  css.textContent = `
.chat-sheet{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);transform:translateX(-50%);z-index:55;width:min(520px,calc(100vw - 24px));background:#0f241f;border:1px solid #e2b04f;border-radius:16px;padding:12px;display:grid;gap:10px;box-shadow:0 16px 40px rgba(0,0,0,.5);color:#eef3ea}
.chat-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.chat-lbl{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#9dbcae;margin-right:4px}
.chat-sheet .chip[aria-pressed="true"]{border-color:#e2b04f;color:#e2b04f}
.chat-trash{border-color:rgba(255,122,69,.55)}
.chat-sheet .btn{justify-self:end}
.chat-bubble{position:fixed;z-index:47;transform:translateX(-50%);background:#fff;color:#111;font:700 15px/1.2 Rubik,system-ui,sans-serif;padding:7px 12px;border-radius:12px;box-shadow:0 3px 0 rgba(0,0,0,.35);pointer-events:none;white-space:nowrap;animation:chatIn .3s cubic-bezier(.2,1.5,.4,1) both;transition:opacity .35s}
.chat-bubble.out{opacity:0}
@keyframes chatIn{from{transform:translateX(-50%) translateY(8px) scale(.7);opacity:0}to{transform:translateX(-50%);opacity:1}}`;
  document.head.appendChild(css);
})();

/*
 * Chat to the whole table: free text (60 chars) and "Colek" (poke one player). Ready-made lines, emotes and voice lines
 * are the quick chat in src/social/ (validated ids only); this sheet is the separate free-text channel.
 * Every line becomes a 'chat' fact, so it shows on every phone and the comedy layer can remember it.
 * Free text is the one social input that carries player-typed text: it is trimmed to 60 chars, optionally censored,
 * clamped again on arrival and only ever inserted with textContent.
 *
 * Everything below in CONFIG is meant to be edited: presets, keyword lists, the sensor word list.
 * Players type in whatever language they like, so the keyword and sensor lists hold English and Indonesian words.
 * Labels the comedy layer reads:
 *   trash      – taunting / boasting ("EZ", "too easy", "punya gua")   → can come back if it ages badly
 *   prediction – a claim about the future ("gonna win", "menang")      → resolved at round end
 *   confession – admitting something ("my bad", "salah", "nyesel")     → saved as a match moment
 *   target     – seat that was poked with Colek
 */
(function () {
  'use strict';
  const CONFIG = {
    maxLen: 60,
    cooldownMs: 3000,
    logSize: 20,
    // ready-made lines moved to quick chat (src/social/catalog.js, the "Emote" button); add free-text presets here if wanted
    presets: [],
    // poke lines are said in the sender's language (like typed text): { en, id }
    pokeLines: [{ en: 'your turn, bro', id: 'giliran lu tuh' }, { en: 'not so fast', id: 'tahan dulu kartunya' }, { en: 'you sure?', id: 'yakin?' }, { en: "I'm watching you", id: 'gua liatin lu' }],
    // lower-case substrings; a match sets the label
    keywords: {
      trash: ['ez', 'gampang', 'cupu', 'noob', 'lemah', 'wkwk', 'kasian', 'kasihan', 'payah', 'gg ez', 'bocil', 'santai',
        'trash', 'too easy', 'lol', 'lmao', 'rekt', 'skill issue', 'git gud', 'is that all'],
      prediction: ['menang', 'punya gua', 'punya gue', 'pasti', 'liat aja', 'lihat aja', 'bentar lagi', 'abis ini', 'habis ini', 'nanti',
        'watch', 'gonna win', 'mine', 'next round', 'just wait', 'i got this', 'wait for it'],
      confession: ['salah', 'nyesel', 'menyesal', 'lupa', 'kepencet', 'harusnya', 'maaf', 'sorry', 'ampun', 'ga sengaja', 'gak sengaja',
        'my bad', 'oops', 'misclick', 'my fault', 'mistake', 'should have', "should've"],
    },
    // sensor (on by default; each phone can turn it off). Matching whole words, case-insensitive.
    sensorWords: ['anjing', 'anjir', 'bangsat', 'babi', 'kontol', 'memek', 'ngentot', 'goblok', 'tolol', 'bego', 'jancok', 'asu', 'tai',
      'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'cunt', 'pussy', 'whore', 'slut'],
  };

  const FX = () => window.CapsaFX;
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const pick = (v) => (window.CapsaI18n ? window.CapsaI18n.pick(v) : v);
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  let open = false, speaker = null, target = null, unread = 0;
  let sensor = store.get('capsa.chat.sensor', true);
  const cool = {}, log = [];

  /* ---------- text helpers ---------- */
  const has = (t, list) => list.some((w) => (w.length <= 3 ? new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(t) : t.includes(w)));
  function labels(text, preset) {
    const t = text.toLowerCase(), K = CONFIG.keywords;
    return {
      trash: !!(preset ? preset.trash : has(t, K.trash)),
      prediction: !!(preset ? preset.prediction : has(t, K.prediction)),
      confession: !!(preset ? preset.confession : has(t, K.confession)),
    };
  }
  function censor(text) {
    if (!sensor) return text;
    const re = new RegExp(`(^|[^a-zA-Z])(${CONFIG.sensorWords.join('|')})(?=[^a-zA-Z]|$)`, 'gi');
    return text.replace(re, (m, pre, w) => pre + w[0] + '*'.repeat(Math.max(2, w.length - 1)));
  }

  /* ---------- sending ---------- */
  function mySeat(v) { return v.online ? v.me : speaker; }
  function send(raw, preset) {
    const fx = FX(); if (!fx) return false;
    const v = fx.view(); if (!v.names || !v.names.length) return false;
    const seat = mySeat(v);
    if (seat == null) return false;
    const now = Date.now();
    if ((cool[seat] || 0) > now) { { const sec = Math.ceil((cool[seat] - now) / 1000); flash(tr(`Wait ${sec}s.`, `Tunggu ${sec} detik.`)); } return false; }
    let text = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, CONFIG.maxLen);
    if (!text) return false;
    text = censor(text);
    let tgt = target != null && target !== seat && target < v.names.length ? target : null;
    if (tgt == null && text.startsWith('@')) {   // typed "@Name …" by hand counts as a poke too
      const low = text.slice(1).toLowerCase();
      const i = v.names.findIndex((n, k) => k !== seat && low.startsWith(String(n).toLowerCase()));
      if (i >= 0) tgt = i;
    }
    const shown = tgt != null && !text.startsWith('@') ? `@${v.names[tgt]} ${text}`.slice(0, CONFIG.maxLen + 20) : text;
    cool[seat] = now + CONFIG.cooldownMs;
    fx.fact('chat', { seat, name: v.names[seat], text: shown, target: tgt, counts: (v.counts || []).slice(), ...labels(text, preset) });
    target = null;
    return true;
  }

  /* ---------- sheet (built once while open; only parts refresh so typing isn't interrupted) ---------- */
  function build() {
    const el = document.createElement('div');
    el.className = 'chat-sheet'; el.setAttribute('role', 'dialog');
    el.innerHTML = `<div class="chat-log" aria-live="polite"></div>
      <div class="chat-row chat-speaker"></div>
      <div class="chat-row chat-poke"></div>
      <div class="chat-row chat-presets"></div>
      <form class="chat-form"><input type="text" maxlength="${CONFIG.maxLen}" autocomplete="off" enterkeyhint="send"><button type="submit" class="btn primary"></button></form>
      <div class="chat-foot"><label class="chat-sensor"><input type="checkbox"${sensor ? ' checked' : ''}> <span></span></label><span class="chat-msg" role="status"></span><button type="button" class="btn" data-chat-close></button></div>`;
    relabel(el);
    el.querySelector('.chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = el.querySelector('.chat-form input');
      if (send(inp.value)) { inp.value = ''; refresh(); }
    });
    el.querySelector('.chat-sensor input').addEventListener('change', (e) => { sensor = e.target.checked; store.set('capsa.chat.sensor', sensor); });
    document.body.appendChild(el);
    return el;
  }
  // the fixed texts of the sheet, in this phone's language (again on 'capsa:lang', without touching what is being typed)
  function relabel(el) {
    el.setAttribute('aria-label', tr('Table chat', 'Chat meja'));
    el.querySelector('.chat-presets').innerHTML = CONFIG.presets.map((p, i) => `<button type="button" class="chip${p.trash ? ' chat-trash' : ''}" data-chat-say="${i}">${esc(pick(p.text))}</button>`).join('');
    const inp = el.querySelector('.chat-form input');
    inp.placeholder = tr('Message everyone…', 'Tulis ke semua pemain…'); inp.setAttribute('aria-label', tr('Message', 'Pesan'));
    el.querySelector('.chat-form button').textContent = tr('Send', 'Kirim');
    el.querySelector('.chat-sensor span').textContent = tr('Filter bad words', 'Sensor kata kasar');
    el.querySelector('[data-chat-close]').textContent = tr('Close', 'Tutup');
  }
  function refresh() {
    let el = document.querySelector('.chat-sheet');
    if (!open) { if (el) el.remove(); return; }
    const fx = FX(); if (!fx) return;
    const v = fx.view(), names = v.names || [];
    if (!el) { el = build(); setTimeout(() => { const i = el.querySelector('.chat-form input'); if (i && matchMedia('(pointer:fine)').matches) i.focus(); }, 30); }
    if (speaker == null || speaker >= names.length) speaker = v.online ? v.me : v.turn;
    const me = mySeat(v);
    el.querySelector('.chat-speaker').innerHTML = v.online ? '' :
      `<span class="chat-lbl">${tr('Speaker', 'Yang ngomong')}</span>${names.map((n, i) => `<button type="button" class="chip" data-chat-seat="${i}" aria-pressed="${i === speaker}">${esc(n)}</button>`).join('')}`;
    el.querySelector('.chat-poke').innerHTML = `<span class="chat-lbl">${tr('Poke', 'Colek')}</span>${names.map((n, i) => (i === me ? '' :
      `<button type="button" class="chip chat-poke-btn" data-chat-poke="${i}" aria-pressed="${i === target}">@${esc(n)}</button>`)).join('')}
      ${target != null ? CONFIG.pokeLines.map((l, i) => `<button type="button" class="chip" data-chat-pokeline="${i}">${esc(pick(l))}</button>`).join('') : ''}`;
    const lg = el.querySelector('.chat-log');
    lg.innerHTML = log.length ? log.map((m) => `<div class="chat-line"><b>${esc(m.name)}</b> ${esc(pick(m.text))}</div>`).join('') : `<div class="chat-empty">${tr('No messages yet.', 'Belum ada obrolan.')}</div>`;
    lg.scrollTop = lg.scrollHeight;
    unread = 0; syncBtn();
  }
  let flashT = 0;
  function flash(t) {
    const m = document.querySelector('.chat-sheet .chat-msg'); if (!m) return;
    m.textContent = t; clearTimeout(flashT); flashT = setTimeout(() => { m.textContent = ''; }, 2000);
  }
  function syncBtn() {
    const b = document.querySelector('[data-chat-toggle]'); if (!b) return;
    b.innerHTML = (open ? tr('Close chat', 'Tutup chat') : tr('Chat', 'Chat')) + (unread && !open ? ` <span class="chat-badge">${unread}</span>` : '');
    b.setAttribute('aria-expanded', open);
  }

  document.addEventListener('capsa:render', () => {
    const fx = FX(); if (!fx) return;
    const v = fx.view(), playing = ['turn', 'handoff', 'end'].includes(v.phase);
    if (!playing) { open = false; refresh(); return; }
    const top = document.querySelector('.top-actions');
    if (top && !top.querySelector('[data-chat-toggle]')) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.dataset.chatToggle = '1';
      top.insertBefore(b, top.firstChild); syncBtn();
    }
    if (open) refresh();
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-chat-toggle],[data-chat-say],[data-chat-seat],[data-chat-close],[data-chat-poke],[data-chat-pokeline]');
    if (!t) return;
    e.stopPropagation();
    const d = t.dataset;
    if (d.chatToggle) { open = !open; refresh(); syncBtn(); }
    else if (d.chatClose != null) { open = false; refresh(); syncBtn(); }
    else if (d.chatSeat != null) { speaker = +d.chatSeat; if (target === speaker) target = null; refresh(); }
    else if (d.chatPoke != null) { target = target === +d.chatPoke ? null : +d.chatPoke; refresh(); }
    else if (d.chatPokeline != null) { if (send(pick(CONFIG.pokeLines[+d.chatPokeline]))) refresh(); }
    else if (d.chatSay != null) { const p = CONFIG.presets[+d.chatSay]; if (p && send(pick(p.text), p)) refresh(); }
  }, true);

  /* ---------- every phone: log, bubble, poke line ---------- */
  function seatRect(i) {
    const s = document.getElementById('seat-' + i);
    return s ? s.getBoundingClientRect() : null;
  }
  if (window.CapsaEvents) window.CapsaEvents.on('fact:chat', (d) => {
    if (!d || typeof d.text !== 'string') return;
    const S = window.CapsaSocial, hide = !!(S && d.seat != null && S.hidden(d.seat));
    d = Object.assign({}, d, { text: d.text.slice(0, CONFIG.maxLen + 24), name: String(d.name || '').slice(0, 24) });
    if (hide && S.isMuted(d.seat)) return;                       // muted on this phone: not in the log either
    // quick chat built on this phone carries both languages (texts), so the log follows a language switch
    const both = window.CapsaI18n && window.CapsaI18n.isPair(d.texts) ? { en: String(d.texts.en || d.text).slice(0, CONFIG.maxLen + 24), id: String(d.texts.id || d.text).slice(0, CONFIG.maxLen + 24) } : null;
    log.push({ name: d.name, text: both || d.text }); if (log.length > CONFIG.logSize) log.shift();
    if (open) refresh(); else if (!d.qc) { unread = Math.min(9, unread + 1); syncBtn(); }
    if (d.qc || hide) return;                                    // quick chat draws its own bubble (src/social)
    const r = seatRect(d.seat) || { left: innerWidth / 2 - 50, width: 100, top: innerHeight / 3 - 40, height: 40, bottom: innerHeight / 3 };
    const b = document.createElement('div'); b.className = 'chat-bubble'; b.textContent = d.text;
    b.style.top = (r.bottom + 6) + 'px';
    document.body.appendChild(b);
    const half = b.offsetWidth / 2 + 8;
    b.style.left = Math.min(Math.max(r.left + r.width / 2, half), innerWidth - half) + 'px';
    const ms = Math.min(5000, 2400 + d.text.length * 40);
    setTimeout(() => b.classList.add('out'), ms); setTimeout(() => b.remove(), ms + 400);
    if (d.target != null) {
      const t = seatRect(d.target);
      if (t) {
        const x1 = r.left + r.width / 2, y1 = r.top + r.height / 2, x2 = t.left + t.width / 2, y2 = t.top + t.height / 2;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'chat-poke-line'); svg.setAttribute('aria-hidden', 'true');
        svg.innerHTML = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><circle cx="${x2}" cy="${y2}" r="7"/>`;
        document.body.appendChild(svg);
        setTimeout(() => svg.classList.add('out'), 1600); setTimeout(() => svg.remove(), 2000);
        const ts = document.getElementById('seat-' + d.target);
        if (ts) { ts.classList.add('chat-poked'); setTimeout(() => ts.classList.remove('chat-poked'), 900); }
      }
    }
  });
  if (window.CapsaEvents) window.CapsaEvents.on('fact:game:start', () => { log.length = 0; unread = 0; syncBtn(); });
  document.addEventListener('capsa:lang', () => {
    syncBtn();
    const el = document.querySelector('.chat-sheet'); if (el && open) { relabel(el); refresh(); }
  });

  const css = document.createElement('style');
  css.textContent = `
.chat-sheet{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);transform:translateX(-50%);z-index:55;width:min(540px,calc(100vw - 24px));max-height:calc(100dvh - 90px);overflow:auto;background:#0f241f;border:1px solid #e2b04f;border-radius:16px;padding:12px;display:grid;gap:10px;box-shadow:0 16px 40px rgba(0,0,0,.5);color:#eef3ea}
.chat-log{max-height:150px;overflow:auto;background:rgba(0,0,0,.22);border-radius:10px;padding:8px 10px;font-size:13px;line-height:1.45}
.chat-line b{color:#e2b04f;font-weight:600}
.chat-empty{color:#9dbcae;font-style:italic}
.chat-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.chat-row:empty{display:none}
.chat-lbl{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#9dbcae;margin-right:4px}
.chat-sheet .chip[aria-pressed="true"]{border-color:#e2b04f;color:#e2b04f}
.chat-trash{border-color:rgba(255,122,69,.55)}
.chat-form{display:flex;gap:6px}
.chat-form input{flex:1;min-width:0;background:#08160f;border:1px solid #2f5a4b;border-radius:10px;color:#eef3ea;padding:9px 10px;font:inherit;font-size:16px}
.chat-form input:focus{outline:2px solid #e2b04f;outline-offset:1px}
.chat-foot{display:flex;align-items:center;gap:10px}
.chat-sensor{font-size:12px;color:#9dbcae;display:flex;gap:6px;align-items:center}
.chat-msg{flex:1;font-size:12px;color:#ff9b73}
.chat-badge{display:inline-grid;place-items:center;min-width:18px;height:18px;border-radius:9px;background:#d1262b;color:#fff;font-size:11px;margin-left:4px}
.chat-bubble{position:fixed;z-index:47;transform:translateX(-50%);background:#fff;color:#111;font:700 15px/1.2 Rubik,system-ui,sans-serif;padding:7px 12px;border-radius:12px;box-shadow:0 3px 0 rgba(0,0,0,.35);pointer-events:none;max-width:min(260px,70vw);text-align:center;animation:chatIn .3s cubic-bezier(.2,1.5,.4,1) both;transition:opacity .35s}
.chat-bubble.out{opacity:0}
.chat-poke-line{position:fixed;inset:0;width:100vw;height:100vh;z-index:46;pointer-events:none;transition:opacity .4s}
.chat-poke-line line{stroke:#e2b04f;stroke-width:2;stroke-dasharray:6 6;animation:chatDash .6s linear infinite}
.chat-poke-line circle{fill:none;stroke:#e2b04f;stroke-width:2}
.chat-poke-line.out{opacity:0}
.chat-poked{animation:chatPoke .45s ease 2}
@keyframes chatIn{from{transform:translateX(-50%) translateY(8px) scale(.7);opacity:0}to{transform:translateX(-50%);opacity:1}}
@keyframes chatDash{to{stroke-dashoffset:-12}}
@keyframes chatPoke{0%,100%{transform:none}30%{transform:translateX(-4px)}60%{transform:translateX(4px)}}
@media (prefers-reduced-motion:reduce){.chat-bubble,.chat-poke-line line,.chat-poked{animation:none}}`;
  document.head.appendChild(css);

  window.CapsaChat = { send, config: CONFIG };
})();

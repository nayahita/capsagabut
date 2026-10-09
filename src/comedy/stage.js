/*
 * Stage: plays a director performance (a list of timeline steps) on this phone.
 * Also: reputation titles and bounty tag on seats, the post-match roast summary, and preview buttons.
 * Everything renders in its own layer; nothing here reads or changes game rules.
 * Text drawn here is local to this phone, so it is resolved with tr() at render time (English / Indonesian).
 */
(function () {
  'use strict';
  const C = window.CAPSA_COMEDY || { sounds: {} };
  const FX = () => window.CapsaFX;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms || 0)));
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nextOf = (s) => (window.CapsaComedy ? window.CapsaComedy.nextOf(s) : (s.ms || 0));
  const I18N = () => window.CapsaI18n;
  const locale = () => (I18N() ? I18N().locale() : 'en-US');
  const say = (v) => (I18N() ? I18N().pick(v) : v && typeof v === 'object' ? (v.en != null ? v.en : v.id) : v);   // a stored {en, id} text
  const comboName = (c) => (I18N() ? I18N().combo(c) : c);

  /* ---------- root layer ---------- */
  let root = null;
  const layer = () => { if (!root || !root.isConnected) { root = document.createElement('div'); root.className = 'cd-root'; root.setAttribute('aria-live', 'polite'); document.body.appendChild(root); } return root; };
  function put(html, cls, ms, opts) {
    const el = document.createElement('div');
    el.className = 'cd-el ' + cls;
    el.dataset.born = Date.now(); el.dataset.bit = curId || '';
    el.innerHTML = html;
    if (opts && opts.style) el.style.cssText = opts.style;
    layer().appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    if (ms) setTimeout(() => { el.classList.remove('in'); el.classList.add('out'); setTimeout(() => el.remove(), 420); }, ms);
    return el;
  }

  /* ---------- audio: local, replaceable files ---------- */
  const bufs = {};
  function load(k) {
    if (bufs[k]) return bufs[k];
    const url = C.sounds && C.sounds[k];
    bufs[k] = (async () => {
      if (!url) return null;
      try {
        const o = FX() && FX().audio(); if (!o || !o.ctx) throw 0;
        const r = await fetch(url); if (!r.ok) throw 0;
        const ab = await r.arrayBuffer();
        return await new Promise((res, rej) => o.ctx.decodeAudioData(ab, res, rej));
      } catch (e) { return { fallback: url }; }
    })();
    return bufs[k];
  }
  function sound(k, vol) {
    if (window.CapsaAudio) return window.CapsaAudio.play(k, { vol, perf: curId, late: curLate });
    const V = vol != null ? vol : 0.9;
    if (!FX() || !FX().soundOn()) return;
    load(k).then((b) => {
      if (!b) return;
      if (b.fallback) { try { const a = new Audio(b.fallback); a.volume = V; a.play().catch(() => {}); } catch (e) {} return; }
      const o = FX().audio(); if (!o || !o.ctx) return;
      const s = o.ctx.createBufferSource(), g = o.ctx.createGain(); s.buffer = b; g.gain.value = V;
      s.connect(g).connect(o.out || o.ctx.destination); s.start();
    });
  }

  /* ---------- step renderers ---------- */
  let freezes = 0;
  function freeze(ms) {
    freezes++; document.documentElement.classList.add('cd-frozen');
    const block = put('', 'cd-block', 0); block.style.pointerEvents = 'auto';
    setTimeout(() => { block.remove(); if (--freezes <= 0) { freezes = 0; document.documentElement.classList.remove('cd-frozen'); } }, ms);
  }
  function seatPoint(seat) {
    const s = document.getElementById('seat-' + seat);
    if (!s) return { x: innerWidth / 2, y: innerHeight * 0.32 };
    const r = s.getBoundingClientRect();
    return { x: Math.min(Math.max(r.left + r.width / 2, 110), innerWidth - 110), y: r.bottom + 8 };
  }
  const bar = (data, unit) => {
    const max = Math.max(...data.map((d) => d.value), 1), W = 300, rowH = 30, H = data.length * rowH + 6, lab = 110;
    return `<svg viewBox="0 0 ${W} ${H}" class="cd-svg" role="img" aria-label="${tr('Chart', 'Grafik')}">${data.map((d, i) => {
      const w = Math.max(2, ((W - lab - 46) * d.value) / max), y = i * rowH + 4;
      return `<text x="0" y="${y + 17}" class="cd-axis">${esc(String(d.label).slice(0, 18))}</text>
        <rect x="${lab}" y="${y + 4}" width="${w.toFixed(1)}" height="18" rx="3" fill="${i === 0 ? '#2563eb' : '#93a4c3'}"/>
        <text x="${lab + w + 6}" y="${y + 17}" class="cd-val">${esc(tr(String(d.value), String(d.value).replace('.', ',')))}${unit || ''}</text>`;
    }).join('')}</svg>`;
  };
  const flat = () => {
    let pts = []; for (let x = 0; x <= 300; x += 10) pts.push(`${x},${(70 + (Math.random() - 0.5) * 1.2).toFixed(1)}`);
    return `<svg viewBox="0 0 300 100" class="cd-svg" role="img" aria-label="${tr('Flat chart', 'Grafik datar')}">
      <g stroke="#e3e8f0" stroke-width="1">${[20, 45, 70, 95].map((y) => `<line x1="0" x2="300" y1="${y}" y2="${y}"/>`).join('')}</g>
      <text x="0" y="16" class="cd-axis">${tr('brave', 'berani')}</text><text x="0" y="66" class="cd-axis">pass</text>
      <polyline points="${pts.join(' ')}" fill="none" stroke="#2563eb" stroke-width="2.5"/></svg>`;
  };

  const R = {
    wait() {},
    freeze(s) { freeze(s.ms || 2000); },
    silence(s) { if (window.CapsaAudio) window.CapsaAudio.drop(s.ms || 2000, curId); else if (FX()) FX().duck(s.ms || 2000); },
    sound(s) { sound(s.key, s.vol); },
    effect(s) {
      const fx = FX(); if (!fx || reduced()) return;
      if (s.name === 'glitch') { document.documentElement.classList.add('cd-glitch'); setTimeout(() => document.documentElement.classList.remove('cd-glitch'), 900); return; }
      if (s.name === 'sparkle') { const [x, y] = fx.boardCenter(); fx.explode(x, y, ['#ffd166', '#fbf7ee'], 60, 6); return; }
      if (fx[s.name]) fx[s.name]();
    },
    rarity(s) { put(`<span>${s.level === 'LEGENDARY' ? '★' : '✦'}</span> ${esc(s.level)}`, `cd-rarity cd-r-${String(s.level).toLowerCase()}`, 2200); },
    caption(s) { put(esc(s.text), `cd-caption cd-${s.size || 'm'}`, s.ms || 2000); },
    banner(s) { put(esc(s.text), 'cd-banner', s.ms || 2000); },
    bubble(s) { const p = seatPoint(s.seat); put(esc(s.text), 'cd-bubble', s.ms || 2500, { style: `left:${p.x}px;top:${p.y}px` }); },
    card(s) {
      const fx = FX();
      put(`<div class="cd-card-m">${fx ? fx.mascotSVG(s.mascot || 'laugh') : ''}</div><div><div class="cd-card-t">${esc(s.title)}</div><p>${esc(s.text)}</p>${s.stat ? `<small>${esc(s.stat)}</small>` : ''}</div>`,
        `cd-card cd-tone-${s.tone || 'win'}`, s.ms || 4000);
    },
    poster(s) {
      put(`<div class="cd-p-title">${esc(s.title || tr('WANTED', 'DICARI'))}</div><div class="cd-p-face">${FX() ? FX().mascotSVG('cool') : ''}</div>
        <div class="cd-p-name">${esc(s.name)}</div>${s.sub ? `<div class="cd-p-sub">${esc(s.sub)}</div>` : ''}
        <div class="cd-p-reward">${esc(s.reward || '')}</div>${s.foot ? `<div class="cd-p-foot">${esc(s.foot)}</div>` : ''}`, 'cd-poster', s.ms || 4800);
    },
    receipt(s) {
      const d = new Date();
      put(`<div class="cd-rc-title">${esc(s.title || tr('RECEIPT', 'STRUK'))}</div><div class="cd-rc-meta">${d.toLocaleDateString(locale())} ${d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })} · ${tr('CASHIER: SYSTEM', 'KASIR: SISTEM')}</div>
        <div class="cd-rc-lines">${(s.lines || []).map(([a, b]) => `<div><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('')}</div>
        ${s.total ? `<div class="cd-rc-total"><span>${esc(s.total[0])}</span><span>${esc(s.total[1])}</span></div>` : ''}
        ${s.foot ? `<div class="cd-rc-foot">${esc(s.foot)}</div>` : ''}`, 'cd-receipt', s.ms || 5000);
    },
    error(s) {
      const el = put(`<div class="cd-e-face">:(</div><div class="cd-e-title">${esc(s.title)}</div><p>${esc(s.body || '')}</p>
        ${(s.bars || []).map(([t, to], i) => `<div class="cd-e-bar" data-to="${to}"><span>${esc(t)}</span><b data-i="${i}">0%</b></div>`).join('')}`, 'cd-error', s.ms || 5000);
      if (s.block) el.style.pointerEvents = 'auto';
      el.querySelectorAll('.cd-e-bar').forEach((row, i) => {
        const to = +row.dataset.to, b = row.querySelector('b'), dur = (s.ms || 5000) * 0.55, t0 = performance.now() + i * 500;
        const step = (t) => { const k = Math.min(1, Math.max(0, (t - t0) / dur)); b.textContent = Math.round(to * k) + '%'; if (k < 1 && el.isConnected) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      });
    },
    typing(s) { put(`${esc(tr('System is typing', 'Sistem sedang mengetik'))}<i></i><i></i><i></i>`, 'cd-typing', s.ms || 3000); },
    stamp(s) { put(esc(s.text), 'cd-stamp', s.ms || 1600); },
    replay(s) {
      const fx = FX();
      const el = put(`<div class="cd-rp-tag">● ${esc(s.label || 'REPLAY')} · ${tr('0.25×', '0,25×')}</div><div class="cd-rp-cards">${(s.cards || []).map((c) => fx ? fx.cardHTML(c) : '').join('')}</div>
        ${s.caption ? `<div class="cd-rp-cap">${esc(s.caption)}</div>` : ''}`, 'cd-replay', s.ms || 4500);
      if (s.block) el.style.pointerEvents = 'auto';
    },
    notify(s) {
      const icon = s.icon === 'calendar'
        ? `<i class="cd-n-icon cd-n-cal"><b>${new Date().getDate()}</b></i>`
        : `<i class="cd-n-icon">${esc((s.app || 'S')[0])}</i>`;
      const btns = (s.buttons || []).map((b) => (typeof b === 'string' ? { label: b } : b));
      const el = put(`<div class="cd-n-head">${icon}<span class="cd-n-app">${esc(s.app || tr('System', 'Sistem'))}</span><span class="cd-n-time">${tr('now', 'sekarang')}</span></div>
        <div class="cd-n-title">${esc(s.title || '')}</div>${s.body ? `<div class="cd-n-body">${esc(s.body)}</div>` : ''}
        ${(s.lines || []).map((l) => `<div class="cd-n-body">${esc(l)}</div>`).join('')}
        ${s.later ? `<div class="cd-n-body cd-n-later" hidden>${esc(s.later.text)}</div>` : ''}
        ${btns.length ? `<div class="cd-n-btns">${btns.map((b, i) => `<button type="button" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>` : ''}`, 'cd-notif', s.ms || 4000);
      el.querySelectorAll('button').forEach((bt) => bt.addEventListener('click', () => {
        const b = btns[+bt.dataset.i];
        if (b && b.reply) {
          el.querySelector('.cd-n-title').textContent = b.reply;
          el.querySelectorAll('.cd-n-body,.cd-n-btns').forEach((x) => x.remove());
          setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 2500);
        } else { el.classList.add('out'); setTimeout(() => el.remove(), 300); }
      }));
      if (s.later) setTimeout(() => { const l = el.querySelector('.cd-n-later'); if (l) l.hidden = false; }, s.later.at || 2000);
    },
    chart(s) {
      const body = s.kind === 'flat' ? flat() : s.kind === 'line' ? line(s.data || []) : bar(s.data || [], s.unit);
      const el = put(`<div class="cd-ch-head"><span>${tr('ANALYSIS', 'ANALISIS')}</span><b>${esc(s.title)}</b>${s.sub ? `<small>${esc(s.sub)}</small>` : ''}</div>
        ${body}${s.note ? `<p class="cd-ch-note"${s.noteAt ? ' hidden' : ''}>${esc(s.note)}</p>` : ''}`, 'cd-chart', s.ms || 5000);
      if (s.noteAt) setTimeout(() => { const n = el.querySelector('.cd-ch-note'); if (n) n.hidden = false; }, s.noteAt);
    },
    memory(s) {
      const fx = FX();
      put(`<div class="cd-mem-thumb">${s.card != null && fx ? fx.cardHTML(s.card) : ''}</div>
        <div class="cd-mem-txt"><b>${esc(s.title || tr('Memories', 'Kenangan'))}</b><span>${esc(s.sub || '')}</span><small>${esc(s.caption || '')}</small></div>`, 'cd-mem', s.ms || 4000);
    },
    memorial(s) {
      const fx = FX();
      put(`<div class="cd-mm-cards">${(s.cards || []).map((c) => (fx ? fx.cardHTML(c) : '')).join('')}</div>
        <div class="cd-mm-l1">${esc(s.line1 || '')}</div><div class="cd-mm-l2">${esc(s.line2 || '')}</div>`, 'cd-memorial', s.ms || 4500);
    },
    dim(s) { put('', 'cd-dim', s.ms || 3000); },
    emote(s) { if (FX() && FX().emote && s.seat != null) FX().emote(s.seat, s.e || 'laugh'); },
    mic(s) {
      const p = seatPoint(s.seat);
      const el = put(`<svg viewBox="0 0 24 24" class="cd-mic-i" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" fill="#fff"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
        <span class="cd-mic-t">${esc(s.open || '')}</span>`, 'cd-mic', s.ms || 6000, { style: `left:${p.x}px;top:${p.y}px` });
      if (s.close) setTimeout(() => { const t = el.querySelector('.cd-mic-t'); if (t) t.textContent = s.close; el.classList.add('closed'); sound('stamp'); }, s.closeAt || 4000);
    },
    cctv(s) {
      const fx = FX(), ms = s.ms || 5000;
      const el = put(`<div class="cd-cctv-tag">● ${tr('CAM 02 · TABLE', 'KAM 02 · MEJA')} · <span class="cd-cctv-clock"></span></div>
        <div class="cd-cctv-cards">${(s.cards || []).map((c) => (fx ? fx.cardHTML(c) : '')).join('')}</div>
        <div class="cd-cctv-cap" hidden>${esc(s.caption || '')}</div>`, 'cd-cctv', ms);
      el.style.pointerEvents = 'auto';
      document.documentElement.classList.add('cd-cctv-on');
      setTimeout(() => document.documentElement.classList.remove('cd-cctv-on'), ms);
      const clock = el.querySelector('.cd-cctv-clock');
      const tick = () => { if (!el.isConnected) return; clock.textContent = new Date().toLocaleTimeString(locale(), { hour12: false }); setTimeout(tick, 250); };
      tick();
      setTimeout(() => { const c = el.querySelector('.cd-cctv-cap'); if (c) c.hidden = false; }, s.captionAt || 2500);
    },
    tape(s) { put(`<div class="cd-tape-band"><span>${esc((s.text + '   ·   ').repeat(8))}</span></div>`, 'cd-tape', s.ms || 4000); },
    archive(s) {
      const el = put(`<div class="cd-ar-tab">${esc(s.title || tr('ARCHIVE', 'ARSIP'))}</div>
        <div class="cd-ar-lines">${(s.lines || []).map((l) => `<div class="cd-ar-line" hidden>${esc(l)}</div>`).join('')}</div>
        <div class="cd-ar-stamp" hidden>${esc(s.stamp || tr('ACTIVE', 'AKTIF'))}</div>`, 'cd-archive', s.ms || 5500);
      const rows = el.querySelectorAll('.cd-ar-line');
      rows.forEach((r, i) => setTimeout(() => { r.hidden = false; sound('typing'); }, 800 * (i + 1)));
      setTimeout(() => { const st = el.querySelector('.cd-ar-stamp'); if (st) { st.hidden = false; sound('stamp'); } }, 800 * (rows.length + 1) + 400);
    },
    reco(s) {
      const fx = FX();
      put(`<div class="cd-reco-thumb">${(s.cards || []).map((c) => (fx ? fx.cardHTML(c) : '')).join('')}<span>${esc(s.duration || '12:04')}</span></div>
        <div class="cd-reco-meta"><b>${esc(s.title || '')}</b><small>${esc(s.sub || '')}</small></div>`, 'cd-reco', s.ms || 4000);
    },
    patch(s) {
      const el = put(`<div class="cd-pt-head"><b>${esc(s.title || tr('Patch notes', 'Catatan pembaruan'))}</b><code>${esc(s.version || '')}</code></div>
        <ul>${(s.lines || []).map((l) => `<li hidden>${esc(l)}</li>`).join('')}</ul>
        <button type="button" class="btn primary">${esc(s.button || tr('Update', 'Perbarui'))}</button>`, 'cd-patch', s.ms || 9000);
      el.style.pointerEvents = 'auto';
      el.querySelectorAll('li').forEach((li, i) => setTimeout(() => { li.hidden = false; }, 900 * (i + 1)));
      el.querySelector('button').addEventListener('click', () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); });
    },
    still(s) {
      const cd = s.countdown || 3000;
      const el = put(`<div class="cd-st-q">${esc(s.question || '')}</div><div class="cd-st-bar"><span></span></div>
        <button type="button" class="btn">${esc(s.button || tr('Still here', 'Masih'))}</button>`, 'cd-still', cd + 1700);
      el.style.pointerEvents = 'auto';
      const bar = el.querySelector('.cd-st-bar span');
      requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = `width ${cd}ms linear`; bar.style.width = '0%'; }));
      let answered = false;
      el.querySelector('button').addEventListener('click', () => { answered = true; el.classList.add('out'); setTimeout(() => el.remove(), 300); });
      setTimeout(() => {
        if (answered || !el.isConnected) return;
        el.querySelector('.cd-st-q').textContent = s.after || '';
        el.querySelectorAll('.cd-st-bar,button').forEach((x) => x.remove());
        sound('notify');
      }, cd);
    },
    spot(s) {
      const fx = FX();
      put(`<div class="cd-spot-cards">${(s.cards || []).map((c) => (fx ? fx.cardHTML(c) : '')).join('')}</div>`, 'cd-spot', s.ms || 2000);
    },
    approve(s) { addDeco({ kind: 'approve', sig: s.sig, until: Date.now() + (s.ms || 600000) }); },
    tag(s) { addDeco({ kind: 'tag', seat: s.seat, text: s.text, cls: s.cls || '', until: Date.now() + (s.ms || 2500) }); },
    predict(s) { addDeco({ kind: 'predict', seat: s.seat, combo: s.combo, until: Date.now() + (s.ms || 90000) }); },
    ribbon(s) { addDeco({ kind: 'ribbon', seat: s.seat, until: Date.now() + (s.ms || 6000) }); },
    fakeSeat(s) {
      const d = { kind: 'fakeSeat', name: s.name || tr('System', 'Sistem'), text: s.text || tr('13 cards', '13 kartu'), until: Date.now() + (s.ms || 6500) };
      addDeco(d);
      if (s.later) setTimeout(() => { d.text = s.later; decorate(); }, s.laterAt || 4500);
    },
    scoreSwap(s) {
      const v = FX() && FX().view();
      addDeco({ kind: 'score', seat: s.seat, value: s.value, raw: !!s.raw, orig: v && v.scores ? v.scores[s.seat] : null, until: Date.now() + (s.ms || 2000) });
    },
  };

  /* ---------- decorations: small things attached to seats / the table, re-applied after every render ---------- */
  const deco = [];
  const sigOf = (cards) => (cards || []).slice().sort((a, b) => a - b).join(',');
  function addDeco(d) {
    deco.push(d); decorate();
    setTimeout(decorate, Math.max(0, d.until - Date.now()) + 40);
  }
  function decorate() {
    document.querySelectorAll('.cd-deco').forEach((x) => x.remove());
    const now = Date.now(), fx = FX(), v = fx ? fx.view() : null;
    for (let i = deco.length - 1; i >= 0; i--) {
      const d = deco[i];
      if (d.until > now) continue;
      if (d.kind === 'score') { const sc = document.querySelector(`#seat-${d.seat} .sc`); if (sc && sc.firstChild && d.orig != null) sc.firstChild.textContent = d.raw ? String(d.orig) : (d.orig > 0 ? '+' : '') + d.orig; }
      deco.splice(i, 1);
    }
    for (const d of deco) {
      const seat = d.seat != null ? document.getElementById('seat-' + d.seat) : null;
      if ((d.kind === 'tag' || d.kind === 'predict') && seat) {
        const t = document.createElement('div'); t.className = 'cd-deco cd-seat-note ' + (d.cls || '');
        t.textContent = d.kind === 'predict' ? tr(`prediction: ${comboName(d.combo)}`, `prediksi: ${d.combo}`) : d.text; seat.appendChild(t);
      } else if (d.kind === 'ribbon' && seat) {
        const r = document.createElement('i'); r.className = 'cd-deco cd-ribbon'; r.setAttribute('aria-hidden', 'true'); seat.appendChild(r);
      } else if (d.kind === 'approve' && v && v.table && sigOf(v.table.cards) === d.sig) {
        const pl = document.querySelector('.board .played');
        if (pl) { pl.style.position = 'relative'; const a = document.createElement('span'); a.className = 'cd-deco cd-approve'; a.textContent = tr('✓ approved', '✓ disetujui'); pl.appendChild(a); }
      } else if (d.kind === 'fakeSeat') {
        const seats = document.querySelector('.seats');
        if (seats) {
          const f = document.createElement('div'); f.className = 'cd-deco seat cd-fake-seat';
          f.innerHTML = `<div class="card back mini" aria-hidden="true"></div><div class="nm">${esc(d.name)}</div><div class="sc">0<small>${tr('pts', 'poin')}</small></div><span></span><div class="ct">${esc(d.text)}</div>`;
          seats.appendChild(f);
        }
      } else if (d.kind === 'score') {
        const sc = document.querySelector(`#seat-${d.seat} .sc`);
        if (sc && sc.firstChild) { sc.firstChild.textContent = d.raw ? String(d.value) : (d.value > 0 ? '+' : '') + d.value; sc.parentElement.classList.add('cd-gold'); setTimeout(() => sc.parentElement && sc.parentElement.classList.remove('cd-gold'), Math.max(0, d.until - Date.now())); }
      }
    }
    // bit 7 "Pass (lagi)": the pass label climbs with passes made while holding a legal play
    const mem = window.CapsaMemory, r = mem && mem.round();
    if (r && v && ['turn', 'handoff'].includes(v.phase)) {
      (r.passPlayable || []).forEach((n, i) => {
        if (n < 3) return;
        const pill = document.querySelector(`#seat-${i} .pill.pass`);
        if (pill) pill.textContent = n >= 7 ? tr('pass (a way of life)', 'pass (prinsip hidup)') : n >= 5 ? tr('pass (habit)', 'pass (kebiasaan)') : tr('pass (again)', 'pass (lagi)');
      });
    }
  }
  // a prediction tag resolves on that player's next play
  if (window.CapsaEvents) window.CapsaEvents.on('fact:play', (d) => {
    const p = deco.find((x) => x.kind === 'predict' && x.seat === d.seat);
    if (!p) return;
    p.kind = 'tag'; p.text = d.combo === p.combo ? '✓' : tr('evolving.', 'berkembang.'); p.until = Date.now() + 2600;
    setTimeout(decorate, 2650); decorate();
  });

  /* ---------- line chart from real values ---------- */
  function line(data) {
    const vals = data.map((d) => d.value), lo = Math.min(...vals, 0), hi = Math.max(...vals, 0), W = 300, H = 110, pad = 22;
    const x = (i) => pad + (i * (W - pad - 10)) / Math.max(1, vals.length - 1), y = (val) => 10 + ((hi - val) * (H - 30)) / Math.max(1, hi - lo);
    const pts = vals.map((val, i) => `${x(i).toFixed(1)},${y(val).toFixed(1)}`).join(' ');
    const lx = x(vals.length - 1), ly = y(vals[vals.length - 1]);
    return `<svg viewBox="0 0 ${W} ${H}" class="cd-svg" role="img" aria-label="${tr('Line chart', 'Grafik garis')}">
      <line x1="${pad}" x2="${W - 10}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" stroke="#c9d2e3" stroke-dasharray="3 3"/>
      <text x="0" y="${(y(0) + 4).toFixed(1)}" class="cd-axis">0</text>
      <polyline points="${pts}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4.5" fill="#d1262b"/>
      <text x="${Math.min(lx - 4, W - 40).toFixed(1)}" y="${Math.min(H - 4, ly + 18).toFixed(1)}" class="cd-val">${vals[vals.length - 1]}</text>
      ${data.map((d, i) => `<text x="${x(i).toFixed(1)}" y="${H - 2}" class="cd-axis" text-anchor="middle">${esc(d.label)}</text>`).join('')}</svg>`;
  }

  /* ---------- bit 28: closing credits when a long match ends ---------- */
  function credits() {
    const mem = window.CapsaMemory; if (!mem) return;
    const M = mem.match(), rounds = M.rounds.length;
    if (rounds < 8 || document.querySelector('.cd-credits')) return;
    const names = M.rounds[rounds - 1].names, lore = mem.lore();
    const hoarder = lore.find((l) => l.kind === 'hoarder'), worst = lore.find((l) => l.kind === 'worst');
    const lines = ['CAPSA BANTING', '', tr('Starring', 'Pemeran'), ...names.map((n) => tr(`${n} as ${mem.title(n)}`, `${n} sebagai ${mem.title(n)}`)), ''];
    if (hoarder) lines.push(tr(`Stunt double for the 2s: ${hoarder.name}`, `Pemeran pengganti kartu 2: ${hoarder.name}`));
    lines.push(tr('Silence supervisor: The System', 'Penata hening: Sistem'), '', tr('No cards were harmed in the making of this match.', 'Tidak ada kartu yang dilukai dalam pertandingan ini.'));
    if (worst) lines.push(tr(`Except ${worst.name}'s.`, `Kecuali milik ${worst.name}.`));
    const wrap = document.createElement('div');
    wrap.className = 'cd-credits'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', tr('End credits', 'Kredit akhir'));
    wrap.innerHTML = `<div class="cd-cr-roll">${lines.map((l) => (l ? `<p>${esc(l)}</p>` : '<p class="cd-cr-gap"></p>')).join('')}</div><button type="button" class="btn" data-cd-skip>${tr('Skip', 'Lewati')}</button>`;
    document.body.appendChild(wrap);
    sound('credits');
    const close = () => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 400); };
    wrap.querySelector('[data-cd-skip]').addEventListener('click', close);
    setTimeout(close, 15000);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="reset"],[data-act="leave-room"],[data-act="setup"]');
    if (!b) return;
    // reset needs a second click to confirm (the button turns .warn); only that one ends the match
    if (b.dataset.act === 'reset' && !b.classList.contains('warn') && !/Yakin|Sure|Confirm/i.test(b.textContent)) return;
    setTimeout(credits, 60);
  }, true);

  /* ---------- bit 26: one-device handoff screen, late in a long match ---------- */
  let lapDone = false, lapSeen = '';
  function lapCheck(v) {
    if (lapDone || v.online || v.phase !== 'handoff' || !window.CapsaMemory) return;
    const M = window.CapsaMemory.match(), mins = (Date.now() - M.startedAt) / 60000;
    if (!(mins >= 40 || (v.round || 0) >= 12)) return;
    const k = v.round + ':' + v.turn; if (k === lapSeen) return; lapSeen = k;
    if (Math.random() >= 0.5) return;
    lapDone = true;
    setTimeout(() => {
      const p = document.querySelector('.handoff p'); if (!p) return;
      p.style.transition = 'opacity .4s'; p.style.opacity = '0';
      setTimeout(() => { p.textContent = tr('Before you pass the phone, please wipe the screen.', 'Sebelum dioper, tolong lap layarnya dulu.'); p.style.opacity = '1'; }, 400);
      setTimeout(() => { const s = document.createElement('p'); s.className = 'cd-lap-small'; s.textContent = tr('We can feel it.', 'Kami bisa merasakannya.'); p.after(s); }, 2900);
    }, 2000);
  }

  /* ---------- player ---------- */
  const queue = [];
  let busy = false, curId = '', curLate = false;
  // a button on a bit pressed within 1.2 s of it appearing = the table waving it away; the director listens
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.cd-el button'); if (!b) return;
    const el = b.closest('.cd-el'), age = Date.now() - (+el.dataset.born || 0);
    if (age < 1200 && FX() && FX().fact) FX().fact('bit:feedback', { kind: 'dismiss', id: el.dataset.bit || '' });
  }, true);
  async function run() {
    if (busy || !queue.length) return;
    busy = true;
    const p = queue.shift(); curId = (p.id || '') + ':' + (p.at || Date.now()); curLate = false;
    try {
      // online: every phone starts at the same server time
      if (p.at && FX() && FX().serverNow) {
        const wait = p.at - FX().serverNow();
        if (wait > 0 && wait < 4000) await sleep(wait); else if (wait < -1500) curLate = true;
      }
      await sleep(p.delay || 0);
      const I = window.CapsaI18n, alt = I && p.alt && p.alt[I.lang()];   // this phone's language
      const note = (alt && alt.note) || p.note, steps = (alt && alt.steps) || p.steps;
      // the memory keeps the note in both languages (it can end up in the match report after a language switch)
      const idNote = p.alt && p.alt.id && p.alt.id.note;
      const text = note && p.note && idNote ? { en: p.note.text, id: idNote.text } : note && note.text;
      if (note && window.CapsaMemory) window.CapsaMemory.note(note.round, note.name, text, note.w);
      for (const s of steps || []) { const f = R[s.do]; if (f) { try { f(s); } catch (e) { console.warn('[stage]', s.do, e); } } await sleep(nextOf(s)); }
    } catch (e) { console.warn('[stage]', e); }
    busy = false; run();
  }
  document.addEventListener('capsa:mod', (e) => {
    if (!e.detail || e.detail.type !== 'comedy' || !e.detail.data) return;
    queue.push(e.detail.data);
    while (queue.length > 3) queue.splice(queue.findIndex((q) => q.rarity !== 'LEGENDARY'), 1);
    run();
  });

  /* ---------- roast summary ---------- */
  function summaryHTML() {
    const mem = window.CapsaMemory; if (!mem) return '';
    const M = mem.match(), rounds = M.rounds.length;
    const names = rounds ? M.rounds[rounds - 1].names : M.names;
    const k = mem.key, wins = (n) => M.wins[k(n)] || 0, pen = (n) => M.penalty[k(n)] || 0;
    const lossN = (n) => (mem.mode() === 'last' ? mem.losses(n) * 1000 + pen(n) : pen(n));
    const mvp = [...names].sort((a, b) => wins(b) - wins(a))[0], sus = [...names].sort((a, b) => lossN(b) - lossN(a))[0];
    const bad = Object.values(M.mistakes).reduce((a, b) => a + b, 0);
    const drama = Math.min(100, 12 + bad * 6 + M.ezLosses * 15 + M.bombs * 9 + M.moments.filter((m) => m.w >= 6).length * 8);
    const top = [...M.moments].sort((a, b) => b.w - a.w || b.round - a.round).slice(0, 3);
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const w = wins(mvp), lo = mem.losses(sus);
    return `<div class="cd-sum" role="dialog" aria-label="${tr('Match report', 'Laporan pertandingan')}">
      <div class="cd-rc-title">${tr('MATCH REPORT', 'LAPORAN PERTANDINGAN')}</div>
      <div class="cd-rc-meta">${tr(`${rounds} round${rounds === 1 ? '' : 's'} · compiled by a non-neutral system`, `${rounds} ronde · disusun oleh sistem yang tidak netral`)}</div>
      <div class="cd-rc-lines">
        <div><span>MVP</span><span>${esc(mvp || '-')} (${tr(`${w} win${w === 1 ? '' : 's'}`, `${w} menang`)})</span></div>
        <div><span>${tr('Prime suspect', 'Tersangka utama')}</span><span>${esc(sus || '-')} (${mem.mode() === 'last' ? tr(`lost ${lo}×`, `${lo}× kalah`) : tr(`−${pen(sus)} pts`, `−${pen(sus)} poin`)})</span></div>
        <div><span>${tr('Bad decisions on record', 'Keputusan buruk tercatat')}</span><span>${bad} ${tr('(internal data)', '(data internal)')}</span></div>
        <div><span>${tr('Unproven "EZ"s', '"EZ" yang tidak terbukti')}</span><span>${M.ezLosses}</span></div>
        <div><span>${tr('2s taken to the grave', 'Kartu 2 dibawa mati')}</span><span>${M.twosDied}</span></div>
        <div><span>${tr('Bombs used', 'Bom dipakai')}</span><span>${M.bombs}</span></div>
        <div><span>${tr('Drama level', 'Tingkat drama')}</span><span>${drama}%</span></div>
      </div>
      ${top.length ? `<div class="cd-sum-h">${tr('Moments that will keep coming up', 'Momen yang akan terus diungkit')}</div><div class="cd-rc-lines">${top.map((m) => `<div><span>R${m.round} · ${esc(m.name)}</span><span>${esc(say(m.text))}</span></div>`).join('')}</div>` : ''}
      <div class="cd-sum-h">${tr('Titles', 'Gelar')}</div>
      <div class="cd-rc-lines">${names.map((n) => `<div><span>${esc(n)}</span><span>${esc(mem.title(n))}</span></div>`).join('')}</div>
      <div class="cd-rc-foot">${esc(pick([
        tr('This report will be discussed in the group chat until next week.', 'Laporan ini akan dibahas di grup sampai minggu depan.'),
        tr('All parties are asked not to hold grudges. Except where necessary.', 'Semua pihak dimohon tidak membawa dendam. Kecuali yang perlu.'),
        tr('Nobody learned anything today.', 'Tidak ada yang belajar apa pun hari ini.')]))}</div>
      <button type="button" class="btn primary" data-cd-close>${tr('Close', 'Tutup')}</button></div>`;
  }
  function openSummary() {
    const wrap = document.createElement('div');
    wrap.className = 'cd-modal'; wrap.innerHTML = summaryHTML();
    wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-cd-close]')) wrap.remove(); });
    document.body.appendChild(wrap);
    const b = wrap.querySelector('[data-cd-close]'); if (b) b.focus();
  }

  /* ---------- decorate the game after each render ---------- */
  document.addEventListener('capsa:render', (e) => {
    const mem = window.CapsaMemory, fx = FX();
    if (!mem || !fx) return;
    const v = fx.view();
    if (['turn', 'handoff', 'end'].includes(v.phase)) {
      const bounty = mem.match().bounty;
      (v.names || []).forEach((n, i) => {
        const seat = document.getElementById('seat-' + i); if (!seat) return;
        const id = mem.titleId ? mem.titleId(n) : '', hunted = bounty && bounty.key === mem.key(n);
        const plain = id === 'newcomer' || id === 'regular';   // nothing worth a tag yet
        if (plain && !hunted) return;
        const row = document.createElement('div'); row.className = 'cd-seat-tag';
        row.innerHTML = `${hunted ? '<span class="cd-bounty">BOUNTY</span>' : ''}${!plain ? `<span>${esc(mem.title(n))}</span>` : ''}`;
        if (row.textContent) seat.appendChild(row);
      });
    }
    if (v.phase === 'end' && mem.match().rounds.length >= 2) {
      const ctr = document.querySelector('.zone .controls');
      if (ctr && !ctr.querySelector('[data-cd-sum]')) { const b = document.createElement('button'); b.className = 'btn'; b.dataset.cdSum = '1'; b.textContent = tr('Match report', 'Laporan pertandingan'); ctr.appendChild(b); }
    }
    const panel = document.querySelector('.stats-panel');
    if (panel && window.CapsaComedy && !panel.querySelector('.cd-demos')) {
      const demos = ['rapat-panjang', 'kartu-terbuka', 'pengakuan-diterima', 'modal-awal', 'emote-dikembalikan', 'kebiasaan-baru', 'selamat-datang', 'rivalitas-resmi', 'kejadian-serupa', 'sistem-prihatin', 'kenangan', 'survei', 'noted', 'prasasti', 'mic-dibuka', 'undangan', 'cctv', 'pembukaan', 'garis-polisi', 'arsip', 'hening', 'ganti-dukungan', 'laporan-kinerja', 'penyebab', 'disarankan', 'patch-notes', 'sistem-ikut-main', 'harapan', 'ez-callback', 'learned-nothing'];
      const div = document.createElement('div'); div.className = 'tests cd-demos';
      div.innerHTML = `<span>${tr('Comedy tests:', 'Tes komedi:')}</span>${demos.map((id) => `<button class="chip" data-cd-demo="${id}">${id}</button>`).join('')}${mem.match().rounds.length ? `<button class="chip" data-cd-sum="1">${tr('report', 'laporan')}</button>` : ''}`;
      panel.appendChild(div);
    }
    decorate(); lapCheck(v);
  });
  // language switched on this phone: rebuild the bits of UI added above on the next render
  document.addEventListener('capsa:lang', () => { document.querySelectorAll('.cd-demos,[data-cd-sum]:not(.chip)').forEach((x) => x.remove()); decorate(); });
  document.addEventListener('click', (e) => {
    const s = e.target.closest('[data-cd-sum]'); if (s) { e.stopPropagation(); return openSummary(); }
    const d = e.target.closest('[data-cd-demo]'); if (d && window.CapsaComedy) { e.stopPropagation(); window.CapsaComedy.play(d.dataset.cdDemo); }
  }, true);

  /* ---------- styles (own layer, fixed colors: these imitate other apps on purpose) ---------- */
  const css = document.createElement('style');
  css.textContent = `
.cd-root{position:fixed;inset:0;z-index:52;pointer-events:none}
.cd-el{position:absolute;opacity:0;transition:opacity .28s ease,transform .38s cubic-bezier(.2,1.3,.4,1)}
.cd-el.in{opacity:1}.cd-el.out{opacity:0;transition-duration:.3s}
.cd-frozen #app{filter:grayscale(1) brightness(.72);transition:filter .3s}
#app{transition:filter .3s}
.cd-block{inset:0;opacity:1;background:transparent}
.cd-glitch #app{animation:cdGlitch .9s steps(2) both}
@keyframes cdGlitch{0%{transform:none;filter:none}15%{transform:translate(6px,-3px) skewX(6deg);filter:hue-rotate(90deg) saturate(3)}30%{transform:translate(-8px,2px);filter:invert(1)}45%{transform:translate(4px,4px) skewX(-8deg);filter:hue-rotate(-120deg)}60%{transform:translate(-3px,-5px);filter:contrast(3)}80%{transform:translate(2px,0);filter:none}100%{transform:none}}
.cd-caption{left:50%;transform:translate(-50%,8px);bottom:24%;max-width:min(560px,calc(100vw - 32px));text-align:center;font-family:Rubik,system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.82);padding:8px 16px;border-radius:6px;line-height:1.35;letter-spacing:.01em}
.cd-caption.in{transform:translate(-50%,0)}
.cd-s{font-size:15px}.cd-m{font-size:19px;font-weight:500}.cd-l{font-size:clamp(22px,4.5vw,34px);font-weight:600;bottom:40%;background:rgba(0,0,0,.88);padding:12px 22px}
.cd-banner{left:50%;top:34%;transform:translate(-50%,-50%) scale(.85);font-family:"Lilita One",Rubik,sans-serif;font-size:clamp(30px,7vw,64px);color:#fff;-webkit-text-stroke:2px #000;text-shadow:0 5px 0 #000;letter-spacing:.02em;white-space:nowrap;max-width:94vw;overflow:hidden;text-overflow:ellipsis}
.cd-banner.in{transform:translate(-50%,-50%) scale(1)}
.cd-notif{left:50%;top:calc(env(safe-area-inset-top,0px) + 12px);transform:translate(-50%,-30px);width:min(380px,calc(100vw - 24px));background:rgba(246,246,248,.96);color:#111;border-radius:18px;padding:12px 14px;box-shadow:0 12px 40px rgba(0,0,0,.35);font-family:-apple-system,"Segoe UI",Roboto,Rubik,sans-serif;pointer-events:auto}
.cd-notif.in{transform:translate(-50%,0)}
.cd-n-head{display:flex;align-items:center;gap:8px;font-size:12px;color:#6b6b72}
.cd-n-icon{width:20px;height:20px;border-radius:5px;background:#1f6feb;color:#fff;font-style:normal;font-weight:700;font-size:12px;display:grid;place-items:center}
.cd-n-app{text-transform:uppercase;letter-spacing:.04em;flex:1}
.cd-n-title{font-weight:700;font-size:15px;margin-top:6px}
.cd-n-body{font-size:14px;margin-top:2px;line-height:1.35;color:#2b2b30}
.cd-n-btns{display:flex;gap:8px;margin-top:10px}
.cd-n-btns button{flex:1;border:0;border-radius:10px;background:#e4e4ea;color:#111;font:600 14px/1 -apple-system,"Segoe UI",Roboto,sans-serif;padding:10px;cursor:pointer}
.cd-bubble{transform:translate(-50%,6px);background:#fff;color:#111;font:700 18px/1.2 Rubik,system-ui,sans-serif;padding:8px 14px;border-radius:14px;box-shadow:0 4px 0 rgba(0,0,0,.35);white-space:nowrap}
.cd-bubble::before{content:"";position:absolute;left:50%;top:-7px;margin-left:-7px;border:7px solid transparent;border-top:0;border-bottom-color:#fff}
.cd-bubble.in{transform:translate(-50%,0)}
.cd-card{left:50%;top:calc(env(safe-area-inset-top,0px) + 70px);transform:translate(-50%,-20px);width:min(430px,calc(100vw - 28px));display:grid;grid-template-columns:58px minmax(0,1fr);gap:12px;align-items:center;padding:12px 16px 12px 10px;border-radius:16px;background:linear-gradient(#221c15,#15110d);border:3px solid var(--cdc,#e2b04f);color:#fff;box-shadow:0 6px 0 rgba(0,0,0,.45)}
.cd-card.in{transform:translate(-50%,0)}
.cd-card svg{width:58px;height:auto;display:block}
.cd-card-t{font-family:"Lilita One",Rubik,sans-serif;font-size:22px;color:var(--cdc)}
.cd-card p{margin:4px 0 0;font-size:14px;line-height:1.38}.cd-card small{display:block;margin-top:6px;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#bfb4a3}
.cd-tone-win{--cdc:#e2b04f}.cd-tone-lose{--cdc:#8ea3b8}.cd-tone-spicy{--cdc:#ff7a45}.cd-tone-legend{--cdc:#9be3b4}
.cd-chart{left:50%;top:50%;transform:translate(-50%,-46%);width:min(380px,calc(100vw - 28px));background:#fff;color:#1d2433;border-radius:12px;padding:14px 16px;box-shadow:0 18px 50px rgba(0,0,0,.45);font-family:-apple-system,"Segoe UI",Roboto,Rubik,sans-serif}
.cd-chart.in{transform:translate(-50%,-50%)}
.cd-ch-head{display:grid;gap:2px;margin-bottom:8px}.cd-ch-head span{font-size:10px;letter-spacing:.14em;color:#2563eb;font-weight:700}.cd-ch-head b{font-size:16px}.cd-ch-head small{font-size:12px;color:#5b6577}
.cd-svg{width:100%;height:auto;display:block}.cd-axis{font-size:11px;fill:#5b6577}.cd-val{font-size:11px;fill:#1d2433;font-weight:700}
.cd-ch-note{margin:8px 0 0;font-size:13px;border-top:1px solid #e3e8f0;padding-top:8px;font-style:italic}
.cd-poster{left:50%;top:50%;transform:translate(-50%,-50%) rotate(-3deg) scale(.8);width:min(270px,80vw);background:#e9d8b4;color:#3b2a14;text-align:center;padding:16px 18px;border:6px double #6b4a22;box-shadow:0 18px 40px rgba(0,0,0,.5);font-family:Georgia,"Libre Bodoni",serif}
.cd-poster.in{transform:translate(-50%,-50%) rotate(-3deg) scale(1)}
.cd-p-title{font-size:42px;font-weight:700;letter-spacing:.08em}.cd-p-face svg{width:90px;height:auto;margin:4px auto;display:block;filter:sepia(1)}
.cd-p-name{font-size:26px;font-weight:700;text-transform:uppercase}.cd-p-sub{font-size:13px;font-style:italic}.cd-p-reward{margin-top:10px;font-size:16px;font-weight:700;border-top:2px solid #6b4a22;padding-top:8px}.cd-p-foot{font-size:11px;margin-top:6px}
.cd-receipt,.cd-sum{background:#fbfbf7;color:#222;font-family:"Courier New",ui-monospace,monospace;font-size:13px;padding:16px 16px 14px;box-shadow:0 18px 40px rgba(0,0,0,.5)}
.cd-receipt{left:50%;top:50%;transform:translate(-50%,-44%);width:min(320px,calc(100vw - 32px))}
.cd-receipt.in{transform:translate(-50%,-50%)}
.cd-rc-title{text-align:center;font-weight:700;font-size:16px;letter-spacing:.1em}.cd-rc-meta{text-align:center;font-size:11px;color:#777;margin:2px 0 8px}
.cd-rc-lines{border-top:1px dashed #999;border-bottom:1px dashed #999;padding:6px 0;display:grid;gap:4px}
.cd-rc-lines div,.cd-rc-total{display:flex;justify-content:space-between;gap:12px}.cd-rc-lines span:last-child{text-align:right}
.cd-rc-total{font-weight:700;font-size:15px;padding-top:6px}.cd-rc-foot{text-align:center;font-size:11px;color:#666;margin-top:8px}
.cd-error{left:50%;top:50%;transform:translate(-50%,-50%) scale(.96);width:min(460px,calc(100vw - 24px));background:#0a54b5;color:#fff;padding:22px 22px 20px;font-family:"Segoe UI",Rubik,system-ui,sans-serif;box-shadow:0 0 0 100vmax rgba(10,84,181,.55)}
.cd-error.in{transform:translate(-50%,-50%) scale(1)}
.cd-e-face{font-size:64px;line-height:1}.cd-e-title{font-size:20px;margin-top:10px;font-weight:600;word-break:break-word}.cd-error p{margin:8px 0 12px;font-size:14px;opacity:.9}
.cd-e-bar{display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:3px 0;font-variant-numeric:tabular-nums}
.cd-typing{left:50%;top:calc(env(safe-area-inset-top,0px) + 14px);transform:translate(-50%,-10px);background:rgba(20,20,24,.92);color:#ddd;font:500 13px/1 Rubik,system-ui,sans-serif;padding:9px 14px;border-radius:99px}
.cd-typing.in{transform:translate(-50%,0)}
.cd-typing i{display:inline-block;width:5px;height:5px;border-radius:50%;background:#ddd;margin-left:4px;animation:cdDot 1s infinite}
.cd-typing i:nth-child(2){animation-delay:.15s}.cd-typing i:nth-child(3){animation-delay:.3s}
@keyframes cdDot{0%,80%,100%{opacity:.25}40%{opacity:1}}
.cd-stamp{left:50%;top:44%;transform:translate(-50%,-50%) rotate(-12deg) scale(2.2);font:900 clamp(34px,8vw,64px)/1 "Courier New",monospace;color:#d1262b;border:6px solid #d1262b;padding:4px 16px;border-radius:8px;letter-spacing:.08em;mix-blend-mode:normal;background:rgba(255,255,255,.06)}
.cd-stamp.in{transform:translate(-50%,-50%) rotate(-12deg) scale(1);transition:transform .16s cubic-bezier(.5,0,.8,.5),opacity .1s}
.cd-replay{inset:0;opacity:0;background:rgba(0,0,0,.72);display:grid;place-items:center;align-content:center;gap:18px;border-top:9vh solid #000;border-bottom:9vh solid #000}
.cd-replay.in{opacity:1}
.cd-rp-tag{position:absolute;top:calc(9vh + 12px);left:16px;color:#ff4d4d;font:700 13px/1 Rubik,system-ui,sans-serif;letter-spacing:.12em}
.cd-rp-cards{display:flex;gap:8px;--cw:clamp(52px,12vw,84px)}
.cd-rp-cards .card{animation:cdSlow 4.4s ease-out both}
@keyframes cdSlow{from{transform:scale(.9) translateY(10px);opacity:.4}to{transform:scale(1.18);opacity:1}}
.cd-rp-cap{color:#fff;font:500 18px/1.3 Rubik,system-ui,sans-serif;text-align:center;padding:0 20px}
.cd-rarity{right:16px;top:calc(env(safe-area-inset-top,0px) + 70px);font:800 12px/1 Rubik,system-ui,sans-serif;letter-spacing:.16em;padding:7px 12px;border-radius:99px;transform:translateX(20px)}
.cd-rarity.in{transform:none}.cd-r-rare{background:#6d28d9;color:#fff}.cd-r-legendary{background:linear-gradient(90deg,#f59e0b,#fde68a,#f59e0b);color:#3a2300;box-shadow:0 0 24px rgba(245,158,11,.7)}
.cd-seat-tag{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:4px;margin-top:2px;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted,#9dbcae)}
.cd-bounty{background:#d1262b;color:#fff;padding:1px 6px;border-radius:4px;font-weight:700}
.cd-modal{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.6);display:grid;place-items:center;padding:16px;overflow:auto}
.cd-sum{width:min(420px,100%);display:grid;gap:8px}.cd-sum-h{font-weight:700;margin-top:6px;letter-spacing:.06em;font-size:12px;text-transform:uppercase}
.cd-sum .btn{justify-self:center;margin-top:6px}
.cd-n-cal{background:#fff;color:#d1262b;border:1px solid #ddd;display:grid;place-items:center}.cd-n-cal b{font-size:11px;color:#111}
.cd-mem{left:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);transform:translateY(16px);display:flex;gap:12px;align-items:center;background:#fff;color:#111;border-radius:16px;padding:10px 14px 10px 10px;box-shadow:0 10px 30px rgba(0,0,0,.4);max-width:calc(100vw - 32px);font-family:-apple-system,"Segoe UI",Roboto,Rubik,sans-serif}
.cd-mem.in{transform:none}
.cd-mem-thumb{--cw:40px;transform:rotate(-6deg)}.cd-mem-thumb .card{box-shadow:0 2px 6px rgba(0,0,0,.3)}
.cd-mem-txt{display:grid;gap:1px}.cd-mem-txt b{font-size:14px}.cd-mem-txt span{font-size:12px;color:#555}.cd-mem-txt small{font-size:11px;color:#888}
.cd-memorial{left:50%;top:40%;transform:translate(-50%,-50%);display:grid;justify-items:center;gap:6px;text-align:center;font-family:Georgia,serif;color:#e8e2d6}
.cd-mm-cards{display:flex;gap:6px;--cw:62px;filter:grayscale(1) contrast(.9);padding:8px;border:1px solid rgba(232,226,214,.5);background:rgba(0,0,0,.35)}
.cd-mm-l1{font-size:15px;letter-spacing:.06em}.cd-mm-l2{font-size:13px;font-style:italic;opacity:.85}
.cd-dim{inset:0;background:rgba(0,0,0,.55)}
.cd-mic{transform:translate(-50%,0);display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.85);color:#fff;font:500 14px/1.2 Rubik,system-ui,sans-serif;padding:8px 14px;border-radius:99px;white-space:nowrap}
.cd-mic-i{width:18px;height:18px;animation:cdPulse 1.2s ease-in-out infinite}.cd-mic.closed .cd-mic-i{animation:none;opacity:.4}
@keyframes cdPulse{50%{opacity:.35}}
.cd-cctv-on #app{filter:grayscale(1) contrast(1.25) brightness(.85)}
.cd-cctv{inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 3px),url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E");display:grid;place-items:center;align-content:center;gap:16px;animation:cdNoise .25s steps(3) infinite}
@keyframes cdNoise{50%{background-position:0 0,40px 70px}}
.cd-cctv-tag{position:absolute;top:calc(env(safe-area-inset-top,0px) + 14px);left:16px;color:#fff;font:600 13px/1 "Courier New",monospace;letter-spacing:.08em;text-shadow:0 0 4px #000}
.cd-cctv-tag::first-letter{color:#ff3b3b}
.cd-cctv-cards{display:flex;gap:6px;--cw:clamp(52px,12vw,80px);filter:grayscale(1);animation:cdSlow 4s ease-out both}
.cd-cctv-cap{font:500 17px/1.3 "Courier New",monospace;color:#fff;background:rgba(0,0,0,.7);padding:6px 12px}
.cd-tape{inset:0;display:grid;place-items:center;overflow:hidden}
.cd-tape-band{width:160vw;transform:rotate(-14deg) translateX(-40vw);background:repeating-linear-gradient(45deg,#f5c400 0 28px,#111 28px 40px);padding:6px 0;box-shadow:0 6px 18px rgba(0,0,0,.5);transition:transform .5s cubic-bezier(.2,.9,.3,1)}
.cd-tape.in .cd-tape-band{transform:rotate(-14deg) translateX(0)}
.cd-tape-band span{display:block;background:#f5c400;color:#111;font:900 18px/1.6 Rubik,system-ui,sans-serif;letter-spacing:.12em;white-space:nowrap;overflow:hidden}
.cd-archive{left:50%;top:50%;transform:translate(-50%,-46%);width:min(360px,calc(100vw - 32px));background:#c9a46a;color:#2a1c0b;padding:18px 18px 16px;border-radius:4px 14px 6px 6px;box-shadow:0 18px 40px rgba(0,0,0,.5);font-family:"Courier New",monospace}
.cd-archive.in{transform:translate(-50%,-50%)}
.cd-ar-tab{position:absolute;top:-18px;left:0;background:#c9a46a;padding:4px 14px;border-radius:6px 6px 0 0;font-weight:700;font-size:13px;letter-spacing:.08em}
.cd-ar-lines{background:#f6efe1;padding:12px;display:grid;gap:6px;font-size:13px;min-height:90px}
.cd-ar-stamp{position:absolute;right:18px;bottom:14px;transform:rotate(-12deg);color:#c0171d;border:3px solid #c0171d;font-weight:900;font-size:22px;padding:0 10px;letter-spacing:.1em}
.cd-reco{right:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);transform:translateY(16px);width:min(300px,calc(100vw - 32px));background:#0f0f0f;color:#f1f1f1;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.5);font-family:Roboto,Rubik,system-ui,sans-serif}
.cd-reco.in{transform:none}
.cd-reco-thumb{position:relative;display:flex;justify-content:center;gap:6px;padding:16px;background:#2b2b2b;--cw:46px}
.cd-reco-thumb span{position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,.85);font-size:11px;padding:1px 5px;border-radius:3px}
.cd-reco-meta{padding:10px 12px;display:grid;gap:2px}.cd-reco-meta b{font-size:14px}.cd-reco-meta small{font-size:12px;color:#aaa}
.cd-patch{left:50%;top:50%;transform:translate(-50%,-46%);width:min(400px,calc(100vw - 28px));background:#16181d;color:#e8eaef;border:1px solid #2e333d;border-radius:14px;padding:16px 18px;box-shadow:0 20px 50px rgba(0,0,0,.55);display:grid;gap:10px;font-family:Rubik,system-ui,sans-serif}
.cd-patch.in{transform:translate(-50%,-50%)}
.cd-pt-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px}.cd-pt-head code{font-size:12px;color:#8ab4f8}
.cd-patch ul{margin:0;padding-left:18px;display:grid;gap:6px;font-size:14px;line-height:1.35}
.cd-patch .btn{justify-self:end}
.cd-still{left:50%;top:44%;transform:translate(-50%,-50%);width:min(340px,calc(100vw - 32px));background:rgba(12,12,14,.94);color:#fff;border-radius:10px;padding:18px;display:grid;gap:12px;font-family:Rubik,system-ui,sans-serif;text-align:center}
.cd-st-q{font-size:17px}.cd-st-bar{height:4px;background:rgba(255,255,255,.2);border-radius:2px;overflow:hidden}.cd-st-bar span{display:block;height:100%;width:100%;background:#fff}
.cd-still .btn{justify-self:center;color:#fff}
.cd-spot{inset:0;display:grid;place-items:center;background:radial-gradient(circle at 50% 45%,transparent 0 90px,rgba(0,0,0,.82) 170px)}
.cd-spot-cards{--cw:clamp(70px,16vw,110px);animation:cdSlow 2s ease-out both}
.cd-seat-note{grid-column:1/-1;font-size:11px;color:var(--muted,#9dbcae);font-style:italic}
.cd-ribbon{position:absolute;top:0;right:0;width:26px;height:26px;background:linear-gradient(135deg,transparent 50%,#111 50%);border-top-right-radius:12px}
.seat{position:relative}
.cd-approve{position:absolute;top:-10px;right:-12px;background:#1f9d55;color:#fff;font:700 11px/1 Rubik,system-ui,sans-serif;padding:4px 8px;border-radius:99px;transform:rotate(8deg);box-shadow:0 2px 0 rgba(0,0,0,.3)}
.cd-fake-seat{opacity:.92;border-style:dashed!important;animation:cdSlideIn .4s ease-out both}
@keyframes cdSlideIn{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:.92}}
.cd-gold{box-shadow:0 0 0 2px #f2c14e inset,0 0 24px rgba(242,193,78,.6)!important}
.cd-lap-small{margin:0;font-size:12px;color:var(--muted,#9dbcae)}
.cd-credits{position:fixed;inset:0;z-index:70;background:#000;color:#fff;overflow:hidden;display:grid;place-items:center;transition:opacity .4s}
.cd-credits.out{opacity:0}
.cd-cr-roll{text-align:center;font-family:Georgia,serif;animation:cdRoll 14s linear forwards;padding:0 20px}
.cd-cr-roll p{margin:0 0 10px;font-size:16px;letter-spacing:.04em}.cd-cr-roll p:first-child{font-size:28px;letter-spacing:.2em;margin-bottom:24px}.cd-cr-gap{height:18px}
@keyframes cdRoll{from{transform:translateY(60vh)}to{transform:translateY(-110%)}}
.cd-credits .btn{position:absolute;right:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);color:#fff;border-color:#555}
@media (prefers-reduced-motion:reduce){.cd-el,.cd-el.in{transition:opacity .2s}.cd-glitch #app,.cd-rp-cards .card,.cd-typing i,.cd-cctv,.cd-cctv-cards,.cd-spot-cards,.cd-mic-i,.cd-cr-roll{animation:none}.cd-cr-roll{transform:none}}`;
  document.head.appendChild(css);

  window.CapsaStage = { play: (perf) => { queue.push(perf); run(); }, openSummary, sound, decorate, credits };
})();

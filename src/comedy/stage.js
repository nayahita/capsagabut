/*
 * Stage: plays a director performance (a list of timeline steps) on this phone.
 * Also: reputation titles and bounty tag on seats, the post-match roast summary, and preview buttons.
 * Everything renders in its own layer; nothing here reads or changes game rules.
 */
(function () {
  'use strict';
  const C = window.CAPSA_COMEDY || { sounds: {} };
  const FX = () => window.CapsaFX;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms || 0)));
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nextOf = (s) => (window.CapsaComedy ? window.CapsaComedy.nextOf(s) : (s.ms || 0));

  /* ---------- root layer ---------- */
  let root = null;
  const layer = () => { if (!root || !root.isConnected) { root = document.createElement('div'); root.className = 'cd-root'; root.setAttribute('aria-live', 'polite'); document.body.appendChild(root); } return root; };
  function put(html, cls, ms, opts) {
    const el = document.createElement('div');
    el.className = 'cd-el ' + cls;
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
  function sound(k) {
    if (!FX() || !FX().soundOn()) return;
    load(k).then((b) => {
      if (!b) return;
      if (b.fallback) { try { const a = new Audio(b.fallback); a.volume = 0.9; a.play().catch(() => {}); } catch (e) {} return; }
      const o = FX().audio(); if (!o || !o.ctx) return;
      const s = o.ctx.createBufferSource(), g = o.ctx.createGain(); s.buffer = b; g.gain.value = 0.9;
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
    return `<svg viewBox="0 0 ${W} ${H}" class="cd-svg" role="img" aria-label="Grafik">${data.map((d, i) => {
      const w = Math.max(2, ((W - lab - 46) * d.value) / max), y = i * rowH + 4;
      return `<text x="0" y="${y + 17}" class="cd-axis">${esc(String(d.label).slice(0, 18))}</text>
        <rect x="${lab}" y="${y + 4}" width="${w.toFixed(1)}" height="18" rx="3" fill="${i === 0 ? '#2563eb' : '#93a4c3'}"/>
        <text x="${lab + w + 6}" y="${y + 17}" class="cd-val">${esc(String(d.value).replace('.', ','))}${unit || ''}</text>`;
    }).join('')}</svg>`;
  };
  const flat = () => {
    let pts = []; for (let x = 0; x <= 300; x += 10) pts.push(`${x},${(70 + (Math.random() - 0.5) * 1.2).toFixed(1)}`);
    return `<svg viewBox="0 0 300 100" class="cd-svg" role="img" aria-label="Grafik datar">
      <g stroke="#e3e8f0" stroke-width="1">${[20, 45, 70, 95].map((y) => `<line x1="0" x2="300" y1="${y}" y2="${y}"/>`).join('')}</g>
      <text x="0" y="16" class="cd-axis">berani</text><text x="0" y="66" class="cd-axis">pass</text>
      <polyline points="${pts.join(' ')}" fill="none" stroke="#2563eb" stroke-width="2.5"/></svg>`;
  };

  const R = {
    wait() {},
    freeze(s) { freeze(s.ms || 2000); },
    silence(s) { if (FX()) FX().duck(s.ms || 2000); },
    sound(s) { sound(s.key); },
    effect(s) {
      const fx = FX(); if (!fx || reduced()) return;
      if (s.name === 'glitch') { document.documentElement.classList.add('cd-glitch'); setTimeout(() => document.documentElement.classList.remove('cd-glitch'), 900); return; }
      if (s.name === 'sparkle') { const [x, y] = fx.boardCenter(); fx.explode(x, y, ['#ffd166', '#fbf7ee'], 60, 6); return; }
      if (fx[s.name]) fx[s.name]();
    },
    rarity(s) { put(`<span>${s.level === 'LEGENDARY' ? '★' : '✦'}</span> ${esc(s.level)}`, `cd-rarity cd-r-${String(s.level).toLowerCase()}`, 2200); },
    caption(s) { put(esc(s.text), `cd-caption cd-${s.size || 'm'}`, s.ms || 2000); },
    banner(s) { put(esc(s.text), 'cd-banner', s.ms || 2000); },
    notify(s) {
      const el = put(`<div class="cd-n-head"><i class="cd-n-icon">${esc((s.app || 'S')[0])}</i><span class="cd-n-app">${esc(s.app || 'Sistem')}</span><span class="cd-n-time">sekarang</span></div>
        <div class="cd-n-title">${esc(s.title || '')}</div>${s.body ? `<div class="cd-n-body">${esc(s.body)}</div>` : ''}
        ${s.buttons ? `<div class="cd-n-btns">${s.buttons.map((b) => `<button type="button">${esc(b)}</button>`).join('')}</div>` : ''}`, 'cd-notif', s.ms || 4000);
      el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }));
    },
    bubble(s) { const p = seatPoint(s.seat); put(esc(s.text), 'cd-bubble', s.ms || 2500, { style: `left:${p.x}px;top:${p.y}px` }); },
    card(s) {
      const fx = FX();
      put(`<div class="cd-card-m">${fx ? fx.mascotSVG(s.mascot || 'laugh') : ''}</div><div><div class="cd-card-t">${esc(s.title)}</div><p>${esc(s.text)}</p>${s.stat ? `<small>${esc(s.stat)}</small>` : ''}</div>`,
        `cd-card cd-tone-${s.tone || 'win'}`, s.ms || 4000);
    },
    chart(s) {
      put(`<div class="cd-ch-head"><span>ANALISIS</span><b>${esc(s.title)}</b>${s.sub ? `<small>${esc(s.sub)}</small>` : ''}</div>
        ${s.kind === 'flat' ? flat() : bar(s.data || [], s.unit)}${s.note ? `<p class="cd-ch-note">${esc(s.note)}</p>` : ''}`, 'cd-chart', s.ms || 5000);
    },
    poster(s) {
      put(`<div class="cd-p-title">${esc(s.title || 'DICARI')}</div><div class="cd-p-face">${FX() ? FX().mascotSVG('cool') : ''}</div>
        <div class="cd-p-name">${esc(s.name)}</div>${s.sub ? `<div class="cd-p-sub">${esc(s.sub)}</div>` : ''}
        <div class="cd-p-reward">${esc(s.reward || '')}</div>${s.foot ? `<div class="cd-p-foot">${esc(s.foot)}</div>` : ''}`, 'cd-poster', s.ms || 4800);
    },
    receipt(s) {
      const d = new Date();
      put(`<div class="cd-rc-title">${esc(s.title || 'STRUK')}</div><div class="cd-rc-meta">${d.toLocaleDateString('id-ID')} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · KASIR: SISTEM</div>
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
    typing(s) { put('Sistem sedang mengetik<i></i><i></i><i></i>', 'cd-typing', s.ms || 3000); },
    stamp(s) { put(esc(s.text), 'cd-stamp', s.ms || 1600); },
    replay(s) {
      const fx = FX();
      const el = put(`<div class="cd-rp-tag">● ${esc(s.label || 'REPLAY')} · 0,25×</div><div class="cd-rp-cards">${(s.cards || []).map((c) => fx ? fx.cardHTML(c) : '').join('')}</div>
        ${s.caption ? `<div class="cd-rp-cap">${esc(s.caption)}</div>` : ''}`, 'cd-replay', s.ms || 4500);
      if (s.block) el.style.pointerEvents = 'auto';
    },
  };

  /* ---------- player ---------- */
  const queue = [];
  let busy = false;
  async function run() {
    if (busy || !queue.length) return;
    busy = true;
    const p = queue.shift();
    try {
      await sleep(p.delay || 0);
      for (const s of p.steps || []) { const f = R[s.do]; if (f) { try { f(s); } catch (e) { console.warn('[stage]', s.do, e); } } await sleep(nextOf(s)); }
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
    const mvp = [...names].sort((a, b) => wins(b) - wins(a))[0], sus = [...names].sort((a, b) => pen(b) - pen(a))[0];
    const bad = Object.values(M.mistakes).reduce((a, b) => a + b, 0);
    const drama = Math.min(100, 12 + bad * 6 + M.ezLosses * 15 + M.bombs * 9 + M.moments.filter((m) => m.w >= 6).length * 8);
    const top = [...M.moments].sort((a, b) => b.w - a.w || b.round - a.round).slice(0, 3);
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    return `<div class="cd-sum" role="dialog" aria-label="Laporan pertandingan">
      <div class="cd-rc-title">LAPORAN PERTANDINGAN</div>
      <div class="cd-rc-meta">${rounds} ronde · disusun oleh sistem yang tidak netral</div>
      <div class="cd-rc-lines">
        <div><span>MVP</span><span>${esc(mvp || '-')} (${wins(mvp)} menang)</span></div>
        <div><span>Tersangka utama</span><span>${esc(sus || '-')} (−${pen(sus)} poin)</span></div>
        <div><span>Keputusan buruk tercatat</span><span>${bad} (data internal)</span></div>
        <div><span>"EZ" yang tidak terbukti</span><span>${M.ezLosses}</span></div>
        <div><span>Kartu 2 dibawa mati</span><span>${M.twosDied}</span></div>
        <div><span>Bom dipakai</span><span>${M.bombs}</span></div>
        <div><span>Tingkat drama</span><span>${drama}%</span></div>
      </div>
      ${top.length ? `<div class="cd-sum-h">Momen yang akan terus diungkit</div><div class="cd-rc-lines">${top.map((m) => `<div><span>R${m.round} · ${esc(m.name)}</span><span>${esc(m.text)}</span></div>`).join('')}</div>` : ''}
      <div class="cd-sum-h">Gelar</div>
      <div class="cd-rc-lines">${names.map((n) => `<div><span>${esc(n)}</span><span>${esc(mem.title(n))}</span></div>`).join('')}</div>
      <div class="cd-rc-foot">${esc(pick(['Laporan ini akan dibahas di grup sampai minggu depan.', 'Semua pihak dimohon tidak membawa dendam. Kecuali yang perlu.', 'Tidak ada yang belajar apa pun hari ini.']))}</div>
      <button type="button" class="btn primary" data-cd-close>Tutup</button></div>`;
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
        const t = mem.title(n), hunted = bounty && bounty.key === mem.key(n);
        if (t === 'Pendatang Baru' && !hunted) return;
        const row = document.createElement('div'); row.className = 'cd-seat-tag';
        row.innerHTML = `${hunted ? '<span class="cd-bounty">BOUNTY</span>' : ''}${t !== 'Pendatang Baru' && t !== 'Warga Biasa' ? `<span>${esc(t)}</span>` : ''}`;
        if (row.textContent) seat.appendChild(row);
      });
    }
    if (v.phase === 'end' && mem.match().rounds.length >= 2) {
      const ctr = document.querySelector('.zone .controls');
      if (ctr && !ctr.querySelector('[data-cd-sum]')) { const b = document.createElement('button'); b.className = 'btn'; b.dataset.cdSum = '1'; b.textContent = 'Laporan pertandingan'; ctr.appendChild(b); }
    }
    const panel = document.querySelector('.stats-panel');
    if (panel && window.CapsaComedy && !panel.querySelector('.cd-demos')) {
      const demos = ['interesting', 'ez-callback', 'learned-nothing', 'wanted-poster', 'revenge-receipt', 'monte-carlo', 'mental-health', 'slow-replay', 'escalation', 'exe-crash', 'sealed-13', 'courtroom'];
      const div = document.createElement('div'); div.className = 'tests cd-demos';
      div.innerHTML = `<span>Tes komedi:</span>${demos.map((id) => `<button class="chip" data-cd-demo="${id}">${id}</button>`).join('')}${mem.match().rounds.length ? '<button class="chip" data-cd-sum="1">laporan</button>' : ''}`;
      panel.appendChild(div);
    }
  });
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
@media (prefers-reduced-motion:reduce){.cd-el,.cd-el.in{transition:opacity .2s}.cd-glitch #app,.cd-rp-cards .card,.cd-typing i{animation:none}}`;
  document.head.appendChild(css);

  window.CapsaStage = { play: (perf) => { queue.push(perf); run(); }, openSummary, sound };
})();

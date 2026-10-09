/*
 * Social interaction system: quick chat, emotes and voice lines that a PLAYER chooses to send.
 * (Nothing here ever sends anything on a player's behalf.)
 *
 *   tap in the panel
 *     → local checks + cooldown (this phone)
 *     → CapsaFX.social({id, seat, to, n})        core stamps the room uid and the server time
 *     → rooms/CODE/events (the same path every game effect already uses; offline: played right here)
 *     → every phone: receive(ev)
 *          validate: id in the catalog · sender is a seat in this match (online: by uid, not by the seat it claims)
 *                    · game in progress · not a duplicate · not stale · per-sender rate limit (server clock)
 *          remember: social history + 'chat' / 'emote' facts for the comedy memory (same on every phone)
 *          present (this phone only): bubble / emote under the sender's seat, optional voice line
 *                    → skipped for players muted on THIS phone, stale events, repeats, autoplay-blocked audio
 *
 * Limits and content live in src/social/catalog.js. There is no game server: every check runs on every phone,
 * so a modified client can still write junk to the room. Other phones ignore it (unknown id, wrong uid,
 * too fast), but only Firebase security rules can stop the write itself — see README "Keamanan sosial".
 */
(function () {
  'use strict';
  const C = window.CAPSA_SOCIAL;
  if (!C) return;
  const CFG = C.CONFIG;
  const FX = () => window.CapsaFX;
  const EV = () => window.CapsaEvents;
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const ID_RE = /^[a-z0-9-]{1,24}$/;
  const PLAY_PHASES = ['turn', 'handoff', 'end'];

  /* ================= catalog ================= */
  const IDX = {};
  function addQuick(list) {
    (list || []).forEach((q) => {
      if (!q || !ID_RE.test(q.id) || typeof q.text !== 'string') return;
      IDX['qc.' + q.id] = { key: 'qc.' + q.id, kind: 'quick', tone: q.cat || 'reaction', def: q, voice: C.VOICE[q.voice] ? q.voice : null };
    });
  }
  function addEmotes(list) {
    (list || []).forEach((e) => {
      if (!e || !ID_RE.test(e.id)) return;
      IDX['emo.' + e.id] = { key: 'emo.' + e.id, kind: 'emote', tone: e.tone || 'reaction', def: e, voice: C.VOICE[e.voice] ? e.voice : null };
      const fx = FX(); if (fx && fx.addEmote) fx.addEmote(e.id, e);   // so the mascot can wear it anywhere (comedy bits too)
    });
  }
  addQuick(C.QUICK); addEmotes(C.EMOTES);
  const get = (id) => (typeof id === 'string' && Object.prototype.hasOwnProperty.call(IDX, id) ? IDX[id] : null);
  const toneOf = (emoteId) => { const d = get('emo.' + emoteId); return d ? d.tone : null; };

  /* ================= settings (this phone only) ================= */
  const DEF = { voice: true, volume: 0.8, showOthers: true, muted: {} };
  const settings = Object.assign({}, DEF, store.get('capsa.social', {}));
  if (typeof settings.muted !== 'object' || !settings.muted) settings.muted = {};
  settings.volume = Math.min(1, Math.max(0, +settings.volume || 0));
  const saveSettings = () => store.set('capsa.social', settings);
  function view() { const fx = FX(); return fx ? fx.view() : null; }
  // who a seat is, stable across rounds and rooms when profiles exist
  function playerKey(v, seat) {
    if (!v || seat == null) return null;
    if (v.pids && v.pids[seat]) return v.pids[seat];
    if (v.uids && v.uids[seat]) return 'u:' + v.uids[seat];
    return 'n:' + String((v.names || [])[seat] || '').trim().toLowerCase();
  }
  const mySeat = (v) => (v && v.online ? v.me : null);
  function isMuted(seat) { const v = view(); const k = playerKey(v, seat); return !!(k && settings.muted[k] && seat !== mySeat(v)); }
  function setMuted(seat, on) {
    const v = view(), k = playerKey(v, seat); if (!k || seat === mySeat(v)) return false;
    if (on) settings.muted[k] = (v.names || [])[seat] || true; else delete settings.muted[k];
    saveSettings(); if (!on) return true;
    clearSlot(seat); stopVoice(seat); markSeats(); return true;
  }
  // should this phone hide visuals from that seat?
  function hidden(seat) { const v = view(); if (seat === mySeat(v)) return false; return isMuted(seat) || !settings.showOthers; }
  function set(key, val) {
    if (key === 'voice' || key === 'showOthers') settings[key] = !!val;
    else if (key === 'volume') settings.volume = Math.min(1, Math.max(0, +val || 0));
    else return false;
    saveSettings();
    if (key === 'voice' && !val) stopVoice();
    if (key === 'showOthers' && !val) { const v = view(); Object.keys(slots).forEach((s) => { if (+s !== mySeat(v)) clearSlot(+s); }); }
    return true;
  }

  /* ================= sending ================= */
  const cool = {};     // seat → { emote, quick, voice } (ms timestamps); per seat so pass-and-play friends don't share
  let counter = 0;
  const usage = store.get('capsa.social.usage', {});
  function canSocial(v) { return !!(v && PLAY_PHASES.includes(v.phase) && v.names && v.names.length); }
  function cooldownLeft(seat, kind) { const c = cool[seat]; return c ? Math.max(0, (c[kind] || 0) - Date.now()) : 0; }
  function send(id, opt) {
    opt = opt || {};
    const d = get(id); if (!d) return { ok: false, why: 'unknown' };
    const fx = FX(), v = view();
    if (!fx || !fx.social || !canSocial(v)) return { ok: false, why: 'state' };
    const seat = v.online ? v.me : (opt.seat != null ? opt.seat : speaker != null ? speaker : v.turn);
    if (!Number.isInteger(seat) || seat < 0 || seat >= v.names.length) return { ok: false, why: 'seat' };
    const left = cooldownLeft(seat, d.kind);
    if (left > 0) return { ok: false, why: 'cooldown', ms: left };
    const to = Number.isInteger(opt.to) && opt.to !== seat && opt.to >= 0 && opt.to < v.names.length ? opt.to : null;
    const now = Date.now(), c = cool[seat] = cool[seat] || {};
    c[d.kind] = now + CFG.cooldown[d.kind];
    if (d.voice && (c.voice || 0) <= now) c.voice = now + CFG.cooldown.voice;
    const n = (++counter).toString(36) + Math.random().toString(36).slice(2, 7);
    usage[id] = (usage[id] || 0) + 1; store.set('capsa.social.usage', usage);
    return { ok: fx.social({ id, seat, to, n }) !== false };
  }

  /* ================= receiving ================= */
  const seen = new Map();       // uid|nonce → ts
  const per = {};               // seat → rate/repeat state
  const R = CFG.receive;
  function remember(key, ts) { seen.set(key, ts); if (seen.size > 300) seen.delete(seen.keys().next().value); }
  function receive(ev) {
    const res = { ok: false, why: '' };
    if (!ev || ev.t !== 'social') { res.why = 'type'; return res; }
    const fx = FX(), v = view();
    const d = get(ev.id); if (!d) { res.why = 'unknown-id'; return res; }
    if (typeof ev.n !== 'string' || !ev.n || ev.n.length > 24) { res.why = 'nonce'; return res; }
    let seat;
    if (v && v.online) {
      // online the room uid decides who sent it; the seat number in the event is not trusted
      seat = typeof ev.uid === 'string' && Array.isArray(v.uids) ? v.uids.indexOf(ev.uid) : -1;
      if (seat < 0) { res.why = 'not-member'; return res; }
    } else {
      seat = ev.seat;
      if (!v || !Number.isInteger(seat) || seat < 0 || seat >= (v.names || []).length) { res.why = 'seat'; return res; }
    }
    if (!canSocial(v)) { res.why = 'state'; return res; }
    const now = fx.serverNow ? fx.serverNow() : Date.now();
    const ts = typeof ev.ts === 'number' && isFinite(ev.ts) ? ev.ts : now;
    const age = now - ts;
    if (age > R.rememberMs) { res.why = 'stale'; return res; }
    const dupKey = (ev.uid || 'local') + '|' + ev.n;
    if (seen.has(dupKey)) { res.why = 'duplicate'; return res; }
    remember(dupKey, ts);
    const P = per[seat] = per[seat] || { last: {}, times: [], voiceAt: -Infinity, lastId: null, lastIdAt: -Infinity, shownTs: -Infinity };
    const prev = P.last[d.kind];
    if (prev != null && Math.abs(ts - prev) < R.minGapMs[d.kind]) { res.why = 'rate'; return res; }
    P.times = P.times.filter((t) => Math.abs(ts - t) < R.burst.ms);
    if (P.times.length >= R.burst.n) { res.why = 'rate'; return res; }
    P.last[d.kind] = ts; P.times.push(ts);
    const to = Number.isInteger(ev.to) && ev.to !== seat && ev.to >= 0 && ev.to < v.names.length ? ev.to : null;
    const repeat = P.lastId === d.key && ts - P.lastIdAt < R.repeatMs;
    P.lastId = d.key; P.lastIdAt = ts;

    const entry = { t: ts, round: v.round || 0, seat, name: v.names[seat], who: playerKey(v, seat), to, toName: to != null ? v.names[to] : null,
      id: d.key, kind: d.kind, tone: d.tone, repeat, voiced: false };
    log(entry, v);
    Object.assign(res, { ok: true, seat, entry });

    // ----- presentation: this phone only -----
    const out = age > R.freshVisualMs || ts < P.shownTs;
    if (out) { res.why = 'late'; return res; }
    P.shownTs = ts;
    if (hidden(seat)) { res.why = 'hidden'; return res; }
    res.drawn = draw(entry, d);
    if (!repeat && age <= R.freshVoiceMs) {
      if (d.voice && voiceAllowed(seat, v, ts)) { res.voice = playVoice(d.voice, seat); entry.voiced = !!res.voice; if (res.voice) P.voiceAt = ts; }
      if (!res.voice && d.kind === 'emote' && d.def.sfx && fx.emoteSfx) fx.emoteSfx(d.def.sfx);
    }
    return res;
  }
  function voiceAllowed(seat, v, ts) {
    const fx = FX();
    if (!settings.voice || !fx.soundOn || !fx.soundOn()) return false;
    if (isMuted(seat)) return false;
    if (v.online && v.sameRoom && seat !== v.me) return false;   // one table, one room: the voice comes out of the sender's phone
    return ts - ((per[seat] || {}).voiceAt || -Infinity) >= R.voiceGapMs;
  }

  /* ================= history (match-scoped, for future rivalry/comeback features) ================= */
  const H = [];
  function log(entry, v) {
    const prevOther = [...H].reverse().find((h) => h.seat !== entry.seat && entry.t - h.t < 8000 && (h.to == null || h.to === entry.seat));
    H.push(entry); if (H.length > 200) H.shift();
    const E = EV(); if (!E) return;
    const def = get(entry.id).def;
    // the comedy memory hears quick chat as chat, emotes as emotes: callbacks like "EZ … then lost" keep working
    if (entry.kind === 'quick') {
      E.ingest('chat', { seat: entry.seat, name: entry.name, text: (entry.toName ? '@' + entry.toName + ' ' : '') + def.text, target: entry.to,
        counts: (v.counts || []).slice(), trash: !!def.trash, prediction: !!def.prediction, confession: !!def.confession, qc: entry.id });
    } else {
      E.ingest('emote', { seat: entry.seat, name: entry.name, e: def.id, tone: entry.tone, taunt: entry.tone === 'taunt', target: entry.to });
    }
    E.emit('fact:social', Object.assign({}, entry));
    if (prevOther) E.emit('fact:social:reply', { seat: entry.seat, name: entry.name, id: entry.id, tone: entry.tone, to: prevOther.seat, toName: prevOther.name, replyTo: prevOther.id, replyTone: prevOther.tone, ms: entry.t - prevOther.t });
  }
  const history = {
    all: (f) => H.filter((h) => !f || Object.keys(f).every((k) => h[k] === f[k])).map((h) => Object.assign({}, h)),
    // taunts aimed at a seat: direct ones (to === seat) and, unless direct-only, table-wide ones from others
    tauntsReceived: (seat, o) => H.filter((h) => h.tone === 'taunt' && h.seat !== seat && (h.to === seat || (!(o && o.direct) && h.to == null))
      && (!(o && o.round != null) || h.round === o.round)).length,
    // did `a` answer something `b` sent within ms?
    respondedTo: (a, b, ms) => H.some((h, i) => h.seat === b && H.slice(i + 1).some((x) => x.seat === a && x.t - h.t <= (ms || 8000))),
    lastBy: (seat, tone) => { for (let i = H.length - 1; i >= 0; i--) if (H[i].seat === seat && (!tone || H[i].tone === tone)) return Object.assign({}, H[i]); return null; },
    summary: (round) => {
      const s = {};
      H.forEach((h) => {
        if (round != null && h.round !== round) return;
        const a = s[h.seat] = s[h.seat] || { name: h.name, sent: {}, tauntsIn: 0 };
        a.sent[h.tone] = (a.sent[h.tone] || 0) + 1;
        if (h.tone === 'taunt' && h.to != null) { const b = s[h.to] = s[h.to] || { name: h.toName, sent: {}, tauntsIn: 0 }; b.tauntsIn++; }
      });
      return s;
    },
  };
  if (EV()) {
    EV().on('fact:game:start', () => { H.length = 0; seen.clear(); Object.keys(per).forEach((k) => delete per[k]); Object.keys(cool).forEach((k) => delete cool[k]); });
    // lightweight hooks for a later "social tension" layer; nothing reacts to them yet except whoever subscribes
    EV().on('fact:round:end', (d) => {
      const w = d && d.winner; if (w == null) return;
      const taunts = history.tauntsReceived(w, { round: d.round });
      if (taunts >= 2) EV().emit('fact:social:payoff', { kind: 'taunted-winner', seat: w, name: (d.names || [])[w], taunts, round: d.round });
      const called = H.find((h) => h.seat === w && h.round === d.round && h.tone === 'confidence');
      if (called) EV().emit('fact:social:payoff', { kind: 'called-it', seat: w, name: called.name, id: called.id, round: d.round });
    });
    EV().on('fact:player:leave', (d) => { if (d && d.seat != null) { clearSlot(d.seat); stopVoice(d.seat); } });
  }

  /* ================= voice lines ================= */
  const bufs = {};
  let vbus = { until: 0, seat: null, nodes: [] };
  const vlog = [];
  const vnote = (s) => { vlog.push(s); if (vlog.length > 40) vlog.shift(); };
  function load(file, ctx) {
    if (bufs[file]) return bufs[file];
    bufs[file] = (async () => {
      try {
        if (typeof fetch !== 'function') return null;
        const r = await fetch(file); if (!r.ok) return null;
        const ab = await r.arrayBuffer();
        return await new Promise((ok, no) => ctx.decodeAudioData(ab, ok, no));
      } catch (e) { return null; }
    })();
    return bufs[file];
  }
  function playVoice(vid, seat) {
    const V = C.VOICE[vid]; if (!V) return false;
    const o = FX().audio && FX().audio();
    if (!o || !o.ctx) { vnote('no-audio ' + vid); return false; }
    if (o.ctx.state !== 'running') { vnote('blocked ' + vid); return false; }   // autoplay not unlocked yet: never queue it for later
    const now = Date.now();
    if (vbus.until > now) { vnote('busy ' + vid); return false; }
    vbus = { until: now + CFG.voice.maxMs, seat, nodes: [] };
    const mine = vbus;
    load(V.file, o.ctx).then((buf) => {
      if (vbus !== mine) return;                      // stopped (mute, disconnect) while loading
      if (buf) { playBuffer(o, buf, mine); vnote('file ' + vid); }
      else if (CFG.voice.placeholder) { babble(o, V, vid, mine); vnote('placeholder ' + vid); }
      else vnote('missing ' + vid);
    });
    return true;
  }
  function outGain(o, mine) {
    const g = o.ctx.createGain(); g.gain.value = settings.volume; g.connect(o.out || o.ctx.destination); mine.nodes.push(g); return g;
  }
  function playBuffer(o, buf, mine) {
    const src = o.ctx.createBufferSource(); src.buffer = buf; src.connect(outGain(o, mine));
    const t = o.ctx.currentTime; src.start(t); src.stop(t + Math.min(buf.duration, CFG.voice.maxMs / 1000));
    mine.nodes.push(src); mine.until = Date.now() + Math.min(buf.duration * 1000, CFG.voice.maxMs);
  }
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  // placeholder: a few "syllables" of formant-filtered tone in the archetype's pitch (original, no recordings)
  function babble(o, V, vid, mine) {
    const A = C.ARCHETYPES[V.archetype] || C.ARCHETYPES.stoic, ctx = o.ctx;
    let seed = hash(vid); const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const n = Math.max(2, Math.min(7, Math.round(String(V.line || '').length / 3)));
    const out = outGain(o, mine); out.gain.value = 0.32 * settings.volume;
    const t0 = ctx.currentTime + 0.02, F = [700, 1000, 1300, 1900, 2400];
    for (let i = 0; i < n; i++) {
      const t = t0 + i * A.syl * 1.12, dur = A.syl * (i === n - 1 ? 1.6 : 0.9);
      const osc = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      osc.type = A.wave;
      const f = A.f0 * (1 + A.glide * (i / Math.max(1, n - 1))) * (1 + (rnd() - 0.5) * 0.14);
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.linearRampToValueAtTime(f * (1 + (rnd() - 0.5) * A.vib * 4), t + dur);
      bp.type = 'bandpass'; bp.frequency.value = F[Math.floor(rnd() * F.length)]; bp.Q.value = 3.5;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(bp).connect(g).connect(out); osc.start(t); osc.stop(t + dur + 0.02);
      mine.nodes.push(osc);
    }
    mine.until = Date.now() + Math.min(CFG.voice.maxMs, n * A.syl * 1120 + 200);
  }
  function stopVoice(seat) {
    if (seat != null && vbus.seat !== seat) return;
    vbus.nodes.forEach((x) => { try { if (x.stop) x.stop(); else if (x.disconnect) x.disconnect(); } catch (e) {} });
    vbus = { until: 0, seat: null, nodes: [] };
  }

  /* ================= drawing: one social slot per seat ================= */
  const slots = {};   // seat → { el, timer }
  function clearSlot(seat) {
    const s = slots[seat]; if (!s) return;
    clearTimeout(s.timer); clearTimeout(s.fade); if (s.el && s.el.remove) s.el.remove(); delete slots[seat];
  }
  function anchor(seat) {
    const el = typeof document.getElementById === 'function' ? document.getElementById('seat-' + seat) : null;
    return el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
  }
  function draw(entry, d) {
    if (typeof document === 'undefined' || !document.body || typeof document.getElementById !== 'function') return false;
    clearSlot(entry.seat);
    const fx = FX(), el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    const from = esc(entry.name) + (entry.toName ? ' → ' + esc(entry.toName) : '');
    if (d.kind === 'emote') {
      el.className = 'emote-pop soc-pop' + (entry.repeat ? ' soc-repeat' : '');
      el.innerHTML = `${fx.mascotSVG(d.def.id)}<div class="say">${esc(d.def.say || d.def.label)}</div><div class="from">${from}</div>`;
    } else {
      el.className = 'soc-bubble soc-' + d.tone + (entry.repeat ? ' soc-repeat' : '');
      el.innerHTML = `<span class="soc-from">${from}</span><span class="soc-text"></span>`;
      el.querySelector('.soc-text').textContent = d.def.text;
    }
    document.body.appendChild(el);
    place(el, entry.seat);
    const ms = d.kind === 'emote' ? CFG.display.emoteMs : CFG.display.bubbleMs;
    const s = slots[entry.seat] = { el, timer: setTimeout(() => clearSlot(entry.seat), ms + 400) };
    if (d.kind !== 'emote') s.fade = setTimeout(() => el.classList.add('out'), ms);
    if (entry.to != null && typeof document.getElementById === 'function') {
      const t = document.getElementById('seat-' + entry.to);
      if (t) { t.classList.remove('soc-poked'); void t.offsetWidth; t.classList.add('soc-poked'); setTimeout(() => t.classList.remove('soc-poked'), 900); }
    }
    return true;
  }
  function place(el, seat) {
    const r = anchor(seat), W = innerWidth;
    const x = r ? r.left + r.width / 2 : W / 2;
    let y = r ? r.bottom + 4 : innerHeight / 3;
    const w = el.offsetWidth || 120, half = w / 2 + 6;
    el.style.left = Math.min(Math.max(x, half), W - half) + 'px';
    // don't stack on top of a neighbour's bubble: step down below any overlapping slot
    Object.keys(slots).forEach((k) => {
      const o = slots[k]; if (!o || o.el === el || !o.el.getBoundingClientRect) return;
      const b = o.el.getBoundingClientRect(), l = parseFloat(el.style.left) - w / 2;
      if (l < b.right && l + w > b.left && y < b.bottom && y + (el.offsetHeight || 40) > b.top) y = b.bottom + 4;
    });
    el.style.top = Math.min(y, innerHeight - (el.offsetHeight || 40) - 160) + 'px';
  }

  /* ================= panel ================= */
  let open = false, tab = 'fav', speaker = null, target = null, panelEl = null, msgT = 0, coolT = 0, swallowUntil = 0;
  const TABS = [{ id: 'fav', label: '★' }, { id: 'emote', label: 'Emote' }].concat(C.CATEGORIES.map((c) => ({ id: c.id, label: c.label })));
  function favorites() {
    const top = (prefix, list, defaults, k) => {
      const ranked = list.map((x) => prefix + x.id).filter((id) => usage[id] >= 2).sort((a, b) => usage[b] - usage[a]);
      const out = []; ranked.concat(defaults.map((x) => prefix + x)).forEach((id) => { if (get(id) && !out.includes(id)) out.push(id); });
      return out.slice(0, k);
    };
    return { emotes: top('emo.', C.EMOTES, CFG.favorites.emotes, 4), quick: top('qc.', C.QUICK, CFG.favorites.quick, 4) };
  }
  function emoBtn(id) {
    const d = get(id), fx = FX();
    return `<button type="button" class="soc-emo" data-social="${id}" aria-label="Emote ${esc(d.def.label)}">${fx.mascotSVG(d.def.id).replace('m-' + d.def.id, 'm-icon')}<span>${esc(d.def.label)}${d.voice ? ' <i aria-hidden="true">🔊</i>' : ''}</span></button>`;
  }
  function qcBtn(id) {
    const d = get(id);
    return `<button type="button" class="chip soc-qc soc-${d.tone}" data-social="${id}">${esc(d.def.text)}${d.voice ? ' <i aria-hidden="true">🔊</i>' : ''}</button>`;
  }
  function bodyHTML(v) {
    if (tab === 'fav') { const f = favorites(); return `<div class="soc-grid">${f.emotes.map(emoBtn).join('')}</div><div class="soc-chips">${f.quick.map(qcBtn).join('')}</div>`; }
    if (tab === 'emote') {
      const packs = [...new Set(C.EMOTES.map((e) => e.pack || 'Dasar'))];
      return packs.map((p) => `${packs.length > 1 ? `<div class="soc-lbl">${esc(p)}</div>` : ''}<div class="soc-grid">${C.EMOTES.filter((e) => (e.pack || 'Dasar') === p && get('emo.' + e.id)).map((e) => emoBtn('emo.' + e.id)).join('')}</div>`).join('');
    }
    if (tab === 'set') {
      const me = v.online ? v.me : null, fx = FX();
      const others = v.names.map((n, i) => (i === me ? '' : `<button type="button" class="chip" data-soc-mute="${i}" aria-pressed="${isMuted(i)}">${isMuted(i) ? '🔇 ' : ''}${esc(n)}</button>`)).join('');
      return `<label class="soc-set"><input type="checkbox" data-soc-set="voice"${settings.voice ? ' checked' : ''}> Voice line</label>
        <label class="soc-set soc-vol">Volume voice <input type="range" min="0" max="100" step="5" value="${Math.round(settings.volume * 100)}" data-soc-set="volume" aria-label="Volume voice line"></label>
        <label class="soc-set"><input type="checkbox" data-soc-set="showOthers"${settings.showOthers ? ' checked' : ''}> Tampilkan emote &amp; quick chat orang lain</label>
        <div class="soc-lbl">Bisukan pemain (cuma di HP lu)</div><div class="soc-chips">${others}</div>
        <p class="soc-note">${fx.soundOn && fx.soundOn() ? 'Suara game: atur di pilihan Suara.' : 'Suara game lagi Mati, voice line ikut diam. Emote &amp; chat tetap jalan.'}</p>`;
    }
    return `<div class="soc-chips">${C.QUICK.filter((q) => q.cat === tab).map((q) => qcBtn('qc.' + q.id)).join('')}</div>`;
  }
  function panelHTML(v) {
    const n = v.names.length, me = v.online ? v.me : speaker;
    const who = v.online ? '' : `<div class="soc-row"><span class="soc-lbl">Sebagai</span>${v.names.map((nm, i) => `<button type="button" class="chip" data-soc-who="${i}" aria-pressed="${i === speaker}">${esc(nm)}</button>`).join('')}</div>`;
    const to = n > 2 && tab !== 'set' ? `<div class="soc-row"><span class="soc-lbl">Ke</span><button type="button" class="chip" data-soc-to="" aria-pressed="${target == null}">Semua</button>${v.names.map((nm, i) => (i === me ? '' : `<button type="button" class="chip" data-soc-to="${i}" aria-pressed="${i === target}">@${esc(nm)}</button>`)).join('')}</div>` : '';
    return `<div class="soc-head"><div class="soc-tabs" role="tablist">${TABS.map((t) => `<button type="button" role="tab" class="soc-tab" data-soc-tab="${t.id}" aria-selected="${t.id === tab}"${t.aria ? ` aria-label="${t.aria}"` : ''}>${t.label}</button>`).join('')}</div>
      <button type="button" class="soc-x" data-soc-tab="set" aria-label="Pengaturan" aria-pressed="${tab === 'set'}">⚙</button>
      <button type="button" class="soc-x" data-soc-close aria-label="Tutup">✕</button></div>${who}${to}
      <div class="soc-body">${bodyHTML(v)}</div><div class="soc-msg" role="status" aria-live="polite"></div>`;
  }
  function openPanel(seat) {
    const v = view(); if (!canSocial(v)) return false;
    if (!v.online) speaker = Number.isInteger(seat) ? seat : (speaker != null && speaker < v.names.length ? speaker : v.turn);
    if (target != null && (target >= v.names.length || target === (v.online ? v.me : speaker))) target = null;
    open = true; refresh(); return true;
  }
  function closePanel() { open = false; refresh(); }
  function refresh() {
    if (typeof document === 'undefined' || !document.body || typeof document.getElementById !== 'function') return;
    const v = view();
    if (!open || !canSocial(v)) { open = false; if (panelEl) panelEl.remove(); panelEl = null; syncOpeners(); return; }
    if (!panelEl) { panelEl = document.createElement('div'); panelEl.className = 'soc-panel'; panelEl.setAttribute('role', 'dialog'); panelEl.setAttribute('aria-label', 'Emote dan quick chat'); document.body.appendChild(panelEl); }
    const sc = panelEl.querySelector('.soc-body'), keep = sc ? sc.scrollTop : 0;
    panelEl.innerHTML = panelHTML(v);
    const nb = panelEl.querySelector('.soc-body'); if (nb) nb.scrollTop = keep;
    position(); markCooling(); syncOpeners();
  }
  function position() {
    if (!panelEl) return;
    const hand = document.querySelector('.zone .hand') || document.querySelector('.zone');
    const top = hand ? hand.getBoundingClientRect().top : innerHeight;
    const room = top - 10 - 8;
    if (room >= 190) { panelEl.style.bottom = (innerHeight - top + 8) + 'px'; panelEl.style.maxHeight = Math.min(room, 360) + 'px'; }
    else { panelEl.style.bottom = 'calc(env(safe-area-inset-bottom,0px) + 8px)'; panelEl.style.maxHeight = 'min(360px, 60vh)'; }
  }
  function markCooling() {
    if (!panelEl) return;
    const v = view(), seat = v.online ? v.me : speaker; let next = 0;
    ['emote', 'quick'].forEach((k) => {
      const left = cooldownLeft(seat, k);
      panelEl.querySelectorAll(`[data-social^="${k === 'emote' ? 'emo.' : 'qc.'}"]`).forEach((b) => { b.classList.toggle('cooling', left > 0); if (left > 0) b.style.setProperty('--cd', left + 'ms'); });
      if (left > 0) next = next ? Math.min(next, left) : left;
    });
    const vl = cooldownLeft(seat, 'voice');
    panelEl.classList.toggle('voice-cooling', vl > 0);
    if (vl > 0) next = next ? Math.min(next, vl) : vl;
    clearTimeout(coolT); if (next) coolT = setTimeout(markCooling, next + 30);
  }
  function msg(t) {
    const m = panelEl && panelEl.querySelector('.soc-msg'); if (!m) return;
    m.textContent = t; clearTimeout(msgT); msgT = setTimeout(() => { if (m) m.textContent = ''; }, 1800);
  }
  function syncOpeners() {
    document.querySelectorAll('[data-social-open]').forEach((b) => b.setAttribute('aria-expanded', open));
  }
  function markSeats() {
    if (typeof document.getElementById !== 'function') return;
    const v = view(); if (!v || !v.names) return;
    v.names.forEach((_, i) => { const s = document.getElementById('seat-' + i); if (s) s.classList.toggle('soc-muted', isMuted(i)); });
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('capsa:social', (e) => receive(e.detail));
    document.addEventListener('capsa:render', () => {
      const v = view();
      if (!canSocial(v)) { Object.keys(slots).forEach((s) => clearSlot(+s)); if (open) closePanel(); return; }
      // a player who dropped out leaves nothing behind on screen
      (v.offline || []).forEach((off, i) => { if (off) { clearSlot(i); stopVoice(i); } });
      Object.keys(slots).forEach((s) => { const o = slots[s]; if (o && o.el.isConnected) place(o.el, +s); });
      markSeats();
      const head = document.querySelector('.zone .zone-head');
      if (head && !head.querySelector('[data-social-open]') && (!v.online || v.me != null)) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn soc-open'; b.dataset.socialOpen = '1';
        b.setAttribute('aria-label', 'Emote dan quick chat'); b.setAttribute('aria-expanded', open);
        b.innerHTML = FX().mascotSVG('smirk').replace('m-smirk', 'm-icon') + '<span>Emote</span>';
        const sh = head.querySelector('[data-showhand]'); if (sh) head.insertBefore(b, sh); else head.appendChild(b);
      }
      if (open) { if (!panelEl || !panelEl.isConnected) refresh(); else { position(); syncOpeners(); } }
    });
    // taps that close the panel never reach the table (no accidental card picks)
    document.addEventListener('pointerdown', (e) => {
      if (!open || !panelEl) return;
      const t = e.target;
      if (panelEl.contains(t) || (t.closest && t.closest('[data-social-open],[data-emote-open]'))) return;
      swallowUntil = Date.now() + 800; closePanel();
      e.preventDefault(); e.stopPropagation();
    }, true);
    document.addEventListener('click', (e) => {
      const t = e.target && e.target.closest ? e.target : null;
      if (swallowUntil && Date.now() < swallowUntil && !(panelEl && t && panelEl.contains(t))) { swallowUntil = 0; e.preventDefault(); e.stopPropagation(); return; }
      if (!t) return;
      const b = t.closest('[data-social],[data-soc-tab],[data-soc-close],[data-soc-who],[data-soc-to],[data-soc-mute],[data-social-open],[data-emote-open]');
      if (!b) return;
      e.stopPropagation(); e.preventDefault();
      const d = b.dataset;
      if (d.socialOpen != null) { if (open) closePanel(); else openPanel(); }
      else if (d.emoteOpen != null) { const i = +d.emoteOpen; if (open && speaker === i) closePanel(); else openPanel(i); }   // the seat's mascot button
      else if (d.socClose != null) closePanel();
      else if (d.socTab) { tab = d.socTab; refresh(); }
      else if (d.socWho != null) { speaker = +d.socWho; if (target === speaker) target = null; refresh(); }
      else if (d.socTo != null) { target = d.socTo === '' ? null : +d.socTo; refresh(); }
      else if (d.socMute != null) { const i = +d.socMute; setMuted(i, !isMuted(i)); refresh(); }
      else if (d.social) {
        const r = send(d.social, { to: target });
        if (r.ok) { target = null; closePanel(); }
        else if (r.why === 'cooldown') { msg(`Sabar, ${(r.ms / 1000).toFixed(1)} detik lagi.`); b.classList.remove('soc-shake'); void b.offsetWidth; b.classList.add('soc-shake'); }
        else msg('Belum bisa kirim sekarang.');
      }
    }, true);
    document.addEventListener('change', (e) => {
      const k = e.target && e.target.dataset && e.target.dataset.socSet; if (!k) return;
      set(k, e.target.type === 'checkbox' ? e.target.checked : (+e.target.value) / 100);
    });
    document.addEventListener('input', (e) => { const k = e.target && e.target.dataset && e.target.dataset.socSet; if (k === 'volume') set(k, (+e.target.value) / 100); });
    document.addEventListener('keydown', (e) => { if (open && e.key === 'Escape') closePanel(); });
    if (typeof addEventListener === 'function') addEventListener('resize', () => { if (open) position(); });
  }

  if (typeof document !== 'undefined' && document.createElement && document.head) {
    const css = document.createElement('style');
    css.textContent = `
.soc-open{display:inline-flex;align-items:center;gap:6px;margin-left:auto}
.soc-open .mascot{width:18px;height:22px}
.zone-head .soc-open + .showhand-btn{margin-left:0}
.soc-open[aria-expanded="true"]{border-color:#e2b04f;color:#e2b04f}
.soc-panel{position:fixed;left:50%;transform:translateX(-50%);z-index:56;width:min(520px,calc(100vw - 16px));display:flex;flex-direction:column;background:#0f241f;border:1px solid #e2b04f;border-radius:16px;box-shadow:0 14px 34px rgba(0,0,0,.55);color:#eef3ea;overflow:hidden;animation:socUp .14s ease-out both}
.soc-head{display:flex;align-items:center;gap:4px;padding:6px 6px 0 6px}
.soc-tabs{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;flex:1}.soc-tabs::-webkit-scrollbar{display:none}
.soc-tab{flex:none;background:none;border:0;border-bottom:2px solid transparent;color:#9dbcae;font:600 13px/1 Rubik,system-ui,sans-serif;padding:9px 9px 8px;cursor:pointer}
.soc-tab[aria-selected="true"]{color:#e2b04f;border-bottom-color:#e2b04f}
.soc-x[aria-pressed="true"]{border-color:#e2b04f;color:#e2b04f}
.soc-x{flex:none;width:36px;height:36px;border-radius:10px;border:1px solid #2f5a4b;background:none;color:#eef3ea;font-size:15px;cursor:pointer}
.soc-row{display:flex;gap:5px;align-items:center;padding:6px 10px 0;overflow-x:auto;scrollbar-width:none}.soc-row::-webkit-scrollbar{display:none}
.soc-row .chip{flex:none}
.soc-lbl{flex:none;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#9dbcae;margin:2px 4px 2px 0}
.soc-panel .chip[aria-pressed="true"]{border-color:#e2b04f;color:#e2b04f}
.soc-body{overflow-y:auto;padding:8px 10px 4px;display:grid;gap:8px;overscroll-behavior:contain}
.soc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(68px,1fr));gap:6px}
.soc-emo{display:flex;flex-direction:column;align-items:center;gap:2px;background:rgba(255,255,255,.04);border:1px solid #2f5a4b;border-radius:12px;padding:6px 2px 5px;color:#eef3ea;font:500 11px/1.15 Rubik,system-ui,sans-serif;cursor:pointer;min-height:76px;transition:transform .1s,opacity .2s}
.soc-emo:active{transform:scale(.94)}
.soc-emo .mascot{width:38px;height:46px}
.soc-emo span{text-align:center}
.soc-chips{display:flex;flex-wrap:wrap;gap:6px}
.soc-qc{min-height:36px;transition:opacity .2s}
.soc-qc.soc-taunt{border-color:rgba(255,122,69,.55)}.soc-qc.soc-respect{border-color:rgba(120,200,150,.55)}.soc-qc.soc-confidence{border-color:rgba(226,176,79,.6)}
.soc-panel i{font-style:normal;font-size:10px;opacity:.75}
.soc-panel.voice-cooling i{opacity:.25}
.soc-panel .cooling{opacity:.42}
.soc-msg{min-height:18px;padding:0 12px 8px;font-size:12px;color:#ff9b73}
.soc-set{display:flex;align-items:center;gap:8px;font-size:14px;min-height:34px}
.soc-set input[type=checkbox]{width:20px;height:20px;accent-color:#e2b04f}
.soc-vol input{flex:1;accent-color:#e2b04f}
.soc-note{margin:2px 0 0;font-size:12px;color:#9dbcae}
.soc-shake{animation:socShake .3s}
.soc-bubble{position:fixed;z-index:47;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;background:#fff;color:#111;padding:5px 11px 6px;border-radius:12px;box-shadow:0 3px 0 rgba(0,0,0,.35);pointer-events:none;max-width:min(220px,46vw);text-align:center;animation:socPop .28s cubic-bezier(.2,1.5,.4,1) both;transition:opacity .35s}
.soc-bubble .soc-from{font:600 9.5px/1.2 Rubik,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#6a6a6a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.soc-bubble .soc-text{font:700 15px/1.2 Rubik,system-ui,sans-serif}
.soc-bubble.soc-taunt{background:#ffe9df}.soc-bubble.soc-respect{background:#e6f6ec}.soc-bubble.soc-confidence{background:#fff4d6}
.soc-bubble.out{opacity:0}
.soc-repeat{opacity:.7}.soc-bubble.soc-repeat{transform:translateX(-50%) scale(.85)}.soc-pop.soc-repeat .mascot{width:56px}
.seat.soc-poked{animation:socShake .45s ease 2}
.seat.soc-muted .nm::after{content:" 🔇";font-size:11px}
.m-skull .m-soul{transform-box:fill-box;animation:socSoul 1.4s ease-out infinite}
.m-sweat .m-drop{transform-box:fill-box;animation:socDrop .9s ease-in infinite}
.m-clap .m-hl{transform-box:fill-box;transform-origin:right;animation:socClapL .5s ease-in-out infinite alternate}
.m-clap .m-hr{transform-box:fill-box;transform-origin:left;animation:socClapR .5s ease-in-out infinite alternate}
.m-salute .m-salute{transform-box:fill-box;transform-origin:left bottom;animation:socSalute .5s cubic-bezier(.3,1.6,.5,1) .1s both}
.m-villain .m-body{animation:jiggle .25s ease-in-out infinite alternate}
.m-facepalm .m-palm{transform-box:fill-box;animation:socPalm .35s cubic-bezier(.3,1.6,.5,1) both}
.m-smirk .m-body{animation:socTilt .6s ease-out both}
.m-stare .m-dots circle{animation:socDots 1.2s steps(1) infinite}.m-stare .m-dots circle:nth-child(2){animation-delay:.3s}.m-stare .m-dots circle:nth-child(3){animation-delay:.6s}
@keyframes socUp{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes socPop{from{opacity:0;transform:translateX(-50%) translateY(8px) scale(.7)}to{opacity:1;transform:translateX(-50%)}}
@keyframes socShake{0%,100%{transform:none}30%{transform:translateX(-4px)}60%{transform:translateX(4px)}}
@keyframes socSoul{0%{transform:translateY(8px);opacity:0}30%{opacity:1}100%{transform:translateY(-14px);opacity:0}}
@keyframes socDrop{0%{transform:translateY(0);opacity:1}100%{transform:translateY(14px);opacity:0}}
@keyframes socClapL{from{transform:translateX(0)}to{transform:translateX(6px)}}
@keyframes socClapR{from{transform:translateX(0)}to{transform:translateX(-6px)}}
@keyframes socSalute{from{transform:rotate(30deg) scale(.4)}to{transform:none}}
@keyframes socPalm{from{transform:translateY(-18px)}to{transform:none}}
@keyframes socTilt{from{transform:rotate(-8deg)}to{transform:none}}
@keyframes socDots{0%{opacity:.15}50%{opacity:1}}
@media (max-width:600px){
  .soc-open span{display:none}.soc-open{padding:4px 8px}
  .soc-bubble{max-width:min(170px,44vw);padding:4px 9px 5px}.soc-bubble .soc-text{font-size:13px}
  .soc-grid{grid-template-columns:repeat(4,1fr)}
  .soc-emo .mascot{width:32px;height:39px}.soc-emo{min-height:68px}
}
@media (prefers-reduced-motion:reduce){.soc-panel,.soc-bubble,.soc-shake,.seat.soc-poked,.soc-pop .mascot *{animation:none!important}}`;
    document.head.appendChild(css);
  }

  window.CapsaSocial = {
    send, receive, open: openPanel, close: closePanel, isOpen: () => open,
    settings: () => JSON.parse(JSON.stringify(settings)), set, isMuted, setMuted, hidden,
    history, catalog: { get, ids: () => Object.keys(IDX), toneOf, addEmotes, addQuick },
    voice: { log: () => vlog.slice(), busy: () => vbus.until > Date.now(), stop: stopVoice },
    cooldownLeft, _slots: () => Object.keys(slots).length, _state: () => ({ seen: seen.size, history: H.length, per: Object.keys(per).length }),
  };
})();

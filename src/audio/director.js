/*
 * Audio Director: the one place that decides whether, where and how a comedy sound plays.
 *
 * Bits name a cue by FUNCTION (or an old file key, mapped below). The director:
 *   - resolves the cue to a file (seeded by the performance id, so every phone picks the same variant)
 *   - keeps the comedy bus exclusive (one comedy sound at a time; a late one waits ≤1.5 s or is dropped)
 *   - applies tier cooldowns (repeats of the same cue degrade to a smaller cue, or to nothing)
 *   - routes sound: online "main di satu tempat" → only the host's phone plays table and comedy sounds
 *   - respects mute (sound pack "Mati")
 * Play-critical sounds (your turn, countdown) live in the core and are never ducked or routed away.
 * Files are the original, replaceable WAVs listed in src/comedy/config.js (sounds).
 */
(function () {
  'use strict';
  const FX = () => window.CapsaFX;
  const FILES = () => ((window.CAPSA_COMEDY || {}).sounds) || {};
  const TIER_COOLDOWN = { common: 20000, uncommon: 180000, rare: 600000, legendary: Infinity };
  const CUES = {
    'sys.chime':        { tier: 'common',   files: ['notify'] },
    'sys.paper':        { tier: 'common',   files: ['stamp', 'register', 'typing', 'gavel'] },
    'sting.tiny':       { tier: 'common',   files: ['whoosh'], vol: 0.55 },
    'sys.stopcut':      { tier: 'uncommon', files: ['tapeStop'] },
    'sting.deflate':    { tier: 'uncommon', files: ['deflate'] },
    'tension.hold':     { tier: 'uncommon', files: ['heartbeat'] },
    'sys.memorial':     { tier: 'uncommon', files: ['memorial'] },
    'sys.cctv':         { tier: 'uncommon', files: ['cctvHum'] },
    'fanfare.overblown':{ tier: 'rare',     files: ['drumroll', 'kazoo'] },
    'glitch':           { tier: 'rare',     files: ['glitch', 'error'] },
    'sys.credits':      { tier: 'rare',     files: ['credits'] },
  };
  // a cue on cooldown steps down to a smaller one (or to nothing)
  const FALLBACK = { 'fanfare.overblown': 'sting.tiny', 'glitch': 'sting.tiny', 'sys.stopcut': 'sting.tiny', 'sting.deflate': 'sting.tiny' };
  // old file keys used by bits → [cue, specific file]
  const LEGACY = {
    notify: ['sys.chime', 'notify'], stamp: ['sys.paper', 'stamp'], register: ['sys.paper', 'register'], typing: ['sys.paper', 'typing'],
    gavel: ['sys.paper', 'gavel'], tapeStop: ['sys.stopcut', 'tapeStop'], deflate: ['sting.deflate', 'deflate'], heartbeat: ['tension.hold', 'heartbeat'],
    drumroll: ['fanfare.overblown', 'drumroll'], kazoo: ['fanfare.overblown', 'kazoo'], glitch: ['glitch', 'glitch'], error: ['glitch', 'error'],
    whoosh: ['sting.tiny', 'whoosh'], memorial: ['sys.memorial', 'memorial'], cctvHum: ['sys.cctv', 'cctvHum'], credits: ['sys.credits', 'credits'],
  };

  const last = {};            // cue → { t, perf }
  let busy = { until: 0, perf: null };
  const log = [];
  const note = (...a) => { log.push(a.join(' ')); if (log.length > 60) log.shift(); };

  /* routing */
  function sameRoom() { const v = FX() && FX().view(); return !!(v && v.online && v.sameRoom); }
  function isHost() { const v = FX() && FX().view(); return !!(v && v.authority); }
  // core table sounds + comedy sounds stay on the host's phone when everyone sits at the same table
  function tableMuted() { return sameRoom() && !isHost(); }

  /* loading (shared cache) */
  const bufs = {};
  function load(file) {
    if (bufs[file]) return bufs[file];
    const url = FILES()[file];
    bufs[file] = (async () => {
      if (!url) return null;
      const o = FX() && FX().audio(); if (!o || !o.ctx) return { fallback: url };
      try {
        const r = await fetch(url); if (!r.ok) throw new Error(r.status);
        const ab = await r.arrayBuffer();
        return await new Promise((res, rej) => o.ctx.decodeAudioData(ab, res, rej));
      } catch (e) { return { fallback: url }; }
    })();
    return bufs[file];
  }
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  function output(file, vol) {
    return load(file).then((b) => {
      if (!b) return 0;
      if (b.fallback) { try { const a = new Audio(b.fallback); a.volume = Math.min(1, vol); a.play().catch(() => {}); } catch (e) {} return 1500; }
      const o = FX().audio(); if (!o || !o.ctx) return 0;
      const src = o.ctx.createBufferSource(), g = o.ctx.createGain(); src.buffer = b; g.gain.value = vol;
      src.connect(g).connect(o.out || o.ctx.destination); src.start();
      return Math.round(b.duration * 1000);
    });
  }

  /*
   * play(key, { vol, perf, late })
   *   key: a cue function ('sys.chime') or an old file key ('notify')
   *   perf: performance id (repeats inside the same performance are not "repeats")
   *   late: the performance arrived late on this phone → visuals only
   */
  function play(key, o) {
    o = o || {};
    const fx = FX(); if (!fx || !fx.soundOn || !fx.soundOn()) return false;
    if (o.late) { note('skip late', key); return false; }
    if (tableMuted()) { note('routed to host', key); return false; }
    let cue = key, file = null;
    if (LEGACY[key]) { cue = LEGACY[key][0]; file = LEGACY[key][1]; }
    let def = CUES[cue]; if (!def) { note('unknown cue', key); return false; }
    const perf = o.perf || '';
    // cooldown by tier, repeats inside one performance allowed
    for (let guard = 0; guard < 3; guard++) {
      const L = last[cue], cd = TIER_COOLDOWN[def.tier] || 0;
      if (!L || L.perf === perf || Date.now() - L.t >= cd) break;
      const fb = FALLBACK[cue];
      note('cooldown', cue, fb ? '→ ' + fb : '→ none');
      if (!fb) return false;
      cue = fb; def = CUES[cue]; file = null;
    }
    // exclusive comedy bus
    const now = Date.now();
    if (busy.until > now && busy.perf !== perf) {
      const wait = busy.until - now;
      if (wait > 1500) { note('bus busy, dropped', cue); return false; }
      setTimeout(() => play(key, Object.assign({}, o)), wait + 20);
      return true;
    }
    if (!file) { const fs = def.files || []; file = fs.length ? fs[hash(perf + '|' + cue) % fs.length] : null; }
    if (!file) return false;
    last[cue] = { t: now, perf };
    const vol = Math.min(1, (o.vol != null ? o.vol : 0.9) * (def.vol || 1));
    busy = { until: now + 400, perf };
    output(file, vol).then((ms) => { if (busy.perf === perf) busy.until = Math.max(busy.until, now + (ms || 0)); });
    note('play', cue, file);
    return true;
  }
  // engineered silence: duck the core (critical cues excepted) and hold the comedy bus
  function drop(ms, perf) {
    const fx = FX(); if (fx && fx.duck) fx.duck(ms);
    busy = { until: Math.max(busy.until, Date.now() + ms), perf: perf || busy.perf };
  }
  function preload() { Object.keys(FILES()).forEach(load); }
  if (window.CapsaEvents) window.CapsaEvents.on('fact:game:start', () => { Object.keys(last).forEach((k) => delete last[k]); });

  window.CapsaAudio = { play, drop, preload, tableMuted, sameRoom, cues: CUES, legacy: LEGACY, log: () => log.slice() };
})();

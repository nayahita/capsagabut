/*
 * Comedy Director. Decides whether a moment deserves a bit, which one, and when.
 * Only the authority (the local device offline, the host online) decides; the chosen
 * performance is broadcast so every phone plays the exact same thing.
 *
 * Must load before memory.js so each fact opens its "moment" before memory adds signals to it.
 */
(function () {
  'use strict';
  const E = window.CapsaEvents;
  if (!E) return;
  const C = window.CAPSA_COMEDY || { settings: {} };
  const S = C.settings;
  const RANK = { COMMON: 1, UNCOMMON: 2, RARE: 3, LEGENDARY: 4 };
  const PAYOFF = /CALLBACK|REVENGE/;
  const ZERO_NEXT = ['freeze', 'silence', 'sound', 'effect', 'rarity', 'dim', 'ribbon', 'tag', 'predict', 'approve', 'scoreSwap'];  // these run alongside the next step
  const nextOf = (s) => (s.next != null ? s.next : ZERO_NEXT.includes(s.do) ? 0 : s.ms || 0);
  const bits = [];
  const st = { lastW: { micro: 0, stage: 0 }, recent: [], perRound: { micro: 0, stage: 0 }, quiet: 0, legendary: 0, bitLast: {}, used: new Set(), usedKeys: new Set(), modeLast: {}, log: [],
    targets: [], fb: [], lastPerf: 0 };
  const FATIGUE = { hits: 2, rounds: 3 };          // the same player hit by 2 bits within 3 rounds → leave them alone
  const FB_WINDOW = 15 * 60000;                     // table feedback (quick dismissals, laughs) counts for 15 minutes
  const B8 = () => Object.assign({ micro: { perRound: 2, gapMs: 8000 }, stage: { perRound: 1, gapMs: 20000 } }, S.budget || {});
  const weightOf = (bit) => (bit.weight === 'micro' ? 'micro' : 'stage');
  const log = (...a) => { st.log.push(a.join(' ')); if (st.log.length > 80) st.log.shift(); if (S.debug) console.log('[comedy]', ...a); };

  /* one "moment" per fact: everything emitted while that fact is processed lands in it */
  let cur = null;
  ['game:start', 'round:start', 'play', 'pass', 'skip', 'finish', 'chat', 'emote', 'reveal', 'player:rejoin', 'round:end'].forEach((f) => {
    E.on('fact:' + f, (d) => { const m = { fact: f, d: d || {}, sig: [] }; cur = m; setTimeout(() => evaluate(m), 0); });
  });
  E.on('*', (ev) => { if (cur) cur.sig.push(ev); });

  // feedback from the table: a notification closed within a second is a "no thanks"; chat or an emote right after a bit is a "yes"
  E.on('fact:bit:feedback', (d) => { st.fb.push({ t: Date.now(), v: d && d.kind === 'dismiss' ? -1 : 1 }); });
  ['fact:chat', 'fact:emote'].forEach((f) => E.on(f, () => { if (st.lastPerf && Date.now() - st.lastPerf < 8000) st.fb.push({ t: Date.now(), v: 0.5 }); }));
  const fbMul = () => {
    const now = Date.now(); st.fb = st.fb.filter((x) => now - x.t < FB_WINDOW);
    const neg = st.fb.filter((x) => x.v < 0).length, pos = st.fb.filter((x) => x.v > 0).reduce((a, x) => a + x.v, 0);
    return Math.max(0.4, Math.min(1.15, 1 - 0.15 * neg + 0.05 * pos));
  };
  const curRound = (B) => (B.d && B.d.round) || (B.mem && B.mem.round() ? B.mem.round().n : 0) || (B.mem && B.mem.lastRound() ? B.mem.lastRound().round : 0);
  function targetOf(c, B) {
    const v = c.v || {}, mem = B.mem; if (!mem) return null;
    const n = v.seat != null && B.names[v.seat] != null ? B.names[v.seat] : v.name;
    return n == null ? null : mem.pidOf ? mem.pidOf(n) : mem.key(n);
  }
  /*
   * Tension: is the table in a moment the system must not interrupt?
   * Clutch = two players still in the round sit on ≤2 cards, or the player to move has ≤10 s left.
   * During clutch only micro bits may play; stage bits wait for a calmer moment (or the round end).
   */
  const MID = ['play', 'pass', 'skip', 'finish', 'chat', 'emote', 'reveal', 'player:rejoin'];
  function clutch(B) {
    if (!MID.includes(B.fact)) return false;
    const v = window.CapsaFX && window.CapsaFX.view ? window.CapsaFX.view() : null;
    if (v && v.left != null && v.left <= 10000) return true;
    const counts = (B.d && Array.isArray(B.d.counts) && B.d.counts) || (v && v.counts) || [];
    return counts.filter((c) => c > 0 && c <= 2).length >= 2;
  }
  /*
   * Significance = contradiction × visibility × memory depth × freshness. Must reach the bar for its size.
   * A bit may declare sig: { c, vis, depth } (or a function of its values) — defaults keep a fresh bit just above the bar,
   * so freshness (same target lately, rerun within 24 h, same mechanism within 3 min) is what usually decides.
   */
  const BAR = { micro: 1.5, stage: 2.5, legendary: 3.5 };
  function significance(c, B, now) {
    const bit = c.bit, legend = bit.rarity === 'LEGENDARY', size = legend ? 'legendary' : weightOf(bit);
    let base = {}; try { base = typeof bit.sig === 'function' ? bit.sig(c.v, B) || {} : bit.sig || {}; } catch (e) {}
    const C = base.c != null ? base.c : BAR[size], vis = base.vis != null ? base.vis : 1;
    const depth = base.depth != null ? base.depth : (PAYOFF.test(bit.mode) ? 1.5 : 1);
    let fresh = 1;
    if (c.target && !legend) {
      const r = curRound(B), hits = st.targets.filter((x) => x.k === c.target && r - x.round < FATIGUE.rounds).length;
      fresh *= Math.max(0, 1 - 0.3 * hits);
      const L = window.CapsaLore;
      if (L && L.ledgerFor && L.ledgerFor(c.target).some((x) => x.id === bit.id)) fresh *= 0.4;
    }
    if (!legend && now - (st.modeLast[bit.mode] || -1e12) < 180000) fresh *= 0.5;
    return { score: C * vis * depth * fresh, need: BAR[size] };
  }
  const authority = () => { const fx = window.CapsaFX; return !fx || !fx.view || fx.view().authority; };
  const heat = (now) => { st.recent = st.recent.filter((t) => now - t < S.heatWindowMs); return 1 / (1 + S.heatPerPerformance * st.recent.length); };
  const boredom = () => Math.min(S.boredomMax, 1 + S.boredomPerRound * st.quiet);

  function moment(m) {
    const mem = window.CapsaMemory;
    const names = (m.d && m.d.names) || (mem && mem.match().names.length ? mem.match().names : (window.CapsaFX ? window.CapsaFX.view().names : []));
    return { fact: m.fact, d: m.d, sig: m.sig, mem, names, now: Date.now(),
      ev: (t) => m.sig.find((e) => e.type === t), evs: (t) => m.sig.filter((e) => e.type === t) };
  }
  const label = (c) => (window.CapsaFX && window.CapsaFX.label ? window.CapsaFX.label(c) : String(c));
  const helpers = { pick: (a) => a[Math.floor(Math.random() * a.length)], card: label, cards: (a) => (a || []).map(label).join(' '),
    num: (x) => Number(x).toLocaleString('id-ID') };

  function evaluate(m) {
    if (m.fact === 'game:start') { st.perRound = { micro: 0, stage: 0 }; st.quiet = 0; st.legendary = 0; st.used.clear(); st.usedKeys.clear(); st.bitLast = {}; st.targets = []; return; }
    if (m.fact === 'round:start') st.perRound = { micro: 0, stage: 0 };
    if (!S.enabled || !authority()) return;
    const B = moment(m), now = B.now, cands = [];
    for (const bit of bits) {
      if (!bit.on.includes(m.fact)) continue;
      if (bit.oncePerMatch && st.used.has(bit.id)) continue;
      if (bit.cooldownMs && now - (st.bitLast[bit.id] || -1e12) < bit.cooldownMs) continue;
      let v; try { v = bit.when(B); } catch (e) { log('when() error', bit.id, e.message); continue; }
      if (v && v.once && st.usedKeys.has(v.once)) continue;
      if (!v) continue;
      const c = { bit, v: v === true ? {} : v };
      c.target = targetOf(c, B);
      if (c.target && bit.rarity !== 'LEGENDARY' && !bit.ignoreFatigue) {
        const r = curRound(B), hits = st.targets.filter((x) => x.k === c.target && r - x.round < FATIGUE.rounds).length;
        if (hits >= FATIGUE.hits) { log('skip (target fatigue)', bit.id); continue; }
      }
      if (c.target && B.mem && B.mem.spiral && B.mem.spiral(c.target) && !bit.kind) { log('skip (spiral)', bit.id); continue; }
      if (weightOf(bit) === 'micro' && B.mem && B.mem.tableHot && B.mem.tableHot()) { log('skip (table is busy)', bit.id); continue; }
      if (weightOf(bit) === 'stage' && bit.rarity !== 'LEGENDARY' && clutch(B)) { log('skip (clutch)', bit.id); continue; }
      const sg = significance(c, B, now);
      if (sg.score < sg.need) { log(`skip (significance ${sg.score.toFixed(2)} < ${sg.need})`, bit.id); continue; }
      c.sig = sg.score;
      cands.push(c);
    }
    // Effective chance first, then order: payoffs of memory (callbacks, revenge) first, then rarer bits,
    // then the most likely one, so a payoff never loses to a filler bit by luck.
    for (const c of cands) {
      const r = c.bit.rarity;
      let p = c.bit.chance != null ? c.bit.chance : (S.chance[r] != null ? S.chance[r] : 0.2);
      if (r !== 'LEGENDARY') {
        p *= heat(now) * boredom() * fbMul();
        if (PAYOFF.test(c.bit.mode)) p *= S.callbackBoost;
        p = Math.min(p, S.maxChance);
      }
      c.p = p;
    }
    const pay = (c) => (PAYOFF.test(c.bit.mode) ? 1 : 0);
    cands.sort((a, b) => pay(b) - pay(a) || RANK[b.bit.rarity] - RANK[a.bit.rarity] || b.p - a.p || Math.random() - 0.5);
    let chosen = null;
    for (const c of cands) {
      const r = c.bit.rarity, legendary = r === 'LEGENDARY', w = weightOf(c.bit), b = B8()[w];
      if (legendary && !c.bit.legendaryExempt && st.legendary >= (S.legendaryPerMatch || 1)) { log('skip (legendary cap)', c.bit.id); continue; }
      if (!legendary && st.perRound[w] >= b.perRound) { log(`skip (${w} round cap)`, c.bit.id); continue; }
      if (!legendary && RANK[r] < 3 && now - st.lastW[w] < b.gapMs) { log(`skip (${w} gap)`, c.bit.id); continue; }
      const roll = Math.random();
      log(`${m.fact} → ${c.bit.id} [${r} · ${c.bit.mode}] p=${c.p.toFixed(2)} roll=${roll.toFixed(2)}`);
      if (roll < c.p) { chosen = c; break; }
    }
    if (m.fact === 'round:end') st.quiet = chosen ? 0 : st.quiet + 1;
    if (chosen) perform(chosen, B, false);
    // Payoffs and legendary moments never swallow each other: the other one plays right after.
    if (chosen) {
      const want = chosen.bit.rarity === 'LEGENDARY' ? (c) => PAYOFF.test(c.bit.mode) : (c) => c.bit.rarity === 'LEGENDARY';
      const extra = cands.find((c) => c !== chosen && want(c) && (c.bit.rarity !== 'LEGENDARY' || st.legendary < (S.legendaryPerMatch || 1)) && Math.random() < c.p);
      if (extra) { log('PLUS', extra.bit.id); perform(extra, B, false); }
    }
  }

  function build(c, B) {
    const steps = c.bit.script(c.v, B, helpers) || [];
    const delay = (B.fact === 'round:end' ? (B.d.delay != null ? B.d.delay : 1900) : 0) + (c.bit.delay || 0);
    const perf = { id: c.bit.id, mode: c.bit.mode, rarity: c.bit.rarity, weight: weightOf(c.bit), delay, steps };
    if (c.bit.note) perf.note = c.bit.note(c.v, B);
    return perf;
  }
  function perform(c, B, local) {
    let perf;
    try { perf = build(c, B); } catch (e) { log('script() error', c.bit.id, e.message); return null; }
    if (!local) {
      const now = Date.now();
      const w = weightOf(c.bit);
      st.lastW[w] = now + perf.delay; st.recent.push(now); st.perRound[w]++; st.bitLast[c.bit.id] = now; st.modeLast[c.bit.mode] = now;
      st.lastPerf = now + perf.delay;
      if (c.bit.onPerform) { try { c.bit.onPerform(c.v, B); } catch (e) { log('onPerform error', c.bit.id, e.message); } }
      if (c.target) st.targets.push({ k: c.target, round: curRound(B) });
      if (window.CapsaLore && window.CapsaLore.ledger) window.CapsaLore.ledger({ id: c.bit.id, pid: c.target && /^p_/.test(c.target) ? c.target : null });
      if (c.bit.oncePerMatch) st.used.add(c.bit.id);
      if (c.v && c.v.once) st.usedKeys.add(c.v.once);
      if (c.bit.rarity === 'LEGENDARY' && !c.bit.legendaryExempt) st.legendary++;
      const total = perf.steps.reduce((a, s) => a + nextOf(s), 0);
      if (perf.steps.some((s) => s.do === 'freeze' || s.block) && window.CapsaFX) window.CapsaFX.holdTimer(perf.delay + total + 600);
      log('PLAY', perf.id);
    }
    // online: give every phone 600 ms to receive it, then all start together
    if (!local && window.CapsaFX && window.CapsaFX.view && window.CapsaFX.view().online && window.CapsaFX.serverNow) perf.at = window.CapsaFX.serverNow() + 600;
    if (!local && window.CapsaFX && window.CapsaFX.broadcast) window.CapsaFX.broadcast('comedy', perf);
    else document.dispatchEvent(new CustomEvent('capsa:mod', { detail: { type: 'comedy', data: perf } }));
    return perf;
  }

  if (S.replaceReactionCards && window.CapsaReactions) window.CapsaReactions.settings.enabled = false;

  window.CapsaComedy = {
    settings: S, state: st, bits, nextOf,
    addBit(b) { bits.push(Object.assign({ on: ['round:end'], mode: 'DEADPAN', rarity: 'COMMON' }, b)); },
    // Preview a bit on this device only (uses its demo values). Does not touch cooldowns.
    play(id, vars) {
      const bit = bits.find((b) => b.id === id); if (!bit) return null;
      const B = moment({ fact: 'test', d: {}, sig: [] });
      return perform({ bit, v: Object.assign({}, bit.demo || {}, vars || {}) }, B, true);
    },
    log: () => st.log.slice(),
  };
})();

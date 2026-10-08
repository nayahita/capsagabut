/*
 * Capsa event system.
 *
 * The game core only reports plain facts through CapsaEvents.ingest(fact, data):
 *   'game:start'  { names }
 *   'round:start' { round, names, scores, starter }
 *   'play'        { seat, name, combo, cat, size, counts }      counts = cards left per seat after the play
 *   'pass'        { seat, name, timeout }
 *   'round:end'   { round, winner, how, names, counts, penalties, scoresBefore, scoresAfter, delay }
 *
 * Detectors turn those facts into named game events (PLAYER_WIN, BAD_BEAT, ...).
 * Anything can listen with CapsaEvents.on(type, fn) or CapsaEvents.on('*', fn).
 * Raw facts are also emitted as 'fact:<name>' (for example 'fact:round:end').
 *
 * Add your own event without touching the game:
 *   CapsaEvents.defineDetector('round:end', (data, ctx, emit) => {
 *     if (data.counts.every((c, i) => i === data.winner || c >= 10)) emit('BLOWOUT', { seat: data.winner });
 *   });
 * then give it a reaction in reactions.config.js.
 */
(function () {
  'use strict';

  // Thresholds. Override by defining window.CAPSA_EVENT_CONFIG before this file loads.
  const CFG = Object.assign({
    badBeatMaxCards: 2,     // BAD_BEAT: a loser was left holding this many cards or fewer
    comebackDeficit: 5,     // BIG_COMEBACK: winner was at least this many cards behind the leader at some point
    winStreakMin: 3,        // WIN_STREAK: consecutive round wins
    lossStreakMin: 4,       // LOSS_STREAK: consecutive round losses
    upsetMinGap: 10,
    upsetMinGapLosses: 2,   // same, when standings count losses ("main sampai satu kalah")        // UPSET_WIN: winner was last on total points, at least this far behind first
  }, window.CAPSA_EVENT_CONFIG || {});

  const handlers = {};
  const detectors = [];
  // "main sampai satu kalah": only the last player holding cards lost; standings count losses (lower = better)
  const lost = (d, i) => (d.mode === 'last' ? i === d.loser : i !== d.winner);
  const stand = (d, arr) => (d.mode === 'last' ? (arr || []).map((x) => -x) : arr || []);
  const key = (n) => String(n == null ? '' : n).trim().toLowerCase();

  // Session memory (resets on 'game:start' or page reload).
  let S = fresh();
  function fresh() { return { round: null, prev: null, streak: {} }; }

  function on(type, fn) {
    (handlers[type] = handlers[type] || []).push(fn);
    return () => { handlers[type] = (handlers[type] || []).filter((f) => f !== fn); };
  }
  function emit(type, payload) {
    const ev = Object.assign({ type, at: Date.now() }, payload);
    const list = (handlers[type] || []).concat(type.startsWith('fact:') ? [] : (handlers['*'] || []));
    for (const fn of list) { try { fn(ev); } catch (e) { console.warn('[CapsaEvents]', type, e); } }
    return ev;
  }
  function defineDetector(fact, fn) { detectors.push({ fact, fn }); }

  function ingest(fact, data) {
    data = data || {};
    track(fact, data);
    emit('fact:' + fact, data);
    const ctx = context(fact, data);
    // Each detector emits through this wrapper so every event carries its name, seat, timing.
    const out = (type, payload) => {
      const seat = payload && payload.seat;
      emit(type, Object.assign({
        name: data.names && seat != null ? data.names[seat] : undefined,
        round: data.round, delay: data.delay || 0,
      }, payload));
    };
    for (const d of detectors) {
      if (d.fact === fact) { try { d.fn(data, ctx, out); } catch (e) { console.warn('[CapsaEvents] detector', fact, e); } }
    }
    if (fact === 'round:end') remember(data);
  }

  /* --- session bookkeeping --- */
  function track(fact, d) {
    if (fact === 'game:start') { S = fresh(); return; }
    if (fact === 'round:start') {
      const n = (d.names || []).length;
      S.round = { fromStart: true, names: d.names || [], maxDeficit: Array(n).fill(0), passed: Array(n).fill(false) };
      return;
    }
    if (!S.round) S.round = { fromStart: false, names: d.names || [], maxDeficit: [], passed: [] };
    if (fact === 'play' && Array.isArray(d.counts)) {
      const lead = Math.min(...d.counts);
      d.counts.forEach((c, i) => { S.round.maxDeficit[i] = Math.max(S.round.maxDeficit[i] || 0, c - lead); });
    }
    if (fact === 'pass' && d.seat != null) S.round.passed[d.seat] = true;
    if (fact === 'round:end') {
      (d.names || []).forEach((nm, i) => {
        const k = key(nm), st = S.streak[k] || (S.streak[k] = { win: 0, loss: 0 });
        if (i === d.winner) { st.win += 1; st.loss = 0; } else if (lost(d, i)) { st.loss += 1; st.win = 0; } else { st.win = 0; st.loss = 0; }
      });
    }
  }
  function context(fact, d) {
    return { cfg: CFG, round: S.round, prev: S.prev, streakOf: (name) => S.streak[key(name)] || { win: 0, loss: 0 }, key };
  }
  function remember(d) {
    const pen = {};
    (d.names || []).forEach((nm, i) => { pen[key(nm)] = (d.penalties || [])[i] || 0; });
    S.prev = { winnerKey: key((d.names || [])[d.winner]), winnerName: (d.names || [])[d.winner], penalties: pen };
    S.round = null;
  }

  /* --- built-in detectors --- */
  defineDetector('round:end', (d, ctx, emit) => {
    emit('PLAYER_WIN', { seat: d.winner, how: d.how });
  });

  defineDetector('round:end', (d, ctx, emit) => {
    d.names.forEach((nm, i) => {
      if (!lost(d, i)) return;
      emit('PLAYER_LOSE', { seat: i, cardsLeft: d.counts[i], penalty: (d.penalties || [])[i] || 0, winnerName: d.names[d.winner] });
    });
  });

  defineDetector('round:end', (d, ctx, emit) => {
    d.names.forEach((nm, i) => {
      const left = d.counts[i];
      if (lost(d, i) && left > 0 && left <= ctx.cfg.badBeatMaxCards) {
        emit('BAD_BEAT', { seat: i, cardsLeft: left, winnerName: d.names[d.winner] });
      }
    });
  });

  defineDetector('round:end', (d, ctx, emit) => {
    const r = ctx.round;
    const deficit = r && r.maxDeficit ? r.maxDeficit[d.winner] || 0 : 0;
    if (deficit >= ctx.cfg.comebackDeficit) emit('BIG_COMEBACK', { seat: d.winner, deficit });
  });

  defineDetector('round:end', (d, ctx, emit) => {
    d.names.forEach((nm, i) => {
      const st = ctx.streakOf(nm);
      if (i === d.winner && st.win >= ctx.cfg.winStreakMin) emit('WIN_STREAK', { seat: i, streak: st.win });
      if (lost(d, i) && st.loss >= ctx.cfg.lossStreakMin) emit('LOSS_STREAK', { seat: i, streak: st.loss });
    });
  });

  defineDetector('round:end', (d, ctx, emit) => {
    const sb = stand(d, d.scoresBefore);
    if (d.names.length < 3 || (d.round || 0) < 2 || sb.length !== d.names.length) return;
    const mine = sb[d.winner], top = Math.max(...sb), bottom = Math.min(...sb);
    const alone = sb.filter((s) => s === bottom).length === 1;
    const need = d.mode === 'last' ? ctx.cfg.upsetMinGapLosses : ctx.cfg.upsetMinGap;
    if (mine === bottom && alone && top - mine >= need) emit('UPSET_WIN', { seat: d.winner, gap: top - mine, unit: d.mode === 'last' ? 'losses' : 'points' });
  });

  defineDetector('round:end', (d, ctx, emit) => {
    const r = ctx.round;
    if (r && r.fromStart && !r.passed[d.winner]) emit('PERFECT_WIN', { seat: d.winner, how: d.how });
  });

  defineDetector('round:end', (d, ctx, emit) => {
    const p = ctx.prev;
    if (!p) return;
    const me = ctx.key(d.names[d.winner]);
    if (me === p.winnerKey) return;
    const pens = Object.values(p.penalties), worst = Math.max(...pens);
    if (worst > 0 && p.penalties[me] === worst && d.names.some((n) => ctx.key(n) === p.winnerKey)) {
      emit('REVENGE_WIN', { seat: d.winner, target: p.winnerName });
    }
  });

  window.CapsaEvents = { on, emit, ingest, defineDetector, config: CFG, _session: () => S };
})();

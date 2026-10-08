/*
 * Comedy memory. Runs on every phone and only reacts to facts, so every phone ends up with the same memory.
 *
 * Keeps the match log, notable moments, callback threads, grudges, a bounty, streaks, the system's
 * "favorite", score history, opening habits, who beats whom, chat pokes, delayed setups, incidents,
 * and a persistent reputation per player name (localStorage) that feeds titles.
 *
 * Signals for the director (CapsaEvents):
 *   MEM_ONE_CARD, MEM_THREAD_TENSE, MEM_THREAD_RESOLVED, MEM_EZ_RESOLVED, MEM_BOUNTY_POSTED, MEM_BOUNTY_CLAIMED,
 *   MEM_GRUDGE_SETTLED, MEM_BIG_BEATEN, MEM_OVERKILL, MEM_PASSIVE, MEM_LEAD_TURN, MEM_BULLY, MEM_POKE,
 *   MEM_FAVORITE_SET, MEM_FAVORITE_CHANGED, MEM_SLUMP_WIN, MEM_INCIDENT, MEM_TRASH,
 *   corpus v1 additions: MEM_RETURNING, MEM_HABIT_BROKEN, MEM_REPEAT_MISTAKE, MEM_DITHER, MEM_WASTED_HAND,
 *   MEM_UNDERDOG_HAND, MEM_RIVALRY, MEM_SPIRAL, MEM_REVEAL, MEM_REVEAL_RESOLVED, MEM_EMOTE_BACKFIRE, MEM_REJOIN
 *
 * Players are keyed by their id (pid, from src/lore.js) when there is one, so notes survive a rename.
 * Notes that outlive the match go to CapsaLore at 'match:end'.
 */
(function () {
  'use strict';
  const E = window.CapsaEvents;
  if (!E) return;
  const norm = (n) => String(n == null ? '' : n).trim().replace(/\s+/g, ' ').toLowerCase();
  let pidOf = {};                                   // normalized name → pid, for the current match
  const key = (n) => { const k = norm(n); return pidOf[k] || k; };
  const Lore = () => window.CapsaLore;
  const setPids = (names, pids) => { if (!Array.isArray(pids) || !Array.isArray(names)) return; pidOf = {}; names.forEach((n, i) => { if (pids[i]) pidOf[norm(n)] = pids[i]; }); };
  const HOT_MS = 10000, HOT_N = 3;
  const RANK = (c) => c >> 2;                       // 0 = '3' … 11 = 'A', 12 = '2'
  const sig = (type, p) => E.emit(type, p);
  const REP_KEY = 'capsa-rep-v1';
  const REP0 = { rounds: 0, wins: 0, lastCardLosses: 0, badBeats: 0, hoards: 0, bombDeaths: 0, sealed: 0, passivePasses: 0,
    timeouts: 0, ezLosses: 0, revenges: 0, bombWins: 0, worstLossStreak: 0, bountiesClaimed: 0 };
  const SETUP_ROUNDS = 3;

  // reputation counters live in CapsaLore (per player id); without it they fall back to this device only
  let rep = (() => { try { return JSON.parse(localStorage.getItem(REP_KEY) || '{}') || {}; } catch (e) { return {}; } })();
  const usesLore = (k) => !!(Lore() && /^p_/.test(k));
  const saveRep = () => { if (!Lore()) { try { localStorage.setItem(REP_KEY, JSON.stringify(rep)); } catch (e) {} } };
  const repRec = (n) => { const k = key(n); if (!k) return null; return (rep[k] = rep[k] || Object.assign({ name: String(n).trim() }, REP0)); };
  const repBump = (n, f, by) => { const k = key(n); if (usesLore(k)) return Lore().bump(k, f, by); const r = repRec(n); if (r) r[f] = (r[f] || 0) + (by == null ? 1 : by); };
  const repMax = (n, f, v) => { const k = key(n); if (usesLore(k)) return Lore().max(k, f, v); const r = repRec(n); if (r && (r[f] || 0) < v) r[f] = v; };
  const repOf = (k) => (usesLore(k) ? Lore().counters(k) : Object.assign({}, REP0, rep[k] || {}));
  const quadRank = (hand) => { const c = {}; for (const x of hand || []) { c[RANK(x)] = (c[RANK(x)] || 0) + 1; if (c[RANK(x)] === 4) return RANK(x); } return -1; };
  const hasQuad = (hand) => quadRank(hand) >= 0;
  const label = (c) => (window.CapsaFX && window.CapsaFX.label ? window.CapsaFX.label(c) : String(c));

  let M, R = null, last = null, setupSeq = 0;
  function newMatch(names) {
    M = { startedAt: Date.now(), names: names || [], rounds: [], moments: [], threads: [], chats: [], grudges: [], bounty: null,
      streak: {}, wins: {}, penalty: {}, mistakes: {}, bombs: 0, sflush: 0, twosDied: 0, ezLosses: 0,
      favorite: null, scores: {}, leads: {}, pokes: {}, setups: [], twosDiedBy: {}, lastCardBy: {},
      think: {}, passStats: {}, losses: {}, supported: {}, emotes: [], hot: [], confess: {}, spiral: {}, h2h: {}, debts: [], once: {}, pids: [] };
    R = null; last = null;
  }
  newMatch([]);
  function freshRound(d) {
    const names = d.names || M.names, n = names.length || 4;
    return { n: d.round || 0, names, start: Date.now(), counts: Array(n).fill(13), min: Array(n).fill(13), hitOne: Array(n).fill(false),
      passes: Array(n).fill(0), passPlayable: Array(n).fill(0), timeouts: Array(n).fill(0), overkills: Array(n).fill(0), plays: 0,
      lastBig: null, beats: {}, beatBy: {}, prevAction: null, actBeforePlay: null, chatted: Array(n).fill(false),
      revealed: {}, emoted: {}, cancels: Array(n).fill(0) };
  }
  const ensureR = (d) => { if (!R) { R = freshRound(d); R.partial = true; } };
  const moment = (round, name, text, w, bad, type) => {
    const m = { round, name, key: key(name), text, w, bad: !!bad, t: Date.now(), type: type || null };
    M.moments.push(m); if (M.moments.length > 80) M.moments.shift();
    // the same kind of embarrassment as in an earlier match, inside the 24 h roast window
    if (bad && type && usesLore(m.key) && once('deja:' + m.key)) {
      const prev = Lore().quotable(m.key).filter((x) => x.bad && x.type === type && x.t < M.startedAt).pop();
      if (prev) { const seat = names().findIndex((x) => key(x) === m.key); sig('MEM_DEJA_VU', { seat, name, kind: type, then: { t: prev.t, text: prev.text, round: prev.round }, now: text, round }); }
      else delete M.once['deja:' + m.key];
    }
  };
  const once = (k) => { if (M.once[k]) return false; M.once[k] = true; return true; };
  const hotPing = () => { const now = Date.now(); M.hot = M.hot.filter((t) => now - t < HOT_MS); M.hot.push(now); };
  const tableHot = () => { const now = Date.now(); return M.hot.filter((t) => now - t < HOT_MS).length >= HOT_N; };
  // a mistake right after admitting one ("salah gua") is a callback waiting to happen
  function mistake(seat, name, kind) {
    const k = key(name), c = M.confess[k];
    if (c && !c.used && (R ? R.n : 0) - c.round <= 3) { c.used = true; sig('MEM_REPEAT_MISTAKE', { seat, name, quote: c.text, kind, round: c.round }); }
  }
  const turnStat = (name, d) => {
    const k = key(name), p = M.passStats[k] = M.passStats[k] || { playable: 0, turns: 0 };
    p.turns++;
    if (typeof d.thinkMs === 'number' && d.thinkMs >= 0 && d.thinkMs < 120000) { const t = M.think[k] = M.think[k] || { sum: 0, n: 0 }; t.sum += d.thinkMs; t.n++; }
    return p;
  };
  const bump = (obj, n) => { const k = key(n); obj[k] = (obj[k] || 0) + 1; };
  const names = () => (R && R.names.length ? R.names : M.names);
  const habit = (n) => { const l = M.leads[key(n)] || []; const c = {}; let best = null; l.forEach((x) => { c[x] = (c[x] || 0) + 1; if (!best || c[x] > c[best]) best = x; }); return best ? { combo: best, count: c[best], total: l.length } : null; };
  function leadTurn(seat) {
    const nm = names()[seat]; if (nm == null) return;
    const h = habit(nm);
    if (h && h.count >= 3) sig('MEM_LEAD_TURN', { seat, name: nm, combo: h.combo, count: h.count });
  }
  const addSetup = (s) => { s.id = 's' + (++setupSeq) + ':' + s.type + ':' + key(s.name); M.setups.push(s); };

  E.on('fact:game:start', (d) => { newMatch(d.names); setPids(d.names, d.pids); M.pids = Array.isArray(d.pids) ? d.pids.slice() : []; });

  E.on('fact:round:start', (d) => {
    if (!M.names.length) M.names = d.names || [];
    if (Array.isArray(d.pids)) { setPids(d.names || M.names, d.pids); M.pids = d.pids.slice(); }
    R = freshRound(d);
    // first round of a match: who has history at this table
    if ((d.round || 0) === 1 || !M.rounds.length) (d.names || []).forEach((n, i) => {
      const k = key(n); if (!usesLore(k) || !once('ret:' + k)) return;
      const ds = Lore().dossier(k); if (!ds || !(ds.matches > 0)) return;
      const q = Lore().quotable(k).slice(-1)[0] || null;
      sig('MEM_RETURNING', { seat: i, name: n, matches: ds.matches, title: title(n), moment: q });
    });
    if ((d.round || 0) === 1 && Lore() && Lore().renamed) {
      const rn = Lore().renamed();
      (d.names || []).forEach((n, i) => { const k = key(n), r = rn[k]; if (r && once('ren:' + k)) sig('MEM_RENAMED', { seat: i, name: n, old: r.from }); });
    }
    M.threads.forEach((t) => { if (t.state === 'tense') t.state = 'open'; });
    M.setups = M.setups.filter((s) => (d.round || 0) - s.round <= SETUP_ROUNDS);
    if (d.starter != null) leadTurn(d.starter);
  });

  E.on('fact:play', (d) => {
    ensureR(d); R.plays++;
    if (Array.isArray(d.counts)) { R.counts = d.counts.slice(); d.counts.forEach((c, i) => { R.min[i] = Math.min(R.min[i] == null ? 13 : R.min[i], c); }); }
    const me = d.seat, nm = d.name, left = R.counts[me];
    R.actBeforePlay = R.prevAction; R.prevAction = { type: 'play', seat: me };
    turnStat(nm, d); R.cancels[me] = (R.cancels[me] || 0) + (d.cancels || 0);
    if (!d.prev) {
      const k = key(nm); (M.leads[k] = M.leads[k] || []).push(d.combo);
      // a long-standing opening habit (across matches) suddenly broken
      if (usesLore(k)) {
        const lead = (Lore().dossier(k) || {}).lead || {}, tot = Object.values(lead).reduce((a, b) => a + b, 0);
        const top = Object.entries(lead).sort((a, b) => b[1] - a[1])[0];
        if (top && tot >= 6 && top[1] / tot >= 0.6 && d.combo !== top[0] && once('habit:' + k))
          sig('MEM_HABIT_BROKEN', { seat: me, name: nm, habit: top[0], share: Math.round((top[1] / tot) * 100), now: d.combo });
      }
    }
    if (d.prev && d.prev.by !== me) {
      const pk = me + '>' + d.prev.by; R.beats[pk] = (R.beats[pk] || 0) + 1;
      (R.beatBy[me] = R.beatBy[me] || {})[d.prev.by] = true;
      if (R.beats[pk] === 3) sig('MEM_BULLY', { seat: me, name: nm, victimSeat: d.prev.by, victim: R.names[d.prev.by] });
    }
    if (left === 1 && !R.hitOne[me]) {
      R.hitOne[me] = true;
      sig('MEM_ONE_CARD', { seat: me, name: nm });
      const th = M.threads.find((t) => t.type === 'lastCard' && t.key === key(nm) && t.state === 'open');
      if (th) { th.state = 'tense'; th.tenseRound = R.n; sig('MEM_THREAD_TENSE', { seat: me, name: nm, originRound: th.round, times: th.times }); }
    }
    if (d.prev && d.prev.size === 5 && R.lastBig && R.lastBig.seat !== me && R.lastBig.seat === d.prev.by) {
      const secs = Math.max(1, Math.round(((d.t || Date.now()) - R.lastBig.t) / 1000));
      sig('MEM_BIG_BEATEN', { seat: me, name: nm, victimSeat: R.lastBig.seat, victim: R.names[R.lastBig.seat], combo: R.lastBig.combo, secs });
    }
    if (d.size === 5) R.lastBig = { seat: me, combo: d.combo, t: d.t || Date.now() };
    if (d.size === 1 && d.prev && d.prev.size === 1 && d.cards && RANK(d.cards[0]) === 12 && RANK(d.prev.cards[0]) <= 4) {
      R.overkills[me]++; bump(M.mistakes, nm);
      sig('MEM_OVERKILL', { seat: me, name: nm, card: d.cards[0], against: d.prev.cards[0], victim: R.names[d.prev.by] });
      mistake(me, nm, 'overkill');
    }
    if (d.cat >= 4) { M.bombs++; if (d.cat === 5) M.sflush++; }
  });

  E.on('fact:skip', (d) => leadTurn(d.seat));

  E.on('fact:pass', (d) => {
    ensureR(d);
    const me = d.seat;
    R.passes[me] = (R.passes[me] || 0) + 1;
    R.prevAction = { type: 'pass', seat: me, hadPlay: !!d.hadPlay };
    const ps = turnStat(d.name, d);
    if (d.timeout) { R.timeouts[me]++; repBump(d.name, 'timeouts'); moment(R.n, d.name, 'timeout', 5, true, 'timeout'); mistake(me, d.name, 'timeout'); }
    if (d.hadPlay) {
      R.passPlayable[me]++; ps.playable++; bump(M.mistakes, d.name); repBump(d.name, 'passivePasses');
      if (R.passPlayable[me] === 3) sig('MEM_PASSIVE', { seat: me, name: d.name, count: 3 });
      mistake(me, d.name, 'passive');
    }
    // long think and/or picking-and-cancelling, then a pass
    if (!d.timeout && ((d.thinkMs || 0) >= 20000 || (d.cancels || 0) >= 2))
      sig('MEM_DITHER', { seat: me, name: d.name, secs: Math.round((d.thinkMs || 0) / 1000), cancels: d.cancels || 0, could: d.could || [] });
    const n = names().length;
    if (d.table && n && (me + 1) % n === d.table.by) leadTurn(d.table.by);
  });

  E.on('fact:chat', (d) => {
    const trash = !!(d.trash || d.prediction);
    const c = { seat: d.seat, name: d.name, key: key(d.name), text: d.text, trash, prediction: !!d.prediction, confession: !!d.confession,
      target: d.target, t: Date.now(), round: R ? R.n : 0, held: Array.isArray(d.counts) ? d.counts[d.seat] : null };
    M.chats.push(c); if (M.chats.length > 60) M.chats.shift();
    if (R && d.seat != null) R.chatted[d.seat] = R.chatted[d.seat] || trash;
    hotPing();
    if (d.confession) { moment(c.round, d.name, `"${d.text}"`, 5, true); M.confess[c.key] = { text: d.text, round: c.round }; }
    if (trash) sig('MEM_TRASH', { seat: d.seat, name: d.name, text: d.text, held: c.held, prediction: c.prediction });
    if (d.target != null && d.target !== d.seat) {
      const pk = key(d.name) + '>' + key(names()[d.target]);
      M.pokes[pk] = (M.pokes[pk] || 0) + 1;
      if (M.pokes[pk] === 2) sig('MEM_POKE', { seat: d.seat, name: d.name, victimSeat: d.target, victim: names()[d.target] });
    }
  });

  E.on('fact:emote', (d) => {
    hotPing();
    M.emotes.push({ seat: d.seat, name: d.name, key: key(d.name), e: d.e, t: Date.now(), round: R ? R.n : 0 });
    if (M.emotes.length > 60) M.emotes.shift();
    if (R && d.seat != null) R.emoted[d.seat] = d.e;
  });
  // show-my-hand (online taunt)
  E.on('fact:reveal', (d) => {
    ensureR(d);
    if (d.seat == null) return;
    const first = !R.revealed[d.seat];
    R.revealed[d.seat] = { t: Date.now(), count: d.count, cards: d.cards || [] };
    if (first) sig('MEM_REVEAL', { seat: d.seat, name: d.name, count: d.count, cards: d.cards || [] });
  });
  E.on('fact:player:leave', (d) => { if (R) (R.away = R.away || {})[d.seat] = R.plays; });
  E.on('fact:player:rejoin', (d) => {
    const at = R && R.away ? R.away[d.seat] : null;
    sig('MEM_REJOIN', { seat: d.seat, name: d.name, awayMs: d.awayMs, missed: R && at != null ? Math.max(0, R.plays - at) : 0 });
  });

  E.on('fact:round:end', (d) => {
    ensureR(d);
    const nm = d.names || [], w = d.winner, wName = nm[w], now = Date.now();
    // "main sampai satu kalah": only the last one holding cards lost; standings count losses (lower = better)
    const LM = d.mode === 'last', lost = (i) => (LM ? i === d.loser : i !== w), stand = (a) => (LM ? (a || []).map((x) => -x) : a || []);
    if (!M.names.length) M.names = nm;
    const before = {};
    nm.forEach((n) => { before[key(n)] = Object.assign({}, M.streak[key(n)] || { win: 0, loss: 0 }); });
    const enabler = R.actBeforePlay && R.actBeforePlay.type === 'pass' && R.actBeforePlay.hadPlay && R.actBeforePlay.seat !== w ? R.actBeforePlay.seat : null;
    const row = { round: d.round, winner: w, winnerName: wName, how: d.how, names: nm, counts: d.counts, hands: d.hands || [],
      penalties: d.penalties || [], scoresBefore: d.scoresBefore, scoresAfter: d.scoresAfter, final: d.final,
      min: R.min.slice(), passes: R.passes.slice(), passPlayable: R.passPlayable.slice(), partial: !!R.partial,
      beatBy: Object.assign({}, R.beatBy), enabler, mode: d.mode || 'points', loser: d.loser, order: d.order || null };
    const prevRow = last;
    M.rounds.push(row); last = row;

    nm.forEach((n, i) => {
      const k = key(n), s = M.streak[k] || (M.streak[k] = { win: 0, loss: 0 });
      if (i === w) { s.win++; s.loss = 0; M.wins[k] = (M.wins[k] || 0) + 1; } else if (lost(i)) { s.loss++; s.win = 0; M.losses[k] = (M.losses[k] || 0) + 1; } else { s.win = 0; s.loss = 0; }
      M.penalty[k] = (M.penalty[k] || 0) + (row.penalties[i] || 0);
      (M.scores[k] = M.scores[k] || []).push((d.scoresAfter || [])[i] || 0);
    });

    // a win after a slump (lost on the last card last round, or 2+ losses in a row)
    const bw = before[key(wName)] || { loss: 0 };
    const lastCardPrev = prevRow && prevRow.winner !== w && prevRow.counts[w] === 1;
    if (bw.loss >= 2 || lastCardPrev) sig('MEM_SLUMP_WIN', { seat: w, name: wName, prevLoss: bw.loss, lastCardPrev: !!lastCardPrev });

    // reputation, incidents, delayed setups
    const badBefore = {}, twosDiedNow = [];
    nm.forEach((n) => { badBefore[key(n)] = M.moments.filter((m) => m.bad && m.key === key(n)).length; });
    nm.forEach((n, i) => {
      repBump(n, 'rounds');
      if (i === w) { repBump(n, 'wins'); if (d.how === 'bomb') repBump(n, 'bombWins'); return; }
      if (!lost(i)) return;
      const left = d.counts[i], hand = row.hands[i] || [];
      if (left === 1) {
        repBump(n, 'lastCardLosses');
        const k = key(n); M.lastCardBy[k] = (M.lastCardBy[k] || 0) + 1;
        if (M.lastCardBy[k] === 1) addSetup({ type: 'kenangan', name: n, round: d.round, card: hand[0] });
      }
      if (left > 0 && left <= 2) repBump(n, 'badBeats');
      const twos = hand.filter((c) => RANK(c) === 12);
      if (twos.length) twosDiedNow.push({ i, n });
      if (twos.length >= 2) { repBump(n, 'hoards'); M.twosDied += twos.length; M.twosDiedBy[key(n)] = (M.twosDiedBy[key(n)] || 0) + 1; }
      if (twos.length && R.passPlayable[i] > 0) addSetup({ type: 'prasasti', name: n, round: d.round, cards: twos });
      if (twos.length >= 2) moment(d.round, n, `mati megang ${twos.map(label).join(' ')}`, 5, true, 'hoard');
      const q = quadRank(hand);
      if (q >= 0) { repBump(n, 'bombDeaths'); addSetup({ type: 'prasasti', name: n, round: d.round, cards: hand.filter((c) => RANK(c) === q), bomb: true }); moment(d.round, n, 'mati megang Four of a Kind', 5, true, 'bombDeath'); }
      if (left === 13) { repBump(n, 'sealed'); moment(d.round, n, 'selesai masih pegang 13 kartu', 9, true, 'sealed'); }
      repMax(n, 'worstLossStreak', M.streak[key(n)].loss);
    });

    // callback thread: lost on the last card → later back on one card → resolution
    M.threads.filter((t) => t.type === 'lastCard' && t.state === 'tense').forEach((t) => {
      const i = nm.findIndex((x) => key(x) === t.key);
      if (i < 0) return;
      const outcome = lost(i) ? 'lost' : 'won';
      sig('MEM_THREAD_RESOLVED', { seat: i, name: nm[i], outcome, originRound: t.round, times: t.times });
      if (outcome === 'won') { t.state = 'closed'; moment(d.round, nm[i], 'akhirnya menang di situasi kartu terakhir', 4); }
      else { t.state = 'open'; t.times = (t.times || 1) + 1; t.lastRound = d.round; moment(d.round, nm[i], `kalah di kartu terakhir (lagi, ke-${t.times})`, 7, true, 'lastCard'); }
    });
    nm.forEach((n, i) => {
      if (!lost(i) || d.counts[i] !== 1) return;
      if (!M.threads.some((t) => t.type === 'lastCard' && t.key === key(n) && t.state !== 'closed')) {
        M.threads.push({ type: 'lastCard', key: key(n), name: n, round: d.round, state: 'open', times: 1 });
        const card = (row.hands[i] || [])[0];
        moment(d.round, n, `kalah, sisa 1 kartu${card != null ? ` (${label(card)})` : ''}`, 5, true, 'lastCard');
      }
    });

    // trash talk / predictions that aged badly (or well)
    const said = {};
    M.chats.filter((c) => c.trash && !c.resolved && (c.round === d.round || now - c.t < 120000)).forEach((c) => { said[c.key] = c; });
    Object.values(said).forEach((c) => {
      const i = nm.findIndex((x) => key(x) === c.key);
      if (i < 0) return;
      M.chats.forEach((o) => { if (o.key === c.key && o.trash) { o.resolved = true; if (lost(i)) o.lost = true; } });
      const outcome = i === w ? 'won' : lost(i) ? 'lost' : 'mid';
      if (outcome === 'lost') {
        M.ezLosses++; repBump(nm[i], 'ezLosses'); moment(d.round, nm[i], `"${c.text}"`, 8, true, 'boastLost');
        addSetup({ type: 'ezLost', name: nm[i], round: d.round, text: c.text, cardsLeft: d.counts[i] });
      }
      sig('MEM_EZ_RESOLVED', { seat: i, name: nm[i], text: c.text, outcome, prediction: c.prediction, cardsLeft: d.counts[i], secs: Math.max(1, Math.round((now - c.t) / 1000)) });
    });

    // grudges: settle, then record new humiliations
    M.grudges = M.grudges.filter((g) => {
      if (key(wName) !== g.victimKey) return true;
      const bi = nm.findIndex((x) => key(x) === g.bullyKey);
      if (bi < 0 || bi === w) return true;
      sig('MEM_GRUDGE_SETTLED', { seat: w, name: wName, bully: nm[bi], bullySeat: bi, round: g.round, pen: g.pen, cards: g.cards, mode: g.mode });
      repBump(wName, 'revenges'); moment(d.round, wName, `bales dendam ke ${nm[bi]} (utang ronde ${g.round})`, 6);
      return false;
    });
    nm.forEach((n, i) => {
      const pen = row.penalties[i] || 0;
      if (lost(i) && pen >= 10 && !M.grudges.some((g) => g.victimKey === key(n) && g.bullyKey === key(wName))) {
        M.grudges.push({ victimKey: key(n), victim: n, bullyKey: key(wName), bully: wName, round: d.round, pen, cards: d.counts[i], mode: d.mode || 'points' });
      }
    });

    // bounty: claim, then maybe post
    if (M.bounty) {
      const ti = nm.findIndex((x) => key(x) === M.bounty.key);
      if (ti >= 0 && ti !== w) {
        sig('MEM_BOUNTY_CLAIMED', { seat: w, name: wName, target: M.bounty.name, targetSeat: ti, streak: M.bounty.streak });
        repBump(wName, 'bountiesClaimed'); moment(d.round, wName, `ngeklaim bounty ${M.bounty.name}`, 6);
        M.bounty = null;
      }
    }
    const ws = M.streak[key(wName)];
    if (!M.bounty && ws && ws.win >= 3) { M.bounty = { key: key(wName), name: wName, round: d.round, streak: ws.win }; sig('MEM_BOUNTY_POSTED', { seat: w, name: wName, streak: ws.win }); }
    if (d.how === 'bomb') moment(d.round, wName, 'menang pakai bom', 3);

    // the system's favorite: lowest score after the first round; replaced after 3 losses in a row
    if (!M.favorite && Array.isArray(d.scoresAfter) && d.scoresAfter.length) {
      const st = stand(d.scoresAfter), lo = Math.min(...st), i = st.indexOf(lo);
      M.favorite = { key: key(nm[i]), name: nm[i], since: d.round };
      sig('MEM_FAVORITE_SET', { seat: i, name: nm[i] });
    } else if (M.favorite) {
      const fi = nm.findIndex((x) => key(x) === M.favorite.key);
      if (fi >= 0 && (M.streak[M.favorite.key] || {}).loss >= 3) {
        let best = -1;
        nm.forEach((n, i) => { if (i !== fi && (best < 0 || (M.wins[key(n)] || 0) > (M.wins[key(nm[best])] || 0))) best = i; });
        if (best >= 0) {
          const old = M.favorite.name;
          M.favorite = { key: key(nm[best]), name: nm[best], since: d.round };
          sig('MEM_FAVORITE_CHANGED', { seat: best, name: nm[best], old, oldSeat: fi });
        }
      }
    }

    // third bad incident for a player this match
    nm.forEach((n, i) => {
      const bad = M.moments.filter((m) => m.bad && m.key === key(n));
      if (badBefore[key(n)] < 3 && bad.length >= 3) sig('MEM_INCIDENT', { seat: i, name: n, lines: bad.slice(0, 3).map((m) => `R${m.round} · ${m.text}`) });
    });

    // dealt hand vs result
    if (Array.isArray(d.dealt)) nm.forEach((n, i) => {
      const h = d.dealt[i]; if (!h) return;
      if (lost(i) && (h.score >= 62 || h.twos >= 2 || h.quad) && d.counts[i] >= 6) sig('MEM_WASTED_HAND', { seat: i, name: n, dealt: h, left: d.counts[i] });
      if (i === w && h.score <= 35 && !h.twos && !h.quad) sig('MEM_UNDERDOG_HAND', { seat: i, name: n, dealt: h });
    });
    // shown cards, laughing emotes: did it age well?
    Object.entries(R.revealed || {}).forEach(([s, r]) => {
      const i = +s, outcome = i === w ? 'won' : lost(i) ? 'lost' : 'mid';
      if (outcome === 'lost') { moment(d.round, nm[i], 'pamer kartu, terus kalah', 7, true, 'revealLost'); addSetup({ type: 'revealLost', name: nm[i], round: d.round, cards: r.cards, cardsLeft: d.counts[i] }); }
      sig('MEM_REVEAL_RESOLVED', { seat: i, name: nm[i], outcome, cards: r.cards, cardsLeft: d.counts[i], secs: Math.max(1, Math.round((now - r.t) / 1000)) });
    });
    Object.entries(R.emoted || {}).forEach(([s, e]) => {
      const i = +s; if (!lost(i) || !['laugh', 'cool'].includes(e) || d.counts[i] < 5) return;
      sig('MEM_EMOTE_BACKFIRE', { seat: i, name: nm[i], emote: e, cardsLeft: d.counts[i] });
    });
    // head-to-head, this match (added to the lore at match:end)
    nm.forEach((n, i) => { if (!lost(i)) return; const kk = [key(wName), key(n)].sort().join('|'); const h = M.h2h[kk] = M.h2h[kk] || {}; h[key(wName)] = (h[key(wName)] || 0) + 1; });
    const big = nm.map((n, i) => ({ n, i, pen: row.penalties[i] || 0 })).filter((x) => lost(x.i)).sort((a, b) => b.pen - a.pen)[0];
    if (big) {
      if (big.pen >= 10) M.debts.push({ by: key(wName), victim: key(big.n), pen: big.pen, t: now });
      const a = key(wName), b = key(big.n), kk = [a, b].sort().join('|');
      const life = usesLore(a) && usesLore(b) ? Lore().h2h(a, b) : { a: 0, b: 0 };
      const mine = M.h2h[kk] || {}, wa = life.a + (mine[a] || 0), wb = life.b + (mine[b] || 0);
      if (wa + wb >= 8 && Math.abs(wa - wb) <= Math.max(2, (wa + wb) * 0.3) && once('riv:' + kk))
        sig('MEM_RIVALRY', { seat: w, name: wName, rivalSeat: big.i, rival: big.n, wins: wa, losses: wb });
    }
    // somebody is really going under: the director stops piling on
    nm.forEach((n, i) => {
      const k = key(n), sa = stand(d.scoresAfter);
      if (i === w) { delete M.spiral[k]; return; }
      const others = sa.filter((_, j) => j !== i), next = others.length ? Math.min(...others) : 0;
      const needLoss = LM ? 3 : 5, needGap = LM ? 3 : 20;
      if ((M.streak[k] || {}).loss >= needLoss && sa[i] === Math.min(...sa) && next - sa[i] >= needGap && !M.spiral[k]) {
        M.spiral[k] = true; sig('MEM_SPIRAL', { seat: i, name: n, loss: M.streak[k].loss, gap: next - sa[i] });
      }
    });
    if (twosDiedNow.length) twosDiedNow.forEach((x) => mistake(x.i, x.n, 'hoard'));

    saveRep(); R = null;
  });

  // the match is over: hand what is worth keeping to CapsaLore
  E.on('fact:match:end', (d) => {
    if (!Lore() || !M.rounds.length) return;
    const names = d.names || M.names, pids = (Array.isArray(d.pids) ? d.pids : names.map((n) => key(n))).filter(Boolean);
    const only = (obj) => { const o = {}; Object.entries(obj).forEach(([k, v]) => { if (/^p_/.test(k)) o[k] = v; }); return o; };
    const leads = {}; Object.entries(M.leads).forEach(([k, l]) => { if (!/^p_/.test(k)) return; const c = leads[k] = {}; l.forEach((x) => { c[x] = (c[x] || 0) + 1; }); });
    const legends = M.chats.filter((c) => c.trash && c.lost && /^p_/.test(c.key)).map((c) => ({ pid: c.key, name: c.name, text: c.text, t: c.t }));
    Lore().commitMatch({
      pids: pids.filter((p) => /^p_/.test(p)), names, rounds: M.rounds.length,
      moments: M.moments.filter((m) => /^p_/.test(m.key) && m.w >= 5).map((m) => ({ pid: m.key, round: m.round, text: m.text, w: m.w, bad: m.bad, t: m.t, type: m.type })),
      legends, leads, passes: only(M.passStats), think: only(M.think),
      h2h: Object.fromEntries(Object.entries(M.h2h).filter(([k]) => k.split('|').every((x) => /^p_/.test(x)))),
      debts: M.debts.filter((x) => /^p_/.test(x.by) && /^p_/.test(x.victim)),
      favorite: M.favorite && /^p_/.test(M.favorite.key) ? { pid: M.favorite.key, name: M.favorite.name } : null,
    });
  });

  /* ---------- read API ---------- */
  function title(n) { return titleOf(key(n)); }
  function titleOf(k) {
    const r = repOf(k), wr = r.rounds ? r.wins / r.rounds : 0;
    const rules = [
      [r.ezLosses >= 2, 'Mulut Duluan'], [r.sealed >= 1, 'Penjaga Segel'], [r.lastCardLosses >= 2, 'Spesialis Nyaris'],
      [r.hoards >= 2, 'Kolektor Kartu 2'], [r.bombDeaths >= 1, 'Pemilik Bom Tak Terpakai'], [r.timeouts >= 3, 'AFK Profesional'],
      [r.passivePasses >= 12, 'Duta Perdamaian'], [r.revenges >= 2, 'Pendendam Bersertifikat'], [r.worstLossStreak >= 5, 'Langganan Kalah'],
      [r.bombWins >= 3, 'Tukang Bom'], [r.rounds >= 6 && wr >= 0.5, 'Musuh Bersama'], [r.rounds >= 6 && wr <= 0.1, 'Penyumbang Poin'],
    ];
    const hit = rules.find((x) => x[0]);
    return hit ? hit[1] : (r.rounds >= 3 ? 'Warga Biasa' : 'Pendatang Baru');
  }
  // The player the director likes to bother: most points lost this match (after 2+ rounds).
  function target() {
    if (M.rounds.length < 2) return null;
    const nm = M.rounds[M.rounds.length - 1].names;
    let best = null;
    nm.forEach((n, i) => { const p = M.penalty[key(n)] || 0; if (p > 0 && (!best || p > best.pen)) best = { name: n, seat: i, pen: p }; });
    return best;
  }
  // Short, true facts about the table, for patch notes and credits.
  function lore() {
    const out = [];
    const nm = last ? last.names : M.names;
    const lc = Object.entries(M.lastCardBy).sort((a, b) => b[1] - a[1])[0];
    if (lc) out.push({ kind: 'lastCard', name: nm.find((n) => key(n) === lc[0]) || lc[0], count: lc[1] });
    if (M.favorite) out.push({ kind: 'favorite', name: M.favorite.name });
    const hd = Object.entries(M.twosDiedBy).sort((a, b) => b[1] - a[1])[0];
    if (hd) out.push({ kind: 'hoarder', name: nm.find((n) => key(n) === hd[0]) || hd[0], count: hd[1] });
    const ez = M.moments.filter((m) => m.bad && m.text.startsWith('"')).pop();
    if (ez) out.push({ kind: 'trash', name: ez.name, text: ez.text });
    if (nm.length) {
      const LMm = last && last.mode === 'last';
      const scoreOf = (n) => { const s = M.scores[key(n)] || []; const v = s.length ? s[s.length - 1] : 0; return LMm ? -v : v; };
      const worst = [...nm].sort((a, b) => scoreOf(a) - scoreOf(b))[0];
      out.push({ kind: 'worst', name: worst, score: LMm ? -scoreOf(worst) : scoreOf(worst), unit: LMm ? 'losses' : 'points' });
    }
    return out;
  }
  window.CapsaMemory = {
    key, match: () => M, round: () => R, lastRound: () => last,
    streak: (n) => M.streak[key(n)] || { win: 0, loss: 0 },
    rep: (n) => repOf(key(n)),
    title, titleOf, target, hasQuad, habit, lore,
    spiral: (n) => !!M.spiral[key(n)], tableHot, pidOf: (n) => key(n),
    mode: () => (last && last.mode) || 'points', losses: (n) => M.losses[key(n)] || 0,
    support: (n) => { M.supported[key(n)] = true; }, supported: (n) => !!M.supported[key(n)],
    favorite: () => M.favorite,
    setups: (type) => M.setups.filter((s) => !type || s.type === type),
    scoresOf: (n) => (M.scores[key(n)] || []).slice(),
    note: (round, name, text, w) => moment(round, name, text, w || 5, false),
    resetReputation: () => { rep = {}; saveRep(); },
  };
})();

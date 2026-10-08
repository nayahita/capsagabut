/*
 * Comedy memory. Runs on every phone and only reacts to facts, so every phone ends up with the same memory.
 *
 * Keeps: the match log, notable moments (for the roast summary), callback threads, grudges,
 * a bounty, streaks, and a persistent reputation per player name (localStorage) that feeds titles.
 *
 * Emits signals for the director through CapsaEvents:
 *   MEM_ONE_CARD, MEM_THREAD_TENSE, MEM_THREAD_RESOLVED, MEM_EZ_RESOLVED, MEM_BOUNTY_POSTED,
 *   MEM_BOUNTY_CLAIMED, MEM_GRUDGE_SETTLED, MEM_BIG_BEATEN, MEM_OVERKILL, MEM_PASSIVE
 */
(function () {
  'use strict';
  const E = window.CapsaEvents;
  if (!E) return;
  const key = (n) => String(n == null ? '' : n).trim().toLowerCase();
  const RANK = (c) => c >> 2;                       // 0 = '3' … 11 = 'A', 12 = '2'
  const sig = (type, p) => E.emit(type, p);
  const REP_KEY = 'capsa-rep-v1';
  const REP0 = { rounds: 0, wins: 0, lastCardLosses: 0, badBeats: 0, hoards: 0, bombDeaths: 0, sealed: 0, passivePasses: 0,
    timeouts: 0, ezLosses: 0, revenges: 0, bombWins: 0, worstLossStreak: 0, bountiesClaimed: 0 };

  let rep = (() => { try { return JSON.parse(localStorage.getItem(REP_KEY) || '{}') || {}; } catch (e) { return {}; } })();
  const saveRep = () => { try { localStorage.setItem(REP_KEY, JSON.stringify(rep)); } catch (e) {} };
  const repRec = (n) => { const k = key(n); if (!k) return null; return (rep[k] = rep[k] || Object.assign({ name: String(n).trim() }, REP0)); };
  const repBump = (n, f, by) => { const r = repRec(n); if (r) r[f] = (r[f] || 0) + (by == null ? 1 : by); };
  const repMax = (n, f, v) => { const r = repRec(n); if (r && (r[f] || 0) < v) r[f] = v; };
  const hasQuad = (hand) => { const c = {}; for (const x of hand || []) { c[RANK(x)] = (c[RANK(x)] || 0) + 1; if (c[RANK(x)] === 4) return true; } return false; };

  let M, R = null, last = null;
  function newMatch(names) {
    M = { startedAt: Date.now(), names: names || [], rounds: [], moments: [], threads: [], chats: [], grudges: [], bounty: null,
      streak: {}, wins: {}, penalty: {}, mistakes: {}, bombs: 0, sflush: 0, twosDied: 0, ezLosses: 0 };
    R = null; last = null;
  }
  newMatch([]);
  function freshRound(d) {
    const names = d.names || M.names, n = names.length || 4;
    return { n: d.round || 0, names, start: Date.now(), counts: Array(n).fill(13), min: Array(n).fill(13), hitOne: Array(n).fill(false),
      passes: Array(n).fill(0), passPlayable: Array(n).fill(0), timeouts: Array(n).fill(0), overkills: Array(n).fill(0), plays: 0, lastBig: null };
  }
  const ensureR = (d) => { if (!R) { R = freshRound(d); R.partial = true; } };
  const moment = (round, name, text, w) => { M.moments.push({ round, name, text, w }); if (M.moments.length > 60) M.moments.shift(); };
  const bump = (obj, n) => { const k = key(n); obj[k] = (obj[k] || 0) + 1; };

  E.on('fact:game:start', (d) => newMatch(d.names));

  E.on('fact:round:start', (d) => {
    if (!M.names.length) M.names = d.names || [];
    R = freshRound(d);
    M.threads.forEach((t) => { if (t.state === 'tense') t.state = 'open'; });
  });

  E.on('fact:play', (d) => {
    ensureR(d); R.plays++;
    if (Array.isArray(d.counts)) { R.counts = d.counts.slice(); d.counts.forEach((c, i) => { R.min[i] = Math.min(R.min[i] == null ? 13 : R.min[i], c); }); }
    const me = d.seat, nm = d.name, left = R.counts[me];
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
    }
    if (d.cat >= 4) { M.bombs++; if (d.cat === 5) M.sflush++; }
  });

  E.on('fact:pass', (d) => {
    ensureR(d);
    const me = d.seat;
    R.passes[me] = (R.passes[me] || 0) + 1;
    if (d.timeout) { R.timeouts[me]++; repBump(d.name, 'timeouts'); }
    if (d.hadPlay) {
      R.passPlayable[me]++; bump(M.mistakes, d.name); repBump(d.name, 'passivePasses');
      if (R.passPlayable[me] === 3) sig('MEM_PASSIVE', { seat: me, name: d.name, count: 3 });
    }
  });

  E.on('fact:chat', (d) => {
    M.chats.push({ seat: d.seat, name: d.name, key: key(d.name), text: d.text, preset: d.preset, trash: !!d.trash, t: Date.now(), round: R ? R.n : 0 });
    if (M.chats.length > 40) M.chats.shift();
  });

  E.on('fact:round:end', (d) => {
    ensureR(d);
    const names = d.names || [], w = d.winner, wName = names[w], now = Date.now();
    if (!M.names.length) M.names = names;
    const row = { round: d.round, winner: w, winnerName: wName, how: d.how, names, counts: d.counts, hands: d.hands || [],
      penalties: d.penalties || [], scoresBefore: d.scoresBefore, scoresAfter: d.scoresAfter, final: d.final,
      min: R.min.slice(), passes: R.passes.slice(), passPlayable: R.passPlayable.slice(), partial: !!R.partial };
    M.rounds.push(row); last = row;

    names.forEach((nm, i) => {
      const k = key(nm), s = M.streak[k] || (M.streak[k] = { win: 0, loss: 0 });
      if (i === w) { s.win++; s.loss = 0; M.wins[k] = (M.wins[k] || 0) + 1; } else { s.loss++; s.win = 0; }
      M.penalty[k] = (M.penalty[k] || 0) + (row.penalties[i] || 0);
    });

    // reputation
    names.forEach((nm, i) => {
      repBump(nm, 'rounds');
      if (i === w) { repBump(nm, 'wins'); if (d.how === 'bomb') repBump(nm, 'bombWins'); return; }
      const left = d.counts[i], hand = row.hands[i] || [];
      if (left === 1) repBump(nm, 'lastCardLosses');
      if (left > 0 && left <= 2) repBump(nm, 'badBeats');
      const twos = hand.filter((c) => RANK(c) === 12).length;
      if (twos >= 2) { repBump(nm, 'hoards'); M.twosDied += twos; }
      if (hasQuad(hand)) repBump(nm, 'bombDeaths');
      if (left === 13) { repBump(nm, 'sealed'); moment(d.round, nm, 'selesai masih pegang 13 kartu', 9); }
      repMax(nm, 'worstLossStreak', M.streak[key(nm)].loss);
    });

    // callback thread: lost on the last card → later back on one card → resolution
    M.threads.filter((t) => t.type === 'lastCard' && t.state === 'tense').forEach((t) => {
      const i = names.findIndex((x) => key(x) === t.key);
      if (i < 0) return;
      const outcome = i === w ? 'won' : 'lost';
      sig('MEM_THREAD_RESOLVED', { seat: i, name: names[i], outcome, originRound: t.round, times: t.times });
      if (outcome === 'won') { t.state = 'closed'; moment(d.round, names[i], 'akhirnya menang di situasi kartu terakhir', 4); }
      else { t.state = 'open'; t.times = (t.times || 1) + 1; t.lastRound = d.round; moment(d.round, names[i], `kalah di kartu terakhir (lagi, ke-${t.times})`, 7); }
    });
    names.forEach((nm, i) => {
      if (i === w || d.counts[i] !== 1) return;
      if (!M.threads.some((t) => t.type === 'lastCard' && t.key === key(nm) && t.state !== 'closed')) {
        M.threads.push({ type: 'lastCard', key: key(nm), name: nm, round: d.round, state: 'open', times: 1 });
        moment(d.round, nm, 'kalah di kartu terakhir', 5);
      }
    });

    // trash talk that aged badly (or well)
    const said = {};
    M.chats.filter((c) => c.trash && !c.resolved && (c.round === d.round || now - c.t < 120000)).forEach((c) => { said[c.key] = c; });
    Object.values(said).forEach((c) => {
      const i = names.findIndex((x) => key(x) === c.key);
      if (i < 0) return;
      M.chats.forEach((o) => { if (o.key === c.key && o.trash) o.resolved = true; });
      const outcome = i === w ? 'won' : 'lost';
      if (outcome === 'lost') { M.ezLosses++; repBump(names[i], 'ezLosses'); moment(d.round, names[i], `ngetik "${c.text}" lalu kalah`, 8); }
      sig('MEM_EZ_RESOLVED', { seat: i, name: names[i], text: c.text, outcome, secs: Math.max(1, Math.round((now - c.t) / 1000)) });
    });

    // grudges: settle, then record new humiliations
    M.grudges = M.grudges.filter((g) => {
      if (key(wName) !== g.victimKey) return true;
      const bi = names.findIndex((x) => key(x) === g.bullyKey);
      if (bi < 0 || bi === w) return true;
      sig('MEM_GRUDGE_SETTLED', { seat: w, name: wName, bully: names[bi], bullySeat: bi, round: g.round, pen: g.pen });
      repBump(wName, 'revenges'); moment(d.round, wName, `bales dendam ke ${names[bi]} (utang ronde ${g.round})`, 6);
      return false;
    });
    names.forEach((nm, i) => {
      const pen = row.penalties[i] || 0;
      if (i !== w && pen >= 10 && !M.grudges.some((g) => g.victimKey === key(nm) && g.bullyKey === key(wName))) {
        M.grudges.push({ victimKey: key(nm), victim: nm, bullyKey: key(wName), bully: wName, round: d.round, pen });
      }
    });

    // bounty: claim, then maybe post
    if (M.bounty) {
      const ti = names.findIndex((x) => key(x) === M.bounty.key);
      if (ti >= 0 && ti !== w) {
        sig('MEM_BOUNTY_CLAIMED', { seat: w, name: wName, target: M.bounty.name, targetSeat: ti, streak: M.bounty.streak });
        repBump(wName, 'bountiesClaimed'); moment(d.round, wName, `ngeklaim bounty ${M.bounty.name}`, 6);
        M.bounty = null;
      }
    }
    const ws = M.streak[key(wName)];
    if (!M.bounty && ws && ws.win >= 3) { M.bounty = { key: key(wName), name: wName, round: d.round, streak: ws.win }; sig('MEM_BOUNTY_POSTED', { seat: w, name: wName, streak: ws.win }); }
    if (d.how === 'bomb') moment(d.round, wName, 'menang pakai bom', 3);

    saveRep(); R = null;
  });

  /* ---------- read API ---------- */
  function title(n) {
    const r = Object.assign({}, REP0, rep[key(n)] || {}), wr = r.rounds ? r.wins / r.rounds : 0;
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
    const names = M.rounds[M.rounds.length - 1].names;
    let best = null;
    names.forEach((n, i) => { const p = M.penalty[key(n)] || 0; if (p > 0 && (!best || p > best.pen)) best = { name: n, seat: i, pen: p }; });
    return best;
  }
  window.CapsaMemory = {
    key, match: () => M, round: () => R, lastRound: () => last,
    streak: (n) => M.streak[key(n)] || { win: 0, loss: 0 },
    rep: (n) => Object.assign({}, REP0, rep[key(n)] || {}),
    title, target, hasQuad,
    resetReputation: () => { rep = {}; saveRep(); },
  };
})();

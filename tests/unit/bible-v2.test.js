// Comedy Bible v2: each new bit becomes eligible from the signal it was designed for.
const H = require('./harness')();
const { E, D, M, L, ok } = H;
let elig = [];
D.bits.forEach((b) => { const w = b.when; b.when = (B) => { const v = w(B); if (v && !(v.once && D.state.usedKeys.has(v.once))) elig.push(b.id); return v; }; });
let N = H.names, pids = null, R = 0, loss = [0, 0, 0, 0];
const take = async () => { await H.wait(15); const e = elig.slice(); elig = []; return e; };
function game(names) { N = names; H.names = names; R = 0; loss = names.map(() => 0); const d = { names }; CapsaHooks.gameStart(d); pids = d.pids; E.ingest('game:start', d); }
const start = (starter = 0) => { R++; E.ingest('round:start', { round: R, names: N, pids, scores: loss, starter }); };
function end(order, loser, left, extra = {}) {
  const before = loss.slice(); loss = loss.map((x, i) => (i === loser ? x + 1 : x));
  const counts = N.map((_, i) => (i === loser ? left : 0));
  E.ingest('round:end', Object.assign({ round: R, winner: order[0], loser, order: [...order, loser], how: 'habis', mode: 'last', names: N, counts,
    penalties: N.map((_, i) => (i === loser ? left : 0)), hands: N.map((_, i) => (i === loser ? Array.from({ length: left }, (_, k) => k * 4) : [])),
    final: { combo: 'Satuan', cards: [40] }, scoresBefore: before, scoresAfter: loss.slice(), delay: 0,
    dealt: N.map(() => ({ twos: 0, high: 2, quad: false, score: 50 })) }, extra));
}
const pass = (seat, x = {}) => E.ingest('pass', Object.assign({ seat, name: N[seat], timeout: false, hadPlay: false, could: [], counts: N.map(() => 6), table: { combo: 'Satuan', by: (seat + 3) % 4 }, thinkMs: 3000, cancels: 0 }, x));
(async () => {
  Object.assign(D.settings.budget, { micro: { perRound: 99, gapMs: 0 }, stage: { perRound: 99, gapMs: 0 } });
  Math.random = () => 0.999;
  game(['Ana', 'Budi', 'Cici', 'Dodi']); await H.wait(5);
  start();
  pass(1, { thinkMs: 27000 }); let e = await take(); ok('rapat-panjang ← MEM_DITHER', e.includes('rapat-panjang'));
  E.ingest('chat', { seat: 3, name: 'Dodi', text: 'salah gua', confession: true, counts: [6, 6, 6, 6] }); pass(3, { hadPlay: true, could: ['Pair'] });
  e = await take(); ok('pengakuan-diterima ← MEM_REPEAT_MISTAKE', e.includes('pengakuan-diterima'));
  E.ingest('reveal', { seat: 2, name: 'Cici', count: 9, cards: [1, 5, 9] }); E.ingest('reveal', { seat: 0, name: 'Ana', count: 4, cards: [2, 6] });
  E.ingest('emote', { seat: 2, name: 'Cici', e: 'laugh' });
  end([0, 3, 1], 2, 9, { dealt: [{ twos: 0, high: 1, quad: false, score: 30 }, { twos: 0, high: 2, quad: false, score: 50 }, { twos: 2, high: 4, quad: false, score: 70 }, { twos: 0, high: 2, quad: false, score: 50 }] });
  e = await take();
  ok('kartu-terbuka ← showed hand then lost', e.includes('kartu-terbuka'));
  ok('terbukti ← showed hand then finished first', e.includes('terbukti'));
  ok('modal-awal ← strong dealt hand, lost with 9', e.includes('modal-awal'));
  ok('tanpa-modal ← weak dealt hand, finished first', e.includes('tanpa-modal'));
  ok('emote-dikembalikan ← laughing emote then lost', e.includes('emote-dikembalikan'));
  start(); E.ingest('player:leave', { seat: 3, name: 'Dodi' }); E.ingest('play', { seat: 0, name: 'Ana', combo: 'Satuan', cat: 0, size: 1, cards: [8], counts: [12, 13, 13, 13], prev: null, t: Date.now() });
  E.ingest('player:rejoin', { seat: 3, name: 'Dodi', awayMs: 20000 }); e = await take();
  ok('kembali-online ← MEM_REJOIN (missed plays counted)', e.includes('kembali-online') && H.take('MEM_REJOIN').some((s) => s.missed === 1));
  // Cici loses on 1 card → embarrassing typed moment; Budi spirals for the support bit
  end([0, 3, 2], 1, 3); await take();
  for (let k = 0; k < 3; k++) { start(); end([0, 2, 3], 1, 5); await H.wait(5); }
  e = await take();
  ok('sistem-prihatin ← MEM_SPIRAL (support bit allowed for the spiraling player)', e.includes('sistem-prihatin') || H.has('MEM_SPIRAL'), JSON.stringify(loss));
  start(); for (let k = 0; k < 6; k++) E.ingest('play', { seat: 2, name: 'Cici', combo: 'Pair', cat: 0, size: 2, cards: [4, 5], counts: [9, 9, 9, 9], prev: null, t: Date.now() });
  end([0, 2, 3], 1, 1);   // Budi loses on 1 card
  for (let k = 0; k < 9; k++) { start(); end([0, 1, 2], 3, 2); await H.wait(3); }   // Ana beats Dodi a lot → rivalry next match
  E.ingest('match:end', { reason: 'setup', rounds: R, names: N, pids, scores: loss });
  await H.wait(20);
  // second match: Budi renamed, Cici breaks her habit, Budi repeats a last-card loss, Ana vs Dodi rivalry
  L.decisions['budi s'] = pids[1];
  game(['Ana', 'Budi S', 'Cici', 'Dodi']);
  start(2); e = await take();
  ok('selamat-datang ← MEM_RETURNING at round 1', e.includes('selamat-datang'));
  ok('nama-baru ← MEM_RENAMED (Budi → Budi S)', e.includes('nama-baru') || H.take('MEM_RENAMED').length > 0);
  E.ingest('play', { seat: 2, name: 'Cici', combo: 'Satuan', cat: 0, size: 1, cards: [0], counts: [13, 13, 12, 13], prev: null, t: Date.now() });
  e = await take(); ok('kebiasaan-baru ← MEM_HABIT_BROKEN', e.includes('kebiasaan-baru'));
  end([2, 0, 3], 1, 1); e = await take();
  ok('kejadian-serupa ← same embarrassment as the last match, inside 24 h', e.includes('kejadian-serupa'), JSON.stringify(H.take('MEM_DEJA_VU')));
  // rivalry needs ≥8 meetings and a close score: give Dodi some wins back
  for (let k = 0; k < 6; k++) { start(); end([3, 1, 2], 0, 2); await H.wait(3); }
  ok('rivalitas-resmi ← MEM_RIVALRY (long, close head-to-head)', H.has('MEM_RIVALRY'), JSON.stringify(L.h2h(pids[0], pids[3])));
  // demos build
  const bad = []; for (const b of D.bits) { try { const p = D.play(b.id); if (!p || !p.steps.length) bad.push(b.id); } catch (x) { bad.push(b.id + ':' + x.message); } }
  ok(`every bit builds from its demo values (${D.bits.length} bits)`, !bad.length, bad.join(', '));
  H.done();
})();

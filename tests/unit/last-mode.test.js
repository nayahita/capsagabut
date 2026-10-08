// "Main sampai satu kalah": only the last player holding cards loses; standings count losses.
const H = require('./harness')();
const { E, D, M, S, ok } = H;
let N = H.names, loss = [0, 0, 0, 0], R = 0;
const start = (starter = 0) => { R++; E.ingest('round:start', { round: R, names: N, scores: loss, starter }); };
// order = finishing seats (first … last finisher); loser = the remaining seat
function end(order, loser, left, extra = {}) {
  const before = loss.slice(); loss = loss.map((x, i) => (i === loser ? x + 1 : x));
  const counts = N.map((_, i) => (i === loser ? left : 0)), m = left === 13 ? 3 : left >= 10 ? 2 : 1;
  E.ingest('round:end', Object.assign({ round: R, winner: order[0], loser, order: [...order, loser], how: 'habis', mode: 'last', names: N, counts,
    penalties: N.map((_, i) => (i === loser ? left * m : 0)), hands: N.map((_, i) => (i === loser ? Array.from({ length: left }, (_, k) => k * 4) : [])),
    final: { combo: 'Satuan', cards: [40] }, scoresBefore: before, scoresAfter: loss.slice(), delay: 0 }, extra));
}
(async () => {
  Object.assign(D.settings.budget, { micro: { perRound: 99, gapMs: 0 }, stage: { perRound: 99, gapMs: 0 } });
  Math.random = () => 0.999;
  E.ingest('game:start', { names: N }); await H.wait(5);
  start(); end([0, 2, 3], 1, 6); await H.wait(10);
  ok('PLAYER_LOSE only for the last player', H.take('PLAYER_LOSE').length === 1 && H.take('PLAYER_LOSE')[0].seat === 1);
  ok('favourite = the round-1 loser (worst standing)', M.favorite() && M.favorite().name === 'Budi');
  ok('streaks: Budi loss 1, middle finishers 0', M.streak('Budi').loss === 1 && M.streak('Cici').loss === 0 && M.streak('Dodi').loss === 0);
  ok('stats: losses only for the last player, no points', S.get('Budi').losses === 1 && S.get('Cici').losses === 0 && S.get('Budi').points === 0);
  // last card thread: Dodi loses on 1 card, later reaches 1 card again and finishes second → escaped (won)
  start(); end([0, 1, 2], 3, 1); await H.wait(5);
  start(); E.ingest('play', { seat: 3, name: 'Dodi', combo: 'Satuan', cat: 0, size: 1, cards: [8], counts: [5, 5, 5, 1], prev: null, t: Date.now() });
  end([0, 3, 2], 1, 4); await H.wait(10);
  ok('finishing 2nd after being on 1 card resolves the thread as "won"', H.take('MEM_THREAD_RESOLVED').some((s) => s.name === 'Dodi' && s.outcome === 'won'));
  // EZ by a middle finisher: no "lost" setup
  start(); E.ingest('chat', { seat: 2, name: 'Cici', text: 'EZ', trash: true, counts: [9, 9, 9, 9] }); end([0, 2, 3], 1, 5); await H.wait(10);
  ok('boast then finishing in the middle → outcome "mid", no ezLost setup', H.take('MEM_EZ_RESOLVED').some((s) => s.name === 'Cici' && s.outcome === 'mid') && !M.setups('ezLost').some((s) => s.name === 'Cici'));
  // spiral in loss terms: Budi lost 3 in a row and is 3+ losses behind everyone else
  start(); end([0, 2, 3], 1, 7); await H.wait(10);
  ok('spiral after 3 straight losses, 3+ more than the next', H.has('MEM_SPIRAL') && M.spiral('Budi'), JSON.stringify(loss));
  ok('UPSET_WIN uses losses: not yet (Budi has not finished first)', !H.has('UPSET_WIN'));
  start(); end([1, 2, 3], 0, 3); await H.wait(10);
  ok('UPSET_WIN when the player with the most losses finishes first', H.take('UPSET_WIN').some((e) => e.name === 'Budi' && e.unit === 'losses'));
  // penyebab blames the first finisher (who wasn't even there) — check eligibility directly
  const bit = D.bits.find((b) => b.id === 'penyebab');
  const fakeB = { d: { mode: 'last', names: N, order: [2, 0, 3, 1], loser: 1, counts: [0, 6, 0, 0], winner: 2 }, mem: M, ev: () => null, evs: () => [], names: N };
  ok('penyebab names the first finisher in last mode', (bit.when(fakeB) || {}).name === 'Cici');
  ok('memory reports the mode', M.mode() === 'last' && M.losses('Budi') >= 4);
  H.done();
})();

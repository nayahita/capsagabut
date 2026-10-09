// Bilingual comedy: every bit writes both languages, the same shape in each, and the English has no Indonesian left in it.
const H = require('./harness')();
const { D, ok } = H;
const I = CapsaI18n;
const ID_WORDS = [' yang ', ' dan ', 'tidak', 'sudah', 'kartu', 'ronde', 'menang', 'kalah', 'pemain', 'giliran', 'sistem', 'untuk', 'masih', 'belum', 'hadiah', 'sebelum'];
const SKIP = new Set(['do', 'key', 'kind', 'e', 'level', 'sig', 'icon', 'size', 'name', 'combo']);   // ids and player names, not prose
const texts = (x, out = [], k = '') => {
  if (typeof x === 'string') { if (!SKIP.has(k)) out.push(x); } else if (Array.isArray(x)) x.forEach((y) => texts(y, out, k));
  else if (x && typeof x === 'object') Object.entries(x).forEach(([kk, y]) => texts(y, out, kk));
  return out;
};
const indo = (arr) => arr.filter((t) => ID_WORDS.some((w) => (' ' + t.toLowerCase() + ' ').includes(w)));
const B = { fact: 'test', d: {}, sig: [], mem: CapsaMemory, names: H.names, now: Date.now(), ev: () => null, evs: () => [] };
const helpers = { pick: (a) => a[0], card: (c) => 'c' + c, cards: (a) => (a || []).map((c) => 'c' + c).join(' '), num: (x) => String(x) };

(async () => {
  ok('tests run in English by default', I.lang() === 'en' && tr('a', 'b') === 'a');
  const shape = [], leaks = [], impure = [], same = [];
  for (const bit of D.bits.filter((b) => b.demo)) {
    const v = JSON.parse(JSON.stringify(bit.demo)), before = JSON.stringify(v);
    let r;
    try { r = I.both(() => ({ steps: bit.script(v, B, helpers) || [], note: bit.note ? bit.note(v, B) : null })); } catch (e) { shape.push(bit.id + ':' + e.message); continue; }
    if (JSON.stringify(v) !== before) impure.push(bit.id);
    if (r.en.steps.length !== r.id.steps.length || r.en.steps.some((s, i) => s.do !== r.id.steps[i].do)) shape.push(bit.id);
    const en = texts(r.en), bad = indo(en);
    if (bad.length) leaks.push(bit.id + ' → ' + bad.join(' | '));
    if (en.length && JSON.stringify(r.en) === JSON.stringify(r.id) && !['noted', 'ez-valid'].includes(bit.id)) same.push(bit.id);
  }
  ok(`every demo bit: same steps in English and Indonesian (${D.bits.filter((b) => b.demo).length} bits)`, !shape.length, shape.join(', '));
  ok('script()/note() leave their values untouched', !impure.length, impure.join(', '));
  ok('no Indonesian words in the English performances', !leaks.length, leaks.join('\n     '));
  ok('bits with text actually differ between the languages', !same.length, same.join(', '));

  // the real path: one build ships both, previews included
  const p = D.play('survei');
  ok('a performance carries the Indonesian version in alt.id', p && p.alt && p.alt.id && /Bagaimana ronde ini/.test(JSON.stringify(p.alt.id.steps)) && /How was this round/.test(JSON.stringify(p.steps)));
  const hen = D.play('hening');
  ok('notes are written in both languages', hen.note && /silence/.test(hen.note.text) && /hening/.test(hen.alt.id.note.text));
  // h.pick replays the same dice in both languages, so every phone sees the same joke
  const real = Math.random; let mismatch = 0;
  for (let k = 0; k < 30; k++) {
    const q = D.play('drumroll-nothing'), en = q.steps[q.steps.length - 1].text, id = q.alt.id.steps[q.alt.id.steps.length - 1].text;
    const iE = ['Nothing. Carry on.', 'Forgot what it was.', 'That is all.'].indexOf(en), iI = ['Tidak ada. Lanjut.', 'Lupa mau bilang apa.', 'Itu saja.'].indexOf(id);
    if (iE < 0 || iE !== iI) mismatch++;
  }
  Math.random = real;
  ok('h.pick() chooses the same line in both languages', !mismatch, mismatch + '/30');
  ok('Indonesian can be forced for a check', I.inLang('id', () => tr('a', 'b')) === 'b');

  // reaction cards: every text is a pair, English has no Indonesian
  const rx = [];
  Object.entries(CAPSA_REACTIONS.events).forEach(([k, def]) => [def.title, def.stat, ...(def.texts || [])].forEach((t) => {
    if (!I.isPair(t) || !t.en || !t.id) rx.push(k + ': not a pair'); else if (indo([t.en]).length) rx.push(k + ': ' + t.en);
  }));
  ok('reaction cards: {en, id} pairs, English is English', !rx.length, rx.join(' | '));

  // memory: titles and moments resolve per language
  const M = CapsaMemory;
  ok('titles resolve in the current language', M.title('Nobody') === 'Newcomer' && I.inLang('id', () => M.title('Nobody')) === 'Pendatang Baru' && M.titleId('Nobody') === 'newcomer');
  H.E.ingest('game:start', { names: H.names });
  H.E.ingest('round:start', { round: 1, names: H.names, scores: [0, 0, 0, 0], starter: 0 });
  H.E.ingest('round:end', { round: 1, winner: 0, how: 'habis', names: H.names, counts: [0, 1, 13, 5], hands: [[], [7], Array.from({ length: 13 }, (_, i) => i), [1, 2, 3, 4, 5]],
    penalties: [0, 1, 39, 5], scoresBefore: [0, 0, 0, 0], scoresAfter: [45, -1, -39, -5], final: { combo: 'Satuan', cards: [40] }, delay: 0 });
  await H.wait(10);
  const ms = M.match().moments;
  ok('memory moments are stored in both languages', ms.length >= 2 && ms.every((m) => typeof m.text === 'string' || (I.isPair(m.text) && !indo([m.text.en]).length)),
    JSON.stringify(ms.map((m) => m.text)));
  H.done();
})();

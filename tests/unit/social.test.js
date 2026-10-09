// Social interaction system: catalog, validation, rate limits, history, voice routing, comedy hand-off.
// The drawing itself is covered by tests/sim/social.py (browser); here the harness has no real DOM, so draw() is skipped.
const H = require('./harness')({ files: ['reactions.config.js', 'events.js', 'stats.js', 'lore.js', 'comedy/config.js', 'comedy/director.js', 'comedy/memory.js', 'comedy/bits.js', 'social/catalog.js', 'social/social.js'] });
const { E, ok } = H;
const S = global.CapsaSocial, C = global.CAPSA_SOCIAL;

// ---- a controllable stand-in for the core ----
const sent = [];
let V = { phase: 'turn', round: 1, turn: 0, names: ['Ana', 'Budi', 'Cici', 'Dodi'], counts: [13, 13, 13, 13], online: true, me: 0, uids: ['u0', 'u1', 'u2', 'u3'], pids: null, sameRoom: false };
let clock = 1_000_000;
const audioLog = [];
const node = () => ({ connect(x) { return x || node(); }, disconnect() {}, start() {}, stop() { audioLog.push('stop'); }, gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} }, Q: { value: 0 } });
const ctx = { state: 'running', currentTime: 0, destination: node(), createGain: node, createOscillator: () => Object.assign(node(), { type: '' }), createBiquadFilter: node, createBufferSource: node, decodeAudioData: (ab, ok) => ok({ duration: 1 }) };
Object.assign(global.CapsaFX, {
  view: () => V, serverNow: () => clock, soundOn: () => true, audio: () => ({ ctx, out: node() }),
  social: (d) => { sent.push(d); return true; }, emoteSfx: (e) => audioLog.push('sfx ' + e), mascotSVG: () => '<svg></svg>',
});
let fetched = [];
global.fetch = async (url) => { fetched.push(url); return { ok: false, status: 404 }; };
let nn = 0;
const ev = (uid, id, dt = 0, extra = {}) => Object.assign({ t: 'social', id, uid, seat: 0, n: 'n' + (++nn), ts: clock + dt }, extra);
const tick = (ms) => { clock += ms; };

(async () => {
  // ---------- catalog ----------
  const ids = S.catalog.ids();
  ok('catalog: 5 quick chat categories', C.CATEGORIES.length === 5 && C.CATEGORIES.every((c) => C.QUICK.some((q) => q.cat === c.id)));
  ok('catalog: 8–14 emotes', C.EMOTES.length >= 8 && C.EMOTES.length <= 14, C.EMOTES.length);
  ok('catalog: every id well-formed and unique', ids.every((i) => /^(qc|emo)\.[a-z0-9-]{1,24}$/.test(i)) && new Set(ids).size === C.QUICK.length + C.EMOTES.length);
  const files = (f) => (typeof f === 'string' ? [f] : [f.en, f.id]);   // a recording may be per language: { en, id }
  ok('catalog: every voice reference exists and points at a local file', [...C.QUICK, ...C.EMOTES].filter((x) => x.voice).every((x) => C.VOICE[x.voice] && files(C.VOICE[x.voice].file).every((f) => /^audio\/voice\/[a-z0-9-]+\.(mp3|ogg|wav)$/.test(f))));
  // ---------- i18n: every text in the catalog exists in English and Indonesian ----------
  const pair = (v) => !!(v && typeof v === 'object' && typeof v.en === 'string' && v.en.trim() && typeof v.id === 'string' && v.id.trim());
  const missing = [
    ...C.CATEGORIES.filter((c) => !pair(c.label)).map((c) => 'cat ' + c.id),
    ...C.QUICK.filter((q) => !pair(q.text)).map((q) => 'qc ' + q.id),
    ...C.EMOTES.filter((e) => !pair(e.label) || !pair(e.say)).map((e) => 'emo ' + e.id),
    ...Object.entries(C.VOICE).filter(([, v]) => !pair(v.line)).map(([k]) => 'voice ' + k),
    ...[...new Set(C.EMOTES.map((e) => e.pack || 'Dasar'))].filter((p) => !pair((C.PACKS || {})[p])).map((p) => 'pack ' + p),
  ];
  ok('i18n: every category label, quick chat, emote label/say, pack and voice line has en + id', missing.length === 0, missing.join(', '));
  ok('i18n: English is the default, Indonesian kept', CapsaI18n.pick(C.QUICK.find((q) => q.id === 'belum').text) === 'Not over yet'
    && CapsaI18n.inLang('id', () => CapsaI18n.pick(C.QUICK.find((q) => q.id === 'belum').text)) === 'Belum selesai');
  ok('i18n: the banter category is English in English mode', CapsaI18n.pick(C.CATEGORIES.find((c) => c.id === 'local').label) === 'Banter'
    && CapsaI18n.inLang('id', () => CapsaI18n.pick(C.CATEGORIES.find((c) => c.id === 'local').label)) === 'Bacot');
  ok('catalog: new emotes have a face', C.EMOTES.slice(6).every((e) => typeof e.face === 'function' && e.face({ ln: '', INK: '#000', MOUTH: '#000', TEAR: '#000' }).includes('<')));

  E.ingest('game:start', { names: V.names }); E.ingest('round:start', { round: 1, names: V.names, scores: [0, 0, 0, 0], starter: 0 });
  await H.wait(5);
  const facts = []; E.on('fact:social', (e) => facts.push(e));
  const replies = []; E.on('fact:social:reply', (e) => replies.push(e));

  // ---------- 8 + 9 validation ----------
  ok('8 unknown id rejected', S.receive(ev('u1', 'qc.hacked')).why === 'unknown-id');
  ok('8 unknown kind prefix rejected', S.receive(ev('u1', 'sfx.gg')).why === 'unknown-id');
  ok('8 prototype keys are not ids', S.receive(ev('u1', 'constructor')).why === 'unknown-id' && S.receive(ev('u1', '__proto__')).why === 'unknown-id');
  ok('9 sender must be in the match (by uid)', S.receive(ev('stranger', 'qc.gg')).why === 'not-member');
  const r9 = S.receive(ev('u2', 'qc.gg', 0, { seat: 3, text: '<script>x</script>', audio: 'https://evil/x.mp3', url: 'https://evil' }));
  ok('9 online: seat comes from the uid, not from the event', r9.ok && r9.seat === 2, JSON.stringify(r9));
  ok('9 extra fields never reach history or facts', !JSON.stringify(facts).includes('evil') && !JSON.stringify(facts).includes('script'));
  ok('9 no fetch of an injected URL', !fetched.some((u) => /evil/.test(u)));
  ok('missing nonce rejected', S.receive({ t: 'social', id: 'qc.gg', uid: 'u1', ts: clock }).why === 'nonce');
  V.phase = 'lobby'; ok('not during lobby/setup', S.receive(ev('u1', 'qc.gg')).why === 'state'); V.phase = 'turn';

  // ---------- 11 duplicate / late / stale ----------
  tick(2000);
  const e1 = ev('u1', 'qc.santai');
  ok('11 first copy accepted', S.receive(e1).ok);
  ok('11 duplicate dropped', S.receive(Object.assign({}, e1)).why === 'duplicate');
  tick(2000);
  const late = S.receive(ev('u3', 'qc.sabar', -9000));
  ok('11 late (9 s): remembered, not drawn', late.ok && late.why === 'late');
  ok('11 very old (40 s): ignored', S.receive(ev('u3', 'qc.waduh', -40000)).why === 'stale');
  tick(2000);
  S.receive(ev('u3', 'qc.hah'));
  ok('11 out of order: older than what was already shown is not drawn', S.receive(ev('u3', 'qc.serius', -1000)).why === 'late');

  // ---------- 7 rate limits ----------
  tick(5000);
  ok('7 receiver: emote faster than the minimum gap from one sender is dropped', S.receive(ev('u1', 'emo.laugh')).ok && S.receive(ev('u1', 'emo.cry', 300)).why === 'rate');
  ok('7 receiver: kinds are limited separately', S.receive(ev('u1', 'qc.hah', 300)).ok);
  tick(20000);
  let burst = 0; for (let i = 0; i < 9; i++) { if (S.receive(ev('u3', i % 2 ? 'emo.cry' : 'qc.hah', i * 950)).ok) burst++; }
  ok('7 receiver: burst cap per sender', burst === C.CONFIG.receive.burst.n, burst);
  // sender side
  tick(30000); sent.length = 0;
  const a = S.send('emo.laugh'), b = S.send('emo.cry'), q = S.send('qc.gg');
  ok('7 sender: emote cooldown', a.ok && !b.ok && b.why === 'cooldown' && b.ms > 0);
  ok('7 sender: quick chat has its own cooldown', q.ok && sent.length === 2);
  ok('7 sender: unknown id refused before sending', S.send('qc.nope').why === 'unknown' && sent.length === 2);
  ok('7 sender: payload is minimal', JSON.stringify(Object.keys(sent[0]).sort()) === JSON.stringify(['id', 'n', 'seat', 'to']));

  // ---------- 3 / 4 / 16 voice ----------
  tick(30000); fetched = []; S.voice.stop();
  const v1 = S.receive(ev('u1', 'qc.belum'));
  await H.wait(10);
  ok('3 voiced line plays on an eligible phone', v1.voice === true, JSON.stringify(v1));
  ok('4 missing file → placeholder, line still delivered', fetched.includes('audio/voice/underdog-belum.mp3') && S.voice.log().some((l) => l === 'placeholder underdog.belum'));
  tick(1000);
  const v2 = S.receive(ev('u2', 'qc.yakin'));
  ok('one voice at a time (bus busy → skipped, line still delivered)', v2.ok && !v2.voice && S.voice.log().includes('busy stoic.yakin'));
  tick(2000);
  const v3 = S.receive(ev('u1', 'qc.kokbisa'));
  ok('voice lines per sender are rate-limited', v3.ok && !v3.voice, JSON.stringify(v3));
  tick(6000);
  ctx.state = 'suspended'; S.voice.stop();
  const v4 = S.receive(ev('u2', 'qc.gg'));
  ok('16 autoplay blocked: no voice, nothing queued', v4.ok && !v4.voice && S.voice.log().includes('blocked stoic.gg'));
  tick(10000); await H.wait(5);
  ok('16 nothing plays later once audio unlocks', !S.voice.busy());
  ctx.state = 'running';
  // repeats
  tick(10000);
  S.receive(ev('u3', 'emo.skull')); tick(1200);
  const rep = S.receive(ev('u3', 'emo.skull'));
  ok('repeat within the window is flagged and not voiced', rep.ok && rep.entry.repeat && !rep.voice);
  // 6 voice off
  tick(10000); S.set('voice', false);
  const v6 = S.receive(ev('u2', 'qc.gg'));
  ok('6 voice off: line delivered, no voice', v6.ok && !v6.voice && v6.why !== 'hidden');
  S.set('voice', true);
  // same room: the voice comes out of the sender's phone only
  tick(10000); V.sameRoom = true; S.voice.stop();
  const sr1 = S.receive(ev('u1', 'qc.gg')); tick(5000); S.voice.stop();
  const sr2 = S.receive(ev('u0', 'qc.gg'));
  ok('same table: other players\' voice not played here, own voice is', sr1.ok && !sr1.voice && sr2.voice === true);
  V.sameRoom = false;

  // ---------- 5 mute (local) ----------
  tick(10000);
  ok('5 mute someone', S.setMuted(1, true) && S.isMuted(1) && !S.isMuted(2));
  ok('5 cannot mute yourself', !S.setMuted(0, true) && !S.isMuted(0));
  const m1 = S.receive(ev('u1', 'qc.belum'));
  ok('5 muted: not drawn, no voice, still in history', m1.ok && m1.why === 'hidden' && !m1.voice && S.history.lastBy(1).id === 'qc.belum');
  ok('5 mute is stored on this phone only (localStorage)', JSON.parse(H.store['capsa.social']).muted['u:u1'] === 'Budi');
  S.setMuted(1, false);
  S.set('showOthers', false);
  tick(5000);
  ok('emotes from others can be hidden; your own still show', S.receive(ev('u2', 'emo.laugh')).why === 'hidden' && S.receive(ev('u0', 'emo.laugh')).why !== 'hidden');
  S.set('showOthers', true);

  // ---------- history + comedy hand-off ----------
  tick(10000);
  S.receive(ev('u2', 'qc.ez', 0, { to: 1 })); tick(2000);
  S.receive(ev('u1', 'emo.villain')); tick(2000);
  ok('history: taunt aimed at a player is counted', S.history.tauntsReceived(1, { direct: true }) >= 1);
  ok('history: reply detected (Budi answered Cici)', replies.some((r) => r.seat === 1 && r.to === 2) && S.history.respondedTo(1, 2));
  ok('history: summary by tone', (S.history.summary()[2] || {}).sent.taunt >= 1);
  ok('comedy: quick chat reached the memory as a trash-talk chat', CapsaMemory.match().chats.some((c) => c.text === '@Budi EZ' && c.trash));
  ok('comedy: target becomes a poke', CapsaMemory.match().chats.some((c) => c.target === 1));
  // the 'chat' fact is built on each phone, in that phone's language (only the id travelled)
  const chatsSeen = []; const offChat = E.on ? E.on('fact:chat', (c) => chatsSeen.push(c)) : null;
  tick(10000); S.receive(ev('u3', 'qc.belum', 0, { to: 1 }));
  tick(10000); CapsaI18n.inLang('id', () => S.receive(ev('u3', 'qc.belum', 0, { to: 1 })));
  const [cEn, cId] = chatsSeen.slice(-2);
  ok('i18n: quick chat reaches the comedy memory in this phone\'s language (en)', cEn && cEn.text === '@Budi Not over yet' && cEn.prediction, JSON.stringify(cEn));
  ok('i18n: quick chat reaches the comedy memory in this phone\'s language (id)', cId && cId.text === '@Budi Belum selesai', JSON.stringify(cId));
  ok('i18n: the chat fact also carries both languages', cId && cId.texts && cId.texts.en === '@Budi Not over yet' && cId.texts.id === '@Budi Belum selesai');
  ok('i18n: memory stored the line as the phone said it', CapsaMemory.match().chats.some((c) => c.text === '@Budi Belum selesai') && CapsaMemory.match().chats.some((c) => c.text === '@Budi Not over yet'));
  if (typeof offChat === 'function') offChat();
  tick(10000); S.receive(ev('u1', 'emo.villain')); tick(2000);
  const lastFact = facts[facts.length - 1];
  ok('fact:social carries only catalog data', lastFact && lastFact.id === 'emo.villain' && lastFact.tone === 'taunt' && !('text' in lastFact));
  // the taunting emote backfires when Budi loses with plenty left (new emotes carry their tone)
  H.sigs.length = 0;
  E.ingest('round:end', { round: 1, winner: 0, loser: 1, order: [0, 2, 3, 1], how: 'habis', mode: 'last', names: V.names, counts: [0, 9, 0, 0], penalties: [0, 9, 0, 0],
    hands: [[], [1, 2, 3, 4, 5, 6, 7, 8, 9], [], []], final: { combo: 'Satuan', cards: [40] }, scoresBefore: [0, 0, 0, 0], scoresAfter: [0, 1, 0, 0], delay: 0,
    dealt: V.names.map(() => ({ twos: 0, high: 2, quad: false, score: 50 })) });
  await H.wait(5);
  ok('comedy: villain emote then lost with 9 → MEM_EMOTE_BACKFIRE', H.take('MEM_EMOTE_BACKFIRE').some((s) => s.seat === 1 && s.emote === 'villain'));

  // ---------- 18 bounded state, game reset ----------
  for (let i = 0; i < 500; i++) { tick(1000); S.receive(ev('u' + (i % 4), i % 2 ? 'qc.hah' : 'emo.cry')); }
  const st = S._state();
  ok('18 bounded: dedupe memory ≤ 300, history ≤ 200', st.seen <= 300 && st.history <= 200, JSON.stringify(st));
  E.ingest('game:start', { names: V.names });
  ok('history is match-scoped (reset on a new game)', S.history.all().length === 0);

  // ---------- offline (one phone): seat is the event's, ids still validated ----------
  V = Object.assign({}, V, { online: false, me: null, uids: null });
  tick(10000);
  const off = S.receive({ t: 'social', id: 'emo.salute', seat: 3, n: 'off1', ts: clock });
  ok('offline: seat from the event', off.ok && off.seat === 3);
  ok('offline: bad seat rejected', S.receive({ t: 'social', id: 'emo.salute', seat: 9, n: 'off2', ts: clock }).why === 'seat');
  H.done();
})();

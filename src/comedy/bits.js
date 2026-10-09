/*
 * The bits (content pass v1, "Capsa Comedy Bible v1").
 * Each one:
 *   id, mode, rarity, weight ('micro' | 'stage'), on: [facts], chance?, cooldownMs?, oncePerMatch?, delay?
 *   when(B)  → false, or the values the script needs. Return { once: 'key' } to make it fire at most once for that key.
 *   script(v, B, h) → timeline steps. Use only `v` and `h` so previews work.
 *   note(v)  → optional moment written to every phone's memory (shows up in the match report).
 *   demo     → sample values for the preview buttons (data, not prose: the script writes the text).
 * Text is bilingual: tr('English', 'Indonesian'). The deciding phone runs script()/note() once per language
 * (director.js build()) and every phone plays its own, so script()/note() must be side-effect free and write
 * all their text themselves; when() returns data (names, numbers, kinds), never finished sentences.
 * Voice: deadpan, bureaucratic ("the system is filing a report about you"), short, never explains the joke.
 * Bit 7 (Pass (lagi)), 26 (lap layar) and 28 (kredit akhir) live in stage.js because they decorate the UI.
 */
(function () {
  'use strict';
  const D = window.CapsaComedy;
  if (!D) return;
  const add = (b) => D.addBit(b);
  const mem = () => window.CapsaMemory;
  const key = (n) => String(n == null ? '' : n).trim().toLowerCase();
  const RANK = (c) => c >> 2;
  const MIN = 60000;
  const used = (k) => window.CapsaComedy.state.usedKeys.has(k);
  // who lost this round: everyone but the winner (old rule) or only the last player holding cards ("main sampai satu kalah")
  const LAST = (d) => d && d.mode === 'last';
  const losers = (d) => d.names.map((n, i) => ({ name: n, seat: i, left: d.counts[i], hand: (d.hands || [])[i] || [], pen: (d.penalties || [])[i] || 0 }))
    .filter((x) => (LAST(d) ? x.seat === d.loser : x.seat !== d.winner));
  const seatOf = (B, name) => (B.names || []).findIndex((n) => key(n) === key(name));
  const I18N = () => window.CapsaI18n;
  const say = (v) => (I18N() ? I18N().pick(v) : v && typeof v === 'object' ? (v.en != null ? v.en : v.id) : v);   // a stored {en, id} text
  const comboName = (c) => (I18N() ? I18N().combo(c) : c);
  const sec = (n) => tr(`${n} second${n === 1 ? '' : 's'}`, `${n} detik`);

  /* ============================== COMMON ============================== */

  // 1. Kenangan — nothing at the moment; a photo-app "memory" toast a round or two later.
  add({ id: 'kenangan', mode: 'CALLBACK · DELAY', rarity: 'COMMON', weight: 'micro', on: ['play'], chance: 0.35, cooldownMs: 4 * MIN,
    when: (B) => {
      const r = mem() && mem().round(); if (!r || r.plays < 4) return false;
      const s = mem().setups('kenangan').find((x) => x.round < r.n && !used(x.id));
      return s ? { once: s.id, name: s.name, card: s.card, round: s.round } : false;
    },
    demo: { name: 'Budi', card: 27, round: 2 },
    script: (v) => [
      { do: 'sound', key: 'notify' },
      { do: 'memory', title: tr('Memories', 'Kenangan'), sub: tr('A few minutes ago at this table', 'Beberapa menit lalu di meja ini'), card: v.card, caption: tr(`${v.name} · round ${v.round}`, `${v.name} · ronde ${v.round}`), ms: 4000 },
    ] });

  // 2. Survei Kepuasan
  add({ id: 'survei', mode: 'FAKE SERIOUSNESS', rarity: 'COMMON', on: ['round:end'], cooldownMs: 5 * MIN,
    when: (B) => { const p = losers(B.d).filter((x) => x.pen >= 20).sort((a, b) => b.pen - a.pen)[0]; return p ? { name: p.name } : false; },
    demo: { name: 'Dodi' },
    script: (v) => {
      const reply = tr('Thank you. Your feedback will not change anything.', 'Terima kasih. Masukan Anda tidak akan mengubah apa pun.');
      return [{ do: 'wait', ms: 600 }, { do: 'sound', key: 'notify' },
        { do: 'notify', app: tr('Capsa · Survey', 'Capsa · Survei'), title: tr(`How was this round, ${v.name}?`, `Bagaimana ronde ini, ${v.name}?`), ms: 6000,
          buttons: [{ label: tr('Bad', 'Buruk'), reply }, { label: tr('Very bad', 'Sangat buruk'), reply }] }];
    } });

  // 3. noted.
  add({ id: 'noted', mode: 'UNDERREACT', rarity: 'COMMON', weight: 'micro', on: ['chat'], cooldownMs: 3 * MIN,
    when: (B) => {
      const e = B.ev('MEM_TRASH'); if (!e || e.held == null || e.held < 9) return false;
      const r = mem() && mem().round();
      return { once: `noted:${key(e.name)}:${r ? r.n : 0}`, seat: e.seat };
    },
    demo: { seat: 1 },
    script: (v) => [{ do: 'wait', ms: 1500 }, { do: 'tag', seat: v.seat, text: 'noted.', ms: 2500 }] });

  // 4. Prasasti — a quiet memorial for the 2 (or the bomb) that never left the hand.
  add({ id: 'prasasti', mode: 'DELAY · FAKE SERIOUSNESS', rarity: 'COMMON', weight: 'micro', on: ['round:start'], cooldownMs: 4 * MIN, delay: 6000,
    when: (B) => {
      const s = mem() && mem().setups('prasasti').find((x) => x.round === (B.d.round || 0) - 1 && !used(x.id));
      return s ? { once: s.id, cards: s.cards, round: s.round, bomb: !!s.bomb } : false;
    },
    demo: { cards: [51], round: 3, bomb: false },
    script: (v, B, h) => [
      { do: 'sound', key: 'memorial' },
      { do: 'memorial', cards: v.cards, line1: tr(`${h.cards(v.cards)} · round ${v.round}`, `${h.cards(v.cards)} · ronde ${v.round}`),
        line2: v.bomb ? tr('Never detonated.', 'Tidak pernah meledak.') : tr('Never played.', 'Tidak pernah dimainkan.'), ms: 4500 },
    ] });

  // 5. Seperti Biasa — gaslighting a comeback into routine.
  add({ id: 'seperti-biasa', mode: 'GASLIGHTING', rarity: 'COMMON', weight: 'micro', on: ['round:end'], cooldownMs: 4 * MIN,
    when: (B) => { const e = B.ev('MEM_SLUMP_WIN'); return e ? { name: e.name } : false; },
    demo: { name: 'Cici' },
    script: () => [{ do: 'wait', ms: 1100 }, { do: 'caption', text: tr('As usual.', 'Seperti biasa.'), size: 's', ms: 2000 }] });

  // 6. Disetujui — the system's favorite gets an approval stamp. Nobody else does.
  add({ id: 'disetujui', mode: 'TAKING SIDES', rarity: 'COMMON', weight: 'micro', on: ['play'], chance: 0.25, cooldownMs: 60000,
    when: (B) => {
      const f = mem() && mem().favorite();
      const mine = (f && f.key === mem().pidOf(B.d.name)) || mem().supported(B.d.name);
      return mine && B.d.size >= 2 ? { sig: (B.d.cards || []).slice().sort((a, b) => a - b).join(',') } : false;
    },
    demo: { sig: '' },
    script: (v) => [{ do: 'wait', ms: 600 }, { do: 'sound', key: 'stamp', vol: 0.3 }, { do: 'approve', sig: v.sig }] });

  // 8. Masih di Sana?
  add({ id: 'masih-di-sana', mode: 'FAKE SERIOUSNESS', rarity: 'COMMON', on: ['pass'], cooldownMs: 3 * MIN,
    when: (B) => (B.d.timeout ? { name: B.d.name } : false),
    demo: { name: 'Budi' },
    script: (v) => [{ do: 'still', question: tr(`Is ${v.name} still there?`, `Apakah ${v.name} masih di sana?`), after: tr("We'll assume not.", 'Kami anggap tidak.'), button: tr('Still here', 'Masih'), countdown: 3000, ms: 4700, block: true }] });

  /* ============================== UNCOMMON ============================== */

  // 9. Faktor Kemenangan
  add({ id: 'faktor-kemenangan', mode: 'FAKE ANALYTICS · TAKING SIDES', rarity: 'UNCOMMON', on: ['round:end'], cooldownMs: 6 * MIN,
    when: (B) => { const L = losers(B.d); return L.length && Math.min(...L.map((x) => x.left)) >= (LAST(B.d) ? 9 : 6) ? { name: B.d.names[B.d.winner] } : false; },
    demo: { name: 'Ana' },
    script: (v) => [
      { do: 'wait', ms: 1100 }, { do: 'sound', key: 'notify' },
      { do: 'chart', title: tr(`${v.name}'s winning factors`, `Faktor kemenangan ${v.name}`), kind: 'bar', unit: '%', ms: 4500, note: tr('Source: observation.', 'Sumber: pengamatan.'), noteAt: 1500,
        data: [{ label: tr('Strategy', 'Strategi'), value: 4 }, { label: tr('Luck', 'Keberuntungan'), value: 3 }, { label: tr('Opponents', 'Lawan'), value: 93 }] },
    ] });

  // 10. Mic Dibuka — trash talk that lost gets an empty stage, rounds later, during someone else's win.
  add({ id: 'mic-dibuka', mode: 'CALLBACK · DELAY · MISDIRECTION', rarity: 'UNCOMMON', on: ['round:end'], chance: 0.7,
    when: (B) => {
      const s = mem() && mem().setups('ezLost').find((x) => x.round < B.d.round && !used(x.id) && key(B.d.names[B.d.winner]) !== key(x.name));
      if (!s) return false;
      const seat = seatOf(B, s.name);
      return seat >= 0 ? { once: s.id, name: s.name, seat } : false;
    },
    demo: { name: 'Ana', seat: 0 },
    script: (v) => [
      { do: 'wait', ms: 1100 }, { do: 'dim', ms: 5600 }, { do: 'silence', ms: 4500 },
      { do: 'mic', seat: v.seat, open: tr(`The mic is open for ${v.name}.`, `Mic dibuka untuk ${v.name}.`), close: tr('Mic closed.', 'Mic ditutup.'), closeAt: 4000, ms: 5600 },
    ] });

  // 11. Undangan Evaluasi
  add({ id: 'undangan', mode: 'FAKE SERIOUSNESS', rarity: 'UNCOMMON', on: ['round:end'],
    when: (B) => { const p = losers(B.d).find((x) => mem() && mem().streak(x.name).loss === 3); return p ? { once: `undangan:${key(p.name)}`, name: p.name } : false; },
    demo: { name: 'Budi' },
    script: (v) => [
      { do: 'wait', ms: 1100 }, { do: 'sound', key: 'notify' },
      { do: 'notify', icon: 'calendar', app: tr('Calendar', 'Kalender'), title: tr(`Invitation: ${v.name} Performance Review`, `Undangan: Evaluasi Kinerja ${v.name}`), ms: 7000,
        lines: [tr('Tomorrow, 8:00 AM · Room: this table', 'Besok, 08.00 · Ruang: meja ini'), tr(`Attendees: everyone except ${v.name}`, `Peserta: semua, kecuali ${v.name}`)],
        buttons: [{ label: tr('Accept', 'Terima') }, { label: tr('Decline', 'Tolak'), reply: tr('Your attendance is not required.', 'Kehadiran tidak diperlukan.') }] },
    ] });

  // 12. Rekaman CCTV
  add({ id: 'cctv', mode: 'FAKE SERIOUSNESS · TAKING SIDES', rarity: 'UNCOMMON', on: ['round:end'], cooldownMs: 5 * MIN,
    when: (B) => {
      const f = B.d.final; if (!f || !['Satuan', 'Pair'].includes(f.combo)) return false;
      return losers(B.d).some((x) => x.left === 1) ? { cards: f.cards } : false;
    },
    demo: { cards: [44] },
    script: (v) => [
      { do: 'wait', ms: 600 }, { do: 'sound', key: 'cctvHum' }, { do: 'silence', ms: 5000 },
      { do: 'cctv', cards: v.cards, caption: tr('Suspect appears calm.', 'Terduga pelaku tampak tenang.'), captionAt: 2500, ms: 5000, block: true },
    ] });

  // 13. Tadi Ada Suara?
  add({ id: 'tadi-ada-suara', mode: 'UNDERREACT · PRETEND NOTHING', rarity: 'UNCOMMON', weight: 'micro', on: ['round:end'], cooldownMs: 5 * MIN,
    when: (B) => B.d.how === 'bomb',
    demo: {},
    script: () => [{ do: 'wait', ms: 2400 }, { do: 'caption', text: tr('Sorry, did something just go off?', 'Maaf, tadi ada yang bunyi?'), size: 's', ms: 2500 }] });

  // 14. Pembukaan Resmi
  add({ id: 'pembukaan', mode: 'OVERREACT · ANTI-CLIMAX', rarity: 'UNCOMMON', on: ['play'], chance: 0.4, oncePerMatch: true,
    when: (B) => {
      const m = mem(); if (!m || m.match().rounds.length || !m.round() || m.round().plays !== 1) return false;
      return B.d.size === 1 && B.d.cards && B.d.cards[0] === 0;
    },
    demo: {},
    script: () => [
      { do: 'dim', ms: 6800, block: true }, { do: 'sound', key: 'drumroll' }, { do: 'wait', ms: 600 },
      { do: 'banner', text: tr('GRAND OPENING', 'PEMBUKAAN RESMI'), ms: 1800 },
      { do: 'spot', cards: [0], ms: 3000, next: 1800 },
      { do: 'caption', text: tr('The round opens with the 3♦.', 'Ronde dibuka dengan 3♦.'), size: 'm', ms: 1400 },
      { do: 'caption', text: tr('(mandatory)', '(wajib)'), size: 's', ms: 1400 },
    ] });

  // 15. Garis Polisi — whoever let the winner through.
  add({ id: 'garis-polisi', mode: 'TAKING SIDES', rarity: 'UNCOMMON', on: ['round:end'], cooldownMs: 5 * MIN,
    when: (B) => { const r = mem() && mem().lastRound(); return r && r.enabler != null ? { name: B.d.names[r.enabler] } : false; },
    demo: { name: 'Cici' },
    script: (v) => [
      { do: 'wait', ms: 1100 }, { do: 'sound', key: 'stamp' },
      { do: 'tape', text: tr('POLICE LINE · DO NOT CROSS', 'GARIS POLISI · JANGAN MELINTAS'), ms: 4000, next: 1000 },
      { do: 'caption', text: tr(`Key witness: ${v.name}.`, `Saksi kunci: ${v.name}.`), size: 'm', ms: 3000 },
    ] });

  // 16. Prediksi
  add({ id: 'prediksi', mode: 'PATTERN', rarity: 'UNCOMMON', weight: 'micro', on: ['round:start', 'skip', 'pass'], cooldownMs: 5 * MIN,
    when: (B) => { const e = B.ev('MEM_LEAD_TURN'); return e ? { seat: e.seat, combo: e.combo } : false; },
    demo: { seat: 2, combo: 'Pair' },
    script: (v) => [{ do: 'predict', seat: v.seat, combo: v.combo }] });

  // 17. Surat Peringatan
  add({ id: 'surat-peringatan', mode: 'FAKE SERIOUSNESS', rarity: 'UNCOMMON', on: ['play', 'chat'],
    when: (B) => {
      const e = B.ev('MEM_BULLY') || B.ev('MEM_POKE');
      return e ? { once: `sp:${key(e.name)}>${key(e.victim)}`, name: e.name, victim: e.victim } : false;
    },
    demo: { name: 'Ana', victim: 'Budi' },
    script: (v) => [
      { do: 'wait', ms: 800 }, { do: 'sound', key: 'notify' },
      { do: 'notify', app: tr('Capsa · Compliance', 'Capsa · Kepatuhan'), title: tr(`Written Warning 1 · ${v.name}`, `Surat Peringatan 1 · ${v.name}`),
        body: tr(`For repeated actions against ${v.victim}.`, `Atas tindakan berulang terhadap ${v.victim}.`),
        lines: [tr('This warning has no consequences.', 'Peringatan ini tidak memiliki konsekuensi.')], ms: 5000 },
    ] });

  /* ============================== RARE ============================== */

  // 18. Sistem Berduka — the favorite gets wrecked.
  add({ id: 'sistem-berduka', mode: 'TAKING SIDES · GASLIGHTING', rarity: 'RARE', on: ['round:end'], chance: 0.6, oncePerMatch: true,
    when: (B) => {
      const f = mem() && mem().favorite(); if (!f || !window.CapsaComedy.state.bitLast.disetujui) return false;
      const p = losers(B.d).find((x) => key(x.name) === f.key && x.left >= 8);
      return p ? { seat: p.seat } : false;
    },
    demo: { seat: 1 },
    script: (v) => [
      { do: 'wait', ms: 1100 }, { do: 'dim', ms: 6000 }, { do: 'ribbon', seat: v.seat, ms: 6000 }, { do: 'silence', ms: 4500 },
      { do: 'wait', ms: 500 },
      { do: 'caption', text: tr('The system is in mourning.', 'Sistem sedang berduka.'), size: 's', ms: 2300 },
      { do: 'caption', text: tr('This round does not count.', 'Ronde ini tidak dihitung.'), size: 'm', ms: 1500 },
      { do: 'sound', key: 'deflate', vol: 0.5 }, { do: 'caption', text: tr('(it counts)', '(dihitung)'), size: 's', ms: 1500 },
    ] });

  // 19. Arsip Insiden
  add({ id: 'arsip', mode: 'CALLBACK', rarity: 'RARE', on: ['round:end'],
    when: (B) => { const e = B.ev('MEM_INCIDENT'); return e ? { once: `arsip:${key(e.name)}`, name: e.name, items: e.items } : false; },
    demo: { name: 'Budi', items: [{ round: 2, text: { en: 'lost with 1 card left (9♣)', id: 'kalah, sisa 1 kartu (9♣)' } }, { round: 5, text: '"EZ"' }, { round: 7, text: 'timeout' }] },
    script: (v) => [{ do: 'wait', ms: 1100 }, { do: 'archive', title: tr(`ARCHIVE · ${v.name}`, `ARSIP · ${v.name}`),
      lines: (v.items || []).map((m) => `R${m.round} · ${say(m.text)}`), stamp: tr('ACTIVE', 'AKTIF'), ms: 5800 }] });

  // 20. Belum Pernah Terjadi (+ the late concession)
  add({ id: 'belum-pernah', mode: 'GASLIGHTING', rarity: 'RARE', weight: 'micro', on: ['play'], chance: 0.85,
    when: (B) => { const e = B.ev('MEM_THREAD_TENSE'); return e && e.times >= 2 ? { once: `bpt:${key(e.name)}` } : false; },
    demo: {},
    script: () => [{ do: 'sound', key: 'heartbeat' }, { do: 'caption', text: tr('Relax. This has never happened before.', 'Tenang. Ini belum pernah terjadi.'), size: 's', ms: 2600 }] });
  add({ id: 'mungkin-pernah', mode: 'CALLBACK · GASLIGHTING', rarity: 'RARE', weight: 'micro', on: ['round:end'], chance: 0.9,
    when: (B) => {
      const e = B.evs('MEM_THREAD_RESOLVED').find((x) => x.outcome === 'lost' && x.times >= 2 && used(`bpt:${key(x.name)}`));
      return e ? { once: `mp:${key(e.name)}` } : false;
    },
    demo: {},
    script: () => [{ do: 'wait', ms: 2100 }, { do: 'caption', text: tr('Okay. Maybe once.', 'Oke. Mungkin pernah.'), size: 's', ms: 2400 }] });

  // 21. Hening — loud mouth, ten cards left. The system says nothing at all.
  add({ id: 'hening', mode: 'SILENCE', rarity: 'RARE', on: ['round:end'], chance: 0.7, oncePerMatch: true,
    when: (B) => {
      const e = B.evs('MEM_EZ_RESOLVED').find((x) => x.outcome === 'lost' && x.cardsLeft >= 10); if (!e) return false;
      const s = mem().setups('ezLost').find((x) => x.round === B.d.round && key(x.name) === key(e.name));
      return { once: s ? s.id : `hening:${key(e.name)}`, name: e.name, round: B.d.round };
    },
    note: (v) => ({ round: v.round, name: v.name, text: tr(`moment of silence: round ${v.round}`, `momen hening: ronde ${v.round}`), w: 7 }),
    demo: { name: 'Ana', round: 4 },
    script: () => [{ do: 'wait', ms: 600 }, { do: 'freeze', ms: 4500 }, { do: 'silence', ms: 4500 }, { do: 'wait', ms: 4500 }] });

  // 22. Ganti Dukungan
  add({ id: 'ganti-dukungan', mode: 'TAKING SIDES', rarity: 'RARE', on: ['round:end'], chance: 0.95, cooldownMs: 10 * MIN,
    when: (B) => { const e = B.ev('MEM_FAVORITE_CHANGED'); return e ? { name: e.name, old: e.old } : false; },
    demo: { name: 'Cici', old: 'Budi' },
    script: (v) => [
      { do: 'wait', ms: 1100 }, { do: 'sound', key: 'notify' },
      { do: 'notify', app: tr('Capsa · Policy', 'Capsa · Kebijakan'), title: tr('Policy update', 'Pembaruan kebijakan'),
        body: tr(`Effective this round, the system supports ${v.name}.`, `Mulai ronde ini, sistem mendukung ${v.name}.`),
        later: { text: tr(`This isn't about you, ${v.old}.`, `Ini bukan tentang kamu, ${v.old}.`), at: 2000 }, ms: 5200 },
    ] });

  // 23. Laporan Kinerja — real score line, corporate euphemism.
  add({ id: 'laporan-kinerja', mode: 'FAKE ANALYTICS', rarity: 'RARE', on: ['round:end'], cooldownMs: 10 * MIN,
    when: (B) => {
      for (const n of B.d.names) {
        const s = mem() ? mem().scoresOf(n) : [];
        if (s.length < 5) continue;
        const t = s.slice(-5), from = Math.max(0, s.length - 10);
        const data = s.slice(from).map((val, i) => ({ label: 'R' + (from + i + 1), value: val }));
        if (LAST(B.d)) {   // losses keep climbing: 4 of the last 5 rounds, and the most losses at the table
          const ups = t.filter((x, i) => i > 0 && x > t[i - 1]).length, top = Math.max(...B.d.scoresAfter);
          if (ups >= 3 && s[s.length - 1] === top && s[s.length - 1] >= 4) return { name: n, round: B.d.round, data, losses: true };
        } else if (t.every((x, i) => i === 0 || x < t[i - 1]) && s[s.length - 1] <= -30) return { name: n, round: B.d.round, data };
      }
      return false;
    },
    demo: { name: 'Dodi', round: 6, data: [-2, -9, -14, -22, -31, -38].map((v, i) => ({ label: 'R' + (i + 1), value: v })) },
    script: (v) => [
      { do: 'wait', ms: 1100 }, { do: 'sound', key: 'notify' },
      { do: 'chart', kind: 'line', data: v.data, noteAt: 1500, ms: 4500,
        title: v.losses ? tr(`${v.name}'s losses · rounds 1–${v.round}`, `Jumlah kalah ${v.name} · ronde 1–${v.round}`) : tr(`${v.name}'s performance · rounds 1–${v.round}`, `Kinerja ${v.name} · ronde 1–${v.round}`),
        note: v.losses ? tr('Forecast: consistent.', 'Proyeksi: konsisten.') : tr('Forecast: stable.', 'Proyeksi: stabil.') },
    ] });

  // 24. Penyebab Kekalahan — blame the one person who did nothing.
  add({ id: 'penyebab', mode: 'TAKING SIDES · MISDIRECTION', rarity: 'RARE', on: ['round:end'], chance: 0.25, cooldownMs: 15 * MIN,
    when: (B) => {
      const d = B.d, r = mem() && mem().lastRound(); if (!r || d.names.length < 3) return false;
      if (LAST(d)) return (d.order || []).length >= 3 && d.counts[d.loser] >= 4 ? { name: d.names[d.order[0]] } : false;
      const L = losers(d), worst = Math.max(...L.map((x) => x.pen)), beaten = r.beatBy[d.winner] || {};
      const z = L.filter((x) => x.pen < worst && !beaten[x.seat]).sort((a, b) => a.left - b.left)[0];
      return z ? { name: z.name } : false;
    },
    demo: { name: 'Cici' },
    script: (v) => [
      { do: 'wait', ms: 1100 }, { do: 'sound', key: 'notify' },
      { do: 'notify', app: tr('Capsa · Investigations', 'Capsa · Investigasi'), title: tr('Investigation results', 'Hasil investigasi'),
        body: tr("The cause of this round's loss has been identified.", 'Penyebab kekalahan ronde ini telah diidentifikasi.'),
        later: { text: `${v.name}.`, at: 2500 }, ms: 5500 },
    ] });

  // 25. Disarankan untuk Anda
  add({ id: 'disarankan', mode: 'CALLBACK · PATTERN', rarity: 'RARE', weight: 'micro', on: ['round:end'],
    when: (B) => {
      const p = losers(B.d).find((x) => x.hand.filter((c) => RANK(c) === 12).length >= 2 && (mem().match().twosDiedBy[key(x.name)] || 0) === 2);
      return p ? { once: `reco:${key(p.name)}`, name: p.name, cards: p.hand.filter((c) => RANK(c) === 12).slice(0, 2) } : false;
    },
    demo: { name: 'Cici', cards: [49, 51] },
    script: (v) => [{ do: 'wait', ms: 1100 }, { do: 'reco', cards: v.cards, title: tr("How to Let Go: A Beginner's Guide", 'Cara Melepaskan: Panduan Pemula'), sub: tr(`Recommended for ${v.name}`, `Disarankan untuk ${v.name}`), duration: '12:04', ms: 4000 }] });

  /* ============================== LEGENDARY ============================== */

  // 27. Catatan Pembaruan — one line per true fact about the table (memory.lore())
  const PATCH = {
    lastCard: (l) => tr(`Reduced ${l.name}'s chance of winning on the last card. Unintended.`, `Menurunkan peluang ${l.name} menang di kartu terakhir. Tidak disengaja.`),
    favorite: (l) => tr(`${l.name} is now officially the system's favorite.`, `${l.name} kini resmi menjadi favorit sistem.`),
    hoarder: (l) => tr(`${l.name}'s 2s still cannot be played. Under investigation.`, `Kartu 2 milik ${l.name} masih tidak bisa dikeluarkan. Sedang diselidiki.`),
    trash: (l) => tr(`${l.name}'s message ${l.text} has been archived as evidence.`, `Pesan ${l.text} dari ${l.name} telah diarsipkan sebagai barang bukti.`),
    worst: (l) => tr(`Fixed a bug where ${l.name} believed they could win.`, `Memperbaiki bug di mana ${l.name} merasa bisa menang.`),
  };
  add({ id: 'patch-notes', mode: 'META · CALLBACK', rarity: 'LEGENDARY', on: ['round:start'], oncePerMatch: true,
    when: (B) => {
      if (B.d.round !== 10 || !mem()) return false;
      const items = mem().lore().filter((l) => PATCH[l.kind]).map((l) => ({ kind: l.kind, name: l.name, text: l.text }));
      return items.length >= 3 ? { round: B.d.round, items: items.slice(0, 4) } : false;
    },
    demo: { round: 10, items: [{ kind: 'lastCard', name: 'Budi' }, { kind: 'favorite', name: 'Ana' }, { kind: 'hoarder', name: 'Cici' }, { kind: 'worst', name: 'Dodi' }] },
    script: (v) => [
      { do: 'wait', ms: 1000 }, { do: 'sound', key: 'notify' },
      { do: 'patch', version: `Capsa 1.0.${v.round}`, title: tr('Patch notes', 'Catatan pembaruan'), lines: (v.items || []).filter((l) => PATCH[l.kind]).map((l) => PATCH[l.kind](l)),
        button: tr('Update', 'Perbarui'), ms: 9000, block: true },
    ] });

  // 29. Sistem Ikut Main
  add({ id: 'sistem-ikut-main', mode: 'META · ANTI-CLIMAX', rarity: 'LEGENDARY', on: ['round:start'], oncePerMatch: true,
    when: (B) => {
      const m = mem() && mem().match(); if (!m || (B.d.names || []).length > 3 || m.rounds.length < 6) return false;
      const last = m.rounds.slice(-6), c = {};
      last.forEach((r) => { c[key(r.winnerName)] = (c[key(r.winnerName)] || 0) + 1; });
      return Object.values(c).some((x) => x / last.length >= 0.7);
    },
    demo: {},
    script: () => [
      { do: 'wait', ms: 500 }, { do: 'sound', key: 'whoosh' },
      { do: 'fakeSeat', name: tr('System', 'Sistem'), text: tr('13 cards', '13 kartu'), later: tr('left', 'keluar'), laterAt: 4500, ms: 6500, next: 2000 },
      { do: 'sound', key: 'notify' }, { do: 'notify', app: tr('System', 'Sistem'), title: tr('The system has joined to balance the game.', 'Sistem bergabung untuk menyeimbangkan permainan.'), ms: 2500, next: 3500 },
      { do: 'caption', text: tr('Too hard.', 'Terlalu berat.'), size: 's', ms: 1500, next: 1000 }, { do: 'sound', key: 'whoosh' },
    ] });

  // 30. Harapan, Bukan Data
  add({ id: 'harapan', mode: 'GASLIGHTING · META · ANTI-CLIMAX', rarity: 'LEGENDARY', on: ['round:end'], oncePerMatch: true,
    when: (B) => {
      const sb = B.d.scoresBefore || [], w = B.d.winner;
      if (LAST(B.d)) {   // the one with by far the most losses finishes first: show them at zero losses, briefly
        const others = sb.filter((_, i) => i !== w);
        if (!sb.length || sb[w] !== Math.max(...sb) || sb[w] - Math.min(...others) < 4) return false;
        return { seat: w, value: 0, raw: true };
      }
      if (!sb.length || sb[w] > -40 || sb[w] !== Math.min(...sb)) return false;
      const top = Math.max(...(B.d.scoresAfter || [0]));
      return { seat: w, value: top + 13 };
    },
    demo: { seat: 3, value: 55 },
    script: (v) => [
      { do: 'wait', ms: 1600 }, { do: 'sound', key: 'kazoo' },
      { do: 'scoreSwap', seat: v.seat, value: v.value, raw: !!v.raw, ms: 2000 },
      { do: 'caption', text: tr('Updated standings.', 'Klasemen terbaru.'), size: 's', ms: 2000, next: 2000 },
      { do: 'sound', key: 'glitch' }, { do: 'caption', text: tr('Sorry. That was hope, not data.', 'Maaf. Itu harapan, bukan data.'), size: 's', ms: 2500 },
    ] });

  /* ============================== KEPT FROM v0 ============================== */

  add({ id: 'glory-duration', mode: 'ANTI-CLIMAX', rarity: 'COMMON', weight: 'micro', on: ['play'], cooldownMs: 2 * MIN,
    when: (B) => { const e = B.ev('MEM_BIG_BEATEN'); return e && e.secs <= 20 ? { victim: e.victim, secs: e.secs } : false; },
    demo: { victim: 'Cici', secs: 4 },
    script: (v) => [{ do: 'caption', size: 's', ms: 2400, text: tr(`${v.victim}'s reign lasted ${sec(v.secs)}.`, `Durasi kejayaan ${v.victim}: ${v.secs} detik.`) }] });

  add({ id: 'mental-health', mode: 'PSYCHOLOGICAL DAMAGE', rarity: 'UNCOMMON', on: ['round:end'], cooldownMs: 5 * MIN,
    when: (B) => { const p = losers(B.d).find((x) => mem() && mem().streak(x.name).loss === 4); return p ? { name: p.name, last: LAST(B.d) } : false; },
    demo: { name: 'Budi' },
    script: (v) => [{ do: 'wait', ms: 1100 }, { do: 'sound', key: 'notify' },
      { do: 'notify', app: tr('Mental Health', 'Kesehatan Mental'), ms: 6500,
        title: v.last ? tr(`${v.name}, that's 4 losses in a row`, `${v.name}, sudah 4 kali kalah berturut-turut`) : tr(`${v.name}, that's 4 rounds without a win`, `${v.name}, sudah 4 ronde tanpa menang`),
        body: tr('Would you like to take a short break?', 'Mau istirahat sebentar?'), buttons: [tr('No', 'Tidak'), tr('No', 'Tidak')] }] });

  add({ id: 'not-this-again', mode: 'CALLBACK', rarity: 'UNCOMMON', weight: 'micro', on: ['play'], chance: 0.85, cooldownMs: 3 * MIN,
    when: (B) => { const e = B.ev('MEM_THREAD_TENSE'); return e && e.times === 1 ? { origin: e.originRound } : false; },
    demo: { origin: 1 },
    script: (v, B, h) => [{ do: 'sound', key: 'heartbeat' }, { do: 'caption', size: 'm', ms: 2400, text: h.pick([tr('This again.', 'Ini lagi.'), tr(`We've been here before. Round ${v.origin}.`, `Kita pernah di sini. Ronde ${v.origin}.`)]) }] });

  add({ id: 'character-development', mode: 'CALLBACK', rarity: 'UNCOMMON', weight: 'micro', on: ['round:end'], chance: 0.9, cooldownMs: 5 * MIN,
    when: (B) => { const e = B.evs('MEM_THREAD_RESOLVED').find((x) => x.outcome === 'won' && x.times === 1); return e ? {} : false; },
    demo: {},
    script: () => [{ do: 'wait', ms: 600 }, { do: 'sound', key: 'kazoo' }, { do: 'caption', text: tr('Character development.', 'Ada perkembangan.'), size: 'l', ms: 2400 }] });

  add({ id: 'learned-nothing', mode: 'CALLBACK', rarity: 'UNCOMMON', on: ['round:end'], chance: 0.9,
    when: (B) => { const e = B.evs('MEM_THREAD_RESOLVED').find((x) => x.outcome === 'lost' && x.times === 1); return e ? { origin: e.originRound, now: B.d.round } : false; },
    demo: { origin: 1, now: 6 },
    script: (v) => [
      { do: 'silence', ms: 6000 }, { do: 'freeze', ms: 5200 }, { do: 'sound', key: 'tapeStop' }, { do: 'wait', ms: 1500 },
      { do: 'caption', text: tr('We have learned nothing.', 'Kita tidak belajar apa-apa.'), size: 'l', ms: 2500 },
      { do: 'caption', text: tr(`(round ${v.origin} and round ${v.now}. exactly the same.)`, `(ronde ${v.origin} dan ronde ${v.now}. kejadiannya sama persis.)`), size: 's', ms: 2300 },
    ] });

  add({ id: 'drumroll-nothing', mode: 'ANTI-CLIMAX', rarity: 'UNCOMMON', on: ['round:end'], chance: 0.05, cooldownMs: 10 * MIN,
    when: (B) => !['BAD_BEAT', 'BIG_COMEBACK', 'WIN_STREAK', 'UPSET_WIN', 'LOSS_STREAK', 'MEM_EZ_RESOLVED', 'MEM_THREAD_RESOLVED', 'MEM_GRUDGE_SETTLED', 'MEM_BOUNTY_POSTED', 'MEM_BOUNTY_CLAIMED', 'MEM_INCIDENT', 'MEM_FAVORITE_CHANGED'].some((t) => B.ev(t)),
    demo: {},
    script: (v, B, h) => [{ do: 'sound', key: 'drumroll' }, { do: 'banner', text: tr('IMPORTANT ANNOUNCEMENT', 'PENGUMUMAN PENTING'), ms: 2300 }, { do: 'wait', ms: 300 },
      { do: 'caption', text: h.pick([tr('Nothing. Carry on.', 'Tidak ada. Lanjut.'), tr('Forgot what it was.', 'Lupa mau bilang apa.'), tr('That is all.', 'Itu saja.')]), size: 's', ms: 1900 }] });

  add({ id: 'ez-valid', mode: 'DEADPAN', rarity: 'UNCOMMON', weight: 'micro', on: ['round:end'], chance: 0.6,
    when: (B) => { const e = B.evs('MEM_EZ_RESOLVED').find((x) => x.outcome === 'won'); return e ? { seat: e.seat, text: e.text } : false; },
    demo: { seat: 0, text: 'EZ' },
    script: (v) => [{ do: 'bubble', seat: v.seat, text: v.text, ms: 2300, next: 1000 }, { do: 'caption', text: tr('Valid.', 'Valid.'), size: 's', ms: 1800 }] });

  add({ id: 'typing', mode: 'PSYCHOLOGICAL DAMAGE', rarity: 'UNCOMMON', weight: 'micro', on: ['play', 'pass'], chance: 0.12, cooldownMs: 6 * MIN,
    when: (B) => { const t = mem() && mem().target(), n = (B.names || []).length; return t && n && (B.d.seat + 1) % n === t.seat ? {} : false; },
    demo: {},
    script: () => [{ do: 'sound', key: 'typing' }, { do: 'typing', ms: 3200 }] });

  add({ id: 'revenge-receipt', mode: 'REVENGE', rarity: 'UNCOMMON', on: ['round:end'], chance: 0.7, cooldownMs: 6 * MIN,
    when: (B) => { const e = B.ev('MEM_GRUDGE_SETTLED'); return e ? { name: e.name, bully: e.bully, round: e.round, pen: e.pen, cards: e.mode === 'last' ? e.cards : null } : false; },
    demo: { name: 'Budi', bully: 'Ana', round: 2, pen: 14 },
    script: (v) => [{ do: 'sound', key: 'register' },
      { do: 'receipt', title: tr('SETTLEMENT RECEIPT', 'STRUK PELUNASAN'), ms: 5200, next: 1900,
        lines: [[tr(`Debt, round ${v.round}`, `Utang ronde ${v.round}`), v.cards != null ? tr(`lost, ${v.cards} cards left`, `kalah, sisa ${v.cards} kartu`) : tr(`${v.pen} pts`, `${v.pen} poin`)],
          [tr('Interest', 'Bunga'), tr('dignity', 'harga diri')], [tr('Paid by', 'Dibayar oleh'), v.name], [tr('Received from', 'Diterima dari'), v.bully]],
        total: ['STATUS', tr('PAID', 'LUNAS')], foot: tr('Keep this receipt as proof.', 'Simpan struk ini sebagai bukti.') },
      { do: 'sound', key: 'stamp' }, { do: 'stamp', text: tr('PAID', 'LUNAS'), ms: 1800 }] });

  // The old EZ sequence now alternates with "Mic Dibuka": half the time it plays right away, otherwise the setup waits.
  add({ id: 'ez-callback', mode: 'CALLBACK · PSYCHOLOGICAL DAMAGE', rarity: 'RARE', on: ['round:end'], chance: 0.5, cooldownMs: 5 * MIN,
    when: (B) => {
      const e = B.evs('MEM_EZ_RESOLVED').find((x) => x.outcome === 'lost'); if (!e) return false;
      const s = mem().setups('ezLost').find((x) => x.round === B.d.round && key(x.name) === key(e.name));
      return { once: s ? s.id : `ez:${key(e.name)}:${B.d.round}`, name: e.name, seat: e.seat, text: e.text, secs: e.secs };
    },
    demo: { name: 'Ana', seat: 0, text: 'EZ', secs: 21 },
    script: (v) => [
      { do: 'freeze', ms: 8400 }, { do: 'silence', ms: 8400 }, { do: 'sound', key: 'tapeStop' }, { do: 'wait', ms: 1500 },
      { do: 'sound', key: 'notify' }, { do: 'notify', app: tr('System', 'Sistem'), title: tr('Previous message detected', 'Pesan sebelumnya terdeteksi'), body: tr(`${v.name} · ${sec(v.secs)} ago`, `${v.name} · ${v.secs} detik yang lalu`), ms: 5400, next: 1500 },
      { do: 'bubble', seat: v.seat, text: v.text, ms: 3600, next: 2000 },
      { do: 'caption', text: tr('Interesting.', 'Menarik.'), size: 'm', ms: 1900, next: 2100 },
    ] });

  add({ id: 'wanted-poster', mode: 'BOUNTY', rarity: 'RARE', on: ['round:end'], chance: 0.9,
    when: (B) => { const e = B.ev('MEM_BOUNTY_POSTED'); return e ? { name: e.name, streak: e.streak } : false; },
    demo: { name: 'Ana', streak: 3 },
    script: (v, B, h) => [{ do: 'sound', key: 'stamp' },
      { do: 'poster', title: tr('WANTED', 'DICARI'), name: v.name, sub: tr(`${v.streak} wins in a row`, `${v.streak} kemenangan beruntun`), ms: 5000,
        reward: h.pick([tr('Reward: dignity', 'Hadiah: harga diri'), tr("Reward: the whole table's peace of mind", 'Hadiah: ketenangan batin seluruh meja')]), foot: tr('Beat them to claim.', 'Kalahkan untuk mengklaim.') }] });

  add({ id: 'bounty-claimed', mode: 'BOUNTY', rarity: 'RARE', on: ['round:end'], chance: 0.9,
    when: (B) => { const e = B.ev('MEM_BOUNTY_CLAIMED'); return e ? { name: e.name, target: e.target, streak: e.streak } : false; },
    demo: { name: 'Cici', target: 'Ana', streak: 3 },
    script: (v) => [{ do: 'sound', key: 'register' },
      { do: 'notify', app: tr('Bounty Board', 'Papan Bounty'), title: tr(`${v.target}'s bounty claimed by ${v.name}`, `Bounty ${v.target} diklaim oleh ${v.name}`), body: tr('Reward: none.', 'Hadiah: tidak ada.'), ms: 5600 }] });

  add({ id: 'courage-chart', mode: 'FAKE ANALYTICS', rarity: 'RARE', on: ['round:end'], chance: 0.6, cooldownMs: 6 * MIN,
    when: (B) => {
      const lr = mem() && mem().lastRound(); if (!lr) return false;
      const i = lr.passes.indexOf(Math.max(...lr.passes));
      return lr.passes[i] >= 6 ? { name: lr.names[i], passes: lr.passes[i], round: lr.round } : false;
    },
    demo: { name: 'Dodi', passes: 7, round: 4 },
    script: (v) => [{ do: 'sound', key: 'notify' }, { do: 'chart', kind: 'flat', title: tr(`${v.name}'s courage chart`, `Grafik keberanian ${v.name}`), sub: tr(`Round ${v.round} · ${v.passes}× pass`, `Ronde ${v.round} · ${v.passes}× pass`), ms: 5200,
      note: tr('The line is supposed to look like that.', 'Garisnya memang begini.') }] });

  add({ id: 'exe-crash', mode: 'RARE CHAOS EVENT', rarity: 'LEGENDARY', on: ['play'], oncePerMatch: true,
    when: (B) => (B.d.cat === 5 || (B.d.cat === 4 && mem() && mem().match().bombs === 3) ? { name: B.d.name } : false),
    demo: { name: 'Ana' },
    script: (v) => [{ do: 'rarity', level: 'LEGENDARY' }, { do: 'sound', key: 'glitch' }, { do: 'effect', name: 'glitch' }, { do: 'wait', ms: 800 },
      { do: 'sound', key: 'error' }, { do: 'error', title: tr('CAPSA.EXE has stopped responding', 'CAPSA.EXE berhenti merespons'), body: tr(`Cause: ${v.name}.`, `Penyebab: ${v.name}.`), block: true, ms: 6000,
        bars: [[tr('Collecting crash data', 'Mengumpulkan data kerusakan'), 100], [tr("Collecting opponents' remaining dignity", 'Mengumpulkan sisa harga diri lawan'), 0]] }] });

  add({ id: 'sealed-13', mode: 'RARE CHAOS EVENT', rarity: 'LEGENDARY', on: ['round:end'], cooldownMs: 10 * MIN,
    when: (B) => { const p = losers(B.d).find((x) => x.left === 13); return p ? { name: p.name } : false; },
    demo: { name: 'Dodi' },
    script: (v) => [{ do: 'rarity', level: 'LEGENDARY' }, { do: 'sound', key: 'register' },
      { do: 'receipt', title: 'MARKETPLACE', ms: 6200, foot: tr('Local pickup only: this table.', 'COD area meja ini.'),
        lines: [[tr('For sale', 'Dijual'), tr('13 playing cards', '13 kartu remi')], [tr('Condition', 'Kondisi'), tr('still sealed', 'segel')], [tr('Owner', 'Pemilik'), v.name],
          [tr('Reason for selling', 'Alasan dijual'), tr('never got to use them', 'tidak sempat dipakai')], [tr('Price', 'Harga'), tr('negotiable', 'nego')]], total: ['STATUS', tr('AVAILABLE', 'TERSEDIA')] }] });

  add({ id: 'courtroom', mode: 'FAKE SERIOUSNESS · ESCALATION', rarity: 'LEGENDARY', on: ['round:end'], oncePerMatch: true,
    when: (B) => { const e = B.ev('UPSET_WIN'); return e && e.gap >= (e.unit === 'losses' ? 4 : 20) ? { name: e.name, gap: e.gap, unit: e.unit } : false; },
    demo: { name: 'Dodi', gap: 24 },
    script: (v) => [{ do: 'rarity', level: 'LEGENDARY' }, { do: 'freeze', ms: 9800 }, { do: 'sound', key: 'gavel' },
      { do: 'banner', text: tr('COURT IS IN SESSION', 'SIDANG DIBUKA'), ms: 2200 }, { do: 'caption', text: tr('Defendant: the standings.', 'Terdakwa: klasemen.'), size: 'm', ms: 1700 },
      { do: 'caption', size: 'm', ms: 2000, text: v.unit === 'losses'
        ? tr(`Charge: ${v.gap} more losses. Ruled void.`, `Dakwaan: ${v.gap} kekalahan lebih banyak. Dinyatakan tidak berlaku.`)
        : tr(`Charge: trailing by ${v.gap} points. Ruled void.`, `Dakwaan: ketinggalan ${v.gap} poin. Dinyatakan tidak berlaku.`) },
      { do: 'sound', key: 'gavel' }, { do: 'stamp', text: tr('VERDICT', 'PUTUSAN'), ms: 1400 },
      { do: 'caption', text: tr(`${v.name} is found guilty of accidental genius.`, `${v.name} dinyatakan tidak sengaja jenius.`), size: 'l', ms: 2600 }] });

  add({ id: 'nothing-happens', mode: 'ANTI-CLIMAX', rarity: 'LEGENDARY', on: ['round:end'], chance: 0.01, oncePerMatch: true,
    when: () => true, demo: {},
    script: () => [{ do: 'rarity', level: 'LEGENDARY' }, { do: 'sound', key: 'drumroll' }, { do: 'banner', text: tr('RARE EVENT DETECTED', 'KEJADIAN LANGKA TERDETEKSI'), ms: 2300 },
      { do: 'wait', ms: 1400 }, { do: 'caption', text: tr('Nothing happened.', 'Tidak ada yang terjadi.'), size: 's', ms: 1700 }, { do: 'wait', ms: 500 },
      { do: 'caption', text: tr('Extremely rare.', 'Sangat langka.'), size: 's', ms: 1800 }] });

  /* ============================== CONTENT PASS v2 ("Capsa Comedy Bible v2") ============================== */
  const hhmm = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}${tr(':', '.')}${String(d.getMinutes()).padStart(2, '0')}`; };
  const pk = (n) => (mem() && mem().pidOf ? mem().pidOf(n) : key(n));

  // C5 Rapat Panjang — long think and/or cancelled picks, then a pass.
  add({ id: 'rapat-panjang', mode: 'ANTI-CLIMAX · DEADPAN', rarity: 'COMMON', weight: 'micro', on: ['pass'], cooldownMs: 4 * MIN,
    sig: { c: 2.6, vis: 0.6 },
    when: (B) => { const e = B.ev('MEM_DITHER'); return e ? { seat: e.seat, secs: e.secs, cancels: e.cancels } : false; },
    demo: { seat: 1, secs: 26, cancels: 0 },
    script: (v) => [{ do: 'wait', ms: 800 }, { do: 'tag', seat: v.seat, ms: 3200,
      text: v.cancels >= 3 ? tr(`${v.cancels} revisions · outcome: pass`, `${v.cancels} revisi · hasil: pass`) : tr(`${v.secs}-second meeting · outcome: pass`, `rapat ${v.secs} detik · hasil: pass`) }] });

  // A9+ Terbukti — showed the hand, then actually finished first.
  add({ id: 'terbukti', mode: 'UNDERSTATEMENT', rarity: 'COMMON', weight: 'micro', on: ['round:end'],
    when: (B) => { const e = B.evs('MEM_REVEAL_RESOLVED').find((x) => x.outcome === 'won'); return e ? { once: `terbukti:${pk(e.name)}`, seat: e.seat } : false; },
    demo: { seat: 0 },
    script: () => [{ do: 'wait', ms: 1100 }, { do: 'caption', text: tr('Verified.', 'Terbukti.'), size: 's', ms: 1800 }] });

  // C6- Tanpa Modal — weak dealt hand, finished first anyway.
  add({ id: 'tanpa-modal', mode: 'UNDERSTATEMENT', rarity: 'COMMON', weight: 'micro', on: ['round:end'], cooldownMs: 6 * MIN,
    sig: { c: 2.6, vis: 0.6 },
    when: (B) => { const e = B.ev('MEM_UNDERDOG_HAND'); return e ? { name: e.name } : false; },
    demo: { name: 'Cici' },
    script: (v) => [{ do: 'wait', ms: 1100 }, { do: 'caption', text: tr(`${v.name}'s starting hand: below average.`, `Kartu awal ${v.name}: di bawah rata-rata.`), size: 's', ms: 2200 },
      { do: 'caption', text: tr('Outcome: irrelevant.', 'Hasil: tidak relevan.'), size: 's', ms: 1800 }] });

  // G4 Kembali Online
  add({ id: 'kembali-online', mode: 'DEADPAN', rarity: 'COMMON', weight: 'micro', on: ['player:rejoin'], cooldownMs: 5 * MIN,
    when: (B) => { const e = B.ev('MEM_REJOIN'); return e && (e.awayMs || 0) >= 15000 ? { seat: e.seat, missed: e.missed || 0 } : false; },
    demo: { seat: 2, missed: 4 },
    script: (v) => [{ do: 'tag', seat: v.seat, ms: 3200, text: v.missed ? tr(`back · missed ${v.missed} ${v.missed === 1 ? 'play' : 'plays'}`, `kembali · melewatkan ${v.missed} kartu`) : tr('back', 'kembali') }] });

  // G7 Nama Baru
  add({ id: 'nama-baru', mode: 'DEADPAN', rarity: 'COMMON', weight: 'micro', on: ['round:start'], delay: 4000,
    when: (B) => { const e = B.ev('MEM_RENAMED'); return e ? { once: `ren:${pk(e.name)}`, name: e.name, old: e.old } : false; },
    demo: { name: 'Budii', old: 'Budi' },
    script: (v) => [{ do: 'caption', text: tr(`${v.name} (formerly: ${v.old}). The record still applies.`, `${v.name} (sebelumnya: ${v.old}). Catatan tetap berlaku.`), size: 's', ms: 2600 }] });

  // A9 Kartu Terbuka — showed the hand to everyone, then lost.
  add({ id: 'kartu-terbuka', mode: 'IRONY · CALLBACK', rarity: 'UNCOMMON', on: ['round:end'],
    when: (B) => {
      const e = B.evs('MEM_REVEAL_RESOLVED').find((x) => x.outcome === 'lost');
      return e && (e.cards || []).length ? { once: `kt:${pk(e.name)}`, seat: e.seat, cards: e.cards.slice(0, 13) } : false;
    },
    demo: { seat: 3, cards: [3, 9, 14, 22, 30, 41, 51] },
    script: (v) => [
      { do: 'wait', ms: 1100 }, { do: 'spot', cards: v.cards, ms: 3000, next: 900 },
      { do: 'sound', key: 'stamp' }, { do: 'stamp', text: tr('SHOWN OFF', 'DIPAMERKAN'), ms: 1600, next: 1500 },
      { do: 'caption', text: tr('Transparency does not guarantee results.', 'Transparansi tidak menjamin hasil.'), size: 's', ms: 2400 },
    ] });

  // A5 Pengakuan Diterima — admitted a mistake in chat, then made one again.
  add({ id: 'pengakuan-diterima', mode: 'IRONY · CALLBACK', rarity: 'UNCOMMON', on: ['play', 'pass', 'round:end'],
    when: (B) => { const e = B.ev('MEM_REPEAT_MISTAKE'); return e ? { once: `pd:${pk(e.name)}`, name: e.name, quote: e.quote } : false; },
    demo: { name: 'Dodi', quote: 'salah buang gua' },
    script: (v) => [
      { do: 'wait', ms: 700 }, { do: 'sound', key: 'notify' },
      { do: 'notify', app: tr('Capsa · Customer Service', 'Capsa · Layanan Pelanggan'), title: tr('Your confession has been recorded:', 'Pengakuan Anda tercatat:'), body: `"${v.quote}"`,
        later: { text: tr('Status: repeated.', 'Status: diulang.'), at: 2000 }, ms: 5200 },
      { do: 'wait', ms: 2000 }, { do: 'sound', key: 'typing', vol: 0.5 },
    ] });

  // C6 Modal Awal — strong dealt hand, lost holding plenty.
  add({ id: 'modal-awal', mode: 'IRONY · FAKE ANALYTICS', rarity: 'UNCOMMON', on: ['round:end'], cooldownMs: 8 * MIN,
    sig: { c: 4.2, vis: 0.6 },
    when: (B) => { const e = B.ev('MEM_WASTED_HAND'); return e ? { name: e.name, twos: e.dealt.twos, high: e.dealt.high, left: e.left, quad: !!e.dealt.quad } : false; },
    demo: { name: 'Budi', twos: 2, high: 4, left: 9, quad: false },
    script: (v) => [
      { do: 'wait', ms: 1100 }, { do: 'sound', key: 'register' },
      { do: 'receipt', title: tr('STARTING CAPITAL', 'MODAL AWAL'), ms: 5000, foot: v.name,
        lines: [[tr('2s', 'Kartu 2'), String(v.twos)], [tr('High cards', 'Kartu tinggi'), String(v.high)], ...(v.quad ? [[tr('Bomb', 'Bom'), '1']] : []), [tr('Left', 'Sisa'), tr(`${v.left} cards`, `${v.left} kartu`)]],
        total: [tr('REMARKS', 'KETERANGAN'), tr('unused', 'tidak digunakan')] },
    ] });

  // A7 Emote Dikembalikan — laughing emote, then lost with plenty left.
  add({ id: 'emote-dikembalikan', mode: 'IRONY · CALLBACK', rarity: 'UNCOMMON', weight: 'micro', on: ['round:end'], cooldownMs: 5 * MIN,
    when: (B) => { const e = B.ev('MEM_EMOTE_BACKFIRE'); return e ? { seat: e.seat, e: e.emote } : false; },
    demo: { seat: 1, e: 'laugh' },
    script: (v) => [{ do: 'wait', ms: 1100 }, { do: 'emote', seat: v.seat, e: v.e, next: 1200 },
      { do: 'caption', text: tr('Emote returned to sender.', 'Emote dikembalikan ke pengirim.'), size: 's', ms: 2000 }] });

  // G2 Kebiasaan Baru — a long-standing opening habit, broken.
  add({ id: 'kebiasaan-baru', mode: 'IRONY · PATTERN', rarity: 'UNCOMMON', weight: 'micro', on: ['play'],
    sig: { depth: 2 },
    when: (B) => { const e = B.ev('MEM_HABIT_BROKEN'); return e ? { once: `kb:${pk(e.name)}`, seat: e.seat, habit: e.habit, share: e.share } : false; },
    demo: { seat: 2, habit: 'Pair', share: 78 },
    script: (v) => [{ do: 'tag', seat: v.seat, text: tr(`usually: ${comboName(v.habit)} (${v.share}%)`, `biasanya: ${v.habit} (${v.share}%)`), ms: 2000, next: 2000 },
      { do: 'tag', seat: v.seat, text: tr('the system needs a moment.', 'sistem perlu waktu.'), ms: 2600 }] });

  // G1 Selamat Datang Kembali — the system remembers (one player per match, the heaviest recent moment wins).
  add({ id: 'selamat-datang', mode: 'CALLBACK · DEADPAN', rarity: 'UNCOMMON', on: ['round:start'], oncePerMatch: true, delay: 4000,
    sig: { depth: 2 },
    when: (B) => {
      const es = B.evs('MEM_RETURNING'); if (!es.length) return false;
      const e = es.slice().sort((a, b) => ((b.moment || {}).w || 0) - ((a.moment || {}).w || 0) || b.matches - a.matches)[0];
      return { seat: e.seat, name: e.name, title: e.title, moment: e.moment && e.moment.bad ? e.moment.text : null };
    },
    demo: { seat: 1, name: 'Budi', title: { en: 'Near-Miss Specialist', id: 'Spesialis Nyaris' }, moment: { en: 'lost with 1 card left (9♣)', id: 'kalah, sisa 1 kartu (9♣)' } },
    script: (v) => [{ do: 'sound', key: 'notify' },
      { do: 'notify', app: 'Capsa', title: tr(`Welcome back, ${v.name}.`, `Selamat datang kembali, ${v.name}.`), body: tr(`Title: ${say(v.title)}.`, `Gelar: ${say(v.title)}.`), ms: 5200,
        ...(v.moment ? { later: { text: tr(`We haven't forgotten: ${say(v.moment)}.`, `Kami belum lupa: ${say(v.moment)}.`), at: 2000 } } : {}) }] });

  // F5 Rivalitas Resmi — a long, close head-to-head across matches.
  add({ id: 'rivalitas-resmi', mode: 'CALLBACK · EXAGGERATION', rarity: 'RARE', on: ['round:end'], chance: 0.6,
    sig: { depth: 2 },
    when: (B) => { const e = B.ev('MEM_RIVALRY'); return e ? { once: `riv:${[pk(e.name), pk(e.rival)].sort().join('|')}`, a: e.name, b: e.rival, x: e.wins, y: e.losses } : false; },
    demo: { a: 'Ana', b: 'Budi', x: 7, y: 6 },
    script: (v) => [
      { do: 'wait', ms: 1100 }, { do: 'sound', key: 'heartbeat', vol: 0.6 },
      { do: 'poster', title: tr('ALL-TIME SCORE', 'SKOR SEPANJANG MASA'), name: `${v.a} ${v.x} – ${v.y} ${v.b}`, sub: tr('Official rivalry', 'Rivalitas resmi'),
        reward: tr('Reward: bragging rights', 'Hadiah: gengsi'), foot: tr('Recorded by this room.', 'Dicatat oleh room ini.'), ms: 4200, next: 4400 },
      { do: 'sound', key: 'tapeStop' }, { do: 'caption', text: tr('Next chapter: now.', 'Babak berikutnya: sekarang.'), size: 's', ms: 2000 },
    ] });

  // G3 Kejadian Serupa — yesterday's embarrassment, again (inside the 24 h window).
  add({ id: 'kejadian-serupa', mode: 'CALLBACK', rarity: 'RARE', on: ['round:end', 'pass'], chance: 0.8,
    sig: { depth: 2 },
    when: (B) => {
      const e = B.ev('MEM_DEJA_VU'); if (!e) return false;
      return { once: `dv:${pk(e.name)}:${new Date().toDateString()}`, name: e.name, then: e.then, now: e.now };
    },
    demo: { name: 'Budi', then: { t: Date.now() - 20 * 3600e3, text: { en: 'lost with 1 card left (9♣)', id: 'kalah, sisa 1 kartu (9♣)' } }, now: { en: 'lost with 1 card left (4♦)', id: 'kalah, sisa 1 kartu (4♦)' } },
    script: (v) => [{ do: 'wait', ms: 1100 },
      { do: 'archive', title: tr(`SIMILAR INCIDENT · ${v.name}`, `KEJADIAN SERUPA · ${v.name}`), stamp: tr('ONGOING', 'BERLANJUT'), ms: 5200,
        lines: [tr(`yesterday ${hhmm(v.then.t)} · ${say(v.then.text)}`, `${hhmm(v.then.t)} kemarin · ${say(v.then.text)}`), tr(`now · ${say(v.now)}`, `sekarang · ${say(v.now)}`)] }] });

  // Sistem Ikut Prihatin — someone is really going under: the system switches to their side (the only bit allowed to touch them).
  add({ id: 'sistem-prihatin', mode: 'TAKING SIDES', rarity: 'RARE', on: ['round:end'], oncePerMatch: true, kind: 'support', chance: 0.9,
    when: (B) => { const e = B.ev('MEM_SPIRAL'); return e ? { seat: e.seat, name: e.name } : false; },
    onPerform: (v) => { if (mem() && mem().support) mem().support(v.name); },
    demo: { seat: 1, name: 'Budi' },
    script: (v) => [{ do: 'wait', ms: 1300 }, { do: 'sound', key: 'notify' },
      { do: 'notify', app: tr('Capsa · Policy', 'Capsa · Kebijakan'), title: tr('Policy update', 'Pembaruan kebijakan'),
        body: tr(`Effective this round, the system supports ${v.name} until conditions improve.`, `Mulai ronde ini, sistem mendukung ${v.name} sampai kondisinya membaik.`), ms: 5200 }] });
})();

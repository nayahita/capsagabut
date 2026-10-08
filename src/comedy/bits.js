/*
 * The bits (content pass v1, "Capsa Comedy Bible v1").
 * Each one:
 *   id, mode, rarity, weight ('micro' | 'stage'), on: [facts], chance?, cooldownMs?, oncePerMatch?, delay?
 *   when(B)  → false, or the values the script needs. Return { once: 'key' } to make it fire at most once for that key.
 *   script(v, B, h) → timeline steps. Use only `v` and `h` so previews work.
 *   note(v)  → optional moment written to every phone's memory (shows up in the match report).
 *   demo     → sample values for the preview buttons.
 * Voice: formal Indonesian, short, never explains the joke. Text is resolved by the host once.
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
  const losers = (d) => d.names.map((n, i) => ({ name: n, seat: i, left: d.counts[i], hand: (d.hands || [])[i] || [], pen: (d.penalties || [])[i] || 0 })).filter((x) => x.seat !== d.winner);
  const seatOf = (B, name) => (B.names || []).findIndex((n) => key(n) === key(name));

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
      { do: 'memory', title: 'Kenangan', sub: 'Beberapa menit lalu di meja ini', card: v.card, caption: `${v.name} · ronde ${v.round}`, ms: 4000 },
    ] });

  // 2. Survei Kepuasan
  add({ id: 'survei', mode: 'FAKE SERIOUSNESS', rarity: 'COMMON', on: ['round:end'], cooldownMs: 5 * MIN,
    when: (B) => { const p = losers(B.d).filter((x) => x.pen >= 20).sort((a, b) => b.pen - a.pen)[0]; return p ? { name: p.name } : false; },
    demo: { name: 'Dodi' },
    script: (v) => {
      const reply = 'Terima kasih. Masukan Anda tidak akan mengubah apa pun.';
      return [{ do: 'wait', ms: 600 }, { do: 'sound', key: 'notify' },
        { do: 'notify', app: 'Capsa · Survei', title: `Bagaimana ronde ini, ${v.name}?`, ms: 6000,
          buttons: [{ label: 'Buruk', reply }, { label: 'Sangat buruk', reply }] }];
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
      { do: 'memorial', cards: v.cards, line1: `${h.cards(v.cards)} · ronde ${v.round}`, line2: v.bomb ? 'Tidak pernah meledak.' : 'Tidak pernah dimainkan.', ms: 4500 },
    ] });

  // 5. Seperti Biasa — gaslighting a comeback into routine.
  add({ id: 'seperti-biasa', mode: 'GASLIGHTING', rarity: 'COMMON', weight: 'micro', on: ['round:end'], cooldownMs: 4 * MIN,
    when: (B) => { const e = B.ev('MEM_SLUMP_WIN'); return e ? { name: e.name } : false; },
    demo: { name: 'Cici' },
    script: () => [{ do: 'wait', ms: 1100 }, { do: 'caption', text: 'Seperti biasa.', size: 's', ms: 2000 }] });

  // 6. Disetujui — the system's favorite gets an approval stamp. Nobody else does.
  add({ id: 'disetujui', mode: 'TAKING SIDES', rarity: 'COMMON', weight: 'micro', on: ['play'], chance: 0.25, cooldownMs: 60000,
    when: (B) => {
      const f = mem() && mem().favorite();
      return f && f.key === key(B.d.name) && B.d.size >= 2 ? { sig: (B.d.cards || []).slice().sort((a, b) => a - b).join(',') } : false;
    },
    demo: { sig: '' },
    script: (v) => [{ do: 'wait', ms: 600 }, { do: 'sound', key: 'stamp', vol: 0.3 }, { do: 'approve', sig: v.sig }] });

  // 8. Masih di Sana?
  add({ id: 'masih-di-sana', mode: 'FAKE SERIOUSNESS', rarity: 'COMMON', on: ['pass'], cooldownMs: 3 * MIN,
    when: (B) => (B.d.timeout ? { name: B.d.name } : false),
    demo: { name: 'Budi' },
    script: (v) => [{ do: 'still', question: `Apakah ${v.name} masih di sana?`, after: 'Kami anggap tidak.', button: 'Masih', countdown: 3000, ms: 4700, block: true }] });

  /* ============================== UNCOMMON ============================== */

  // 9. Faktor Kemenangan
  add({ id: 'faktor-kemenangan', mode: 'FAKE ANALYTICS · TAKING SIDES', rarity: 'UNCOMMON', on: ['round:end'], cooldownMs: 6 * MIN,
    when: (B) => { const L = losers(B.d); return L.length && Math.min(...L.map((x) => x.left)) >= 6 ? { name: B.d.names[B.d.winner] } : false; },
    demo: { name: 'Ana' },
    script: (v) => [
      { do: 'wait', ms: 1100 }, { do: 'sound', key: 'notify' },
      { do: 'chart', title: `Faktor kemenangan ${v.name}`, kind: 'bar', unit: '%', ms: 4500, note: 'Sumber: pengamatan.', noteAt: 1500,
        data: [{ label: 'Strategi', value: 4 }, { label: 'Keberuntungan', value: 3 }, { label: 'Lawan', value: 93 }] },
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
      { do: 'mic', seat: v.seat, open: `Mic dibuka untuk ${v.name}.`, close: 'Mic ditutup.', closeAt: 4000, ms: 5600 },
    ] });

  // 11. Undangan Evaluasi
  add({ id: 'undangan', mode: 'FAKE SERIOUSNESS', rarity: 'UNCOMMON', on: ['round:end'],
    when: (B) => { const p = losers(B.d).find((x) => mem() && mem().streak(x.name).loss === 3); return p ? { once: `undangan:${key(p.name)}`, name: p.name } : false; },
    demo: { name: 'Budi' },
    script: (v) => [
      { do: 'wait', ms: 1100 }, { do: 'sound', key: 'notify' },
      { do: 'notify', icon: 'calendar', app: 'Kalender', title: `Undangan: Evaluasi Kinerja ${v.name}`, ms: 7000,
        lines: ['Besok, 08.00 · Ruang: meja ini', `Peserta: semua, kecuali ${v.name}`],
        buttons: [{ label: 'Terima' }, { label: 'Tolak', reply: 'Kehadiran tidak diperlukan.' }] },
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
      { do: 'cctv', cards: v.cards, caption: 'Terduga pelaku tampak tenang.', captionAt: 2500, ms: 5000, block: true },
    ] });

  // 13. Tadi Ada Suara?
  add({ id: 'tadi-ada-suara', mode: 'UNDERREACT · PRETEND NOTHING', rarity: 'UNCOMMON', weight: 'micro', on: ['round:end'], cooldownMs: 5 * MIN,
    when: (B) => B.d.how === 'bomb',
    demo: {},
    script: () => [{ do: 'wait', ms: 2400 }, { do: 'caption', text: 'Maaf, tadi ada yang bunyi?', size: 's', ms: 2500 }] });

  // 14. Pembukaan Resmi
  add({ id: 'pembukaan', mode: 'OVERREACT · ANTI-CLIMAX', rarity: 'UNCOMMON', on: ['play'], chance: 0.4, oncePerMatch: true,
    when: (B) => {
      const m = mem(); if (!m || m.match().rounds.length || !m.round() || m.round().plays !== 1) return false;
      return B.d.size === 1 && B.d.cards && B.d.cards[0] === 0;
    },
    demo: {},
    script: () => [
      { do: 'dim', ms: 6800, block: true }, { do: 'sound', key: 'drumroll' }, { do: 'wait', ms: 600 },
      { do: 'banner', text: 'PEMBUKAAN RESMI', ms: 1800 },
      { do: 'spot', cards: [0], ms: 3000, next: 1800 },
      { do: 'caption', text: 'Ronde dibuka dengan 3♦.', size: 'm', ms: 1400 },
      { do: 'caption', text: '(wajib)', size: 's', ms: 1400 },
    ] });

  // 15. Garis Polisi — whoever let the winner through.
  add({ id: 'garis-polisi', mode: 'TAKING SIDES', rarity: 'UNCOMMON', on: ['round:end'], cooldownMs: 5 * MIN,
    when: (B) => { const r = mem() && mem().lastRound(); return r && r.enabler != null ? { name: B.d.names[r.enabler] } : false; },
    demo: { name: 'Cici' },
    script: (v) => [
      { do: 'wait', ms: 1100 }, { do: 'sound', key: 'stamp' },
      { do: 'tape', text: 'GARIS POLISI · JANGAN MELINTAS', ms: 4000, next: 1000 },
      { do: 'caption', text: `Saksi kunci: ${v.name}.`, size: 'm', ms: 3000 },
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
      { do: 'notify', app: 'Capsa · Kepatuhan', title: `Surat Peringatan 1 · ${v.name}`, body: `Atas tindakan berulang terhadap ${v.victim}.`,
        lines: ['Peringatan ini tidak memiliki konsekuensi.'], ms: 5000 },
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
      { do: 'caption', text: 'Sistem sedang berduka.', size: 's', ms: 2300 },
      { do: 'caption', text: 'Ronde ini tidak dihitung.', size: 'm', ms: 1500 },
      { do: 'sound', key: 'deflate', vol: 0.5 }, { do: 'caption', text: '(dihitung)', size: 's', ms: 1500 },
    ] });

  // 19. Arsip Insiden
  add({ id: 'arsip', mode: 'CALLBACK', rarity: 'RARE', on: ['round:end'],
    when: (B) => { const e = B.ev('MEM_INCIDENT'); return e ? { once: `arsip:${key(e.name)}`, name: e.name, lines: e.lines } : false; },
    demo: { name: 'Budi', lines: ['R2 · kalah, sisa 1 kartu (9♣)', 'R5 · "santai, masih panjang"', 'R7 · timeout'] },
    script: (v) => [{ do: 'wait', ms: 1100 }, { do: 'archive', title: `ARSIP · ${v.name}`, lines: v.lines, stamp: 'AKTIF', ms: 5800 }] });

  // 20. Belum Pernah Terjadi (+ the late concession)
  add({ id: 'belum-pernah', mode: 'GASLIGHTING', rarity: 'RARE', weight: 'micro', on: ['play'], chance: 0.85,
    when: (B) => { const e = B.ev('MEM_THREAD_TENSE'); return e && e.times >= 2 ? { once: `bpt:${key(e.name)}` } : false; },
    demo: {},
    script: () => [{ do: 'sound', key: 'heartbeat' }, { do: 'caption', text: 'Tenang. Ini belum pernah terjadi.', size: 's', ms: 2600 }] });
  add({ id: 'mungkin-pernah', mode: 'CALLBACK · GASLIGHTING', rarity: 'RARE', weight: 'micro', on: ['round:end'], chance: 0.9,
    when: (B) => {
      const e = B.evs('MEM_THREAD_RESOLVED').find((x) => x.outcome === 'lost' && x.times >= 2 && used(`bpt:${key(x.name)}`));
      return e ? { once: `mp:${key(e.name)}` } : false;
    },
    demo: {},
    script: () => [{ do: 'wait', ms: 2100 }, { do: 'caption', text: 'Oke. Mungkin pernah.', size: 's', ms: 2400 }] });

  // 21. Hening — loud mouth, ten cards left. The system says nothing at all.
  add({ id: 'hening', mode: 'SILENCE', rarity: 'RARE', on: ['round:end'], chance: 0.7, oncePerMatch: true,
    when: (B) => {
      const e = B.evs('MEM_EZ_RESOLVED').find((x) => x.outcome === 'lost' && x.cardsLeft >= 10); if (!e) return false;
      const s = mem().setups('ezLost').find((x) => x.round === B.d.round && key(x.name) === key(e.name));
      return { once: s ? s.id : `hening:${key(e.name)}`, name: e.name, round: B.d.round };
    },
    note: (v) => ({ round: v.round, name: v.name, text: `momen hening: ronde ${v.round}`, w: 7 }),
    demo: { name: 'Ana', round: 4 },
    script: () => [{ do: 'wait', ms: 600 }, { do: 'freeze', ms: 4500 }, { do: 'silence', ms: 4500 }, { do: 'wait', ms: 4500 }] });

  // 22. Ganti Dukungan
  add({ id: 'ganti-dukungan', mode: 'TAKING SIDES', rarity: 'RARE', on: ['round:end'], chance: 0.95, cooldownMs: 10 * MIN,
    when: (B) => { const e = B.ev('MEM_FAVORITE_CHANGED'); return e ? { name: e.name, old: e.old } : false; },
    demo: { name: 'Cici', old: 'Budi' },
    script: (v) => [
      { do: 'wait', ms: 1100 }, { do: 'sound', key: 'notify' },
      { do: 'notify', app: 'Capsa · Kebijakan', title: 'Pembaruan kebijakan', body: `Mulai ronde ini, sistem mendukung ${v.name}.`,
        later: { text: `Ini bukan tentang kamu, ${v.old}.`, at: 2000 }, ms: 5200 },
    ] });

  // 23. Laporan Kinerja — real score line, corporate euphemism.
  add({ id: 'laporan-kinerja', mode: 'FAKE ANALYTICS', rarity: 'RARE', on: ['round:end'], cooldownMs: 10 * MIN,
    when: (B) => {
      for (const n of B.d.names) {
        const s = mem() ? mem().scoresOf(n) : [];
        if (s.length < 5) continue;
        const t = s.slice(-5);
        if (t.every((x, i) => i === 0 || x < t[i - 1]) && s[s.length - 1] <= -30) {
          const from = Math.max(0, s.length - 10);
          return { name: n, round: B.d.round, data: s.slice(from).map((val, i) => ({ label: 'R' + (from + i + 1), value: val })) };
        }
      }
      return false;
    },
    demo: { name: 'Dodi', round: 6, data: [-2, -9, -14, -22, -31, -38].map((v, i) => ({ label: 'R' + (i + 1), value: v })) },
    script: (v) => [
      { do: 'wait', ms: 1100 }, { do: 'sound', key: 'notify' },
      { do: 'chart', kind: 'line', title: `Kinerja ${v.name} · ronde 1–${v.round}`, data: v.data, note: 'Proyeksi: stabil.', noteAt: 1500, ms: 4500 },
    ] });

  // 24. Penyebab Kekalahan — blame the one person who did nothing.
  add({ id: 'penyebab', mode: 'TAKING SIDES · MISDIRECTION', rarity: 'RARE', on: ['round:end'], chance: 0.25, cooldownMs: 15 * MIN,
    when: (B) => {
      const d = B.d, r = mem() && mem().lastRound(); if (!r || d.names.length < 3) return false;
      const L = losers(d), worst = Math.max(...L.map((x) => x.pen)), beaten = r.beatBy[d.winner] || {};
      const z = L.filter((x) => x.pen < worst && !beaten[x.seat]).sort((a, b) => a.left - b.left)[0];
      return z ? { name: z.name } : false;
    },
    demo: { name: 'Cici' },
    script: (v) => [
      { do: 'wait', ms: 1100 }, { do: 'sound', key: 'notify' },
      { do: 'notify', app: 'Capsa · Investigasi', title: 'Hasil investigasi', body: 'Penyebab kekalahan ronde ini telah diidentifikasi.',
        later: { text: `${v.name}.`, at: 2500 }, ms: 5500 },
    ] });

  // 25. Disarankan untuk Anda
  add({ id: 'disarankan', mode: 'CALLBACK · PATTERN', rarity: 'RARE', weight: 'micro', on: ['round:end'],
    when: (B) => {
      const p = losers(B.d).find((x) => x.hand.filter((c) => RANK(c) === 12).length >= 2 && (mem().match().twosDiedBy[key(x.name)] || 0) === 2);
      return p ? { once: `reco:${key(p.name)}`, name: p.name, cards: p.hand.filter((c) => RANK(c) === 12).slice(0, 2) } : false;
    },
    demo: { name: 'Cici', cards: [49, 51] },
    script: (v) => [{ do: 'wait', ms: 1100 }, { do: 'reco', cards: v.cards, title: 'Cara Melepaskan: Panduan Pemula', sub: `Disarankan untuk ${v.name}`, duration: '12:04', ms: 4000 }] });

  /* ============================== LEGENDARY ============================== */

  // 27. Catatan Pembaruan
  add({ id: 'patch-notes', mode: 'META · CALLBACK', rarity: 'LEGENDARY', on: ['round:start'], oncePerMatch: true,
    when: (B) => {
      if (B.d.round !== 10 || !mem()) return false;
      const lines = [];
      for (const l of mem().lore()) {
        if (l.kind === 'lastCard') lines.push(`Menurunkan peluang ${l.name} menang di kartu terakhir. Tidak disengaja.`);
        if (l.kind === 'favorite') lines.push(`${l.name} kini resmi menjadi favorit sistem.`);
        if (l.kind === 'hoarder') lines.push(`Kartu 2 milik ${l.name} masih tidak bisa dikeluarkan. Sedang diselidiki.`);
        if (l.kind === 'trash') lines.push(`Pesan ${l.text} dari ${l.name} telah diarsipkan sebagai barang bukti.`);
        if (l.kind === 'worst') lines.push(`Memperbaiki bug di mana ${l.name} merasa bisa menang.`);
      }
      return lines.length >= 3 ? { round: B.d.round, lines: lines.slice(0, 4) } : false;
    },
    demo: { round: 10, lines: ['Menurunkan peluang Budi menang di kartu terakhir. Tidak disengaja.', 'Ana kini resmi menjadi favorit sistem.', 'Kartu 2 milik Cici masih tidak bisa dikeluarkan. Sedang diselidiki.', 'Memperbaiki bug di mana Dodi merasa bisa menang.'] },
    script: (v) => [
      { do: 'wait', ms: 1000 }, { do: 'sound', key: 'notify' },
      { do: 'patch', version: `Capsa 1.0.${v.round}`, title: 'Catatan pembaruan', lines: v.lines, button: 'Perbarui', ms: 9000, block: true },
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
      { do: 'fakeSeat', name: 'Sistem', text: '13 kartu', later: 'keluar', laterAt: 4500, ms: 6500, next: 2000 },
      { do: 'sound', key: 'notify' }, { do: 'notify', app: 'Sistem', title: 'Sistem bergabung untuk menyeimbangkan permainan.', ms: 2500, next: 3500 },
      { do: 'caption', text: 'Terlalu berat.', size: 's', ms: 1500, next: 1000 }, { do: 'sound', key: 'whoosh' },
    ] });

  // 30. Harapan, Bukan Data
  add({ id: 'harapan', mode: 'GASLIGHTING · META · ANTI-CLIMAX', rarity: 'LEGENDARY', on: ['round:end'], oncePerMatch: true,
    when: (B) => {
      const sb = B.d.scoresBefore || [], w = B.d.winner;
      if (!sb.length || sb[w] > -40 || sb[w] !== Math.min(...sb)) return false;
      const top = Math.max(...(B.d.scoresAfter || [0]));
      return { seat: w, value: top + 13 };
    },
    demo: { seat: 3, value: 55 },
    script: (v) => [
      { do: 'wait', ms: 1600 }, { do: 'sound', key: 'kazoo' },
      { do: 'scoreSwap', seat: v.seat, value: v.value, ms: 2000 },
      { do: 'caption', text: 'Klasemen terbaru.', size: 's', ms: 2000, next: 2000 },
      { do: 'sound', key: 'glitch' }, { do: 'caption', text: 'Maaf. Itu harapan, bukan data.', size: 's', ms: 2500 },
    ] });

  /* ============================== KEPT FROM v0 ============================== */

  add({ id: 'glory-duration', mode: 'ANTI-CLIMAX', rarity: 'COMMON', weight: 'micro', on: ['play'], cooldownMs: 2 * MIN,
    when: (B) => { const e = B.ev('MEM_BIG_BEATEN'); return e && e.secs <= 20 ? { victim: e.victim, secs: e.secs } : false; },
    demo: { victim: 'Cici', secs: 4 },
    script: (v) => [{ do: 'caption', size: 's', ms: 2400, text: `Durasi kejayaan ${v.victim}: ${v.secs} detik.` }] });

  add({ id: 'mental-health', mode: 'PSYCHOLOGICAL DAMAGE', rarity: 'UNCOMMON', on: ['round:end'], cooldownMs: 5 * MIN,
    when: (B) => { const p = losers(B.d).find((x) => mem() && mem().streak(x.name).loss === 4); return p ? { name: p.name } : false; },
    demo: { name: 'Budi' },
    script: (v) => [{ do: 'wait', ms: 1100 }, { do: 'sound', key: 'notify' },
      { do: 'notify', app: 'Kesehatan Mental', title: `${v.name}, sudah 4 ronde tanpa menang`, body: 'Mau istirahat sebentar?', buttons: ['Tidak', 'Tidak'], ms: 6500 }] });

  add({ id: 'not-this-again', mode: 'CALLBACK', rarity: 'UNCOMMON', weight: 'micro', on: ['play'], chance: 0.85, cooldownMs: 3 * MIN,
    when: (B) => { const e = B.ev('MEM_THREAD_TENSE'); return e && e.times === 1 ? { origin: e.originRound } : false; },
    demo: { origin: 1 },
    script: (v, B, h) => [{ do: 'sound', key: 'heartbeat' }, { do: 'caption', size: 'm', ms: 2400, text: h.pick(['Ini lagi.', `Kita pernah di sini. Ronde ${v.origin}.`]) }] });

  add({ id: 'character-development', mode: 'CALLBACK', rarity: 'UNCOMMON', weight: 'micro', on: ['round:end'], chance: 0.9, cooldownMs: 5 * MIN,
    when: (B) => { const e = B.evs('MEM_THREAD_RESOLVED').find((x) => x.outcome === 'won' && x.times === 1); return e ? {} : false; },
    demo: {},
    script: () => [{ do: 'wait', ms: 600 }, { do: 'sound', key: 'kazoo' }, { do: 'caption', text: 'Ada perkembangan.', size: 'l', ms: 2400 }] });

  add({ id: 'learned-nothing', mode: 'CALLBACK', rarity: 'UNCOMMON', on: ['round:end'], chance: 0.9,
    when: (B) => { const e = B.evs('MEM_THREAD_RESOLVED').find((x) => x.outcome === 'lost' && x.times === 1); return e ? { origin: e.originRound, now: B.d.round } : false; },
    demo: { origin: 1, now: 6 },
    script: (v) => [
      { do: 'silence', ms: 6000 }, { do: 'freeze', ms: 5200 }, { do: 'sound', key: 'tapeStop' }, { do: 'wait', ms: 1500 },
      { do: 'caption', text: 'Kita tidak belajar apa-apa.', size: 'l', ms: 2500 },
      { do: 'caption', text: `(ronde ${v.origin} dan ronde ${v.now}. kejadiannya sama persis.)`, size: 's', ms: 2300 },
    ] });

  add({ id: 'drumroll-nothing', mode: 'ANTI-CLIMAX', rarity: 'UNCOMMON', on: ['round:end'], chance: 0.05, cooldownMs: 10 * MIN,
    when: (B) => !['BAD_BEAT', 'BIG_COMEBACK', 'WIN_STREAK', 'UPSET_WIN', 'LOSS_STREAK', 'MEM_EZ_RESOLVED', 'MEM_THREAD_RESOLVED', 'MEM_GRUDGE_SETTLED', 'MEM_BOUNTY_POSTED', 'MEM_BOUNTY_CLAIMED', 'MEM_INCIDENT', 'MEM_FAVORITE_CHANGED'].some((t) => B.ev(t)),
    demo: {},
    script: (v, B, h) => [{ do: 'sound', key: 'drumroll' }, { do: 'banner', text: 'PENGUMUMAN PENTING', ms: 2300 }, { do: 'wait', ms: 300 },
      { do: 'caption', text: h.pick(['Tidak ada. Lanjut.', 'Lupa mau bilang apa.', 'Itu saja.']), size: 's', ms: 1900 }] });

  add({ id: 'ez-valid', mode: 'DEADPAN', rarity: 'UNCOMMON', weight: 'micro', on: ['round:end'], chance: 0.6,
    when: (B) => { const e = B.evs('MEM_EZ_RESOLVED').find((x) => x.outcome === 'won'); return e ? { seat: e.seat, text: e.text } : false; },
    demo: { seat: 0, text: 'EZ' },
    script: (v) => [{ do: 'bubble', seat: v.seat, text: v.text, ms: 2300, next: 1000 }, { do: 'caption', text: 'Valid.', size: 's', ms: 1800 }] });

  add({ id: 'typing', mode: 'PSYCHOLOGICAL DAMAGE', rarity: 'UNCOMMON', weight: 'micro', on: ['play', 'pass'], chance: 0.12, cooldownMs: 6 * MIN,
    when: (B) => { const t = mem() && mem().target(), n = (B.names || []).length; return t && n && (B.d.seat + 1) % n === t.seat ? {} : false; },
    demo: {},
    script: () => [{ do: 'sound', key: 'typing' }, { do: 'typing', ms: 3200 }] });

  add({ id: 'revenge-receipt', mode: 'REVENGE', rarity: 'UNCOMMON', on: ['round:end'], chance: 0.7, cooldownMs: 6 * MIN,
    when: (B) => { const e = B.ev('MEM_GRUDGE_SETTLED'); return e ? { name: e.name, bully: e.bully, round: e.round, pen: e.pen } : false; },
    demo: { name: 'Budi', bully: 'Ana', round: 2, pen: 14 },
    script: (v) => [{ do: 'sound', key: 'register' },
      { do: 'receipt', title: 'STRUK PELUNASAN', ms: 5200, next: 1900, lines: [[`Utang ronde ${v.round}`, `${v.pen} poin`], ['Bunga', 'harga diri'], ['Dibayar oleh', v.name], ['Diterima dari', v.bully]], total: ['STATUS', 'LUNAS'], foot: 'Simpan struk ini sebagai bukti.' },
      { do: 'sound', key: 'stamp' }, { do: 'stamp', text: 'LUNAS', ms: 1800 }] });

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
      { do: 'sound', key: 'notify' }, { do: 'notify', app: 'Sistem', title: 'Pesan sebelumnya terdeteksi', body: `${v.name} · ${v.secs} detik yang lalu`, ms: 5400, next: 1500 },
      { do: 'bubble', seat: v.seat, text: v.text, ms: 3600, next: 2000 },
      { do: 'caption', text: 'Menarik.', size: 'm', ms: 1900, next: 2100 },
    ] });

  add({ id: 'wanted-poster', mode: 'BOUNTY', rarity: 'RARE', on: ['round:end'], chance: 0.9,
    when: (B) => { const e = B.ev('MEM_BOUNTY_POSTED'); return e ? { name: e.name, streak: e.streak } : false; },
    demo: { name: 'Ana', streak: 3 },
    script: (v, B, h) => [{ do: 'sound', key: 'stamp' },
      { do: 'poster', title: 'DICARI', name: v.name, sub: `${v.streak} kemenangan beruntun`, ms: 5000, reward: h.pick(['Hadiah: harga diri', 'Hadiah: ketenangan batin seluruh meja']), foot: 'Kalahkan untuk mengklaim.' }] });

  add({ id: 'bounty-claimed', mode: 'BOUNTY', rarity: 'RARE', on: ['round:end'], chance: 0.9,
    when: (B) => { const e = B.ev('MEM_BOUNTY_CLAIMED'); return e ? { name: e.name, target: e.target, streak: e.streak } : false; },
    demo: { name: 'Cici', target: 'Ana', streak: 3 },
    script: (v) => [{ do: 'sound', key: 'register' },
      { do: 'notify', app: 'Papan Bounty', title: `Bounty ${v.target} diklaim oleh ${v.name}`, body: 'Hadiah: tidak ada.', ms: 5600 }] });

  add({ id: 'courage-chart', mode: 'FAKE ANALYTICS', rarity: 'RARE', on: ['round:end'], chance: 0.6, cooldownMs: 6 * MIN,
    when: (B) => {
      const lr = mem() && mem().lastRound(); if (!lr) return false;
      const i = lr.passes.indexOf(Math.max(...lr.passes));
      return lr.passes[i] >= 6 ? { name: lr.names[i], passes: lr.passes[i], round: lr.round } : false;
    },
    demo: { name: 'Dodi', passes: 7, round: 4 },
    script: (v) => [{ do: 'sound', key: 'notify' }, { do: 'chart', kind: 'flat', title: `Grafik keberanian ${v.name}`, sub: `Ronde ${v.round} · ${v.passes}× pass`, ms: 5200, note: 'Garisnya memang begini.' }] });

  add({ id: 'exe-crash', mode: 'RARE CHAOS EVENT', rarity: 'LEGENDARY', on: ['play'], oncePerMatch: true,
    when: (B) => (B.d.cat === 5 || (B.d.cat === 4 && mem() && mem().match().bombs === 3) ? { name: B.d.name } : false),
    demo: { name: 'Ana' },
    script: (v) => [{ do: 'rarity', level: 'LEGENDARY' }, { do: 'sound', key: 'glitch' }, { do: 'effect', name: 'glitch' }, { do: 'wait', ms: 800 },
      { do: 'sound', key: 'error' }, { do: 'error', title: 'CAPSA.EXE berhenti merespons', body: `Penyebab: ${v.name}.`, block: true, ms: 6000,
        bars: [['Mengumpulkan data kerusakan', 100], ['Mengumpulkan sisa harga diri lawan', 0]] }] });

  add({ id: 'sealed-13', mode: 'RARE CHAOS EVENT', rarity: 'LEGENDARY', on: ['round:end'], cooldownMs: 10 * MIN,
    when: (B) => { const p = losers(B.d).find((x) => x.left === 13); return p ? { name: p.name } : false; },
    demo: { name: 'Dodi' },
    script: (v) => [{ do: 'rarity', level: 'LEGENDARY' }, { do: 'sound', key: 'register' },
      { do: 'receipt', title: 'MARKETPLACE', ms: 6200, foot: 'COD area meja ini.',
        lines: [['Dijual', '13 kartu remi'], ['Kondisi', 'segel'], ['Pemilik', v.name], ['Alasan dijual', 'tidak sempat dipakai'], ['Harga', 'nego']], total: ['STATUS', 'TERSEDIA'] }] });

  add({ id: 'courtroom', mode: 'FAKE SERIOUSNESS · ESCALATION', rarity: 'LEGENDARY', on: ['round:end'], oncePerMatch: true,
    when: (B) => { const e = B.ev('UPSET_WIN'); return e && e.gap >= 20 ? { name: e.name, gap: e.gap } : false; },
    demo: { name: 'Dodi', gap: 24 },
    script: (v) => [{ do: 'rarity', level: 'LEGENDARY' }, { do: 'freeze', ms: 9800 }, { do: 'sound', key: 'gavel' },
      { do: 'banner', text: 'SIDANG DIBUKA', ms: 2200 }, { do: 'caption', text: 'Terdakwa: klasemen.', size: 'm', ms: 1700 },
      { do: 'caption', text: `Dakwaan: ketinggalan ${v.gap} poin. Dinyatakan tidak berlaku.`, size: 'm', ms: 2000 },
      { do: 'sound', key: 'gavel' }, { do: 'stamp', text: 'PUTUSAN', ms: 1400 },
      { do: 'caption', text: `${v.name} dinyatakan tidak sengaja jenius.`, size: 'l', ms: 2600 }] });

  add({ id: 'nothing-happens', mode: 'ANTI-CLIMAX', rarity: 'LEGENDARY', on: ['round:end'], chance: 0.01, oncePerMatch: true,
    when: () => true, demo: {},
    script: () => [{ do: 'rarity', level: 'LEGENDARY' }, { do: 'sound', key: 'drumroll' }, { do: 'banner', text: 'KEJADIAN LANGKA TERDETEKSI', ms: 2300 },
      { do: 'wait', ms: 1400 }, { do: 'caption', text: 'Tidak ada yang terjadi.', size: 's', ms: 1700 }, { do: 'wait', ms: 500 },
      { do: 'caption', text: 'Sangat langka.', size: 's', ms: 1800 }] });
})();

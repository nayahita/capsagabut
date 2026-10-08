/*
 * The bits. Each one:
 *   id, mode, rarity, on: [facts], chance?, cooldownMs?, oncePerMatch?, delay?
 *   when(B)  → false, or an object of values the script needs (B: see docs/COMEDY_DIRECTOR.md)
 *   script(v, B, h) → timeline steps. Use only `v` and `h` so previews work.
 *   demo     → sample values for the preview buttons.
 * Text is resolved by the host once, so every phone sees the same line.
 */
(function () {
  'use strict';
  const D = window.CapsaComedy;
  if (!D) return;
  const add = (b) => D.addBit(b);
  const mem = () => window.CapsaMemory;
  const RANK = (c) => c >> 2;
  const MIN = 60000;
  const losers = (d) => d.names.map((n, i) => ({ name: n, seat: i, left: d.counts[i], hand: (d.hands || [])[i] || [], pen: (d.penalties || [])[i] || 0 })).filter((x) => x.seat !== d.winner);

  /* ======================= COMMON ======================= */

  add({ id: 'interesting', mode: 'DEADPAN', rarity: 'COMMON', on: ['round:end'], chance: 0.55,
    when: (B) => {
      const e = B.evs('BAD_BEAT').find((x) => x.cardsLeft === 1);
      if (!e || B.evs('MEM_THREAD_RESOLVED').some((r) => r.seat === e.seat)) return false;
      return { name: e.name, seat: e.seat };
    },
    demo: { name: 'Budi', seat: 1 },
    script: (v, B, h) => [
      { do: 'silence', ms: 2600 }, { do: 'wait', ms: 1100 },
      { do: 'caption', text: h.pick(['Menarik.', 'Hmm.', 'Dicatat.']), size: 's', ms: 2000 },
    ] });

  add({ id: 'hoarder', mode: 'ROAST', rarity: 'COMMON', on: ['round:end'], cooldownMs: 3 * MIN,
    when: (B) => {
      let best = null;
      losers(B.d).forEach((p) => { const tw = p.hand.filter((c) => RANK(c) === 12); if (tw.length >= 2 && (!best || tw.length > best.n)) best = { name: p.name, n: tw.length, cards: tw }; });
      return best ? Object.assign(best, { total: mem() ? mem().match().twosDied : best.n }) : false;
    },
    demo: { name: 'Cici', n: 3, cards: [48, 49, 51], total: 5 },
    script: (v, B, h) => [
      { do: 'sound', key: 'deflate' },
      { do: 'card', tone: 'spicy', mascot: 'shock', title: h.pick(['Barang bukti', 'Inventaris ditemukan']),
        text: h.pick([
          `${v.name} meninggal dunia sambil memeluk ${v.n} kartu 2. Disimpan buat warisan?`,
          `${h.cards(v.cards)} ditemukan di tangan ${v.name}. Belum pernah keluar rumah.`,
          `${v.name} nyimpen ${v.n} kartu 2 sampai akhir. Strategi "nanti aja" berhasil bikin kalah.`]),
        stat: `Kartu 2 yang dibawa mati di match ini: ${v.total}`, ms: 4400 },
    ] });

  add({ id: 'blowout-analytics', mode: 'FAKE ANALYTICS', rarity: 'COMMON', on: ['round:end'], cooldownMs: 4 * MIN,
    when: (B) => {
      const L = losers(B.d); if (!L.length || Math.min(...L.map((x) => x.left)) < 7) return false;
      return { winner: B.d.names[B.d.winner], data: B.d.names.map((n, i) => ({ label: n, value: B.d.counts[i] })), avg: (L.reduce((a, x) => a + x.left, 0) / L.length).toFixed(1).replace('.', ',') };
    },
    demo: { winner: 'Ana', data: [{ label: 'Ana', value: 0 }, { label: 'Budi', value: 9 }, { label: 'Cici', value: 11 }], avg: '10,0' },
    script: (v, B, h) => [
      { do: 'sound', key: 'notify' },
      { do: 'chart', title: 'Analisis Pasca-Ronde', sub: 'Sisa kartu per pemain', kind: 'bar', data: v.data,
        note: h.pick(['Kesimpulan: ini bukan pertandingan. Ini penyuluhan.', `Rata-rata lawan ${v.winner} masih pegang ${v.avg} kartu. Tim analis memutuskan resign.`, 'Rekomendasi: ronde ini jangan pernah dibahas lagi.']),
        ms: 5200 },
    ] });

  add({ id: 'chose-peace', mode: 'DEADPAN', rarity: 'COMMON', on: ['pass'], cooldownMs: 2 * MIN,
    when: (B) => { const e = B.ev('MEM_PASSIVE'); return e ? { name: e.name } : false; },
    demo: { name: 'Dodi' },
    script: (v, B, h) => [{ do: 'caption', text: h.pick([`${v.name} memilih damai.`, `${v.name} pass lagi. Padahal bisa. Kami hormati.`, `${v.name} sedang menjalankan strategi "nanti aja".`]), size: 's', ms: 2400 }] });

  add({ id: 'bazooka', mode: 'ROAST', rarity: 'COMMON', on: ['play'], cooldownMs: 2 * MIN,
    when: (B) => { const e = B.ev('MEM_OVERKILL'); return e ? { name: e.name, card: e.card, against: e.against } : false; },
    demo: { name: 'Ana', card: 51, against: 8 },
    script: (v, B, h) => [{ do: 'caption', size: 'm', ms: 2800, text: h.pick([
      `Ngelawan ${h.card(v.against)} pakai ${h.card(v.card)}. Bazooka buat nyamuk.`,
      `${v.name} bayar parkir pakai emas batangan.`,
      `${h.card(v.card)} dipakai buat ${h.card(v.against)}. Kartu 2-nya sendiri kaget.`]) }] });

  add({ id: 'afk-notice', mode: 'FAKE SERIOUSNESS', rarity: 'COMMON', on: ['pass'], cooldownMs: 3 * MIN, chance: 0.4,
    when: (B) => (B.d.timeout ? { name: B.d.name, secs: (window.CapsaFX && window.CapsaFX.view().timer) || 30 } : false),
    demo: { name: 'Budi', secs: 30 },
    script: (v, B, h) => [
      { do: 'sound', key: 'notify' },
      { do: 'notify', app: 'Capsa · Keamanan', title: 'Aktivitas tidak biasa', ms: 5000, body: h.pick([
        `Kami mendeteksi ${v.name} tidak melakukan apa-apa selama ${v.secs} detik. Tidak ada yang perlu dikhawatirkan.`,
        `Akun ${v.name} sedang diambil alih oleh AFK. Kalau ini bukan kamu, ya memang bukan kamu.`]) },
    ] });

  add({ id: 'glory-duration', mode: 'ANTI-CLIMAX', rarity: 'COMMON', on: ['play'], cooldownMs: 2 * MIN,
    when: (B) => { const e = B.ev('MEM_BIG_BEATEN'); return e && e.secs <= 20 ? { victim: e.victim, combo: e.combo, secs: e.secs } : false; },
    demo: { victim: 'Cici', combo: 'Full House', secs: 4 },
    script: (v, B, h) => [{ do: 'caption', size: 'm', ms: 2600, text: h.pick([
      `Durasi kejayaan ${v.victim}: ${v.secs} detik.`,
      `${v.combo} ${v.victim} bertahan ${v.secs} detik. Lebih singkat dari iklan yang gak bisa di-skip.`]) }] });

  add({ id: 'historic-landslide', mode: 'FAKE SERIOUSNESS', rarity: 'COMMON', on: ['round:end'], cooldownMs: 4 * MIN,
    when: (B) => { const L = losers(B.d); const sum = L.reduce((a, x) => a + x.left, 0); return L.length && sum <= 5 && !B.ev('BAD_BEAT') ? { name: B.d.names[B.d.winner], sum } : false; },
    demo: { name: 'Ana', sum: 3 },
    script: (v, B, h) => [
      { do: 'sound', key: 'notify' },
      { do: 'notify', app: 'Berita Capsa', title: 'BREAKING', ms: 5000, body: h.pick([
        `Pertandingan sangat ketat (selisih ${v.sum} kartu). Sejarah akan mencatatnya sebagai kemenangan telak ${v.name}.`,
        `${v.name} menang tipis. Pidato kemenangan diperkirakan berlangsung 40 menit.`]) },
    ] });

  /* ======================= UNCOMMON ======================= */

  add({ id: 'mental-health', mode: 'PSYCHOLOGICAL DAMAGE', rarity: 'UNCOMMON', on: ['round:end'], cooldownMs: 5 * MIN,
    when: (B) => { const p = losers(B.d).find((x) => mem() && mem().streak(x.name).loss === 3); return p ? { name: p.name } : false; },
    demo: { name: 'Budi' },
    script: (v, B, h) => [
      { do: 'sound', key: 'notify' },
      { do: 'notify', app: 'Kesehatan Mental', title: `${v.name}, udah 3 ronde tanpa menang`, body: 'Mau istirahat sebentar?', buttons: ['Tidak', 'Tidak'], ms: 6500 },
    ] });

  add({ id: 'monte-carlo', mode: 'FAKE ANALYTICS', rarity: 'UNCOMMON', on: ['round:end'], cooldownMs: 6 * MIN,
    when: (B) => {
      const p = losers(B.d).find((x) => { const r = mem() && mem().rep(x.name); return r && r.rounds >= 5 && r.wins / r.rounds < 0.15; });
      if (!p) return false;
      const r = mem().rep(p.name);
      return { name: p.name, rounds: r.rounds, wins: r.wins };
    },
    demo: { name: 'Dodi', rounds: 9, wins: 1 },
    script: (v, B, h) => [
      { do: 'sound', key: 'notify' },
      { do: 'chart', title: 'Simulasi Monte Carlo', sub: `2.847 iterasi · subjek: ${v.name} · ${v.wins} menang dari ${v.rounds} ronde`, kind: 'bar', unit: '%',
        data: [{ label: 'Menang ronde depan', value: 0.3 }, { label: 'Kalah ronde depan', value: 99.7 }],
        note: h.pick(['Margin of error: 0,3%.', 'Data sudah dicek tiga kali. Hasilnya sama. Kami juga sedih.']), ms: 5600 },
    ] });

  add({ id: 'not-this-again', mode: 'CALLBACK', rarity: 'UNCOMMON', on: ['play'], chance: 0.85,
    when: (B) => { const e = B.ev('MEM_THREAD_TENSE'); return e ? { name: e.name, origin: e.originRound } : false; },
    demo: { name: 'Budi', origin: 1 },
    script: (v, B, h) => [
      { do: 'sound', key: 'heartbeat' },
      { do: 'caption', size: 'm', ms: 2600, text: h.pick(['Not this again.', 'Oh tidak. Ini lagi.', `Kita pernah di sini. Ronde ${v.origin}.`]) },
    ] });

  add({ id: 'character-development', mode: 'CALLBACK', rarity: 'UNCOMMON', on: ['round:end'], chance: 0.9,
    when: (B) => { const e = B.evs('MEM_THREAD_RESOLVED').find((x) => x.outcome === 'won'); return e ? { name: e.name, origin: e.originRound } : false; },
    demo: { name: 'Budi', origin: 1 },
    script: (v, B, h) => [
      { do: 'wait', ms: 500 }, { do: 'sound', key: 'kazoo' },
      { do: 'caption', text: 'Character development.', size: 'l', ms: 2600 }, { do: 'effect', name: 'sparkle', next: 0 },
    ] });

  add({ id: 'learned-nothing', mode: 'CALLBACK', rarity: 'UNCOMMON', on: ['round:end'], chance: 0.9,
    when: (B) => { const e = B.evs('MEM_THREAD_RESOLVED').find((x) => x.outcome === 'lost'); return e ? { name: e.name, origin: e.originRound, now: B.d.round } : false; },
    demo: { name: 'Budi', origin: 1, now: 6 },
    script: (v, B, h) => [
      { do: 'silence', ms: 6000 }, { do: 'freeze', ms: 5200 }, { do: 'sound', key: 'tapeStop' }, { do: 'wait', ms: 1500 },
      { do: 'caption', text: 'We have learned nothing.', size: 'l', ms: 2500 },
      { do: 'caption', text: `(ronde ${v.origin} dan ronde ${v.now}. kejadiannya sama persis.)`, size: 's', ms: 2300 },
    ] });

  add({ id: 'decided-not-to-win', mode: 'ROAST', rarity: 'UNCOMMON', on: ['round:end'], cooldownMs: 3 * MIN,
    when: (B) => {
      if (!B.ev('BIG_COMEBACK') || !mem() || !mem().lastRound()) return false;
      const lr = mem().lastRound();
      const p = losers(B.d).filter((x) => lr.min[x.seat] <= 2).sort((a, b) => lr.min[a.seat] - lr.min[b.seat])[0];
      return p ? { victim: p.name, min: lr.min[p.seat], winner: B.d.names[B.d.winner] } : false;
    },
    demo: { victim: 'Cici', min: 2, winner: 'Ana' },
    script: (v, B, h) => [
      { do: 'card', tone: 'lose', mascot: 'cry', title: 'Kronologi', ms: 4600,
        text: h.pick([`${v.victim} sempet tinggal ${v.min} kartu. Lalu memutuskan untuk tidak menang.`, `${v.victim} udah ${v.min} kartu lagi. ${v.winner} belum. Sekarang ${v.winner} menang. Silakan jelaskan ini ke keluarga.`]) },
    ] });

  add({ id: 'fake-update', mode: 'UNEXPECTED INTERRUPTION', rarity: 'UNCOMMON', on: ['round:start'], cooldownMs: 6 * MIN,
    when: (B) => { const n = (B.d.names || []).find((x) => mem() && mem().streak(x).loss >= 3); return n ? { name: n } : false; },
    demo: { name: 'Budi' },
    script: (v, B, h) => [
      { do: 'wait', ms: 1600 }, { do: 'sound', key: 'notify' },
      { do: 'notify', app: 'Capsa Updater', title: `Pembaruan tersedia untuk ${v.name}`, ms: 6500, buttons: ['Instal', 'Nanti'],
        body: h.pick(['Capsa 2.0 · Fitur baru: menang. Ukuran: 0 KB (masalahnya bukan di aplikasi).', 'Patch 1.0.1: memperbaiki bug di mana kamu kalah terus. Status: tidak bisa direproduksi di pemain lain.']) },
    ] });

  add({ id: 'drumroll-nothing', mode: 'ANTI-CLIMAX', rarity: 'UNCOMMON', on: ['round:end'], chance: 0.12, cooldownMs: 6 * MIN,
    when: (B) => !['BAD_BEAT', 'BIG_COMEBACK', 'WIN_STREAK', 'UPSET_WIN', 'LOSS_STREAK', 'MEM_EZ_RESOLVED', 'MEM_THREAD_RESOLVED', 'MEM_GRUDGE_SETTLED', 'MEM_BOUNTY_POSTED', 'MEM_BOUNTY_CLAIMED'].some((t) => B.ev(t)),
    demo: {},
    script: (v, B, h) => [
      { do: 'sound', key: 'drumroll' }, { do: 'banner', text: 'PENGUMUMAN PENTING', ms: 2300 }, { do: 'wait', ms: 300 },
      { do: 'caption', text: h.pick(['gak ada. lanjut.', 'lupa mau ngomong apa.', 'oke itu aja.']), size: 's', ms: 1900 },
    ] });

  add({ id: 'ez-valid', mode: 'DEADPAN', rarity: 'UNCOMMON', on: ['round:end'], chance: 0.6,
    when: (B) => { const e = B.evs('MEM_EZ_RESOLVED').find((x) => x.outcome === 'won'); return e ? { name: e.name, seat: e.seat, text: e.text } : false; },
    demo: { name: 'Ana', seat: 0, text: 'EZ' },
    script: (v, B, h) => [
      { do: 'bubble', seat: v.seat, text: v.text, ms: 2300, next: 1000 },
      { do: 'caption', text: h.pick(['Valid.', 'Oke. Valid.', 'Diizinkan.']), size: 's', ms: 1800 },
    ] });

  add({ id: 'typing', mode: 'PSYCHOLOGICAL DAMAGE', rarity: 'UNCOMMON', on: ['play', 'pass'], chance: 0.2, cooldownMs: 4 * MIN,
    when: (B) => {
      const t = mem() && mem().target(); const n = (B.names || []).length;
      return t && n && (B.d.seat + 1) % n === t.seat ? { name: t.name } : false;
    },
    demo: { name: 'Dodi' },
    script: () => [{ do: 'sound', key: 'typing' }, { do: 'typing', ms: 3200 }] });

  add({ id: 'legal-immoral', mode: 'FAKE SERIOUSNESS', rarity: 'UNCOMMON', on: ['round:end'], cooldownMs: 3 * MIN,
    when: (B) => (B.d.how === 'bomb' ? { name: B.d.names[B.d.winner] } : false),
    demo: { name: 'Ana' },
    script: (v, B, h) => [
      { do: 'sound', key: 'gavel' }, { do: 'stamp', text: 'SAH', ms: 1500 },
      { do: 'caption', size: 'm', ms: 2800, text: h.pick(['Kemenangan sah secara hukum. Cacat secara moral.', `Secara teknis ${v.name} menang. Secara spiritual, kita perlu bicara.`, 'Bom. Di meja keluarga. Luar biasa.']) },
    ] });

  add({ id: 'revenge-receipt', mode: 'REVENGE', rarity: 'UNCOMMON', on: ['round:end'], chance: 0.7,
    when: (B) => { const e = B.ev('MEM_GRUDGE_SETTLED'); return e ? { name: e.name, bully: e.bully, round: e.round, pen: e.pen } : false; },
    demo: { name: 'Budi', bully: 'Ana', round: 2, pen: 14 },
    script: (v) => [
      { do: 'sound', key: 'register' },
      { do: 'receipt', title: 'STRUK PELUNASAN', ms: 5200, next: 1900,
        lines: [[`Utang ronde ${v.round}`, `${v.pen} poin`], ['Bunga', 'harga diri'], ['Dibayar oleh', v.name], ['Diterima dari', v.bully]],
        total: ['STATUS', 'LUNAS'], foot: 'Simpan struk ini sebagai bukti.' },
      { do: 'sound', key: 'stamp' }, { do: 'stamp', text: 'LUNAS', ms: 1800 },
    ] });

  /* ======================= RARE ======================= */

  add({ id: 'ez-callback', mode: 'CALLBACK + PSYCHOLOGICAL DAMAGE', rarity: 'RARE', on: ['round:end'], chance: 0.95,
    when: (B) => { const e = B.evs('MEM_EZ_RESOLVED').find((x) => x.outcome === 'lost'); return e ? { name: e.name, seat: e.seat, text: e.text, secs: e.secs } : false; },
    demo: { name: 'Ana', seat: 0, text: 'EZ', secs: 21 },
    script: (v) => [
      { do: 'freeze', ms: 8400 }, { do: 'silence', ms: 8400 }, { do: 'sound', key: 'tapeStop' }, { do: 'wait', ms: 1500 },
      { do: 'sound', key: 'notify' },
      { do: 'notify', app: 'Sistem', title: 'Pesan sebelumnya terdeteksi', body: `${v.name} · ${v.secs} detik yang lalu`, ms: 5400, next: 1500 },
      { do: 'bubble', seat: v.seat, text: v.text, ms: 3600, next: 2000 },
      { do: 'caption', text: 'Menarik.', size: 'm', ms: 1900, next: 2100 },
    ] });

  add({ id: 'wanted-poster', mode: 'BOUNTY', rarity: 'RARE', on: ['round:end'], chance: 0.9,
    when: (B) => { const e = B.ev('MEM_BOUNTY_POSTED'); return e ? { name: e.name, streak: e.streak } : false; },
    demo: { name: 'Ana', streak: 3 },
    script: (v, B, h) => [
      { do: 'sound', key: 'stamp' },
      { do: 'poster', title: 'DICARI', name: v.name, sub: `${v.streak} kemenangan beruntun`, ms: 5000,
        reward: h.pick(['Hadiah: harga diri', 'Hadiah: hak buat ngomong "EZ"', 'Hadiah: ketenangan batin seluruh meja']), foot: 'Kalahkan untuk mengklaim.' },
    ] });

  add({ id: 'bounty-claimed', mode: 'BOUNTY', rarity: 'RARE', on: ['round:end'], chance: 0.9,
    when: (B) => { const e = B.ev('MEM_BOUNTY_CLAIMED'); return e ? { name: e.name, target: e.target, streak: e.streak } : false; },
    demo: { name: 'Cici', target: 'Ana', streak: 3 },
    script: (v, B, h) => [
      { do: 'sound', key: 'register' },
      { do: 'notify', app: 'Papan Bounty', title: `Bounty ${v.target} diklaim oleh ${v.name}`, ms: 5600,
        body: h.pick(['Hadiah: tidak ada. Tapi rasanya enak, kan.', `Streak ${v.streak} ronde resmi berakhir. Pemakaman sederhana akan diadakan.`]) },
    ] });

  add({ id: 'courage-chart', mode: 'FAKE ANALYTICS', rarity: 'RARE', on: ['round:end'], chance: 0.6, cooldownMs: 6 * MIN,
    when: (B) => {
      const lr = mem() && mem().lastRound(); if (!lr) return false;
      const i = lr.passes.indexOf(Math.max(...lr.passes));
      return lr.passes[i] >= 6 ? { name: lr.names[i], passes: lr.passes[i], round: lr.round } : false;
    },
    demo: { name: 'Dodi', passes: 7, round: 4 },
    script: (v, B, h) => [
      { do: 'sound', key: 'notify' },
      { do: 'chart', kind: 'flat', title: `Grafik keberanian ${v.name}`, sub: `Ronde ${v.round} · ${v.passes}× pass`, ms: 5200,
        note: h.pick(['Detak jantung strategi: tidak terdeteksi.', 'Garisnya memang begini. Bukan error.']) },
    ] });

  add({ id: 'escalation', mode: 'ABSURD ESCALATION', rarity: 'RARE', on: ['round:end'], chance: 0.85,
    when: (B) => {
      let p = null;
      losers(B.d).forEach((x) => { const s = mem() ? mem().streak(x.name).loss : 0; if (s >= 4 && (!p || s > p.streak)) p = { name: x.name, streak: s }; });
      return p || false;
    },
    demo: { name: 'Budi', streak: 6 },
    script: (v) => {
      if (v.streak === 4) return [{ do: 'sound', key: 'deflate' }, { do: 'caption', size: 'm', ms: 2800, text: `Kalah 4× beruntun. Ini udah bukan kalah, ${v.name}. Ini gaya hidup.` }];
      if (v.streak === 5) return [{ do: 'sound', key: 'notify' }, { do: 'effect', name: 'shake' },
        { do: 'notify', app: 'BMKG', title: 'Peringatan dini', ms: 5600, body: `Potensi kekalahan lanjutan untuk ${v.name} di wilayah meja ini. Warga diimbau tetap tenang.` }];
      if (v.streak === 6) return [{ do: 'sound', key: 'gavel' }, { do: 'banner', text: v.name, ms: 1800 },
        { do: 'sound', key: 'stamp' }, { do: 'stamp', text: 'WARISAN DUNIA', ms: 1800 },
        { do: 'caption', size: 's', ms: 2600, text: `Kalah 6× beruntun. Resmi diakui UNESCO sebagai warisan kekalahan dunia.` }];
      return [{ do: 'sound', key: 'error' }, { do: 'error', title: 'KEKALAHAN_TIDAK_TERBATAS', block: true, ms: 5200,
        body: `${v.name} kalah ${v.streak}× berturut-turut. Sistem tidak dirancang untuk angka ini.`, bars: [['Menghitung ulang peluang', 100], ['Mencari harapan', 0]] }];
    } });

  add({ id: 'mental-battery', mode: 'UNEXPECTED INTERRUPTION', rarity: 'RARE', on: ['play'], chance: 0.15, cooldownMs: 3 * MIN,
    when: (B) => {
      if (!(B.d.size === 5 && B.d.cat >= 2) || !B.d.counts) return false;
      let v = null; B.d.counts.forEach((c, i) => { if (i !== B.d.seat && (!v || c > v.c)) v = { c, i }; });
      return v ? { victim: B.names[v.i], by: B.d.name, combo: B.d.combo } : false;
    },
    demo: { victim: 'Dodi', by: 'Ana', combo: 'Flush' },
    script: (v, B, h) => [
      { do: 'sound', key: 'notify' },
      { do: 'notify', app: 'Baterai', title: `Baterai mental ${v.victim}: 3%`, ms: 4600,
        body: h.pick(['Sambungkan ke charger atau menyerah.', `Penyebab utama: ${v.combo} dari ${v.by}.`]) },
    ] });

  add({ id: 'slow-replay', mode: 'PSYCHOLOGICAL DAMAGE', rarity: 'RARE', on: ['round:end'], chance: 0.5, cooldownMs: 5 * MIN,
    when: (B) => { const e = B.evs('BAD_BEAT').find((x) => x.cardsLeft === 1); return e && B.d.final && B.d.final.cards ? { victim: e.name, cards: B.d.final.cards, winner: B.d.names[B.d.winner] } : false; },
    demo: { victim: 'Budi', cards: [32, 33, 34, 0, 1], winner: 'Ana' },
    script: (v, B, h) => [
      { do: 'sound', key: 'whoosh' },
      { do: 'replay', cards: v.cards, block: true, ms: 4800,
        caption: h.pick(['Kita lihat sekali lagi. Pelan-pelan.', `Dari sudut ${v.victim}. Satu kartu lagi. Satu.`, 'Sekali lagi, buat yang di belakang.']) },
    ] });

  add({ id: 'buried-bomb', mode: 'ROAST', rarity: 'RARE', on: ['round:end'], chance: 0.7,
    when: (B) => { const p = losers(B.d).find((x) => mem() && mem().hasQuad(x.hand)); return p ? { name: p.name } : false; },
    demo: { name: 'Cici' },
    script: (v, B, h) => [
      { do: 'sound', key: 'deflate' },
      { do: 'card', tone: 'spicy', mascot: 'shock', title: 'Ditemukan bom yang belum meledak', ms: 4800,
        text: h.pick([`${v.name} meninggal dengan bom di saku. Pemakaman tertutup.`, `${v.name} punya Four of a Kind dan memilih jalan damai. Bomnya sekarang jadi barang bukti.`]) },
    ] });

  /* ======================= LEGENDARY ======================= */

  add({ id: 'exe-crash', mode: 'RARE CHAOS EVENT', rarity: 'LEGENDARY', on: ['play'], oncePerMatch: true,
    when: (B) => (B.d.cat === 5 || (B.d.cat === 4 && mem() && mem().match().bombs === 3) ? { name: B.d.name } : false),
    demo: { name: 'Ana' },
    script: (v) => [
      { do: 'rarity', level: 'LEGENDARY' }, { do: 'sound', key: 'glitch' }, { do: 'effect', name: 'glitch' }, { do: 'wait', ms: 800 },
      { do: 'sound', key: 'error' },
      { do: 'error', title: 'CAPSA.EXE berhenti merespons', body: `Penyebab: ${v.name} terlalu berlebihan.`, block: true, ms: 6000,
        bars: [['Mengumpulkan data kerusakan', 100], ['Mengumpulkan sisa harga diri lawan', 0]] },
    ] });

  add({ id: 'sealed-13', mode: 'RARE CHAOS EVENT', rarity: 'LEGENDARY', on: ['round:end'], cooldownMs: 10 * MIN,
    when: (B) => { const p = losers(B.d).find((x) => x.left === 13); return p ? { name: p.name } : false; },
    demo: { name: 'Dodi' },
    script: (v) => [
      { do: 'rarity', level: 'LEGENDARY' }, { do: 'sound', key: 'register' },
      { do: 'receipt', title: 'MARKETPLACE', ms: 6200, foot: 'COD area meja ini. Serius nanya aja.',
        lines: [['Dijual', '13 kartu remi'], ['Kondisi', 'segel, belum pernah dipakai'], ['Pemilik', v.name], ['Alasan dijual', 'tidak sempat main'], ['Harga', 'nego']],
        total: ['STATUS', 'TERSEDIA'] },
    ] });

  add({ id: 'courtroom', mode: 'FAKE SERIOUSNESS + ABSURD ESCALATION', rarity: 'LEGENDARY', on: ['round:end'], oncePerMatch: true,
    when: (B) => { const e = B.ev('UPSET_WIN'); return e && e.gap >= 20 ? { name: e.name, gap: e.gap } : false; },
    demo: { name: 'Dodi', gap: 24 },
    script: (v) => [
      { do: 'rarity', level: 'LEGENDARY' }, { do: 'freeze', ms: 9800 }, { do: 'sound', key: 'gavel' },
      { do: 'banner', text: 'SIDANG DIBUKA', ms: 2200 },
      { do: 'caption', text: 'Terdakwa: klasemen.', size: 'm', ms: 1700 },
      { do: 'caption', text: `Dakwaan: ketinggalan ${v.gap} poin, tidak berlaku lagi.`, size: 'm', ms: 2000 },
      { do: 'sound', key: 'gavel' }, { do: 'stamp', text: 'PUTUSAN', ms: 1400 },
      { do: 'caption', text: `${v.name} dinyatakan tidak sengaja jenius.`, size: 'l', ms: 2600 },
    ] });

  add({ id: 'nothing-happens', mode: 'ANTI-CLIMAX', rarity: 'LEGENDARY', on: ['round:end'], chance: 0.01, oncePerMatch: true,
    when: () => true, demo: {},
    script: () => [
      { do: 'rarity', level: 'LEGENDARY' }, { do: 'sound', key: 'drumroll' },
      { do: 'banner', text: 'EVENT LANGKA TERDETEKSI', ms: 2300 }, { do: 'wait', ms: 1400 },
      { do: 'caption', text: 'tidak ada yang terjadi.', size: 's', ms: 1700 }, { do: 'wait', ms: 500 },
      { do: 'caption', text: 'sangat langka.', size: 's', ms: 1800 },
    ] });
})();

# Capsa Banting

Capsa Banting (Big Two) buat 2–4 orang. Bisa gantian di satu device, atau **mabar online dari HP masing-masing**. Bisa di-install di HP kayak app.

Link main: **https://nayahita.github.io/capsagabut/**

## Pasang di GitHub Pages (sekali aja)

1. Repo harus **public** (Settings → General → Danger Zone → Change visibility), karena GitHub Pages gratis cuma jalan buat repo public.
2. Settings → Pages → Build and deployment → **Deploy from a branch** → `main` / `/ (root)` → Save.
3. Tunggu 1–2 menit, terus buka link di atas.

## Install di HP

- **Android (Chrome):** buka link → menu ⋮ → **Install app** / **Add to Home screen**.
- **iPhone (Safari):** buka link → tombol Share → **Add to Home Screen**.

Nanti muncul ikon Capsa di layar HP. Dibukanya full screen tanpa address bar. Mode satu device tetap bisa dimainin walau offline, asal game-nya udah pernah dibuka sekali pas ada internet.

## Cara main: satu device

1. Pilih **Satu device**, jumlah pemain (2–4), isi nama sesuai urutan duduk, terus klik **Kocok & bagi kartu**.
2. Tiap ganti giliran, kartu ketutup dan muncul layar **Oper ke …**. Pemain berikutnya klik **Buka kartu**.
3. Klik kartu buat milih, terus klik **Buang** (atau tekan Enter), atau klik **Pass**.

## Cara main: mabar online

1. Semua orang buka link game dan pilih **Mabar online**, terus isi nama.
2. Satu orang (host) klik **Bikin room**, nanti dapet kode 4 huruf. Kirim kodenya, atau klik **Salin link** terus tempel di grup.
3. Yang lain masukin kode terus klik **Gabung** (atau langsung buka link dari host).
4. Host klik **Mulai main** kalau udah ada 2–4 orang.

Kartu lu cuma kelihatan di HP lu. Emote, efek combo, dan suara muncul di semua HP. Aturan room (mode, timer, aturan bom) ikut pengaturan host pas bikin room.

**Pamer kartu:** di mode online ada tombol **Pamer kartu** di samping kartu lu, cara kerjanya kayak tombol scope di game tembak-tembakan HP:
- **Tap** (sentuh sebentar) → kartu lu kebuka terus di layar semua orang, sampai lu tap lagi (tombolnya jadi **Tutup kartu**).
- **Tahan** → kebuka selama lu tahan, lepas = ketutup.
- Gak ada jeda/cooldown. Kalau kartu lu berubah (abis buang), yang kebuka ikut ke-update. Kalau HP lu putus, kartu lu otomatis hilang dari layar orang lain dalam ±7 detik.

Sistem nyatet siapa yang pamer (sekali per ronde), jadi kalau abis pamer malah kalah, itu bakal diinget.

**Room = geng lu.** Pas host klik **Tutup room**, room-nya gak dihapus, cuma ditutup. Catatan pertandingan (profil pemain, rivalitas, momen, favorit sistem) tetap disimpan di room itu selama **setahun sejak terakhir dibuka**. Minggu depan, siapa pun tinggal masukin kode yang sama, room kebuka lagi dan dia jadi host. Bikin room baru = mulai dari nol.

Catatan teknis:
- Data room disimpan di Firebase Realtime Database (project `capsuy`). HP host jadi wasit: dia yang bagi kartu, ngecek kartu yang dibuang, dan ngatur timer.
- Kalau ada pemain yang offline pas gilirannya, setelah 8 detik dia otomatis Pass. Kalau dia lagi buka meja, otomatis buang kartu terkecil.
- Kalau host offline, game berhenti dulu sampai host balik. Refresh halaman lalu klik **Balik ke room** buat nyambung lagi.
- Mode online gak jalan di preview Claude karena koneksi ke server luar diblok di sana. Pakai link GitHub Pages.
- Catatan room ada di `rooms/KODE/lore` dan cuma ditulis sama HP host. Gak perlu ubah Rules Firebase. Opsional: tambahin `".indexOn": ["meta/lastOpen"]` di level `rooms` biar pembersihan room yang udah setahun gak dibuka tetap ringan pas room-nya udah banyak.
- Kartu tiap pemain tersimpan di database room. Orang yang ngerti teknis bisa ngintip lewat developer tools, jadi mainnya sama temen yang bisa dipercaya ya.

## Profil pemain

Tiap nama dihubungin ke profil, jadi sistem kenal orangnya walaupun ganti HP atau ganti tulisan nama.
- Nama yang udah dikenal langsung nyambung. Di layar awal muncul tulisan kecil **dikenali · N match**.
- Kalau namanya mirip profil lama (misal "Budii"), muncul pertanyaan **Ini Budi?** [Ya, gabungkan] [Orang baru]. Di mode online pertanyaan ini muncul di lobby.
- Dua pemain gak bisa pakai nama yang sama di satu meja.
- Profil baru baru disimpan setelah ronde pertama selesai, jadi salah ketik gak jadi profil sampah.
- **Statistik → Profil pemain:** ganti nama, gabungkan dua profil, atau hapus catatan seseorang. Di room online cuma host yang bisa ngubah.
- Main di satu device: catatannya disimpan di device itu. Mabar online: disimpan di room.
- Momen memalukan cuma boleh dibahas sistem sampai **24 jam**. Lewat itu cuma jadi angka (gelar, statistik).

## Fitur bantuan

- **Timer per giliran:** default 30 detik (bisa diganti 15, 60, atau dimatiin di layar awal). Timer mulai pas kartu dibuka. Kalau waktu habis, pemain otomatis Pass. Kalau dia lagi buka meja, otomatis buang kartu terkecil.
- **Cepat pilih:** tombol di bawah kartu yang nampilin semua kombinasi yang bisa dibuang sekarang (Pair, Straight, Full House, dan lain-lain), plus jumlah pilihannya. Klik sekali buat milih kombinasi paling kecil, klik lagi buat ganti ke yang lebih gede, terus klik **Buang**.

## Comedy Director

Game ini punya "sutradara komedi" yang nonton pertandingan, nyimpen kejadian penting, dan sesekali mutusin buat ganggu mental pemain. Defaultnya **diam**: kebanyakan kejadian gak dapet reaksi. Kalau muncul, reaksinya selalu nyambung sama konteks (siapa, kartu apa, ronde berapa, udah berapa kali kejadian), dan kadang balik lagi ke kejadian ronde-ronde sebelumnya.

Contoh:
- Ngetik **EZ**, terus kalah sisa 10 kartu: sistem diem total 4,5 detik. Gak ada tulisan apa-apa. Momen itu masuk laporan pertandingan.
- Trash talk yang kalah bisa "disimpen" dulu. Beberapa ronde kemudian, pas orang lain menang: layar gelap, mic kosong, "Mic dibuka untuk Ana." … "Mic ditutup."
- Kalah di kartu terakhir: gak ada reaksi. Ronde berikutnya, di tengah permainan, muncul toast **Kenangan** kayak di galeri HP, lengkap sama kartunya.
- Sistem punya **favorit** (yang paling jelek abis ronde 1). Kombo dia dapet stempel "✓ disetujui", yang lain enggak. Kalau favoritnya kalah 3x, sistem pindah dukungan.
- Pass terus padahal bisa jalan: label pass berubah jadi "pass (lagi)" → "pass (kebiasaan)" → "pass (prinsip hidup)".
- Langka: catatan pembaruan di ronde 10 yang isinya kejadian match ini, "Sistem" ikut duduk di meja terus keluar lagi, atau skor juru kunci tiba-tiba jadi juara satu… "Maaf. Itu harapan, bukan data."

Fitur pendukung:
- **Chat** (tombol Chat di atas): ketik bebas (60 huruf) atau **Colek** satu pemain (`@nama`, ada garis ke kursinya). Ada riwayat chat, jeda 3 detik per pesan, dan sensor kata kasar (default nyala, bisa dimatiin di tiap HP). Kata kunci dan kata yang disensor ada di atas `src/chat.js`. Kalimat siap pakai sekarang ada di **Quick chat** (lihat Emote & quick chat).
- **Gelar reputasi** di kursi pemain, misalnya "Spesialis Nyaris" atau "Kolektor Kartu 2". Kesimpen di device.
- Tombol **Laporan pertandingan** di layar hasil ronde (mulai ronde 2), dan **kredit akhir** kalau keluar dari match 8+ ronde.
- **Statistik → Tes komedi**: preview tiap bit.

Desain lengkap (arsitektur, aturan peluang & budget, daftar bit, chat, cara nambah bit) ada di **[`docs/COMEDY_DIRECTOR.md`](docs/COMEDY_DIRECTOR.md)**. Pengaturan ada di `src/comedy/config.js`, bit-nya di `src/comedy/bits.js`, dan suaranya (original, bisa diganti) di `audio/comedy/`. Di mode online, cuma HP host yang mutusin, terus semua HP muterin reaksi yang sama persis.

## Event & reaksi

> Kartu judgement versi lama sekarang dimatiin, karena perannya udah digantiin Comedy Director (`replaceReactionCards` di `src/comedy/config.js`). Statistik dari sistem ini tetap jalan.

Pas ronde selesai, game nyari kejadian seru terus nampilin **kartu judgement** di atas layar: roast, baris statistik, suara, dan efek. Di mode online, kartunya muncul di semua HP.

| Event | Kapan kejadian |
|---|---|
| `PLAYER_WIN` | Pemain menang ronde |
| `PLAYER_LOSE` | Pemain kalah (kartunya cuma muncul kalau sisa kartunya ≥ 6) |
| `BAD_BEAT` | Pemain kalah padahal sisa kartunya tinggal ≤ 2 |
| `BIG_COMEBACK` | Pemenang sempet ketinggalan ≥ 5 kartu dari yang paling sedikit |
| `WIN_STREAK` | Menang ≥ 3 ronde berturut-turut |
| `LOSS_STREAK` | Kalah ≥ 4 ronde berturut-turut |
| `UPSET_WIN` | Pemenang lagi paling bontot di klasemen, ketinggalan ≥ 10 poin dari yang teratas (min. 3 pemain, mulai ronde 2) |
| `PERFECT_WIN` | Menang tanpa pass sekali pun di ronde itu |
| `REVENGE_WIN` | Yang paling parah kalahnya di ronde lalu, ronde ini ngalahin pemenang ronde lalu |

Angka-angka batasnya ada di bagian atas `src/events.js` (`badBeatMaxCards`, `comebackDeficit`, dan seterusnya).

### Struktur file

```
index.html                 mesin game. Cuma ngirim fakta: game:start, round:start, play, pass, round:end
src/events.js              event bus + detektor: fakta → PLAYER_WIN, BAD_BEAT, dst.
src/stats.js               statistik pemain, kesimpen di device (tombol "Statistik" di atas)
src/reactions.js           mesin reaksi: prioritas, cooldown, antrean, kartu, efek, audio
src/reactions.config.js    ← yang perlu diedit: teks roast, suara, efek, prioritas, cooldown
audio/                     suara reaksi (original, aman). Lihat audio/README.md buat ganti
```

Mesin game gak tahu apa-apa soal event atau reaksi. Jadi nambah, ngubah, atau ngapus reaksi gak perlu nyentuh `index.html`.

### Biar gak spam

Kalau banyak event kejadian barengan:
1. Event yang masuk dalam 350 ms dinilai bareng.
2. Kalau satu event kena beberapa pemain sekaligus, yang ditampilin satu aja (diatur `pickBy`, misalnya yang minus-nya paling gede).
3. Event yang masih kena `cooldownMs` dilewatin, kecuali prioritasnya ≥ 90.
4. Satu kartu per `group` (`winner` dan `loser`). Event lain di grup yang sama buat pemain yang sama jadi tag kecil di kartu itu, misalnya "Comeback! + Perfect! + Ana menang".
5. Maksimal 2 kartu per kejadian, tampil gantian, dan antrean maksimal 4 kartu.

Statistik tetap dihitung walaupun kartunya gak muncul.

### Nambah event baru

Di file baru (misalnya `src/my-events.js`, terus tambahin `<script src="src/my-events.js"></script>` setelah `src/reactions.js` di `index.html`), atau langsung di `src/reactions.config.js`:

```js
// 1. Detektor: kapan event-nya kejadian
CapsaEvents.defineDetector('round:end', (d, ctx, emit) => {
  const lawanSemuaBanyak = d.counts.every((c, i) => i === d.winner || c >= 8);
  if (lawanSemuaBanyak) emit('BLOWOUT', { seat: d.winner });
});

// 2. Reaksinya
CAPSA_REACTIONS.events.BLOWOUT = {
  priority: 85, group: 'winner', tone: 'spicy', mascot: 'laugh', sound: 'win', effect: ['shake', 'confetti'],
  title: 'Bantai!',
  texts: ['{name} ngebantai meja. Semua lawan masih pegang ≥ 8 kartu.'],
};
```

Data yang dikirim mesin game:
- `round:end` → `{ round, winner, how, names, counts, penalties, scoresBefore, scoresAfter }`
- `play` → `{ seat, name, combo, cat, size, counts }`
- `pass` → `{ seat, name, timeout }`

Buat ngetes tampilan reaksi, buka **Statistik**, terus klik tombol di baris **Tes reaksi**.

## Mode & aturan rumah

Semua bisa dinyalain/dimatiin di layar awal.

- **Mayhem:** tiap pemain dapet bom (Four of a Kind atau Straight Flush), Full House, dan kartu-kartu tinggi. Siapa cepat dia menang.
- **Bom langsung menang** (default nyala): yang berhasil buang Four of a Kind atau Straight Flush langsung menang ronde.
- **Auto-skip** (default nyala): kalau kartu yang lu buang gak bisa dilawan siapa pun, giliran langsung balik ke lu dan lu bebas buka lagi.
- **Bom bisa makan 2** (default mati): Four of a Kind atau Straight Flush boleh dibuang buat makan kartu 2 satuan.

## Emote & quick chat

Tombol maskot (di kursi lu, atau tombol 😏 di samping kartu lu) buka panel kecil di atas kartu:
- **★ Favorit**: 4 emote + 4 kalimat yang paling sering lu pakai. Dua tap: buka, kirim. Panel nutup sendiri abis ngirim.
- **Emote** (14): Ketawa, Nangis, Marah, Mantap, Kaget, Santai, Senyum licik, Tepok jidat, Wafat, Datar, Hormat, Keringetan, Tepuk pelan, Penjahat.
- **Quick chat** per kategori: **Respek** (GG, Main bagus…), **Ejek** (EZ, Gitu doang?, Skill issue…), **Pede** (Liat aja, Belum selesai…), **Reaksi** (HAH?!, Kok bisa?!, Mati gua 💀…), **Bacot** (Jangan senang dulu, Waduh bro…).
- **Ke**: kirim ke semua atau @satu pemain (kursinya goyang).
- Yang ada 🔊 punya voice line. Rekamannya belum ada (lu isi sendiri di `audio/voice/`, lihat README di sana); sementara bunyinya "babble" sintetis pendek.
- **⚙**: voice line nyala/mati, volume voice, sembunyiin emote & chat orang lain, dan **bisukan pemain tertentu**. Semua cuma berlaku di HP lu. Suara game secara umum tetap di tombol **Suara**.

Muncul sebagai gelembung/maskot di bawah kursi pengirim, di semua HP, hilang sendiri dalam 2–3 detik, satu per pemain (yang baru gantiin yang lama). Jeda: emote 1,5 detik, quick chat 1,5 detik (terpisah), voice line ±5 detik per pemain, dan cuma satu voice line bunyi sekaligus. Ngirim hal yang sama berulang-ulang = tampil kecil, tanpa suara. Di mode 1 device, tombol maskot di kursi milih siapa yang "ngomong".

Semua yang lu kirim dicatat (cuma selama match) dan masuk ke memory komedi: "EZ" terus kalah, atau emote ngejek terus kalah banyak, bisa dibales sama sistem. Isi, jeda, dan voice line ada di **`src/social/catalog.js`**; detail arsitektur & keamanan di **[`docs/SOCIAL_SYSTEM.md`](docs/SOCIAL_SYSTEM.md)**.

Emote juga muncul otomatis:
- Straight → yang buang pasang muka santai
- Flush → jempol
- Full House → ketawa
- Bom → yang buang ketawa, yang lain kaget
- Auto-skip → salah satu lawan marah
- Waktu habis → nangis
- Akhir ronde → pemenang ketawa, yang kalah nangis

## Efek combo

- **Triple:** banner + percikan
- **Straight:** 5 kartu melesat masuk + garis kecepatan + whoosh
- **Flush:** hujan simbol bunga + gelombang + kilauan
- **Full House:** rumah jatuh mantul + confetti + fanfare
- **Four of a Kind:** bom terbang dari kursi pemain, sumbu nyala, terus meledak (kilat, layar goyang, asap, gelombang kejut)
- **Straight Flush:** ledakan bom + hujan simbol bunga + paduan suara
- **Kartu 2 satuan:** bunyi "ting" + kilau

## Paket suara

Default-nya **Klasik**. Bisa diganti di layar awal (bagian **Paket suara**, ada tombol tes juga) atau lewat tombol **Suara** di pojok atas: **Klasik → Rame → Mati**.

- **Klasik:** suara meja yang kalem: kartu, pass, combo, bom, dan nada pendek pas ronde selesai. Gak ada suara "kalah".
- **Rame:** kartu lebih rame (pop, lonceng, boing, peluit seluncur). Sejak v12 paket ini **gak lagi** muter airhorn, terompet sedih, jangkrik, atau "ba dum tss" tiap menang, kalah, timeout, atau full house. Suara-suara kayak gitu bikin suara komedi kehilangan artinya.
- Pas giliran lu (mode online), HP lu bunyi "ting-ting" pelan. Tik-tok 5 detik terakhir cuma bunyi di HP yang lagi giliran, dan gak pernah ikut dibungkam waktu sistem lagi "hening".
- Emote pas akhir ronde cuma muncul gambarnya, tanpa suara. Suara emote cuma bunyi kalau pemain sendiri yang ngirim.
- Suara komedi diatur `src/audio/director.js`: satu suara komedi dalam satu waktu, suara yang sama gak diulang terlalu cepat (kalau dipaksa, turun jadi suara yang lebih kecil atau diam), dan di mode online semua HP mulai barengan.
- **Main di satu tempat** (pilihan pas bikin room): suara meja dan komedi cuma keluar dari HP host biar gak gema dari 4 HP. Suara giliran tetap di HP masing-masing.

Suara meja dibikin langsung di browser pakai Web Audio; suara komedi pakai file original di `audio/comedy/` yang bisa lu ganti sendiri. Kalau di setelan perangkat lu nyalain "kurangi gerakan", efek gerak dimatiin dan cuma tulisan yang muncul.

## Aturan

- Urutan angka: 3 paling kecil, terus naik sampai K, A, dan **2 paling gede**.
- Urutan bunga: ♦ wajik < ♣ keriting < ♥ hati < ♠ sekop.
- Tiap orang dapet 13 kartu. Kalau main 2–3 orang, sisa kartu gak dipakai.
- Ronde pertama dimulai sama yang pegang kartu terkecil (biasanya 3♦), dan kartu itu wajib dibuang di jalan pertama. Ronde berikutnya dimulai sama yang habis duluan di ronde sebelumnya.
- Kombinasi yang sah: Satuan, Pair, Triple (bisa dimatiin), dan 5 kartu.
- Urutan kombinasi 5 kartu: Straight < Flush < Full House < Four of a Kind (+1) < Straight Flush.
- Straight pakai urutan biasa. A-2-3-4-5 paling kecil, 10-J-Q-K-A paling gede, dan J-Q-K-A-2 gak sah.
- Pass gak bikin lu keluar. Kalau semua pemain lain pass, yang terakhir buang bebas buka kombinasi baru.
- Aturan bom (opsional): Four of a Kind atau Straight Flush bisa makan kartu 2 satuan.

## Main sampai satu kalah (default)

- Yang habis kartunya duluan **aman** (juara 1, 2, 3…), terus ronde **lanjut**. Sisanya tetap lawan-lawanan sampai tinggal satu orang yang masih pegang kartu. Orang itu **kalah**.
- Kalau yang buang kartu terakhir udah habis dan semua pass, giliran bebas jalan pindah ke pemain berikutnya yang masih main.
- Bom (kalau "Bom langsung menang" nyala): yang buang bom langsung selesai, sisanya lanjut.
- **Klasemen ngitung jumlah kalah.** Makin kecil makin jago. Gak ada poin plus-minus.
- Main 2 orang: begitu satu habis, yang satunya langsung kalah.
- Bisa dimatiin di layar awal (**Main sampai satu kalah**). Kalau mati, balik ke aturan lama di bawah.

## Poin (aturan lama)

- Yang duluan habis kartunya menang ronde.
- Yang kalah dapet minus sebanyak sisa kartunya. Sisa 10–12 kartu dikali 2, sisa 13 kartu dikali 3.
- Pemenang dapet total minus dari semua yang kalah.

## Tes

- `bash tests/run.sh` jalanin semua tes unit (Node): aturan komedi, memory, profil & catatan room, mode satu kalah, bit v2, audio director, sistem sosial (validasi, jeda, voice, mute, riwayat), plus simulasi frekuensi komedi.
- `bash tests/run.sh --sim` nambahin simulasi browser (Python + Playwright + Chromium): 3 ronde offline, mabar 3 HP, room ditutup lalu dibuka lagi, pamer kartu (tahan / tap / putus koneksi), dan emote & quick chat (`tests/sim/social.py`). Firebase-nya palsu (`tests/sim/fakefb.js`), jadi gak nyentuh database beneran.

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

Catatan teknis:
- Data room disimpan di Firebase Realtime Database (project `capsuy`). HP host jadi wasit: dia yang bagi kartu, ngecek kartu yang dibuang, dan ngatur timer.
- Kalau ada pemain yang offline pas gilirannya, setelah 8 detik dia otomatis Pass. Kalau dia lagi buka meja, otomatis buang kartu terkecil.
- Kalau host offline, game berhenti dulu sampai host balik. Refresh halaman lalu klik **Balik ke room** buat nyambung lagi.
- Mode online gak jalan di preview Claude karena koneksi ke server luar diblok di sana. Pakai link GitHub Pages.
- Kartu tiap pemain tersimpan di database room. Orang yang ngerti teknis bisa ngintip lewat developer tools, jadi mainnya sama temen yang bisa dipercaya ya.

## Fitur bantuan

- **Timer per giliran:** default 30 detik (bisa diganti 15, 60, atau dimatiin di layar awal). Timer mulai pas kartu dibuka. Kalau waktu habis, pemain otomatis Pass. Kalau dia lagi buka meja, otomatis buang kartu terkecil.
- **Cepat pilih:** tombol di bawah kartu yang nampilin semua kombinasi yang bisa dibuang sekarang (Pair, Straight, Full House, dan lain-lain), plus jumlah pilihannya. Klik sekali buat milih kombinasi paling kecil, klik lagi buat ganti ke yang lebih gede, terus klik **Buang**.

## Comedy Director

Game ini punya "sutradara komedi" yang nonton pertandingan, nyimpen kejadian penting, dan sesekali mutusin buat ganggu mental pemain. Defaultnya **diam**: kebanyakan kejadian gak dapet reaksi. Kalau muncul, reaksinya selalu nyambung sama konteks (siapa, kartu apa, ronde berapa, udah berapa kali kejadian), dan kadang balik lagi ke kejadian ronde-ronde sebelumnya.

Contoh:
- Ngetik **EZ** di chat, terus kalah: layar ke-freeze, sunyi, muncul notif sistem "Pesan sebelumnya terdeteksi", bubble "EZ" nongol lagi, jeda, terus "Menarik."
- Kalah di kartu terakhir → "Menarik." Beberapa ronde kemudian tinggal 1 kartu lagi → "Not this again." Kalau menang → "Character development." Kalau kalah lagi → "We have learned nothing."
- Menang 3x beruntun → poster **DICARI** (bounty). Siapa pun yang ngalahin dia dapet notif "Bounty diklaim".
- Bales dendam ke yang dulu ngebantai lu → struk pelunasan dengan stempel **LUNAS**.
- Kejadian langka: layar error `CAPSA.EXE berhenti merespons`, sidang di pengadilan, atau 13 kartu yang dijual di marketplace karena "masih segel".

Fitur pendukung:
- **Chat cepat** (tombol Chat di atas): preset trash talk yang diingat sistem.
- **Gelar reputasi** di kursi pemain, misalnya "Spesialis Nyaris" atau "Kolektor Kartu 2". Kesimpen di device.
- Tombol **Laporan pertandingan** di layar hasil ronde (mulai ronde 2): roast summary satu match.
- **Statistik → Tes komedi**: preview tiap bit.

Desain lengkap (arsitektur, data konteks, aturan rarity/peluang, 32 bit, cara nambah bit) ada di **[`docs/COMEDY_DIRECTOR.md`](docs/COMEDY_DIRECTOR.md)**. Pengaturan ada di `src/comedy/config.js`, bit-nya di `src/comedy/bits.js`, dan suaranya (original, bisa diganti) di `audio/comedy/`. Di mode online, cuma HP host yang mutusin, terus semua HP muterin reaksi yang sama persis.

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

## Emote

Tiap kursi pemain punya tombol maskot kecil. Klik buat milih emote: **Ketawa, Nangis, Marah, Mantap, Kaget, Santai**. Maskotnya (kartu remi hidup) muncul di bawah kursi pemain itu, lengkap sama suaranya. Ada jeda 1,5 detik per pemain biar gak dispam.

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

Default-nya **Meme**. Bisa diganti di layar awal (bagian **Paket suara**, ada tombol tes juga) atau lewat tombol **Suara** di pojok atas, yang muter **Klasik → Meme → Mati**.

| Event | Suara meme |
|---|---|
| Buang kartu / Pair | pop kartun |
| Pass | buzzer salah |
| Kartu 2 satuan | lonceng |
| Timer 5 detik terakhir | tik-tok balok kayu |
| Bom / Straight Flush | sumbu + dentuman bass gede + airhorn |
| Full House | airhorn |
| Straight | whoosh + peluit seluncur |
| Flush | scratch piringan hitam + kilauan |
| Triple | boing |
| Auto-skip | ba dum tss |
| Waktu habis | jangkrik |
| Menang | airhorn + fanfare |
| Emote Ketawa / Nangis / Marah | klakson sepeda / terompet sedih / klang pipa besi |
| Emote Kaget / Mantap / Santai | dentuman bass / peluit naik / scratch |

Semua suara (Klasik dan Meme) dibikin langsung di browser pakai Web Audio. Gak ada file audio, jadi aman dari masalah hak cipta. Kalau di setelan perangkat lu nyalain "kurangi gerakan", efek gerak dimatiin dan cuma tulisan yang muncul.

## Aturan

- Urutan angka: 3 paling kecil, terus naik sampai K, A, dan **2 paling gede**.
- Urutan bunga: ♦ wajik < ♣ keriting < ♥ hati < ♠ sekop.
- Tiap orang dapet 13 kartu. Kalau main 2–3 orang, sisa kartu gak dipakai.
- Ronde pertama dimulai sama yang pegang kartu terkecil (biasanya 3♦), dan kartu itu wajib dibuang di jalan pertama. Ronde berikutnya dimulai sama pemenang ronde sebelumnya.
- Kombinasi yang sah: Satuan, Pair, Triple (bisa dimatiin), dan 5 kartu.
- Urutan kombinasi 5 kartu: Straight < Flush < Full House < Four of a Kind (+1) < Straight Flush.
- Straight pakai urutan biasa. A-2-3-4-5 paling kecil, 10-J-Q-K-A paling gede, dan J-Q-K-A-2 gak sah.
- Pass gak bikin lu keluar. Kalau semua pemain lain pass, yang terakhir buang bebas buka kombinasi baru.
- Aturan bom (opsional): Four of a Kind atau Straight Flush bisa makan kartu 2 satuan.

## Poin

- Yang duluan habis kartunya menang ronde.
- Yang kalah dapet minus sebanyak sisa kartunya. Sisa 10–12 kartu dikali 2, sisa 13 kartu dikali 3.
- Pemenang dapet total minus dari semua yang kalah.

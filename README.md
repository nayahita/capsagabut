# Capsa Banting

Capsa Banting (Big Two) buat 2–4 orang, gantian main di satu laptop. Cuma satu file HTML, gak perlu install apa-apa.

## Cara buka

- **Lokal:** download `index.html`, terus buka di browser.
- **Online:** nyalain GitHub Pages (Settings → Pages → Deploy from branch → `main` / root). Game bisa dibuka di `https://nayahita.github.io/capsagabut/`.

## Cara main

1. Pilih jumlah pemain (2–4), isi nama sesuai urutan duduk, klik **Kocok & bagi kartu**.
2. Tiap ganti giliran, kartu ketutup dan muncul layar **Oper laptop ke …**. Pemain berikutnya klik **Buka kartu**.
3. Klik kartu buat milih, terus klik **Buang** (atau tekan Enter), atau klik **Pass**.

## Fitur bantuan

- **Timer per giliran:** default 30 detik (bisa diganti 15, 60, atau dimatiin di layar awal). Timer mulai pas kartu dibuka. Kalau waktu habis, pemain otomatis Pass. Kalau dia lagi buka meja, otomatis buang kartu terkecil.
- **Cepat pilih:** tombol di bawah kartu yang nampilin semua kombinasi yang bisa dibuang sekarang (Pair, Straight, Full House, dan lain-lain), plus jumlah pilihannya. Klik sekali buat milih kombinasi paling kecil, klik lagi buat ganti ke yang lebih gede, terus klik **Buang**.

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

Tombol **Suara** di pojok atas muter tiga pilihan: **Klasik → Meme → Mati**.

Paket **Meme** ganti suara event jadi gaya meme:

| Event | Suara meme |
|---|---|
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

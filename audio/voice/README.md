# Voice lines (rekaman sendiri)

Folder ini sengaja kosong. Game tetap jalan tanpa file di sini: quick chat & emote tetap muncul, dan kalau file belum ada,
yang bunyi cuma "babble" sintetis pendek (dibuat di HP, bukan rekaman) sesuai karakter suaranya.

Pakai rekaman **original** (suara lu / temen lu) atau audio yang lisensinya jelas boleh dipakai.
Jangan ambil potongan suara dari film, game, YouTuber, TikTok, dll.

## Cara nambah / ganti

1. Rekam pendek, maksimal ~2,5 detik (lebih dari itu dipotong). Format `mp3`, `ogg`, atau `wav`, mono, volume dinormalisasi.
2. Simpan dengan nama file yang ada di `src/social/catalog.js` → bagian `VOICE`, misalnya `audio/voice/villain-liataja.mp3`.
3. Selesai. Kalau mau line baru: tambah entry di `VOICE`, lalu pasang `voice: '<id>'` di quick chat atau emote yang mau bersuara.
4. Kalau game dipasang sebagai aplikasi (PWA) dan mau voice line bisa offline, tambahkan path filenya ke daftar `CORE` di `sw.js`.

| id | file | karakter | naskah (English) | naskah (Indonesia) |
|---|---|---|---|---|
| stoic.gg | stoic-gg.mp3 | datar | "GG." | "GG." |
| stoic.respek | stoic-respek.mp3 | datar | "Respect." | "Respek." |
| stoic.yakin | stoic-yakin.mp3 | datar | "You sure?" | "Yakin?" |
| clown.ez | clown-ez.mp3 | badut | "Too easyyy~" | "Gampang banget~" |
| clown.ambulans | clown-ambulans.mp3 | badut | "Call an ambulance!" | "Panggil ambulans!" |
| villain.liataja | villain-liataja.mp3 | penjahat kalem | "Now… watch closely." | "Sekarang… perhatikan." |
| villain.gitudoang | villain-gitudoang.mp3 | penjahat kalem | "Is that all?" | "Cuma segitu?" |
| underdog.belum | underdog-belum.mp3 | underdog ngotot | "I'm not done yet!" | "Gua belum selesai!" |
| dramatic.kokbisa | dramatic-kokbisa.mp3 | lebay | "Hooow?!" | "Kok bisaaa?!" |
| dramatic.tidak | dramatic-tidak.mp3 | lebay | "Nooooo!" | "Tidaaak!" |

### Rekaman per bahasa

Game-nya dua bahasa (English default, Indonesia kedua), dan tiap HP pilih bahasanya sendiri. Satu rekaman cuma satu bahasa,
jadi `file` di `VOICE` boleh berupa pasangan:

```js
'stoic.respek': { file: { en: 'audio/voice/stoic-respek-en.mp3', id: 'audio/voice/stoic-respek.mp3' }, archetype: 'stoic', line: { en: 'Respect.', id: 'Respek.' } },
```

Tiap HP muter file sesuai bahasanya (dipilih pas line-nya bunyi). Kalau `file` cuma satu string, file itu dipakai di dua bahasa.

Aturan main di HP: satu voice line sekali bunyi, tiap pemain paling sering tiap ~4,5 detik, voice yang telat nyampe
(> 2,5 detik) nggak diputar, dan tiap orang bisa matiin voice atau bisukan pemain tertentu dari tab ⚙ di panel Emote.

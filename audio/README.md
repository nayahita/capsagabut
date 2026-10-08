# Audio reaksi

Semua file di folder ini suara original yang dibikin khusus buat game ini (disintesis pakai kode), jadi aman dipakai dan disebar.

## Ganti suara

Cara paling gampang: timpa file dengan nama yang sama. Misalnya, file kamu namanya `menang.mp3`, simpan dengan nama `win.wav`. Kalau mau tetap pakai nama aslinya, ubah path-nya di `src/reactions.config.js` bagian `sounds`:

```js
sounds: {
  win: 'audio/menang.mp3',
  ...
}
```

Format yang bisa dipakai: WAV, MP3, OGG, M4A. Usahain durasinya di bawah 2 detik dan ukurannya kecil (di bawah 200 KB), biar cepet ke-load di HP.

| File | Dipakai buat |
|---|---|
| `win.wav` | PLAYER_WIN |
| `lose.wav` | PLAYER_LOSE |
| `bad-beat.wav` | BAD_BEAT |
| `comeback.wav` | BIG_COMEBACK |
| `win-streak.wav` | WIN_STREAK |
| `loss-streak.wav` | LOSS_STREAK |
| `upset.wav` | UPSET_WIN |
| `perfect.wav` | PERFECT_WIN |
| `revenge.wav` | REVENGE_WIN |

Kalau file-nya gak ada atau gagal ke-load, reaksinya tetap muncul, cuma tanpa suara.

Soal hak cipta: suara meme yang beredar di internet (potongan film, game, lagu, video viral) biasanya punya orang lain, walaupun ada yang ngaku "free to use". Kalau repo ini public, pakai suara yang kamu rekam sendiri, bikin sendiri, atau yang lisensinya jelas (misalnya CC0).

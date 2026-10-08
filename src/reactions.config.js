/*
 * Reaction config. This is the file to edit.
 *
 * Each event name maps to one reaction:
 *   priority   0–100. When several events happen at once, higher wins. 90+ also ignores cooldowns.
 *   group      Events in the same group compete: only the highest priority one gets its own card,
 *              the rest show up as small tags on that card ("+ Win streak").
 *   cooldownMs Minimum time between two cards for this event.
 *   when       Optional (ev) => true/false. Return false to skip the card (stats are still counted).
 *   pickBy     If the event fires for several players at once, show the one with the biggest value
 *              of this field (for example 'penalty' roasts whoever lost the most). Prefix with '-'
 *              to pick the smallest instead ('-cardsLeft' = whoever was closest to winning).
 *   title      Card heading. texts: one is picked at random, never the same twice in a row.
 *   stat       Small stat line under the text.
 *   mascot     laugh | cry | angry | thumbs | shock | cool
 *   sound      A key from `sounds` below.
 *   effect     A name, or a list of names: confetti, fireworks, sparkle, shine, fire, gloom, crack, shake, flash
 *   tone       Card color: win | lose | spicy | legend
 *   track      Stats to update every time the event fires (even if no card shows):
 *              { inc: 'badBeats' } adds 1, { max: ['bestWinStreak', 'streak'] } keeps the record.
 *
 * Placeholders in title/texts/stat:
 *   {name} {winner} {target} {cards} {penalty} {streak} {deficit} {gap}
 *   and any stat: {wins} {losses} {rounds} {winRate} {points} {badBeats} {comebacks}
 *   {upsets} {perfects} {revenges} {bestWinStreak} {worstLossStreak} {bombWins}
 */
window.CAPSA_REACTIONS = {
  settings: {
    enabled: true,
    batchWindowMs: 350,         // events within this window are judged together
    maxPerBatch: 2,             // at most this many cards per batch (one per group)
    displayMs: 3200,            // how long a card stays
    gapMs: 400,                 // pause between cards
    maxQueue: 4,                // extra cards beyond this are dropped (lowest priority first)
    playerCooldownMs: 0,        // minimum time between two cards about the same player
    overridePriority: 90,       // priority at or above this ignores cooldowns
    volume: 0.9,
  },

  // Local audio files. Replace a file with your own (same name), or point a key at a new file.
  // WAV, MP3, OGG and M4A all work. A missing file just stays silent.
  sounds: {
    win: 'audio/win.wav',
    lose: 'audio/lose.wav',
    badbeat: 'audio/bad-beat.wav',
    comeback: 'audio/comeback.wav',
    winstreak: 'audio/win-streak.wav',
    lossstreak: 'audio/loss-streak.wav',
    upset: 'audio/upset.wav',
    perfect: 'audio/perfect.wav',
    revenge: 'audio/revenge.wav',
  },

  events: {
    PLAYER_WIN: {
      priority: 10, group: 'winner', cooldownMs: 0, tone: 'win', mascot: 'laugh', sound: 'win', effect: 'sparkle',
      title: '{name} menang',
      texts: [
        '{name} ngambil ronde ini. Yang lain silakan introspeksi.',
        'Kartu {name} habis duluan. Sisanya masih pegang kipas.',
        '{name} menang. Jangan sombong dulu, ronde depan belum tentu.',
      ],
      stat: 'Menang {wins}x dari {rounds} ronde · win rate {winRate}%',
    },

    PLAYER_LOSE: {
      priority: 5, group: 'loser', cooldownMs: 0, pickBy: 'penalty', tone: 'lose', mascot: 'cry', sound: 'lose', effect: 'gloom',
      when: (ev) => ev.cardsLeft >= 6,
      title: '{name} kebanyakan kartu',
      texts: [
        '{name} masih megang {cards} kartu. Itu kartu apa koleksi?',
        '{name} minus {penalty} poin. Dompet poinnya nangis.',
        '{name} kelamaan mikir, kartunya keburu basi.',
      ],
      stat: 'Kalah {losses}x · total poin {points}',
    },

    BAD_BEAT: {
      priority: 60, group: 'loser', cooldownMs: 0, pickBy: '-cardsLeft', tone: 'spicy', mascot: 'shock', sound: 'badbeat', effect: ['crack', 'shake'],
      track: { inc: 'badBeats' },
      title: 'Bad beat!',
      texts: [
        '{name} tinggal {cards} kartu lagi… terus {winner} keburu habis. Sakit.',
        'Selangkah lagi, {name}. Selangkah lagi. Tapi enggak.',
        '{name} udah nyiapin selebrasi, ternyata gak kepake.',
      ],
      stat: 'Bad beat ke-{badBeats} buat {name}',
    },

    BIG_COMEBACK: {
      priority: 70, group: 'winner', cooldownMs: 0, tone: 'legend', mascot: 'cool', sound: 'comeback', effect: ['fireworks', 'confetti'],
      track: { inc: 'comebacks' },
      title: 'Comeback!',
      texts: [
        '{name} sempet ketinggalan {deficit} kartu, tapi tetep menang. Gak masuk akal.',
        'Tadi {name} udah dianggap almarhum. Eh, bangkit lagi.',
        'Ketinggalan {deficit} kartu? {name} gak baca skor kayaknya.',
      ],
      stat: 'Comeback ke-{comebacks}',
    },

    WIN_STREAK: {
      priority: 75, group: 'winner', cooldownMs: 0, pickBy: 'streak', tone: 'legend', mascot: 'cool', sound: 'winstreak', effect: ['fire', 'flash'],
      track: { max: ['bestWinStreak', 'streak'] },
      title: '{streak}x beruntun!',
      texts: [
        '{name} menang {streak} ronde beruntun. Ada yang mau lapor curang?',
        '{name} lagi panas. Jangan ada yang deket-deket.',
        '{streak} ronde, {streak} kemenangan. {name} main sambil merem kali.',
      ],
      stat: 'Streak terbaik {name}: {bestWinStreak}',
    },

    LOSS_STREAK: {
      priority: 55, group: 'loser', cooldownMs: 0, pickBy: 'streak', tone: 'lose', mascot: 'cry', sound: 'lossstreak', effect: 'gloom',
      track: { max: ['worstLossStreak', 'streak'] },
      title: 'Kalah {streak}x beruntun',
      texts: [
        '{name} udah kalah {streak} ronde berturut-turut. Coba pindah tempat duduk.',
        '{name}, kartunya gak salah. Mungkin yang megang.',
        'Statistik {name} lagi minta tolong.',
      ],
      stat: 'Rekor kalah beruntun: {worstLossStreak}',
    },

    UPSET_WIN: {
      priority: 80, group: 'winner', cooldownMs: 0, tone: 'spicy', mascot: 'shock', sound: 'upset', effect: ['flash', 'confetti'],
      track: { inc: 'upsets' },
      title: 'Upset!',
      texts: [
        '{name} yang poinnya paling bontot malah menang. Klasemen gemeteran.',
        'Gak ada yang ngira {name} bisa menang. Termasuk {name} sendiri.',
        'Ketinggalan {gap} poin dari yang teratas, {name} tetep nekat. Dan berhasil.',
      ],
      stat: 'Upset ke-{upsets}',
    },

    PERFECT_WIN: {
      priority: 65, group: 'winner', cooldownMs: 0, tone: 'legend', mascot: 'thumbs', sound: 'perfect', effect: ['shine', 'sparkle'],
      track: { inc: 'perfects' },
      title: 'Perfect!',
      texts: [
        '{name} menang tanpa pass sekali pun. Bersih.',
        'Dari awal sampai habis, {name} gak pernah ragu.',
        'Gak ada pass, gak ada drama. {name} langsung gas.',
      ],
      stat: 'Perfect ke-{perfects}',
    },

    REVENGE_WIN: {
      priority: 72, group: 'winner', cooldownMs: 0, tone: 'spicy', mascot: 'angry', sound: 'revenge', effect: 'shake',
      track: { inc: 'revenges' },
      title: 'Balas dendam!',
      texts: [
        'Ronde lalu {target} bikin {name} babak belur. Sekarang lunas.',
        '{name} nyimpen dendam ke {target}, dan barusan dibayar kontan.',
        '{target}, inget ya: {name} gak lupa.',
      ],
      stat: 'Revenge ke-{revenges}',
    },
  },
};

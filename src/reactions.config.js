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
 *              Text is bilingual: { en: 'English', id: 'Indonesian' } (a plain string is used for both),
 *              resolved in each phone's language when the card is shown.
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
      title: { en: '{name} wins', id: '{name} menang' },
      texts: [
        { en: '{name} takes this round. Everyone else, please reflect.', id: '{name} ngambil ronde ini. Yang lain silakan introspeksi.' },
        { en: '{name} emptied their hand first. Everyone else is still holding a fan.', id: 'Kartu {name} habis duluan. Sisanya masih pegang kipas.' },
        { en: "{name} wins. Don't get cocky, next round isn't guaranteed.", id: '{name} menang. Jangan sombong dulu, ronde depan belum tentu.' },
      ],
      stat: { en: 'Won {wins}x in {rounds} rounds · win rate {winRate}%', id: 'Menang {wins}x dari {rounds} ronde · win rate {winRate}%' },
    },

    PLAYER_LOSE: {
      priority: 5, group: 'loser', cooldownMs: 0, pickBy: 'penalty', tone: 'lose', mascot: 'cry', sound: 'lose', effect: 'gloom',
      when: (ev) => ev.cardsLeft >= 6,
      title: { en: '{name}: way too many cards', id: '{name} kebanyakan kartu' },
      texts: [
        { en: '{name} is still holding {cards} cards. Is that a hand or a collection?', id: '{name} masih megang {cards} kartu. Itu kartu apa koleksi?' },
        { en: '{name} is down {penalty} points. The points wallet is crying.', id: '{name} minus {penalty} poin. Dompet poinnya nangis.' },
        { en: '{name} thought too long. The cards went stale.', id: '{name} kelamaan mikir, kartunya keburu basi.' },
      ],
      stat: { en: 'Lost {losses}x · total points {points}', id: 'Kalah {losses}x · total poin {points}' },
    },

    BAD_BEAT: {
      priority: 60, group: 'loser', cooldownMs: 0, pickBy: '-cardsLeft', tone: 'spicy', mascot: 'shock', sound: 'badbeat', effect: ['crack', 'shake'],
      track: { inc: 'badBeats' },
      title: { en: 'Bad beat!', id: 'Bad beat!' },
      texts: [
        { en: '{name} had just {cards} left… then {winner} went out first. Ouch.', id: '{name} tinggal {cards} kartu lagi… terus {winner} keburu habis. Sakit.' },
        { en: 'One step away, {name}. One step. But no.', id: 'Selangkah lagi, {name}. Selangkah lagi. Tapi enggak.' },
        { en: '{name} had the celebration ready. Never got to use it.', id: '{name} udah nyiapin selebrasi, ternyata gak kepake.' },
      ],
      stat: { en: "{name}'s bad beat #{badBeats}", id: 'Bad beat ke-{badBeats} buat {name}' },
    },

    BIG_COMEBACK: {
      priority: 70, group: 'winner', cooldownMs: 0, tone: 'legend', mascot: 'cool', sound: 'comeback', effect: ['fireworks', 'confetti'],
      track: { inc: 'comebacks' },
      title: { en: 'Comeback!', id: 'Comeback!' },
      texts: [
        { en: '{name} was {deficit} cards behind and still won. Makes no sense.', id: '{name} sempet ketinggalan {deficit} kartu, tapi tetep menang. Gak masuk akal.' },
        { en: '{name} was pronounced dead a minute ago. Respawned.', id: 'Tadi {name} udah dianggap almarhum. Eh, bangkit lagi.' },
        { en: "{deficit} cards behind? {name} clearly didn't check the score.", id: 'Ketinggalan {deficit} kartu? {name} gak baca skor kayaknya.' },
      ],
      stat: { en: 'Comeback #{comebacks}', id: 'Comeback ke-{comebacks}' },
    },

    WIN_STREAK: {
      priority: 75, group: 'winner', cooldownMs: 0, pickBy: 'streak', tone: 'legend', mascot: 'cool', sound: 'winstreak', effect: ['fire', 'flash'],
      track: { max: ['bestWinStreak', 'streak'] },
      title: { en: '{streak} in a row!', id: '{streak}x beruntun!' },
      texts: [
        { en: '{name} has won {streak} rounds in a row. Anyone want to report cheating?', id: '{name} menang {streak} ronde beruntun. Ada yang mau lapor curang?' },
        { en: '{name} is on fire. Keep your distance.', id: '{name} lagi panas. Jangan ada yang deket-deket.' },
        { en: '{streak} rounds, {streak} wins. {name} is playing with their eyes closed.', id: '{streak} ronde, {streak} kemenangan. {name} main sambil merem kali.' },
      ],
      stat: { en: "{name}'s best streak: {bestWinStreak}", id: 'Streak terbaik {name}: {bestWinStreak}' },
    },

    LOSS_STREAK: {
      priority: 55, group: 'loser', cooldownMs: 0, pickBy: 'streak', tone: 'lose', mascot: 'cry', sound: 'lossstreak', effect: 'gloom',
      track: { max: ['worstLossStreak', 'streak'] },
      title: { en: 'Lost {streak} in a row', id: 'Kalah {streak}x beruntun' },
      texts: [
        { en: '{name} has lost {streak} rounds straight. Try a different seat.', id: '{name} udah kalah {streak} ronde berturut-turut. Coba pindah tempat duduk.' },
        { en: "{name}, the cards aren't the problem. Maybe whoever's holding them.", id: '{name}, kartunya gak salah. Mungkin yang megang.' },
        { en: "{name}'s stats are asking for help.", id: 'Statistik {name} lagi minta tolong.' },
      ],
      stat: { en: 'Worst losing streak: {worstLossStreak}', id: 'Rekor kalah beruntun: {worstLossStreak}' },
    },

    UPSET_WIN: {
      priority: 80, group: 'winner', cooldownMs: 0, tone: 'spicy', mascot: 'shock', sound: 'upset', effect: ['flash', 'confetti'],
      track: { inc: 'upsets' },
      title: { en: 'Upset!', id: 'Upset!' },
      texts: [
        { en: '{name}, dead last on points, just won. The standings are shaking.', id: '{name} yang poinnya paling bontot malah menang. Klasemen gemeteran.' },
        { en: 'Nobody expected {name} to win. Including {name}.', id: 'Gak ada yang ngira {name} bisa menang. Termasuk {name} sendiri.' },
        { en: '{gap} points behind the leader, {name} went for it anyway. And it worked.', id: 'Ketinggalan {gap} poin dari yang teratas, {name} tetep nekat. Dan berhasil.' },
      ],
      stat: { en: 'Upset #{upsets}', id: 'Upset ke-{upsets}' },
    },

    PERFECT_WIN: {
      priority: 65, group: 'winner', cooldownMs: 0, tone: 'legend', mascot: 'thumbs', sound: 'perfect', effect: ['shine', 'sparkle'],
      track: { inc: 'perfects' },
      title: { en: 'Perfect!', id: 'Perfect!' },
      texts: [
        { en: '{name} won without a single pass. Clean.', id: '{name} menang tanpa pass sekali pun. Bersih.' },
        { en: 'Start to finish, {name} never hesitated.', id: 'Dari awal sampai habis, {name} gak pernah ragu.' },
        { en: 'No passes, no drama. {name} just sent it.', id: 'Gak ada pass, gak ada drama. {name} langsung gas.' },
      ],
      stat: { en: 'Perfect #{perfects}', id: 'Perfect ke-{perfects}' },
    },

    REVENGE_WIN: {
      priority: 72, group: 'winner', cooldownMs: 0, tone: 'spicy', mascot: 'angry', sound: 'revenge', effect: 'shake',
      track: { inc: 'revenges' },
      title: { en: 'Revenge!', id: 'Balas dendam!' },
      texts: [
        { en: 'Last round {target} wrecked {name}. Debt settled.', id: 'Ronde lalu {target} bikin {name} babak belur. Sekarang lunas.' },
        { en: '{name} was holding a grudge against {target}, and just cashed it in.', id: '{name} nyimpen dendam ke {target}, dan barusan dibayar kontan.' },
        { en: "{target}, remember: {name} doesn't forget.", id: '{target}, inget ya: {name} gak lupa.' },
      ],
      stat: { en: 'Revenge #{revenges}', id: 'Revenge ke-{revenges}' },
    },
  },
};

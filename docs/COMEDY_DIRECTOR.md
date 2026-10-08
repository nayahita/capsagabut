# Comedy Director

The comedy layer watches the match, remembers what happened, and occasionally decides to
interfere with the players' mental health. It never touches Capsa rules.

## 1. Audit (before this layer)

| Area | State | Gap for context-driven comedy |
|---|---|---|
| `index.html` core | Engine, online host-authority, render. Emits facts `game:start`, `round:start`, `play`, `pass`, `round:end` through the effect channel, so they reach every phone | Facts were thin: no played cards, no card being beaten, no "passed while holding a legal play", no leftover hands |
| `src/events.js` | Detectors for 9 named events | Fine; reused as-is |
| `src/stats.js` | Per-device stats | Fine; reused as-is |
| `src/reactions.js` | One card per event, random text per device | No memory, no callbacks, no timing, phones disagree online, too frequent |
| Chat | None | Trash talk could not be detected |
| UI extension | None | Modules could not add buttons or decorate seats |
| Timer | Runs during effects | A freeze would steal a player's time |

Core changes for this layer (all small, no rule changes):
1. Richer facts (`play.cards`, `play.prev`, `pass.hadPlay`, `round:end.hands`, `round:end.final`, new `skip`, `chat`).
2. `CapsaFX.broadcast(type, data)` → `capsa:mod` DOM event on every phone.
3. `capsa:render` DOM event after every render.
4. `CapsaFX.holdTimer(ms)` (host only) and `CapsaFX.duck(ms)` (mutes game SFX for a silence beat).
5. `CapsaFX.view()` read-only snapshot, `CapsaFX.fact()`, `CapsaFX.cardHTML()`.

## 2. Architecture

```
core ──facts──► CapsaEvents ──► Memory (every phone, deterministic)
                     │                 └─ emits MEM_* signals (threads, bounty, grudges, mistakes)
                     └─ named events (PLAYER_WIN, BAD_BEAT, ...)
                                       ▼
            Director (host / local device only)
              collect every signal produced by one fact into a "moment"
              → candidate bits whose `when()` matches
              → gate: rarity chance × heat × boredom × callback boost × freshness
              → round cap, min gap, cooldowns, once-per-match
              → script() builds a timeline, text resolved once
              → CapsaFX.broadcast('comedy', performance)  + holdTimer if it freezes
                                       ▼
            Stage (every phone): plays the identical timeline with local audio files
```

Files:

| File | Role |
|---|---|
| `src/comedy/config.js` | Tunables, chance per rarity, sounds map |
| `src/comedy/memory.js` | Match log, round tracking, threads, grudges, bounty, reputation, titles |
| `src/comedy/bits.js` | The bits (data + script). Add new ones here |
| `src/comedy/director.js` | Decides if/what/when |
| `src/comedy/stage.js` | Renders timeline steps, plays audio, roast summary |
| `src/chat.js` | Quick chat (preset trash talk) → `chat` fact |
| `audio/comedy/*.wav` | Original, replaceable sounds |

## 3. Context available to a bit

`when(B)` receives a moment `B`:

| Field | Meaning |
|---|---|
| `B.fact`, `B.d` | The fact name and its data |
| `B.ev(type)`, `B.evs(type)` | Named events / memory signals produced by this fact |
| `B.mem` | `CapsaMemory`: `match()`, `round()`, `lastRound()`, `streak(name)`, `rep(name)`, `title(name)`, `target()` |
| `B.names`, `B.now` | Player names, timestamp |

Fact data:

- `play`: `seat, name, combo, cat, size, cards, counts, prev{combo,size,cards,by}|null, t`
- `pass`: `seat, name, timeout, hadPlay, counts, table{combo,by}`
- `skip`: `seat, name` (auto-skip, nobody could answer)
- `chat`: `seat, name, text, preset, trash`
- `round:end`: `round, winner, how, names, counts, hands, penalties, scoresBefore, scoresAfter, final{combo,cards}`

Memory signals: `MEM_ONE_CARD`, `MEM_THREAD_TENSE`, `MEM_THREAD_RESOLVED`, `MEM_EZ_RESOLVED`,
`MEM_BOUNTY_POSTED`, `MEM_BOUNTY_CLAIMED`, `MEM_GRUDGE_SETTLED`, `MEM_BIG_BEATEN`, `MEM_OVERKILL`, `MEM_PASSIVE`.

## 4. Gating

```
chance = bit.chance ?? base[rarity]            COMMON .30  UNCOMMON .18  RARE .08  LEGENDARY 1
       × heat     = 1 / (1 + 1.2 × performances in the last 4 min)
       × boredom  = 1 + 0.35 × rounds since the last performance (max 2)
       × 1.5 if the bit is a payoff (CALLBACK or REVENGE)
       × 0.5 if the same comedy mode played in the last 60 s
       (capped at .95, LEGENDARY skips heat)
```
Two budgets (`settings.budget`): **micro** (small text, seat tags, corner toasts) max 2 per round with
an 8 s gap; **stage** (notifications, panels, freezes, modals) max 1 per round with a 20 s gap
(RARE+ skip the gap). LEGENDARY: max 1 per match (`legendaryPerMatch`). Plus per-bit cooldown,
`oncePerMatch`, and `once` keys (a bit can return `{ once: 'key' }` so the same setup never pays off twice).

Order of rolls: payoffs of memory first (modes containing CALLBACK or REVENGE), then rarer bits,
then the highest chance. The first success wins; no success means silence. A LEGENDARY moment and
a payoff never cancel each other: if one wins, the other still rolls and plays right after it.

Measured in a 20-match simulation with random hands: about 1 bit per round, roughly half of them
micro. Real games with fewer trash-talk lines land lower.

## 5. Bits (content pass v1)

Voice: formal Indonesian, short, never explains the joke. Full spec with timelines: "Capsa Comedy Bible v1".

| # | Bit | Rarity | Weight | Trigger → what happens |
|---|---|---|---|---|
| 1 | kenangan | COMMON | micro | first last-card loss; a round later, mid-play: photo-app "Kenangan" toast with that card |
| 2 | survei | COMMON | stage | lost ≥20 points: survey with [Buruk] [Sangat buruk] → "Masukan Anda tidak akan mengubah apa pun." |
| 3 | noted | COMMON | micro | trash talk while holding ≥9 cards: "noted." under the seat |
| 4 | prasasti | COMMON | micro | died holding a 2 after passing with a legal play (or holding a bomb): grey memorial next round |
| 5 | seperti-biasa | COMMON | micro | win after a slump: "Seperti biasa." |
| 6 | disetujui | COMMON | micro | the system's favorite plays a combo: "✓ disetujui" on the table. Nobody else gets one |
| 7 | pass (lagi) | — | UI | pass label grows: "pass (lagi)" → "(kebiasaan)" → "(prinsip hidup)" (stage.js) |
| 8 | masih-di-sana | COMMON | stage | timeout: "Apakah X masih di sana?" countdown → "Kami anggap tidak." |
| 9 | faktor-kemenangan | UNCOMMON | stage | everyone else kept ≥6: bar chart, "Lawan 93%" |
| 10 | mic-dibuka | UNCOMMON | stage | trash talk that lost, during someone else's win rounds later: dim, empty mic, "Mic ditutup." |
| 11 | undangan | UNCOMMON | stage | 3 losses in a row: calendar invite to a performance review, everyone but them |
| 12 | cctv | UNCOMMON | stage | killed by a single/pair while a loser held 1: CCTV replay, "Terduga pelaku tampak tenang." |
| 13 | tadi-ada-suara | UNCOMMON | micro | bomb win: "Maaf, tadi ada yang bunyi?" |
| 14 | pembukaan | UNCOMMON | stage | match opens with a lone 3♦: grand opening… "(wajib)" |
| 15 | garis-polisi | UNCOMMON | stage | someone passed holding a play right before the winning play: police tape, "Saksi kunci: X." |
| 16 | prediksi | UNCOMMON | micro | lead habit (same combo 3×): "prediksi: Pair" tag → "✓" or "berkembang." |
| 17 | surat-peringatan | UNCOMMON | stage | beat the same player 3× in a round, or poked them twice in chat |
| 18 | sistem-berduka | RARE | stage | the favorite gets wrecked: black ribbon, "Ronde ini tidak dihitung." … "(dihitung)" |
| 19 | arsip | RARE | stage | third bad moment of a player: incident archive with real round numbers |
| 20 | belum-pernah / mungkin-pernah | RARE | micro | 3rd time on 1 card: "Tenang. Ini belum pernah terjadi." → loses: "Oke. Mungkin pernah." |
| 21 | hening | RARE | stage | trash talk then lost with ≥10 cards: 4.5 s of nothing. Written into the match report |
| 22 | ganti-dukungan | RARE | stage | favorite loses 3 straight: policy update, "Ini bukan tentang kamu, X." |
| 23 | laporan-kinerja | RARE | stage | 5 falling scores, ≤ −30: real line chart, "Proyeksi: stabil." |
| 24 | penyebab | RARE | stage | blame the loser who had nothing to do with it |
| 25 | disarankan | RARE | micro | died holding two 2s for the third time: "Cara Melepaskan: Panduan Pemula" |
| 26 | lap layar | — | UI | one device, late in a long match: handoff screen asks to wipe the screen (stage.js) |
| 27 | patch-notes | LEGENDARY | stage | round 10: patch notes built from this match's lore |
| 28 | kredit akhir | — | UI | leaving a match of 8+ rounds: closing credits (stage.js) |
| 29 | sistem-ikut-main | LEGENDARY | stage | 3 players, one wins 70%: "Sistem" takes a seat, then leaves |
| 30 | harapan | LEGENDARY | stage | last place wins from ≤ −40: their score shows first place… "Itu harapan, bukan data." |

Kept from v0: glory-duration, mental-health, not-this-again ("Ini lagi."), character-development
("Ada perkembangan."), learned-nothing ("Kita tidak belajar apa-apa."), drumroll-nothing, ez-valid, typing,
revenge-receipt, ez-callback, wanted-poster, bounty-claimed, courage-chart, exe-crash, sealed-13, courtroom,
nothing-happens. Retired: interesting, hoarder, blowout-analytics, chose-peace, bazooka, afk-notice,
historic-landslide, monte-carlo, decided-not-to-win, fake-update, legal-immoral, escalation, mental-battery,
slow-replay, buried-bomb.

## 5b. Chat (src/chat.js)

Free text (60 chars), preset lines, and **Colek** (poke one player: `@Name` + a line drawn to their seat;
typing `@Name …` by hand works too). Chat log of the last 20 lines, rate limit 1 line / 3 s per player,
word sensor on by default (each phone can turn it off; masking happens before sending).
Every line is a `chat` fact: `{ seat, name, text, target, counts, trash, prediction, confession }`.
Labels come from preset flags or editable keyword lists in `CONFIG.keywords`. Memory uses them for
`noted`, `mic-dibuka`, `hening`, `ez-callback`, `surat-peringatan` (pokes) and the match report (confessions).

## 6. Adding a bit

```js
CapsaComedy.addBit({
  id: 'triple-threes', mode: 'DEADPAN', rarity: 'UNCOMMON', on: ['play'], cooldownMs: 120000,
  when: (B) => B.d.combo === 'Triple' && B.d.cards.every((c) => c >> 2 === 0) && { name: B.d.name },
  script: (v, B, h) => [
    { do: 'wait', ms: 500 },
    { do: 'caption', text: h.pick(['Tiga kartu 3. Berani.', 'Triple 3. Sebuah pernyataan.']), ms: 2000 },
  ],
});
```

Stage steps: `wait, freeze, silence, sound (key, vol), effect, rarity, caption, banner, notify, bubble, card,
chart (bar/flat/line), poster, receipt, error, typing, stamp, replay, memory, memorial, dim, mic, cctv, tape,
archive, reco, patch, still, spot, approve, tag, predict, ribbon, fakeSeat, scoreSwap`. Each step waits `next`
ms before the next one (defaults: 0 for freeze/silence/sound/effect/rarity/dim/ribbon/tag/predict/approve/scoreSwap,
otherwise its `ms`). A bit can also return `note(v)` → `{ round, name, text, w }` to write a moment into
every phone's memory.

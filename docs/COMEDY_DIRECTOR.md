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
       × heat     = 1 / (1 + 0.6 × performances in the last 90 s)
       × boredom  = 1 + 0.35 × rounds since the last performance (max 2)
       × 1.8 if the bit is a payoff (CALLBACK or REVENGE)
       × 0.5 if the same comedy mode played in the last 60 s
       (capped at .95, LEGENDARY skips heat)
```
Hard limits: 2 performances per round (LEGENDARY exempt), 5 s minimum gap (RARE+ exempt),
per-bit cooldown, `oncePerMatch`.

Order of rolls: payoffs of memory first (modes containing CALLBACK or REVENGE), then rarer bits,
then the highest chance. The first success wins; no success means silence. A LEGENDARY moment and
a payoff never cancel each other: if one wins, the other still rolls and plays right after it.

## 5. Bits (32)

| # | Bit | Rarity | Mode | Trigger |
|---|---|---|---|---|
| 1 | interesting | COMMON | DEADPAN | lost holding 1 card → "Menarik." (opens callback thread) |
| 2 | hoarder | COMMON | ROAST | died holding ≥2 twos |
| 3 | blowout-analytics | COMMON | FAKE ANALYTICS | every loser kept ≥7 cards |
| 4 | chose-peace | COMMON | DEADPAN | 3rd pass this round while holding a legal play |
| 5 | bazooka | COMMON | ROAST | single 2 used on a single ≤7 |
| 6 | afk-notice | COMMON | FAKE SERIOUSNESS | timeout |
| 7 | glory-duration | COMMON | ANTI-CLIMAX | 5-card combo eaten within 20 s |
| 8 | historic-landslide | COMMON | FAKE SERIOUSNESS | winner beat everyone by a hair (losers ≤5 cards total) |
| 9 | mental-health | UNCOMMON | PSYCHOLOGICAL | 3 losses in a row → [Tidak] [Tidak] |
| 10 | monte-carlo | UNCOMMON | FAKE ANALYTICS | win rate under 15% after 5+ rounds |
| 11 | not-this-again | UNCOMMON | CALLBACK | thread owner back on 1 card |
| 12 | character-development | UNCOMMON | CALLBACK | …and wins |
| 13 | learned-nothing | UNCOMMON | CALLBACK | …and loses again |
| 14 | decided-not-to-win | UNCOMMON | ROAST | had ≤2 cards, lost to a comeback |
| 15 | fake-update | UNCOMMON | UNEXPECTED INTERRUPTION | round starts, someone on a 3+ loss streak |
| 16 | drumroll-nothing | UNCOMMON | ANTI-CLIMAX | an ordinary round end |
| 17 | ez-valid | UNCOMMON | DEADPAN | said EZ and actually won |
| 18 | typing | UNCOMMON | PSYCHOLOGICAL | the match target is up next |
| 19 | legal-immoral | UNCOMMON | FAKE SERIOUSNESS | bomb win |
| 20 | revenge-receipt | UNCOMMON | REVENGE | beat the player who humiliated you |
| 21 | ez-callback | RARE | CALLBACK + PSYCHOLOGICAL | said EZ, then lost: freeze → silence → notification → "EZ" → pause → "Menarik." |
| 22 | wanted-poster | RARE | BOUNTY | 3 wins in a row |
| 23 | bounty-claimed | RARE | BOUNTY | bounty target loses |
| 24 | courage-chart | RARE | FAKE ANALYTICS | 6+ passes in one round |
| 25 | escalation | RARE | ABSURD ESCALATION | 4, 5, 6, 7+ losses in a row, bigger each step |
| 26 | mental-battery | RARE | UNEXPECTED INTERRUPTION | flush or better played |
| 27 | slow-replay | RARE | PSYCHOLOGICAL | bad beat on the last card |
| 28 | buried-bomb | RARE | ROAST | died holding four of a kind |
| 29 | exe-crash | LEGENDARY | RARE CHAOS | straight flush, or 3rd bomb of the match |
| 30 | sealed-13 | LEGENDARY | RARE CHAOS | finished with all 13 cards |
| 31 | courtroom | LEGENDARY | FAKE SERIOUSNESS + ESCALATION | upset from ≥20 points behind |
| 32 | nothing-happens | LEGENDARY | ANTI-CLIMAX | 1% on any round end |

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

Stage steps: `wait, freeze, silence, sound, effect, rarity, caption, banner, notify, bubble, card,
chart, poster, receipt, error, typing, stamp, replay`. Each step waits `next` ms before the next one
(defaults: 0 for freeze/silence/sound/effect/rarity, otherwise its `ms`).

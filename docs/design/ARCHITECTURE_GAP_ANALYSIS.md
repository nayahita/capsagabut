# Architecture audit and gap analysis

Audit of the v11 codebase (`capsa.html` core + `src/`). Part 1 maps what exists; Part 12 compares it to the design in this folder.

## Part 1 — Current architecture

```
capsa.html (core rules, rendering, online referee)
  │  fact(type, data)            fx({t:'combo'|'pass'|'skip'|'timeout'|'win'|'emote'})
  ▼                                ▼
fx() ── offline: playEvent() locally
     └─ online: push to rooms/CODE/events → every phone's playEvent()
  │
  ├─ 'fact' ─► src/events.js  CapsaEvents.ingest → emits 'fact:<type>' + detector events
  │              ├─► src/stats.js        per-device stats (localStorage)
  │              ├─► src/lore.js         identity + cross-match notes (device / room)
  │              ├─► src/reactions.js    old judgement cards (disabled: replaceReactionCards)
  │              ├─► src/comedy/director.js  decides (authority only) → broadcast performance
  │              └─► src/comedy/memory.js    match memory → MEM_* signals (same on every phone)
  ├─ 'mod'  ─► DOM 'capsa:mod' ─► src/comedy/stage.js (plays performances), src/showhand.js
  └─ core fx ─► SFX (synthesized WebAudio, Klasik/Meme packs), emotes, particles
```

### 1. Game events available

| Layer | Events |
|---|---|
| Core facts (`chat`, `reveal`, `bit:feedback` come from chat.js / showhand.js / stage.js; `match:end` only on the deciding phone) | `game:start` (names, pids, uids) · `round:start` (round, scores, starter, pids) · `play` (seat, name, combo, cat, size, cards, counts, prev{combo,cards,by}, t, thinkMs, cancels) · `pass` (timeout, hadPlay, could[], counts, table, thinkMs, cancels) · `skip` · `chat` (text, trash/prediction/confession, target, counts) · `emote` · `reveal` (show hand) · `round:end` (winner, how, counts, hands, final, penalties, scoresBefore/After, dealt) · `match:end` · `player:leave` / `player:rejoin` · `bit:feedback` |
| Detectors (`events.js`) | PLAYER_WIN, PLAYER_LOSE, BAD_BEAT, BIG_COMEBACK, WIN_STREAK, LOSS_STREAK, UPSET_WIN, PERFECT_WIN, REVENGE_WIN |
| Memory signals (30) | ONE_CARD, THREAD_TENSE/RESOLVED, EZ_RESOLVED, BOUNTY_POSTED/CLAIMED, GRUDGE_SETTLED, BIG_BEATEN, OVERKILL, PASSIVE, LEAD_TURN, BULLY, POKE, FAVORITE_SET/CHANGED, SLUMP_WIN, INCIDENT, TRASH, RETURNING, HABIT_BROKEN, REPEAT_MISTAKE, DITHER, WASTED_HAND, UNDERDOG_HAND, RIVALRY, SPIRAL, REVEAL, REVEAL_RESOLVED, EMOTE_BACKFIRE, REJOIN |
| Core effect events (not facts) | `combo`, `pass`, `skip`, `timeout`, `win`, `emote` — drive SFX/visuals only |

### 2. Player history stored

| Scope | Store | Content |
|---|---|---|
| Round | `memory.R` | counts, min cards, hitOne, passes, passPlayable, timeouts, overkills, plays, last big combo, beats/beatBy, prev action (enabler), chatted, revealed, emoted, cancels |
| Match | `memory.M` | rounds log (with hands, penalties, scores), moments (timestamped, weighted, bad flag), threads (last-card), chats (60), grudges, bounty, streaks, wins, penalties, mistakes, favorite, score history, lead habits, pokes, setups (3-round expiry), think time, pass stats, emotes, hot pings, confessions, spiral, h2h, debts |
| Cross-match | `CapsaLore` | profiles (pid, aliases, uids), dossier (14 reputation counters, lead habit, pass rate, think time, ≤12 moments, ≤4 legend quotes), rivalry (h2h, biggest debt), table (matches, favourites, legends), ledger (≤150 bits played) — device storage offline, `rooms/CODE/lore` online (host writes, 1 year) |
| Device | `stats.js` | per-name stats (separate from lore, keyed by name) |

### 3. Context the Comedy Director can access

Per fact: the fact payload, every signal emitted while that fact was processed (`B.ev`, `B.evs`), full `CapsaMemory` (match + round + reputation + lore via memory), `CapsaLore` directly (ledger, h2h, quotable moments), `CapsaFX.view()` (phase, turn, counts, scores, table, online, own hand on that phone). Director state: budgets, cooldowns, `once` keys, heat, boredom, target fatigue, feedback multiplier.

### 4. Context it cannot access but should

- **Moment significance.** No numeric "how notable is this" score. Bits gate on hand-written predicates + rarity dice; two very different moments that both pass a predicate look identical.
- **Tension state of the table.** Nothing marks "two players are on ≤2 cards" or "someone is mid-decision"; bits can fire into a clutch moment.
- **What the table is already reacting to.** Chat/emote bursts are counted (busy table), but core effects (bomb animation, win banner, emotes) are not visible to the director as "audio/visual airtime in use".
- **Whether a bit landed.** Only weak proxies: fast dismiss, chat/emote within 8 s.
- **Physical setting.** Online players may sit at the same table or be remote; the system can't tell, which matters a lot for audio (see AUDIO_BIBLE).
- **Card-level counterfactuals.** `could` lists combo names a passer could play, not whether passing was actually good strategy.

### 5. Audio events / SFX available

| Layer | Assets | Notes |
|---|---|---|
| Core SFX (synth, `capsa.html`) | Klasik: card, pass, tick, pair, two, triple, straight, flush, full, fuse, boom, bomb, sflush, skip, win, 6 emote sounds · Meme pack overrides with airhorn, rimshot, crickets, sad trombone, big boom, clang, slide, honk, scratch, boing, pop, buzzer, bell, woodblock | pack chosen per phone (Klasik / Meme / Mati), Meme is default |
| Reaction WAVs (`audio/*.wav`) | win, lose, bad-beat, comeback, win-streak, loss-streak, upset, perfect, revenge | not heard during play (the reaction cards are disabled by the Comedy Director); only the Statistik test chips play them, yet all 9 are still preloaded every round |
| Comedy WAVs (`audio/comedy/*.wav`) | notify, tape-stop, typing, drumroll, stamp, glitch, kazoo, deflate, heartbeat, register, gavel, error, whoosh, memorial, cctv-hum, credits | original, synthesized, replaceable; played by `stage.js` `sound` steps |

### 6. How audio is triggered

- Core SFX: inside `playEvent` for core effect events (`combo` → per-combo sound + emotes; `win` → win sound + laugh emote for the winner + cry emote for the first loser; `timeout` → timeout sound + cry emote), per-turn countdown tick on the active phone, emote picker.
- Comedy: a `sound` step in a bit's timeline (authored per bit), with optional volume, plus sounds built into some stage renderers (mic close, archive typing/stamp, "still there?" notify) and the closing credits, which play `credits.wav` outside the director and its budgets. `silence` steps call `CapsaFX.duck(ms)`, which mutes **every core synth sound, including the countdown tick**, but no WAV.
- Online: every phone plays its own copy when the event or performance arrives (Firebase latency, unsynchronised).
- Mute: `soundMode === 'off'` per phone; stage checks `soundOn()`.

### 7. Comedy output vs audio output

Coupled inside a bit (the author picks the sound in the script), uncoordinated globally: there is no audio arbiter. A comedy sting can land on top of the core win jingle, the cry-emote sound and an emote from another player at the same instant. Core SFX don't know comedy exists except through `duck`.

### 8. Callbacks and escalation over rounds

Supported and already used: callback threads (last card → tense → resolved), delayed setups with 3-round expiry, `once` keys, escalation ladders (pass label, belum-pernah → mungkin-pernah, favourite → mourning → switch), grudges/bounty, cross-match lore with a 24 h roast window, ledger for reruns. This is the strongest part of the system.

### 9. Funny opportunity vs ordinary event

Partially. Opportunities are only what a bit's `when()` recognises, so ordinary events are mostly ignored (good), but significance is binary and per-bit. There is no shared notion of "contradiction strength", "memory depth" or "visibility to the table", so the director can't prefer the better of two eligible moments except by rarity and payoff ordering.

### 10. Limitations that block high-quality contextual comedy

1. **Audio identity works against restraint.** In the default Meme pack a sad trombone plays at the end of every round (first loser's cry emote) and on every timeout that forces a pass; an airhorn plays on every win, full house and bomb. That is the "sad sound after every loss" pattern the design forbids, and it spends the meaning of every later comedy sting.
2. **No audio arbitration** (priorities, ducking of everything, "already playing", per-cue cooldowns). The one control that exists, `duck`, is too blunt: it also silences the countdown tick, which must stay audible.
3. **No scheduled playback online**: phones play the same performance up to a few hundred ms apart; in the same room that sounds like an echo.
4. **No significance score / tension state** (above).
5. **Tests live outside the repo** (session scratchpad), so nothing guards regressions.
6. Stats (`stats.js`) and lore keep two separate per-player histories keyed differently (name vs pid).

## Part 12 — Gap analysis

### Already exists

- Fact stream with rich payloads; deterministic memory on every phone; host-only decisions; broadcast performances.
- Rarity, budgets (micro/stage), heat, boredom, cooldowns, `once` keys, legendary cap, target fatigue, spiral protection, busy-table hold, dismiss feedback, cross-match reruns penalty.
- Callback threads, delayed setups, escalation ladders, grudges, bounty, favourite, rivalry, returning players, 24 h roast window.
- Identity (pids, aliases), cross-match lore in the room for a year.
- Stage with 35 step types incl. wait, silence, freeze, decorations; duck of core SFX.
- Original, replaceable audio files; per-phone mute.

### Missing data

| Item | Priority |
|---|---|
| Tension state: players on ≤2 cards, active decision, last-card race | P0 |
| "Airtime in use": core effect/banner/emote currently on screen or audible | P0 |
| Physical setting flag (same room vs remote) for online rooms | P1 |
| Bit outcome signal beyond dismiss/chat (e.g. emote type after a bit) | P2 |
| Strategic quality of a pass (counterfactual) | P3 |
| Merge `stats.js` history into lore (one history per pid) | P2 |

### Missing logic

| Item | Priority |
|---|---|
| Significance score (contradiction × memory depth × visibility × freshness) with a threshold, used before dice | P0 |
| Clutch gate: no stage bits while two players are ≤2 cards or during the last-card race; hold to round end | P0 |
| Retire trope SFX from the default core mix (sad trombone/airhorn on every round end); move them to rare comedy functions or drop them | P0 |
| `duck` must spare play-critical cues (countdown tick, your-turn nudge) | P0 |
| Match confession to mistake kind (today any mistake within 3 rounds pays it off) | P2 |
| Route stage-built-in sounds and credits through the same cue/cooldown rules as `sound` steps | P1 |
| Stop preloading the 9 unused reaction WAVs every round | P2 |
| Audio arbitration: priority buses, duck all lower buses during comedy, per-cue cooldowns, "already playing" rule | P1 |
| Cue functions instead of file names in bits (`sting.small`, `drop`) resolved by the audio director with seeded variants | P1 |
| Callback-to-bit escalation ("Surat Peringatan 2") using the ledger | P2 |
| Automatic decay of reputation counters (old behaviour weighs less) | P2 |
| Learned per-table frequency from feedback (beyond the current multiplier) | P3 |

### Missing infrastructure

| Item | Priority |
|---|---|
| Move the test harnesses (unit + 3-phone sim + frequency sim) into the repo with a one-command runner | P0 |
| Audio Director module (`src/audio/director.js`): buses, routing, scheduling, cooldowns | P1 |
| Server-time scheduling of performances (`at` timestamp) so phones play together | P1 |
| Audio routing policy for same-room online play (one speaker vs spotlight phone) | P1 |
| Telemetry log per match (bits played, dismissals, laughs proxy) viewable in Statistik | P2 |
| LLM-generated lines at runtime | P3 — conflicts with deterministic sync, voice control and restraint; authored lines with slots are enough |

### Recommended order

1. P0 data + logic: tension state, significance score, clutch gate, retire trope SFX defaults, tests in repo.
2. P1 audio: audio director with buses, cue functions, scheduling, same-room routing.
3. Content: Comedy Bible v2 bits on top of the above.
4. P2 polish as playtests show the need.

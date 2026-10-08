# Comedy Memory Spec

What the system remembers, for how long, and how memory turns into callbacks without repeating itself.

## 1. Principles

- Remember **stories, not just counts**. "Lost on the last card holding 9♣, round 3, after saying it was easy" makes a callback; "lastCardLosses: 4" only makes a title.
- Every remembered item carries **who (pid), when (timestamp + round + match), what (type), proof (card/quote/number), weight, and whether it is embarrassing**.
- Memory runs deterministically on every phone from the same facts; only the deciding phone writes anything that outlives the match.
- Keyed by player id (pid), never by display name, so renames keep history and two people with the same name never merge.

## 2. Lifetimes

| Lifetime | Items | Where in v11 |
|---|---|---|
| **Round** (cleared at next `round:start`) | counts, min cards, passes, passes-with-play, cancels, beats per pair, previous action (enabler), revealed hands, emotes, chatted flags, current tension (to add) | `memory.R` |
| **Match** (cleared at `game:start`) | round log, moments, callback threads, setups (expire after 3 rounds), chats (last 60), grudges, bounty, streaks, favourite, score history, lead habits, think times, pass stats, pokes (count per pair, no timestamps), confessions, spiral flags, head-to-head this match, debts, once-keys, bits performed (director state) | `memory.M`, director `st` |
| **Decaying** (kept, weight falls with time) | embarrassing moments: quotable for 24 h, then numbers only · other moments: quotable for 365 days (device and room alike) · reputation counters: should decay (to add: halve weight of counts older than 30 days when computing titles) · lead habit / pass rate / think time: rolling, recent matches weigh more (to add) | `CapsaLore.dossier`, `quotable()` |
| **Permanent while the room / device keeps notes** (room: 1 year after last opened) | profile (name, aliases, uids), match count, head-to-head totals, biggest debt per pair, table history (matches, favourites, legend quotes), ledger of bits (last 150) | `CapsaLore` |
| **Never stored** | chat text that wasn't a boast/prediction/confession that resolved; anything the sensor masked; any personal data (real names beyond the nickname typed, location, age, device info); free-text outside the game; the content of hands beyond what the round result already showed everyone | — |

### Never store, in detail

- Raw chat beyond the match. Only up to 4 "legend" quotes per player survive, and only quotes that became part of a resolved setup (a boast that lost). Nothing typed about real life.
- Masked words. If the sensor caught it, it is gone.
- Hands that were never revealed. A player's cards are only remembered as they appeared in the round result or a voluntary show-hand.
- Reaction to a bit that implies emotion ("player was hurt"). The system records dismissals as counts, not as moods.

## 3. Callback structure

Every callback is a chain:

```
EVENT A  →  MEMORY CREATED (setup)  →  EVENT B  →  CONTRADICTION / CONFIRMATION  →  OPPORTUNITY  →  (maybe) BIT
```

A setup record:

```
{ id, type, pid, round, match, t, proof: {card|quote|number}, window: {rounds|ms}, used: false }
```

| Setup type (A) | Created when | Paid off by (B) | Window | Status |
|---|---|---|---|---|
| boast / prediction | trash or prediction chat | same player's round result | same round or 2 min | ✓ |
| ezLost (unpaid boast) | boast that lost | someone else's win, later | 3 rounds | ✓ |
| confession | confession chat | any mistake by the same player (overkill, passive pass, timeout, hoard); kinds aren't matched yet | 3 rounds | ✓ (◐ for kind matching) |
| last-card thread | first loss on 1 card | same player on 1 card again → win/lose | match | ✓ |
| kenangan | first last-card loss | mid-play in a later round | 3 rounds | ✓ |
| prasasti | died holding a 2 after a playable pass / holding a bomb | next round start | 1 round | ✓ |
| grudge | lost ≥ 10 points to X | beats X later | match | ✓ |
| bounty | 3 wins in a row | anyone beats them | match | ✓ |
| reveal | show-hand | own round result | round | ✓ |
| emote taunt | laugh/cool emote | own round result | round | ✓ |
| habit | lead combo share ≥ 60 % over ≥ 6 leads | leads with a different combo | across matches | ✓ |
| rivalry | head-to-head ≥ 8, close | the pair meets again | across matches | ✓ |
| yesterday | embarrassing moment stored at match end | same moment type, next match | 24 h | ◐ (needs type matching) |
| system claim | a bit asserted something ("never happened") | facts contradict it | match | ✓ (belum-pernah → mungkin-pernah) |

Rules:

1. **One payoff per setup.** Once-keys mark a setup spent, whether the bit played or the moment passed.
2. **Payoffs outrank fresh observations** when both are eligible at the same fact.
3. **A callback must change form.** Never replay the same caption; escalate, invert, or answer.
4. **Windows are hard.** An expired setup is deleted, not quietly reused.

## 4. How memory prevents repeating jokes

| Layer | Prevents | v11 |
|---|---|---|
| once-keys per setup | paying the same setup twice | ✓ |
| per-bit cooldown | the same bit twice in a few minutes | ✓ |
| oncePerMatch | signature bits more than once per match | ✓ |
| target fatigue | the same player being the subject too often | ✓ |
| ledger | the same bit on the same player within 24 h, this match or earlier (×0.4) | ✓ |
| mechanism memory | the same comedic device (e.g. "fake notification") twice in a row even with different bits | ◐ (mode-level halving exists; add: no two notifications back-to-back within 3 min) |
| line variants | identical wording on a rerun | ◐ (some bits have 2 variants; target ≥ 2 for every stage bit) |
| callback-to-bit | when the same situation recurs after a bit already covered it, the next bit must reference the first ("second warning") rather than repeat it | ✗ |

## 5. Record shapes (target)

```js
// moment (match → dossier at match:end)
{ pid, t, round, match, type: 'lastCard'|'hoard'|'bombDeath'|'timeout'|'boastLost'|'revealLost'|..., proof, w, bad }

// ledger entry (every bit that played)
{ id: 'mic-dibuka', pid, t, m: matchId, mechanism: 'callback', feedback: 'dismiss'|'warm'|null }

// rivalry
{ key: 'pA|pB', w: { pA: 7, pB: 6 }, big: { pid: 'pA', victim: 'pB', pen: 24, t } }
```

Adding `type` to moments (today they carry free text) is what makes "yesterday's blunder repeated" (G3) possible without string matching.

## 6. Privacy and control

- Players can rename, merge, or delete their notes (Statistik → Profil pemain); online only the host can, and only for that room.
- Notes live where the group plays: on the device for one-device play, in the room for online play. A new room starts empty.
- No notes leave that room or device. Nothing is sent anywhere else.

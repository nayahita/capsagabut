# Social Interaction System

Quick chat, emotes and voice lines that players choose to send. Nothing in this layer sends anything on a player's behalf.
The automatic mascot reactions the core plays on big moments (a bomb, a round win) are local table effects, separate from this layer, and are never logged as something a player said.

Files: `src/social/catalog.js` (content + limits), `src/social/social.js` (everything else), small hooks in `index.html`.

## 1. Audit (v12.1, before this layer)

| Area | Found | Used for social |
|---|---|---|
| Engine / UI | Single-file core `index.html`: rules, render (`app.innerHTML` on every change), `capsa:render` after each render | Panel and bubbles live in `document.body`, outside the re-rendered tree; buttons are injected on `capsa:render` |
| Transport | Firebase RTDB, anonymous auth. Every effect goes through `fx(ev)`: online it is pushed to `rooms/CODE/events` with a server timestamp, and every phone (sender included) plays it through `playEvent`; offline it plays locally. Events older than 20 s are pruned by the host | A new `t:'social'` event on the same path, so there's one pathway and no extra listeners |
| Authority | The host is authoritative for game state. Events are client-written; there is no server code | Validation runs on every receiver, timed by the server timestamp (see §4) |
| Event detection | `fact()` → `CapsaEvents.ingest` (src/events.js) → detectors, comedy memory, director | Validated social actions are ingested locally on each phone as `chat` / `emote` facts and `fact:social` |
| Emotes | 6 mascot faces (`mascotSVG`), a per-seat picker, `{t:'emote', seat}` events with a **client-claimed seat**, 1.5 s cooldown | Faces reused; the seat picker is replaced by the panel; the old event still plays for older clients |
| Chat | `src/chat.js`: free text (60 chars), presets, poke, 3 s cooldown, sensor; sent as `chat` facts | Presets moved to quick chat; free text stays as a separate channel |
| Audio | Core WebAudio bus (`CapsaFX.audio()`), sound pack setting (Mati/Klasik/Rame), `src/audio/director.js` for comedy (exclusive bus, same-room routing) | Voice lines use the same context and master bus, obey the sound setting, and have their own one-at-a-time bus |
| Identity | Seats ↔ room uids (`G.uids`), lore profiles (`G.pids`) | Sender identified by uid; mute keyed by profile id (falls back to uid / name) |
| Tests | Node unit harness (`tests/unit`), Playwright sims with a fake Firebase (`tests/sim`) | `tests/unit/social.test.js`, `tests/sim/social.py` |

Risks found: client-claimed seats on emote events (anyone could emote "as" someone else), arbitrary text on chat facts, no receiver-side rate limit, emote visuals that weren't tied to presence, Firebase raising a phone's own writes synchronously (handlers must tolerate re-entry).

## 2. Flow

```
tap in panel
 → social.send(id): catalog check, seat, per-kind cooldown (this phone)
 → CapsaFX.social({id, seat, to, n})            core adds uid (online) or ts (offline)
 → fx() → rooms/CODE/events  {t:'social', id, uid, seat, to?, r, n, ts:SERVER}
 → every phone: playEvent → 'capsa:social' → social.receive(ev)
      validate → remember (history + comedy facts) → present (bubble/emote, optional voice) on this phone
```

Payload (everything else on the event is ignored):

| field | meaning |
|---|---|
| `t` | `'social'` |
| `id` | catalog id, `qc.<id>` or `emo.<id>` |
| `uid` | sender's room uid (online). Receivers derive the seat from it: `seat = view.uids.indexOf(uid)` |
| `seat` | sender seat. Used offline only; online it's informational |
| `to` | optional target seat |
| `r` | round number at send time |
| `n` | sender nonce (dedupe key with uid) |
| `ts` | server timestamp (Firebase `ServerValue.TIMESTAMP`); offline `Date.now()` |

## 3. Validation on every receiver

In order, each with a reason code returned by `CapsaSocial.receive()`:

1. `unknown-id`: id not in the catalog (own-property lookup, so `__proto__` etc. fail too)
2. `nonce`: missing/oversized nonce
3. `not-member` (online): uid is not a seat in this match; `seat` (offline): seat out of range
4. `state`: no game in progress (setup/lobby)
5. `stale`: older than 30 s (ignored completely)
6. `duplicate`: same uid + nonce seen
7. `rate`: same kind from that sender less than 0.9 s apart, or more than 6 actions in 10 s (server clock, so all phones decide alike)

Accepted events are remembered on every phone (history, comedy facts). Presentation is then local:

- `late`: more than 6 s old, or older than something already shown for that seat → not drawn
- `hidden`: sender muted on this phone, or "show others" off → not drawn, no voice
- repeat of the same id within 6 s → drawn small, no voice
- voice only if fresh (≤ 2.5 s), voice enabled, sound on, sender not muted, not same-table routing, sender's voice gap ≥ 4.5 s, voice bus free, audio context running

Text shown is always the catalog text, inserted with `textContent`; no URL from an event is ever fetched (voice files come from the catalog).

## 4. Limits of client-side validation

There is no game server. A modified client can still write anything to `rooms/CODE/events`. Honest clients ignore what fails validation, but only Firebase rules can stop the write. A spoofed `uid` is the remaining hole: without rules, a client could write an event with another player's uid. Recommended rules (add to the existing ones):

```json
"rooms": { "$code": { "events": { "$id": {
  ".validate": "newData.child('t').val() !== 'social' || (newData.child('uid').val() === auth.uid && newData.child('id').isString() && newData.child('id').val().length <= 40 && newData.child('n').isString() && newData.child('n').val().length <= 24)"
} } } }
```

With that rule, the uid check in §3 is backed by the server. Rate limits stay client-side (RTDB rules cannot count writes over time).

Free-text chat (`src/chat.js`) is a separate, older channel that does carry typed text. It is trimmed to 60 chars and optionally censored on the sender, clamped again on arrival, and only rendered with `textContent`. Muting a player hides their free text too.

## 5. Cooldowns (all in `CONFIG`)

| | sender | receiver |
|---|---|---|
| emote | 1.5 s | 0.9 s min gap |
| quick chat | 1.5 s (separate) | 0.9 s min gap |
| any | | 6 per 10 s |
| voice | 5 s (icon dims) | 4.5 s per sender, one voice at a time |

Feedback when on cooldown: the buttons dim, and a tap shakes the button with "Sabar, 0.8 detik lagi." Nothing rewards sending more.

## 6. Presentation

- One social slot per seat; a new action replaces the old one. Bubbles step down below a neighbour's bubble instead of overlapping.
- Emotes last 2.3 s, bubbles 3.2 s; all timers are cleared on replace. Nothing persists.
- A player who disconnects (`player:leave`, or offline in presence) loses their slot and voice immediately.
- The panel sits directly above the hand (never over cards or Pass/Buang). A tap outside closes it and is swallowed, so it can't select a card. Escape closes it too.

## 7. Settings (this phone, `localStorage['capsa.social']`)

`voice` (on/off), `volume` (0–1), `showOthers` (hide others' emotes/quick chat/free-text bubbles), `muted` (profile id → name). Master audio stays the existing sound pack setting; voice lines follow it.

## 8. History (match-scoped, for later rivalry/comeback features)

`CapsaSocial.history`: `all(filter)`, `tauntsReceived(seat, {round, direct})`, `respondedTo(a, b, ms)`, `lastBy(seat, tone)`, `summary(round)`. Capped at 200 entries, reset on `game:start`.

Events on `CapsaEvents`:

- `fact:social`: every accepted action `{t, round, seat, name, who, to, toName, id, kind, tone, repeat, voiced}`
- `fact:social:reply`: a player answered another within 8 s
- `fact:social:payoff`: at round end, `taunted-winner` (winner got ≥ 2 taunts that round) or `called-it` (winner sent a confidence line)
- Quick chat also arrives as a `chat` fact (with `trash` / `prediction` / `confession` labels) and emotes as `emote` facts with `tone`, so existing comedy callbacks ("EZ… then lost", taunting emote then lost) work unchanged.

Nothing subscribes to the payoff events yet. They're there so a later feature can ask the questions without new plumbing.

## 9. How to add things

- **Quick chat line**: add `{ id, cat, text, trash?, prediction?, confession?, voice? }` to `QUICK`. The id must match `[a-z0-9-]{1,24}` and never be reused for a different meaning.
- **Category**: add to `CATEGORIES`; it becomes a tab.
- **Emote**: add `{ id, label, say, tone, pack, sfx?, voice?, face(h), bg? }` to `EMOTES`. `face` draws on the card mascot (viewBox 0 0 100 120); a new `pack` name shows as its own group in the Emote tab.
- **Voice line**: add `{ file, archetype, line }` to `VOICE`, put the original recording at `file`, and reference its id from a line or emote. Missing files fall back to the placeholder babble (`CONFIG.voice.placeholder`).

## 10. Tests

Automated (`bash tests/run.sh --sim`):

| # | Scenario | Where |
|---|---|---|
| 1 | quick chat seen by others | sim |
| 2 | emote seen with the right face | sim |
| 3 | voice line plays on eligible phones | unit + sim |
| 4 | missing audio doesn't break quick chat | unit + sim |
| 5 | mute one player, locally | unit + sim |
| 6 | voice off keeps visuals | unit + sim |
| 7 | cooldowns: sender, receiver, burst, kinds separate | unit + sim |
| 8 | invalid ids rejected | unit + sim |
| 9 | injected text/URLs/foreign uid ignored | unit + sim |
| 10 | two players at the same moment | sim |
| 11 | duplicate / late / out-of-order / stale | unit + sim |
| 12 | disconnect while displayed | sim |
| 13 | panel on a 390 px phone, above the hand | sim |
| 14 | outside tap closes the panel without picking a card | sim |
| 15 | full round with social traffic, turns in sync | sim |
| 16 | autoplay blocked: no voice, nothing queued | unit + sim |
| 17 | existing tests | all suites |
| 18 | bounded state, no leftover DOM/timers | unit + sim |

Manual (real phones):

1. iOS Safari: open the room without touching anything, have someone send a 🔊 line. You should see the bubble with no sound. Tap anywhere, then have them send another: now it should play.
2. Two phones on the same table with "main di satu tempat": the voice should come only from the sender's phone.
3. Record one real file into `audio/voice/`, reload, and check it replaces the babble. Files over 2.6 s are cut.
4. Airplane mode on one phone while its emote is up: it should vanish on the others when presence updates.

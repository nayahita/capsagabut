# Comedy Evaluation Rubric

Two levels: judging **one bit** before it ships, and judging **the system** after real play.

## 1. Bit review (before implementation)

Score each 0–3. Ship at ≥ 20 / 30 with no zero in the first five rows and no red flag.

| # | Criterion | 0 | 3 |
|---|---|---|---|
| 1 | Context specificity | would work at any table | only makes sense after what just happened here |
| 2 | Truth | states something the system can't verify | every slot is a fact from memory, visible to the table |
| 3 | Brevity | needs two sentences or a setup | 2–8 words, or nothing at all |
| 4 | Timing | fires during play-critical moments or late enough to feel random | lands on the beat (right after the result, or deliberately delayed for a callback) |
| 5 | Target fairness | aims at identity, mood, or a player who's genuinely down | aims at visible behaviour; respects fatigue and spiral |
| 6 | Surprise | the obvious line | the second reading, an inversion, or silence where noise was expected |
| 7 | Callback depth | no history | pays off something set up earlier (this round < match < cross-match) |
| 8 | Voice | chatty, exclamation marks, emoji, explains itself | formal institution, deadpan, never admits a joke |
| 9 | Works muted | depends on audio | fully readable with sound off |
| 10 | Audio fit | sound tells the joke or doubles the text | sound only adds timing/weight, or deliberately subverts |

### Red flags (automatic reject)

- Copies or paraphrases an existing joke, meme, catchphrase, or recognisable sound.
- Generic gamer insult or internet slang in the system voice.
- Any reference to identity, body, money, real-life life events, or anything outside the game.
- Explains the joke or labels it as a joke.
- Could fire on most rounds.
- Requires guessing a fact (empty slot fallback).

## 2. System review (after play)

### Telemetry per match (from the ledger + director log)

| Metric | Target | Alarm |
|---|---|---|
| Noticeable bits per round (micro + stage) | 0.3–0.6 | > 1.0 or < 0.15 |
| Stage bits per round | ≤ 0.3 | > 0.5 |
| Rounds with no bit at all | ≥ 50 % | < 35 % |
| Share of bits that are callbacks/payoffs | ≥ 35 % | < 20 % |
| Max bits on one player per match | ≤ 35 % of all bits | > 50 % |
| Quick dismissals (< 1.2 s) | ≤ 10 % of bits with buttons | > 25 % |
| Warm signal (chat/emote within 8 s) | ≥ 30 % of stage bits | < 15 % |
| Same bit twice in a match | 0 (except allowed variants) | any |
| Sounds on round end in default pack | 1 (`round.resolve`) | > 2 |

### Playtest protocol (one evening, 3–4 players, 10+ rounds)

1. Play without explaining the system. Note every moment someone reacts out loud.
2. After the match, ask each player: name one moment the system said something. If nobody can name one, it's too quiet or too forgettable; if everyone names different filler bits, it's too loud.
3. Ask: did anything feel unfair or mean? Any "yes" about a specific bit → review its target rules.
4. Ask: was there a moment you expected the system to say something and it didn't? Those are candidate setups worth storing, not necessarily bits.
5. Compare reactions to the ledger: bits with zero reactions across two evenings get cut or rewritten.
6. Repeat a second evening with the same group: callbacks and "welcome back" should be the most mentioned moments. If they aren't, memory isn't being used well.

### The test that matters

After a match, someone at the table quotes or retells a moment the system created, unprompted. One of those per evening is success. Five is too many.

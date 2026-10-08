# Comedy Bible

What the system is for, what it sounds like, and when it keeps quiet.

## 1. The premise

Players at a Capsa table already produce the setup: a boast, a held-back 2, a bomb that never left the hand, a rivalry. The system's job is to recognise that a setup exists and add **one short last beat at the right moment**, or decide that silence is the better beat. It never tells jokes that would work at any other table.

Optimise in this order: context → timing → specificity → callback → restraint → surprise. Never for volume, number of jokes, number of sounds, or complexity.

## 2. Research findings (Part 2)

Material studied: r/Jokes (Weller & Seppi 2020; 86,492 jokes in the dev+test splits with log-scaled upvote labels), the Short Jokes dataset (231,657 one-liners scraped from Reddit and joke sites), and the Short Text Corpus for humor detection (≈5,000 one-liners plus non-humorous controls). Used only to study mechanisms. No joke from them is used, quoted or paraphrased in the game, and none should be: licensing is unclear (Reddit ToS, scraped sites) and 10–17 % of entries are sexual or identity-based.

### What the numbers say (r/Jokes, share of jokes with label ≥ 3, base 23.4 %)

| Feature | Share of corpus | Label ≥ 3 | Reading for this game |
|---|---|---|---|
| Under 80 characters | 36 % | 18.0 % | Short standalone puns do poorly when they must carry their own setup |
| 300–700 characters | 8 % | 32.1 % | Longer setups score better… |
| Over 700 characters | 8 % | 44.6 % | …because a reader chose to read a story. A player mid-game did not |
| Q/A form ("What do you call…?") | 32 % | 17.5 % | The most common format is the weakest; the punchline is ~35 % of the text |
| Contains dialogue (quotes) | 20 % | 33.3 % | Characters' own words land better than narration |
| Rule-of-three setup | 0.7 % | 34.8 % | Pattern → pattern → break still works |
| Topical / celebrity names | 2 % | 21.1 % | References age fast and score below average |
| Profanity / identity targets | 6 % / 5 % | 30.1 % / 27.0 % | Popular with an anonymous crowd; excluded here on principle (see §4) |

The key inversion: on Reddit the text must build its own context, so length helps. In the game **the table has already built the context**, so the system can skip the setup entirely and deliver only the turn. That is why every bit in this game is 2–8 words and why quoting a player's own chat ("dialogue") is the strongest move available.

### Mechanisms worth keeping

| Mechanism | What makes it strong | Game-native form |
|---|---|---|
| Surprise / misdirection | The obvious reading is set up, then a second true reading replaces it | A system notice that looks like praise and turns into an audit of the same play |
| Irony | Stated intention vs outcome, both visible | Their "EZ" next to their 10 remaining cards |
| Understatement | Big event, smallest possible words | A bomb answered with one polite question |
| Exaggeration | Small event, ceremony far beyond it | A grand opening for the mandatory 3♦ |
| Deadpan | Delivery never signals that a joke happened | Plain facts, no exclamation marks, no emoji |
| Escalation | Same event, rising response, then a ceiling | Pass label that climbs, then the system stops commenting |
| Callback | A detail from earlier returns at the moment it matters | The card someone died holding, shown again a round later |
| Analogy / unexpected comparison | A foreign frame applied with full seriousness | Losing streak written as a quarterly performance report |
| Rule of three | Two confirmations then a break | Third last-card loss gets the archive, not a third caption |
| Situational roast | Aimed at behaviour the table just saw, never identity | "noted." under the seat of someone talking big while holding 9 cards |
| Player-specific | Draws on that player's own history | Returning player greeted by their title, plus one fact from the last 24 h |

### What separates strong from mediocre

Strong ones are short, true, specific, and trust the audience. Mediocre ones explain themselves, carry their own context, rely on a reference, or would work anywhere. Self-explaining markers ("get it", "pun intended") appear in under 1 % of jokes, and nothing in the game should ever explain itself.

### Patterns that must not enter the game

- Generic gamer insults ("skill issue", "git gud", "noob"), stale meme phrases, forced pop-culture references.
- Anything about identity, bodies, sex, religion, ethnicity, money, or real-life traits of a player.
- Jokes unrelated to what just happened at the table.
- Explaining the joke, labelling it as a joke, laughing at it (no "haha", no 😂).
- Jokes needing context the table doesn't have (another group's lore, internet in-jokes).
- Excessive profanity. The system voice never swears; players' own chat is masked by the sensor by default.
- Chatbot tells: enthusiasm, exclamation marks, "Wow!", rhetorical questions to the player, emoji, puns on card names.
- Copyrighted lines, catchphrases, or recognisable sounds from games, films, anime, TikTok.

## 3. Voice

The system is a formal, slightly bureaucratic institution that takes Capsa far too seriously, has favourites, keeps records, and never admits it is being funny.

- Formal Indonesian ("Anda", full sentences, no slang). The players are the ones who talk like friends.
- Short: one line, rarely two. A second line is a beat, not an explanation.
- States facts. Never asks the player how they feel, never cheers, never insults.
- Takes sides openly (the favourite) and pretends neutrality while doing it.
- Is allowed to be wrong and correct itself ("Oke. Mungkin pernah.").
- Never mentions itself as AI, never references being a program in a cute way. The meta bits (patch notes, system joins the table) stay inside the fiction of an institution.

## 4. Targets and fairness

- Target behaviour seen at this table: plays, passes, chat, emotes, show-hand, timing, history.
- Never target identity, appearance, ability outside the game, real-life events, or anything typed into chat that isn't about the game.
- Spread the attention: a player hit by 2 bits within 3 rounds is left alone (target fatigue).
- Protect the one who is really going under (5+ losses and far behind): no roasts, only bits that take their side.
- Praise exists but is dry ("Terbukti.", "Ada perkembangan."). Warmth comes from the system remembering, not from compliments.
- Embarrassing moments may be quoted for 24 hours; after that they become numbers (titles, stats), never quotes.

## 5. Restraint (Part 5)

Target: **0.3–0.6 noticeable bits per round, most rounds silent, no more than one stage-sized bit per round.** Players should remember individual bits, not a constant stream.

### Minimum comedic significance

Before any dice roll, an opportunity must reach a significance score (see COMEDY_AUDIO_INTEGRATION §3):

```
significance = contradiction × visibility × memory depth × freshness
```

- **contradiction** 0–3: none / mild / clear / flagrant (boast then lost with 10 cards = 3)
- **visibility** 0–1: can every player see both sides? (counts, cards, chat on screen = 1; inferred = 0.3)
- **memory depth** 1–2: 1 for a same-moment observation, 1.5 for a same-match callback, 2 for cross-match
- **freshness** 0–1: 1 minus how recently this target / bit / mechanism was used

Threshold: ≥ 1.5 for micro bits, ≥ 2.5 for stage bits, ≥ 3.5 for legendary. Below threshold the moment is recorded (it may feed a later callback) but nothing plays.

### Cooldowns and repetition limits

| Rule | Value |
|---|---|
| Same bit | per-bit cooldown (2–15 min) + once-keys per setup |
| Same target | max 2 bits per 3 rounds |
| Same mechanism / mode | chance halved within 60 s |
| Same bit, same player, across matches | ×0.4 within 24 h |
| Stage bits | 1 per round, 20 s gap |
| Micro bits | 2 per round, 8 s gap |
| Legendary | 1 per match |
| After a legendary | silence for the rest of that round and the next |

### Confidence thresholds

A bit may only state facts the memory actually holds. If a slot would be empty or guessed (unknown card, missing chat text, a stale moment beyond 24 h), the bit does not play. No fallback wording.

### Context requirements

- Both sides of a contradiction must have happened at this table and be recoverable on screen or in the round result.
- Callbacks require the origin to be within its window (same round to 3 rounds; cross-match within 24 h for embarrassing, within the room's year for neutral or good).

### When silence is better

- The moment is already funny and everyone is laughing (chat/emote burst in the last 10 s).
- Someone is genuinely upset (spiral, or repeated quick dismissals).
- The game's own effect is already big (bomb animation, straight flush, win banner): the bit must be smaller than the effect or wait.
- The best line would need explaining.
- The same event was already covered by an earlier bit.
- The very first rounds of a first match: the table hasn't learned the system's voice yet, so micro only.

### When a joke must be suppressed

- High-intensity moment: two players on ≤ 2 cards, or the active player is mid-decision with ≤ 10 s on the clock → hold stage bits to round end; micro bits only if they don't cover cards or controls.
- Multiple players already talking (busy table) → no micro bits.
- An earlier bit in the same round covered the same target or the same fact.
- The target is offline or reconnecting.
- Sound is off on most phones and the bit depends on audio → don't play (every bit must work muted; audio-only bits are not allowed).

### Silence as an output

Silence is a performance, not the absence of one. Deliberate silence (core sounds ducked, a freeze of 2–5 s, no text) is the strongest response the system has, and it is reserved for the biggest contradictions (e.g. trash talk then losing with 10+ cards). It costs a stage slot.

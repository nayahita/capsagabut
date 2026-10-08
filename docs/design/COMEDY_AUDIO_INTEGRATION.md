# Comedy + Audio Integration

How a fact at the table becomes (rarely) text, sound and timing on every phone.

## 1. The proposed pipeline, audited

Proposed in the brief:

```
GAME EVENT → GAME STATE → PLAYER HISTORY → OPPORTUNITY DETECTOR → COMEDIC INTERPRETATION
→ COMEDY OUTPUT (text, sfx, timing, intensity, cooldown) → AUDIO DIRECTOR → PLAYBACK
```

Mostly right. Four changes:

1. **The Audio Director arbitrates all audio, not only comedy.** Core table sounds, emotes and comedy cues compete for the same speakers; only one place can decide what ducks, waits or drops. Today core SFX and comedy sounds are independent, which is why a comedy sting can land on top of the win jingle and two emotes.
2. **"Comedic interpretation" is a choice, not a generation step.** The interpretation is an authored bit (with slots) picked by the director. No runtime text or sound generation: it would break deterministic sync across phones, the system voice, and restraint.
3. **A tension check comes before opportunity scoring.** The question "may the system speak right now at all?" (clutch, mid-decision, built-in effect on screen, busy chat) is cheaper and more important than "what would it say".
4. **One decision, one object.** The deciding phone produces a single performance (text + cue functions + timing + seed + start time). Every phone plays that object; no phone decides anything locally except how to route sound on its own speaker.

## 2. Target architecture

```
core fact ──► events.js detectors ──► memory.js (round / match) + lore.js (cross-match)
                                          │ MEM_* signals
                                          ▼
                              TENSION MONITOR (new)
                                clutch? mid-decision? effect airtime? busy chat? spiral?
                                          │ allowed tiers: none / micro / stage / legendary
                                          ▼
                              OPPORTUNITY SCORER (new)
                                significance = contradiction × visibility × depth × freshness
                                          │ candidates above threshold
                                          ▼
                              COMEDY DIRECTOR (exists)
                                bits' when() → restraint gates → budgets → dice → ONE bit
                                          │ performance { id, seed, at, steps[text, cue fn, timing] }
                                          ▼
                     broadcast (online: host → every phone) / local (offline)
                          │                                  │
                          ▼                                  ▼
                   STAGE (visual, exists)          AUDIO DIRECTOR (new, every phone)
                   schedules at `at`               cue fn → asset variant (seeded)
                                                   bus priority, ducking, cue cooldowns
                                                   routing (which phone plays), mute
                                                   ▲
                       core table sounds, emotes ──┘ (same arbiter)
```

## 3. Opportunity scoring

```
significance = contradiction (0–3) × visibility (0.3–1) × depth (1–2) × freshness (0–1)
```

| Factor | How it's computed |
|---|---|
| contradiction | from the signal: none 0 · mild 1 (talked big holding 9) · clear 2 (boast then lost) · flagrant 3 (boast then lost holding ≥ 10, bomb died in hand) |
| visibility | 1 if both sides are on screen or in the round result; 0.6 if one side needs memory (earlier round); 0.3 if inferred (think time, dealt strength) |
| depth | 1 same moment · 1.5 same-match callback · 2 cross-match callback |
| freshness | product of: target fatigue (0 if 2 hits in 3 rounds, else 1 − 0.3 × recent hits), ledger rerun (0.4 if same bit on same pid < 24 h), mechanism repeat (0.5 if same mechanism < 3 min) |

Thresholds: micro ≥ 1.5 · stage ≥ 2.5 · legendary ≥ 3.5. Then the existing dice (rarity chance × heat × boredom × feedback) decide among what passed. Today's predicates become the source of `contradiction`; nothing else in the bits changes.

## 4. Answers to the integration questions

1. **Generate text and audio together?** Yes, chosen together inside one authored performance, because timing is shared (the sting lands on the last word). But the script names a cue *function*, so the Audio Director can soften or drop the sound without touching the text.
2. **Deterministic audio selection?** Yes. Cue function is authored; the variant is chosen with a seeded RNG (seed = performance id) so every phone plays the same variant.
3. **Should AI select an SFX directly?** No. Not at runtime, not by a model. Selection is part of authoring and review, like the text. A model may help *draft* bits offline, which humans approve (the bible process).
4. **SFX rarity.** Two layers: the bit's rarity (Comedy Director) and the cue's tier (Audio Director, AUDIO_TAXONOMY §3). If a bit is allowed but its cue is on cooldown, the cue degrades one tier (or to none); the visual still plays.
5. **Cooldowns.** Bit cooldown, target fatigue, mechanism repeat (Comedy Director) · cue cooldown, per-tier frequency (Audio Director) · emote rate per player (Audio Director).
6. **Simultaneous events.** One fact → at most one bit (+ the existing payoff/legendary companion). Across facts, the stage queue keeps 3, drops lowest rarity, legendary never dropped. On the speakers: play-critical (your turn, countdown on the active phone) > comedy > table > emote.
7. **A cue is already playing.** Comedy bus is exclusive: a new comedy cue waits if the current one ends within 1.5 s, else it is dropped (the visual still shows). Table cues are polyphonic with a 60–120 ms minimum gap per cue. A player's new emote cuts their previous one.
8. **Player muted.** The Audio Director no-ops on that phone; visuals unchanged. Bits are written to work muted (COMEDY_BIBLE §5), so the director doesn't need to know. Optionally (P2) phones report their sound mode in presence and the director prefers visual-led bits when most phones are muted.
9. **Online sync.** Only the host decides. The performance carries `at` = host server time + 600 ms; each phone converts with its Firebase server offset and starts stage and audio at `at`. Arriving more than 1.5 s late: skip audio, show a shortened visual. Players who join later don't receive past performances.
10. **Do all clients hear the same comedy event?** Everyone sees the same thing. Who *hears* it depends on where people are:
    - **Remote** (default): every phone plays the cue.
    - **Same room** (room setting "Main di satu tempat"): one speaker plays table sounds and comedy cues (the host's phone) to avoid four slightly offset copies sounding like an echo. Personal cues (your turn, countdown) still play on the owner's phone.
    - Optional **spotlight** for comedy in the same room: the cue plays only on the target's phone, so the sound literally comes from the person being roasted. P2, worth a playtest.

## 5. Worked examples (Part 10)

Text structures are slot patterns in the system voice, not final copy and not taken from any external source.

**1. Silence after the boast**
- EVENT: round ends; Ana loses holding 10 cards.
- CONTEXT: she typed a boast 40 s earlier.
- PLAYER HISTORY: none needed.
- COMEDIC OPPORTUNITY: flagrant confidence vs outcome.
- COMEDY MECHANISM: silence.
- TEXT STRUCTURE: none.
- AUDIO FUNCTION: `sys.drop` (everything ducks) for 4.5 s, then normal sound returns.
- TIMING: 0.6 s after the result table appears.
- INTENSITY: stage (rare).
- WHY IT WORKS: the table supplies the punchline; any words would be weaker than everyone looking at her.

**2. The quote comes back**
- EVENT: Budi loses holding 3 cards.
- CONTEXT: boasted this round.
- PLAYER HISTORY: —
- COMEDIC OPPORTUNITY: confidence vs outcome, mild gap.
- COMEDY MECHANISM: irony + callback.
- TEXT STRUCTURE: [system notice: earlier message detected · name · N seconds ago] → [their words in a bubble] → [one flat word].
- AUDIO FUNCTION: `sys.stopcut` at freeze, `sys.chime` with the notice, nothing on the last word.
- TIMING: freeze at result, notice +1.5 s, bubble +2 s, word +2 s.
- INTENSITY: stage.
- WHY IT WORKS: their own words, timestamped, are the setup; the last word adds nothing, which is the point.

**3. The unpaid boast**
- EVENT: Cici wins round 6.
- CONTEXT: Dodi boasted and lost in round 4; nothing was said then.
- PLAYER HISTORY: ezLost setup, 2 rounds old.
- COMEDIC OPPORTUNITY: delayed bill during someone else's moment.
- COMEDY MECHANISM: callback + misdirection.
- TEXT STRUCTURE: [screen dims as if for the winner] → [an open microphone at Dodi's seat: "mic opened for X"] → [nothing] → ["mic closed"].
- AUDIO FUNCTION: `sys.drop` while the mic is open; `sys.paper` (stamp) on close.
- TIMING: 1.1 s after the win.
- INTENSITY: stage.
- WHY IT WORKS: misdirection (the spotlight looks like it's for the winner) and a callback nobody expected anymore.

**4. A prediction that came true**
- EVENT: Ana wins.
- CONTEXT: she predicted it in chat this round.
- PLAYER HISTORY: —
- COMEDIC OPPORTUNITY: the system has to concede.
- COMEDY MECHANISM: understatement.
- TEXT STRUCTURE: [one word of confirmation].
- AUDIO FUNCTION: none.
- TIMING: 1.1 s after the result.
- INTENSITY: micro.
- WHY IT WORKS: grudging minimum acknowledgement is funnier than praise.

**5. Admitted, then repeated**
- EVENT: Dodi passes with a legal play.
- CONTEXT: one round ago he wrote that he played wrong.
- PLAYER HISTORY: confession record.
- COMEDIC OPPORTUNITY: words vs behaviour.
- COMEDY MECHANISM: irony + callback.
- TEXT STRUCTURE: [customer-service notice: "your admission is on record:" + his quote] → +2 s [status line: repeated].
- AUDIO FUNCTION: `sys.chime`, then `sys.paper` (typing) on the status line.
- TIMING: right after the pass.
- INTENSITY: stage.
- WHY IT WORKS: the system uses his own sentence as evidence and changes only one word.

**6. The photo-memory**
- EVENT: round 3, fourth card played.
- CONTEXT: in round 2 Budi lost holding a single 9♣; nothing was said.
- PLAYER HISTORY: kenangan setup.
- COMEDIC OPPORTUNITY: delayed, unprompted remembrance.
- COMEDY MECHANISM: delayed callback.
- TEXT STRUCTURE: [photo-app style toast: "memories" · "a few minutes ago at this table" · card thumbnail · name · round].
- AUDIO FUNCTION: `sys.chime` (soft).
- TIMING: mid-play, never on the active player's decision with < 10 s left.
- INTENSITY: micro.
- WHY IT WORKS: the delay makes the system feel like it was thinking about it.

**7. "This has never happened"**
- EVENT: Budi reaches 1 card for the third time this match.
- CONTEXT: lost on 1 card twice already.
- PLAYER HISTORY: thread, times = 2.
- COMEDIC OPPORTUNITY: history about to repeat.
- COMEDY MECHANISM: gaslighting → correction.
- TEXT STRUCTURE: now: [reassurance that this has never happened]. If he loses: [smallest possible correction].
- AUDIO FUNCTION: `tension.hold` under the reassurance; none on the correction.
- TIMING: reassurance only if no other player is on ≤ 2 cards (clutch gate), else at round end; correction 2 s after the result.
- INTENSITY: micro, twice.
- WHY IT WORKS: the system's lie sets up its own retraction.

**8. The bomb that never went off**
- EVENT: round 5 starts.
- CONTEXT: Cici ended round 4 holding four of a kind.
- PLAYER HISTORY: prasasti setup.
- COMEDIC OPPORTUNITY: the most expensive waste in Capsa.
- COMEDY MECHANISM: delayed deadpan, fake seriousness.
- TEXT STRUCTURE: [the four cards, greyed, as a memorial] · [round number] · [status: did not explode].
- AUDIO FUNCTION: `sys.drop` short (1.5 s) under the memorial; no sting.
- TIMING: 6 s into the new round.
- INTENSITY: micro.
- WHY IT WORKS: solemnity for a card game; the delay means it lands when they've moved on.

**9. The pass that gets promoted**
- EVENT: Dodi passes with a legal play for the 3rd, 5th, 7th time.
- CONTEXT: same round.
- PLAYER HISTORY: passPlayable count.
- COMEDIC OPPORTUNITY: habit forming in real time.
- COMEDY MECHANISM: escalation with a ceiling.
- TEXT STRUCTURE: [pass label] → [habit label] → [principle-of-life label] → (no more changes).
- AUDIO FUNCTION: `sting.tiny` at the first label, half volume at the second, none at the third.
- TIMING: on the pass.
- INTENSITY: micro.
- WHY IT WORKS: the words escalate while the sound gives up.

**10. The long meeting**
- EVENT: Ana passes after 26 s and three cancelled selections.
- CONTEXT: —
- PLAYER HISTORY: —
- COMEDIC OPPORTUNITY: process vs decision.
- COMEDY MECHANISM: anti-climax, deadpan.
- TEXT STRUCTURE: [seat tag: meeting N seconds · result: pass].
- AUDIO FUNCTION: none.
- TIMING: 0.8 s after the pass.
- INTENSITY: micro.
- WHY IT WORKS: the measurement is real; silence matches "nothing came of it".

**11. Pretend nothing happened**
- EVENT: a bomb wins the round.
- CONTEXT: the core already plays the big explosion.
- PLAYER HISTORY: —
- COMEDIC OPPORTUNITY: size gap.
- COMEDY MECHANISM: understatement, audio/text mismatch.
- TEXT STRUCTURE: [polite question whether something just made a noise].
- AUDIO FUNCTION: none (the explosion was the expectation).
- TIMING: 2.4 s after the explosion settles.
- INTENSITY: micro, once per match.
- WHY IT WORKS: everyone just heard it; the system's polite deafness is the joke.

**12. The grand opening**
- EVENT: the match's first play is the forced lone 3♦.
- CONTEXT: first play of the match.
- PLAYER HISTORY: —
- COMEDIC OPPORTUNITY: ceremony for an obligation.
- COMEDY MECHANISM: exaggeration → anti-climax.
- TEXT STRUCTURE: [banner: official opening] → [the card in a spotlight] → [the round was opened with the smallest card] → [(mandatory)].
- AUDIO FUNCTION: `fanfare.overblown` under the banner, `sting.deflate` on "(mandatory)".
- TIMING: holds the timer while it plays.
- INTENSITY: stage, once per match.
- WHY IT WORKS: big sound for the smallest card; the deflate tells the truth.

**13. Glory, measured**
- EVENT: Cici's straight is beaten 4 s after she played it.
- CONTEXT: —
- PLAYER HISTORY: last big combo + timestamp.
- COMEDIC OPPORTUNITY: short-lived triumph.
- COMEDY MECHANISM: anti-climax.
- TEXT STRUCTURE: [duration of X's glory: N seconds].
- AUDIO FUNCTION: `sting.tiny`.
- TIMING: right after the beating play.
- INTENSITY: micro.
- WHY IT WORKS: a stopwatch on a feeling.

**14. The system mourns**
- EVENT: the system's favourite loses with 9 cards.
- CONTEXT: the favourite has received approval stamps this match.
- PLAYER HISTORY: favourite, approvals shown.
- COMEDIC OPPORTUNITY: the institution has a side.
- COMEDY MECHANISM: taking sides, gaslighting.
- TEXT STRUCTURE: [black ribbon on the seat] → [the system is in mourning] → [this round does not count] → [(it counts)].
- AUDIO FUNCTION: `sys.drop` during mourning; `sting.deflate` (soft) on "(it counts)".
- TIMING: 1.1 s after the result.
- INTENSITY: stage (rare).
- WHY IT WORKS: favouritism was set up quietly over rounds; now it pays off.

**15. Debt settled**
- EVENT: Budi wins against Ana.
- CONTEXT: two rounds ago Ana cost him 24 points.
- PLAYER HISTORY: grudge.
- COMEDIC OPPORTUNITY: revenge as a transaction.
- COMEDY MECHANISM: callback + fake seriousness.
- TEXT STRUCTURE: [settlement receipt: debt from round N · amount · paid by · received from] → [stamp: paid].
- AUDIO FUNCTION: `sys.paper` (receipt), then `sys.paper` (stamp).
- TIMING: at the result.
- INTENSITY: stage.
- WHY IT WORKS: revenge told in the driest possible format.

**16. Wanted**
- EVENT: Ana wins her third round in a row.
- CONTEXT: —
- PLAYER HISTORY: streak.
- COMEDIC OPPORTUNITY: dominance makes her the target.
- COMEDY MECHANISM: fake seriousness.
- TEXT STRUCTURE: [wanted poster: name · N wins in a row · worthless reward].
- AUDIO FUNCTION: `sys.paper` (stamp).
- TIMING: at the result.
- INTENSITY: stage.
- WHY IT WORKS: turns the table against the leader without insulting anyone.

**17. Bounty claimed**
- EVENT: Dodi beats Ana, ending her streak.
- CONTEXT: bounty active.
- PLAYER HISTORY: bounty.
- COMEDIC OPPORTUNITY: payoff of #16.
- COMEDY MECHANISM: callback, understatement.
- TEXT STRUCTURE: [notice: bounty on X claimed by Y · reward: none].
- AUDIO FUNCTION: `sys.chime`.
- TIMING: at the result.
- INTENSITY: stage.
- WHY IT WORKS: the "reward" promised earlier was nothing, and now it's delivered.

**18. Rivalry made official**
- EVENT: Ana beats Budi again.
- CONTEXT: across matches they're 7–6.
- PLAYER HISTORY: head-to-head in the room's notes.
- COMEDIC OPPORTUNITY: a long rivalry gets a scoreboard.
- COMEDY MECHANISM: callback + exaggeration.
- TEXT STRUCTURE: [all-time score card: A x – y B] → [next round: now].
- AUDIO FUNCTION: `tension.hold` (short), cut by `sys.stopcut`.
- TIMING: at the result.
- INTENSITY: stage, once per pair per match.
- WHY IT WORKS: the numbers are real and only this table has them.

**19. Welcome back**
- EVENT: round 1 of a new match.
- CONTEXT: Budi played yesterday and lost on the last card twice.
- PLAYER HISTORY: dossier, quotable moment < 24 h.
- COMEDIC OPPORTUNITY: the system remembers.
- COMEDY MECHANISM: callback, deadpan.
- TEXT STRUCTURE: [welcome back, name] · [title] → +2 s [we have not forgotten: moment].
- AUDIO FUNCTION: `sys.chime`.
- TIMING: 4 s into round 1.
- INTENSITY: stage, one player per match.
- WHY IT WORKS: continuity across evenings; the 24 h limit keeps it a tease, not a grudge.

**20. Shown, then lost**
- EVENT: Dodi loses with 8 cards.
- CONTEXT: he showed his whole hand to everyone mid-round.
- PLAYER HISTORY: reveal.
- COMEDIC OPPORTUNITY: proof becomes evidence.
- COMEDY MECHANISM: irony.
- TEXT STRUCTURE: [the shown cards again, stamped "shown"] → [one flat principle about transparency and results].
- AUDIO FUNCTION: `sys.paper` (stamp).
- TIMING: 1.1 s after the result.
- INTENSITY: stage, once per player per match.
- WHY IT WORKS: he chose to show them; the system only shows them again.

**21. Returned to sender**
- EVENT: Cici loses with 7 cards.
- CONTEXT: she sent a laughing emote this round.
- PLAYER HISTORY: emote log.
- COMEDIC OPPORTUNITY: taunt comes back.
- COMEDY MECHANISM: irony, callback.
- TEXT STRUCTURE: [her own emote replayed at her seat] → [small note: returned to sender].
- AUDIO FUNCTION: her emote's sound at half volume; nothing on the note.
- TIMING: 1.1 s after the result.
- INTENSITY: micro.
- WHY IT WORKS: uses her own mascot against her.

**22. The system switches sides**
- EVENT: Budi loses a 6th round in a row, 30 points behind.
- CONTEXT: genuinely bad run.
- PLAYER HISTORY: spiral.
- COMEDIC OPPORTUNITY: instead of piling on, change allegiance.
- COMEDY MECHANISM: taking sides (support).
- TEXT STRUCTURE: [policy notice: the system now supports name until conditions improve] (then approval stamps go to him).
- AUDIO FUNCTION: `sys.chime`; no sting.
- TIMING: at round start of the next round.
- INTENSITY: stage, once per match.
- WHY IT WORKS: kindness in the institution's voice; keeps the losing player in the game.

**23. The duel, after the fact**
- EVENT: Ana and Cici both reached 1 card; Ana won.
- CONTEXT: clutch gate held everything during the race.
- PLAYER HISTORY: hitOne per seat.
- COMEDIC OPPORTUNITY: frame the race as an official duel.
- COMEDY MECHANISM: exaggeration, deadpan result.
- TEXT STRUCTURE: [official duel record: A vs C · decided by one card].
- AUDIO FUNCTION: `sys.paper` (stamp).
- TIMING: at the result, never during the race.
- INTENSITY: micro.
- WHY IT WORKS: respects the tense moment, then names it.

**24. Hope, not data**
- EVENT: Dodi, last at −45, wins the round.
- CONTEXT: biggest underdog result possible.
- PLAYER HISTORY: scores before.
- COMEDIC OPPORTUNITY: the system briefly believes.
- COMEDY MECHANISM: gaslighting → correction (legendary).
- TEXT STRUCTURE: [his score shown as first place] · [latest standings] → [apology: that was hope, not data] (real score returns).
- AUDIO FUNCTION: `fanfare.overblown`, cut by `glitch`.
- TIMING: 1.6 s after the result; holds the timer.
- INTENSITY: legendary.
- WHY IT WORKS: two seconds of an impossible world, then the system admits it was wishing.

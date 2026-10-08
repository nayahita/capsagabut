# Audio Asset Spec (minimal set)

16 cues. All original, synthesized or recorded for this game, mono, 44.1 or 22.05 kHz, normalised to −16 LUFS short-term for one-shots (table cues −22 LUFS). Files live in `audio/` and stay replaceable by name.

"Reuse" says which v11 file can be adapted instead of made from scratch.

| ASSET ID | FUNCTION | CATEGORY | INTENSITY | DURATION | LOOP / ONE-SHOT | VARIANTS | WHEN IT CAN PLAY | WHEN IT MUST NOT PLAY | Reuse |
|---|---|---|---|---|---|---|---|---|---|
| `card.place` | a card / pair / triple hits the table | table | very low | 60–140 ms | one-shot | 3 (+ pitch ±3 %) | every play | never stacked within 60 ms | core synth `card` |
| `card.combo` | a five-card combo lands | table | low | 250–450 ms | one-shot | 2 | straight, flush, full house | during a comedy freeze | core synth `straight` |
| `bomb.impact` | four of a kind / straight flush | table | high | 1.2–2.0 s | one-shot | 1 | bomb plays (built-in rarity) | — | core synth `bomb` |
| `pass.knock` | a pass | table | very low | 80–160 ms | one-shot | 2 | every pass | as a comedy punchline | core synth `pass` |
| `turn.nudge` | it's your turn | table (personal) | low | 200–350 ms | one-shot | 1 | only on the active player's phone | on other phones; during your own freeze-hold | new |
| `timer.tick` | last 5 seconds | table (personal) | low | 40–80 ms | one-shot | 2 (alternating) | active phone, ≤ 5 s left | when the timer is held by a bit | core synth `tick` |
| `round.resolve` | someone won the round | table | low–mid | 500–900 ms | one-shot | 1 | every round end, identical for all | no loser variant, ever | `audio/win.wav` (shortened) |
| `ui.tap` | selection / button | ui | very low | 20–50 ms | one-shot | 1 | optional | — | new |
| `sys.chime` | the institution speaks (notification) | comedy | low–mid | 300–600 ms | one-shot | 2 | stage/micro bits with a notice | twice within 20 s; under player chat bursts | `audio/comedy/notify.wav` |
| `sys.paper` | bureaucracy: stamp, receipt, typing | comedy | mid | 150–900 ms | one-shot | 3 (stamp, print, type) | receipts, posters, archives | as a generic sting | `stamp`, `register`, `typing` |
| `sys.stopcut` | interruption / freeze start | comedy | mid | 300–600 ms | one-shot | 1 | freezes, callback starts, cutting a build | more than once per round | `tape-stop` |
| `sys.drop` | engineered silence: duck all buses to −40 dB | comedy | — | 1.5–5 s | control cue (no file) | — | flagrant contradictions, mourning, mic bits | more than 2 per match; during the countdown | `duck()` extended |
| `sting.tiny` | smallest punctuation after a dry line | comedy | low | 120–300 ms | one-shot | 3 | micro bits | more than once per round; on repeats (step down) | `deflate` (short cut) |
| `sting.deflate` | anti-climax after a build | comedy | low–mid | 400–900 ms | one-shot | 1 | after fanfare / announcement | without a build before it | `deflate` |
| `tension.hold` | low pulse under a freeze or a claim | comedy | low | 1.5–6 s | loop (fade in/out) | 1 | freezes, "never happened", rivalry card | during actual play decisions | `heartbeat` |
| `fanfare.overblown` | ceremony for something trivial | comedy (rare) | mid–high | 1.2–2.2 s | one-shot | 1 | exaggeration bits (opening 3♦, hope) | more than twice per match; for real achievements | `drumroll` + new brass-like synth |

### Optional (only if playtests ask for them)

| ASSET ID | FUNCTION | Note |
|---|---|---|
| `legend.motif` | signature for legendary moments | 3–4 note original motif, 1.5–2.5 s; once per match max |
| `glitch` | system "breaks" | already exists (`audio/comedy/glitch.wav`) |
| `applause.polite` | 2–3 slow claps from a tiny room | risk: reads as canned audience; test before adding |
| `emote.*` | six emote sounds | keep current synth, shorten to ≤ 600 ms, no trope sounds |

### Retire from automatic use

Air horn, sad trombone, rimshot, crickets, record scratch, boing, honk (Meme pack). Not used by any cue above. If the Meme pack stays as an option, it must not trigger on every win, loss, or timeout.

### Production notes

- Every comedy cue needs a clean onset (< 10 ms) so it can land exactly on a word.
- Keep tails short; the next line of text should not wait for reverb.
- Test on a phone speaker at 50 % volume in a noisy room: if `sys.chime` isn't recognisable there, it's too subtle; if `card.place` is noticeable after 20 plays, it's too loud.

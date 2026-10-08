# Comedy + Audio design set (audit, v11 codebase)

Design only. No production code was changed for this set.

Read in this order:

| File | Covers (brief parts) |
|---|---|
| [ARCHITECTURE_GAP_ANALYSIS.md](ARCHITECTURE_GAP_ANALYSIS.md) | Part 1 audit of the current code, Part 12 gap analysis + P0–P3 |
| [COMEDY_BIBLE.md](COMEDY_BIBLE.md) | Part 2 research findings, voice, principles, Part 5 restraint |
| [COMEDY_TAXONOMY.md](COMEDY_TAXONOMY.md) | Part 3 trigger taxonomy, which suggested triggers are valid |
| [COMEDY_MEMORY_SPEC.md](COMEDY_MEMORY_SPEC.md) | Part 4 memory: what to keep, expire, decay, never store; callbacks; anti-repeat |
| [AUDIO_BIBLE.md](AUDIO_BIBLE.md) | Part 6 audio identity, Part 7 audio comedy mechanisms |
| [AUDIO_TAXONOMY.md](AUDIO_TAXONOMY.md) | functional audio categories, event → cue map, Part 9 rarity |
| [COMEDY_AUDIO_INTEGRATION.md](COMEDY_AUDIO_INTEGRATION.md) | Part 8 pipeline, Part 10 worked examples (24) |
| [AUDIO_ASSET_SPEC.md](AUDIO_ASSET_SPEC.md) | Part 11 minimal asset list (16 cues) |
| [COMEDY_EVALUATION_RUBRIC.md](COMEDY_EVALUATION_RUBRIC.md) | how to judge a bit and the whole system, playtest protocol |

The one rule everything else serves: **the table already did the setup.** The system only ever adds the last beat, and most of the time the right last beat is nothing.

Related earlier docs: `docs/COMEDY_DIRECTOR.md` (architecture as built), the "Capsa Game-Native Comedy Corpus v1" and "Comedy Bible v2" docs (content).

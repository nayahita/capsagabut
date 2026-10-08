# Audio Taxonomy

Every sound is a **cue** with a function. Code asks for a cue by function (`sting.tiny`), never for a file. The Audio Director resolves the cue to an asset variant, a bus, a route (which phones), and a time.

## 1. Cue families

| Family | Cue IDs | Bus | Who may trigger |
|---|---|---|---|
| table | `card.place`, `card.combo`, `pass.knock`, `turn.nudge`, `timer.tick`, `round.resolve`, `bomb.impact` | table | core |
| ui | `ui.tap` | ui | core |
| emote | `emote.*` (6) | emote | players |
| system | `sys.chime`, `sys.paper`, `sys.stopcut`, `sys.drop` | comedy | Comedy Director |
| reaction | `sting.tiny`, `sting.deflate`, `tension.hold`, `applause.polite`, `fanfare.overblown`, `glitch` | comedy | Comedy Director |
| signature | `legend.motif` | comedy (exclusive) | Comedy Director, legendary only |

## 2. Event → cue map (target)

| Game event | Cue | Notes |
|---|---|---|
| Card / pair / triple played | `card.place` (variant by size) | every phone |
| Straight, flush, full house | `card.combo` | every phone; combo banner carries drama |
| Four of a kind / straight flush | `bomb.impact` | every phone; already rare |
| Pass | `pass.knock` | every phone, quiet |
| Auto-skip ("nobody can answer") | `pass.knock` ×2, then nothing | no rimshot |
| Your turn begins | `turn.nudge` | only that player's phone |
| Last 5 s | `timer.tick` | only the active phone |
| Timeout | none by default | the comedy layer may respond (C4) |
| Round won | `round.resolve` | every phone; no loser sound |
| Emote | `emote.<type>` | every phone, ≤ 1 per player per 4 s, half volume for the first 2 rounds of play |
| Chat bubble | none | text is enough |
| Show hand | `ui.tap` on the sender only | the reveal is visual |
| Comedy bit | whatever cue its script names by function | resolved by Audio Director |

## 3. Rarity hierarchy (Part 9)

| Tier | Cues | Target frequency | Cooldown | Context requirement | Reset |
|---|---|---|---|---|---|
| **Utility** | table, ui, emote | as the game dictates | per-cue minimum gap 60–120 ms (prevent stacking) | none | — |
| **Common** | `sys.chime`, `sys.paper`, `sting.tiny` | ≤ 1 per round | same cue 20 s | a micro or stage bit is playing | per match |
| **Uncommon** | `sting.deflate`, `sys.stopcut`, `tension.hold`, `applause.polite` | ≤ 1 per 3 rounds | same cue 3 min | a stage bit with a build | per match |
| **Rare** | `sys.drop` (full silence), `fanfare.overblown`, `glitch` | ≤ 2 per match | same cue 10 min | contradiction ≥ 2 or a callback payoff | per match |
| **Legendary** | `legend.motif` | ≤ 1 per match, typically 1 per several matches | once per match | legendary bit only | per match; across matches a 24 h soft cooldown (×0.5) |

### Escalation inside a tier

For repeated behaviour, the cue goes **down** a tier each time, not up: first time `sting.tiny`, second time half volume, third time nothing. Repeated sounds announce that the system has a template; quieter-then-silent sounds announce that the system has noticed and given up, which is funnier and less tiring.

### What rarity resets

- Per-cue counters reset at `game:start` (a new match is a new evening).
- The legendary motif carries a cross-match soft cooldown via the ledger so two consecutive short matches don't both get it.
- Utility cues never accumulate.

### Anti-patterns this prevents

- A sad sound after every loss (no loser sound exists).
- An air horn after every win (win is a short, warm, unchanging resolve).
- The same sting three times in a round (common tier: ≤ 1 per round).
- Two comedy cues stacked (comedy bus is exclusive).

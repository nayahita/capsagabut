# Comedy Taxonomy (Capsa)

Every comedic opportunity, in the form:
TRIGGER → CONTEXT → COMEDIC OPPORTUNITY → REQUIRED MEMORY → COMEDY MECHANISM → TARGET → INTENSITY → FREQUENCY → COOLDOWN → EXAMPLE STRUCTURE.

Intensity: **micro** (seat tag, small caption) · **stage** (notification, panel, freeze) · **legendary** (once per match).
Frequency: how often the situation itself occurs at a 4-player table (very common = most rounds, common = every few rounds, occasional = a few per match, rare = once per several matches).
Data status: ✓ available in v11 · ◐ partial · ✗ missing (see ARCHITECTURE_GAP_ANALYSIS).

## 1. Which suggested triggers are valid for Capsa

| Suggested trigger | Verdict | Why |
|---|---|---|
| Bad play | Valid only when visible and repeated | A single odd play is often strategy; comment only on patterns (overkill, passing with a play, holding 2s to death) |
| Spectacular blunder | Valid | Dying with a bomb or two 2s in hand is unambiguous and visible in the round result |
| Unexpected win | Valid | Weak dealt hand, last place, or long losing streak → win |
| Unexpected loss | Valid with history | Strong dealt hand or favourite loses; without history it's just a loss |
| Clutch | Valid, after the fact | Comment at round end, never during the race |
| Comeback | Valid | Already detected (BIG_COMEBACK, UPSET_WIN) |
| Repeated pass | Valid as escalation | Pass with a legal play, counted per round and across matches |
| Repeated mistake | Valid | Strongest when the player admitted it in chat first |
| Bluff | **Mostly invalid** | Capsa has no betting; nothing to bluff with. The only bluff channel is chat (covered by boast/prediction) and show-hand (cards are real, can't be faked) |
| Failed bluff | Folded into "boast then lost" | Same reason |
| Talking before the outcome | Valid, strongest category | Chat is the player writing their own setup |
| "EZ" then losing | Valid | Special case of the above |
| Revenge | Valid | Grudge from a big penalty, settled later |
| Rivalry | Valid across matches | Needs head-to-head history; same-match "rivalry" is just a grudge |
| Streak | Valid, sparingly | Win streak → bounty; loss streak → institution steps in; never a sound per loss |
| Sudden reversal | Valid | Big combo beaten within seconds |
| Too confident | Valid when measurable | Boast while holding many cards, show-hand then lose |
| Unusually quiet | Weak | Needs a chat baseline per player; low payoff, risk of reading moods. P2 |
| Suspicious behaviour | **Invalid** | Implies cheating; accusatory, unfair, and the system can't verify it |
| Absurd card combination | Rare, valid | Opening forced 3♦, finishing on a lone 3, Straight Flush |
| Same behaviour repeatedly | Valid | Lead habit, think-then-pass, timeouts |
| Destroyed after trash talk | Valid, top intensity | Silence, not words |

## 2. Taxonomy

### A. Words vs outcome

| ID | TRIGGER | CONTEXT | OPPORTUNITY | REQUIRED MEMORY | MECHANISM | TARGET | INTENSITY | FREQUENCY | COOLDOWN | EXAMPLE STRUCTURE |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | Boast / "EZ" then loses the same round | confidence signal recorded | confidence vs outcome | chat text + label ✓, cards left ✓ | irony + callback | the boaster | stage | occasional | once per boast; 5 min per player | [freeze] → [their exact words] → [pause] → [one flat word] |
| A2 | Boast then loses with ≥ 10 cards | flagrant contradiction | the gap speaks for itself | as A1 ✓ | silence | the boaster | stage (silence) | rare | once per match | [nothing for 4–5 s] |
| A3 | Boast, then loss forgotten, then someone else wins rounds later | table moved on | delayed bill | ezLost setup ✓ | callback + misdirection | the old boaster | stage | rare | once per setup | [someone else's moment] → [spotlight moves to boaster] → [empty mic] |
| A4 | Prediction comes true | rare correct claim | system forced to concede | prediction label ✓ | understatement | predictor | micro | rare | once per player per match | [one word of acknowledgement] |
| A5 | Admits a mistake, then repeats it | confession = implied promise | words vs behaviour | confession ✓, mistake kind ✓ | irony + callback | confessor | stage | occasional | once per player per match | [their admission, quoted] + [status updated to: repeated] |
| A6 | Talks big while holding many cards | position contradicts words | dry note-taking | cards held at chat time ✓ | deadpan | talker | micro | common | 3 min | [one lowercase word under their seat] |
| A7 | Laughing emote, then loses big | taunt without words | taunt returned | emote log ✓ | irony | sender | micro | occasional | 5 min | [same emote replayed at sender] + [return-to-sender note] |
| A8 | Shows hand, then loses | public overconfidence | proof turned evidence | reveal ✓ | irony | show-off | stage | occasional | once per player per match | [shown cards again, stamped] + [one flat principle] |
| A9 | Shows hand, then wins | earned swagger | concede, minimally | reveal ✓ | understatement | show-off | micro | occasional | once per player per match | [one word] |
| A10 | Pokes the same player twice, that player wins | provocation backfired | target becomes winner | pokes ◐ (count only, no timestamp to order against the result) | irony + taking sides | poker | micro | occasional | 5 min | [status: provocation received] + [result] |

### B. Last card and near misses

| ID | TRIGGER | CONTEXT | OPPORTUNITY | REQUIRED MEMORY | MECHANISM | TARGET | INTENSITY | FREQUENCY | COOLDOWN | EXAMPLE STRUCTURE |
|---|---|---|---|---|---|---|---|---|---|---|
| B1 | Loses on 1 card, first time | no history | store, don't comment | last card ✓ | silence → delayed callback | loser | none now; micro later | common | — | [nothing] … next round: [memory-photo toast with the card] |
| B2 | Same player on 1 card again | thread open | audience knows the pattern | thread ✓ | callback + tension | that player | micro | occasional | 3 min | [short reminder of origin round] |
| B3 | …wins this time | thread resolves well | growth | thread ✓ | understatement | that player | micro | occasional | 5 min | [dry progress note] |
| B4 | …loses again (2nd/3rd) | pattern confirmed | history repeating | thread times ✓ | escalation + gaslighting | that player | stage | rare | once per player | [denial of pattern] → later [smallest possible correction] |
| B5 | Two players both on 1 card | duel | formal framing | hitOne per seat ✓ | exaggeration | both | micro, **after** the round | occasional | 5 min | [duel announced as an official event] + [result read flatly] |
| B6 | Loses holding a single 2 as last card | saved the strongest card | strategy of saving failed | last card ✓ | irony | loser | micro | occasional | 5 min | [card value] + [its fate] |
| B7 | Wins while another player sat on 1 card (clutch) | race decided | the near-winner's view | counts at final play ✓ | understatement | near-winner | micro | occasional | 5 min | [the number of cards they needed: one] |

### C. Holding back, passivity, hesitation

| ID | TRIGGER | CONTEXT | OPPORTUNITY | REQUIRED MEMORY | MECHANISM | TARGET | INTENSITY | FREQUENCY | COOLDOWN | EXAMPLE STRUCTURE |
|---|---|---|---|---|---|---|---|---|---|---|
| C1 | Dies holding a 2 after passing with a legal play | strength unused | potential never spent | hand at end ✓, passPlayable ✓ | delayed deadpan | holder | micro (next round) | common | 4 min | [card shown as a memorial] + [never played] |
| C2 | Dies holding a bomb | strongest card unused | biggest waste in Capsa | quad in hand ✓ | irony | holder | stage | rare | 5 min | [the bomb] + [status: did not explode] |
| C3 | Passes repeatedly with a legal play | habit forming | label promotion | passPlayable ✓ | escalation | passer | micro | common | per round | [label] → [more serious label] → [philosophical label] → [silence] |
| C4 | Timeout | absent or stalling | institutional concern | timeout ✓ | fake seriousness | that player | stage | occasional | 3 min | [are you still there?] + [countdown] + [one-sided conclusion] |
| C5 | Long think (≥ 20 s) or 2+ cancels, then pass | effort, zero output | process vs decision | thinkMs ✓, cancels ✓ | anti-climax | that player | micro | common | 4 min per player | [duration, officially measured] + [result: pass] |
| C6 | Strong dealt hand, loses with many cards | capital wasted | input vs output | dealt summary ✓ | irony + fake analytics | loser | stage | occasional | 8 min | [opening capital] / [remaining] / [remark: unused] |
| C7 | Weak dealt hand, wins | no capital needed | data irrelevant | dealt ✓ | understatement | winner | micro | occasional | 6 min | [hand rated below average] + [result: not relevant] |

### D. Power and reversals

| ID | TRIGGER | CONTEXT | OPPORTUNITY | REQUIRED MEMORY | MECHANISM | TARGET | INTENSITY | FREQUENCY | COOLDOWN | EXAMPLE STRUCTURE |
|---|---|---|---|---|---|---|---|---|---|---|
| D1 | Five-card combo beaten within seconds | short glory | glory measured | last big + time ✓ | anti-climax | original player | micro | common | 2 min | [duration of glory, in seconds] |
| D2 | A 2 used on a low single | overkill | wastefulness | overkill ✓ | understatement | player | micro | common | 3 min | [value comparison, no verdict] |
| D3 | Bomb win | huge built-in effect | pretend nothing happened | how=bomb ✓ | understatement + pretend | none (table) | micro, after the effect | occasional | 5 min | [pause] + [polite question about a noise] |
| D4 | Same player locks the table repeatedly | dominance | power exaggerated | skips per player ◐ | exaggeration | dominant player | micro | occasional | 5 min | [table status: under administration of X] |
| D5 | Match opens with the forced lone 3♦ | mandatory ritual | ceremony for nothing | first play ✓ | exaggeration → anti-climax | none | stage | once per match | once | [grand opening] + [content: smallest card] + [(mandatory)] |
| D6 | Straight flush / 3rd bomb of the match | genuinely rare | system "breaks" | cat, bomb count ✓ | absurdity | player | legendary | rare | once per match | [system error] + [cause: name] |

### E. Standings and streaks

| ID | TRIGGER | CONTEXT | OPPORTUNITY | REQUIRED MEMORY | MECHANISM | TARGET | INTENSITY | FREQUENCY | COOLDOWN | EXAMPLE STRUCTURE |
|---|---|---|---|---|---|---|---|---|---|---|
| E1 | 3 wins in a row | one player dominating | becomes the hunted | streak ✓, bounty ✓ | fake seriousness | leader | stage | occasional | per bounty | [wanted poster] + [worthless reward] |
| E2 | 3–4 losses in a row | bad run, not yet a spiral | the institution intervenes | streak ✓ | fake seriousness | loser | stage | occasional | once per streak | [invitation / wellbeing offer] + [identical options] |
| E3 | Last place wins from far behind | hope vs data | system briefly believes | scoresBefore ✓ | gaslighting | winner | legendary | rare | once per match | [hoped-for standings] → [correction] |
| E4 | System favourite loses badly | system has a side | system mourns | favourite ✓ | taking sides | favourite | stage | rare | once per match | [mourning] + [denial of result] + [small correction] |
| E5 | Score falls 5 rounds in a row | steady decline | corporate euphemism | score history ✓ | fake analytics + understatement | that player | stage | rare | 10 min | [real chart] + [optimistic wrong forecast] |
| E6 | Spiral (5+ losses, far last) | genuinely bad | switch sides | spiral ✓ | taking sides (support) | that player | stage | rare | once per match | [policy: the system now supports X] |

### F. Between players

| ID | TRIGGER | CONTEXT | OPPORTUNITY | REQUIRED MEMORY | MECHANISM | TARGET | INTENSITY | FREQUENCY | COOLDOWN | EXAMPLE STRUCTURE |
|---|---|---|---|---|---|---|---|---|---|---|
| F1 | Beats the same player 3× in a round | regular victim | administrative violation | beats per pair ✓ | fake seriousness | aggressor | stage | occasional | once per pair | [formal warning] + [no consequences] |
| F2 | Wins against the player who once cost them a lot | debt repaid | transaction settled | grudges ✓ | callback + revenge | avenger | stage | occasional | 6 min | [settlement receipt] + [stamp] |
| F3 | Passed with a play, next player wins | someone let them through | assign blame | enabler ✓ | taking sides | enabler | stage | occasional | 5 min | [crime-scene tape] + [key witness: X] |
| F4 | Round ends, blame the uninvolved | misattribution | scapegoat | beatBy ✓ | misdirection | least involved loser | stage | occasional | 15 min | [official investigation] → [most irrelevant name] |
| F5 | Pair with long, close head-to-head | real rivalry | make it official | h2h across matches ✓ | callback + exaggeration | both | stage | rare | once per pair per match | [all-time score] + [next round: now] |

### G. Across matches, meta

| ID | TRIGGER | CONTEXT | OPPORTUNITY | REQUIRED MEMORY | MECHANISM | TARGET | INTENSITY | FREQUENCY | COOLDOWN | EXAMPLE STRUCTURE |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | Returning player, round 1 | has records | system remembers | dossier ✓, quotable < 24 h ✓ | callback | returning player | stage | per match | 1 player per match | [welcome back] + [title] + [optional: one fact < 24 h] |
| G2 | Breaks a long-standing habit | pattern changes | system confused | lead habit across matches ✓ | irony | that player | micro | rare | once per match | [usual: X (%)] → [system needs time] |
| G3 | Repeats yesterday's embarrassment | history repeating | archive reopened | moments < 24 h ✓, matching ◐ | callback | that player | stage | rare | once per day | [yesterday: moment] / [today: moment] / [stamp: ongoing] |
| G4 | Comes back after disconnecting | absence | attendance record | rejoin ✓ | deadpan | that player | micro | occasional | 5 min | [back] + [cards missed] |
| G5 | Long session (40+ min or round 12+) | shared fatigue | system notices the room | duration ✓ | meta | table | micro | once per match | once | [observation about screen or hour] |
| G6 | Match of 8+ rounds ends | closure | the match was a film | match record ✓ | meta + roast | table | stage | per long match | once | [credits from real data] |
| G7 | Known player under a new name | identity continuity | records follow | aliases ✓, rename signal ✗ | deadpan | that player | micro | rare | once per match | [new name (previously: old)] + [records still apply] |

## 3. Combination strength

Humor strength roughly multiplies: **event × own words × history × visibility**.

| Combination | Typical strength |
|---|---|
| Event alone (any loss) | too weak — no bit |
| Event + visible contradiction (boast + loss) | micro–stage |
| Event + same-match history (2nd last-card loss) | stage |
| Event + own words + history (admitted mistake, repeated) | stage, strongest common case |
| Event + cross-match history (yesterday's blunder repeated) | stage, use within 24 h only |
| Event + own words + flagrant gap (EZ, then 10 cards left) | silence (top) |

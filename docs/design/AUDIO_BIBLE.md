# Audio Bible

Original audio identity for Capsa Banting, defined by function. No sound in the game copies or imitates a specific recording from a game, film, anime, meme, or social video.

## 1. Identity

**"A quiet card table inside a very formal institution."**

- **The table** (core game): wooden, close, physical. Cards are soft paper slaps, chips of wood, a small felt thud. Short, dry, low-mid frequencies, no reverb tails. These sounds play often, so they must be nearly invisible: you'd miss them if they were gone, you don't notice them while they're there.
- **The institution** (comedy voice): clean office electronics and paperwork. A notification chime, a rubber stamp, a receipt printer, a cassette stopping, a polite single bell. Mid-high, precise, slightly too neat. This is the system's voice; when it appears, the room knows the system is talking.
- **The rare register** (legendary): one short original motif (3–4 notes) that is only heard at legendary moments. Its rarity is its meaning.

The contrast between warm table and cold institution is itself a comedy tool: the institution treating a card game with paperwork sounds is the audio version of fake seriousness.

### What changes from v11

The default "Meme" pack leans on stock trope sounds (air horn, sad trombone, rimshot, crickets, record scratch, boing), synthesized but recognisable as internet clichés, and they play constantly: an air horn on every win and full house, a sad trombone at the end of every round (first loser's cry emote) and on every timeout that forces a pass. That trains players to ignore exactly the sounds a comedy system needs. Direction:

1. Core sounds become the quiet "table" palette; the default pack stops scoring every loss.
2. Trope-shaped sounds are removed from automatic triggers. If any survive, they become rare comedy cues that only the Comedy Director can call, and they must be redesigned so they don't evoke a specific meme.
3. Emote sounds stay but get shorter, softer, and rate-limited per player.

## 2. Categories (Part 6)

### Core game audio — frequent, utility, never comedic on their own

| Function | Notes |
|---|---|
| Card placed (single/pair/triple) | soft slap; 3 variants to avoid machine-gun repetition |
| Five-card combo placed | slightly fuller slap + short sweep; the combo name banner carries the drama, not the sound |
| Pass | a soft knock on the table |
| Your turn | gentle two-note nudge, only on the phone whose turn it is |
| Countdown (last 5 s) | wood tick, only on the active phone |
| Round won | short warm resolve (≤ 1 s), same for everyone, no losing sound |
| Bomb | the one big core sound (fuse + low impact), already rare by game design |
| UI feedback | tiny click for selections; optional |

There is deliberately **no "lose" sound**. Losing is told by cards and numbers. A loss sound would play every round for most of the table.

### Comedy audio — rare, functional, called only by the Comedy Director

| Function | Use |
|---|---|
| Drop (silence) | everything else ducks to near zero; the sound of nothing happening |
| Stop-cut | an interruption (cassette/tape stop) that freezes the moment |
| System chime | the institution has something to say (notifications) |
| Paperwork hit | stamp, receipt, typing: bureaucracy arriving |
| Tiny sting | the smallest punctuation after a dry line (micro bits) |
| Deflate | anti-climax after a build-up |
| Tension hold | a low pulse under a freeze (heartbeat-like, original) |
| Polite applause | two or three slow claps from a very small, unenthusiastic room |
| Overblown fanfare | ceremony for something trivial (exaggeration only) |
| Glitch | the system "breaking" (legendary absurdity) |
| Legendary motif | the signature, once per match at most |

### Ambient / reaction — mostly not needed

A crowd bed or constant tension music would fight the players' own voices at a real table. Keep only:

| Function | Use |
|---|---|
| Room tone under freeze | a very quiet hum so a freeze doesn't sound like a crash (optional) |
| Duel pulse | soft pulse while two players sit on 1 card, local to those two phones only (optional, P2) |

No crowd laughter, ever. Canned laughter tells players what is funny; the system's whole stance is that it never admits a joke happened.

## 3. Audio comedy mechanisms (Part 7)

Pattern for every audio joke: **EVENT → EXPECTED AUDIO → SUBVERSION → EFFECT**.

| Mechanism | Event | Expected | Subversion | Effect | Use when |
|---|---|---|---|---|---|
| Silence | someone boasts, then loses with 10 cards | a fail sound | everything drops out for 4 s | the table fills the silence itself | flagrant contradiction only; stage budget |
| Understatement | a bomb wins the round | more explosion | after the explosion, a tiny polite bell + one-line question | the size gap is the joke | after big built-in effects; never instead of them |
| Contrast | trivial event (opening 3♦) | nothing | overblown fanfare, then a deflate | ceremony mismatch | ritual moments, once per match |
| Misdirection | system chime as if praising | a positive jingle | the same chime introduces an audit | the chime itself becomes suspicious over time | notifications that turn |
| Escalation | the same behaviour repeats | the same sound again | each repeat gets a *smaller* sound, then none | the system visibly giving up | repeated passes, repeated timeouts |
| Interruption | a build-up (drumroll, freeze) | a payoff hit | stop-cut mid-build, then a flat line | expectation cut off | anti-climax bits, rare |
| Delayed reaction | a blunder | an immediate reaction | nothing; 1–2 rounds later a soft chime with the callback | memory feels real | delayed callbacks (kenangan, prasasti) |
| Exaggerated reaction | a small win after a long slump | a small jingle | fanfare, then cut to a stamp | over-the-top as a callback to the slump | only with history behind it |
| Anti-climax | "important announcement" | a reveal | deflate, then "nothing" | the build was the joke | very rare, low chance |
| Audio/text mismatch | a disaster | a sad sound | a cheerful system chime with a deadpan disaster report | institution's indifference | fake-seriousness bits |

### Rules for subverting expectation

- Only subvert an expectation the game has taught. If the game never plays a fail sound, silence after a blunder has to be made noticeable (ducking everything), otherwise it isn't heard as a choice.
- Subversion needs the original to exist most of the time. A table that hears the polite bell after every bomb stops finding it funny; keep it rare (once per match).
- Never subvert during play-critical audio (your-turn nudge, countdown). Those stay honest, and engineered silence must not mute them (v11's `duck` currently does).

## 4. Mixing priorities

1. Player voices at a real table (online in the same room): nothing should be loud enough to talk over.
2. Play-critical cues (your turn, countdown) on the active phone.
3. Comedy cue in progress (ducks everything below it).
4. Core table sounds.
5. Emotes.

Comedy never plays on top of another comedy cue; it waits (stage queue) or drops.

## 5. Muted players

Every bit must work fully with sound off. Audio adds timing and weight; it never carries the joke alone. A muted phone still shows the freeze, the text, the stamp. Silence bits work best muted (the freeze is visible).

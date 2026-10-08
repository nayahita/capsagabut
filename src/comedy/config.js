/*
 * Comedy Director settings. Tweak here; the bits themselves live in bits.js.
 */
window.CAPSA_COMEDY = {
  settings: {
    enabled: true,
    debug: false,                 // true: log every decision (and every skipped one) to the console
    replaceReactionCards: true,   // turn off the older judgement cards from src/reactions.js (their stats still count)

    // Base chance that an eligible bit actually plays. Silence is the default.
    chance: { COMMON: 0.3, UNCOMMON: 0.18, RARE: 0.08, LEGENDARY: 1 },

    // Two budgets. "micro" = small text, seat tags, corner toasts. "stage" = notifications, panels, freezes, modals.
    budget: {
      micro: { perRound: 2, gapMs: 8000 },
      stage: { perRound: 1, gapMs: 20000 },   // RARE and LEGENDARY ignore the gap
    },
    legendaryPerMatch: 1,
    heatWindowMs: 240000,         // recent performances inside this window (about two rounds) lower the chance…
    heatPerPerformance: 1.2,      // …by 1 / (1 + 1.2 × count)
    boredomPerRound: 0.35,        // every quiet round raises the chance by 35% …
    boredomMax: 2,                // … up to 2×
    callbackBoost: 1.5,           // callbacks are the payoff of memory, so they get a boost
    sameModePenalty: 0.5,         // same comedy mode within 60 s gets halved
    maxChance: 0.95,
  },

  // Original sounds, replaceable: drop in your own file with the same name, or change the path.
  sounds: {
    notify: 'audio/comedy/notify.wav',
    tapeStop: 'audio/comedy/tape-stop.wav',
    typing: 'audio/comedy/typing.wav',
    drumroll: 'audio/comedy/drumroll.wav',
    stamp: 'audio/comedy/stamp.wav',
    glitch: 'audio/comedy/glitch.wav',
    kazoo: 'audio/comedy/kazoo.wav',
    deflate: 'audio/comedy/deflate.wav',
    heartbeat: 'audio/comedy/heartbeat.wav',
    register: 'audio/comedy/register.wav',
    gavel: 'audio/comedy/gavel.wav',
    error: 'audio/comedy/error.wav',
    whoosh: 'audio/comedy/whoosh.wav',
    memorial: 'audio/comedy/memorial.wav',
    cctvHum: 'audio/comedy/cctv-hum.wav',
    credits: 'audio/comedy/credits.wav',
  },
};

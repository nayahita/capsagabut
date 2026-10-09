/*
 * Social catalog: everything a player can send to the table (quick chat lines + emotes), the voice-line manifest,
 * and every limit the social system uses. This is the file to edit.
 *
 * Ids are what travels over the network: 'qc.<id>' for a quick chat line, 'emo.<id>' for an emote.
 * Only ids listed here are accepted by any phone, so nobody can push their own text or audio URL through it.
 * Changing a line's text later is safe (the id stays); removing an id makes older phones ignore it.
 *
 * tone (used by the social history and the comedy layer):
 *   respect · taunt · confidence · reaction · local
 * comedy labels on quick chat (read by src/comedy/memory.js through the 'chat' fact):
 *   trash – a taunt that can age badly · prediction – a claim about this round · confession – owning a mistake
 * voice: an id from VOICE below (optional). A line with a voice still works when the file is missing or sound is off.
 */
(function () {
  'use strict';

  const CONFIG = {
    // sender side (this phone): one cooldown per kind, so an emote right after a quick chat is fine
    cooldown: { emote: 1500, quick: 1500, voice: 5000 },
    // receiver side (every phone, timed by the server clock so all phones decide the same way)
    receive: {
      minGapMs: { emote: 900, quick: 900 },  // a sender faster than this (a modified client) is ignored
      burst: { n: 6, ms: 10000 },            // and no more than this many actions per sender per window
      voiceGapMs: 4500,                      // voice lines per sender
      repeatMs: 6000,                        // the same action again within this window: shown small, no voice
      freshVisualMs: 6000,                   // older than this when it arrives: not drawn (still remembered)
      freshVoiceMs: 2500,                    // older than this: drawn, but never voiced
      rememberMs: 30000,                     // older than this: ignored completely
    },
    display: { emoteMs: 2300, bubbleMs: 3200, repeatScale: 0.8 },
    voice: { maxMs: 2600, placeholder: true },  // placeholder: synthesized "babble" when a voice file is missing
    favorites: { emotes: ['laugh', 'cry', 'smirk', 'skull'], quick: ['gg', 'ez', 'belum', 'kokbisa'] },
  };

  const CATEGORIES = [
    { id: 'respect', label: 'Respek' },
    { id: 'taunt', label: 'Ejek' },
    { id: 'confidence', label: 'Pede' },
    { id: 'reaction', label: 'Reaksi' },
    { id: 'local', label: 'Bacot' },
  ];

  const QUICK = [
    // Respek
    { id: 'gg', cat: 'respect', text: 'GG', voice: 'stoic.gg' },
    { id: 'mainbagus', cat: 'respect', text: 'Main bagus' },
    { id: 'nicetry', cat: 'respect', text: 'Nice try' },
    { id: 'respek', cat: 'respect', text: 'Respek, bang', voice: 'stoic.respek' },
    { id: 'ampun', cat: 'respect', text: 'Ampun, suhu', confession: true },
    // Ejek
    { id: 'ez', cat: 'taunt', text: 'EZ', trash: true, voice: 'clown.ez' },
    { id: 'gitudoang', cat: 'taunt', text: 'Gitu doang?', trash: true, voice: 'villain.gitudoang' },
    { id: 'skill', cat: 'taunt', text: 'Skill issue', trash: true },
    { id: 'kelamaan', cat: 'taunt', text: 'Kelamaan mikir', trash: true },
    { id: 'kasian', cat: 'taunt', text: 'Kasian…', trash: true },
    { id: 'hoki', cat: 'taunt', text: 'Hoki doang itu', trash: true },
    // Pede
    { id: 'liataja', cat: 'confidence', text: 'Liat aja', trash: true, prediction: true, voice: 'villain.liataja' },
    { id: 'belum', cat: 'confidence', text: 'Belum selesai', prediction: true, voice: 'underdog.belum' },
    { id: 'punyagua', cat: 'confidence', text: 'Ronde ini punya gua', trash: true, prediction: true },
    { id: 'tunggu', cat: 'confidence', text: 'Tunggu tanggal mainnya', prediction: true },
    // Reaksi
    { id: 'hah', cat: 'reaction', text: 'HAH?!' },
    { id: 'serius', cat: 'reaction', text: 'Serius?!' },
    { id: 'kokbisa', cat: 'reaction', text: 'Kok bisa?!', voice: 'dramatic.kokbisa' },
    { id: 'mati', cat: 'reaction', text: 'Mati gua 💀', confession: true, voice: 'clown.ambulans' },
    { id: 'apaan', cat: 'reaction', text: 'Itu apaan barusan?!' },
    { id: 'salahbuang', cat: 'reaction', text: 'Salah buang gua', confession: true },
    // Bacot (local flavour)
    { id: 'jangansenang', cat: 'local', text: 'Jangan senang dulu', prediction: true },
    { id: 'santai', cat: 'local', text: 'Santai dulu' },
    { id: 'yakin', cat: 'local', text: 'Yakin banget?', voice: 'stoic.yakin' },
    { id: 'waduh', cat: 'local', text: 'Waduh, bro' },
    { id: 'sabar', cat: 'local', text: 'Sabar…' },
  ];

  /*
   * Emotes. The first six already live in the game (mascot faces in index.html). New ones bring their own face:
   * `face(h)` returns SVG drawn on the same card-mascot body (viewBox 0 0 100 120; h has ln, INK, MOUTH, TEAR).
   * pack groups emotes in the picker, so a future pack is just more entries with a new pack name.
   * sfx: which built-in emote sound to play when there is no voice line.
   */
  const EMOTES = [
    { id: 'laugh', label: 'Ketawa', say: 'HEHEHE', tone: 'taunt', pack: 'Dasar', sfx: 'laugh' },
    { id: 'cry', label: 'Nangis', say: 'HUHUHU', tone: 'reaction', pack: 'Dasar', sfx: 'cry', voice: 'dramatic.tidak' },
    { id: 'angry', label: 'Marah', say: 'GRRR!', tone: 'reaction', pack: 'Dasar', sfx: 'angry' },
    { id: 'thumbs', label: 'Mantap', say: 'MANTAP!', tone: 'respect', pack: 'Dasar', sfx: 'thumbs' },
    { id: 'shock', label: 'Kaget', say: 'HAH?!', tone: 'reaction', pack: 'Dasar', sfx: 'shock' },
    { id: 'cool', label: 'Santai', say: 'EZ', tone: 'taunt', pack: 'Dasar', sfx: 'cool' },
    { id: 'smirk', label: 'Senyum licik', say: 'HEH.', tone: 'taunt', pack: 'Dasar', sfx: 'cool',
      face: (h) => `<path d="M27 44l17-5" ${h.ln}/><path d="M56 41q8-7 16 0" ${h.ln}/>
        <path d="M30 54h14M56 54h14" ${h.ln}/><circle cx="40" cy="57" r="3.5" fill="${h.INK}"/><circle cx="66" cy="57" r="3.5" fill="${h.INK}"/>
        <path d="M37 79q17 5 28-11" ${h.ln}/>` },
    { id: 'facepalm', label: 'Tepok jidat', say: 'ADUH…', tone: 'reaction', pack: 'Dasar', sfx: 'cry',
      face: (h) => `<path d="M56 56q7 5 14 0" ${h.ln}/><path d="M40 84h20" ${h.ln}/>
        <g class="m-palm"><rect x="16" y="36" width="42" height="28" rx="12" fill="#fbf7ee" stroke="#e2b04f" stroke-width="4"/>
        <path d="M24 37v-9M33 36v-11M42 36v-11M51 38v-8" stroke="#e2b04f" stroke-width="4" stroke-linecap="round"/></g>` },
    { id: 'skull', label: 'Wafat', say: 'WAFAT', tone: 'reaction', pack: 'Dasar', sfx: 'shock', voice: 'clown.ambulans',
      face: (h) => `<path d="M31 46l12 12M43 46l-12 12M57 46l12 12M69 46l-12 12" ${h.ln}/>
        <path d="M37 79h26" ${h.ln}/><path d="M48 80h12v7q0 7-6 7t-6-7z" fill="#e8564d"/>
        <g class="m-soul"><path d="M76 30q0-13 10-13t10 13v13l-3.5-3-3 3-3.5-3-3 3-3.5-3z" fill="#e9e3d6" stroke="${h.INK}" stroke-width="2"/>
        <circle cx="83" cy="29" r="1.8" fill="${h.INK}"/><circle cx="89" cy="29" r="1.8" fill="${h.INK}"/></g>` },
    { id: 'stare', label: 'Datar', say: '…', tone: 'reaction', pack: 'Dasar',
      face: (h) => `<circle cx="35" cy="55" r="4.5" fill="${h.INK}"/><circle cx="65" cy="55" r="4.5" fill="${h.INK}"/>
        <path d="M41 81h18" ${h.ln}/><g class="m-dots"><circle cx="70" cy="24" r="3" fill="${h.INK}"/><circle cx="79" cy="24" r="3" fill="${h.INK}"/><circle cx="88" cy="24" r="3" fill="${h.INK}"/></g>` },
    { id: 'salute', label: 'Hormat', say: 'HORMAT!', tone: 'respect', pack: 'Dasar', sfx: 'thumbs', voice: 'stoic.respek',
      face: (h) => `<path d="M29 54q7-6 14 0M57 54q7-6 14 0" ${h.ln}/><path d="M40 78q10 6 20 0" ${h.ln}/>
        <g class="m-salute"><rect x="62" y="20" width="34" height="13" rx="6.5" transform="rotate(-24 62 26)" fill="#fbf7ee" stroke="#e2b04f" stroke-width="4"/></g>` },
    { id: 'sweat', label: 'Keringetan', say: 'AMAN… KAYAKNYA', tone: 'reaction', pack: 'Dasar', sfx: 'shock',
      face: (h) => `<path d="M28 45l14-5M72 45l-14-5" ${h.ln}/><circle cx="37" cy="55" r="4.5" fill="${h.INK}"/><circle cx="63" cy="55" r="4.5" fill="${h.INK}"/>
        <path d="M34 80l5-4 5 4 5-4 5 4 5-4 5 4 5-4" ${h.ln} stroke-width="3.5"/>
        <path class="m-drop" d="M82 30q-7 11 0 16q7-5 0-16z" fill="${h.TEAR}"/>` },
    { id: 'clap', label: 'Tepuk pelan', say: 'WAH. HEBAT.', tone: 'taunt', pack: 'Dasar',
      face: (h) => `<path d="M30 55h14M56 55h14" ${h.ln}/><circle cx="37" cy="58" r="3" fill="${h.INK}"/><circle cx="63" cy="58" r="3" fill="${h.INK}"/>
        <path d="M42 77h16" ${h.ln}/>
        <g class="m-clap"><rect class="m-hl" x="28" y="86" width="18" height="22" rx="9" fill="#fbf7ee" stroke="#e2b04f" stroke-width="4"/>
        <rect class="m-hr" x="54" y="86" width="18" height="22" rx="9" fill="#fbf7ee" stroke="#e2b04f" stroke-width="4"/></g>` },
    { id: 'villain', label: 'Penjahat', say: 'MUAHAHA', tone: 'taunt', pack: 'Dasar', sfx: 'laugh', voice: 'villain.liataja', bg: '#e9def7',
      face: (h) => `<path d="M25 41l19 9M75 41l-19 9" ${h.ln} stroke-width="5.5"/>
        <path d="M31 57q7-5 13 0M56 57q7-5 13 0" ${h.ln}/>
        <path d="M27 70q23 22 46 0q-23 9-46 0z" fill="${h.MOUTH}"/>
        <path d="M32 72l4 5 4-4 4 5 4-5 4 5 4-5 4 4 4-5 4 5" stroke="#fff" fill="none" stroke-width="2.5" stroke-linejoin="round"/>` },
  ];

  /*
   * Voice lines: original scripts only. Put your own recordings at `file` (short, < 2.5 s, mp3/ogg/wav).
   * A missing or broken file never blocks the quick chat: the line is shown, and (if CONFIG.voice.placeholder)
   * a short synthesized babble in the archetype's pitch plays instead. See audio/voice/README.md.
   */
  const VOICE = {
    'stoic.gg':          { file: 'audio/voice/stoic-gg.mp3',          archetype: 'stoic',    line: 'GG.' },
    'stoic.respek':      { file: 'audio/voice/stoic-respek.mp3',      archetype: 'stoic',    line: 'Respek.' },
    'stoic.yakin':       { file: 'audio/voice/stoic-yakin.mp3',       archetype: 'stoic',    line: 'Yakin?' },
    'clown.ez':          { file: 'audio/voice/clown-ez.mp3',          archetype: 'clown',    line: 'Gampang banget~' },
    'clown.ambulans':    { file: 'audio/voice/clown-ambulans.mp3',    archetype: 'clown',    line: 'Panggil ambulans!' },
    'villain.liataja':   { file: 'audio/voice/villain-liataja.mp3',   archetype: 'villain',  line: 'Sekarang… perhatikan.' },
    'villain.gitudoang': { file: 'audio/voice/villain-gitudoang.mp3', archetype: 'villain',  line: 'Cuma segitu?' },
    'underdog.belum':    { file: 'audio/voice/underdog-belum.mp3',    archetype: 'underdog', line: 'Gua belum selesai!' },
    'dramatic.kokbisa':  { file: 'audio/voice/dramatic-kokbisa.mp3',  archetype: 'dramatic', line: 'Kok bisaaa?!' },
    'dramatic.tidak':    { file: 'audio/voice/dramatic-tidak.mp3',    archetype: 'dramatic', line: 'Tidaaak!' },
  };
  // placeholder babble per archetype: base pitch (Hz), glide over the line, syllable length (s), vibrato depth
  const ARCHETYPES = {
    villain:  { f0: 105, glide: -0.25, syl: 0.17, vib: 0.01, wave: 'sawtooth' },
    clown:    { f0: 320, glide: 0.35,  syl: 0.09, vib: 0.06, wave: 'square' },
    stoic:    { f0: 150, glide: 0,     syl: 0.13, vib: 0,    wave: 'triangle' },
    underdog: { f0: 190, glide: 0.3,   syl: 0.11, vib: 0.02, wave: 'sawtooth' },
    dramatic: { f0: 240, glide: -0.45, syl: 0.16, vib: 0.08, wave: 'sawtooth' },
  };

  window.CAPSA_SOCIAL = { CONFIG, CATEGORIES, QUICK, EMOTES, VOICE, ARCHETYPES };
})();

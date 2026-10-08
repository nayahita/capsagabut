/*
 * Loads the game modules in Node with small browser stubs, so comedy/memory/lore logic can be tested without a browser.
 * Usage: const H = require('./harness')({ names: ['Ana','Budi'] }); then H.E (CapsaEvents), H.D (CapsaComedy), ...
 */
const fs = require('fs'), path = require('path');
module.exports = function harness(opt = {}) {
  const SRC = path.join(__dirname, '..', '..', 'src');
  const store = Object.assign({}, opt.store || {});
  global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  global.window = global; global.addEventListener = () => {};
  const doc = new EventTarget();
  doc.createElement = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {} }, setAttribute() {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [] });
  doc.head = { appendChild() {} }; doc.body = { appendChild() {} }; doc.documentElement = { classList: { add() {}, remove() {} } };
  doc.querySelector = () => null; doc.querySelectorAll = () => [];
  global.document = doc;
  global.CustomEvent = class extends Event { constructor(t, o) { super(t); this.detail = o && o.detail; } };
  global.matchMedia = () => ({ matches: false });
  global.requestAnimationFrame = (f) => setTimeout(f, 0);
  const H = { perfs: [], names: opt.names || ['Ana', 'Budi', 'Cici', 'Dodi'], room: null, sound: false };
  global.CapsaFX = {
    view: () => ({ authority: true, names: H.names, timer: 30, online: false, phase: 'turn', scores: [], counts: [] }),
    broadcast: (t, d) => { if (t === 'comedy') H.perfs.push(d); },
    holdTimer() {}, duck() {}, label: (c) => 'c' + c, soundOn: () => H.sound, audio: () => null,
    room: () => H.room, fact: (t, d) => global.CapsaEvents.ingest(t, d), serverNow: () => Date.now(),
  };
  const files = opt.files || ['reactions.config.js', 'events.js', 'stats.js', 'lore.js', 'reactions.js', 'comedy/config.js', 'comedy/director.js', 'comedy/memory.js', 'comedy/bits.js'];
  for (const f of files) {
    const p = path.join(SRC, f);
    if (fs.existsSync(p)) (0, eval)(fs.readFileSync(p, 'utf8'));
  }
  Object.assign(H, { E: global.CapsaEvents, D: global.CapsaComedy, M: global.CapsaMemory, L: global.CapsaLore, S: global.CapsaStats, store });
  H.wait = (ms) => new Promise((r) => setTimeout(r, ms));
  H.fails = 0;
  H.ok = (name, cond, extra) => { if (!cond) H.fails++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (!cond && extra ? '  → ' + extra : '')); };
  H.done = () => { console.log(H.fails ? `\n${H.fails} FAILED` : '\nall passed'); process.exit(H.fails ? 1 : 0); };
  H.sigs = []; H.E.on('*', (ev) => { if (ev && /^MEM_|_WIN$|_LOSE$|_STREAK$|BAD_BEAT/.test(ev.type)) H.sigs.push(ev); });
  H.has = (t) => H.sigs.some((s) => s.type === t); H.take = (t) => H.sigs.filter((s) => s.type === t);
  setInterval(() => {}, 1000).unref();
  return H;
};

/*
 * Language: English by default, Indonesian as the second language. Each phone picks its own (saved on that phone).
 *
 *   tr('Your turn!', 'Giliran lu!')      → the string for the current language (English if no Indonesian is given)
 *   CapsaI18n.set('id')                  → switch, re-render (fires 'capsa:lang' on document)
 *   CapsaI18n.both(fn)                   → { en: fn() in English, id: fn() in Indonesian }, for text one phone builds
 *                                          and every phone shows (comedy performances, the table log)
 *   CapsaI18n.pick(v)                    → v as-is, or v.en / v.id when v is such a pair
 *
 * Call tr() when the text is shown or built, never once at load into a constant: the language can change mid-game.
 */
(function () {
  'use strict';
  const KEY = 'capsa-lang', LANGS = ['en', 'id'];
  let lang = 'en', forced = null;
  try { const v = localStorage.getItem(KEY); if (LANGS.includes(v)) lang = v; } catch (e) {}
  const cur = () => forced || lang;
  function tr(en, id) { return cur() === 'id' && id != null ? id : en; }
  function set(l) {
    if (!LANGS.includes(l) || l === lang) return false;
    lang = l;
    try { localStorage.setItem(KEY, l); } catch (e) {}
    if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = l;
    if (typeof document !== 'undefined' && document.dispatchEvent) document.dispatchEvent(new CustomEvent('capsa:lang', { detail: { lang: l } }));
    return true;
  }
  function both(fn) {
    const out = {}, prev = forced;
    for (const l of LANGS) { forced = l; try { out[l] = fn(l); } finally { forced = prev; } }
    return out;
  }
  const isPair = (v) => !!(v && typeof v === 'object' && !Array.isArray(v) && typeof (v.en != null ? v.en : v.id) === 'string' && Object.keys(v).every((k) => LANGS.includes(k)));
  function pick(v) { return isPair(v) ? (cur() === 'id' && v.id != null ? v.id : v.en != null ? v.en : v.id) : v; }
  // run fn with a language forced (tests, previews)
  function inLang(l, fn) { const prev = forced; forced = LANGS.includes(l) ? l : prev; try { return fn(); } finally { forced = prev; } }
  const locale = () => (cur() === 'id' ? 'id-ID' : 'en-US');
  // combo names are internal ids; only 'Satuan' differs on screen
  const combo = (n) => (n === 'Satuan' ? tr('Single', 'Satuan') : n);
  if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = lang;
  window.CapsaI18n = { lang: cur, set, tr, both, pick, isPair, inLang, locale, combo, langs: LANGS.slice() };
  window.tr = tr;
})();

/*
 * Player statistics, kept per device in localStorage and keyed by player name.
 *
 * Rounds, wins, losses, points and bomb wins come from the 'round:end' fact.
 * Everything else (bad beats, comebacks, best streak, ...) is counted by reactions:
 * each event in reactions.config.js can list stat fields to bump with `track`.
 *
 * API: CapsaStats.get(name), inc(name, field, n), max(name, field, value), all(), reset(), panelHTML(names)
 */
(function () {
  'use strict';
  const KEY = 'capsa-stats-v1';
  const key = (n) => String(n == null ? '' : n).trim().toLowerCase();
  let db = load();

  function load() {
    try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && d.players) return d; } catch (e) {}
    return { players: {} };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
  function blank(name) {
    return { name, rounds: 0, wins: 0, losses: 0, points: 0, bombWins: 0, bestWinStreak: 0, worstLossStreak: 0,
      badBeats: 0, comebacks: 0, upsets: 0, perfects: 0, revenges: 0, lastPlayed: 0 };
  }
  function rec(name) {
    const k = key(name);
    if (!k) return null;
    if (!db.players[k]) db.players[k] = blank(String(name).trim());
    return db.players[k];
  }
  function get(name) {
    const s = rec(name) || blank(name || '');
    return Object.assign({}, s, { winRate: s.rounds ? Math.round((s.wins / s.rounds) * 100) : 0 });
  }
  function inc(name, field, n) { const s = rec(name); if (!s) return; s[field] = (s[field] || 0) + (n == null ? 1 : n); save(); }
  function max(name, field, v) { const s = rec(name); if (!s) return; if ((s[field] || 0) < v) { s[field] = v; save(); } }
  function all() { return Object.values(db.players).map((s) => get(s.name)); }
  function reset() { db = { players: {} }; save(); }

  function onRoundEnd(d) {
    (d.names || []).forEach((nm, i) => {
      const s = rec(nm);
      if (!s) return;
      s.rounds += 1;
      if (i === d.winner) { s.wins += 1; if (d.how === 'bomb') s.bombWins += 1; } else s.losses += 1;
      const before = (d.scoresBefore || [])[i], after = (d.scoresAfter || [])[i];
      if (typeof before === 'number' && typeof after === 'number') s.points += after - before;
      s.lastPlayed = Date.now();
    });
    save();
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  function panelHTML(names) {
    const want = (names || []).map(key);
    let rows = all();
    if (want.length) rows = rows.filter((r) => want.includes(key(r.name)));
    rows.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);
    const cols = [['Ronde', 'rounds'], ['Menang', 'wins'], ['Win %', 'winRate'], ['Poin', 'points'], ['Streak terbaik', 'bestWinStreak'],
      ['Bad beat', 'badBeats'], ['Comeback', 'comebacks'], ['Upset', 'upsets'], ['Perfect', 'perfects'], ['Revenge', 'revenges'], ['Menang bom', 'bombWins']];
    const body = rows.length
      ? rows.map((r) => `<tr><th scope="row">${esc(r.name)}</th>${cols.map(([, f]) => `<td>${f === 'points' && r[f] > 0 ? '+' : ''}${r[f]}${f === 'winRate' ? '%' : ''}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${cols.length + 1}" class="empty">Belum ada data. Main satu ronde dulu.</td></tr>`;
    return `<section class="stats-panel" aria-label="Statistik pemain">
      <div class="stats-head"><h3>Statistik${want.length ? ' pemain di meja ini' : ''}</h3>
        <span class="stats-note">Kesimpen di device ini, dihitung per nama pemain.</span></div>
      <div class="stats-scroll"><table class="stats-table"><thead><tr><th scope="col">Pemain</th>${cols.map(([l]) => `<th scope="col">${l}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>
      <div class="stats-actions">${want.length ? '<button class="btn" data-act="stats-all">Lihat semua pemain</button>' : ''}<button class="btn" data-act="stats-reset">Reset statistik</button></div>
    </section>`;
  }

  if (window.CapsaEvents) window.CapsaEvents.on('fact:round:end', onRoundEnd);
  window.CapsaStats = { get, inc, max, all, reset, panelHTML };
})();

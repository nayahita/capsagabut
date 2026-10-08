/*
 * Identity + notes that outlive a match ("lore").
 *
 * Every player gets a stable id (pid). Names stay the way people type them; the id is what the
 * comedy memory keys on, so renaming keeps the history and two different "Budi"s never merge by accident.
 *
 * Where the notes live:
 *   one device  → localStorage ('capsa-lore-v1'), per device
 *   online room → rooms/CODE/lore in Firebase, written only by the host, read by every phone.
 *                 The room keeps it for a year after it was last opened (see the core).
 *
 * Stores:
 *   profiles  pid → { name, aliases[], uids{}, created, lastSeen, matches }
 *   dossier   pid → { c (reputation counters), lead{combo:n}, passes{playable,turns}, think{sum,n},
 *                     moments[{t,round,text,w,bad}], legends[{t,text}], matches, firstSeen, lastSeen }
 *   rivalry   'a|b' → { w{a:n,b:n}, big{pid,pen,t} }
 *   table     { matches, rounds, favs[{pid,name,t}], legends[{pid,name,text,t}], last }   (local: one per group of players)
 *   ledger    [{ id, pid, t, m }]   bits that played, newest last
 *
 * Roast window: embarrassing moments may be quoted for 24 hours (ROAST_MS); after that only the counters remain.
 */
(function () {
  'use strict';
  const LS_KEY = 'capsa-lore-v1', OLD_REP = 'capsa-rep-v1';
  const DAY = 24 * 3600 * 1000, ROAST_MS = DAY, YEAR = 365 * DAY;
  const REP0 = { rounds: 0, wins: 0, lastCardLosses: 0, badBeats: 0, hoards: 0, bombDeaths: 0, sealed: 0, passivePasses: 0,
    timeouts: 0, ezLosses: 0, revenges: 0, bombWins: 0, worstLossStreak: 0, bountiesClaimed: 0 };
  const CAP = { moments: 12, legends: 4, ledger: 150, favs: 6, tableLegends: 12 };
  const FX = () => window.CapsaFX;
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const norm = (n) => String(n == null ? '' : n).trim().replace(/\s+/g, ' ').toLowerCase();
  const empty = () => ({ v: 1, profiles: {}, dossier: {}, rivalry: {}, tables: {}, table: null, ledger: [] });
  let pidSeq = 0;
  const rand = () => { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0].toString(36); } catch (e) { return Math.floor(Math.random() * 1e9).toString(36); } };
  const newPid = () => { let p; do { p = 'p_' + Date.now().toString(36).slice(-5) + (++pidSeq).toString(36) + rand().slice(0, 4); } while ((L && (L.profiles[p] || L.dossier[p])) || pend[p]); return p; };
  const lev = (a, b) => {
    if (Math.abs(a.length - b.length) > 2) return 9;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  };

  /* ---------- backends ---------- */
  let L = null, mode = 'local', roomCode = null, dirty = false, saveT = 0;
  let roster = [];            // pids at the table this match
  const pend = {};            // profiles created this match, kept until the first round ends
  let matchSeq = 0;

  function loadLocal() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) {}
    if (d && d.v) return Object.assign(empty(), d);
    d = empty();
    try {   // move the old per-name reputation into profiles
      const rep = JSON.parse(localStorage.getItem(OLD_REP) || '{}') || {};
      Object.entries(rep).forEach(([k, r]) => {
        const pid = newPid(), name = (r && r.name) || k;
        d.profiles[pid] = { name, aliases: [], uids: {}, created: Date.now(), lastSeen: Date.now(), matches: 0 };
        const c = {}; Object.keys(REP0).forEach((f) => { if (r[f]) c[f] = r[f]; });
        d.dossier[pid] = { c, moments: [], legends: [] };
      });
    } catch (e) {}
    return d;
  }
  L = loadLocal();
  const canWrite = () => mode === 'local' || !!(FX() && FX().room && FX().room() && FX().room().isHost);
  function save() {
    if (!canWrite()) return;
    dirty = true; clearTimeout(saveT);
    saveT = setTimeout(() => {
      dirty = false;
      if (mode === 'local') { try { localStorage.setItem(LS_KEY, JSON.stringify(L)); } catch (e) {} }
      else { const r = FX() && FX().room && FX().room(); if (r && r.isHost) r.saveLore(L); }
    }, mode === 'local' ? 200 : 700);
  }
  function flush() { if (dirty) { clearTimeout(saveT); dirty = false; if (mode === 'local') { try { localStorage.setItem(LS_KEY, JSON.stringify(L)); } catch (e) {} } else { const r = FX() && FX().room && FX().room(); if (r && r.isHost) r.saveLore(L); } } }

  document.addEventListener('capsa:lore', (e) => {
    const d = e.detail || {};
    if (!d.code) { if (mode !== 'local') { flush(); mode = 'local'; roomCode = null; L = loadLocal(); } return; }
    const fresh = Object.assign(empty(), d.data || {});
    ['profiles', 'dossier', 'rivalry'].forEach((k) => { fresh[k] = fresh[k] || {}; });
    fresh.ledger = Array.isArray(fresh.ledger) ? fresh.ledger : Object.values(fresh.ledger || {});
    if (mode === 'room' && roomCode === d.code && canWrite() && dirty) return;   // host: own unsaved changes win
    if (mode === 'local') flush();
    mode = 'room'; roomCode = d.code; L = fresh;
    Object.values(L.dossier).forEach(fixDossier);
    Object.values(L.profiles).forEach((p) => { p.aliases = Array.isArray(p.aliases) ? p.aliases : Object.values(p.aliases || {}); p.uids = p.uids || {}; });
    rerenderPanels();
  });
  function fixDossier(x) {
    if (!x) return x;
    x.c = x.c || {}; x.lead = x.lead || {}; x.passes = x.passes || { playable: 0, turns: 0 }; x.think = x.think || { sum: 0, n: 0 };
    x.moments = Array.isArray(x.moments) ? x.moments : Object.values(x.moments || {});
    x.legends = Array.isArray(x.legends) ? x.legends : Object.values(x.legends || {});
    return x;
  }

  /* ---------- profiles ---------- */
  const allProfiles = () => Object.assign({}, L.profiles, pend);
  const profile = (pid) => allProfiles()[pid] || null;
  const namesOf = (p) => [p.name, ...(p.aliases || [])].map(norm);
  function resolve(name, taken) {
    const n = norm(name); if (!n) return { status: 'new' };
    const ps = Object.entries(L.profiles).filter(([pid]) => !(taken && taken.has(pid)));
    const exact = ps.find(([, p]) => namesOf(p).includes(n));
    if (exact) return { status: 'known', pid: exact[0], profile: exact[1] };
    if (n.length >= 3) {
      const near = ps.map(([pid, p]) => ({ pid, p, d: Math.min(...namesOf(p).map((x) => lev(x, n))) })).filter((x) => x.d <= 2).sort((a, b) => a.d - b.d)[0];
      if (near) return { status: 'similar', pid: near.pid, profile: near.p };
    }
    return { status: 'new' };
  }
  const decisions = {};   // setup screen choices: normalized name → pid | 'new'
  let renamed = {};       // pid → { from, to } for the match being set up
  // Called by the core (via CapsaHooks) right before 'game:start'. Returns one pid per seat.
  function assign(names, opt) {
    opt = opt || {}; renamed = {};
    const taken = new Set(), pids = [];
    names.forEach((name, i) => {
      const uid = opt.uids && opt.uids[i], claim = opt.claims && opt.claims[i], n = norm(name);
      let pid = null;
      if (uid) { const hit = Object.entries(L.profiles).find(([p, x]) => !taken.has(p) && x.uids && x.uids[uid]); if (hit) pid = hit[0]; }
      if (!pid && claim && claim !== 'new' && L.profiles[claim] && !taken.has(claim)) pid = claim;
      if (!pid && !uid && decisions[n] && decisions[n] !== 'new' && L.profiles[decisions[n]] && !taken.has(decisions[n])) pid = decisions[n];
      if (!pid && claim !== 'new' && decisions[n] !== 'new') { const r = resolve(name, taken); if (r.status === 'known') pid = r.pid; }
      if (pid) {
        const p = L.profiles[pid];
        if (norm(p.name) !== n) renamed[pid] = { from: p.name, to: String(name).trim() };
        if (norm(p.name) !== n) { if (!namesOf(p).includes(n)) p.aliases = [...new Set([...(p.aliases || []), p.name])].slice(-6); else p.aliases = (p.aliases || []).filter((a) => norm(a) !== n).concat(p.name); p.name = String(name).trim(); }
        if (uid) { p.uids = p.uids || {}; p.uids[uid] = true; }
      } else {
        pid = newPid();
        pend[pid] = { name: String(name).trim(), aliases: [], uids: uid ? { [uid]: true } : {}, created: Date.now(), lastSeen: Date.now(), matches: 0 };
      }
      taken.add(pid); pids.push(pid);
    });
    save();
    return pids;
  }
  window.CapsaHooks = window.CapsaHooks || {};
  window.CapsaHooks.gameStart = (d) => { if (canWrite()) d.pids = assign(d.names || [], { uids: d.uids, claims: d.claims }); };

  function rename(pid, name) {
    const p = L.profiles[pid]; name = String(name || '').trim(); if (!p || !name || !canWrite()) return false;
    if (norm(p.name) !== norm(name)) p.aliases = [...new Set([...(p.aliases || []), p.name])].filter((a) => norm(a) !== norm(name)).slice(-6);
    p.name = name; save(); return true;
  }
  function merge(from, into) {
    if (!canWrite() || from === into || !L.profiles[from] || !L.profiles[into]) return false;
    const a = L.profiles[from], b = L.profiles[into];
    b.aliases = [...new Set([...(b.aliases || []), a.name, ...(a.aliases || [])])].filter((x) => norm(x) !== norm(b.name)).slice(-8);
    b.uids = Object.assign({}, a.uids || {}, b.uids || {}); b.matches = (b.matches || 0) + (a.matches || 0);
    const da = fixDossier(L.dossier[from]), db = L.dossier[into] = fixDossier(L.dossier[into] || {});
    if (da) {
      Object.entries(da.c).forEach(([k, v]) => { db.c[k] = k === 'worstLossStreak' ? Math.max(db.c[k] || 0, v) : (db.c[k] || 0) + v; });
      Object.entries(da.lead).forEach(([k, v]) => { db.lead[k] = (db.lead[k] || 0) + v; });
      db.passes.playable += da.passes.playable; db.passes.turns += da.passes.turns; db.think.sum += da.think.sum; db.think.n += da.think.n;
      db.moments = [...db.moments, ...da.moments].sort((x, y) => x.t - y.t).slice(-CAP.moments);
      db.legends = [...db.legends, ...da.legends].sort((x, y) => x.t - y.t).slice(-CAP.legends);
    }
    Object.keys(L.rivalry).forEach((k) => {
      if (!k.split('|').includes(from)) return;
      const r = L.rivalry[k]; delete L.rivalry[k];
      const other = k.split('|').find((x) => x !== from); if (other === into) return;
      const nk = rkey(into, other), nr = L.rivalry[nk] = L.rivalry[nk] || { w: {} };
      nr.w[into] = (nr.w[into] || 0) + ((r.w || {})[from] || 0); nr.w[other] = (nr.w[other] || 0) + ((r.w || {})[other] || 0);
    });
    L.ledger.forEach((x) => { if (x.pid === from) x.pid = into; });
    delete L.profiles[from]; delete L.dossier[from];
    save(); return true;
  }
  function forget(pid) {
    if (!canWrite()) return false;
    delete L.profiles[pid]; delete L.dossier[pid]; delete pend[pid];
    Object.keys(L.rivalry).forEach((k) => { if (k.split('|').includes(pid)) delete L.rivalry[k]; });
    L.ledger = L.ledger.filter((x) => x.pid !== pid);
    const t = table(); if (t) { t.favs = (t.favs || []).filter((x) => x.pid !== pid); t.legends = (t.legends || []).filter((x) => x.pid !== pid); }
    save(); return true;
  }

  /* ---------- dossier ---------- */
  const dossier = (pid) => (pid && L.dossier[pid] ? fixDossier(L.dossier[pid]) : null);
  const ensure = (pid) => (L.dossier[pid] = fixDossier(L.dossier[pid] || {}));
  const counters = (pid) => Object.assign({}, REP0, (dossier(pid) || {}).c || {});
  function bump(pid, f, by) { if (!pid || !canWrite()) return; const d = ensure(pid); d.c[f] = (d.c[f] || 0) + (by == null ? 1 : by); save(); }
  function max(pid, f, v) { if (!pid || !canWrite()) return; const d = ensure(pid); if ((d.c[f] || 0) < v) { d.c[f] = v; save(); } }
  // embarrassing moments only inside the roast window; good ones for as long as the notes exist
  function quotable(pid, now) {
    const d = dossier(pid); if (!d) return [];
    now = now || Date.now();
    return d.moments.filter((m) => (m.bad ? now - m.t <= ROAST_MS : now - m.t <= YEAR));
  }
  const rkey = (a, b) => [a, b].sort().join('|');
  const h2h = (a, b) => { const r = L.rivalry[rkey(a, b)]; return r ? { a: (r.w || {})[a] || 0, b: (r.w || {})[b] || 0, big: r.big || null } : { a: 0, b: 0, big: null }; };

  /* ---------- table (the group at this table) ---------- */
  const tableKey = () => roster.slice().sort().join('+');
  function table() {
    if (mode === 'room') return (L.table = L.table || { matches: 0, rounds: 0, favs: [], legends: [] });
    const k = tableKey(); if (!k) return null;
    L.tables = L.tables || {};
    return (L.tables[k] = L.tables[k] || { matches: 0, rounds: 0, favs: [], legends: [] });
  }

  /* ---------- ledger ---------- */
  function ledger(entry) {
    if (!canWrite()) return;
    L.ledger.push(Object.assign({ t: Date.now(), m: matchSeq }, entry));
    if (L.ledger.length > CAP.ledger) L.ledger = L.ledger.slice(-CAP.ledger);
    save();
  }
  const ledgerFor = (pid, ms) => L.ledger.filter((x) => x.pid === pid && Date.now() - x.t <= (ms || DAY));

  /* ---------- match lifecycle ---------- */
  if (window.CapsaEvents) {
    const E = window.CapsaEvents;
    E.on('fact:game:start', (d) => { roster = Array.isArray(d.pids) ? d.pids.slice() : []; matchSeq = Date.now(); });
    E.on('fact:round:start', (d) => { if (Array.isArray(d.pids)) roster = d.pids.slice(); });
    E.on('fact:round:end', () => {
      if (!canWrite()) return;
      let moved = false;
      roster.forEach((pid) => { if (pend[pid]) { L.profiles[pid] = pend[pid]; delete pend[pid]; moved = true; } });
      roster.forEach((pid) => { const p = L.profiles[pid]; if (p) p.lastSeen = Date.now(); });
      if (moved) save();
    });
  }
  // Called by the comedy memory when a match ends, with what it learned. Only the writer stores it.
  function commitMatch(S) {
    if (!canWrite() || !S) return;
    const now = Date.now();
    (S.pids || []).forEach((pid, i) => {
      if (!pid) return;
      if (pend[pid]) { L.profiles[pid] = pend[pid]; delete pend[pid]; }
      const p = L.profiles[pid]; if (!p) return;
      p.matches = (p.matches || 0) + 1; p.lastSeen = now;
      const d = ensure(pid); d.matches = (d.matches || 0) + 1; d.firstSeen = d.firstSeen || now; d.lastSeen = now;
      const lead = (S.leads || {})[pid] || {}; Object.entries(lead).forEach(([k, v]) => { d.lead[k] = (d.lead[k] || 0) + v; });
      const ps = (S.passes || {})[pid]; if (ps) { d.passes.playable += ps.playable || 0; d.passes.turns += ps.turns || 0; }
      const th = (S.think || {})[pid]; if (th) { d.think.sum += th.sum || 0; d.think.n += th.n || 0; }
      const mine = (S.moments || []).filter((m) => m.pid === pid).sort((a, b) => b.w - a.w).slice(0, 3)
        .map((m) => ({ t: m.t || now, round: m.round, text: m.text, w: m.w, bad: !!m.bad, type: m.type || null }));
      d.moments = [...d.moments, ...mine].filter((m) => now - m.t <= YEAR).slice(-CAP.moments);
      const leg = (S.legends || []).filter((x) => x.pid === pid).map((x) => ({ t: x.t || now, text: x.text }));
      d.legends = [...d.legends, ...leg].slice(-CAP.legends);
    });
    Object.entries(S.h2h || {}).forEach(([k, w]) => {
      const r = L.rivalry[k] = L.rivalry[k] || { w: {} };
      Object.entries(w).forEach(([pid, n]) => { r.w[pid] = (r.w[pid] || 0) + n; });
    });
    (S.debts || []).forEach((x) => {
      const r = L.rivalry[rkey(x.by, x.victim)] = L.rivalry[rkey(x.by, x.victim)] || { w: {} };
      if (!r.big || x.pen > r.big.pen) r.big = { pid: x.by, victim: x.victim, pen: x.pen, t: x.t || now };
    });
    const t = table();
    if (t) {
      t.matches = (t.matches || 0) + 1; t.rounds = (t.rounds || 0) + (S.rounds || 0); t.last = now;
      if (S.favorite && S.favorite.pid) t.favs = [...(t.favs || []), { pid: S.favorite.pid, name: S.favorite.name, t: now }].slice(-CAP.favs);
      t.legends = [...(t.legends || []), ...(S.legends || []).map((x) => ({ pid: x.pid, name: x.name, text: x.text, t: x.t || now }))].slice(-CAP.tableLegends);
    }
    save(); flush();
  }

  /* ---------- UI: setup chips, lobby claim, profile panel ---------- */
  function chipFor(input) {
    let chip = input.nextElementSibling && input.nextElementSibling.classList.contains('lore-chip') ? input.nextElementSibling : null;
    const v = input.value, n = norm(v);
    const all = [...document.querySelectorAll('[data-name]')].map((x) => norm(x.value)).filter(Boolean);
    let html = '';
    if (n && all.filter((x) => x === n).length > 1) html = '<span class="lore-warn">Nama ini udah dipakai, tambahin sesuatu?</span>';
    else if (n) {
      const r = resolve(v), dec = decisions[n];
      if (r.status === 'known') html = `<span class="lore-ok">dikenali · ${r.profile.matches || 0} match</span>`;
      else if (r.status === 'similar' && dec == null) html = `<span>Ini ${esc(r.profile.name)}?</span><button type="button" class="chip" data-lore-yes="${r.pid}">Ya, gabungkan</button><button type="button" class="chip" data-lore-new>Orang baru</button>`;
      else if (r.status === 'similar' && dec && dec !== 'new') html = `<span class="lore-ok">dianggap ${esc((L.profiles[dec] || {}).name || '')}</span>`;
    }
    if (!html) { if (chip) chip.remove(); return; }
    if (!chip) { chip = document.createElement('div'); chip.className = 'lore-chip'; input.after(chip); }
    chip.dataset.for = input.dataset.name;
    chip.innerHTML = html;
  }
  function setupChips() { document.querySelectorAll('[data-name]').forEach(chipFor); }
  document.addEventListener('input', (e) => {
    if (e.target && e.target.dataset && e.target.dataset.name != null) {
      delete decisions[norm(e.target.value)];
      document.querySelectorAll('[data-name]').forEach(chipFor);
    }
  });
  document.addEventListener('click', (e) => {
    const yes = e.target.closest('[data-lore-yes]'), no = e.target.closest('[data-lore-new]');
    if (yes || no) {
      const chip = (yes || no).closest('.lore-chip');
      if (chip) {
        const input = document.querySelector(`[data-name="${chip.dataset.for}"]`);
        if (input) { decisions[norm(input.value)] = yes ? yes.dataset.loreYes : 'new'; chipFor(input); }
      }
      e.stopPropagation(); return;
    }
    const claim = e.target.closest('[data-lore-claim]');
    if (claim) { const r = FX() && FX().room && FX().room(); if (r) r.claim(claim.dataset.loreClaim); e.stopPropagation(); return; }
    const start = e.target.closest('[data-act="start"]');
    if (start) {
      const all = [...document.querySelectorAll('[data-name]')].map((x) => norm(x.value)).filter(Boolean);
      if (new Set(all).size !== all.length) { e.stopPropagation(); e.preventDefault(); setupChips(); const w = document.querySelector('.lore-warn'); if (w) w.scrollIntoView({ block: 'center' }); }
    }
    const act = e.target.closest('[data-lore-act]');
    if (act) { e.stopPropagation(); profileAction(act.dataset.loreAct, act.dataset.pid); }
  }, true);

  function lobbyClaim() {
    const r = FX() && FX().room && FX().room(); if (!r) return;
    const me = (r.players || {})[r.uid]; if (!me || !me.name) return;
    const li = [...document.querySelectorAll('.plist li')].find((x) => x.querySelector('.pill.pass'));
    if (!li || li.querySelector('.lore-chip')) return;
    const known = Object.entries(L.profiles).find(([, p]) => p.uids && p.uids[r.uid]);
    let html = '';
    if (known) html = `<span class="lore-ok">dikenali · ${known[1].matches || 0} match</span>`;
    else if (me.claim && me.claim !== 'new' && L.profiles[me.claim]) html = `<span class="lore-ok">dianggap ${esc(L.profiles[me.claim].name)}</span>`;
    else if (!me.claim) {
      const res = resolve(me.name);
      if (res.status === 'known') html = `<span class="lore-ok">dikenali · ${res.profile.matches || 0} match</span>`;
      else if (res.status === 'similar') html = `<span>Ini ${esc(res.profile.name)}?</span><button type="button" class="chip" data-lore-claim="${res.pid}">Ya</button><button type="button" class="chip" data-lore-claim="new">Orang baru</button>`;
    }
    if (!html) return;
    const chip = document.createElement('div'); chip.className = 'lore-chip'; chip.innerHTML = html; li.appendChild(chip);
  }

  function panelHTML() {
    const list = Object.entries(L.profiles).sort((a, b) => (b[1].lastSeen || 0) - (a[1].lastSeen || 0));
    const w = canWrite(), mem = window.CapsaMemory;
    const where = mode === 'room' ? `Catatan room ${esc(roomCode)}${w ? '' : ' · cuma host yang bisa ngubah'}` : 'Catatan di device ini';
    return `<div class="lore-panel"><h4>Profil pemain</h4><p class="lore-where">${where}. Momen memalukan cuma dibahas sampai 24 jam.</p>
      ${list.length ? `<ul>${list.map(([pid, p]) => `<li><b>${esc(p.name)}</b>${(p.aliases || []).length ? ` <small>juga: ${esc(p.aliases.join(', '))}</small>` : ''}
        <span class="lore-meta">${p.matches || 0} match${mem && mem.titleOf ? ` · ${esc(mem.titleOf(pid))}` : ''}</span>
        ${w ? `<span class="lore-btns"><button type="button" class="chip" data-lore-act="rename" data-pid="${pid}">Ganti nama</button><button type="button" class="chip" data-lore-act="merge" data-pid="${pid}">Gabungkan…</button><button type="button" class="chip" data-lore-act="forget" data-pid="${pid}">Hapus catatan</button></span>` : ''}</li>`).join('')}</ul>`
        : '<p class="lore-where">Belum ada profil. Profil dibuat abis ronde pertama selesai.</p>'}</div>`;
  }
  function profileAction(act, pid) {
    const p = L.profiles[pid]; if (!p) return;
    if (act === 'rename') { const n = prompt(`Nama baru buat ${p.name}:`, p.name); if (n) rename(pid, n); }
    if (act === 'merge') {
      const others = Object.entries(L.profiles).filter(([x]) => x !== pid);
      if (!others.length) return alert('Belum ada profil lain.');
      const pick = prompt(`Gabungkan ${p.name} ke profil mana? Ketik namanya:\n${others.map(([, o]) => o.name).join(', ')}`);
      const hit = pick && others.find(([, o]) => norm(o.name) === norm(pick));
      if (hit && confirm(`Semua catatan ${p.name} pindah ke ${hit[1].name}. Lanjut?`)) merge(pid, hit[0]);
    }
    if (act === 'forget' && confirm(`Hapus semua catatan ${p.name}? Gak bisa dibalikin.`)) forget(pid);
    rerenderPanels();
  }
  function rerenderPanels() {
    const sp = document.querySelector('.stats-panel'); if (!sp) return;
    const old = sp.querySelector('.lore-panel'); const html = panelHTML();
    if (old) old.outerHTML = html; else sp.insertAdjacentHTML('beforeend', html);
  }
  document.addEventListener('capsa:render', () => {
    setupChips(); lobbyClaim();
    if (document.querySelector('.stats-panel')) rerenderPanels();
  });
  addEventListener('pagehide', flush);

  const css = document.createElement('style');
  css.textContent = `
.lore-chip{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;color:#9dbcae;margin:2px 0 6px}
.lore-chip .chip{font-size:12px;padding:3px 9px}
.lore-ok{color:#9be3b4}.lore-warn{color:#ff9b73}
.plist .lore-chip{flex-basis:100%;margin:4px 0 0 18px}
.lore-panel{border-top:1px solid rgba(255,255,255,.12);margin-top:14px;padding-top:12px}
.lore-panel h4{margin:0 0 4px;font-size:14px}.lore-where{font-size:12px;color:#9dbcae;margin:0 0 8px}
.lore-panel ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.lore-panel li{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
.lore-panel small{color:#9dbcae}.lore-meta{font-size:12px;color:#9dbcae}
.lore-btns{display:flex;gap:6px;flex-wrap:wrap}.lore-btns .chip{font-size:12px;padding:3px 9px}`;
  document.head.appendChild(css);

  window.CapsaLore = {
    ROAST_MS, REP0, norm, mode: () => mode, room: () => roomCode, canWrite, data: () => L,
    profiles: () => allProfiles(), profile, resolve, assign, rename, merge, forget, decisions,
    dossier, counters, bump, max, quotable, h2h, rkey, table, ledger, ledgerFor, commitMatch, roster: () => roster.slice(),
    renamed: () => Object.assign({}, renamed), flush, _reset: () => { L = empty(); Object.keys(pend).forEach((k) => delete pend[k]); save(); },
  };
})();

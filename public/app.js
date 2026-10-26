/* GrideX app. Part 1: helpers, state, accounts, rewards. */
(function () {
"use strict";

/* ================= helpers ================= */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const parse = (s) => { const p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clock = (sec) => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ":" + pad(m) : pad(m)) + ":" + pad(s); };
const human = (sec) => { const m = Math.round(sec / 60); return m < 60 ? m + " min" : Math.floor(m / 60) + "h " + pad(m % 60) + "m"; };
const reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYFULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const dowOf = (d) => (d.getDay() + 6) % 7;
const mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - dowOf(x)); return x; };
const monthKey = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1);
function isoWeekKey(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return y + "-W" + pad(w);
}
function weekStartFromKey(k) { const m = /^(\d{4})-W(\d{2})$/.exec(k); return addDays(mondayOf(new Date(+m[1], 0, 4)), (+m[2] - 1) * 7); }
const monthStartFromKey = (k) => { const p = k.split("-"); return new Date(+p[0], +p[1] - 1, 1); };
const keyFor = (scope, d) => (scope === "day" ? ymd(d) : scope === "week" ? isoWeekKey(d) : monthKey(d));
const shortDate = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
function labelFor(scope, key) {
  if (scope === "day") {
    const t = ymd(new Date());
    if (key === t) return "Today";
    if (key === ymd(addDays(new Date(), -1))) return "Yesterday";
    if (key === ymd(addDays(new Date(), 1))) return "Tomorrow";
    return parse(key).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  }
  if (scope === "week") {
    const s = weekStartFromKey(key), r = shortDate(s) + " to " + shortDate(addDays(s, 6));
    return key === isoWeekKey(new Date()) ? "This week, " + r : r;
  }
  const nm = monthStartFromKey(key).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return key === monthKey(new Date()) ? "This month, " + nm : nm;
}
const shiftCursor = (scope, d, n) => (scope === "day" ? addDays(d, n) : scope === "week" ? addDays(d, 7 * n) : new Date(d.getFullYear(), d.getMonth() + n, 1));
const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
let S = null, USER = null;
const fmtT = (t) => {
  const mm = toMin(t); if (mm === null) return "";
  const h = Math.floor(mm / 60), m = mm % 60;
  if (!S || !S.settings.hour12) return pad(h) + ":" + pad(m);
  return (h % 12 || 12) + ":" + pad(m) + " " + (h < 12 ? "AM" : "PM");
};
const durMin = (r) => Math.max(0, toMin(r.end) - toMin(r.start));

/* ================= icons ================= */
const P = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  routine: '<path d="M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3"/>',
  must: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>', pause: '<path d="M8 5v14M16 5v14"/>',
  flame: '<path d="M12 2c1 4 6 6 6 11a6 6 0 01-12 0c0-2.5 1.2-4 2.5-5.5C9 9.5 10 10 11 11c.5-3 0-6 1-9z"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  l: '<path d="M15 5l-7 7 7 7"/>', r: '<path d="M9 5l7 7-7 7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  alert: '<path d="M12 3l10 18H2zM12 10v5M12 18v.01"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.1 9.5l6.1-.9z"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18M10.6 6.2A10 10 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.2 3.9M6.6 6.7C3.6 8.6 2 12 2 12s4 7 10 7a9.8 9.8 0 004.4-1M9.9 9.9a3 3 0 004.2 4.2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 8l9 6 9-6"/>',
  out: '<path d="M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4M16 8l4 4-4 4M20 12H9"/>'
};
const ic = (n) => '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + P[n] + "</svg>";
const CATS = { work: "Work", study: "Study", meeting: "Meeting", health: "Health", personal: "Personal" };
const shape = (c) => '<i class="shape ' + (CATS[c] ? c : "work") + '" aria-hidden="true"></i>';
const cupSvg = (tier) => '<svg class="cup t' + (tier || 3) + '" viewBox="0 0 64 64" aria-hidden="true"><path d="M18 8h28v14a14 14 0 01-28 0V8z" fill="currentColor"/><path d="M18 12H9v4a8 8 0 008 8M46 12h9v4a8 8 0 01-8 8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><rect x="28" y="36" width="8" height="10" fill="currentColor"/><rect x="20" y="46" width="24" height="8" rx="3" fill="currentColor"/><path d="M25 12v9" stroke="var(--bg)" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/></svg>';
const logoMark = (cls) => '<span class="mark ' + (cls || "") + '" role="img" aria-label="GrideX"></span>';

/* ================= content ================= */
const APPS = [
  { id: "youtube", n: "YouTube", g: "Y", d: "allow" }, { id: "timer", n: "Timer", g: "T", d: "allow" },
  { id: "calc", n: "Calculator", g: "C", d: "allow" }, { id: "notes", n: "Notes", g: "N", d: "allow" },
  { id: "docs", n: "Docs", g: "D", d: "allow" }, { id: "chrome", n: "Browser", g: "B", d: "allow" },
  { id: "insta", n: "Instagram", g: "I", d: "block" }, { id: "fb", n: "Facebook", g: "F", d: "block" },
  { id: "tiktok", n: "TikTok", g: "K", d: "block" }, { id: "x", n: "X", g: "X", d: "block" },
  { id: "snap", n: "Snapchat", g: "S", d: "block" }, { id: "reddit", n: "Reddit", g: "R", d: "block" },
  { id: "netflix", n: "Netflix", g: "N", d: "block" }, { id: "games", n: "Games", g: "G", d: "block" }
];
const QUOTES = {
  any: ["Small steps, finished, beat big plans, postponed.", "You showed up. That is the whole trick.", "Done is the doorway to better.", "Every finished task is a vote for who you are becoming.", "Quiet effort adds up louder than any excuse.", "Discipline is just a promise you keep when nobody is watching.", "Momentum belongs to the people who start before they feel ready.", "One more finished thing. That is how big years are built."],
  study: ["A page understood today is an exam passed tomorrow.", "Knowledge compounds. You just made a deposit.", "Hard today, easy on exam day."],
  work: ["Shipped beats perfect. Well done.", "Deep work is a superpower, and you just used it.", "Momentum is built one finished block at a time."],
  meeting: ["Showing up prepared is half the win.", "Clear thinking, clear talking, clear results."],
  health: ["Your body just thanked you.", "Strong habits build strong days.", "Consistency over intensity. Nice one."],
  personal: ["Time for yourself is time well spent.", "You kept a promise to yourself."]
};
const pickQuote = (cat) => { const l = (QUOTES[cat] || []).concat(QUOTES.any); return l[Math.floor(Math.random() * l.length)]; };
const dailyQuote = () => { const d = new Date(), n = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate(); return QUOTES.any[n % QUOTES.any.length]; };

/* ================= state ================= */
let V = "today";
const M = { scope: "day", cursor: new Date(), star: false };
const R = { dow: dowOf(new Date()) };
const CAL = { off: 0, sel: ymd(new Date()) };
let theme = "dark";
try { theme = localStorage.getItem("gridex.theme") || "dark"; } catch (e) { /* ignore */ }

function fresh() {
  const apps = {}; APPS.forEach((a) => { apps[a.id] = a.d; });
  return {
    tasks: [], routine: [], mustdos: [], routineLog: {},
    settings: { apps, mode: "warn", theme: "dark", sound: true, hour12: false },
    stats: { xp: 0, totalSec: 0, completed: 0, mustDone: 0, routineDone: 0, bestSec: 0, cleanRun: false, perfectDays: 0, perfect: {}, days: {}, trophies: [] }
  };
}
function normalize(st) {
  const b = fresh();
  if (!st || typeof st !== "object") return b;
  if (Array.isArray(st.tasks)) b.tasks = st.tasks;
  if (Array.isArray(st.routine)) b.routine = st.routine;
  if (Array.isArray(st.mustdos)) b.mustdos = st.mustdos;
  if (st.routineLog && typeof st.routineLog === "object") b.routineLog = st.routineLog;
  if (st.settings) {
    Object.keys(st.settings).forEach((k) => { if (k !== "apps") b.settings[k] = st.settings[k]; });
    if (st.settings.apps) Object.keys(st.settings.apps).forEach((k) => { b.settings.apps[k] = st.settings.apps[k]; });
  }
  if (st.stats) Object.keys(st.stats).forEach((k) => { b.stats[k] = st.stats[k]; });
  if (!b.stats.days) b.stats.days = {};
  if (!b.stats.perfect) b.stats.perfect = {};
  if (!b.stats.trophies) b.stats.trophies = [];
  return b;
}
let saveT = null, dirty = false, warnedSave = false;
function api(method, url, body) {
  return fetch(url, { method, credentials: "same-origin", keepalive: method === "PUT", headers: { "Content-Type": "application/json", "X-Requested-With": "gridex" }, body: body ? JSON.stringify(body) : undefined })
    .then((r) => r.json().catch(() => ({})).then((j) => ({ ok: r.ok, status: r.status, data: j })));
}
function save() { dirty = true; clearTimeout(saveT); saveT = setTimeout(flush, 500); }
function flush() {
  if (!S || !dirty) return;
  dirty = false;
  api("PUT", "/api/state", { tasks: S.tasks, routine: S.routine, mustdos: S.mustdos, routineLog: S.routineLog, settings: S.settings, stats: S.stats })
    .then((r) => {
      if (r.status === 401) { S = null; USER = null; renderLogin("Your session ended. Please sign in again."); return; }
      if (!r.ok) { dirty = true; if (!warnedSave) { warnedSave = true; toast("Could not save. Will retry when you are back online."); } } else warnedSave = false;
    }).catch(() => { dirty = true; });
}
window.addEventListener("online", flush);
window.addEventListener("pagehide", flush);
setInterval(flush, 15000);

function applyTheme() {
  const t = S ? S.settings.theme : theme;
  theme = t;
  if (t === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("gridex.theme", t); } catch (e) { /* ignore */ }
}

/* ================= audio + toast ================= */
let AC = null;
function chime() {
  if (!S || !S.settings.sound) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784, 1046].forEach((f, i) => {
      const o = AC.createOscillator(), g = AC.createGain(); o.type = "sine"; o.frequency.value = f;
      const t = AC.currentTime + i * 0.12;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + 0.55);
    });
  } catch (e) { /* ignore */ }
}
function toast(msg) {
  const old = $(".toast"); if (old) old.remove();
  const d = document.createElement("div"); d.className = "toast"; d.setAttribute("role", "status"); d.textContent = msg;
  document.body.appendChild(d); setTimeout(() => d.remove(), 2600);
}
function confetti(cv, n) {
  if (!cv || reduce) return;
  const ctx = cv.getContext("2d"), W = (cv.width = innerWidth), H = (cv.height = innerHeight);
  const dark = document.documentElement.getAttribute("data-theme") !== "light" && !(theme === "system" && matchMedia("(prefers-color-scheme: light)").matches);
  const cols = dark ? ["#ffffff", "#d4d4d4", "#a3a3a3", "#737373"] : ["#000000", "#2b2b2b", "#555555", "#8a8a8a"];
  const ps = []; for (let i = 0; i < (n || 150); i++) ps.push({ x: W / 2 + (Math.random() - 0.5) * 160, y: H * 0.34, vx: (Math.random() - 0.5) * 15, vy: -Math.random() * 15 - 3, s: 5 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.5, c: cols[i % cols.length], sq: i % 3 === 0 });
  const t0 = performance.now();
  (function f(t) {
    if (!document.body.contains(cv)) return;
    const el = t - t0; ctx.clearRect(0, 0, W, H);
    ps.forEach((p) => {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - el / 3000); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      if (p.sq) ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); else ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.6);
      ctx.restore();
    });
    if (el < 3100) requestAnimationFrame(f);
  })(t0);
}
function burst(n) {
  if (reduce) return;
  let cv = $("#burst"); if (cv) cv.remove();
  cv = document.createElement("canvas"); cv.id = "burst"; cv.className = "confetti"; document.body.appendChild(cv);
  confetti(cv, n || 70); setTimeout(() => cv.remove(), 3300);
}
function countUp(el, to, fmt) {
  if (!el) return;
  fmt = fmt || ((v) => String(Math.round(v)));
  if (reduce || !to) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  (function f(t) { const p = Math.min(1, (t - t0) / 1200); el.textContent = fmt(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); })(t0);
}

/* ================= rewards engine ================= */
const totalWins = () => (S.stats.completed || 0) + (S.stats.mustDone || 0) + (S.stats.routineDone || 0);
const levelOf = () => Math.floor(S.stats.xp / 100) + 1;
const LEVEL_NAMES = ["Rookie", "Builder", "Achiever", "Pro", "Elite", "Legend"];
const levelName = () => LEVEL_NAMES[Math.min(LEVEL_NAMES.length - 1, Math.floor((levelOf() - 1) / 2))];
function streakNow() {
  const days = S.stats.days || {}; let d = new Date(), n = 0;
  if (!days[ymd(d)]) d = addDays(d, -1);
  while (days[ymd(d)]) { n++; d = addDays(d, -1); }
  return n;
}
const activeToday = () => !!(S.stats.days || {})[ymd(new Date())];
function bump(date, n) {
  const d = S.stats.days; d[date] = Math.max(0, (d[date] || 0) + n); if (!d[date]) delete d[date];
  const keys = Object.keys(d); if (keys.length > 420) keys.sort().slice(0, keys.length - 400).forEach((k) => delete d[k]);
}
const TROPHIES = [
  { id: "first", n: "First Win", d: "Finish your first task", t: 1, ok: () => totalWins() >= 1 },
  { id: "five", n: "High Five", d: "Finish 5 tasks", t: 1, ok: () => totalWins() >= 5 },
  { id: "fifty", n: "Fifty Wins", d: "Finish 50 tasks", t: 2, ok: () => totalWins() >= 50 },
  { id: "hundred", n: "Centurion", d: "Finish 100 tasks", t: 3, ok: () => totalWins() >= 100 },
  { id: "hour", n: "Hour of Power", d: "Focus for 60 minutes in total", t: 1, ok: () => S.stats.totalSec >= 3600 },
  { id: "tenh", n: "Ten Hours Deep", d: "Focus for 10 hours in total", t: 3, ok: () => S.stats.totalSec >= 36000 },
  { id: "clean", n: "Clean Run", d: "Finish a 1+ minute session with no distraction", t: 1, ok: () => !!S.stats.cleanRun },
  { id: "deep", n: "Deep Focus", d: "Finish one 45 minute session", t: 2, ok: () => S.stats.bestSec >= 2700 },
  { id: "s3", n: "3-Day Streak", d: "Finish something 3 days in a row", t: 1, ok: () => streakNow() >= 3 },
  { id: "s7", n: "Week Warrior", d: "Finish something 7 days in a row", t: 2, ok: () => streakNow() >= 7 },
  { id: "s30", n: "Unbreakable", d: "Finish something 30 days in a row", t: 3, ok: () => streakNow() >= 30 },
  { id: "perfect", n: "Perfect Day", d: "Finish every must-do planned for a day", t: 1, ok: () => (S.stats.perfectDays || 0) >= 1 },
  { id: "perfect7", n: "Perfect x7", d: "Have 7 perfect days", t: 2, ok: () => (S.stats.perfectDays || 0) >= 7 },
  { id: "routine10", n: "Routine Keeper", d: "Tick off 10 routine blocks", t: 1, ok: () => (S.stats.routineDone || 0) >= 10 },
  { id: "routine50", n: "Creature of Habit", d: "Tick off 50 routine blocks", t: 2, ok: () => (S.stats.routineDone || 0) >= 50 },
  { id: "l5", n: "Level 5", d: "Reach level 5", t: 1, ok: () => levelOf() >= 5 },
  { id: "l10", n: "Level 10", d: "Reach level 10", t: 2, ok: () => levelOf() >= 10 }
];
function grant(xp, sec, attempts) {
  const st = S.stats, today = ymd(new Date());
  st.xp += xp; st.totalSec += sec || 0; bump(today, 1);
  if (sec) { st.bestSec = Math.max(st.bestSec || 0, sec); if (sec >= 60 && !attempts) st.cleanRun = true; }
  const earned = TROPHIES.filter((t) => st.trophies.indexOf(t.id) < 0 && t.ok());
  earned.forEach((t) => st.trophies.push(t.id));
  save(); return earned;
}
function revoke(xp, date) { S.stats.xp = Math.max(0, S.stats.xp - (xp || 0)); bump(date || ymd(new Date()), -1); save(); }

/* ================= login ================= */
let cfg = null;
const A = { mode: "in", email: "", name: "", delivery: "console", cool: 0, coolT: null };
const loadConfig = () => (cfg ? Promise.resolve(cfg) : fetch("/api/config").then((r) => r.json()).then((j) => { cfg = j; return j; }));
const loadGis = () => new Promise((res, rej) => {
  if (window.google && google.accounts && google.accounts.id) return res();
  const el = document.createElement("script"); el.src = "https://accounts.google.com/gsi/client"; el.async = true; el.onload = res; el.onerror = rej; document.head.appendChild(el);
});
const isGmail = (e) => /^[a-z0-9._+-]{3,64}@(gmail|googlemail)\.com$/i.test(String(e).trim());

function renderLogin(msg) {
  clearInterval(A.coolT);
  A.mode = "in"; applyTheme();
  $("#layer").innerHTML = "";
  $("#root").innerHTML =
    '<div class="login"><div class="brand-side"><div class="lockup">' + logoMark("lg") + '<span class="word" role="img" aria-label="GrideX"></span></div>' +
    '<h1 class="hero-h">Plan it.<br>Lock in.<br><span>Win the day.</span></h1>' +
    '<p class="hero-p">Put every task on your calendar, build a weekly routine, pick your must-dos, then focus without distractions. Finish to earn trophies, XP and streaks.</p>' +
    '<ul class="hero-list"><li>' + ic("cal") + 'Calendar and weekly routine</li><li>' + ic("must") + 'Must-dos for today, week and month</li><li>' + ic("lock") + 'Focus mode that blocks distractions</li></ul></div>' +
    '<div class="card auth" id="authCard"></div></div>';
  paintAuth(msg ? { err: msg } : null);
}

function paintAuth(info) {
  info = info || {};
  const m = A.mode, up = m === "up";
  const tabs = (m === "in" || m === "up")
    ? '<div class="tabs" role="tablist"><button type="button" role="tab" data-act="amode" data-v="in" aria-selected="' + !up + '">Log in</button><button type="button" role="tab" data-act="amode" data-v="up" aria-selected="' + up + '">Sign up</button></div>' : "";
  const google = (m === "in" || m === "up")
    ? '<div class="gwrap" id="gbtn"></div><div class="or"><span>or use your Gmail</span></div>' : "";
  const mailField = (id, val, ro) => '<div class="field"><label for="' + id + '">Gmail address</label><input id="' + id + '" type="email" inputmode="email" autocomplete="email" placeholder="you@gmail.com" value="' + esc(val || "") + '"' + (ro ? " readonly" : "") + "></div>";
  const passField = (id, label, auto, hint) => '<div class="field"><label for="' + id + '">' + label + '</label><div class="pw"><input id="' + id + '" type="password" autocomplete="' + auto + '" placeholder="' + (hint || "Your password") + '"><button type="button" class="eye" data-act="eye" aria-label="Show password">' + ic("eye") + "</button></div></div>";
  const msgs = '<div class="err" id="aErr" role="alert">' + esc(info.err || "") + '</div><div class="info" id="aInfo">' + esc(info.info || "") + "</div>";
  let body = "";
  if (m === "in") {
    body = tabs + '<h2 class="ah">Welcome back</h2>' + google +
      '<form id="loginForm" novalidate>' + mailField("aMail", A.email) + passField("aPass", "Password", "current-password") +
      '<div class="rowlink"><button type="button" class="link" data-act="amode" data-v="forgot">Forgot password?</button></div>' + msgs +
      '<button class="btn big full" type="submit">Log in</button></form>';
  } else if (m === "up") {
    body = tabs + '<h2 class="ah">Create your account</h2>' + google +
      '<form id="signupForm" novalidate><div class="field"><label for="aName">Your name</label><input id="aName" autocomplete="name" maxlength="60" placeholder="Your name" value="' + esc(A.name) + '"></div>' +
      mailField("aMail", A.email) + passField("aPass", "Password", "new-password", "At least 8 characters") + msgs +
      '<button class="btn big full" type="submit">Create account</button><p class="note">We email a 6-digit code to your Gmail to prove it is yours.</p></form>';
  } else if (m === "code") {
    body = '<button type="button" class="link back" data-act="amode" data-v="' + (A.purpose === "reset" ? "forgot" : "up") + '">' + ic("l") + " Back</button>" +
      '<h2 class="ah">Check your Gmail</h2><p class="lead">' + esc(deliveryText()) + "</p>" +
      '<form id="codeForm" novalidate><div class="field"><label for="aCode">6-digit code</label><input id="aCode" class="codein" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"></div>' + msgs +
      '<button class="btn big full" type="submit">Verify and continue</button></form><div class="rowlink center"><button type="button" class="link" id="resend" data-act="resend" disabled>Send a new code</button></div>';
  } else if (m === "forgot") {
    body = '<button type="button" class="link back" data-act="amode" data-v="in">' + ic("l") + " Back</button><h2 class=\"ah\">Reset your password</h2><p class=\"lead\">Enter your Gmail. We send a code so you can choose a new password. This also adds a password to an account made with Google.</p>" +
      '<form id="forgotForm" novalidate>' + mailField("aMail", A.email) + msgs + '<button class="btn big full" type="submit">Send code</button></form>';
  } else if (m === "reset") {
    body = '<button type="button" class="link back" data-act="amode" data-v="forgot">' + ic("l") + " Back</button><h2 class=\"ah\">Choose a new password</h2><p class=\"lead\">" + esc(deliveryText()) + "</p>" +
      '<form id="resetForm" novalidate><div class="field"><label for="aCode">6-digit code</label><input id="aCode" class="codein" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"></div>' +
      passField("aPass", "New password", "new-password", "At least 8 characters") + msgs + '<button class="btn big full" type="submit">Save and sign in</button></form><div class="rowlink center"><button type="button" class="link" id="resend" data-act="resend" disabled>Send a new code</button></div>';
  }
  $("#authCard").innerHTML = body;
  if (m === "in" || m === "up") mountGoogle();
  if (m === "code" || m === "reset") { startCooldown(A.cool); const c = $("#aCode"); if (c) c.focus(); }
}
function deliveryText() {
  return A.delivery === "email"
    ? "We sent a 6-digit code to " + A.email + ". Check your inbox and your spam folder."
    : "Email sending is not set up on this computer yet, so your code was printed in the black window where GrideX is running. Look there for " + A.email + ".";
}
function startCooldown(sec) {
  clearInterval(A.coolT); A.cool = sec;
  const tick = () => { const b = $("#resend"); if (!b) { clearInterval(A.coolT); return; } if (A.cool > 0) { b.disabled = true; b.textContent = "Send a new code in " + A.cool + "s"; A.cool--; } else { b.disabled = false; b.textContent = "Send a new code"; clearInterval(A.coolT); } };
  tick(); A.coolT = setInterval(tick, 1000);
}
function setMsg(err, info) { const e = $("#aErr"), i = $("#aInfo"); if (e) e.textContent = err || ""; if (i) i.textContent = info || ""; }

function mountGoogle() {
  const box = $("#gbtn"); if (!box) return;
  box.innerHTML = '<span class="note">Loading Google sign-in...</span>';
  const fail = (why) => { const b = $("#gbtn"); if (b) b.innerHTML = '<div class="gnote">' + esc(why) + ' <button type="button" class="link" data-act="gretry">Try again</button></div>'; };
  loadConfig().then((c) => {
    if (!c.clientId) { box.innerHTML = '<div class="gnote">Google sign-in is not set up on this server yet. Use your Gmail and password below.</div>'; return; }
    return loadGis().then(() => {
      const b = $("#gbtn"); if (!b) return;
      google.accounts.id.initialize({ client_id: c.clientId, callback: onCredential, ux_mode: "popup", auto_select: false });
      b.innerHTML = "";
      const light = document.documentElement.getAttribute("data-theme") === "light";
      google.accounts.id.renderButton(b, { theme: light ? "outline" : "filled_black", size: "large", shape: "pill", width: Math.max(220, Math.min(380, b.clientWidth || 340)), text: A.mode === "up" ? "signup_with" : "signin_with", logo_alignment: "left" });
      setTimeout(() => { const x = $("#gbtn"); if (x && !x.querySelector("iframe")) fail("The Google button did not load. Check your internet, VPN or ad blocker."); }, 4500);
    });
  }).catch(() => fail("Could not reach Google. Check your internet connection."));
}
function enterApp(data, created) {
  USER = data.user; S = normalize(data.state); applyTheme();
  V = "today"; M.cursor = new Date(); R.dow = dowOf(new Date()); CAL.sel = ymd(new Date()); CAL.off = 0;
  renderApp();
  toast(created ? "Welcome to GrideX, " + USER.name.split(" ")[0] + "!" : "Signed in");
}
function onCredential(resp) {
  setMsg("", "Checking with Google...");
  api("POST", "/api/auth/google", { credential: resp.credential, intent: A.mode === "up" ? "signup" : "login" }).then((r) => {
    if (r.ok) return enterApp(r.data, r.data.created);
    setMsg(r.status === 404 ? "This Google account has no GrideX account yet. Choose Sign up." : r.status === 401 ? "Google could not confirm this account. Please try again." : r.status === 503 ? "Google sign-in is not set up on the server yet." : r.status === 429 ? "Too many attempts. Wait a few minutes and try again." : "Something went wrong. Please try again.");
  }).catch(() => setMsg("Could not reach the server. Check your connection."));
}
const AUTH_ERR = {
  bad_credentials: "Wrong Gmail or password.",
  locked: "Too many wrong tries. Wait 15 minutes, or reset your password.",
  use_google: "This Gmail was created with Google. Use the Google button, or choose Forgot password to add a password.",
  too_many: "Too many attempts. Try again in a few minutes.",
  bad_email: "Enter a real Gmail address ending in @gmail.com.",
  bad_name: "Enter your name.",
  weak_password: "Use at least 8 characters for the password.",
  exists: "This Gmail already has an account. Log in instead.",
  email_failed: "We could not send the email. Check the email settings on the server and try again.",
  code_expired: "That code expired. Go back and ask for a new one.",
  too_many_codes: "Too many wrong codes. Go back and ask for a new one."
};
const authMsg = (r) => {
  const e = r.data && r.data.error;
  if (e === "wait") return "Please wait " + (r.data.retry || 30) + " seconds before asking for another code.";
  if (e === "wrong_code") return "That code is wrong. " + r.data.left + " " + (r.data.left === 1 ? "try" : "tries") + " left.";
  return AUTH_ERR[e] || "Something went wrong. Please try again.";
};
function busy(form, on) { const b = form.querySelector("button[type=submit]"); if (b) { b.disabled = on; b.classList.toggle("loading", on); } }
function startCodeFlow(path, purpose, extra) {
  return api("POST", path, Object.assign({ email: A.email }, extra || {})).then((r) => {
    if (!r.ok) return r;
    A.purpose = purpose; A.delivery = r.data.delivery; A.cool = r.data.cooldown || 45;
    A.mode = purpose === "reset" ? "reset" : "code"; paintAuth(); return r;
  });
}
document.addEventListener("submit", (e) => {
  const f = e.target, id = f.id;
  if (!/^(loginForm|signupForm|codeForm|forgotForm|resetForm)$/.test(id)) return;
  e.preventDefault();
  const mail = $("#aMail"), pass = $("#aPass"), code = $("#aCode");
  if (mail) A.email = mail.value.trim().toLowerCase();
  if (id !== "codeForm" && id !== "resetForm" && !isGmail(A.email)) return setMsg(AUTH_ERR.bad_email);
  busy(f, true); setMsg("", "");
  const done = (r) => { busy(f, false); if (r && !r.ok) setMsg(authMsg(r)); };
  if (id === "loginForm") {
    if (!pass.value) { busy(f, false); return setMsg("Enter your password."); }
    api("POST", "/api/auth/login", { email: A.email, password: pass.value }).then((r) => { if (r.ok) enterApp(r.data, false); else done(r); }).catch(() => { busy(f, false); setMsg("Could not reach the server."); });
  } else if (id === "signupForm") {
    A.name = $("#aName").value.trim();
    if (!A.name) { busy(f, false); return setMsg(AUTH_ERR.bad_name); }
    if (pass.value.length < 8) { busy(f, false); return setMsg(AUTH_ERR.weak_password); }
    A.pass = pass.value;
    startCodeFlow("/api/auth/signup/start", "signup", { name: A.name, password: A.pass }).then(done).catch(() => { busy(f, false); setMsg("Could not reach the server."); });
  } else if (id === "codeForm") {
    api("POST", "/api/auth/signup/verify", { email: A.email, code: code.value }).then((r) => { if (r.ok) { A.pass = ""; enterApp(r.data, true); } else done(r); }).catch(() => { busy(f, false); setMsg("Could not reach the server."); });
  } else if (id === "forgotForm") {
    startCodeFlow("/api/auth/reset/start", "reset").then(done).catch(() => { busy(f, false); setMsg("Could not reach the server."); });
  } else if (id === "resetForm") {
    if (pass.value.length < 8) { busy(f, false); return setMsg(AUTH_ERR.weak_password); }
    api("POST", "/api/auth/reset/confirm", { email: A.email, code: code.value, password: pass.value }).then((r) => { if (r.ok) enterApp(r.data, false); else done(r); }).catch(() => { busy(f, false); setMsg("Could not reach the server."); });
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "aCode") e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
});

/* ================= shell ================= */
const NAV = [["today", "home", "Today"], ["calendar", "cal", "Calendar"], ["routine", "routine", "Routine"], ["must", "must", "Must-do"], ["focus", "timer", "Focus"], ["rewards", "trophy", "Rewards"], ["settings", "gear", "Settings"]];
const MOBILE_NAV = ["today", "calendar", "routine", "must", "focus"];
function renderApp() {
  $("#layer").innerHTML = "";
  $("#root").innerHTML = '<div class="shell"><aside class="rail"><div class="brand">' + logoMark("sm") + '</div><nav class="nav" aria-label="Main">' +
    NAV.map((n) => '<button data-act="nav" data-v="' + n[0] + '" class="' + (MOBILE_NAV.indexOf(n[0]) < 0 ? "deskonly" : "") + '"' + (V === n[0] ? ' aria-current="page"' : "") + ">" + ic(n[1]) + "<span>" + n[2] + "</span></button>").join("") +
    '</nav></aside><main class="main" id="main"><div class="view" id="viewbox"></div></main></div><button class="minirun" id="mini" data-act="nav" data-v="focus" hidden></button>';
  renderView(); paintMini();
}
function go(v) { V = v; $$(".nav button").forEach((b) => { if (b.dataset.v === v) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); }); renderView(); window.scrollTo(0, 0); paintMini(); }
function renderView(quiet) {
  const box = $("#viewbox"); if (!box || !S) return;
  box.className = "view" + (quiet ? " quiet" : "");
  ({ today: vToday, calendar: vCalendar, routine: vRoutine, must: vMust, focus: vFocus, rewards: vRewards, settings: vSettings })[V]();
}
function topbar(title, sub, extra) {
  return '<header class="top"><div><h1>' + title + "</h1><p>" + sub + '</p></div><div class="chips">' + (extra || "") +
    '<span class="stat" title="Day streak">' + ic("flame") + '<b class="mono">' + streakNow() + '</b><span class="lbl">day streak</span></span>' +
    '<span class="stat" title="Experience points">' + ic("bolt") + '<b class="mono">' + S.stats.xp + '</b><span class="lbl">XP</span></span>' +
    '<button class="iconbtn mobonly" data-act="nav" data-v="rewards" aria-label="Rewards">' + ic("trophy") + '</button><button class="iconbtn mobonly" data-act="nav" data-v="settings" aria-label="Settings">' + ic("gear") + "</button></div></header>";
}
const greeting = () => { const h = new Date().getHours(); return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
const byStart = (a, b) => toMin(a.start) - toMin(b.start);
const byTime = (a, b) => (a.time || "99").localeCompare(b.time || "99");
const closeLayer = () => { $("#layer").innerHTML = ""; };

/* ================= data helpers ================= */
const routineOn = (dow) => S.routine.filter((r) => r.days.indexOf(dow) >= 0).sort(byStart);
const logFor = (date) => S.routineLog[date] || {};
function dayData() {
  const now = new Date(), today = ymd(now), dow = dowOf(now), log = logFor(today);
  const routine = routineOn(dow).map((r) => ({ r, done: r.id in log }));
  const must = S.mustdos.filter((m) => m.scope === "day" && m.period === today);
  const cal = S.tasks.filter((t) => t.date === today).sort(byTime);
  const total = routine.length + must.length + cal.length;
  const done = routine.filter((x) => x.done).length + must.filter((m) => m.done).length + cal.filter((t) => t.done).length;
  return { today, dow, routine, must, cal, total, done };
}
function adherence() {
  const now = new Date(), mon = mondayOf(now); let done = 0, total = 0;
  for (let i = 0; i <= dowOf(now); i++) {
    const d = addDays(mon, i), key = ymd(d), isT = key === ymd(now), log = logFor(key);
    routineOn(i).forEach((r) => { if (isT && toMin(r.start) > nowMin()) return; total++; if (r.id in log) done++; });
  }
  return { done, total };
}

/* ================= completing things ================= */
function completeTask(t, sec, attempts) {
  const xp = 15 + Math.floor(sec / 60) * 2 + (sec >= 60 && !attempts ? 10 : 0);
  t.done = true; t.doneSec = sec; S.stats.completed++;
  const earned = grant(xp, sec, attempts);
  showWin({ title: t.title, sec, xp, earned, att: attempts, cat: t.cat });
}
const MUST_XP = { day: 20, week: 30, month: 40 };
function completeMust(m, sec, attempts, viaFocus) {
  const xp = (MUST_XP[m.scope] || 20) + (m.pri ? 10 : 0) + Math.floor((sec || 0) / 60);
  m.done = true; m.xp = xp; m.doneDate = ymd(new Date()); m.doneAt = Date.now(); S.stats.mustDone++;
  const earned = grant(xp, sec || 0, attempts);
  const perfect = checkPerfect();
  if (viaFocus) { showWin({ title: m.title, sec, xp, earned, att: attempts, eyebrow: "Must-do complete", cat: "any" }); return; }
  if (perfect) return;
  reward(m.title, xp, earned);
}
function uncompleteMust(m) {
  if (!m.done) return;
  revoke(m.xp, m.doneDate); S.stats.mustDone = Math.max(0, S.stats.mustDone - 1);
  if (m.scope === "day" && S.stats.perfect[m.period]) { revoke(25, m.period); delete S.stats.perfect[m.period]; S.stats.perfectDays = Math.max(0, S.stats.perfectDays - 1); }
  m.done = false; delete m.xp; delete m.doneDate; delete m.doneAt; save();
  toast("Marked as not done");
}
function checkPerfect() {
  const today = ymd(new Date()), list = S.mustdos.filter((m) => m.scope === "day" && m.period === today);
  if (!list.length || list.some((m) => !m.done) || S.stats.perfect[today]) return false;
  S.stats.perfect[today] = 1; S.stats.perfectDays++;
  const earned = grant(25, 0, 0);
  showPerfect(list.length, earned);
  return true;
}
function tickRoutine(id, sec, attempts, viaFocus) {
  const today = ymd(new Date()), r = S.routine.find((x) => x.id === id); if (!r) return;
  const log = (S.routineLog[today] = S.routineLog[today] || {});
  if (id in log) return;
  const xp = 5 + Math.floor((sec || 0) / 60);
  log[id] = xp; S.stats.routineDone++;
  const earned = grant(xp, sec || 0, attempts);
  if (viaFocus) showWin({ title: r.title, sec, xp, earned, att: attempts, eyebrow: "Routine block complete", cat: r.cat });
  else reward(r.title, xp, earned, true);
}
function untickRoutine(id) {
  const today = ymd(new Date()), log = S.routineLog[today];
  if (!log || !(id in log)) return;
  revoke(log[id], today); delete log[id]; S.stats.routineDone = Math.max(0, S.stats.routineDone - 1);
  if (!Object.keys(log).length) delete S.routineLog[today];
  save(); toast("Marked as not done");
}
function reward(title, xp, earned, small) {
  if (earned.length) return showTrophies(earned, title, xp);
  if (small) toast("Done. +" + xp + " XP"); else miniReward(title, xp);
  chime();
}
function miniReward(title, xp) {
  const old = $(".mini"); if (old) old.remove();
  const d = document.createElement("div"); d.className = "mini"; d.setAttribute("role", "status");
  d.innerHTML = '<div class="mini-top">' + ic("check") + "<b>+" + xp + " XP</b><span>" + esc(title) + "</span></div><p>“" + esc(pickQuote("any")) + "”</p>";
  document.body.appendChild(d); burst(60); setTimeout(() => d.classList.add("out"), 4200); setTimeout(() => d.remove(), 4700);
}
function showWin(o) {
  const st = S.stats;
  const tro = o.earned && o.earned.length ? '<div class="eyebrow">New trophy</div><div class="newtro">' + o.earned.map((t) => '<span class="pill">' + cupSvg(t.t) + esc(t.n) + "</span>").join("") + "</div>" : "";
  $("#layer").innerHTML = '<div class="scrim"><canvas class="confetti" id="cf"></canvas><div class="card win" role="dialog" aria-label="' + esc(o.eyebrow || "Task complete") + '"><div class="cupbig">' + cupSvg(3) + '</div><div class="eyebrow">' + esc(o.eyebrow || "Task complete") + "</div><h2>" + esc(o.title) + "</h2>" +
    '<div class="wstats"><div><b id="wt">00:00</b><span>' + (o.sec ? "Time taken" : "Not timed") + '</span></div><div><b>+' + o.xp + "</b><span>XP</span></div><div><b>" + streakNow() + "</b><span>Day streak</span></div></div>" + tro +
    '<p class="quote">“' + esc(o.quote || pickQuote(o.cat)) + '”</p><p class="note">Level ' + levelOf() + " · " + (100 - (st.xp % 100)) + " XP to the next level" + (o.att ? " · " + o.att + " distraction" + (o.att > 1 ? "s" : "") + " stopped" : "") + "</p>" +
    '<div class="controls"><button class="btn big" data-act="wdone">Continue</button><button class="btn ghost big" data-act="wnext">Focus on something else</button></div></div></div>';
  chime(); countUp($("#wt"), o.sec, clock); confetti($("#cf"));
}
function showTrophies(earned, title, xp) {
  $("#layer").innerHTML = '<div class="scrim"><canvas class="confetti" id="cf"></canvas><div class="card win" role="dialog" aria-label="Trophy unlocked"><div class="eyebrow">Trophy unlocked</div><div class="trorow">' +
    earned.map((t) => '<div class="trobig"><div class="cupbig">' + cupSvg(t.t) + "</div><h3>" + esc(t.n) + "</h3><p>" + esc(t.d) + "</p></div>").join("") + "</div>" +
    '<p class="note">' + esc(title) + " · +" + xp + ' XP</p><p class="quote">“' + esc(pickQuote("any")) + '”</p><div class="controls"><button class="btn big" data-act="wdone">Keep going</button></div></div></div>';
  chime(); confetti($("#cf"), 200);
}
function showPerfect(n, earned) {
  const tro = earned.length ? '<div class="newtro">' + earned.map((t) => '<span class="pill">' + cupSvg(t.t) + esc(t.n) + "</span>").join("") + "</div>" : "";
  $("#layer").innerHTML = '<div class="scrim"><canvas class="confetti" id="cf"></canvas><div class="card win" role="dialog" aria-label="Perfect day"><div class="cupbig">' + cupSvg(3) + '</div><div class="eyebrow">Perfect day</div><h2>Every must-do is done</h2>' +
    '<div class="wstats"><div><b>' + n + "</b><span>Must-dos</span></div><div><b>+25</b><span>Bonus XP</span></div><div><b>" + streakNow() + "</b><span>Day streak</span></div></div>" + tro +
    '<p class="quote">“Today you did exactly what you said you would.”</p><div class="controls"><button class="btn big" data-act="wdone">Continue</button></div></div></div>';
  chime(); confetti($("#cf"), 220);
}

/* ================= TODAY ================= */
function ringSvg(pct, size) {
  const C = 2 * Math.PI * 54;
  return '<svg viewBox="0 0 120 120" width="' + size + '" height="' + size + '" aria-hidden="true"><circle class="ring-bg" cx="60" cy="60" r="54"/><circle class="ring-fg" id="dring" cx="60" cy="60" r="54" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + C.toFixed(2) + '" data-target="' + (C * (1 - pct)).toFixed(2) + '"/></svg>';
}
function vToday() {
  const D = dayData(), now = nowMin(), pct = D.total ? D.done / D.total : 0, adh = adherence();
  const days = S.stats.days, sk = streakNow(), empty = !S.routine.length && !S.mustdos.length && !S.tasks.length;
  let nextBlock = D.routine.filter((x) => !x.done).find((x) => toMin(x.r.start) <= now && now < toMin(x.r.end)), nowFlag = !!nextBlock;
  if (!nextBlock) nextBlock = D.routine.filter((x) => !x.done).find((x) => toMin(x.r.start) > now);
  const msg = !D.total ? "Nothing planned yet today." : pct === 1 ? "Everything planned for today is done." : pct === 0 ? "Pick one thing and start." : pct < 0.5 ? "Good start. Keep the pace." : "More than halfway there.";
  const dots = [6, 5, 4, 3, 2, 1, 0].map((i) => { const d = addDays(new Date(), -i), on = !!days[ymd(d)]; return '<div class="sd' + (on ? " on" : "") + (i === 0 ? " now" : "") + '" title="' + d.toDateString() + '"><i></i><span>' + DAYS[dowOf(d)][0] + "</span></div>"; }).join("");
  const skMsg = activeToday() ? "Streak secured for today." : sk > 0 ? "Finish one thing today to keep your " + sk + "-day streak." : "Finish one thing today to start a streak.";
  const lvl = levelOf(), pctXp = S.stats.xp % 100;
  const mustRows = D.must.map((m) => mdRow(m, false)).join("");
  const routRows = D.routine.map((x, i) => '<li class="mini-row' + (x.done ? " done" : "") + '" style="--i:' + i + '"><button class="checkbtn" data-act="rtick" data-id="' + x.r.id + '" aria-label="' + (x.done ? "Mark not done" : "Mark done") + '">' + ic("check") + '</button><div class="grow"><div class="tt">' + esc(x.r.title) + '</div><div class="tm mono">' + fmtT(x.r.start) + " to " + fmtT(x.r.end) + "</div></div>" + shape(x.r.cat) + "</li>").join("");
  const calRows = D.cal.map((t, i) => taskRow(t, i)).join("");
  $("#viewbox").innerHTML = topbar(greeting() + ", " + esc(USER.name.split(" ")[0]), new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })) +
    (empty ? '<section class="card start"><div class="eyebrow">Start here</div><h2>Your day is empty. Fill it in.</h2><p class="lead">Nothing is pre-filled. Add your own plans, then come back to watch this page track your day.</p><div class="controls left"><button class="btn" data-act="nav" data-v="routine">' + ic("routine") + 'Build my weekly routine</button><button class="btn ghost" data-act="nav" data-v="must">' + ic("must") + 'Add a must-do</button><button class="btn ghost" data-act="nav" data-v="calendar">' + ic("cal") + "Plan on the calendar</button></div></section>" : "") +
    '<div class="grid2"><div class="col">' +
    '<section class="card hero-day"><div class="ringbox">' + ringSvg(pct, 132) + '<div class="ringc"><b class="mono" id="dcount">' + D.done + '/' + D.total + "</b><span>done today</span></div></div><div class=\"grow\"><div class=\"eyebrow\">Today's progress</div><h2>" + msg + "</h2>" +
    (nextBlock ? '<div class="next"><span class="pill' + (nowFlag ? " live" : "") + '">' + (nowFlag ? "Now" : "Up next") + '</span><b>' + esc(nextBlock.r.title) + '</b><span class="mono">' + fmtT(nextBlock.r.start) + " to " + fmtT(nextBlock.r.end) + '</span></div><div class="controls left"><button class="btn" data-act="focusitem" data-key="r:' + nextBlock.r.id + '">' + ic("play") + 'Start focus</button><button class="btn ghost" data-act="rtick" data-id="' + nextBlock.r.id + '">' + ic("check") + "Tick off</button></div>" : '<div class="controls left"><button class="btn" data-act="focusitem" data-key="f">' + ic("play") + "Start a focus session</button></div>") + "</div></section>" +
    '<section class="card"><div class="sec-h"><h3>Must-do today</h3><button class="link" data-act="nav" data-v="must">Open</button></div><ul class="list" id="todayMust">' + (mustRows || '<li class="empty-s">No must-dos for today yet.</li>') + '</ul>' +
    '<form id="mdQuick" class="addrow" data-scope="day"><input id="mdQuickT" maxlength="140" autocomplete="off" aria-label="New must-do for today" placeholder="Add a must-do for today"><button class="btn" type="submit">Add</button></form></section>' +
    '<section class="card"><div class="sec-h"><h3>Routine today</h3><button class="link" data-act="nav" data-v="routine">Open</button></div><ul class="list">' + (routRows || '<li class="empty-s">No routine blocks for ' + DAYFULL[D.dow] + ". Add some in Routine.</li>") + "</ul></section>" +
    (calRows ? '<section class="card"><div class="sec-h"><h3>Calendar today</h3><button class="link" data-act="nav" data-v="calendar">Open</button></div><div class="tasks">' + calRows + "</div></section>" : "") +
    '</div><div class="col"><section class="card streak"><div class="sk-top">' + ic("flame") + '<b class="mono" id="skn">' + sk + '</b><span>day streak</span></div><div class="sdots">' + dots + '</div><p class="note">' + skMsg + "</p></section>" +
    '<section class="card"><div class="sec-h"><h3>Level ' + lvl + '</h3><span class="pill">' + levelName() + '</span></div><div class="xpbar" role="progressbar" aria-valuenow="' + pctXp + '" aria-valuemin="0" aria-valuemax="100"><i id="xpf" style="width:0"></i></div><p class="note">' + pctXp + " / 100 XP to level " + (lvl + 1) + "</p></section>" +
    '<section class="card"><div class="sec-h"><h3>Routine this week</h3></div>' + (adh.total ? '<div class="adh"><b class="mono">' + adh.done + "/" + adh.total + '</b><span>blocks ticked so far</span></div><div class="xpbar"><i style="width:' + Math.round(adh.done / adh.total * 100) + '%"></i></div><p class="note">' + Math.round(adh.done / adh.total * 100) + "% of the blocks scheduled up to now.</p>" : '<p class="note">No routine blocks scheduled yet this week.</p>') + "</section>" +
    '<section class="card quote-card"><div class="eyebrow">For today</div><p class="quote">“' + esc(dailyQuote()) + "”</p></section></div></div>";
  requestAnimationFrame(() => setTimeout(() => {
    const r = $("#dring"); if (r) r.style.strokeDashoffset = r.dataset.target;
    const x = $("#xpf"); if (x) x.style.width = pctXp + "%";
  }, 60));
}

/* ================= CALENDAR ================= */
const tasksOn = (d) => S.tasks.filter((t) => t.date === d).sort(byTime);
function vCalendar() {
  const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + CAL.off);
  const y = base.getFullYear(), mo = base.getMonth(), first = new Date(y, mo, 1), lead = (first.getDay() + 6) % 7, nd = new Date(y, mo + 1, 0).getDate(), todayS = ymd(new Date());
  let cells = "";
  for (let i = 0; i < lead; i++) cells += dayCell(addDays(first, i - lead), true, todayS);
  for (let d = 1; d <= nd; d++) cells += dayCell(new Date(y, mo, d), false, todayS);
  const tail = (7 - ((lead + nd) % 7)) % 7; for (let j = 1; j <= tail; j++) cells += dayCell(new Date(y, mo + 1, j), true, todayS);
  const list = tasksOn(CAL.sel), sd = parse(CAL.sel), pend = S.tasks.filter((t) => !t.done).length;
  $("#viewbox").innerHTML = topbar("Calendar", pend + " task" + (pend === 1 ? "" : "s") + " waiting. Pick a day and plan it.") +
    '<div class="cal-grid"><section class="card" aria-label="Calendar"><div class="cal-head"><h2>' + base.toLocaleDateString(undefined, { month: "long", year: "numeric" }) + '</h2><div class="row"><button class="iconbtn" data-act="mprev" aria-label="Previous month">' + ic("l") + '</button><button class="btn ghost sm" data-act="mtoday">Today</button><button class="iconbtn" data-act="mnext" aria-label="Next month">' + ic("r") + "</button></div></div>" +
    '<div class="dow">' + DAYS.map((x) => "<span>" + x + "</span>").join("") + '</div><div class="days">' + cells + "</div></section>" +
    '<section class="card" aria-label="Tasks for the selected day"><div class="row between"><div><div class="eyebrow">' + (CAL.sel === todayS ? "Today" : sd.toLocaleDateString(undefined, { weekday: "long" })) + '</div><h2>' + sd.toLocaleDateString(undefined, { day: "numeric", month: "long" }) + '</h2></div><button class="btn" data-act="tadd">' + ic("plus") + 'Add task</button></div><div class="tasks">' +
    (list.length ? list.map(taskRow).join("") : '<div class="empty">Nothing planned for this day.<br>Add a task and give it a start time.</div>') + "</div></section></div>";
}
function dayCell(d, out, todayS) {
  const s = ymd(d), ts = tasksOn(s), cats = []; ts.forEach((t) => { if (cats.indexOf(t.cat) < 0) cats.push(t.cat); });
  return '<button class="day' + (out ? " out" : "") + (s === todayS ? " today" : "") + (s === CAL.sel ? " sel" : "") + '" data-act="day" data-d="' + s + '" aria-label="' + d.toDateString() + ", " + ts.length + ' tasks"><span>' + d.getDate() + '</span><span class="dots">' + cats.slice(0, 4).map(shape).join("") + "</span></button>";
}
function taskRow(t, i) {
  return '<div class="task' + (t.done ? " done" : "") + '" style="--i:' + (i || 0) + '">' + shape(t.cat) + '<div class="grow"><div class="tt">' + esc(t.title) + '</div><div class="tm">' + (t.time ? fmtT(t.time) : "Any time") + " · " + t.mins + " min · " + CATS[t.cat] + (t.done && t.doneSec ? " · took " + clock(t.doneSec) : "") + "</div></div>" +
    (t.done ? "" : '<button class="iconbtn" data-act="focusitem" data-key="t:' + t.id + '" aria-label="Start focus session" title="Start focus">' + ic("timer") + "</button>") +
    '<button class="checkbtn" data-act="tdone" data-id="' + t.id + '" aria-label="' + (t.done ? "Done" : "Mark done") + '"' + (t.done ? " disabled" : "") + ">" + ic("check") + '</button><button class="iconbtn" data-act="tdel" data-id="' + t.id + '" aria-label="Delete task" title="Delete">' + ic("x") + "</button></div>";
}
let TM = { cat: "study" };
function openTaskModal() {
  $("#layer").innerHTML = '<div class="scrim" data-act="closem"><form class="card sheet" id="taskForm" novalidate role="dialog" aria-label="Add task"><div class="row between mb"><h2>New task</h2><button type="button" class="iconbtn" data-act="closem" aria-label="Close">' + ic("x") + "</button></div>" +
    '<div class="field"><label for="tTitle">What do you need to do?</label><input id="tTitle" maxlength="140" autocomplete="off" placeholder="Maths revision, client meeting, 5 km run"></div>' +
    '<div class="field"><label>Type</label><div class="catpick">' + catChips(TM.cat) + "</div></div>" +
    '<div class="pickers"><div class="field"><label for="tDate">Date</label><input id="tDate" type="date" value="' + CAL.sel + '"></div><div class="field"><label for="tTime">Start time</label><input id="tTime" type="time" value="09:00"></div></div>' +
    '<div class="field"><label for="tMins">Focus length</label><select id="tMins">' + [1, 5, 15, 25, 30, 45, 60, 90, 120].map((m) => '<option value="' + m + '"' + (m === 25 ? " selected" : "") + ">" + (m === 1 ? "1 min (quick test)" : m + " min") + "</option>").join("") + "</select></div>" +
    '<div class="err" id="tErr" role="alert"></div><button class="btn big full" type="submit">Save task</button></form></div>';
  $("#tTitle").focus();
}
const catChips = (cur) => Object.keys(CATS).map((c) => '<button type="button" data-act="cat" data-c="' + c + '" aria-pressed="' + (c === cur) + '">' + shape(c) + CATS[c] + "</button>").join("");

/* ================= ROUTINE ================= */
let RM = null;
function vRoutine() {
  const today = dowOf(new Date()), sel = R.dow, isToday = sel === today, log = logFor(ymd(new Date())), items = routineOn(sel), now = nowMin();
  const tabs = DAYS.map((d, i) => '<button class="daytab" data-act="rday" data-v="' + i + '" aria-pressed="' + (i === sel) + '"' + (i === today ? ' data-today="1"' : "") + "><span>" + d + '</span><b class="mono">' + routineOn(i).length + "</b></button>").join("");
  const rows = items.map((r, i) => {
    const done = isToday && r.id in log, live = isToday && toMin(r.start) <= now && now < toMin(r.end), missed = isToday && !done && toMin(r.end) <= now;
    const prog = live ? Math.round((now - toMin(r.start)) / Math.max(1, durMin(r)) * 100) : 0, dm = durMin(r);
    return '<div class="tl-row' + (live ? " live" : "") + (done ? " done" : "") + (missed ? " missed" : "") + '" style="--i:' + i + '"><div class="tl-time mono"><b>' + fmtT(r.start) + "</b><span>" + fmtT(r.end) + '</span></div><div class="tl-body"><div class="tt">' + esc(r.title) + (live ? ' <span class="pill live">Now</span>' : "") + (missed ? ' <span class="pill">Not ticked</span>' : "") + '</div><div class="tm">' + shape(r.cat) + " " + CATS[r.cat] + " · " + (dm >= 60 ? Math.floor(dm / 60) + "h" + (dm % 60 ? " " + dm % 60 + "m" : "") : dm + " min") + (r.note ? " · " + esc(r.note) : "") + "</div>" + (live ? '<div class="xpbar thin"><i style="width:' + prog + '%"></i></div>' : "") + '</div><div class="tl-act">' +
      (isToday ? (done ? "" : '<button class="iconbtn" data-act="focusitem" data-key="r:' + r.id + '" aria-label="Start focus" title="Start focus">' + ic("timer") + "</button>") + '<button class="checkbtn" data-act="rtick" data-id="' + r.id + '" aria-label="' + (done ? "Mark not done" : "Mark done") + '">' + ic("check") + "</button>" : "") +
      '<button class="iconbtn" data-act="redit" data-id="' + r.id + '" aria-label="Edit block" title="Edit">' + ic("pencil") + "</button></div></div>";
  }).join("");
  const adh = adherence();
  const week = DAYS.map((d, i) => '<div class="wcol' + (i === today ? " today" : "") + '"><h4>' + d + "</h4>" + (routineOn(i).map((r) => '<button class="wchip" data-act="redit" data-id="' + r.id + '"><span class="mono">' + fmtT(r.start) + "</span>" + esc(r.title) + "</button>").join("") || '<span class="wnone">Free</span>') + "</div>").join("");
  $("#viewbox").innerHTML = topbar("Weekly routine", "Your week, time to time. Repeats every week.", '<button class="btn" data-act="radd">' + ic("plus") + "Add block</button>") +
    '<div class="daytabs" role="group" aria-label="Day of the week">' + tabs + "</div>" +
    '<section class="card"><div class="row between mb"><div><div class="eyebrow">' + (isToday ? "Today" : "Every week") + "</div><h2>" + DAYFULL[sel] + "</h2></div>" + (isToday && adh.total ? '<div class="adh right"><b class="mono">' + adh.done + "/" + adh.total + "</b><span>ticked this week</span></div>" : "") + "</div>" +
    '<div class="timeline">' + (rows || '<div class="empty">No blocks on ' + DAYFULL[sel] + ' yet.<br>Add your wake-up, study, work or workout blocks.<br><br><button class="btn" data-act="radd">' + ic("plus") + "Add a block</button></div>") + "</div></section>" +
    '<section class="card"><div class="sec-h"><h3>Week at a glance</h3><span class="note">Tap a block to edit</span></div><div class="wscroll"><div class="week">' + week + "</div></div></section>";
}
function openRoutineModal(id) {
  const r = id ? S.routine.find((x) => x.id === id) : null;
  RM = { id: id || null, cat: r ? r.cat : "study", days: r ? r.days.slice() : [R.dow], warned: false };
  $("#layer").innerHTML = '<div class="scrim" data-act="closem"><form class="card sheet" id="routineForm" novalidate role="dialog" aria-label="' + (r ? "Edit" : "Add") + ' routine block"><div class="row between mb"><h2>' + (r ? "Edit block" : "New routine block") + '</h2><button type="button" class="iconbtn" data-act="closem" aria-label="Close">' + ic("x") + "</button></div>" +
    '<div class="field"><label for="rTitle">What is this block?</label><input id="rTitle" maxlength="80" autocomplete="off" placeholder="Morning study, gym, deep work" value="' + esc(r ? r.title : "") + '"></div>' +
    '<div class="field"><label>Type</label><div class="catpick" id="rCats">' + catChips(RM.cat).replace(/data-act="cat"/g, 'data-act="rcat"') + "</div></div>" +
    '<div class="field"><label>Repeats on</label><div class="dchips" id="rDays">' + DAYS.map((d, i) => '<button type="button" data-act="rdchip" data-v="' + i + '" aria-pressed="' + (RM.days.indexOf(i) >= 0) + '">' + d + "</button>").join("") + '</div><div class="presets"><button type="button" class="link" data-act="rpreset" data-v="wk">Weekdays</button><button type="button" class="link" data-act="rpreset" data-v="all">Every day</button><button type="button" class="link" data-act="rpreset" data-v="we">Weekend</button></div></div>' +
    '<div class="pickers"><div class="field"><label for="rStart">Starts</label><input id="rStart" type="time" value="' + (r ? r.start : "09:00") + '"></div><div class="field"><label for="rEnd">Ends</label><input id="rEnd" type="time" value="' + (r ? r.end : "10:00") + '"></div></div>' +
    '<div class="field"><label for="rNote">Note (optional)</label><input id="rNote" maxlength="120" autocomplete="off" value="' + esc(r ? r.note || "" : "") + '"></div><div class="err" id="rErr" role="alert"></div>' +
    '<div class="row"><button class="btn big grow" type="submit" id="rSave">Save block</button>' + (r ? '<button type="button" class="btn ghost big" data-act="rdel" data-id="' + r.id + '">Delete</button>' : "") + "</div></form></div>";
  $("#rTitle").focus();
}
function saveRoutine() {
  const title = $("#rTitle").value.trim(), start = $("#rStart").value, end = $("#rEnd").value, err = $("#rErr");
  if (!title) return (err.textContent = "Give the block a name.");
  if (!RM.days.length) return (err.textContent = "Pick at least one day.");
  const s = toMin(start), e = toMin(end);
  if (s === null || e === null) return (err.textContent = "Set a start and end time.");
  if (e <= s) return (err.textContent = "The end time must be after the start time. For a block that crosses midnight, make two blocks.");
  const ov = [];
  RM.days.forEach((d) => S.routine.forEach((o) => { if (o.id !== RM.id && o.days.indexOf(d) >= 0 && toMin(o.start) < e && s < toMin(o.end)) ov.push(DAYS[d] + ": " + o.title); }));
  if (ov.length && !RM.warned) { RM.warned = true; err.textContent = "Overlaps with " + ov.slice(0, 2).join(", ") + (ov.length > 2 ? " and more" : "") + ". Press the button again to keep both."; $("#rSave").textContent = "Save anyway"; return; }
  const item = { id: RM.id || uid(), title, cat: RM.cat, days: RM.days.slice().sort(), start, end, note: $("#rNote").value.trim() };
  if (RM.id) { const i = S.routine.findIndex((x) => x.id === RM.id); S.routine[i] = item; } else S.routine.push(item);
  if (RM.days.indexOf(R.dow) < 0) R.dow = RM.days[0];
  save(); closeLayer(); toast(RM.id ? "Block updated" : "Block added"); renderView(true);
}

/* ================= MUST-DO ================= */
const SCOPES = [["day", "Today"], ["week", "This week"], ["month", "This month"]];
function mdRow(m, carried) {
  return '<li class="md' + (m.done ? " done" : "") + (m.pri ? " pri" : "") + '"><button class="checkbtn" data-act="mdtick" data-id="' + m.id + '" aria-label="' + (m.done ? "Mark not done" : "Mark done") + '">' + ic("check") + '</button><div class="grow"><div class="tt">' + esc(m.title) + '</div><div class="tm">' +
    (carried ? "Carried over from " + labelFor(m.scope, m.period).replace(/^This (week|month), /, "") : m.done ? "Done" + (m.doneAt ? " at " + new Date(m.doneAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "") : m.pri ? "Top priority" : "Must-do") + "</div></div>" +
    (m.done ? "" : '<button class="iconbtn" data-act="focusitem" data-key="m:' + m.id + '" aria-label="Start focus" title="Start focus">' + ic("timer") + "</button>") +
    '<button class="iconbtn star" data-act="mdstar" data-id="' + m.id + '" aria-pressed="' + !!m.pri + '" aria-label="Top priority" title="Top priority">' + ic("star") + '</button><button class="iconbtn" data-act="mddel" data-id="' + m.id + '" aria-label="Delete" title="Delete">' + ic("x") + "</button></li>";
}
function vMust() {
  const scope = M.scope, key = keyFor(scope, M.cursor), curKey = keyFor(scope, new Date()), isCur = key === curKey;
  let list = S.mustdos.filter((m) => m.scope === scope && m.period === key);
  list = list.filter((m) => !m.done).sort((a, b) => (b.pri ? 1 : 0) - (a.pri ? 1 : 0) || a.created - b.created).concat(list.filter((m) => m.done).sort((a, b) => (a.doneAt || 0) - (b.doneAt || 0)));
  const carried = isCur ? S.mustdos.filter((m) => m.scope === scope && !m.done && m.period < curKey).sort((a, b) => a.period.localeCompare(b.period)) : [];
  const done = list.filter((m) => m.done).length, pct = list.length ? Math.round(done / list.length * 100) : 0;
  const tabs = SCOPES.map((s) => { const c = S.mustdos.filter((m) => m.scope === s[0] && !m.done && m.period <= keyFor(s[0], new Date())).length; return '<button data-act="mscope" data-v="' + s[0] + '" aria-pressed="' + (s[0] === scope) + '">' + s[1] + (c ? ' <b class="mono">' + c + "</b>" : "") + "</button>"; }).join("");
  const ph = scope === "day" ? "What must happen today?" : scope === "week" ? "What must get done this week?" : "What must get done this month?";
  const emptyMsg = scope === "day" ? "No must-dos for this day. Add the one or two things that have to happen." : scope === "week" ? "No must-dos for this week. Add the big things that need to ship." : "No must-dos for this month. Add the goals that matter most.";
  $("#viewbox").innerHTML = topbar("Must-do", "The important things that cannot slip.") +
    '<div class="row between wrapm mb"><div class="seg wide" role="group" aria-label="Period">' + tabs + '</div><div class="row"><button class="iconbtn" data-act="mprevp" aria-label="Previous">' + ic("l") + '</button><b class="plabel">' + labelFor(scope, key) + '</b><button class="iconbtn" data-act="mnextp" aria-label="Next">' + ic("r") + "</button>" + (isCur ? "" : '<button class="btn ghost sm" data-act="mnow">Back to now</button>') + "</div></div>" +
    '<section class="card"><form id="mdForm" class="addrow" data-scope="' + scope + '"><input id="mdTitle" maxlength="140" autocomplete="off" aria-label="New must-do" placeholder="' + ph + '"><button type="button" class="iconbtn star" data-act="newstar" id="newStar" aria-pressed="' + M.star + '" aria-label="Mark as top priority" title="Top priority">' + ic("star") + '</button><button class="btn" type="submit">' + ic("plus") + "Add</button></form>" +
    (list.length ? '<div class="prog"><span class="mono">' + done + " of " + list.length + ' done</span><div class="xpbar thin"><i style="width:' + pct + '%"></i></div></div>' : "") +
    '<ul class="list big">' + (list.map((m) => mdRow(m, false)).join("") || '<li class="empty-s">' + emptyMsg + "</li>") + "</ul></section>" +
    (carried.length ? '<section class="card"><div class="sec-h"><h3>Carried over</h3><span class="note">Not finished in an earlier ' + (scope === "day" ? "day" : scope) + "</span></div><ul class=\"list\">" + carried.map((m) => mdRow(m, true).replace("</li>", '<button class="btn ghost sm" data-act="mdmove" data-id="' + m.id + '">Move here</button></li>')).join("") + "</ul></section>" : "");
}
function addMust(title, scope, key) {
  title = title.trim(); if (!title) return false;
  S.mustdos.push({ id: uid(), title: title.slice(0, 140), scope, period: key, pri: false, done: false, created: Date.now() });
  save(); return true;
}

/* ================= FOCUS ================= */
const F = { key: null, item: null, dur: "item", status: "idle", elapsed: 0, runStart: 0, attempts: 0, giveArmed: false, timer: null };
function focusables() {
  const today = ymd(new Date()), dow = dowOf(new Date()), log = logFor(today), out = [], keys = { week: isoWeekKey(new Date()), month: monthKey(new Date()) };
  routineOn(dow).filter((r) => !(r.id in log)).forEach((r) => out.push({ key: "r:" + r.id, kind: "r", id: r.id, title: r.title, mins: Math.min(180, Math.max(1, durMin(r))), cat: r.cat, group: "Routine today" }));
  S.mustdos.filter((m) => !m.done && ((m.scope === "day" && m.period === today) || (m.scope === "week" && m.period === keys.week) || (m.scope === "month" && m.period === keys.month))).forEach((m) => out.push({ key: "m:" + m.id, kind: "m", id: m.id, title: m.title, mins: 25, cat: "any", group: "Must-do" }));
  S.tasks.filter((t) => !t.done && t.date >= today).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))).slice(0, 30).forEach((t) => out.push({ key: "t:" + t.id, kind: "t", id: t.id, title: t.title, mins: t.mins, cat: t.cat, group: "Calendar" }));
  out.push({ key: "f", kind: "f", id: null, title: "Free focus", mins: 25, cat: "any", group: "Anything else" });
  return out;
}
const selItem = () => (F.status === "idle" ? focusables().find((x) => x.key === F.key) || focusables()[0] : F.item);
const totalSec = () => { const it = selItem(); return (F.dur === "item" ? (it ? it.mins : 25) : +F.dur) * 60; };
const elapsedNow = () => F.elapsed + (F.status === "running" ? (Date.now() - F.runStart) / 1000 : 0);
const shieldOn = () => F.status === "running" || F.status === "paused";
function vFocus() {
  const all = focusables(), idle = F.status === "idle";
  if (idle && !all.some((x) => x.key === F.key)) F.key = all[0].key;
  const it = selItem(), groups = {};
  all.forEach((x) => { (groups[x.group] = groups[x.group] || []).push(x); });
  const opts = Object.keys(groups).map((g) => '<optgroup label="' + g + '">' + groups[g].map((x) => '<option value="' + x.key + '"' + (x.key === (it && it.key || F.key) ? " selected" : "") + ">" + esc(x.title) + "</option>").join("") + "</optgroup>").join("");
  $("#viewbox").innerHTML = topbar("Focus room", "One thing at a time. Everything else can wait.") +
    '<div class="focus-grid"><section class="card" id="fcard"><div class="pickers"><div class="field"><label for="fTask">Focus on</label><select id="fTask"' + (idle ? "" : " disabled") + ">" + opts + '</select></div><div class="field"><label for="fDur">Length</label><select id="fDur"' + (idle ? "" : " disabled") + '><option value="item"' + (F.dur === "item" ? " selected" : "") + ">Default (" + (it ? it.mins : 25) + " min)</option>" + [1, 5, 15, 25, 45, 60, 90].map((m) => '<option value="' + m + '"' + (String(F.dur) === String(m) ? " selected" : "") + ">" + m + " min</option>").join("") + "</select></div></div>" +
    '<div class="ringwrap"><svg viewBox="0 0 200 200" aria-hidden="true"><circle class="ring-bg" cx="100" cy="100" r="90" stroke-width="10"/><circle class="ring-fg" id="ring" cx="100" cy="100" r="90" stroke-width="10" stroke-dasharray="565.49" stroke-dashoffset="0"/></svg><div class="ringtxt"><b class="mono" id="clk">00:00</b><span id="clkl">Ready</span></div></div><div class="controls" id="ctl"></div></section>' +
    '<section class="phone" aria-label="Shield preview"><div class="phone-top"><span class="eyebrow">Focus shield</span><span class="shield" id="shield"></span></div><div class="launcher" id="launcher"></div><p class="hint" id="hint"></p></section></div>';
  const ft = $("#fTask"), fd = $("#fDur");
  ft.addEventListener("change", () => { F.key = ft.value; F.dur = "item"; vFocus(); });
  fd.addEventListener("change", () => { F.dur = fd.value; paintClock(); });
  paintLauncher(); paintControls(); paintClock();
}
function paintControls() {
  const c = $("#ctl"); if (!c) return; const s = F.status;
  c.innerHTML = s === "idle" ? '<button class="btn big" data-act="fstart">' + ic("play") + "Start focus</button>" :
    (s === "running" ? '<button class="btn ghost big" data-act="fpause">' + ic("pause") + "Pause</button>" : '<button class="btn big" data-act="fstart">' + ic("play") + "Resume</button>") +
    '<button class="btn big" data-act="ffinish">' + ic("check") + 'Finish</button><button class="btn ghost big" data-act="fgive">' + (F.giveArmed ? "Tap again to quit" : "Give up") + "</button>";
  const card = $("#fcard"); if (card) card.classList.toggle("running", s === "running");
}
function paintClock() {
  const clk = $("#clk"); if (!clk) return;
  const tot = totalSec(), el = elapsedNow(), rem = Math.max(0, tot - el);
  clk.textContent = clock(F.status === "idle" ? tot : rem);
  $("#clkl").textContent = F.status === "running" ? "Remaining" : F.status === "paused" ? "Paused" : "Ready";
  $("#ring").style.strokeDashoffset = String(565.49 * (F.status === "idle" ? 0 : Math.min(1, el / tot)));
}
function paintLauncher() {
  const l = $("#launcher"); if (!l) return; const on = shieldOn(), hide = S.settings.mode === "hide";
  l.innerHTML = APPS.map((a) => { const blocked = S.settings.apps[a.id] === "block"; return '<button class="app' + (on && blocked ? (hide ? " gone" : " locked") : "") + '" data-act="openapp" data-id="' + a.id + '" aria-label="Open ' + a.n + '"><span class="tile">' + a.g + "</span>" + a.n + "</button>"; }).join("");
  const sh = $("#shield"); sh.className = "shield" + (on ? " on" : ""); sh.innerHTML = ic("lock") + (on ? "Shield on" : "Shield off");
  $("#hint").textContent = on ? "Tap an app to preview. Allowed apps open, blocked ones stop you. Leaving this tab counts as a distraction." : "Press Start and your blocked apps lock for the whole session. In the browser, leaving this tab or window counts as a distraction.";
}
function startF() {
  const it = selItem(); if (!it) return;
  if (F.status === "idle") { F.item = { kind: it.kind, id: it.id, title: it.title, mins: it.mins, cat: it.cat, key: it.key }; F.elapsed = 0; F.attempts = 0; }
  F.status = "running"; F.runStart = Date.now(); F.giveArmed = false;
  try { if (navigator.wakeLock) navigator.wakeLock.request("screen").catch(() => {}); } catch (e) { /* ignore */ }
  if (!F.timer) F.timer = setInterval(globalTick, 400);
  if (V === "focus") { const t = $("#fTask"), d = $("#fDur"); if (t) t.disabled = true; if (d) d.disabled = true; paintControls(); paintLauncher(); paintClock(); }
  paintMini();
}
function pauseF() { F.elapsed = elapsedNow(); F.status = "paused"; paintControls(); paintLauncher(); paintClock(); paintMini(); }
function resetF() { clearInterval(F.timer); F.timer = null; F.status = "idle"; F.elapsed = 0; F.attempts = 0; F.giveArmed = false; F.item = null; paintMini(); }
function globalTick() {
  if (F.status !== "running") { clearInterval(F.timer); F.timer = null; paintMini(); return; }
  if (totalSec() - elapsedNow() <= 0) { finishSession(); return; }
  if (V === "focus") paintClock();
  paintMini();
}
function paintMini() {
  const b = $("#mini"); if (!b) return;
  const show = shieldOn() && V !== "focus";
  b.hidden = !show; if (!show) return;
  b.innerHTML = '<span class="dot' + (F.status === "running" ? " live" : "") + '"></span><b>' + esc(F.item ? F.item.title : "Focus") + '</b><span class="mono">' + clock(Math.max(0, totalSec() - elapsedNow())) + "</span>";
}
function finishSession() {
  const sec = Math.round(Math.max(1, elapsedNow())), it = F.item, att = F.attempts; resetF();
  if (!it) return;
  if (it.kind === "t") { const t = S.tasks.find((x) => x.id === it.id); if (t && !t.done) return completeTask(t, sec, att); }
  if (it.kind === "m") { const m = S.mustdos.find((x) => x.id === it.id); if (m && !m.done) return completeMust(m, sec, att, true); }
  if (it.kind === "r") { const r = S.routine.find((x) => x.id === it.id); if (r && !(it.id in logFor(ymd(new Date())))) return tickRoutine(it.id, sec, att, true); }
  const xp = Math.max(1, Math.floor(sec / 60) * 2) + (sec >= 60 && !att ? 5 : 0);
  const earned = grant(xp, sec, att);
  showWin({ title: it.title, sec, xp, earned, att, eyebrow: "Focus session complete", cat: "any" });
}
function openApp(id) {
  const a = APPS.find((x) => x.id === id); if (!a) return;
  if (F.status === "running" && S.settings.apps[id] === "block") { F.attempts++; showWarn(a.n + " is blocked", "You are in a focus session."); return; }
  toast(a.n + " opened" + (shieldOn() ? " (allowed during focus)" : ""));
}
function showWarn(title, lead) {
  const rem = Math.max(0, totalSec() - elapsedNow()), it = F.item;
  $("#layer").innerHTML = '<div class="scrim"><div class="card warn" role="alertdialog" aria-label="Distraction"><div class="bigic">' + ic("alert") + "</div><h2>" + esc(title) + '</h2><p class="lead">' + esc(lead) + ' <b class="mono">' + clock(rem) + "</b> left" + (it ? " on <b>" + esc(it.title) + "</b>" : "") + '.</p><p class="note">Distractions this session: <b>' + F.attempts + '</b></p><div class="controls"><button class="btn big" data-act="closem">Back to work</button></div></div></div>';
}
let leftAt = 0;
function onLeave() {
  if (F.status !== "running" || leftAt) return; leftAt = Date.now();
  try { if (window.Notification && Notification.permission === "granted") new Notification("Back to your focus session", { body: F.item ? F.item.title : "", tag: "gridex-leave" }); } catch (e) { /* ignore */ }
}
function onBack() {
  if (!leftAt) return; const sec = Math.round((Date.now() - leftAt) / 1000); leftAt = 0;
  if (F.status !== "running" || sec < 2) return;
  F.attempts++; showWarn("You left your focus session", "You were away for " + (sec < 60 ? sec + " s" : Math.round(sec / 60) + " min") + ".");
}
document.addEventListener("visibilitychange", () => { if (document.hidden) { onLeave(); flush(); } else onBack(); });
window.addEventListener("blur", onLeave); window.addEventListener("focus", onBack);

/* ================= REWARDS ================= */
function vRewards() {
  const st = S.stats, lvl = levelOf(), pct = st.xp % 100, days = st.days;
  const end = addDays(mondayOf(new Date()), 6), start = addDays(end, -83), today = new Date(); let cells = "";
  for (let i = 0; i < 84; i++) { const d = addDays(start, i), n = days[ymd(d)] || 0, fut = d > today, l = fut ? "f" : n === 0 ? 0 : n < 2 ? 1 : n < 4 ? 2 : 3; cells += '<i class="h' + l + '" title="' + d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) + ": " + n + (n === 1 ? " win" : " wins") + '"></i>'; }
  $("#viewbox").innerHTML = topbar("Rewards", "Every finished task earns something. Keep the streak alive.") +
    '<section class="card level"><div class="lvl-badge"><small>Level</small><b>' + lvl + '</b></div><div class="grow"><h2>' + levelName() + '</h2><div class="xpbar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i id="xpf" style="width:0"></i></div><div class="note">' + pct + " / 100 XP to level " + (lvl + 1) + " · " + st.xp + " XP in total</div></div></section>" +
    '<div class="metrics"><div class="metric"><span class="eyebrow">Tasks finished</span><b class="mono">' + totalWins() + '</b></div><div class="metric"><span class="eyebrow">Focus time</span><b class="mono">' + human(st.totalSec) + '</b></div><div class="metric"><span class="eyebrow">Current streak</span><b class="mono">' + streakNow() + ' d</b></div><div class="metric"><span class="eyebrow">Perfect days</span><b class="mono">' + (st.perfectDays || 0) + '</b></div><div class="metric"><span class="eyebrow">Trophies</span><b class="mono">' + st.trophies.filter((id) => TROPHIES.some((t) => t.id === id)).length + "/" + TROPHIES.length + "</b></div></div>" +
    '<section class="card"><div class="sec-h"><h3>Last 12 weeks</h3><span class="note">Darker means more wins that day</span></div><div class="wscroll"><div class="heat">' + cells + "</div></div></section>" +
    '<h2 class="sech">Trophy cabinet</h2><div class="trophies">' + TROPHIES.map((x, i) => { const got = st.trophies.indexOf(x.id) >= 0; return '<div class="tro ' + (got ? "got" : "locked") + '" style="--i:' + i + '">' + cupSvg(x.t) + "<b>" + x.n + "</b><span>" + (got ? "Unlocked" : x.d) + "</span></div>"; }).join("") + "</div>";
  setTimeout(() => { const f = $("#xpf"); if (f) f.style.width = pct + "%"; }, 80);
}

/* ================= SETTINGS ================= */
const notifState = () => ("Notification" in window ? Notification.permission : "unsupported");
const permRow = (t, d, p, tone, btn) => '<div class="permrow"><div class="grow"><b>' + t + '</b><div class="note">' + d + '</div></div><span class="pill' + (tone ? " " + tone : "") + '">' + p + "</span>" + (btn || "") + "</div>";
const seg = (act, cur, opts) => '<div class="seg" role="group">' + opts.map((o) => '<button data-act="' + act + '" data-v="' + o[0] + '" aria-pressed="' + (String(cur) === String(o[0])) + '">' + o[1] + "</button>").join("") + "</div>";
function vSettings() {
  const s = S.settings, ns = notifState(), wake = "wakeLock" in navigator;
  const np = ns === "granted" ? ["Allowed", "ok"] : ns === "denied" ? ["Blocked", "bad"] : ns === "unsupported" ? ["Not supported", ""] : ["Not asked", ""];
  $("#viewbox").innerHTML = topbar("Settings", "Permissions, blocked apps and preferences.") + '<div class="sgrid">' +
    '<section class="card"><h2>Permissions</h2><p class="note mb">What GrideX can do on this device.</p>' +
    permRow("Notifications", ns === "denied" ? "Turn this on in your browser's site settings to get a nudge when you leave a session." : "Sends a nudge when you leave GrideX during a session.", np[0], np[1], ns === "default" ? '<button class="btn sm" data-act="notif">Allow</button>' : "") +
    permRow("Keep screen on", wake ? "Stops your screen from sleeping while a session runs." : "This browser cannot keep the screen on.", wake ? "Active in sessions" : "Not supported", wake ? "ok" : "") +
    permRow("Tab and window switching", "Leaving this tab or window while a session runs counts as a distraction.", "Always on", "ok") +
    permRow("Usage access", "Lets the Android app see which app is open so blocked apps can be caught.", "Android app only", "") +
    permRow("Display over other apps", "Lets the Android app show the warning board on top of a blocked app.", "Android app only", "") +
    permRow("Do Not Disturb", "Lets the Android app silence calls and alerts during a session.", "Android app only", "") + "</section>" +
    '<section class="card"><h2>Allowed and blocked apps</h2><p class="note mb">Allowed apps stay usable during a session. Blocked apps show the warning board or disappear.</p><div class="row between wrapm"><b>When a blocked app is opened</b>' + seg("mode", s.mode, [["warn", "Warning board"], ["hide", "Hide app"]]) + '</div><div class="row wrapm mt"><button class="btn ghost sm" data-act="allall">Allow all</button><button class="btn ghost sm" data-act="blockdist">Block social and entertainment</button></div>' +
    APPS.map((a) => { const v = s.apps[a.id]; return '<div class="approw"><span class="tile">' + a.g + '</span><b class="grow">' + a.n + '</b><div class="seg' + (v === "block" ? " block" : "") + '" role="group" aria-label="' + a.n + '"><button data-act="app" data-id="' + a.id + '" data-v="allow" aria-pressed="' + (v === "allow") + '">Allow</button><button data-act="app" data-id="' + a.id + '" data-v="block" aria-pressed="' + (v === "block") + '">Block</button></div></div>'; }).join("") + "</section>" +
    '<section class="card"><h2 class="mb">Preferences</h2><div class="row between wrapm mb"><b>Theme</b>' + seg("theme", s.theme, [["dark", "Black"], ["light", "White"], ["system", "System"]]) + '</div><div class="row between wrapm mb"><b>Time format</b>' + seg("hour12", s.hour12 ? 1 : 0, [[0, "24-hour"], [1, "12-hour"]]) + '</div><div class="row between wrapm"><b>Celebration sound</b>' + seg("sound", s.sound ? 1 : 0, [[1, "On"], [0, "Off"]]) + "</div></section>" +
    '<section class="card"><h2 class="mb">Account</h2><div class="row mb">' + (USER.picture ? '<img class="avatar" src="' + esc(USER.picture) + '" alt="" referrerpolicy="no-referrer">' : '<span class="avatar ph">' + esc(USER.name.charAt(0).toUpperCase()) + "</span>") + '<div class="grow"><b>' + esc(USER.name) + '</b><br><span class="note">' + esc(USER.email) + '</span></div></div><div class="row wrapm"><button class="btn ghost" data-act="logout">' + ic("out") + 'Log out</button><button class="btn ghost" data-act="reset" id="resetBtn">Erase my plans and progress</button></div></section></div>';
}

/* ================= events ================= */
let resetArmed = false;
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const a = el.dataset.act, id = el.dataset.id, v = el.dataset.v;
  if (a === "closem" && el.classList.contains("scrim") && e.target !== el) return;
  switch (a) {
    case "amode": A.mode = v; if (v === "in" || v === "up") { A.cool = 0; } paintAuth(); break;
    case "eye": { const i = el.parentElement.querySelector("input"); const show = i.type === "password"; i.type = show ? "text" : "password"; el.innerHTML = ic(show ? "eyeoff" : "eye"); el.setAttribute("aria-label", show ? "Hide password" : "Show password"); break; }
    case "gretry": mountGoogle(); break;
    case "resend": {
      const p = A.purpose === "reset" ? startCodeFlow("/api/auth/reset/start", "reset") : startCodeFlow("/api/auth/signup/start", "signup", { name: A.name, password: A.pass });
      p.then((r) => { if (r && r.ok) setMsg("", "A new code was sent."); else if (r) setMsg(authMsg(r)); }); break;
    }
    case "nav": go(v); break;
    case "mprev": CAL.off--; renderView(true); break;
    case "mnext": CAL.off++; renderView(true); break;
    case "mtoday": CAL.off = 0; CAL.sel = ymd(new Date()); renderView(true); break;
    case "day": { CAL.sel = el.dataset.d; const d = parse(CAL.sel), n = new Date(); CAL.off = (d.getFullYear() - n.getFullYear()) * 12 + d.getMonth() - n.getMonth(); renderView(true); break; }
    case "tadd": TM = { cat: "study" }; openTaskModal(); break;
    case "cat": TM.cat = el.dataset.c; $$(".catpick button", $("#taskForm")).forEach((b) => b.setAttribute("aria-pressed", String(b === el))); break;
    case "closem": closeLayer(); break;
    case "tdone": { const t = S.tasks.find((x) => x.id === id); if (t && !t.done) completeTask(t, 0, 0); break; }
    case "tdel": S.tasks = S.tasks.filter((x) => x.id !== id); if (F.item && F.item.id === id && F.status !== "idle") resetF(); save(); renderView(true); break;
    case "focusitem": if (F.status === "idle") { F.key = el.dataset.key; F.dur = "item"; } go("focus"); break;
    case "rday": R.dow = +v; renderView(true); break;
    case "radd": openRoutineModal(null); break;
    case "redit": openRoutineModal(id); break;
    case "rcat": RM.cat = el.dataset.c; $$("#rCats button").forEach((b) => b.setAttribute("aria-pressed", String(b === el))); RM.warned = false; break;
    case "rdchip": { const n = +v, i = RM.days.indexOf(n); if (i >= 0) RM.days.splice(i, 1); else RM.days.push(n); el.setAttribute("aria-pressed", String(i < 0)); RM.warned = false; break; }
    case "rpreset": RM.days = v === "wk" ? [0, 1, 2, 3, 4] : v === "we" ? [5, 6] : [0, 1, 2, 3, 4, 5, 6]; $$("#rDays button").forEach((b) => b.setAttribute("aria-pressed", String(RM.days.indexOf(+b.dataset.v) >= 0))); RM.warned = false; break;
    case "rdel": S.routine = S.routine.filter((x) => x.id !== id); save(); closeLayer(); toast("Block deleted"); renderView(true); break;
    case "rtick": { const today = ymd(new Date()); if (id in logFor(today)) { untickRoutine(id); renderView(true); } else { tickRoutine(id, 0, 0, false); renderView(true); } break; }
    case "mscope": M.scope = v; M.cursor = new Date(); renderView(true); break;
    case "mprevp": M.cursor = shiftCursor(M.scope, M.cursor, -1); renderView(true); break;
    case "mnextp": M.cursor = shiftCursor(M.scope, M.cursor, 1); renderView(true); break;
    case "mnow": M.cursor = new Date(); renderView(true); break;
    case "newstar": M.star = !M.star; el.setAttribute("aria-pressed", String(M.star)); break;
    case "mdtick": { const m = S.mustdos.find((x) => x.id === id); if (!m) break; if (m.done) { uncompleteMust(m); renderView(true); } else { completeMust(m, 0, 0, false); renderView(true); } break; }
    case "mdstar": { const m = S.mustdos.find((x) => x.id === id); if (m) { m.pri = !m.pri; save(); renderView(true); } break; }
    case "mddel": S.mustdos = S.mustdos.filter((x) => x.id !== id); save(); renderView(true); break;
    case "mdmove": { const m = S.mustdos.find((x) => x.id === id); if (m) { m.period = keyFor(m.scope, new Date()); save(); renderView(true); toast("Moved to " + labelFor(m.scope, m.period).toLowerCase()); } break; }
    case "fstart": startF(); break;
    case "fpause": pauseF(); break;
    case "ffinish": if (elapsedNow() < 1) { toast("Start the timer first"); break; } finishSession(); break;
    case "fgive": if (!F.giveArmed) { F.giveArmed = true; paintControls(); setTimeout(() => { if (F.giveArmed) { F.giveArmed = false; paintControls(); } }, 3000); } else { resetF(); renderView(true); toast("Session ended. No penalty, try again soon."); } break;
    case "openapp": openApp(id); break;
    case "wdone": closeLayer(); renderView(true); break;
    case "wnext": closeLayer(); F.key = null; go("focus"); break;
    case "mode": S.settings.mode = v; save(); renderView(true); break;
    case "app": S.settings.apps[id] = v; save(); renderView(true); break;
    case "allall": APPS.forEach((x) => { S.settings.apps[x.id] = "allow"; }); save(); renderView(true); break;
    case "blockdist": APPS.forEach((x) => { if (x.d === "block") S.settings.apps[x.id] = "block"; }); save(); renderView(true); break;
    case "theme": S.settings.theme = v; save(); applyTheme(); renderView(true); break;
    case "sound": S.settings.sound = v === "1"; save(); renderView(true); if (S.settings.sound) chime(); break;
    case "hour12": S.settings.hour12 = v === "1"; save(); renderView(true); break;
    case "notif": if ("Notification" in window) Notification.requestPermission().then(() => renderView(true)); break;
    case "logout": resetF(); flush(); api("POST", "/api/logout").then(() => { S = null; USER = null; A.mode = "in"; A.email = ""; renderLogin(); }); break;
    case "reset": if (!resetArmed) { resetArmed = true; el.textContent = "Tap again to erase everything"; setTimeout(() => { resetArmed = false; if (el.isConnected) el.textContent = "Erase my plans and progress"; }, 3000); } else { resetArmed = false; resetF(); const keep = { theme: S.settings.theme, mode: S.settings.mode, apps: S.settings.apps, sound: S.settings.sound, hour12: S.settings.hour12 }; S = fresh(); Object.assign(S.settings, keep); save(); renderView(); toast("Plans and progress erased"); } break;
  }
});
document.addEventListener("submit", (e) => {
  const f = e.target;
  if (f.id === "taskForm") {
    e.preventDefault();
    const title = $("#tTitle").value.trim(), date = $("#tDate").value;
    if (!title) return ($("#tErr").textContent = "Give the task a name.");
    if (!date) return ($("#tErr").textContent = "Pick a date.");
    S.tasks.push({ id: uid(), title, date, time: $("#tTime").value, cat: TM.cat, mins: +$("#tMins").value, done: false, doneSec: 0 });
    CAL.sel = date; save(); closeLayer(); toast("Task added"); if (V === "calendar") renderView(true);
  } else if (f.id === "routineForm") { e.preventDefault(); saveRoutine(); }
  else if (f.id === "mdForm" || f.id === "mdQuick") {
    e.preventDefault();
    const inp = f.querySelector("input"), scope = f.dataset.scope, key = f.id === "mdQuick" ? ymd(new Date()) : keyFor(scope, M.cursor);
    if (!inp.value.trim()) { inp.focus(); return; }
    const pri = f.id === "mdForm" && M.star; addMust(inp.value, scope, key);
    if (pri) S.mustdos[S.mustdos.length - 1].pri = true;
    M.star = false; renderView(true); const n = $("#" + (f.id === "mdQuick" ? "mdQuickT" : "mdTitle")); if (n) n.focus();
  }
});
document.addEventListener("input", (e) => { if (RM && e.target.closest && e.target.closest("#routineForm")) { RM.warned = false; const b = $("#rSave"); if (b) b.textContent = "Save block"; } });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $(".scrim") && !$(".win") && !$(".warn")) closeLayer(); });

/* keep "now" markers and the date fresh */
let lastDay = ymd(new Date());
setInterval(() => {
  if (!S || !$("#viewbox")) return;
  const t = ymd(new Date()), typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (t !== lastDay) { lastDay = t; if (CAL.sel < t && CAL.off === 0) CAL.sel = t; R.dow = dowOf(new Date()); M.cursor = new Date(); }
  if ((V === "today" || V === "routine") && !typing && !$(".scrim")) renderView(true);
}, 30000);

/* ================= boot ================= */
$("#root").innerHTML = '<div class="splash">' + logoMark("lg") + "</div>";
applyTheme();
api("GET", "/api/me").then((r) => {
  if (r.ok) { USER = r.data.user; S = normalize(r.data.state); applyTheme(); renderApp(); } else renderLogin();
}).catch(() => renderLogin("You are offline. Connect to the internet to sign in."));
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) navigator.serviceWorker.register("/sw.js").catch(() => {});
})();

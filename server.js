'use strict';
/*
 * GrideX server. No npm packages required (Node 18+).
 *  - Google sign-in: verifies Google ID tokens against Google's published signing keys.
 *  - Email sign-in: Gmail address + password. Passwords are hashed with scrypt. A 6-digit
 *    code is emailed to the Gmail address before an account is created, so only the owner
 *    of a real mailbox can sign up. Without SMTP settings the code is printed in this window.
 *  - Keeps one JSON file per account in ./data/users.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const tls = require('tls');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

/* ---------- tiny .env loader ---------- */
try {
  const envFile = path.join(__dirname, '.env');
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  }
} catch (e) { /* ignore */ }

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const SMTP = {
  user: (process.env.SMTP_USER || '').trim(),
  pass: (process.env.SMTP_PASS || '').replace(/\s+/g, ''),
  host: (process.env.SMTP_HOST || 'smtp.gmail.com').trim(),
  port: Number(process.env.SMTP_PORT) || 465
};
const SMTP_READY = !!(SMTP.user && SMTP.pass);
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const PUBLIC = path.join(__dirname, 'public');
const DATA = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const USERS = path.join(DATA, 'users');
fs.mkdirSync(USERS, { recursive: true });

function loadSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) return process.env.SESSION_SECRET;
  const f = path.join(DATA, '.session-secret');
  try { return fs.readFileSync(f, 'utf8').trim(); } catch (e) { /* create */ }
  const s = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}
const SECRET = loadSecret();

/* ---------- Gmail address rules ---------- */
/** Returns the canonical Gmail address (dots and +tags removed) or null if not a valid Gmail address. */
function canon(email) {
  const m = /^([a-z0-9._+-]{1,64})@(gmail|googlemail)\.com$/.exec(String(email || '').trim().toLowerCase());
  if (!m) return null;
  const local = m[1].split('+')[0].replace(/\./g, '');
  if (!/^[a-z0-9]{6,30}$/.test(local)) return null;
  return local + '@gmail.com';
}
const emailKey = (email) => canon(email) || String(email || '').trim().toLowerCase();

/* ---------- user storage + index ---------- */
const ID_RE = /^[A-Za-z0-9]{5,40}$/;
const emailIdx = new Map();
const subIdx = new Map();
const userFile = (id) => path.join(USERS, id + '.json');
function indexUser(u) {
  if (u.email) emailIdx.set(emailKey(u.email), u.id);
  if (u.sub) subIdx.set(String(u.sub), u.id);
}
function readUser(id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) return null;
  try { const u = JSON.parse(fs.readFileSync(userFile(id), 'utf8')); u.id = id; return u; } catch (e) { return null; }
}
function writeUser(u) {
  const f = userFile(u.id), tmp = f + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(u));
  fs.renameSync(tmp, f);
  indexUser(u);
}
function loadIndex() {
  fs.readdirSync(USERS).forEach((f) => {
    if (!f.endsWith('.json')) return;
    const u = readUser(f.slice(0, -5));
    if (u) indexUser(u);
  });
}
loadIndex();
const publicUser = (u) => ({ name: u.name, email: u.email, picture: u.picture || '', hasPassword: !!u.pass });

const arr = (a) => (Array.isArray(a) && a.length <= 5000 ? a : null);
const obj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : null);
function validState(s) {
  if (!obj(s)) return null;
  const tasks = arr(s.tasks), settings = obj(s.settings), stats = obj(s.stats);
  if (!tasks || !settings || !stats) return null;
  const routine = s.routine === undefined ? [] : arr(s.routine);
  const mustdos = s.mustdos === undefined ? [] : arr(s.mustdos);
  const routineLog = s.routineLog === undefined ? {} : obj(s.routineLog);
  if (!routine || !mustdos || !routineLog) return null;
  return { tasks, routine, mustdos, routineLog, settings, stats };
}

/* ---------- Google ID token verification ---------- */
const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
let keyCache = { keys: new Map(), expires: 0 };
async function fetchGoogleKeys() {
  const res = await fetch(GOOGLE_CERTS);
  if (!res.ok) throw new Error('Could not load Google signing keys');
  const body = await res.json();
  const cc = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
  const keys = new Map();
  (body.keys || []).forEach((k) => { if (k.kid) keys.set(k.kid, k); });
  keyCache = { keys, expires: Date.now() + (cc ? Number(cc[1]) : 3600) * 1000 };
  return keys;
}
async function getKey(kid, getKeys) {
  if (getKeys) return (await getKeys()).get(kid);
  if (Date.now() > keyCache.expires || !keyCache.keys.has(kid)) await fetchGoogleKeys();
  return keyCache.keys.get(kid);
}
/** Returns the verified payload or throws. */
async function verifyGoogleToken(token, opts) {
  opts = opts || {};
  const clientId = opts.clientId || CLIENT_ID;
  if (typeof token !== 'string' || token.length > 4096) throw new Error('bad token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('bad token');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (header.alg !== 'RS256') throw new Error('bad alg');
  const jwk = await getKey(header.kid, opts.getKeys);
  if (!jwk) throw new Error('unknown key');
  const pub = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), pub, Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new Error('bad signature');
  const now = Math.floor((opts.now || Date.now()) / 1000);
  if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') throw new Error('bad issuer');
  if (!clientId || payload.aud !== clientId) throw new Error('bad audience');
  if (typeof payload.exp !== 'number' || payload.exp < now - 30) throw new Error('expired');
  if (typeof payload.iat === 'number' && payload.iat > now + 300) throw new Error('bad iat');
  if (payload.email_verified !== true && payload.email_verified !== 'true') throw new Error('email not verified');
  if (!/^\d{5,30}$/.test(String(payload.sub || ''))) throw new Error('bad subject');
  if (typeof payload.email !== 'string') throw new Error('no email');
  return payload;
}

/* ---------- passwords ---------- */
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(pw, salt, 64);
  return { salt: salt.toString('base64'), hash: hash.toString('base64') };
}
async function checkPassword(pw, rec) {
  const hash = await scrypt(pw, Buffer.from(rec.salt, 'base64'), 64);
  const want = Buffer.from(rec.hash, 'base64');
  return hash.length === want.length && crypto.timingSafeEqual(hash, want);
}
const DUMMY = { salt: crypto.randomBytes(16).toString('base64'), hash: crypto.randomBytes(64).toString('base64') };
const goodPassword = (p) => typeof p === 'string' && p.length >= 8 && p.length <= 128;

/* ---------- sessions (signed cookie) ---------- */
const COOKIES = ['gridex_session', 'focusly_session'];
const SESSION_DAYS = 30;
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
function makeSession(id) {
  const body = Buffer.from(JSON.stringify({ id, exp: Date.now() + SESSION_DAYS * 864e5 })).toString('base64url');
  return body + '.' + sign(body);
}
function readSession(req) {
  const jar = (req.headers.cookie || '').split(';').map((s) => s.trim());
  for (const name of COOKIES) {
    const raw = jar.find((s) => s.startsWith(name + '='));
    if (!raw) continue;
    const [body, sig] = raw.slice(name.length + 1).split('.');
    if (!body || !sig) continue;
    const good = sign(body);
    if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) continue;
    try {
      const s = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      const id = String(s.id || s.sub || '');
      if (s.exp && s.exp > Date.now() && ID_RE.test(id)) return id;
    } catch (e) { /* next */ }
  }
  return null;
}
const isHttps = (req) => !!req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
function setCookies(res, req, value, maxAgeSec) {
  const base = '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + maxAgeSec + (isHttps(req) ? '; Secure' : '');
  res.setHeader('Set-Cookie', [`gridex_session=${value}${base}`, 'focusly_session=' + base.replace(/Max-Age=\d+/, 'Max-Age=0')]);
}

/* ---------- limits ---------- */
const clientIp = (req) => (TRUST_PROXY && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress) || 'x';
const hits = new Map();
function limited(ip, max) {
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 600000);
  list.push(now); hits.set(ip, list); return list.length > (max || 40);
}
const fails = new Map(); // email key -> { n, first }
const LOCK_MAX = 8, LOCK_MS = 15 * 60 * 1000;
function lockedOut(key) {
  const f = fails.get(key);
  if (!f) return false;
  if (Date.now() - f.first > LOCK_MS) { fails.delete(key); return false; }
  return f.n >= LOCK_MAX;
}
function addFail(key) {
  const f = fails.get(key);
  if (!f || Date.now() - f.first > LOCK_MS) fails.set(key, { n: 1, first: Date.now() });
  else f.n++;
}
setInterval(() => { const now = Date.now(); hits.forEach((v, k) => { if (!v.some((t) => now - t < 600000)) hits.delete(k); }); }, 600000).unref();

/* ---------- email codes ---------- */
const CODE_TTL = 10 * 60 * 1000, CODE_COOLDOWN = Number(process.env.CODE_COOLDOWN_MS) || 45 * 1000, CODE_TRIES = 5;
const pending = new Map(); // purpose:key -> record
const sentLog = new Map(); // key -> [timestamps]
const codeHash = (key, code) => crypto.createHmac('sha256', SECRET).update(key + ':' + code).digest('hex');
setInterval(() => { const now = Date.now(); pending.forEach((v, k) => { if (v.exp < now) pending.delete(k); }); }, 60000).unref();

function b64lines(s) { return Buffer.from(s, 'utf8').toString('base64').replace(/.{1,76}/g, '$&\r\n'); }
/** Minimal SMTP-over-TLS client (port 465, AUTH LOGIN). */
function smtpSend(cfg, msg, tlsExtra) {
  return new Promise((resolve, reject) => {
    const sock = tls.connect(Object.assign({ host: cfg.host, port: cfg.port, servername: cfg.host }, tlsExtra || {}));
    sock.setEncoding('utf8');
    let buf = '', cur = [], done = false;
    const queue = [], waiters = [];
    const timer = setTimeout(() => fail(new Error('smtp timeout')), 20000);
    function fail(e) { if (done) return; done = true; clearTimeout(timer); try { sock.destroy(); } catch (x) { /* ignore */ } reject(e); }
    function ok() { if (done) return; done = true; clearTimeout(timer); try { sock.end(); } catch (x) { /* ignore */ } resolve(true); }
    sock.on('error', fail);
    sock.on('close', () => fail(new Error('smtp closed')));
    sock.on('data', (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2); cur.push(line);
        if (/^\d{3}( |$)/.test(line)) {
          const r = { code: Number(line.slice(0, 3)), text: cur.join('\n') }; cur = [];
          if (waiters.length) waiters.shift()(r); else queue.push(r);
        }
      }
    });
    const read = () => (queue.length ? Promise.resolve(queue.shift()) : new Promise((res) => waiters.push(res)));
    const cmd = async (line, expect) => {
      sock.write(line + '\r\n');
      const r = await read();
      if (!expect.includes(r.code)) throw new Error('smtp ' + r.code);
      return r;
    };
    (async () => {
      const hello = await read();
      if (hello.code !== 220) throw new Error('smtp greeting ' + hello.code);
      await cmd('EHLO gridex.local', [250]);
      await cmd('AUTH LOGIN', [334]);
      await cmd(Buffer.from(cfg.user).toString('base64'), [334]);
      await cmd(Buffer.from(cfg.pass).toString('base64'), [235]);
      await cmd('MAIL FROM:<' + cfg.user + '>', [250]);
      await cmd('RCPT TO:<' + msg.to + '>', [250, 251]);
      await cmd('DATA', [354]);
      const head = [
        'From: GrideX <' + cfg.user + '>', 'To: <' + msg.to + '>',
        'Subject: =?UTF-8?B?' + Buffer.from(msg.subject).toString('base64') + '?=',
        'Date: ' + new Date().toUTCString(), 'Message-ID: <' + crypto.randomBytes(12).toString('hex') + '@gridex.local>',
        'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', ''
      ].join('\r\n');
      sock.write(head + b64lines(msg.text) + '.\r\n');
      const r = await read();
      if (r.code !== 250) throw new Error('smtp data ' + r.code);
      await cmd('QUIT', [221]).catch(() => {});
      ok();
    })().catch(fail);
  });
}

/** Sends the code by email, or prints it here when SMTP is not set up. Returns 'email' or 'console'. */
async function deliverCode(to, code, purpose) {
  const what = purpose === 'reset' ? 'reset your password' : 'finish creating your account';
  if (!SMTP_READY) {
    const line = '  GrideX code for ' + to + ':  ' + code + '  (valid 10 minutes)  ';
    console.log('\n' + '='.repeat(line.length) + '\n' + line + '\n' + '='.repeat(line.length) + '\n');
    return 'console';
  }
  await smtpSend(SMTP, {
    to, subject: 'Your GrideX code: ' + code,
    text: 'Your GrideX code is ' + code + '.\n\nEnter it in the app to ' + what + '. It works for 10 minutes.\n\nIf you did not ask for this, ignore this email. Nobody can use your account without the code.\n'
  });
  return 'email';
}

async function startCode(purpose, key, to, extra) {
  const now = Date.now();
  const log = (sentLog.get(key) || []).filter((t) => now - t < 3600000);
  const last = log[log.length - 1];
  if (last && now - last < CODE_COOLDOWN) return { error: 'wait', retry: Math.ceil((CODE_COOLDOWN - (now - last)) / 1000) };
  if (log.length >= 6) return { error: 'too_many' };
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const delivery = await deliverCode(to, code, purpose);
  log.push(now); sentLog.set(key, log);
  pending.set(purpose + ':' + key, Object.assign({ hash: codeHash(key, code), exp: now + CODE_TTL, tries: 0 }, extra || {}));
  return { delivery };
}
function checkCode(purpose, key, code) {
  const id = purpose + ':' + key, rec = pending.get(id);
  if (!rec || rec.exp < Date.now()) { pending.delete(id); return { error: 'code_expired' }; }
  if (rec.tries >= CODE_TRIES) { pending.delete(id); return { error: 'too_many_codes' }; }
  const given = codeHash(key, String(code || '').replace(/\D/g, ''));
  if (given.length !== rec.hash.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(rec.hash))) {
    rec.tries++;
    return { error: 'wrong_code', left: Math.max(0, CODE_TRIES - rec.tries) };
  }
  pending.delete(id);
  return { rec };
}

/* ---------- http helpers ---------- */
const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}
function sameOrigin(req) {
  const h = req.headers['x-requested-with'];
  if (h !== 'gridex' && h !== 'focusly') return false;
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}
function startSession(res, req, user, extra) {
  setCookies(res, req, makeSession(user.id), SESSION_DAYS * 86400);
  return json(res, 200, Object.assign({ user: publicUser(user), state: user.state || null }, extra || {}));
}
const newId = () => 'e' + crypto.randomBytes(10).toString('hex');

/* ---------- API ---------- */
async function api(req, res, url) {
  const route = req.method + ' ' + url.pathname;
  if (route === 'GET /api/config') return json(res, 200, { clientId: CLIENT_ID || null, emailDelivery: SMTP_READY ? 'email' : 'console' });

  const isAuth = url.pathname.startsWith('/api/auth/');
  if (isAuth) {
    if (req.method !== 'POST') return json(res, 405, { error: 'method' });
    if (!sameOrigin(req)) return json(res, 403, { error: 'forbidden' });
    if (limited(clientIp(req), Number(process.env.AUTH_RATE_MAX) || 40)) return json(res, 429, { error: 'too_many' });
    let body; try { body = await readBody(req, 16384); } catch (e) { return json(res, 400, { error: 'bad_request' }); }
    return authRoute(req, res, url.pathname, body);
  }

  const sub = readSession(req);
  if (route === 'POST /api/logout') {
    if (!sameOrigin(req)) return json(res, 403, { error: 'forbidden' });
    setCookies(res, req, '', 0); return json(res, 200, { ok: true });
  }
  if (!sub) return json(res, 401, { error: 'signed_out' });
  const user = readUser(sub);
  if (!user) { setCookies(res, req, '', 0); return json(res, 401, { error: 'signed_out' }); }

  if (route === 'GET /api/me') return json(res, 200, { user: publicUser(user), state: user.state || null });
  if (route === 'PUT /api/state') {
    if (!sameOrigin(req)) return json(res, 403, { error: 'forbidden' });
    let body; try { body = await readBody(req, 1024 * 1024); } catch (e) { return json(res, 400, { error: 'bad_request' }); }
    const st = validState(body);
    if (!st) return json(res, 400, { error: 'invalid_state' });
    user.state = st; user.updatedAt = new Date().toISOString(); writeUser(user);
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: 'not_found' });
}

async function authRoute(req, res, pathname, body) {
  if (pathname === '/api/auth/google') {
    if (!CLIENT_ID) return json(res, 503, { error: 'not_configured' });
    let p;
    try { p = await verifyGoogleToken(body.credential); } catch (e) { return json(res, 401, { error: 'invalid_google_token' }); }
    const sub = String(p.sub);
    let user = subIdx.has(sub) ? readUser(subIdx.get(sub)) : null, created = false;
    if (!user) {
      const id = emailIdx.get(emailKey(p.email));
      user = id ? readUser(id) : null;
      if (user) user.sub = sub; // same verified email: link this Google account
    }
    if (!user) {
      if (body.intent === 'login') return json(res, 404, { error: 'no_account' });
      user = { id: sub, sub, email: String(p.email).toLowerCase(), name: p.name || p.email.split('@')[0], picture: p.picture || '', createdAt: new Date().toISOString(), state: null };
      created = true;
    } else {
      user.name = user.name || p.name || user.email.split('@')[0];
      user.picture = p.picture || user.picture;
    }
    writeUser(user);
    return startSession(res, req, user, { created });
  }

  if (pathname === '/api/auth/signup/start') {
    const key = canon(body.email), name = String(body.name || '').trim().slice(0, 60);
    if (!key) return json(res, 400, { error: 'bad_email' });
    if (!name) return json(res, 400, { error: 'bad_name' });
    if (!goodPassword(body.password)) return json(res, 400, { error: 'weak_password' });
    const existing = emailIdx.get(key) ? readUser(emailIdx.get(key)) : null;
    if (existing && existing.pass) return json(res, 409, { error: 'exists' });
    const pass = await hashPassword(body.password);
    let r;
    try { r = await startCode('signup', key, key, { name, pass }); } catch (e) { return json(res, 502, { error: 'email_failed' }); }
    if (r.error) return json(res, 429, { error: r.error, retry: r.retry });
    return json(res, 200, { ok: true, delivery: r.delivery, cooldown: CODE_COOLDOWN / 1000 });
  }

  if (pathname === '/api/auth/signup/verify') {
    const key = canon(body.email);
    if (!key) return json(res, 400, { error: 'bad_email' });
    const r = checkCode('signup', key, body.code);
    if (r.error) return json(res, r.error === 'wrong_code' ? 400 : 410, { error: r.error, left: r.left });
    let user = emailIdx.get(key) ? readUser(emailIdx.get(key)) : null, created = false;
    if (user) { user.pass = r.rec.pass; user.emailVerified = true; } // Google-only account gains a password
    else {
      user = { id: newId(), email: key, name: r.rec.name, picture: '', pass: r.rec.pass, emailVerified: true, createdAt: new Date().toISOString(), state: null };
      created = true;
    }
    writeUser(user); fails.delete(key);
    return startSession(res, req, user, { created });
  }

  if (pathname === '/api/auth/login') {
    const key = canon(body.email);
    if (!key || typeof body.password !== 'string' || body.password.length > 128) return json(res, 401, { error: 'bad_credentials' });
    if (lockedOut(key)) return json(res, 429, { error: 'locked' });
    const user = emailIdx.get(key) ? readUser(emailIdx.get(key)) : null;
    if (!user || !user.pass) {
      await checkPassword(body.password, DUMMY);
      addFail(key);
      return json(res, 401, { error: user ? 'use_google' : 'bad_credentials' });
    }
    if (!(await checkPassword(body.password, user.pass))) { addFail(key); return json(res, 401, { error: 'bad_credentials' }); }
    fails.delete(key);
    return startSession(res, req, user, { created: false });
  }

  if (pathname === '/api/auth/reset/start') {
    const key = canon(body.email);
    if (!key) return json(res, 400, { error: 'bad_email' });
    const user = emailIdx.get(key) ? readUser(emailIdx.get(key)) : null;
    if (!user) return json(res, 200, { ok: true, delivery: SMTP_READY ? 'email' : 'console', cooldown: CODE_COOLDOWN / 1000 });
    let r;
    try { r = await startCode('reset', key, key, {}); } catch (e) { return json(res, 502, { error: 'email_failed' }); }
    if (r.error) return json(res, 429, { error: r.error, retry: r.retry });
    return json(res, 200, { ok: true, delivery: r.delivery, cooldown: CODE_COOLDOWN / 1000 });
  }

  if (pathname === '/api/auth/reset/confirm') {
    const key = canon(body.email);
    if (!key) return json(res, 400, { error: 'bad_email' });
    if (!goodPassword(body.password)) return json(res, 400, { error: 'weak_password' });
    const r = checkCode('reset', key, body.code);
    if (r.error) return json(res, r.error === 'wrong_code' ? 400 : 410, { error: r.error, left: r.left });
    const user = emailIdx.get(key) ? readUser(emailIdx.get(key)) : null;
    if (!user) return json(res, 410, { error: 'code_expired' });
    user.pass = await hashPassword(body.password);
    writeUser(user); fails.delete(key);
    return startSession(res, req, user, { created: false });
  }
  return json(res, 404, { error: 'not_found' });
}

/* ---------- static files ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.ico': 'image/x-icon' };
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: https://*.googleusercontent.com",
  "connect-src 'self' https://accounts.google.com/gsi/",
  "frame-src https://accounts.google.com/gsi/",
  "manifest-src 'self'", "worker-src 'self'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'"
].join('; ');

function serveStatic(req, res, url) {
  let p;
  try { p = decodeURIComponent(url.pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cache-Control': ext === '.png' ? 'public, max-age=86400' : 'no-cache'
    });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  if (url.pathname.startsWith('/api/')) {
    api(req, res, url).catch(() => json(res, 500, { error: 'server_error' }));
  } else if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(req, res, url);
  } else { res.writeHead(405); res.end(); }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log('GrideX running at http://localhost:' + PORT);
    if (!CLIENT_ID) console.log('GOOGLE_CLIENT_ID is not set. Google sign-in is disabled until you add it (see README.md).');
    if (!SMTP_READY) console.log('Email sending is not set up. Sign-up and reset codes will be shown in this window.');
  });
}
module.exports = { server, verifyGoogleToken, makeSession, readSession, canon, smtpSend };

/* ============================================================
   FBI-NEXUS · SERVER — Express + PostgreSQL backend
   - sessions (signed HttpOnly cookie) verified against the
     account hashes stored in the shared state document
   - /api/state : shared state document with revision control
   - /api/files : evidence attachments (data URLs) in Postgres
   Falls back to local-only mode when the API is unreachable,
   so the static GitHub Pages build keeps working.
   ============================================================ */
'use strict';

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

try { process.loadEnvFile(path.join(__dirname, '.env')); } catch (e) { /* no .env */ }

const PORT = Number(process.env.PORT) || 3000;
/* Render قد يستخدم أسماء أخرى حسب طريقة الإنشاء — نقبل الشائعة منها */
const DATABASE_URL = process.env.DATABASE_URL
  || process.env.DATABASE_INTERNAL_URL
  || process.env.POSTGRES_URL
  || process.env.PG_URL
  || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_STATE_BYTES = 30 * 1024 * 1024;

if (!SESSION_SECRET) {
  console.warn('[FBI-NEXUS] SESSION_SECRET غير مضبوط — سيُولَّد مؤقتًا وستنتهي الجلسات عند إعادة التشغيل.');
}
const SECRET = SESSION_SECRET || crypto.randomBytes(32).toString('hex');

/* ---------------- database ---------------- */
const needsSsl = DATABASE_URL && !/localhost|127\.0\.0\.1/.test(DATABASE_URL);
const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, ssl: needsSsl ? { rejectUnauthorized: false } : false, max: 5 })
  : null;

let dbError = '';
let dbReady = false;
let lastInitTry = 0;

async function initDb() {
  if (!pool) {
    dbError = 'DATABASE_URL غير مضبوط';
    console.warn('[FBI-NEXUS] DATABASE_URL غير مضبوط — الواجهة ستعمل بالوضع المحلي فقط.');
    return false;
  }
  lastInitTry = Date.now();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id         integer PRIMARY KEY DEFAULT 1,
      rev        bigint NOT NULL DEFAULT 0,
      data       jsonb  NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT app_state_single_row CHECK (id = 1)
    );
    CREATE TABLE IF NOT EXISTS app_files (
      id   text PRIMARY KEY,
      name text NOT NULL DEFAULT '',
      type text NOT NULL DEFAULT '',
      size bigint NOT NULL DEFAULT 0,
      data text NOT NULL,
      at   bigint NOT NULL DEFAULT 0
    );
  `);
  dbError = '';
  dbReady = true;
  console.log('[FBI-NEXUS] PostgreSQL جاهز.');
  return true;
}

/* يفحص الجاهزية ويعيد المحاولة دوريًا، فقاعدة Render قد تستيقظ بعد الخدمة */
async function ensureDb() {
  if (!pool) return false;
  if (dbReady) return true;
  if (Date.now() - lastInitTry < 30000) return false;
  try {
    await initDb();
  } catch (e) {
    dbError = e.message || String(e);
    console.error('[FBI-NEXUS] تعذر الاتصال بقاعدة البيانات:', dbError);
    dbReady = false;
  }
  return dbReady;
}

/* ---------------- auth helpers ---------------- */
const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const passHash = (pass, salt) => sha256(`${salt}:${pass}:A140`);

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}
function issueToken(user) {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${Buffer.from(String(user), 'utf8').toString('base64url')}.${exp}`;
  return `${payload}.${sign(payload)}`;
}
function verifyToken(token) {
  if (!token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = sign(payload);
  if (parts[2].length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected))) return null;
  const exp = Number(parts[1]);
  if (!isFinite(exp) || exp < Date.now()) return null;
  try { return Buffer.from(parts[0], 'base64url').toString('utf8'); } catch (e) { return null; }
}
function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i < 0) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}
function sessionUser(req) {
  return verifyToken(parseCookies(req.headers.cookie).fib_session);
}
function setSessionCookie(req, res, token) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const bits = [
    `fib_session=${encodeURIComponent(token)}`,
    'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ];
  if (secure) bits.push('Secure');
  res.setHeader('Set-Cookie', bits.join('; '));
}
function requireSession(req, res, next) {
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error: 'unauthenticated' });
  req.user = user;
  next();
}

/* simple in-memory login throttle per address */
const attempts = new Map();
function tooManyAttempts(ip) {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > 10 * 60 * 1000) { attempts.delete(ip); return false; }
  return rec.count >= 20;
}
function noteAttempt(ip, ok) {
  if (ok) { attempts.delete(ip); return; }
  const rec = attempts.get(ip) || { first: Date.now(), count: 0 };
  rec.count += 1;
  attempts.set(ip, rec);
}

/* ---------------- state helpers ---------------- */
async function readState() {
  if (!pool) return null;
  const r = await pool.query('SELECT rev, data FROM app_state WHERE id = 1');
  return r.rows[0] || null;
}
async function writeState(baseRev, data) {
  const r = await pool.query(
    `UPDATE app_state SET data = $1::jsonb, rev = rev + 1, updated_at = now()
      WHERE id = 1 AND rev = $2 RETURNING rev`,
    [JSON.stringify(data), baseRev]
  );
  return r.rows[0] ? Number(r.rows[0].rev) : null;
}
const usersOf = (state) => (state && state.settings && state.settings.security && Array.isArray(state.settings.security.users))
  ? state.settings.security.users : [];

/* ---------------- app ---------------- */
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '32mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

/* --- API --- */
app.get('/api/health', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  let db = false;
  try {
    if (await ensureDb()) {
      db = (await pool.query('SELECT 1')).rowCount === 1;
      dbError = db ? '' : 'استعلام الفحص لم يرجع نتيجة';
    }
  } catch (e) {
    db = false;
    dbError = e.message || String(e);
  }
  res.json({
    ok: true,
    db,
    hasDatabaseUrl: !!pool,
    error: db ? '' : String(dbError || '').slice(0, 240),
    rev: db ? (await readState() || {}).rev || 0 : 0
  });
});

app.get('/api/accounts', async (req, res) => {
  try {
    const row = await readState();
    const users = usersOf(row && row.data).map(u => u.user);
    res.json({ accounts: users, seeded: !!row });
  } catch (e) {
    res.status(503).json({ error: 'db_unavailable' });
  }
});

app.post('/api/bootstrap', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'db_unavailable' });
  const data = req.body && req.body.data;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'invalid_state' });
  try {
    const existing = await readState();
    if (existing) return res.status(409).json({ error: 'already_seeded' });
    const r = await pool.query(
      `INSERT INTO app_state (id, rev, data) VALUES (1, 1, $1::jsonb)
       ON CONFLICT (id) DO NOTHING RETURNING rev`,
      [JSON.stringify(data)]
    );
    if (!r.rows[0]) return res.status(409).json({ error: 'already_seeded' });
    res.status(201).json({ ok: true, rev: Number(r.rows[0].rev) });
  } catch (e) {
    console.error('[bootstrap]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/login', async (req, res) => {
  const ip = req.ip || 'unknown';
  if (tooManyAttempts(ip)) return res.status(429).json({ error: 'too_many_attempts' });
  const user = String((req.body && req.body.user) || '').trim();
  const pass = String((req.body && req.body.pass) || '');
  if (!user || !pass) return res.status(400).json({ error: 'missing_credentials' });
  if (!pool) return res.status(503).json({ error: 'db_unavailable' });

  try {
    const row = await readState();
    if (!row) return res.status(409).json({ error: 'not_seeded' });
    const state = row.data;
    const list = usersOf(state);
    const u = list.find(x => x.user === user);
    if (!u) { noteAttempt(ip, false); return res.status(401).json({ error: 'invalid_credentials' }); }
    if (u.lockUntil && Date.now() < Number(u.lockUntil)) {
      return res.status(423).json({ error: 'locked' });
    }
    if (passHash(pass, u.salt) !== u.hash) {
      noteAttempt(ip, false);
      u.failed = (Number(u.failed) || 0) + 1;
      if (u.failed >= 5) { u.lockUntil = Date.now() + 60000; u.failed = 0; }
      await writeState(Number(row.rev), state);
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    noteAttempt(ip, true);
    u.failed = 0; u.lockUntil = 0; u.lastLogin = Date.now();
    await writeState(Number(row.rev), state);
    setSessionCookie(req, res, issueToken(user));
    res.json({ ok: true, user });
  } catch (e) {
    console.error('[login]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'fib_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  const user = sessionUser(req);
  res.json({ user: user || null });
});

app.get('/api/state', requireSession, async (req, res) => {
  try {
    const row = await readState();
    if (!row) return res.status(409).json({ error: 'not_seeded' });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ rev: Number(row.rev), data: row.data });
  } catch (e) {
    console.error('[state:get]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.put('/api/state', requireSession, async (req, res) => {
  const body = req.body || {};
  const baseRev = Number(body.baseRev);
  const data = body.data;
  if (!isFinite(baseRev) || !data || typeof data !== 'object') {
    return res.status(400).json({ error: 'invalid_payload' });
  }
  try {
    if (JSON.stringify(data).length > MAX_STATE_BYTES) {
      return res.status(413).json({ error: 'state_too_large' });
    }
    const rev = await writeState(baseRev, data);
    if (rev === null) {
      const row = await readState();
      return res.status(409).json({ error: 'conflict', rev: row ? Number(row.rev) : null, data: row ? row.data : null });
    }
    res.json({ ok: true, rev });
  } catch (e) {
    console.error('[state:put]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/files', requireSession, async (req, res) => {
  try {
    const r = await pool.query('SELECT id, name, type, size, data, at FROM app_files ORDER BY at ASC');
    res.setHeader('Cache-Control', 'no-store');
    res.json({ files: r.rows.map(f => ({ ...f, size: Number(f.size), at: Number(f.at) })) });
  } catch (e) {
    console.error('[files:list]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.put('/api/files', requireSession, async (req, res) => {
  const f = req.body || {};
  if (!f.id || !f.data) return res.status(400).json({ error: 'invalid_file' });
  try {
    await pool.query(
      `INSERT INTO app_files (id, name, type, size, data, at) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type,
         size = EXCLUDED.size, data = EXCLUDED.data`,
      [String(f.id), String(f.name || 'file'), String(f.type || ''), Number(f.size) || 0, String(f.data), Number(f.at) || Date.now()]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[files:put]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.delete('/api/files/:id', requireSession, async (req, res) => {
  try {
    await pool.query('DELETE FROM app_files WHERE id = $1', [String(req.params.id)]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
});

app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

/* --- static app --- */
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'), (err) => {
    if (err) res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
  });
});

/* ---------------- start ---------------- */
initDb()
  .catch((e) => {
    dbError = e.message || String(e);
    dbReady = false;
    console.error('[FBI-NEXUS] فشل الاتصال بقاعدة البيانات:', dbError);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`[FBI-NEXUS] running on port ${PORT} — mode: ${pool ? 'postgres' : 'local'}`);
    });
  });

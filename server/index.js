// Hamster Rush backend — wallet sign-in (EIP-4361 style), run submission, leaderboard + dashboard data.
// Zero extra deps beyond viem (already used by the game). Storage: data/db.json (atomic writes).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { verifyMessage, isAddress, getAddress } from 'viem';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DIST = process.env.DIST_DIR || path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const CHAIN_ID = 11155111;
const NONCE_TTL = 5 * 60 * 1000;
const TOKEN_TTL = 7 * 24 * 3600 * 1000;
const RUN_SECONDS = 300 + 35; // a run is 5 minutes + boss overtime slack
fs.mkdirSync(DATA_DIR, { recursive: true });

// ---- secret ------------------------------------------------------------------------------------
const SECRET_FILE = path.join(DATA_DIR, 'secret.key');
let SECRET = process.env.HR_SECRET;
if (!SECRET) {
  try { SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim(); } catch { /* first run */ }
  if (!SECRET) { SECRET = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(SECRET_FILE, SECRET, { mode: 0o600 }); }
}
const b64u = (b) => Buffer.from(b).toString('base64url');
const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
function makeToken(address) { const p = b64u(JSON.stringify({ a: address.toLowerCase(), exp: Date.now() + TOKEN_TTL, j: crypto.randomBytes(4).toString('hex') })); return `${p}.${sign(p)}`; }
function readToken(tok) {
  if (typeof tok !== 'string') return null;
  const [p, sg] = tok.split('.');
  if (!p || !sg) return null;
  const want = sign(p);
  if (sg.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sg), Buffer.from(want))) return null;
  try { const o = JSON.parse(Buffer.from(p, 'base64url').toString()); return o.exp > Date.now() ? o : null; } catch { return null; }
}

// ---- db ----------------------------------------------------------------------------------------
const DB_FILE = path.join(DATA_DIR, 'db.json');
let db = { players: {}, runs: [], logins: [] };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; } catch { /* fresh */ }
let dirty = false, writing = false;
function flush() {
  if (!dirty || writing) return;
  dirty = false; writing = true;
  const tmp = DB_FILE + '.tmp';
  fs.writeFile(tmp, JSON.stringify(db), (e) => { if (!e) fs.rename(tmp, DB_FILE, () => { writing = false; if (dirty) flush(); }); else writing = false; });
}
const save = () => { dirty = true; setTimeout(flush, 150); };
function flushSync() { try { fs.writeFileSync(DB_FILE, JSON.stringify(db)); } catch { /* ignore */ } }
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flushSync(); process.exit(0); });

const nonces = new Map(); // address(lower) -> {nonce, message, exp}
setInterval(() => { const t = Date.now(); for (const [k, v] of nonces) if (v.exp < t) nonces.delete(k); }, 60000).unref();

// ---- helpers -----------------------------------------------------------------------------------
const short = (a) => a.slice(0, 6) + '…' + a.slice(-4);
const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.floor(n))) : NaN; };
export function computeScore(r) { return r.kills * 10 + r.level * 100 + Math.floor(r.time) * 5 + r.bosses * 1500 + r.elites * 50 + (r.win ? 2000 : 0); }
const hits = new Map();
function limited(ip, key, max, winMs) {
  const k = key + ip, t = Date.now(); const a = (hits.get(k) || []).filter((x) => t - x < winMs);
  a.push(t); hits.set(k, a); return a.length > max;
}
setInterval(() => { const t = Date.now(); for (const [k, a] of hits) if (!a.some((x) => t - x < 120000)) hits.delete(k); }, 60000).unref();

function publicPlayer(p) {
  return { address: p.address, short: short(p.address), firstSeen: p.firstSeen, lastSeen: p.lastSeen, logins: p.logins, runs: p.runs, wins: p.wins, best: p.best, bestTime: p.bestTime, totalKills: p.totalKills, bosses: p.bosses, bestLevel: p.bestLevel };
}
function leaderboard(limit = 50) {
  return Object.values(db.players).filter((p) => p.runs > 0).sort((a, b) => b.best - a.best || a.firstSeen - b.firstSeen).slice(0, limit).map((p, i) => ({ rank: i + 1, ...publicPlayer(p) }));
}
function stats() {
  const ps = Object.values(db.players), day = Date.now() - 86400000;
  return {
    players: ps.length, runs: ps.reduce((s, p) => s + p.runs, 0), wins: ps.reduce((s, p) => s + p.wins, 0),
    kills: ps.reduce((s, p) => s + p.totalKills, 0), bosses: ps.reduce((s, p) => s + p.bosses, 0),
    active24h: ps.filter((p) => p.lastSeen > day).length, logins24h: db.logins.filter((l) => l.t > day).length,
    topScore: ps.reduce((m, p) => Math.max(m, p.best), 0), serverTime: Date.now(),
  };
}

// ---- routes ------------------------------------------------------------------------------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.map': 'application/json', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '600' };
function send(res, code, obj) { const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS }); res.end(b); }
const bad = (res, msg, code = 400) => send(res, code, { ok: false, error: msg });
function body(req) {
  return new Promise((resolve, reject) => {
    let n = 0; const ch = [];
    req.on('data', (c) => { n += c.length; if (n > 32 * 1024) { reject(new Error('too large')); req.destroy(); } else ch.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(ch).toString() || '{}')); } catch { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}
function buildMessage(addr, nonce, origin, host) {
  return `${host} wants you to sign in with your Ethereum account:\n${addr}\n\nSign in to Hamster Rush. This only proves you own this wallet — no transaction, no gas, no token approval.\n\nURI: ${origin}\nVersion: 1\nChain ID: ${CHAIN_ID}\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;
}
function player(addr) {
  const k = addr.toLowerCase();
  return (db.players[k] ||= { address: getAddress(addr), firstSeen: Date.now(), lastSeen: Date.now(), logins: 0, runs: 0, wins: 0, best: 0, bestTime: 0, bestLevel: 0, totalKills: 0, bosses: 0, lastRunAt: 0 });
}

async function api(req, res, url, ip) {
  const p = url.pathname, m = req.method;
  if (m === 'GET' && p === '/api/health') return send(res, 200, { ok: true, name: 'hamster-rush', chainId: CHAIN_ID, time: Date.now() });
  if (m === 'GET' && p === '/api/leaderboard') return send(res, 200, { ok: true, rows: leaderboard(num(url.searchParams.get('limit') || 50, 1, 100)) });
  if (m === 'GET' && p === '/api/stats') return send(res, 200, { ok: true, ...stats() });
  if (m === 'GET' && p === '/api/logins') {
    const n = num(url.searchParams.get('limit') || 30, 1, 100);
    return send(res, 200, { ok: true, rows: db.logins.slice(-n).reverse().map((l) => ({ address: l.address, short: short(l.address), t: l.t, n: db.players[l.address.toLowerCase()]?.logins || 1 })) });
  }
  if (m === 'GET' && p === '/api/runs') {
    const n = num(url.searchParams.get('limit') || 20, 1, 100);
    return send(res, 200, { ok: true, rows: db.runs.filter((r) => !r.flag).slice(-n).reverse().map((r) => ({ address: r.address, short: short(r.address), t: r.t, score: r.score, time: r.time, kills: r.kills, level: r.level, bosses: r.bosses, win: r.win })) });
  }
  const pm = p.match(/^\/api\/player\/(0x[0-9a-fA-F]{40})$/);
  if (m === 'GET' && pm) {
    const pl = db.players[pm[1].toLowerCase()];
    if (!pl) return bad(res, 'unknown player', 404);
    const rank = leaderboard(10000).find((r) => r.address.toLowerCase() === pm[1].toLowerCase())?.rank || null;
    return send(res, 200, { ok: true, player: publicPlayer(pl), rank, recent: db.runs.filter((r) => r.address.toLowerCase() === pm[1].toLowerCase() && !r.flag).slice(-10).reverse() });
  }
  if (m === 'GET' && p === '/api/nonce') {
    if (limited(ip, 'nonce', 30, 60000)) return bad(res, 'rate limited', 429);
    const a = url.searchParams.get('address') || '';
    if (!isAddress(a)) return bad(res, 'invalid address');
    const nonce = crypto.randomBytes(12).toString('hex');
    const host = req.headers.host || `localhost:${PORT}`;
    const origin = (req.headers.origin && /^https?:\/\//.test(req.headers.origin)) ? req.headers.origin : `http://${host}`;
    const message = buildMessage(getAddress(a), nonce, origin, host);
    nonces.set(a.toLowerCase(), { nonce, message, exp: Date.now() + NONCE_TTL });
    return send(res, 200, { ok: true, message, nonce });
  }
  if (m === 'POST' && p === '/api/session') {
    if (limited(ip, 'sess', 20, 60000)) return bad(res, 'rate limited', 429);
    const b = await body(req);
    if (!isAddress(b.address) || typeof b.message !== 'string' || typeof b.signature !== 'string') return bad(res, 'address, message and signature required');
    const rec = nonces.get(b.address.toLowerCase());
    if (!rec || rec.exp < Date.now()) return bad(res, 'nonce expired — request a new one', 401);
    if (rec.message !== b.message) return bad(res, 'message does not match the issued challenge', 401);
    let ok = false;
    try { ok = await verifyMessage({ address: b.address, message: b.message, signature: b.signature }); } catch { ok = false; }
    if (!ok) return bad(res, 'signature does not match this address', 401);
    nonces.delete(b.address.toLowerCase()); // single use → no replay
    const pl = player(b.address); pl.logins++; pl.lastSeen = Date.now();
    db.logins.push({ address: pl.address, t: Date.now() }); if (db.logins.length > 500) db.logins.splice(0, db.logins.length - 500);
    save();
    return send(res, 200, { ok: true, token: makeToken(pl.address), address: pl.address, expiresIn: TOKEN_TTL / 1000, player: publicPlayer(pl) });
  }
  if (m === 'POST' && p === '/api/run') {
    if (limited(ip, 'run', 30, 60000)) return bad(res, 'rate limited', 429);
    const auth = (req.headers.authorization || '').replace(/^Bearer /, '');
    const tk = readToken(auth);
    if (!tk) return bad(res, 'sign in with your wallet first', 401);
    const b = await body(req);
    const r = { win: !!b.win, time: num(b.time, 0, RUN_SECONDS), kills: num(b.kills, 0, 1e6), level: num(b.level, 1, 200), bosses: num(b.bosses ?? 0, 0, 3), elites: num(b.elites ?? 0, 0, 1e4), maxCombo: num(b.maxCombo ?? 0, 0, 1e5) };
    if ([r.time, r.kills, r.level, r.bosses, r.elites, r.maxCombo].some(Number.isNaN)) return bad(res, 'invalid run');
    const pl = db.players[tk.a]; if (!pl) return bad(res, 'unknown player', 401);
    // plausibility: kills/sec cap, level vs kills, boss count vs time, wall clock vs claimed run length
    const flags = [];
    if (r.kills > r.time * 45 + 40) flags.push('kills/s');
    if (r.level > 6 + r.kills * 0.6 + 8) flags.push('level');
    if (r.bosses >= 1 && r.time < 90) flags.push('boss-early'); if (r.bosses >= 2 && r.time < 190) flags.push('boss2-early'); if (r.bosses >= 3 && r.time < 270) flags.push('boss3-early');
    if (r.elites > r.kills) flags.push('elites');
    if (r.win && r.time < 290) flags.push('win-early');
    const since = (Date.now() - (pl.lastRunAt || pl.lastSeen)) / 1000;
    if (r.time > 20 && since < r.time / 4 - 8) flags.push('too-fast');
    const score = computeScore(r), ts = Date.now();
    const rec = { address: pl.address, t: ts, ...r, score, clientScore: num(b.score ?? 0, 0, 1e9) || 0, flag: flags.join(',') || undefined };
    db.runs.push(rec); if (db.runs.length > 5000) db.runs.splice(0, db.runs.length - 5000);
    pl.lastRunAt = ts; pl.lastSeen = ts;
    if (!rec.flag) {
      pl.runs++; if (r.win) pl.wins++; pl.totalKills += r.kills; pl.bosses += r.bosses;
      pl.best = Math.max(pl.best, score); pl.bestTime = Math.max(pl.bestTime, r.time); pl.bestLevel = Math.max(pl.bestLevel, r.level);
    }
    save();
    const rank = rec.flag ? null : leaderboard(10000).find((x) => x.address === pl.address)?.rank || null;
    return send(res, 200, { ok: true, accepted: !rec.flag, flag: rec.flag, score, rank, best: pl.best });
  }
  return bad(res, 'not found', 404);
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  let file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end('forbidden'); }
  let st; try { st = fs.statSync(file); if (st.isDirectory()) { file = path.join(file, 'index.html'); st = fs.statSync(file); } } catch { st = null; }
  if (!st) { // SPA fallback only for page-like paths
    if (path.extname(rel)) { res.writeHead(404); return res.end('not found'); }
    file = path.join(DIST, 'index.html'); try { st = fs.statSync(file); } catch { res.writeHead(503, { 'Content-Type': 'text/plain' }); return res.end('No build found. Run `npm run build` (or `npm start`).'); }
  }
  const ext = path.extname(file).toLowerCase();
  const hashed = /\/assets\//.test(file);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
    try {
      const url = new URL(req.url, 'http://x');
      if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
      if (url.pathname.startsWith('/api/')) return await api(req, res, url, ip);
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
      return serveStatic(req, res, url);
    } catch (e) {
      if (!res.headersSent) bad(res, e.message === 'too large' ? 'payload too large' : e.message === 'bad json' ? 'bad json' : 'server error', e.message === 'too large' ? 413 : e.message === 'bad json' ? 400 : 500);
      else res.end();
      if (!['too large', 'bad json'].includes(e.message)) console.error('[server]', e);
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, HOST, () => {
    console.log(`🐹 Hamster Rush server on http://localhost:${PORT}  (data: ${DATA_DIR}, dist: ${fs.existsSync(DIST) ? 'ok' : 'MISSING'})`);
  });
}

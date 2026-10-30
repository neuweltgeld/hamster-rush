// Backend test: spins up the server on a temp port + temp data dir and exercises sign-in, replay, forgery, runs, leaderboard.
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
const port = 8800 + Math.floor(Math.random() * 90), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hrdb-'));
const srv = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(port), DATA_DIR: dir, HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => srv.stdout.once('data', r));
const B = `http://127.0.0.1:${port}`; let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const j = async (u, o) => { const r = await fetch(B + u, o); return { s: r.status, ...(await r.json()) }; };
const post = (u, b, tok) => j(u, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(b) });
async function login(acc, tamper) {
  const n = await j('/api/nonce?address=' + acc.address);
  const message = tamper ? n.message.replace('Hamster Rush', 'Evil App') : n.message;
  const signature = await acc.signMessage({ message });
  return { n, res: await post('/api/session', { address: acc.address, message, signature }) };
}
try {
  ok((await j('/api/health')).ok, 'health');
  ok((await j('/api/nonce?address=nope')).s === 400, 'nonce rejects bad address');
  const A = privateKeyToAccount(generatePrivateKey()), Bk = privateKeyToAccount(generatePrivateKey());
  const l1 = await login(A);
  ok(l1.res.ok && l1.res.token, 'valid signature → session token');
  ok(l1.n.message.includes('Chain ID: 11155111') && l1.n.message.includes('Nonce:'), 'message is EIP-4361 style');
  // replay
  const sig = await A.signMessage({ message: l1.n.message });
  ok((await post('/api/session', { address: A.address, message: l1.n.message, signature: sig })).s === 401, 'nonce replay rejected');
  ok((await login(A, true)).res.s === 401, 'tampered message rejected');
  // signed by wrong key
  const n2 = await j('/api/nonce?address=' + A.address); const wrong = await Bk.signMessage({ message: n2.message });
  ok((await post('/api/session', { address: A.address, message: n2.message, signature: wrong })).s === 401, 'signature from another wallet rejected');
  ok((await post('/api/run', { time: 100, kills: 50, level: 3 })).s === 401, 'run without token rejected');
  ok((await post('/api/run', { time: 100, kills: 50, level: 3 }, l1.res.token + 'x')).s === 401, 'forged token rejected');
  const t = l1.res.token;
  let r = await post('/api/run', { win: false, time: 120, kills: 200, level: 8, bosses: 0, elites: 3, maxCombo: 30 }, t);
  ok(r.ok && r.flag === 'too-fast', 'run right after login with 120s claimed is flagged too-fast (' + r.flag + ')');
  r = await post('/api/run', { win: false, time: 12, kills: 20, level: 2, bosses: 0, elites: 0, maxCombo: 5, score: 999999 }, t);
  ok(r.ok && r.accepted && r.score === 20 * 10 + 200 + 60, 'short plausible run accepted; score recomputed server-side (' + r.score + ')');
  r = await post('/api/run', { time: 20, kills: 99999, level: 90, bosses: 3 }, t);
  ok(r.ok && !r.accepted, 'impossible run flagged: ' + r.flag);
  const l2 = await login(Bk); await post('/api/run', { time: 10, kills: 5, level: 3 }, l2.res.token);
  const lb = await j('/api/leaderboard');
  ok(lb.rows.length === 2 && lb.rows[0].address === A.address && lb.rows[0].rank === 1, 'leaderboard ranks by best score');
  const lg = await j('/api/logins'); ok(lg.rows.length === 2 && lg.rows[0].address === Bk.address, 'logins list newest first (' + lg.rows.length + ')');
  const st = await j('/api/stats'); ok(st.players === 2 && st.runs === 2, 'stats players/runs ' + st.players + '/' + st.runs);
  const pp = await j('/api/player/' + A.address); ok(pp.ok && pp.rank === 1 && pp.player.logins === 1, 'player endpoint (logins ' + pp.player?.logins + ')');
  ok((await post('/api/run', { time: 'x', kills: 1, level: 1 }, t)).s === 400, 'garbage run rejected');
  const big = await fetch(B + '/api/run', { method: 'POST', headers: { authorization: 'Bearer ' + t }, body: 'x'.repeat(100000) }).then((r) => r.status).catch(() => 'closed');
  ok(big === 413 || big === 'closed', 'oversized body refused (' + big + ')');
  await new Promise((r) => setTimeout(r, 400));
  ok(JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8')).logins.length === 2, 'db persisted to disk');
} catch (e) { console.error(e); fail++; }
srv.kill(); console.log(fail ? `${fail} FAILED` : 'ALL PASS'); process.exit(fail ? 1 : 0);

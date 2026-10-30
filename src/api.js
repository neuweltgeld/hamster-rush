// Client for the Hamster Rush backend: wallet sign-in (EIP-4361 style personal_sign), run submission, dashboard data.
import { toHex } from 'viem';
import { getProvider } from './chain.js';

const params = new URLSearchParams(location.search);
let basePromise = null;
export const auth = { token: null, address: null };

async function probe(base) {
  try { const r = await fetch(base + '/api/health', { cache: 'no-store', signal: AbortSignal.timeout(2500) }); const j = await r.json(); return j?.name === 'hamster-rush'; } catch { return false; }
}
/** Same-origin /api first (npm start / dev proxy), then localhost:8787 next to wherever the page is served. */
export function apiBase() {
  if (!basePromise) basePromise = (async () => {
    const forced = params.get('api');
    const cands = forced ? [forced.replace(/\/$/, '')] : ['', `${location.protocol === 'https:' ? 'https:' : 'http:'}//${location.hostname || 'localhost'}:8787`, 'http://localhost:8787'];
    for (const c of cands) if (await probe(c)) return c;
    return null;
  })();
  return basePromise;
}
export const retryProbe = () => { basePromise = null; return apiBase(); };

async function call(path, opts = {}) {
  const base = await apiBase();
  if (base === null) throw new Error('OFFLINE');
  const r = await fetch(base + path, { ...opts, headers: { 'content-type': 'application/json', ...(opts.headers || {}), ...(auth.token ? { authorization: 'Bearer ' + auth.token } : {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) { const e = new Error(j.error || 'HTTP ' + r.status); e.status = r.status; throw e; }
  return j;
}
export const get = (p) => call(p);

const KEY = (a) => 'hr.auth.' + a.toLowerCase();
function tokenValid(t) { try { const o = JSON.parse(atob(t.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))); return o.exp > Date.now() + 60000; } catch { return false; } }
/** Reuse a stored session without any popup. */
export function restore(address) {
  auth.token = null; auth.address = null;
  if (!address) return false;
  try { const t = localStorage.getItem(KEY(address)); if (t && tokenValid(t)) { auth.token = t; auth.address = address; return true; } } catch { /* ignore */ }
  return false;
}
export function signOut(address) { try { if (address) localStorage.removeItem(KEY(address)); } catch { /* ignore */ } auth.token = null; auth.address = null; }

/** Ask the wallet to sign the server challenge (free, no gas) and exchange it for a session token. */
export async function signIn(address) {
  const prov = getProvider();
  if (!prov) throw new Error('No wallet found');
  const { message } = await call('/api/nonce?address=' + address);
  const signature = await prov.request({ method: 'personal_sign', params: [toHex(message), address] });
  const s = await call('/api/session', { method: 'POST', body: JSON.stringify({ address, message, signature }) });
  auth.token = s.token; auth.address = s.address;
  try { localStorage.setItem(KEY(address), s.token); } catch { /* ignore */ }
  return s;
}

export async function submitRun(sum) {
  if (!auth.token) return null;
  const body = { win: sum.win, time: sum.time, kills: sum.kills, level: sum.level, bosses: sum.bosses || 0, elites: sum.elites || 0, maxCombo: sum.maxCombo || 0, score: sum.score || 0 };
  return call('/api/run', { method: 'POST', body: JSON.stringify(body) });
}

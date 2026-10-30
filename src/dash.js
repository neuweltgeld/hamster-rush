// Dashboard overlay: global stats, leaderboard, wallet logins and recent runs from the backend.
import { get, retryProbe, auth } from './api.js';
import { on } from './bus.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n).toLocaleString('en-US');
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function ago(t) { const s = Math.max(0, (Date.now() - t) / 1000); if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago'; return Math.floor(s / 86400) + ' d ago'; }
let el, tab = 'lb', timer = null, open = false;
const me = () => (auth.address || '').toLowerCase();
const who = (r) => `<span class="addr-s ${r.address.toLowerCase() === me() ? 'me' : ''}" title="${esc(r.address)}">${esc(r.short)}${r.address.toLowerCase() === me() ? ' <i>you</i>' : ''}</span>`;

function build() {
  el = document.createElement('div'); el.id = 'dash'; el.className = 'screen hidden';
  el.innerHTML = `<div class="dash-wrap"><div class="dash-head"><h2>📊 DASHBOARD</h2><span class="live"><i></i>live</span><button class="mini" id="dash-x">close (Esc)</button></div>
    <div id="dash-tiles" class="tiles"></div>
    <div class="tabs"><button data-t="lb" class="on">🏆 Leaderboard</button><button data-t="lg">👛 Wallet logins</button><button data-t="rn">⚔ Recent runs</button></div>
    <div id="dash-body" class="dash-body"></div><p class="hint">Scores are recomputed on the server from the run summary. Sign in with your wallet (free signature, no gas) to appear here.</p></div>`;
  document.getElementById('ui').appendChild(el);
  el.querySelector('#dash-x').onclick = close;
  el.querySelectorAll('.tabs button').forEach((b) => { b.onclick = () => { tab = b.dataset.t; el.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); refresh(); }; });
  addEventListener('keydown', (e) => { if (open && e.key === 'Escape') { close(); e.stopPropagation(); } }, true);
}
async function refresh() {
  if (!open) return;
  const tiles = el.querySelector('#dash-tiles'), body = el.querySelector('#dash-body');
  try {
    const [st, data] = await Promise.all([get('/api/stats'), tab === 'lb' ? get('/api/leaderboard?limit=50') : tab === 'lg' ? get('/api/logins?limit=40') : get('/api/runs?limit=30')]);
    tiles.innerHTML = [['Players', st.players], ['Runs', st.runs], ['Wins', st.wins], ['Kills', st.kills], ['Bosses slain', st.bosses], ['Active 24h', st.active24h], ['Top score', st.topScore]].map(([k, v]) => `<div class="tile"><b>${fmt(v)}</b><span>${k}</span></div>`).join('');
    let h;
    if (!data.rows.length) h = `<div class="empty">No entries yet — connect a wallet, sign in and finish a run to claim the first spot.</div>`;
    else if (tab === 'lb') h = `<table><tr><th>#</th><th>Wallet</th><th>Best score</th><th>Runs</th><th>Wins</th><th>Kills</th><th>Best time</th><th>Last seen</th></tr>${data.rows.map((r) => `<tr class="${r.address.toLowerCase() === me() ? 'me' : ''}"><td class="rk r${Math.min(r.rank, 4)}">${r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</td><td>${who(r)}</td><td class="sc">${fmt(r.best)}</td><td>${r.runs}</td><td>${r.wins}</td><td>${fmt(r.totalKills)}</td><td>${mmss(r.bestTime)}</td><td class="mut">${ago(r.lastSeen)}</td></tr>`).join('')}</table>`;
    else if (tab === 'lg') h = `<table><tr><th>Wallet</th><th>Signed in</th><th>Sessions</th></tr>${data.rows.map((r) => `<tr class="${r.address.toLowerCase() === me() ? 'me' : ''}"><td>${who(r)} <span class="mut full">${esc(r.address)}</span></td><td class="mut">${ago(r.t)}</td><td>${r.n}</td></tr>`).join('')}</table>`;
    else h = `<table><tr><th>Wallet</th><th>Score</th><th>Time</th><th>Kills</th><th>Lv</th><th>Bosses</th><th></th><th>When</th></tr>${data.rows.map((r) => `<tr class="${r.address.toLowerCase() === me() ? 'me' : ''}"><td>${who(r)}</td><td class="sc">${fmt(r.score)}</td><td>${mmss(r.time)}</td><td>${fmt(r.kills)}</td><td>${r.level}</td><td>${r.bosses}</td><td>${r.win ? '<span class="ok">WIN</span>' : '<span class="mut">dead</span>'}</td><td class="mut">${ago(r.t)}</td></tr>`).join('')}</table>`;
    body.innerHTML = h;
  } catch (e) {
    tiles.innerHTML = '';
    body.innerHTML = e.message === 'OFFLINE'
      ? `<div class="empty bad">Backend not reachable.<br><span class="mut">Start it with <code>npm start</code> (serves the game and the API on port 8787), then <button class="mini" id="dash-retry">retry</button></span></div>`
      : `<div class="empty bad">${esc(e.message)}</div>`;
    const b = body.querySelector('#dash-retry'); if (b) b.onclick = async () => { await retryProbe(); refresh(); };
  }
}
export function openDash(t) { if (!el) build(); if (t) { tab = t; el.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x.dataset.t === tab)); } open = true; el.classList.remove('hidden'); refresh(); clearInterval(timer); timer = setInterval(refresh, 8000); }
export function close() { open = false; clearInterval(timer); el && el.classList.add('hidden'); }
export function initDash() { on('dash:open', openDash); }

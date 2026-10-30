import * as api from './api.js';
import './style.css';
import Phaser from 'phaser';
import { MenuScene, GameScene } from './game.js';
import { buildSprites } from './sprites.js';
import { initUI, S, renderWheel, renderWallet, updateChip } from './ui.js';
import { emit, on } from './bus.js';
import * as chain from './chain.js';

buildSprites();
const q = new URLSearchParams(location.search);

const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: 960, height: 540, backgroundColor: '#16221a',
  pixelArt: true, roundPixels: false, antialias: false,
  fps: { target: 120, smoothStep: true }, disableContextMenu: true,
  render: { powerPreference: 'high-performance', batchSize: 4096 },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [MenuScene, GameScene],
  input: { activePointers: 2 },
});
window.__game = game;
initUI(game);

// ---------------- wheel reads (periodic, in the menu and during a run) ----------------
let lastHeight = null;
async function refreshWheel(force) {
  if (S.wheelBusy && !force) return;
  S.wheelBusy = true; if (!S.wheel) renderWheel();
  const w = await chain.readWheel();
  S.wheelBusy = false;
  if (!w.ok && S.wheel?.ok) { /* keep the last good data, but note the error */ S.wheel = { ...S.wheel, stale: w.error }; }
  else S.wheel = w;
  if (w.ok) {
    if (lastHeight !== null && w.height > lastHeight && S.running) emit('block', { height: w.height.toString() });
    lastHeight = w.height;
  }
  renderWheel(); updateChip();
}
window.__refreshWheel = refreshWheel;
refreshWheel();
setInterval(() => { if (!document.hidden) refreshWheel(); }, 45000);

// ---------------- wallet ----------------
const W = S.wallet;
function setW(p) { Object.assign(W, p); renderWallet(); updateChip(); }
async function loadSqueeks() {
  if (!W.address) return;
  setW({ busy: true, status: '0%', error: false });
  try {
    const sq = await chain.readSqueeks(W.address, (p, n) => setW({ status: `${Math.round(p * 100)}% · ${n} found` }));
    setW({ busy: false, status: '', squeeks: sq, boost: chain.squeekBoost(sq) });
  } catch (e) {
    setW({ busy: false, error: true, status: 'Could not read Squeeks (RPC): ' + (e?.shortMessage || e?.message || e) + ' — the game continues without a bonus.', squeeks: null, boost: null });
  }
}
async function connect() {
  if (!chain.hasWallet()) { setW({ error: true, status: 'No browser wallet (MetaMask etc.) found. Install one and reload, or enter an address. The game is fully playable without a wallet.' }); return; }
  setW({ busy: true, status: 'waiting for wallet approval…', error: false });
  try {
    const r = await chain.connectWallet();
    localStorage.setItem('hr.wallet', '1');
    setW({ address: r.address, readOnly: false, chainOk: r.chainOk, status: r.chainOk ? '' : 'Could not switch to the Sepolia network.' });
    if (r.chainOk) { loadSqueeks(); } else setW({ busy: false });
    if (!api.restore(r.address)) await signIn(); else setW({ auth: 'ok' });
  } catch (e) {
    const rejected = e?.code === 4001 || /reject|denied/i.test(e?.message || '');
    setW({ busy: false, error: true, status: rejected ? 'Connection rejected.' : 'Could not connect: ' + (e?.shortMessage || e?.message || e) });
  }
}
async function signIn() {
  if (!W.address || W.readOnly) return;
  setW({ auth: 'busy', authMsg: '' });
  try { await api.signIn(W.address); setW({ auth: 'ok', authMsg: '' }); }
  catch (e) {
    const rejected = e?.code === 4001 || /reject|denied/i.test(e?.message || '');
    setW({ auth: 'err', authMsg: rejected ? 'Signature rejected — you can still play, but won\'t be ranked.' : e.message === 'OFFLINE' ? 'Backend offline — start it with `npm start`.' : 'Sign-in failed: ' + (e?.shortMessage || e?.message || e) });
  }
}
on('auth:signin', signIn);
function restoreAuth() { setW(api.restore(W.address) && !W.readOnly ? { auth: 'ok', authMsg: '' } : { auth: 'none', authMsg: '' }); }
on('wallet:connect', connect);
on('wallet:switch', async () => {
  try { await chain.switchToSepolia(); setW({ chainOk: true, status: '' }); await loadSqueeks(); }
  catch (e) { setW({ error: true, status: 'Could not switch network: ' + (e?.message || e) }); }
});
on('wallet:addr', async (a) => {
  if (!chain.isAddress(a)) { setW({ error: true, status: 'Invalid address.' }); return; }
  setW({ address: a, readOnly: true, chainOk: true, squeeks: null, boost: null }); await loadSqueeks();
});
on('wallet:reread', loadSqueeks);
on('wallet:disconnect', () => { api.signOut(W.address); localStorage.removeItem('hr.wallet'); setW({ address: null, readOnly: false, squeeks: null, boost: null, status: '', error: false, busy: false, auth: 'none', authMsg: '' }); });
chain.onWalletEvents(async (ev) => {
  if (W.readOnly) return;
  if (ev.type === 'accounts') {
    if (!ev.accounts?.length) setW({ address: null, squeeks: null, boost: null, status: 'Wallet disconnected.' });
    else { setW({ address: ev.accounts[0], squeeks: null, boost: null }); restoreAuth(); await loadSqueeks(); }
  } else if (ev.type === 'chain') {
    try { const id = parseInt(await chain.getProvider().request({ method: 'eth_chainId' }), 16); setW({ chainOk: id === chain.CHAIN_ID }); } catch { /* ignore */ }
  }
});
// reconnect silently without a popup if already authorized
(async () => {
  const qa = q.get('addr');
  if (qa && chain.isAddress(qa)) { setW({ address: qa, readOnly: true, chainOk: true }); await loadSqueeks(); return; }
  if (localStorage.getItem('hr.wallet') === '1') {
    await new Promise((r) => setTimeout(r, 300));
    const a = await chain.silentAccount();
    if (a) {
      let ok = true; try { ok = parseInt(await chain.getProvider().request({ method: 'eth_chainId' }), 16) === chain.CHAIN_ID; } catch { ok = false; }
      setW({ address: a, readOnly: false, chainOk: ok }); restoreAuth(); if (ok) await loadSqueeks();
    }
  }
})();
if (q.has('autoplay')) setTimeout(() => document.getElementById('btn-play').click(), 1500);

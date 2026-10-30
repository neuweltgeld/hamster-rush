// Squeekchain (Sepolia) reads + wallet connection.  READ-ONLY: no signatures, no private keys.
import { createPublicClient, http, fallback, getAddress, isAddress } from 'viem';
import { sepolia } from 'viem/chains';
import coreAbi from '../public/abi/SqueekCore.json';
import miningAbi from '../public/abi/SqueekMining.json';
import nftAbi from '../public/abi/SqueekNFT.json';

export const CHAIN_ID = 11155111;
export const ADDR = {
  core: '0x74665dAecA35A2303e767E76a2FF1FB6F93e119f',
  mining: '0x3beE588fC20dE788Bac17d33b41Da7346cb27EC4',
  sqk: '0x6872bfa5ccc3e9e440c6c16e5ffdabb8dba4cc76',
  nft: '0x0eAF3E0d40A0a8E5a6Ac030b2459E9FB0B7905c6',
};
// docs.squeekchain.com/developers → launch config from sepolia.json
const EXPECT = {
  streamId: '0xa0186b1a24b217f12f56c8574b492e286d00cd94bb5546cba45b048b19c60e44',
  genesis: 1791847800n,
  maxWork: 10000n,
};
export const RPCS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://1rpc.io/sepolia',
  'https://sepolia.gateway.tenderly.co',
];
const NFT_MAX_ID = 9999;
const WINDOW_ROUNDS = 144; // 144 rounds x 10 min = last 24 hours (from settled data)

export const client = createPublicClient({
  chain: sepolia,
  transport: fallback(RPCS.map((u) => http(u, { timeout: 9000, retryCount: 1 })), { rank: false }),
  batch: { multicall: { batchSize: 16384, wait: 16 } },
});

const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/** Light verification (summary of the docs' "Verify the deployment"): version + links + launch config. */
async function verifyLite(blockNumber) {
  const [coreVer, miningVer, miningCore, tokenMining, policy, cfg] = await Promise.all([
    client.readContract({ address: ADDR.core, abi: coreAbi, functionName: 'implementationCodeVersion', blockNumber }),
    client.readContract({ address: ADDR.mining, abi: miningAbi, functionName: 'implementationCodeVersion', blockNumber }),
    client.readContract({ address: ADDR.mining, abi: miningAbi, functionName: 'core', blockNumber }),
    client.readContract({ address: ADDR.sqk, abi: [{ type: 'function', name: 'mining', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }], functionName: 'mining', blockNumber }),
    client.readContract({ address: ADDR.mining, abi: miningAbi, functionName: 'collectionPolicy', args: [0], blockNumber }),
    client.readContract({ address: ADDR.core, abi: coreAbi, functionName: 'configuration', blockNumber }),
  ]);
  const ok =
    coreVer === 3n && miningVer === 6n &&
    same(miningCore, ADDR.core) && same(tokenMining, ADDR.mining) && same(policy.nft, ADDR.nft) &&
    same(cfg.streamId, EXPECT.streamId) && cfg.genesisTimestamp === EXPECT.genesis && cfg.maxWorkPerRound === EXPECT.maxWork;
  return { ok, cfg, coreVer, miningVer };
}

/** Wheel bonus: settled work over the last 24 hours vs. the long-term average. */
export function wheelBonus(w) {
  if (!w || !w.ok) return { tier: 'offline', label: 'Offline', luck: 0, xp: 0, speed: 0, desc: 'Chain unreadable: no bonus (the game still plays normally).' };
  const r = w.ratio;
  if (w.workWindow === 0n || r === 0) return { tier: 'idle', label: 'Sleeping', luck: 0, xp: 0, speed: 0, desc: 'The wheel is idle: no bonus.' };
  if (r < 0.6) return { tier: 'warm', label: 'Warming up', luck: 0.1, xp: 0.05, speed: 0, desc: '+10% chest luck, +5% XP' };
  if (r < 1.4) return { tier: 'run', label: 'Running', luck: 0.25, xp: 0.1, speed: 0, desc: '+25% chest luck, +10% XP' };
  return { tier: 'rush', label: 'RUSH!', luck: 0.5, xp: 0.2, speed: 0.1, desc: '+50% chest luck, +20% XP, +10% speed' };
}

/** SqueekCore + SqueekMining state. Everything is read at a single Ethereum block (docs invariant #2). */
export async function readWheel() {
  const out = { ok: false, at: Date.now() };
  try {
    const chainId = await client.getChainId();
    if (chainId !== CHAIN_ID) throw new Error('Wrong network: ' + chainId);
    const head = await client.getBlock();
    const blockNumber = head.number;
    const ro = { blockNumber };
    const [state, config] = await Promise.all([
      client.readContract({ address: ADDR.core, abi: coreAbi, functionName: 'state', ...ro }),
      client.readContract({ address: ADDR.core, abi: coreAbi, functionName: 'configuration', ...ro }),
    ]);
    const units = config.blockUnitsPerBlock;
    // height = cumulativeBlockUnits / 1e9  (bigint!)
    const height = state.cumulativeBlockUnits / units;
    const progress = state.cumulativeBlockUnits % units;
    if (height !== state.blockHeight) throw new Error('Inconsistent block units');
    const currentRound = head.timestamp < config.genesisTimestamp ? 0n : (head.timestamp - config.genesisTimestamp) / config.roundDuration + 1n;
    const frontier = state.settledThroughRound;
    let workWindow = 0n, rounds = 0n, activeRounds = 0, lastActiveRound = 0n;
    try {
      // roundPage is paginated: the cursor advances to the returned certifiedThroughRound (not to the requested end).
      const after = frontier > BigInt(WINDOW_ROUNDS) ? frontier - BigInt(WINDOW_ROUNDS) : 0n;
      let cursor = after, startWork = null, endWork = 0n;
      for (let i = 0; i < 14 && cursor < frontier; i++) {
        const page = await client.readContract({ address: ADDR.core, abi: coreAbi, functionName: 'roundPage', args: [cursor, frontier, 16n], ...ro });
        if (startWork === null) startWork = page.start.cumulativeWork;
        endWork = page.end.cumulativeWork;
        activeRounds += page.rounds.length;
        if (page.rounds.length) lastActiveRound = page.rounds[page.rounds.length - 1].roundId;
        if (page.certifiedThroughRound <= cursor) break;
        cursor = page.certifiedThroughRound;
      }
      if (startWork === null) throw new Error('window could not be read');
      workWindow = endWork - startWork;
      rounds = cursor - after;
    } catch { /* pencere okunamazsa sadece bonus 'bilinmiyor' olur */ }
    const avgPerRound = frontier > 0n ? Number(state.cumulativeWork) / Number(frontier) : 0;
    const recentPerRound = rounds > 0n ? Number(workWindow) / Number(rounds) : 0;
    const ratio = avgPerRound > 0 ? recentPerRound / avgPerRound : 0;
    let verified = null;
    try { verified = (await verifyLite(blockNumber)).ok; } catch { verified = null; }
    const head2 = await client.getBlock({ blockNumber });
    Object.assign(out, {
      ok: true, chainId, blockNumber, blockHash: head2.hash, reorged: head2.hash !== head.hash,
      height, progress, progressPct: Number((progress * 1000n) / units) / 10,
      cumulativeWork: state.cumulativeWork, settledThroughRound: frontier, currentRound,
      lagRounds: currentRound > frontier ? currentRound - frontier : 0n,
      paused: state.paused, workWindow, windowRounds: Number(rounds), activeRounds, lastActiveRound, avgPerRound, recentPerRound, ratio, verified,
      workPerThousandBlocks: state.workPerThousandBlocks,
    });
  } catch (e) {
    out.error = e?.shortMessage || e?.message || String(e);
  }
  out.bonus = wheelBonus(out);
  return out;
}

// ------------------ Wallet (EIP-1193, connect + switch network only) ------------------
let provider = null;
const found = new Map();
if (typeof window !== 'undefined') {
  window.addEventListener('eip6963:announceProvider', (e) => { if (e.detail?.provider) found.set(e.detail.info?.rdns || e.detail.info?.name, e.detail); });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}
export function getProvider() {
  if (provider) return provider;
  const mm = [...found.values()].find((d) => d.info?.rdns === 'io.metamask');
  provider = mm?.provider || [...found.values()][0]?.provider || (typeof window !== 'undefined' ? window.ethereum : null) || null;
  return provider;
}
export const hasWallet = () => !!getProvider();

export async function switchToSepolia(p = getProvider()) {
  try {
    await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] });
  } catch (e) {
    if (e?.code === 4902 || /unrecognized|not added/i.test(e?.message || '')) {
      await p.request({ method: 'wallet_addEthereumChain', params: [{
        chainId: '0xaa36a7', chainName: 'Sepolia', nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
        rpcUrls: [RPCS[0]], blockExplorerUrls: ['https://eth-sepolia.blockscout.com'],
      }] });
    } else throw e;
  }
}
export async function connectWallet() {
  const p = getProvider();
  if (!p) throw new Error('NO_WALLET');
  const accounts = await p.request({ method: 'eth_requestAccounts' });
  if (!accounts?.length) throw new Error('NO_ACCOUNT');
  let chainOk = true;
  try {
    const id = await p.request({ method: 'eth_chainId' });
    if (parseInt(id, 16) !== CHAIN_ID) { await switchToSepolia(p); }
  } catch (e) { chainOk = false; }
  const id2 = await p.request({ method: 'eth_chainId' }).catch(() => null);
  if (id2 && parseInt(id2, 16) !== CHAIN_ID) chainOk = false;
  return { address: getAddress(accounts[0]), chainOk };
}
/** Read a previously authorized account without opening a pop-up. */
export async function silentAccount() {
  const p = getProvider();
  if (!p) return null;
  try { const a = await p.request({ method: 'eth_accounts' }); return a?.[0] ? getAddress(a[0]) : null; } catch { return null; }
}
export function onWalletEvents(cb) {
  const p = getProvider();
  if (!p?.on) return () => {};
  const a = (acc) => cb({ type: 'accounts', accounts: acc });
  const c = () => cb({ type: 'chain' });
  p.on('accountsChanged', a); p.on('chainChanged', c);
  return () => { p.removeListener?.('accountsChanged', a); p.removeListener?.('chainChanged', c); };
}
export { isAddress };

// ------------------ Squeek NFT okuma ------------------
/** The NFT is not ERC721Enumerable -> scan ids 1..9999 via ownerOf (multicall), stop once balanceOf are found. */
export async function readSqueeks(address, onProgress) {
  const owner = getAddress(address);
  const balance = await client.readContract({ address: ADDR.nft, abi: nftAbi, functionName: 'balanceOf', args: [owner] });
  const res = { address: owner, balance: Number(balance), tokens: [], scanned: 0, complete: true };
  if (balance === 0n) return res;
  const ids = [];
  const CH = 800;
  outer: for (let start = 1; start <= NFT_MAX_ID; start += CH * 3) {
    const jobs = [];
    for (let k = 0; k < 3; k++) {
      const s = start + k * CH; if (s > NFT_MAX_ID) break;
      const calls = [];
      for (let i = s; i < Math.min(s + CH, NFT_MAX_ID + 1); i++) calls.push({ address: ADDR.nft, abi: nftAbi, functionName: 'ownerOf', args: [BigInt(i)] });
      jobs.push(client.multicall({ contracts: calls, allowFailure: true }).then((r) => r.forEach((x, j) => { if (x.status === 'success' && same(x.result, owner)) ids.push(s + j); })));
    }
    await Promise.all(jobs);
    res.scanned = Math.min(start + CH * 3 - 1, NFT_MAX_ID);
    onProgress?.(res.scanned / NFT_MAX_ID, ids.length);
    if (ids.length >= res.balance) break outer;
  }
  res.complete = ids.length >= res.balance;
  const top = ids.sort((a, b) => a - b).slice(0, 60);
  const pos = await client.multicall({
    contracts: top.map((id) => ({ address: ADDR.mining, abi: miningAbi, functionName: 'position', args: [0, BigInt(id)] })),
    allowFailure: true,
  });
  res.tokens = top.map((id, i) => ({ id, level: pos[i].status === 'success' ? Number(pos[i].result.level) : 1, weight: pos[i].status === 'success' ? Number(pos[i].result.activeWeight) : 0 }));
  return res;
}

/** Starting-stat bonus from Squeek ownership. */
export function squeekBoost(sq) {
  if (!sq || !sq.tokens?.length) return null;
  const best = Math.max(...sq.tokens.map((t) => t.level));
  const n = Math.max(sq.balance, sq.tokens.length);
  return {
    count: n, best,
    hp: 0.05 * best, dmg: 0.04 * best, xp: Math.min(0.25, 0.02 * n),
    rerolls: best >= 5 ? 1 : 0, blades: best >= 8 ? 1 : 0,
    desc: `Highest level ${best}: +${5 * best}% HP, +${4 * best}% damage, +${Math.round(Math.min(25, 2 * n))}% XP` +
      (best >= 5 ? ', +1 reroll' : '') + (best >= 8 ? ', starts with a wheel blade' : ''),
  };
}

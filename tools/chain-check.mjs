// Verifies chain reads from Node (browser-independent): node tools/chain-check.mjs [0xaddress]
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const chain = await server.ssrLoadModule('/src/chain.js');
const w = await chain.readWheel();
const rep = (k, v) => typeof v === 'bigint' ? v.toString() : v;
console.log(JSON.stringify(w, rep, 2));
const addr = process.argv[2];
if (addr) {
  const t = Date.now();
  const sq = await chain.readSqueeks(addr, (p, n) => process.stdout.write(`\rscan ${(p * 100) | 0}% found ${n}   `));
  console.log('\n', JSON.stringify(sq, rep), (Date.now() - t) + 'ms');
  console.log(chain.squeekBoost(sq));
}
await server.close();

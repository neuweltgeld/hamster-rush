// Mock-wallet e2e: connect → SIWE-style signature → play → score submitted → dashboard shows the wallet.
// node tools/wallet-e2e.mjs <baseUrl> [shotDir]
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
const [base = 'http://127.0.0.1:5201/', dir = '/tmp'] = process.argv.slice(2);
fs.mkdirSync(dir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const acc = privateKeyToAccount(generatePrivateKey());
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader'], headless: true });
const p = await b.newPage(); await p.setViewport({ width: 1100, height: 700 });
const errs = []; p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|eth_|rpc|RPC/i.test(m.text())) errs.push(m.text()); });
let signed = 0;
await p.exposeFunction('__sign', async (msg) => { signed++; return acc.signMessage({ message: { raw: msg } }); });
await p.evaluateOnNewDocument((addr) => {
  window.ethereum = { isMetaMask: true, on() {}, removeListener() {}, async request({ method, params }) {
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [addr];
    if (method === 'eth_chainId') return '0xaa36a7';
    if (method === 'personal_sign') return window.__sign(params[0]);
    throw Object.assign(new Error('unsupported ' + method), { code: -32601 });
  } };
}, acc.address);
let ok = 0, fail = 0; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); c ? ok++ : fail++; };
await p.goto(base + '?bot=1&god=1'); await sleep(2500);
await p.click('#btn-connect'); await sleep(3500);
const wtxt = await p.$eval('#wallet-body', (e) => e.innerText);
chk(signed === 1, 'wallet was asked to sign once (' + signed + ')');
chk(/signed in/.test(wtxt), 'wallet card shows signed in');
await p.screenshot({ path: dir + '/e2e-menu.png' });
await p.click('#btn-dashboard'); await sleep(1500);
await p.click('.tabs button[data-t="lg"]'); await sleep(1200);
const lg = await p.$eval('#dash-body', (e) => e.innerText);
chk(lg.toLowerCase().includes(acc.address.slice(0, 6).toLowerCase()), 'dashboard "Wallet logins" lists this wallet');
await p.screenshot({ path: dir + '/e2e-dash-logins.png' });
await p.keyboard.press('Escape'); await sleep(300);
chk(await p.$eval('#dash', (e) => e.classList.contains('hidden')), 'Esc closes dashboard');
await p.click('#btn-play'); await sleep(4000);
await p.evaluate(() => { const g = window.__hr; g.t = 14; g.kills = 25; g.finish(false); });
await sleep(3500);
const sync = await p.$eval('#res-sync', (e) => e.innerText).catch(() => '');
chk(/recorded/i.test(sync), 'result screen: ' + sync);
await p.screenshot({ path: dir + '/e2e-result.png' });
await p.click('#btn-board'); await sleep(1500);
const lb = await p.$eval('#dash-body', (e) => e.innerText);
chk(lb.toLowerCase().includes(acc.address.slice(0, 6).toLowerCase()), 'leaderboard lists this wallet');
await p.screenshot({ path: dir + '/e2e-dash-lb.png' });
// reload → session restored without a new signature
await p.reload(); await sleep(3500);
chk(signed === 1, 'reload restores session without another signature (' + signed + ')');
console.log(errs.slice(0, 8).join('\n') || 'no page errors'); if (errs.length) fail++;
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASS (' + ok + ')'); process.exit(fail ? 1 : 0);

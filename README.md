# 🐹 Hamster Rush — a Squeekchain prototype

A top-down, auto-firing, Vampire Survivors / Archero-style survival game with **32-bit era pixel art**
(think late SNES / GBA / PS1 2D sprites). Built with Phaser 3 (`pixelArt: true`) + viem.
Every sprite is **drawn in code** on a canvas — there are no image files.
It reads Squeekchain's **Sepolia** contracts (chainId 11155111). Reading is signature-free; an optional free message signature signs you in to the leaderboard (never a private key, never a transaction).

## Run it

```bash
npm install
npm start          # builds dist/ if needed, then serves the game AND the API on http://localhost:8787
```

Other modes:

```bash
npm run dev        # Vite dev server http://localhost:5173 (proxies /api to :8787 — run `npm run server` next to it)
npm run server     # backend only (serves dist/ if present)
npm run build && npm run preview   # static game only, no leaderboard backend
```

Env vars for the server: `PORT` (8787), `HOST` (0.0.0.0), `DATA_DIR` (./data), `DIST_DIR` (./dist), `HR_SECRET` (session HMAC key; auto-generated in `data/secret.key` otherwise).
The game works without the backend; the dashboard then shows "Backend not reachable" and scores simply aren't posted.

## Wallet sign-in, dashboard and leaderboard

- Connect wallet → the game asks for **one free message signature** (`personal_sign`, EIP-4361 / "Sign-In with Ethereum" style text with domain, nonce, chain id and issued-at). No transaction, no gas, no approvals.
- The server (`server/index.js`, Node `http` + viem) issues a single-use nonce, verifies the signature with `viem.verifyMessage`, then returns an HMAC-signed session token (7 days, kept in `localStorage`, so reloads don't ask again).
- Finished runs are submitted automatically (`POST /api/run`). **The server recomputes the score** from kills / level / time / bosses / elites and flags implausible runs (kill rate, boss timing, finishing faster than real time); flagged runs are stored but not ranked.
- **📊 Dashboard** (menu button or result screen): global stats, leaderboard, recent wallet logins, recent runs. Auto-refreshes every 8 s.
- API: `GET /api/health · /api/nonce?address= · /api/leaderboard · /api/stats · /api/logins · /api/runs · /api/player/:addr`, `POST /api/session · /api/run`. Data lives in `data/db.json` (atomic writes).
- Limits: EOA wallets only (no EIP-1271 smart-contract wallets); the score check is plausibility-based, not a replay of the run, so a determined cheater can still fabricate a *plausible* run.

## Gameplay

- **Move:** WASD / arrow keys (8 directions, the hamster turns through 5 yaw views + mirror). **Dash:** Space / Shift (invulnerable, afterimage trail). On touch: drag anywhere + DASH button.
- **Fire:** automatic. Every weapon has its own pattern; up to **6 weapons + 8 passives** per run.
- Enemies → XP gems → **level up and pick 1 of 3 cards** (keys 1/2/3, reroll with R). A run lasts **5.5 minutes**; bosses at 1:35, 3:15 and 4:35.
- **12 weapons**, each to level 8, then an **evolution** when paired with its passive: Seed Spitter → Sunflower Storm, Wheel Saw → Flaming Hamster Wheel, Cheese Wave → Fondue Tsunami, Hazelnut Bomb → Nutcracker Barrage, Acorn Boomerang → Golden Acorn, Whisker Zap → Storm Whiskers, Chili Breath → Dragon Chili, Snow Burst → Blizzard, Thorn Traps → Cluster Mines, Bee Buddies → Hive Queen, Star Fall → Meteor Shower, Gem Laser → Prism Cannon.
- **15 passives + 14 perks** with 5 rarities (Common → Legendary) that scale the effect. The offer is weighted and avoids recently shown cards, so level-ups rarely repeat.
- **15 enemy types** (beetle, ant, rat packs, wasp, slime that splits, snake, bat, hedgehog that curls, mole that burrows, spitter, skunk gas, crow dives, alley cat, boar charge, bomb bug) with 4 elite affixes (Armored, Swift, Volatile, Pack Leader), and **3 bosses**: Hornet Queen, Cat King, Mole Titan — multi-phase, with telegraphed attacks and a boss HP bar.
- **Chest at the end of a run:** 5 rarities; drops a weapon, helmet or charm. Luck: survival time + kills + victory + wheel bonus + Squeek level + charm.
- Persistent progress (`localStorage`): seeds 🌻, permanent upgrades (shop), equipped items, records.
- **Game feel / VFX:** pooled particles, additive glow sprites, shockwave rings, camera trauma shake, hit-stop on big hits, damage numbers, combo meter, bloom + vignette post-FX (**G** toggles bloom; `?fx=low|med|high`, `?bloom=0`).
- **Animated HUD:** portrait that reacts to damage, segmented HP bar with trail, XP bar, dash cooldown, weapon slots with cooldown sweeps and level pips, minimap, boss bar, toasts, low-HP vignette + heartbeat.
- Performance: no physics engine, pooled sprites/projectiles/vfx, spatial-hash collisions, adaptive effect degradation. **F3** or `?perf=1` shows an fps/ms overlay.
- Pause: Esc / P / ❚❚ (also automatic when the tab loses focus).

## Art style (32-bit look)

- **Bigger sprites:** hamster 48×48, enemies 40–64 px, Cat Boss 128×128 (shown at 64×64 world px), icons 32×32 — all drawn at 2× pixel density.
- The canvas is **960×540** with a 2× camera zoom, so the playfield is still 480×270 world px and every texture pixel maps 1:1 to a screen pixel (`pixelArt: true`, crisp scaling).
- **Rich palettes:** every colour is a 5-step hue-shifted ramp (cool shadows, warm highlights), sphere-style lighting with light Bayer dithering, selective dark outlines and baked ground shadows.
- **Animation:** 4-frame walk cycles for the hamster and every enemy, a 3-frame idle (with blinking) for the hamster, a separate **hit frame** for each character, and an enraged Boss palette/animation.
- **Hitboxes** are circles sized to the body (not the sprite box): player r = 5.5 world px, beetle 6.5, ant 5, snake 7, cat 8.5, bat 6, spitter 8, boar 12.5, boss 22.
- `tools/sheet.html` is a sprite viewer: run `npm run dev` and open `/tools/sheet.html?z=4&only=boss`.

## Squeekchain integration

| What | How |
|---|---|
| **Wheel status** | `SqueekCore` + `SqueekMining` are read at a single Ethereum block (multicall). Block height = `cumulativeBlockUnits / 1e9` (bigint). The last 24 h of settled wheel work is compared with the historical average. |
| **Hamster Rush bonus** | Sleeping 0 · Warming up (+10% luck, +5% XP) · Running (+25%, +10% XP) · RUSH! (+50%, +20% XP, +10% speed) · Offline 0 |
| **Live HUD** | `Block #… · Wheel: …` chip, refreshed every 45 s. If a new Squeek block completes during a run, a **golden block chest** drops (free level-up). |
| **Wallet** | EIP-6963 / `window.ethereum`: `eth_requestAccounts` + `wallet_switchEthereumChain` (Sepolia; falls back to `wallet_addEthereumChain`). One optional `personal_sign` for leaderboard sign-in; no transactions. Reconnects silently if already authorized. |
| **Squeek NFT bonus** | SqueekNFT is not enumerable, so ownership is found with an `ownerOf` multicall scan (1..9999). `position(0,id).level` → HP +5%/level, damage +4%/level, XP +2%/NFT (max +25%); level ≥ 5 → +1 reroll; level ≥ 8 → start with a wheel blade; a coloured ring around the character shows your level. |
| **Read-only mode** | No wallet? Paste an address in the menu, or use `?addr=0x…`. |

**No wallet / RPC down:** the game stays fully playable. The wheel panel shows "OFFLINE" and the bonus is 0. Three RPCs (publicnode, 1rpc, tenderly gateway) are tried in order with a 9 s timeout.

Contracts (Sepolia): SqueekCore proxy `0x74665dAecA35A2303e767E76a2FF1FB6F93e119f`, SqueekMining proxy `0x3beE588fC20dE788Bac17d33b41Da7346cb27EC4`, SQK `0x6872bfa5ccc3e9e440c6c16e5ffdabb8dba4cc76`, SqueekNFT `0x0eAF3E0d40A0a8E5a6Ac030b2459E9FB0B7905c6`. ABIs live in `public/abi/`.

## Files

```
index.html            entry + DOM UI skeleton
src/main.js           Phaser bootstrap, wheel polling, wallet flow
src/game.js           MenuScene + GameScene (gameplay, spawns, boss, weapons)
src/ui.js             menu / result / chest screens (DOM)
src/hud.js            animated HUD + level-up cards
src/hero.js enemyart.js iconart.js fxart.js   code-drawn hero views, enemies, icons, FX textures
src/enemies.js weapons.js cards.js vfx.js pool.js   AI, weapon patterns + evolutions, level-up offers, effects, pooling
src/api.js dash.js    backend client (sign-in, runs) + dashboard overlay
server/index.js       Node backend (SIWE-style auth, leaderboard, static hosting)
src/chain.js          viem client, wheel reads, bonus, wallet, NFT scan
src/loot.js           rarities, chest roll, equipping
src/save.js           localStorage save + permanent upgrades
src/sprites.js        32-bit pixel-art engine + all sprites/animations (code-drawn)
src/sfx.js            WebAudio sounds
tools/                chain-check.mjs (chain test), e2e.mjs (headless test), content.mjs, balance.mjs, shot.mjs, sheet.html (sprite viewer)
public/abi, sepolia.json   published ABIs
```

## Tests / debugging

- `node tools/chain-check.mjs [0xaddress]` — prints the wheel and (if any) the Squeeks to the console.
- `node tools/e2e.mjs` — end-to-end test with headless Chrome while `vite preview` runs on port 4180 (console errors, a run, chest, save, RPC down, address mode).
- `node tools/content.mjs <devUrl>` — content audit (enemy textures, icons, evolutions, level-up variety).
- `node tools/api-test.mjs` — backend test (signature verification, replay/forgery, plausibility, leaderboard).
- `node tools/wallet-e2e.mjs <url>` — mocked-wallet end-to-end (connect → sign → play → score → dashboard).
- `node tools/stress.mjs <url> <tag> <evo 0|1>` — all weapons at lv 8 through all boss fights, prints ms/frame and errors.
- URL parameters: `?bot=1` (autopilot), `?speed=4` (time scale, max 4), `?god=1`, `?autoplay=1`, `?addr=0x…`.

## Music, world, wallpapers

- **Music**: original chiptune (menu / battle / boss themes, crossfaded), synthesized live with WebAudio in `src/music.js`. Starts on first click/key; **M** toggles mute; volume/mute are saved (`localStorage hr.music`).
- **World**: 2048x1536 generated map (`src/world.js`, `src/worldart.js`): 7 biomes (meadow, forest, farm, pond, standing stones, cheese fields, ruins), landmarks, winding paths, ponds and collision on large obstacles. No repeating tile spam.
- **Animation**: dt-based movement, smoothed camera with look-ahead, squash/stretch, 8-frame walk cycles, eased UI.
- **Wallpapers**: `node tools/wall.mjs` (needs `npx vite --port 5200` running) renders 5 scenes x (1920x1080, 1080x1920) into `/workspace/wallpapers`. `node tools/tour.mjs <url>` takes biome screenshots.
- **Licence**: all art and music is generated in code; no external assets, no third-party licence needed.

## Known limits

- Wheel data is **settle-delayed** (~76 h behind); the bonus reads the "last settled" work.
- Only a "light" verification (contract version + links); no implementation hash / layout digest check.
- The NFT scan is a 9999-id multicall (~5 s); NFT artwork is not used.
- Sepolia testnet only. Bonuses are client-side only (not cheat-proof; no rewards or tokens).

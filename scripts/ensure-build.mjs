// Builds dist/ if it is missing or older than the sources, then returns.
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mt = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };
function newest(dir) { let m = 0; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (['node_modules', 'dist', 'data', '.git'].includes(e.name)) continue; const p = path.join(dir, e.name); m = Math.max(m, e.isDirectory() ? newest(p) : mt(p)); } return m; }
const built = mt(path.join(root, 'dist', 'index.html'));
const src = Math.max(newest(path.join(root, 'src')), mt(path.join(root, 'index.html')), mt(path.join(root, 'public')), mt(path.join(root, 'vite.config.js')));
if (!built || src > built || process.argv.includes('--force')) {
  console.log('Building the game…');
  const r = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
} else console.log('dist/ is up to date.');

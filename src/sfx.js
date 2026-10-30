// Tiny WebAudio effects (no audio files)
let ctx = null; let enabled = true;
let last = {};
export const sfx = {
  getCtx() { return ctx; },
  setEnabled(v) { enabled = v; },
  unlock() { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch { /* sessiz */ } },
  beep(freq = 440, dur = 0.08, type = 'square', vol = 0.04, slide = 0, key = null, gap = 0.03) {
    if (!enabled || !ctx) return;
    const now = ctx.currentTime;
    if (key) { if (last[key] && now - last[key] < gap) return; last[key] = now; }
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, now);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + dur);
    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g).connect(ctx.destination); o.start(now); o.stop(now + dur + 0.02);
  },
  shoot() { this.beep(520, 0.05, 'square', 0.015, -200, 'shoot', 0.06); },
  hit() { this.beep(180, 0.05, 'sawtooth', 0.02, -80, 'hit', 0.04); },
  kill() { this.beep(300, 0.07, 'triangle', 0.03, -150, 'kill', 0.03); },
  gem() { this.beep(880, 0.05, 'sine', 0.025, 300, 'gem', 0.04); },
  hurt() { this.beep(120, 0.18, 'sawtooth', 0.06, -60, 'hurt', 0.1); },
  level() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, 0.12, 'square', 0.04), i * 70)); },
  chest() { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => this.beep(f, 0.15, 'triangle', 0.05), i * 90)); },
  nova() { this.beep(150, 0.35, 'sine', 0.06, 500, 'nova', 0.1); },
  boom() { this.beep(90, 0.22, 'sawtooth', 0.07, -50, 'boom', 0.05); this.beep(55, 0.3, 'square', 0.05, -20, null); },
  click() { this.beep(660, 0.04, 'square', 0.03); },
};

// Retro chiptune engine (pure WebAudio, no audio files).
// Three original loops written as note data: MENU (dreamy adventure, A minor), BATTLE (driving, E minor),
// BOSS (menacing, D minor / harmonic minor). Look-ahead step sequencer, 2 pulse voices + triangle bass + noise drums,
// smooth crossfades, music volume + mute persisted in localStorage, starts on the first user interaction (autoplay policy).
import { sfx } from './sfx.js';

const KEY = 'hr.music';
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const midi = (n) => { const m = /^([A-G][#b]?)(-?\d)$/.exec(n); return (parseInt(m[2], 10) + 1) * 12 + NOTE[m[1]]; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------- song data
// chord: [rootMidi, 'm'|'M'|'7']  ·  lead: per bar "note/len ..." (len in 16ths, r = rest, bar = 16 steps)
const CH = {
  Am: [45, 'm'], F: [41, 'M'], C: [48, 'M'], G: [43, 'M'], Dm: [50, 'm'], Em: [40, 'm'], E: [40, 'M'],
  D: [50, 'M'], B7: [47, '7'], Bb: [46, 'M'], Gm: [43, 'm'], A: [45, 'M'],
};
const TRI = { m: [0, 3, 7], M: [0, 4, 7], 7: [0, 4, 7, 10] };

const SONGS = {
  menu: {
    bpm: 100, swing: 0.04, leadWave: 0.25, leadVol: 0.085, arpWave: 0.125, arpVol: 0.04, bassVol: 0.16,
    chords: 'Am F C G Am F G C Dm Am F G Dm Am E E'.split(' '),
    lead: [
      'E5/4 A5/4 C6/4 B5/2 A5/2', 'A5/4 F5/4 C6/4 A5/2 F5/2', 'G5/4 E5/4 G5/4 C6/4', 'B5/6 A5/2 G5/4 D5/4',
      'E5/4 A5/4 C6/4 E6/4', 'D6/4 C6/4 A5/4 F5/4', 'G5/2 B5/2 D6/4 B5/4 G5/4', 'C6/8 r/4 E5/2 G5/2',
      'F5/4 A5/4 D6/4 C6/2 A5/2', 'C6/4 E6/4 C6/4 A5/4', 'A5/4 C6/4 F6/4 E6/2 C6/2', 'D6/4 B5/4 G5/4 B5/4',
      'F5/2 A5/2 D6/4 F6/4 E6/2 D6/2', 'E6/4 C6/4 A5/4 C6/4', 'B5/4 G#5/4 E5/4 G#5/4', 'B5/8 E5/4 G#5/2 B5/2',
    ],
    arp: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1].map((v, i) => (i % 2 ? v + 3 : v)), // up an octave on off-beats = sparkle
    bass: 'pad', drums: 'soft',
  },
  battle: {
    bpm: 152, swing: 0, leadWave: 0.5, leadVol: 0.075, arpWave: 0.25, arpVol: 0.042, bassVol: 0.19,
    chords: 'Em C G D Em C D B7 Am D G Em Am D B7 B7'.split(' '),
    lead: [
      'B5/3 B5/1 B5/2 G5/2 E5/4 G5/4', 'G5/3 G5/1 G5/2 E5/2 C5/4 E5/4', 'D6/3 D6/1 D6/2 B5/2 G5/4 B5/4', 'A5/3 A5/1 A5/2 F#5/2 D5/4 F#5/4',
      'E6/4 D6/2 B5/2 G5/4 B5/4', 'C6/4 B5/2 G5/2 E5/4 G5/4', 'D6/4 C#6/2 A5/2 F#5/4 A5/4', 'B5/2 D#6/2 F#6/4 D#6/2 B5/2 F#5/4',
      'A5/4 C6/4 E6/8', 'F#6/4 D6/4 A5/8', 'G5/4 B5/4 D6/4 G6/4', 'E6/6 D6/2 B5/4 G5/4',
      'C6/2 E6/2 A6/4 G6/4 E6/4', 'F#6/2 A6/2 D6/4 E6/4 F#6/4', 'D#6/4 F#6/4 B5/4 A5/4', 'B5/2 B5/2 B5/4 E6/8',
    ],
    arp: [0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2].map((v, i) => v + (i % 4 === 3 ? 3 : 0)),
    bass: 'drive', drums: 'rock', fillEvery: 8,
  },
  boss: {
    bpm: 172, swing: 0, leadWave: 0.25, leadVol: 0.08, arpWave: 0.125, arpVol: 0.045, bassVol: 0.21,
    chords: 'Dm Dm Bb A Dm Gm A A Dm Dm Bb A Dm Gm A A'.split(' '),
    lead: [
      'D5/2 D5/2 D6/2 D5/2 C6/2 D5/2 Bb5/2 D5/2', 'D5/2 D5/2 D6/2 D5/2 E6/2 F6/2 E6/2 D6/2', 'Bb4/2 Bb4/2 Bb5/2 Bb4/2 A5/2 Bb4/2 F5/2 Bb4/2', 'A4/2 A4/2 A5/2 A4/2 G#5/2 A4/2 C#6/2 E6/2',
      'A5/4 D6/4 F6/4 E6/2 D6/2', 'G5/4 Bb5/4 D6/4 C6/2 Bb5/2', 'C#6/4 E6/4 A6/4 G6/2 E6/2', 'F6/6 E6/2 D6/2 C#6/2 A5/4',
      'D6/2 F6/2 A6/4 G6/2 F6/2 E6/2 D6/2', 'F6/2 A6/2 D7/4 C7/2 A6/2 F6/4', 'D6/2 F6/2 Bb6/4 A6/2 F6/2 D6/4', 'C#6/2 E6/2 A6/4 G6/2 E6/2 C#6/4',
      'D6/4 F6/4 A6/4 D7/4', 'G6/4 Bb6/4 D7/4 C7/2 Bb6/2', 'C#7/4 A6/4 E6/4 A6/4', 'D6/2 E6/2 F6/2 G6/2 A6/2 C#7/2 E7/4',
    ],
    arp: [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 0, 2, 1, 2].map((v, i) => v + (i % 8 >= 4 ? 3 : 0)),
    bass: 'gallop', drums: 'double', fillEvery: 4,
  },
};

// ---------------------------------------------------------------- voices
const waves = new WeakMap();
function pulse(ctx, duty) {
  let m = waves.get(ctx); if (!m) { m = {}; waves.set(ctx, m); }
  if (!m[duty]) {
    const N = 48, re = new Float32Array(N), im = new Float32Array(N);
    for (let n = 1; n < N; n++) { const a = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty); re[n] = a * Math.cos(n * Math.PI * duty); im[n] = a * Math.sin(n * Math.PI * duty); } // exact pulse spectrum, no DC
    m[duty] = ctx.createPeriodicWave(re, im);
  }
  return m[duty];
}
let noiseBuf = new WeakMap();
function noise(ctx) {
  let b = noiseBuf.get(ctx);
  if (!b) { b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = b.getChannelData(0); let s = 12345; for (let i = 0; i < d.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 2147483648) - 1; } noiseBuf.set(ctx, b); }
  return b;
}

function tone(ctx, out, t, freq, dur, { wave = 0.5, vol = 0.08, type = null, vib = 0, attack = 0.004, rel = 0.05, slideTo = 0 }) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  if (type) o.type = type; else o.setPeriodicWave(pulse(ctx, wave));
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const hold = Math.max(0.02, dur - rel);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol * 0.8, t + Math.min(hold, 0.09));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
  o.connect(g).connect(out);
  if (vib && dur > 0.22) { // delayed vibrato on long notes
    const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(vib, t + Math.min(0.25, dur * 0.7));
    l.connect(lg).connect(o.detune); l.start(t); l.stop(t + dur + rel + 0.02);
  }
  o.start(t); o.stop(t + dur + rel + 0.03);
}
function nz(ctx, out, t, dur, { vol = 0.1, hp = 0, bp = 0, q = 1 }) {
  const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = noise(ctx); s.loop = true;
  let n = s; if (hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; n.connect(f); n = f; } if (bp) { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = bp; f.Q.value = q; n.connect(f); n = f; }
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(g).connect(out); s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.02);
}
const drum = {
  kick(ctx, out, t, v = 1) { tone(ctx, out, t, 140, 0.13, { type: 'sine', vol: 0.34 * v, attack: 0.001, rel: 0.02, slideTo: 42 }); },
  snare(ctx, out, t, v = 1) { nz(ctx, out, t, 0.12, { vol: 0.17 * v, bp: 1800, q: 0.7 }); tone(ctx, out, t, 210, 0.07, { type: 'triangle', vol: 0.1 * v, attack: 0.001, rel: 0.01, slideTo: 120 }); },
  hat(ctx, out, t, v = 1, open = false) { nz(ctx, out, t, open ? 0.14 : 0.035, { vol: 0.07 * v, hp: 7000 }); },
};

function parseLead(bars) {
  return bars.map((bar) => { let s = 0; const ev = []; bar.split(' ').forEach((tok) => { const [n, l] = tok.split('/'); const len = +l; if (n !== 'r') ev.push([s, n, len]); s += len; }); if (s !== 16) throw new Error('bar length ' + s + ' in ' + bar); return ev; });
}
for (const k in SONGS) { const S = SONGS[k]; S.leadEv = parseLead(S.lead); S.nbars = S.chords.length; }

// ---------------------------------------------------------------- sequencing
function scheduleStep(ctx, out, S, step, t, stepDur, layers) {
  const bar = Math.floor(step / 16) % S.nbars, s = step % 16;
  const [root, q] = CH[S.chords[bar]], tri = TRI[q];
  const last = bar === S.nbars - 1;
  const chordTone = (i, oct) => root + 12 * (oct + Math.floor(i / tri.length)) + tri[i % tri.length];
  // lead
  S.leadEv[bar].forEach(([st, n, len]) => { if (st === s) tone(ctx, out, t, hz(midi(n)), len * stepDur * 0.93, { wave: S.leadWave, vol: S.leadVol, vib: 14, rel: 0.04 }); });
  // arpeggio (quiet harmony)
  if (layers.arp) tone(ctx, out, t, hz(chordTone(S.arp[s], 2)), stepDur * 0.8, { wave: S.arpWave, vol: S.arpVol * (s % 4 === 0 ? 1.25 : 0.9), rel: 0.02 });
  // bass
  const bv = S.bassVol, b = (m, len = 1, v = 1) => tone(ctx, out, t, hz(m), stepDur * len * 0.9, { type: 'triangle', vol: bv * v, rel: 0.03, attack: 0.003 });
  if (S.bass === 'pad') { if (s === 0) b(root, 6, 1); if (s === 8) b(root + 7, 4, 0.8); if (s === 12) b(root + 12, 3, 0.7); }
  else if (S.bass === 'drive') { if (s % 2 === 0) b(root + ([6, 14].includes(s) ? 12 : 0), 1.6, s % 8 === 0 ? 1.1 : 0.9); }
  else if (S.bass === 'gallop') { if ([0, 1, 3, 4, 6, 8, 9, 11, 12, 14].includes(s)) b(root + ([3, 11].includes(s) ? 12 : 0), 0.9, s === 0 || s === 8 ? 1.15 : 0.9); }
  // drums
  if (layers.drums) {
    const fill = S.fillEvery && last && (bar % 1 === 0) && s >= 12;
    if (S.drums === 'soft') { if (s === 0 || s === 8) drum.kick(ctx, out, t, 0.7); if (s === 4 || s === 12) drum.snare(ctx, out, t, 0.45); if (s % 2 === 0) drum.hat(ctx, out, t, s % 4 === 0 ? 0.8 : 0.5); if (last && s >= 14) drum.snare(ctx, out, t, 0.35); }
    else if (S.drums === 'rock') {
      if ([0, 6, 10].includes(s)) drum.kick(ctx, out, t, 1); if (s === 4 || s === 12) drum.snare(ctx, out, t, 1);
      if (s % 2 === 0) drum.hat(ctx, out, t, s % 4 === 0 ? 1 : 0.6, s === 14); if (fill && s % 1 === 0 && s >= 12) drum.snare(ctx, out, t, 0.6 + (s - 12) * 0.12);
    } else {
      if ([0, 3, 8, 10].includes(s)) drum.kick(ctx, out, t, 1); if (s === 4 || s === 12 || (s === 14 && bar % 2)) drum.snare(ctx, out, t, 1);
      drum.hat(ctx, out, t, s % 4 === 0 ? 0.9 : s % 2 ? 0.35 : 0.55, false); if (fill && s >= 12) drum.snare(ctx, out, t, 0.6 + (s - 12) * 0.12);
    }
  }
}

// Offline render (tests / tools): returns an AudioBuffer of `seconds` of the song
export async function renderOffline(name, seconds = 12, sr = 44100) {
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr), S = SONGS[name], sd = 60 / S.bpm / 4;
  const out = ctx.createGain(); out.gain.value = 0.5; out.connect(ctx.destination);
  for (let i = 0, t = 0; t < seconds; i++) { scheduleStep(ctx, out, S, i, t + (i % 2 ? S.swing * sd : 0), sd, { arp: true, drums: true }); t += sd; }
  return ctx.startRendering();
}

// ---------------------------------------------------------------- engine (runtime)
const store = {
  load() { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return { vol: typeof v.vol === 'number' ? Math.min(1, Math.max(0, v.vol)) : 0.6, mute: !!v.mute }; } catch { return { vol: 0.6, mute: false }; } },
  save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } },
};
let ctx = null, master = null, duckF = null, tracks = [], timer = null, want = null, wantOpts = {}, duckOn = false;
const st = store.load();
const LISTEN = ['pointerdown', 'keydown', 'touchend'];
const level = () => (st.mute ? 0 : st.vol * st.vol * 0.9); // squared taper feels linear to the ear

function ensureCtx() {
  if (ctx) return true;
  sfx.unlock(); ctx = sfx.getCtx();
  if (!ctx) return false;
  duckF = ctx.createBiquadFilter(); duckF.type = 'lowpass'; duckF.frequency.value = 22000; duckF.Q.value = 0.5;
  master = ctx.createGain(); master.gain.value = level();
  duckF.connect(master).connect(ctx.destination);
  return true;
}
function startTrack(name, fade) {
  const S = SONGS[name], now = ctx.currentTime;
  const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, now); out.gain.linearRampToValueAtTime(1, now + fade); out.connect(duckF);
  const tr = { name, S, out, step: 0, next: now + 0.06, sd: 60 / S.bpm / 4, dying: false, killAt: 0 };
  tracks.push(tr);
  if (!timer) timer = setInterval(tick, 25);
  return tr;
}
function tick() {
  if (!ctx) return;
  if (ctx.state !== 'running') return;
  const horizon = ctx.currentTime + 0.14;
  for (let i = tracks.length - 1; i >= 0; i--) {
    const tr = tracks[i];
    if (tr.dying && ctx.currentTime > tr.killAt) { try { tr.out.disconnect(); } catch { /* */ } tracks.splice(i, 1); continue; }
    let guard = 0;
    while (tr.next < horizon && guard++ < 8) {
      const t = tr.next + (tr.step % 2 ? tr.S.swing * tr.sd : 0);
      scheduleStep(ctx, tr.out, tr.S, tr.step, t, tr.sd, { arp: true, drums: true });
      tr.step++; tr.next += tr.sd;
    }
    if (tr.next < ctx.currentTime - 0.5) tr.next = ctx.currentTime + 0.05; // recover after a long stall
  }
  if (!tracks.length && timer) { clearInterval(timer); timer = null; }
}
function apply(name, { fade = 1.4 } = {}) {
  if (!ensureCtx()) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const cur = tracks.find((t) => !t.dying);
  if (cur && cur.name === name) return;
  const now = ctx.currentTime;
  tracks.forEach((t) => { if (!t.dying) { t.dying = true; t.killAt = now + fade + 0.1; t.out.gain.cancelScheduledValues(now); t.out.gain.setValueAtTime(Math.max(0.0001, t.out.gain.value), now); t.out.gain.linearRampToValueAtTime(0.0001, now + fade); } });
  startTrack(name, fade);
}
function onGesture() {
  LISTEN.forEach((e) => window.removeEventListener(e, onGesture, true));
  if (!ensureCtx()) return;
  ctx.resume().then(() => { if (want) apply(want, { fade: 0.6, ...wantOpts }); }).catch(() => { if (want) apply(want, wantOpts); });
}
LISTEN.forEach((e) => window.addEventListener(e, onGesture, { capture: true, passive: true }));
document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {}); });

export const music = {
  /** request a track; plays immediately if the audio context is already unlocked, otherwise on the first interaction */
  play(name, opts = {}) { if (!SONGS[name]) return; want = name; wantOpts = opts; if (ctx && ctx.state !== 'closed') apply(name, opts); },
  /** short stinger over the music: win or lose */
  stinger(win) {
    if (!ensureCtx() || st.mute) return; const t = ctx.currentTime + 0.02, notes = win ? ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'] : ['E5', 'D#5', 'D5', 'A4', 'F4'];
    notes.forEach((n, i) => tone(ctx, master, t + i * (win ? 0.09 : 0.16), hz(midi(n)), win ? 0.16 : 0.3, { wave: 0.25, vol: 0.14, rel: 0.08 }));
  },
  duck(on) {
    duckOn = on; if (!ctx || !master) return; const t = ctx.currentTime;
    duckF.frequency.cancelScheduledValues(t); duckF.frequency.setTargetAtTime(on ? 700 : 22000, t, on ? 0.08 : 0.2);
    master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(level() * (on ? 0.55 : 1), t, 0.1);
  },
  setVolume(v) { st.vol = Math.min(1, Math.max(0, v)); if (st.vol > 0 && st.mute) st.mute = false; store.save(st); this._apply(); },
  setMuted(m) { st.mute = !!m; store.save(st); this._apply(); },
  toggleMute() { this.setMuted(!st.mute); return st.mute; },
  _apply() { if (master) { const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(level() * (duckOn ? 0.55 : 1), t, 0.05); } },
  get volume() { return st.vol; }, get muted() { return st.mute; },
  state() { return { want, playing: tracks.filter((t) => !t.dying).map((t) => t.name), tracks: tracks.length, ctx: ctx?.state || 'none', vol: st.vol, mute: st.mute, gain: master?.gain.value ?? null }; },
};
if (typeof window !== 'undefined') window.__music = music;

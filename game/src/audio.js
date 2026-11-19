// All sound is synthesized with WebAudio — no audio files. Engine hum, sirens,
// gunshots, UI blips and a low-key procedural groove, all generated in code.
// Everything is guarded: if audio cannot start, the game simply plays silent.

const MUSIC_BASS = [55.0, 55.0, 65.41, 49.0, 55.0, 55.0, 73.42, 65.41]; // A1 A1 C2 G1 A1 A1 D2 C2
const MUSIC_CHORDS = [[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [196.0, 246.94, 293.66], [220.0, 261.63, 329.63]];

export function createAudio() {
  return {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    engineFilter: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
    sirenHigh: false,
    musicTimer: null,
    musicStep: 0,
    nextNoteTime: 0,
  };
}

export function unlockAudio(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = audio.muted ? 0 : 0.6;
    audio.master.connect(audio.ctx.destination);
    startMusic(audio);
  } catch (e) {
    audio.ctx = null;
  }
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master && audio.ctx) audio.master.gain.setValueAtTime(muted ? 0 : 0.6, audio.ctx.currentTime);
}

function tone(audio, freq, dur, type, vol, when, slideTo) {
  if (!audio.ctx) return;
  const t = when || audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noiseBurst(audio, dur, vol, filterFreq) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime;
  const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
  const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq || 1200;
  const gain = audio.ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  src.start(t);
}

export function playShot(audio, big) {
  noiseBurst(audio, big ? 0.22 : 0.12, big ? 0.5 : 0.32, big ? 900 : 1600);
  tone(audio, big ? 120 : 180, 0.09, 'square', 0.12, 0, 60);
}
export function playHit(audio) { tone(audio, 220, 0.08, 'triangle', 0.2, 0, 110); }
export function playPickup(audio) { tone(audio, 660, 0.09, 'sine', 0.22); tone(audio, 990, 0.14, 'sine', 0.22, audio.ctx ? audio.ctx.currentTime + 0.08 : 0); }
export function playCash(audio) { tone(audio, 880, 0.1, 'sine', 0.2); tone(audio, 1174, 0.16, 'sine', 0.2, audio.ctx ? audio.ctx.currentTime + 0.09 : 0); }
export function playClick(audio) { tone(audio, 700, 0.05, 'square', 0.08); }
export function playCrash(audio) { noiseBurst(audio, 0.25, 0.4, 500); tone(audio, 90, 0.2, 'sawtooth', 0.18, 0, 40); }
export function playHonk(audio) { tone(audio, 370, 0.16, 'square', 0.12); tone(audio, 466, 0.16, 'square', 0.1); }
export function playScreech(audio) { noiseBurst(audio, 0.3, 0.12, 3200); }
export function playExplosion(audio) { noiseBurst(audio, 0.7, 0.6, 300); tone(audio, 60, 0.6, 'sine', 0.5, 0, 30); }
export function playBusted(audio) { tone(audio, 392, 0.2, 'square', 0.16); tone(audio, 311, 0.3, 'square', 0.16, audio.ctx ? audio.ctx.currentTime + 0.2 : 0); }
export function playMissionPass(audio) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(audio, f, 0.22, 'triangle', 0.2, t + i * 0.11));
}
export function playMissionFail(audio) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime;
  [392, 349.23, 311.13, 261.63].forEach((f, i) => tone(audio, f, 0.25, 'triangle', 0.18, t + i * 0.14));
}

// Continuous engine hum: pitch and loudness follow the player's speed.
export function setEngine(audio, speed01, running) {
  if (!audio.ctx) return;
  if (!running || speed01 < 0.02) {
    if (audio.engineGain) audio.engineGain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.1);
    return;
  }
  if (!audio.engineOsc) {
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineFilter = audio.ctx.createBiquadFilter();
    audio.engineFilter.type = 'lowpass';
    audio.engineFilter.frequency.value = 400;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(audio.engineFilter);
    audio.engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
  }
  const t = audio.ctx.currentTime;
  audio.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
  audio.engineFilter.frequency.setTargetAtTime(300 + speed01 * 900, t, 0.08);
  audio.engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.05, t, 0.08);
}

// Two-tone police siren while any police car is near.
export function setSiren(audio, on) {
  if (!audio.ctx) return;
  if (!on) {
    if (audio.sirenGain) audio.sirenGain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.15);
    return;
  }
  if (!audio.sirenOsc) {
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = 'triangle';
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
  }
  const t = audio.ctx.currentTime;
  audio.sirenGain.gain.setTargetAtTime(0.045, t, 0.1);
  audio.sirenTimer += 1;
  if (audio.sirenTimer % 24 === 0) {
    audio.sirenHigh = !audio.sirenHigh;
    audio.sirenOsc.frequency.setTargetAtTime(audio.sirenHigh ? 920 : 680, t, 0.05);
  }
}

// A lazy bass-and-pad loop, scheduled a bar ahead so it never stutters.
function startMusic(audio) {
  if (audio.musicTimer) return;
  audio.nextNoteTime = audio.ctx.currentTime + 0.1;
  audio.musicTimer = setInterval(() => {
    if (!audio.ctx || audio.muted) return;
    const stepDur = 0.32;
    while (audio.nextNoteTime < audio.ctx.currentTime + 0.4) {
      const step = audio.musicStep;
      const bar = Math.floor(step / 8) % 4;
      if (step % 2 === 0) {
        const bass = MUSIC_BASS[step % 8];
        tone(audio, bass, 0.3, 'triangle', 0.10, audio.nextNoteTime);
      }
      if (step % 8 === 0) {
        MUSIC_CHORDS[bar].forEach((f) => tone(audio, f, 2.4, 'sine', 0.028, audio.nextNoteTime));
      }
      if (step % 4 === 2) noiseBurstAt(audio, audio.nextNoteTime, 0.03, 0.05, 6000);
      audio.nextNoteTime += stepDur;
      audio.musicStep += 1;
    }
  }, 120);
}

function noiseBurstAt(audio, when, dur, vol, filterFreq) {
  if (!audio.ctx) return;
  const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
  const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = filterFreq || 5000;
  const gain = audio.ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  src.start(when);
}

// audio.js — tiny WebAudio synth for the press-room sounds. No assets;
// everything is oscillator envelopes. This is pure juice, so it's a
// patchwork layer: every public entry point swallows failures and the
// game simply plays silent.

const Sfx = {

  muted: false,
  ctx: null,

  // Lazily create/resume the AudioContext — must happen inside a user
  // gesture, and all Sfx calls originate from click/keydown handlers.
  _ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  // One enveloped oscillator note.
  _note(freq, dur, type = 'square', gain = 0.045, delay = 0) {
    const ctx = this._ensure();
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  },

  _play(fn) {
    if (this.muted) return;
    try { fn(); } catch (e) { /* juice only — never let audio break play */ }
  },

  // --- The vocabulary ----------------------------------------------------

  click() { this._play(() => this._note(880, 0.05, 'triangle', 0.03)); },

  // Rising metallic tick per slug in the scoring sweep.
  letter(i) { this._play(() => this._note(420 + i * 70, 0.09, 'square', 0.04)); },

  mult() { this._play(() => this._note(150, 0.22, 'sawtooth', 0.06)); },

  total() {
    this._play(() => {
      this._note(523, 0.14, 'triangle', 0.05);
      this._note(784, 0.22, 'triangle', 0.05, 0.09);
    });
  },

  invalid() { this._play(() => this._note(110, 0.18, 'sawtooth', 0.05)); },

  // A retrigger — bright doubled blip, like the press stamping twice.
  copy() {
    this._play(() => {
      this._note(990, 0.07, 'square', 0.05);
      this._note(990, 0.07, 'square', 0.05, 0.09);
    });
  },

  reroll() {
    this._play(() => {
      this._note(300, 0.07, 'square', 0.04);
      this._note(250, 0.07, 'square', 0.04, 0.07);
      this._note(350, 0.09, 'square', 0.04, 0.14);
    });
  },

  buy() {
    this._play(() => {
      this._note(659, 0.1, 'triangle', 0.05);
      this._note(988, 0.16, 'triangle', 0.05, 0.08);
    });
  },

  win() {
    this._play(() => {
      [523, 659, 784, 1047].forEach((f, i) => this._note(f, 0.22, 'triangle', 0.05, i * 0.11));
    });
  },

  // A Book unlocking — little ascending library bell.
  unlock() {
    this._play(() => {
      [660, 880, 1320].forEach((f, i) => this._note(f, 0.3, 'sine', 0.06, i * 0.13));
    });
  },

  lose() {
    this._play(() => {
      [220, 185, 147].forEach((f, i) => this._note(f, 0.3, 'sawtooth', 0.05, i * 0.16));
    });
  },
};

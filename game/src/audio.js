// Aurora Courier — all sound is synthesised with WebAudio. No audio files.
// Engine hum follows the throttle, wind follows speed, and ring / landing /
// crash events are short synth stingers. Audio starts on the first gesture.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.windGain = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // Engine: two detuned saws through a low-pass, gain by throttle.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 55.7;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter);
    osc2.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
    osc2.start();
    // Wind: looped noise buffer through a band-pass, gain by speed.
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 700;
    band.Q.value = 0.6;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    noise.connect(band);
    band.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    noise.start();
  }

  setFlight(throttle, speed01, flying) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const eng = flying ? 0.02 + throttle * 0.05 : 0;
    this.engineGain.gain.setTargetAtTime(eng, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(52 + throttle * 46, t, 0.15);
    this.windGain.gain.setTargetAtTime(flying ? speed01 * 0.05 : 0, t, 0.2);
  }

  blip(freq, dur, type, vol, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  ring() {
    this.blip(880, 0.35, 'sine', 0.16);
    this.blip(1318, 0.4, 'sine', 0.12, 0.07);
  }

  land() {
    [523, 659, 784, 1046].forEach((f, i) => this.blip(f, 0.5, 'triangle', 0.14, i * 0.09));
  }

  crash() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.5);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.3;
    src.connect(g);
    g.connect(this.ctx.destination);
    src.start(t);
    this.blip(70, 0.5, 'sine', 0.25);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) {
      const t = this.ctx.currentTime;
      if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, t, 0.05);
      if (this.windGain) this.windGain.gain.setTargetAtTime(0, t, 0.05);
    }
    return this.muted;
  }
}

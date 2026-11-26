// Aurora Courier — game loop and state wiring: title, briefing, flight,
// pause, landing and crash, plus the ?shot= presets used for screenshots.

import { CONFIG, MISSIONS } from './config.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Plane } from './physics.js';
import { Campaign } from './missions.js';
import { Renderer } from './render.js';
import { applyShot } from './shots.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.input = new Input(canvas);
    this.sound = new SoundBank();
    this.renderer = new Renderer(canvas);
    this.campaign = new Campaign();
    this.world = null;
    this.plane = null;
    this.last = performance.now();
    this.loadMission(0);
    window.addEventListener('resize', () => this.renderer.resize());
    canvas.addEventListener('mousedown', () => this.onConfirm());
    canvas.addEventListener('touchstart', () => this.onConfirm(), { passive: true });
  }

  loadMission(index) {
    const mission = MISSIONS[index];
    // Seed per mission so each sortie has its own island layout.
    this.world = new World(mission, 1337 + index * 7919);
    this.plane = new Plane(this.world, mission);
    // Clouds drift with time.
    this.world.clouds.forEach((c) => { c.x0 = c.x; });
  }

  onConfirm() {
    this.sound.ensure();
    const s = this.campaign.state;
    if (s === 'title') this.campaign.startBriefing();
    else if (s === 'briefing') this.campaign.beginFlight();
    else if (s === 'landed') this.advance();
    else if (s === 'done') this.campaign.restartCampaign();
  }

  advance() {
    if (this.campaign.isLastMission) {
      this.campaign.nextMission(); // -> 'done'
      return;
    }
    this.campaign.nextMission();
    this.loadMission(this.campaign.missionIndex);
  }

  retry() {
    this.loadMission(this.campaign.missionIndex);
    this.campaign.restartMission();
  }

  step(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const input = this.input;
    const campaign = this.campaign;

    if (input.consume('enter') || input.consume(' ')) this.onConfirm();
    if (input.consume('p') || input.consume('escape')) {
      if (campaign.state === 'flying') campaign.pause();
      else if (campaign.state === 'paused') campaign.resume();
    }
    if (input.consume('m')) {
      this.sound.ensure();
      const muted = this.sound.toggleMute();
      campaign.flash(muted ? 'SOUND OFF' : 'SOUND ON', 1.2);
    }
    if (input.consume('r') && (campaign.state === 'crashed' || campaign.state === 'done')) {
      if (campaign.state === 'done') {
        campaign.restartCampaign();
        this.loadMission(0);
      } else {
        this.retry();
      }
    }

    campaign.tick(dt);
    if (campaign.state === 'flying') {
      const ctrl = input.controls();
      this.plane.update(dt, ctrl);
      this.sound.setFlight(this.plane.throttle, this.plane.speed / CONFIG.maxSpeed, true);
      if (this.plane.ringJustPassed) {
        this.plane.ringJustPassed = false;
        this.sound.ring();
      }
      if (this.plane.landed) {
        this.sound.land();
        campaign.onLanded(this.plane);
      } else if (this.plane.crashed) {
        this.sound.crash();
        campaign.onCrashed(this.plane);
      }
    } else {
      this.sound.setFlight(0, 0, false);
    }
    // Clouds always drift so the title screen feels alive.
    for (const c of this.world.clouds) {
      c.x += c.drift * dt;
      if (c.x > 1300) c.x = -1300;
    }
    this.renderer.render(this);
    input.endFrame();
  }

  run() {
    const loop = (now) => {
      this.step(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

// Boot: apply a ?shot= preset (for screenshots) before the loop starts.
const canvas = document.getElementById('game');
const game = new Game(canvas);
const params = new URLSearchParams(window.location.search);
if (params.has('shot')) {
  applyShot(game, params.get('shot'), Number(params.get('seed') || '1'));
}
game.run();

// Expose a tiny handle for headless playtests.
window.__aurora = game;

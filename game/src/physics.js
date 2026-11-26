// Aurora Courier — flight physics: throttle, pitch, bank, heading, fuel,
// ring passes, storm damage, terrain collision and runway landings.

import { CONFIG } from './config.js';
import { RUNWAY } from './world.js';
import { clamp, degToRad, wrapAngle } from './random.js';

export class Plane {
  constructor(world, mission) {
    this.world = world;
    this.mission = mission;
    this.reset();
  }

  reset() {
    this.x = RUNWAY.cx - RUNWAY.length / 2 + 30;
    this.z = RUNWAY.cz;
    this.y = this.world.heightAt(this.x, this.z) + 2;
    this.heading = 90;
    this.pitch = 0; // deg, positive = nose up
    this.roll = 0; // deg, positive = bank right
    this.speed = 0;
    this.throttle = 0.55;
    this.fuel = this.mission.fuel;
    this.damage = 0;
    this.verticalSpeed = 0;
    this.onGround = true;
    this.landed = false;
    this.crashed = false;
    this.crashReason = '';
    this.ringsDone = 0;
    this.score = 0;
    this.time = 0;
    this.prevRingSide = 0;
    this.ringFlash = 0;
    this.ringJustPassed = false;
    this.stormWarning = false;
  }

  update(dt, ctrl) {
    if (this.crashed || this.landed) return;
    this.time += dt;

    // Throttle: Shift / Ctrl nudge, W/S in input map to pitch; throttle
    // also eases toward the pointer's vertical offset when flying by mouse.
    this.throttle = clamp(this.throttle + ctrl.throttle * dt * 0.5, 0, 1);
    const targetSpeed = CONFIG.minSpeed + this.throttle * (CONFIG.maxSpeed - CONFIG.minSpeed);
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 0.55);
    this.speed -= this.speed * CONFIG.drag * dt * 0.25;

    // Pitch and roll ease toward the commanded values.
    const targetPitch = ctrl.pitch * 22;
    const targetRoll = ctrl.roll * 55;
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 2.2);
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 3.0);

    // Bank turns the heading; pitch trades speed for altitude.
    this.heading = (this.heading + this.roll * (CONFIG.turnRate / 55) * dt + 360) % 360;
    const hRad = degToRad(this.heading);
    const forwardX = Math.sin(hRad);
    const forwardZ = Math.cos(hRad);

    const stalled = this.speed < CONFIG.stallSpeed;
    const climb = stalled
      ? -CONFIG.gravitySink
      : Math.sin(degToRad(this.pitch)) * this.speed * CONFIG.climbFactor;
    this.verticalSpeed = climb;

    // Takeoff: once fast enough the wheels leave the ground.
    if (this.onGround && this.speed > CONFIG.stallSpeed + 6 && this.pitch > 4) {
      this.onGround = false;
    }
    if (!this.onGround) {
      this.x += forwardX * this.speed * dt;
      this.z += forwardZ * this.speed * dt;
      this.y += climb * dt;
      // World edge: turn the plane back gently instead of ending the game.
      if (Math.abs(this.x) > 1150 || Math.abs(this.z) > 1150) {
        this.heading = (this.heading + 180 + 360) % 360;
        this.x = clamp(this.x, -1150, 1150);
        this.z = clamp(this.z, -1150, 1150);
      }
    } else {
      // Rolling on the runway: accelerate along the strip.
      this.x += forwardX * this.speed * dt;
      this.z += forwardZ * this.speed * dt;
      this.y = this.world.heightAt(this.x, this.z) + 2;
      if (!this.world.onRunway(this.x, this.z) && this.speed > 12) {
        // Ran off the strip while slow: rough ground stops the plane.
        this.speed = Math.max(0, this.speed - 30 * dt);
        if (this.speed < 4) this.crash('Ran off the runway');
      }
    }

    // Fuel burn; empty tanks mean a glide to whatever is below.
    this.fuel -= this.throttle * CONFIG.fuelBurn * dt;
    if (this.fuel <= 0) {
      this.fuel = 0;
      this.throttle = 0;
      if (this.onGround) this.crash('Out of fuel on the ground');
    }

    // Storms: turbulence and damage inside a cell.
    const storm = this.world.inStorm(this.x, this.y, this.z);
    this.stormWarning = !!storm;
    if (storm) {
      this.damage += 9 * dt;
      this.roll += (Math.random() - 0.5) * 22 * dt;
      this.pitch += (Math.random() - 0.5) * 10 * dt;
      if (this.damage >= 100) this.crash('Torn apart in the storm');
    }

    this.checkRings();
    this.checkGround();
    if (this.ringFlash > 0) this.ringFlash = Math.max(0, this.ringFlash - dt * 0.8);
  }

  checkRings() {
    const rings = this.world.rings;
    if (this.ringsDone >= rings.length) return;
    const ring = rings[this.ringsDone];
    // Side of the ring plane flips as the plane crosses it.
    const side = (this.x - ring.x) * ring.nx + (this.z - ring.z) * ring.nz;
    if (this.prevRingSide !== 0 && Math.sign(side) !== Math.sign(this.prevRingSide)) {
      const dx = this.x - ring.x, dy = this.y - ring.y, dz = this.z - ring.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < ring.radius + 6) {
        ring.done = true;
        this.ringsDone++;
        this.score += CONFIG.ringScore;
        this.fuel = Math.min(100, this.fuel + CONFIG.fuelRingBonus);
        this.ringFlash = 1;
        this.ringJustPassed = true;
      }
    }
    this.prevRingSide = side;
  }

  checkGround() {
    if (this.landed || this.crashed) return;
    const ground = this.world.heightAt(this.x, this.z);
    const clearance = this.y - ground;
    if (clearance <= 1.2) {
      const onStrip = this.world.onRunway(this.x, this.z);
      const gentle = this.verticalSpeed > -6 && Math.abs(this.roll) < 25;
      const allRings = this.ringsDone >= this.world.rings.length;
      if (onStrip && this.speed < 58 && gentle && !this.onGround) {
        this.landed = true;
        this.y = ground + 2;
        this.speed = Math.max(0, this.speed - 20);
        this.score += CONFIG.landingScore + Math.round(this.fuel * 3);
        if (allRings) this.score += 250;
      } else if (!this.onGround) {
        this.crash(onStrip ? 'Landed too fast — overshot the strip' : 'Flew into the ground');
      }
    }
    if (this.y < CONFIG.waterLevel - 2) this.crash('Ditched in the lake');
    if (this.damage >= 100) this.crash('Airframe failure');
  }

  crash(reason) {
    if (this.crashed) return;
    this.crashed = true;
    this.crashReason = reason;
  }
}

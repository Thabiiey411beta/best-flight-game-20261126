// Aurora Courier — the island world: terrain heightfield, runway, ring
// course, storm cells, trees and clouds, all generated from a mission seed.

import { CONFIG, PALETTES } from './config.js';
import { clamp, lerp, makeNoise, mulberry32 } from './random.js';

const HALF = CONFIG.worldSize / 2;
const STEP = CONFIG.gridStep;
const N = Math.floor(CONFIG.worldSize / STEP); // grid cells per side (60)

// Runway: a flat strip on the south-west flats, heading east (090).
export const RUNWAY = {
  cx: -620, cz: 480, length: 420, width: 34, heading: 90,
};

export class World {
  constructor(mission, seed) {
    this.mission = mission;
    this.seed = seed;
    this.noise = makeNoise(seed);
    this.rand = mulberry32(seed ^ 0x9e3779b9);
    this.heights = new Float32Array((N + 1) * (N + 1));
    this.buildTerrain();
    this.rings = this.buildRings();
    this.storms = this.buildStorms();
    this.trees = this.buildTrees();
    this.clouds = this.buildClouds();
  }

  heightAt(x, z) {
    // Bilinear sample of the heightfield; outside the island, fade to sea.
    const gx = clamp((x + HALF) / STEP, 0, N - 0.001);
    const gz = clamp((z + HALF) / STEP, 0, N - 0.001);
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const fx = gx - ix, fz = gz - iz;
    const h = (a, b) => this.heights[b * (N + 1) + a];
    const top = lerp(h(ix, iz), h(ix + 1, iz), fx);
    const bot = lerp(h(ix, iz + 1), h(ix + 1, iz + 1), fx);
    return lerp(top, bot, fz);
  }

  buildTerrain() {
    for (let iz = 0; iz <= N; iz++) {
      for (let ix = 0; ix <= N; ix++) {
        const x = ix * STEP - HALF;
        const z = iz * STEP - HALF;
        // Island falloff: high in the north-east, sea at the edges.
        const dx = x / HALF, dz = z / HALF;
        const edge = Math.max(0, Math.sqrt(dx * dx + dz * dz) - 0.72) * 3.2;
        let h = this.noise(x * 0.0016, z * 0.0016) * 46
          + this.noise(x * 0.004 + 40, z * 0.004 + 40) * 14
          + 26;
        // A ridge line across the north for the Ridge Runner sortie.
        h += Math.max(0, 1 - Math.abs(z + 620) / 260) * 34;
        h -= edge * 42;
        // Flatten the runway patch so landings are fair.
        const rdx = Math.abs(x - RUNWAY.cx) / (RUNWAY.length / 2 + 90);
        const rdz = Math.abs(z - RUNWAY.cz) / (RUNWAY.width / 2 + 90);
        const flat = Math.max(0, 1 - Math.max(rdx, rdz));
        h = lerp(h, 8, flat * flat);
        this.heights[iz * (N + 1) + ix] = Math.max(h, 1.5);
      }
    }
  }

  buildRings() {
    const rand = this.rand;
    const count = this.mission.rings;
    const rings = [];
    // A winding course: start near the runway, sweep across the island.
    let x = RUNWAY.cx + 260, z = RUNWAY.cz - 60, y = 70;
    let heading = this.mission.startHeading;
    for (let i = 0; i < count; i++) {
      heading += (rand() - 0.5) * 110;
      const leg = 230 + rand() * 150;
      const rad = (heading * Math.PI) / 180;
      x = clamp(x + Math.sin(rad) * leg, -1050, 1050);
      z = clamp(z + Math.cos(rad) * leg, -1050, 1050);
      const ground = this.heightAt(x, z);
      y = clamp(ground + 55 + rand() * 55, 55, 175);
      rings.push({
        x, y, z,
        heading,
        radius: CONFIG.ringRadius,
        done: false,
        // Ring faces back along the course so the pilot flies through it.
        nx: -Math.sin(rad), nz: -Math.cos(rad),
      });
    }
    return rings;
  }

  buildStorms() {
    const storms = [];
    for (let i = 0; i < this.mission.storms; i++) {
      const x = (this.rand() - 0.5) * 1600;
      const z = (this.rand() - 0.5) * 1600;
      storms.push({ x, z, y: 110, radius: 90 + this.rand() * 50 });
    }
    return storms;
  }

  buildTrees() {
    const trees = [];
    for (let i = 0; i < 260; i++) {
      const x = (this.rand() - 0.5) * 2200;
      const z = (this.rand() - 0.5) * 2200;
      const h = this.heightAt(x, z);
      if (h < CONFIG.waterLevel + 1 || h > 95) continue;
      if (Math.abs(x - RUNWAY.cx) < 320 && Math.abs(z - RUNWAY.cz) < 120) continue;
      trees.push({ x, y: h, z, s: 6 + this.rand() * 7 });
    }
    return trees;
  }

  buildClouds() {
    const clouds = [];
    for (let i = 0; i < 26; i++) {
      clouds.push({
        x: (this.rand() - 0.5) * 2400,
        y: 210 + this.rand() * 90,
        z: (this.rand() - 0.5) * 2400,
        s: 60 + this.rand() * 110,
        drift: 2 + this.rand() * 3,
      });
    }
    return clouds;
  }

  terrainColor(h, slope) {
    const p = PALETTES[this.mission.palette];
    if (h < CONFIG.waterLevel + 0.5) return p.water;
    if (slope > 0.55) return p.rock;
    if (h > 105) return p.snow;
    const t = clamp((h - 8) / 90, 0, 1);
    return mixHex(p.grassLow, p.grassHigh, t);
  }

  inStorm(x, y, z) {
    for (const s of this.storms) {
      const dx = x - s.x, dz = z - s.z, dy = y - s.y;
      if (dx * dx + dz * dz < s.radius * s.radius && Math.abs(dy) < 70) return s;
    }
    return null;
  }

  onRunway(x, z) {
    const dx = x - RUNWAY.cx, dz = z - RUNWAY.cz;
    return Math.abs(dx) < RUNWAY.length / 2 && Math.abs(dz) < RUNWAY.width / 2;
  }
}

export function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${bl})`;
}

export { N, STEP, HALF };

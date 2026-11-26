// Aurora Courier — deterministic seeded random numbers and value noise.
// The island, rings, trees and clouds are all generated from one seed per
// mission, so every flight over the same sortie sees the same world.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise: hash the lattice corners, fade, bilinear blend.
export function makeNoise(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = base[i]; base[i] = base[j]; base[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];

  function hash(ix, iy) {
    return perm[(perm[ix & 255] + iy) & 255] / 255;
  }
  function fade(t) { return t * t * (3 - 2 * t); }

  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const a = hash(ix, iy), b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    const u = fade(fx), v = fade(fy);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
  }

  // Fractal sum of three octaves, roughly in [-1, 1].
  return function fbm(x, y) {
    return noise(x, y) * 0.55 + noise(x * 2.1 + 7.3, y * 2.1 + 3.1) * 0.3
      + noise(x * 4.3 + 13.7, y * 4.3 + 9.2) * 0.15;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function degToRad(d) { return (d * Math.PI) / 180; }
export function radToDeg(r) { return (r * 180) / Math.PI; }
export function wrapAngle(a) {
  while (a > 180) a -= 360;
  while (a < -180) a += 360;
  return a;
}

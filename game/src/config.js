// Aurora Courier — shared tuning constants and mission definitions.
// All values are in game units: metres, metres per second, degrees.

export const CONFIG = {
  worldSize: 2400, // terrain spans -1200..1200 on x and z
  gridStep: 40, // terrain sample spacing (m)
  waterLevel: 6, // terrain below this is lake / sea
  gravitySink: 6, // m/s lost when stalled
  stallSpeed: 28, // below this the plane sinks
  maxSpeed: 95,
  minSpeed: 18,
  throttleAccel: 14,
  drag: 0.25,
  pitchRate: 26, // deg/s at full input
  rollRate: 70,
  turnRate: 26, // deg/s of heading at full bank
  climbFactor: 0.55, // fraction of speed turned into climb at full pitch
  fuelBurn: 0.55, // per second at full throttle
  fuelRingBonus: 6,
  ringRadius: 22,
  ringScore: 250,
  landingScore: 500,
  viewDistance: 900,
  cameraBack: 16,
  cameraUp: 5.5,
};

// Three sorties, in order. Each is one flight: collect its rings in order,
// then put the plane down on the runway to finish.
export const MISSIONS = [
  {
    id: 'first-light',
    name: 'SORTIE 1 — FIRST LIGHT',
    brief: 'Dawn over Gull Island. Thread 6 rings, then land on Runway 09. Watch your fuel.',
    palette: 'dawn',
    rings: 6,
    fuel: 100,
    storms: 0,
    startHeading: 90,
  },
  {
    id: 'ridge-runner',
    name: 'SORTIE 2 — RIDGE RUNNER',
    brief: 'The ridge route: 8 rings through the high hills, with storm cells to dodge. Rings top up fuel.',
    palette: 'day',
    rings: 8,
    fuel: 100,
    storms: 3,
    startHeading: 40,
  },
  {
    id: 'aurora-night',
    name: 'SORTIE 3 — AURORA NIGHT',
    brief: 'Night run under the aurora. 10 rings, tight fuel, low cloud. Land clean and the route is yours.',
    palette: 'night',
    rings: 10,
    fuel: 90,
    storms: 2,
    startHeading: 130,
  },
];

export const PALETTES = {
  dawn: {
    skyTop: '#2e4a7a', skyMid: '#e8907c', skyLow: '#f7c98b',
    sun: '#ffd9a0', sunX: 0.72, sunY: 0.24,
    fog: 'rgba(247,201,139,0.35)',
    grassLow: '#5d8a4a', grassHigh: '#7fae5f', rock: '#8a7f72', snow: '#e8e4da',
    water: '#3f7fa8', runway: '#3a3f46', cloud: 'rgba(255,235,215,0.85)',
  },
  day: {
    skyTop: '#2f6fb8', skyMid: '#7fb8e8', skyLow: '#cfe8f7',
    sun: '#fff3c4', sunX: 0.24, sunY: 0.18,
    fog: 'rgba(207,232,247,0.30)',
    grassLow: '#4e7d3d', grassHigh: '#79a854', rock: '#7d7468', snow: '#f2f0ea',
    water: '#2f6f9e', runway: '#33383f', cloud: 'rgba(255,255,255,0.9)',
  },
  night: {
    skyTop: '#060a24', skyMid: '#12224e', skyLow: '#2c4a6e',
    sun: '#cfe8ff', sunX: 0.8, sunY: 0.2,
    fog: 'rgba(18,34,78,0.4)',
    grassLow: '#2c4a30', grassHigh: '#3f6242', rock: '#4a4650', snow: '#9aa0b0',
    water: '#16283e', runway: '#22262e', cloud: 'rgba(180,200,230,0.55)',
  },
};

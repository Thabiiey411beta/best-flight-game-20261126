// Aurora Courier — deterministic screenshot presets. ?shot=start shows the
// title over the island, ?shot=play drops the plane mid-course with the
// next ring ahead, ?shot=ring puts it on final through a ring, and
// ?shot=land parks it on final approach to Runway 09. Used by shots.json
// and by headless playtests; never by the game itself.

import { RUNWAY } from './world.js';

export function applyShot(game, shot, seed = 1) {
  const { plane, world, campaign } = game;
  if (shot === 'start') {
    campaign.state = 'title';
    plane.x = RUNWAY.cx + 500;
    plane.z = RUNWAY.cz - 350;
    plane.y = 130;
    plane.heading = 115;
    plane.speed = 55;
    plane.throttle = 0.6;
    plane.onGround = false;
    return;
  }
  if (shot === 'play') {
    campaign.state = 'flying';
    const ring = world.rings[1] || world.rings[0];
    // Place the plane behind the ring, looking at it, at cruise.
    const back = 260;
    plane.x = ring.x + ring.nx * back;
    plane.z = ring.z + ring.nz * back;
    plane.y = ring.y + 6;
    plane.heading = (ring.heading + 360) % 360;
    plane.speed = 62;
    plane.throttle = 0.7;
    plane.fuel = 78;
    plane.score = 500;
    plane.ringsDone = 1;
    plane.onGround = false;
    return;
  }
  if (shot === 'ring') {
    campaign.state = 'flying';
    const ring = world.rings[2] || world.rings[0];
    const back = 200; // far enough back that the ring is still ahead in the shot
    plane.x = ring.x + ring.nx * back;
    plane.z = ring.z + ring.nz * back;
    plane.y = ring.y + 2;
    plane.heading = (ring.heading + 360) % 360;
    plane.speed = 60;
    plane.throttle = 0.75;
    plane.fuel = 64;
    plane.score = 750;
    plane.ringsDone = 2;
    plane.onGround = false;
    return;
  }
  if (shot === 'land') {
    campaign.state = 'flying';
    plane.ringsDone = world.rings.length;
    world.rings.forEach((r) => { r.done = true; });
    plane.x = RUNWAY.cx - RUNWAY.length / 2 - 260;
    plane.z = RUNWAY.cz;
    plane.y = world.heightAt(plane.x, plane.z) + 42;
    plane.heading = 90;
    plane.pitch = -4;
    plane.speed = 52;
    plane.throttle = 0.35;
    plane.fuel = 41;
    plane.score = 2250;
    plane.onGround = false;
    return;
  }
  // Unknown shot: leave the title screen up.
  campaign.state = 'title';
}

// Aurora Courier — rendering: sky, projected 3D terrain, runway, rings,
// storms, clouds, the chase-view aircraft, and the full glass HUD.
// Everything is drawn on one canvas with plain 2D calls; no image assets.

import { CONFIG, PALETTES } from './config.js';
import { clamp, degToRad, lerp, wrapAngle } from './random.js';
import { N, STEP, HALF, RUNWAY } from './world.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0;
    this.h = 0;
    this.resize();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = this.canvas.clientWidth || window.innerWidth;
    this.h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Camera basis from the plane: chase position behind and above it.
  camera(plane) {
    const hRad = degToRad(plane.heading);
    const fx = Math.sin(hRad), fz = Math.cos(hRad);
    const pRad = degToRad(plane.pitch * 0.6);
    const fwd = {
      x: fx * Math.cos(pRad),
      y: Math.sin(pRad),
      z: fz * Math.cos(pRad),
    };
    const right = { x: fz, y: 0, z: -fx };
    // Up is fwd x right, so it points skyward (positive y) at level flight.
    const up = {
      x: fwd.y * right.z - fwd.z * right.y,
      y: fwd.z * right.x - fwd.x * right.z,
      z: fwd.x * right.y - fwd.y * right.x,
    };
    const cam = {
      x: plane.x - fwd.x * CONFIG.cameraBack,
      y: plane.y - fwd.y * CONFIG.cameraBack + CONFIG.cameraUp,
      z: plane.z - fwd.z * CONFIG.cameraBack,
    };
    return { cam, fwd, right, up };
  }

  project(p, basis) {
    const dx = p.x - basis.cam.x, dy = p.y - basis.cam.y, dz = p.z - basis.cam.z;
    const x = dx * basis.right.x + dy * basis.right.y + dz * basis.right.z;
    const y = dx * basis.up.x + dy * basis.up.y + dz * basis.up.z;
    const z = dx * basis.fwd.x + dy * basis.fwd.y + dz * basis.fwd.z;
    if (z < 2) return null;
    const f = this.h * 0.95;
    return {
      x: this.w / 2 + (x * f) / z,
      y: this.h * 0.52 - (y * f) / z,
      z,
      scale: f / z,
    };
  }

  render(game) {
    const { plane, world, campaign } = game;
    const pal = PALETTES[world.mission.palette];
    const ctx = this.ctx;
    const basis = this.camera(plane);
    this.drawSky(ctx, pal, plane);
    this.drawTerrain(ctx, world, pal, basis);
    this.drawRunway(ctx, world, pal, basis);
    this.drawTrees(ctx, world, basis);
    this.drawClouds(ctx, world, basis);
    this.drawRings(ctx, world, basis, plane);
    this.drawStorms(ctx, world, basis);
    this.drawAircraft(ctx, plane);
    this.drawHud(ctx, game, pal);
    if (campaign.state === 'title') this.drawTitle(ctx, game);
    if (campaign.state === 'briefing') this.drawBriefing(ctx, game);
    if (campaign.state === 'paused') this.drawPaused(ctx);
    if (campaign.state === 'landed') this.drawLanded(ctx, game);
    if (campaign.state === 'crashed') this.drawCrashed(ctx, game);
    if (campaign.state === 'done') this.drawDone(ctx, game);
    if (campaign.messageTimer > 0) this.drawFlash(ctx, campaign.message);
  }

  drawSky(ctx, pal, plane) {
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, pal.skyTop);
    g.addColorStop(0.45, pal.skyMid);
    g.addColorStop(0.75, pal.skyLow);
    g.addColorStop(1, pal.skyLow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    // Sun / moon glow.
    const sx = pal.sunX * this.w, sy = pal.sunY * this.h;
    const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 130);
    glow.addColorStop(0, pal.sun);
    glow.addColorStop(0.25, pal.sun + '55');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 140, sy - 140, 280, 280);
    ctx.fillStyle = pal.sun;
    ctx.beginPath();
    ctx.arc(sx, sy, 22, 0, Math.PI * 2);
    ctx.fill();
    // Stars at night.
    if (pal === PALETTES.night) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 70; i++) {
        const x = ((i * 173.3) % 100) / 100 * this.w;
        const y = ((i * 97.7) % 42) / 100 * this.h;
        ctx.fillRect(x, y, 1.6, 1.6);
      }
    }
    // Aurora ribbons on the night sortie.
    if (pal === PALETTES.night) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#59e6a2';
      ctx.lineWidth = 26;
      ctx.beginPath();
      for (let x = 0; x <= this.w; x += 24) {
        const y = this.h * 0.16 + Math.sin(x * 0.008 + 1.2) * 22;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = '#7fb8ff';
      ctx.lineWidth = 14;
      ctx.beginPath();
      for (let x = 0; x <= this.w; x += 24) {
        const y = this.h * 0.1 + Math.sin(x * 0.006 + 4) * 16;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  drawTerrain(ctx, world, pal, basis) {
    const heights = world.heights;
    const quads = [];
    const px = basis.cam.x, pz = basis.cam.z;
    const view = CONFIG.viewDistance;
    const i0 = clamp(Math.floor((px - view + HALF) / STEP), 0, N - 1);
    const i1 = clamp(Math.ceil((px + view + HALF) / STEP), 0, N - 1);
    const j0 = clamp(Math.floor((pz - view + HALF) / STEP), 0, N - 1);
    const j1 = clamp(Math.ceil((pz + view + HALF) / STEP), 0, N - 1);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x0 = i * STEP - HALF, z0 = j * STEP - HALF;
        const cx = x0 + STEP / 2, cz = z0 + STEP / 2;
        const dx = cx - px, dz = cz - pz;
        const dist2 = dx * dx + dz * dz;
        if (dist2 > view * view) continue;
        const h00 = heights[j * (N + 1) + i];
        const h10 = heights[j * (N + 1) + i + 1];
        const h01 = heights[(j + 1) * (N + 1) + i];
        const h11 = heights[(j + 1) * (N + 1) + i + 1];
        const slope = Math.max(Math.abs(h10 - h00), Math.abs(h01 - h00)) / STEP;
        const avg = (h00 + h10 + h01 + h11) / 4;
        quads.push({ i, j, h00, h10, h01, h11, dist2, color: world.terrainColor(avg, slope) });
      }
    }
    quads.sort((a, b) => b.dist2 - a.dist2);
    for (const q of quads) {
      const x0 = q.i * STEP - HALF, z0 = q.j * STEP - HALF;
      const p00 = this.project({ x: x0, y: q.h00, z: z0 }, basis);
      const p10 = this.project({ x: x0 + STEP, y: q.h10, z: z0 }, basis);
      const p11 = this.project({ x: x0 + STEP, y: q.h11, z: z0 + STEP }, basis);
      const p01 = this.project({ x: x0, y: q.h01, z: z0 + STEP }, basis);
      if (!p00 || !p10 || !p11 || !p01) continue;
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y);
      ctx.lineTo(p10.x, p10.y);
      ctx.lineTo(p11.x, p11.y);
      ctx.lineTo(p01.x, p01.y);
      ctx.closePath();
      ctx.fill();
    }
    // Soft horizon haze where terrain meets sky.
    const haze = ctx.createLinearGradient(0, this.h * 0.38, 0, this.h * 0.55);
    haze.addColorStop(0, 'rgba(255,255,255,0)');
    haze.addColorStop(0.5, pal.fog);
    haze.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, this.h * 0.38, this.w, this.h * 0.17);
  }

  drawRunway(ctx, world, pal, basis) {
    const L = RUNWAY.length, W = RUNWAY.width;
    const corners = [
      { x: RUNWAY.cx - L / 2, y: world.heightAt(RUNWAY.cx - L / 2, RUNWAY.cz) + 0.6, z: RUNWAY.cz - W / 2 },
      { x: RUNWAY.cx + L / 2, y: world.heightAt(RUNWAY.cx + L / 2, RUNWAY.cz) + 0.6, z: RUNWAY.cz - W / 2 },
      { x: RUNWAY.cx + L / 2, y: world.heightAt(RUNWAY.cx + L / 2, RUNWAY.cz) + 0.6, z: RUNWAY.cz + W / 2 },
      { x: RUNWAY.cx - L / 2, y: world.heightAt(RUNWAY.cx - L / 2, RUNWAY.cz) + 0.6, z: RUNWAY.cz + W / 2 },
    ];
    const pts = corners.map((c) => this.project(c, basis));
    if (pts.some((p) => !p)) return;
    ctx.fillStyle = pal.runway;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
    // Centre dashes.
    ctx.fillStyle = '#f5f5f5';
    for (let d = -L / 2 + 20; d < L / 2 - 10; d += 46) {
      const a = this.project({ x: RUNWAY.cx + d, y: world.heightAt(RUNWAY.cx + d, RUNWAY.cz) + 0.8, z: RUNWAY.cz - 2 }, basis);
      const b = this.project({ x: RUNWAY.cx + d + 22, y: world.heightAt(RUNWAY.cx + d + 22, RUNWAY.cz) + 0.8, z: RUNWAY.cz - 2 }, basis);
      const c = this.project({ x: RUNWAY.cx + d + 22, y: world.heightAt(RUNWAY.cx + d + 22, RUNWAY.cz) + 0.8, z: RUNWAY.cz + 2 }, basis);
      const e = this.project({ x: RUNWAY.cx + d, y: world.heightAt(RUNWAY.cx + d, RUNWAY.cz) + 0.8, z: RUNWAY.cz + 2 }, basis);
      if (!a || !b || !c || !e) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(e.x, e.y);
      ctx.closePath();
      ctx.fill();
    }
    // Threshold numbers "09".
    const num = this.project({ x: RUNWAY.cx - L / 2 + 26, y: world.heightAt(RUNWAY.cx - L / 2 + 26, RUNWAY.cz) + 1, z: RUNWAY.cz }, basis);
    if (num && num.z < 600) {
      ctx.fillStyle = '#f5f5f5';
      ctx.font = `bold ${Math.max(10, num.scale * 14)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('09', num.x, num.y);
    }
  }

  drawClouds(ctx, world, basis) {
    const pal = PALETTES[world.mission.palette];
    const list = world.clouds
      .map((c) => ({ c, p: this.project(c, basis) }))
      .filter((o) => o.p)
      .sort((a, b) => b.p.z - a.p.z);
    for (const { c, p } of list) {
      const r = Math.max(6, c.s * p.scale * 0.5);
      ctx.fillStyle = pal.cloud;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.38, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x - r * 0.5, p.y + r * 0.1, r * 0.6, r * 0.26, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + r * 0.5, p.y + r * 0.08, r * 0.65, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawRings(ctx, world, basis, plane) {
    const next = plane.ringsDone;
    world.rings.forEach((ring, idx) => {
      const done = ring.done;
      const isNext = idx === next;
      const centre = this.project(ring, basis);
      if (!centre) return;
      const r = Math.max(3, ring.radius * centre.scale);
      // Beacon column for the next ring so the pilot always sees the goal.
      if (isNext) {
        const top = this.project({ x: ring.x, y: ring.y + 260, z: ring.z }, basis);
        if (top) {
          ctx.strokeStyle = 'rgba(255,214,64,0.55)';
          ctx.lineWidth = Math.max(2, r * 0.08);
          ctx.beginPath();
          ctx.moveTo(centre.x, centre.y);
          ctx.lineTo(top.x, top.y);
          ctx.stroke();
        }
      }
      ctx.lineWidth = Math.max(2.5, r * 0.16);
      ctx.strokeStyle = done ? 'rgba(120,220,130,0.85)' : isNext ? '#ffd640' : 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.strokeStyle = done ? 'rgba(120,220,130,0.5)' : 'rgba(20,20,30,0.55)';
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, r * 0.82, 0, Math.PI * 2);
      ctx.stroke();
      if (isNext && r > 14) {
        ctx.fillStyle = '#1a1a22';
        ctx.font = `bold ${Math.max(11, r * 0.3)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`RING ${idx + 1}`, centre.x, centre.y - r - 8);
      }
    });
    // Runway beacon once all rings are done.
    if (plane.ringsDone >= world.rings.length) {
      const rp = this.project({ x: RUNWAY.cx, y: world.heightAt(RUNWAY.cx, RUNWAY.cz) + 30, z: RUNWAY.cz }, basis);
      if (rp) {
        ctx.fillStyle = '#ffd640';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('▼ LAND ON RUNWAY 09 ▼', rp.x, rp.y - 14);
      }
    }
  }

  drawStorms(ctx, world, basis) {
    for (const s of world.storms) {
      const p = this.project({ x: s.x, y: s.y, z: s.z }, basis);
      if (!p) continue;
      const r = Math.max(10, s.radius * p.scale);
      const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, r);
      g.addColorStop(0, 'rgba(40,40,60,0.55)');
      g.addColorStop(1, 'rgba(40,40,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,120,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - r * 0.2, p.y - r * 0.3);
      ctx.lineTo(p.x, p.y + r * 0.1);
      ctx.lineTo(p.x - r * 0.05, p.y + r * 0.1);
      ctx.lineTo(p.x + r * 0.15, p.y + r * 0.45);
      ctx.stroke();
    }
  }

  drawTrees(ctx, world, basis) {
    const list = world.trees
      .map((t) => ({ t, p: this.project(t, basis) }))
      .filter((o) => o.p && o.p.z < 420);
    for (const { t, p } of list) {
      const s = Math.max(2, t.s * p.scale * 0.9);
      ctx.fillStyle = '#2f5d2a';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - s * 1.8);
      ctx.lineTo(p.x - s * 0.7, p.y);
      ctx.lineTo(p.x + s * 0.7, p.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Chase-view aircraft, drawn in screen space, banking with the roll.
  drawAircraft(ctx, plane) {
    const cx = this.w / 2, cy = this.h * 0.62;
    const s = Math.min(this.w, this.h) / 11;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(degToRad(-plane.roll * 0.9));
    // Prop blur.
    ctx.fillStyle = 'rgba(220,230,240,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.62, s * 0.16, s * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wings.
    ctx.fillStyle = '#e8542f';
    ctx.beginPath();
    ctx.moveTo(-s * 1.5, s * 0.1);
    ctx.lineTo(-s * 0.28, -s * 0.12);
    ctx.lineTo(-s * 0.28, s * 0.22);
    ctx.lineTo(-s * 1.5, s * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 1.5, s * 0.1);
    ctx.lineTo(s * 0.28, -s * 0.12);
    ctx.lineTo(s * 0.28, s * 0.22);
    ctx.lineTo(s * 1.5, s * 0.34);
    ctx.closePath();
    ctx.fill();
    // Fuselage.
    ctx.fillStyle = '#f4f1e6';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.95);
    ctx.quadraticCurveTo(s * 0.34, -s * 0.4, s * 0.26, s * 0.35);
    ctx.quadraticCurveTo(s * 0.2, s * 0.62, 0, s * 0.66);
    ctx.quadraticCurveTo(-s * 0.2, s * 0.62, -s * 0.26, s * 0.35);
    ctx.quadraticCurveTo(-s * 0.34, -s * 0.4, 0, -s * 0.95);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,30,40,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Canopy.
    ctx.fillStyle = '#274b73';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.42, s * 0.15, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tail.
    ctx.fillStyle = '#e8542f';
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, s * 0.55);
    ctx.lineTo(0, s * 0.28);
    ctx.lineTo(s * 0.5, s * 0.55);
    ctx.lineTo(s * 0.34, s * 0.72);
    ctx.lineTo(-s * 0.34, s * 0.72);
    ctx.closePath();
    ctx.fill();
    // Navigation lights.
    ctx.fillStyle = '#ff4040';
    ctx.beginPath(); ctx.arc(-s * 1.5, s * 0.2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#40ff70';
    ctx.beginPath(); ctx.arc(s * 1.5, s * 0.2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ---- HUD ----
  drawHud(ctx, game, pal) {
    const { plane, campaign } = game;
    const w = this.w, h = this.h;
    ctx.save();
    // Top bar: mission + score + rings.
    ctx.fillStyle = 'rgba(10,14,24,0.55)';
    ctx.fillRect(0, 0, w, 46);
    ctx.fillStyle = '#ffd640';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`AURORA COURIER  ·  ${campaign.mission.name}`, 14, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.fillText(`RINGS ${plane.ringsDone}/${game.world.rings.length}   SCORE ${plane.score}   TOTAL ${campaign.totalScore + plane.score}`, 14, 39);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    const mm = Math.floor(plane.time / 60), ss = Math.floor(plane.time % 60);
    ctx.fillText(`TIME ${mm}:${String(ss).padStart(2, '0')}`, w - 14, 20);
    ctx.fillText(`SORTIE ${campaign.missionIndex + 1}/3`, w - 14, 39);
    ctx.restore();

    // Left instrument cluster: ALT, SPD, HDG.
    this.gauge(ctx, 16, h - 148, 'ALT', `${Math.round(plane.y * 3.28)} ft`, `${Math.round(plane.y)} m`);
    this.gauge(ctx, 16, h - 96, 'SPD', `${Math.round(plane.speed * 1.94)} kt`, `${Math.round(plane.speed * 3.6)} km/h`);
    this.gauge(ctx, 16, h - 44, 'HDG', `${String(Math.round(plane.heading)).padStart(3, '0')}°`, this.compassPoint(plane.heading));

    // Artificial horizon (bottom centre).
    this.horizon(ctx, w / 2, h - 62, 46, plane);

    // Right cluster: throttle, fuel, damage.
    this.bar(ctx, w - 216, h - 148, 200, 14, plane.throttle, '#57c84d', `THROTTLE ${Math.round(plane.throttle * 100)}%`);
    this.bar(ctx, w - 216, h - 110, 200, 14, plane.fuel / 100, plane.fuel < 25 ? '#ff5040' : '#ffb020', `FUEL ${Math.round(plane.fuel)}%`);
    this.bar(ctx, w - 216, h - 72, 200, 14, 1 - plane.damage / 100, plane.damage > 60 ? '#ff5040' : '#4db2ff', `AIRFRAME ${Math.round(100 - plane.damage)}%`);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('↑↓ pitch · ←→ bank · SHIFT throttle · P pause · M sound', w - 16, h - 44);

    // Compass strip.
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,24,0.55)';
    ctx.fillRect(w / 2 - 150, 54, 300, 26);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    for (let d = -60; d <= 60; d += 15) {
      const hd = (Math.round(plane.heading) + d + 360) % 360;
      const x = w / 2 + d * 2.2;
      const label = d % 45 === 0 ? this.compassPoint(hd) : `${hd}`;
      ctx.fillText(label, x, 72);
      if (d === 0) {
        ctx.fillStyle = '#ffd640';
        ctx.fillRect(x - 1, 56, 2, 22);
        ctx.fillStyle = '#ffffff';
      }
    }
    ctx.restore();

    // Ring flash + storm warning.
    if (plane.ringFlash > 0) {
      ctx.save();
      ctx.globalAlpha = plane.ringFlash;
      ctx.fillStyle = '#ffd640';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`RING ${plane.ringsDone}  +${CONFIG.ringScore}`, w / 2, h * 0.3);
      ctx.restore();
    }
    if (plane.stormWarning) {
      ctx.fillStyle = '#ff5040';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ STORM — GET CLEAR ⚠', w / 2, h * 0.36);
    }
    if (plane.onGround && campaign.state === 'flying') {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ON RUNWAY 09 — pitch up and build speed to take off', w / 2, h * 0.42);
    }
  }

  compassPoint(h) {
    const pts = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return pts[Math.round(((h % 360) + 360) % 360 / 45) % 8];
  }

  gauge(ctx, x, y, label, big, small) {
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,24,0.6)';
    ctx.fillRect(x, y, 190, 44);
    ctx.strokeStyle = '#57c84d';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, 188, 42);
    ctx.fillStyle = '#8fd6ff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 8, y + 15);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(big, x + 8, y + 36);
    ctx.fillStyle = '#c8c8c8';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(small, x + 182, y + 36);
    ctx.restore();
  }

  bar(ctx, x, y, bw, bh, frac, color, label) {
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,24,0.6)';
    ctx.fillRect(x - 4, y - 16, bw + 8, bh + 22);
    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(0, bw * clamp(frac, 0, 1)), bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(x, y, bw, bh);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y - 4);
    ctx.restore();
  }

  horizon(ctx, cx, cy, r, plane) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(degToRad(-plane.roll));
    ctx.translate(0, degToRad(plane.pitch) * r * 0.12);
    ctx.fillStyle = '#3f7fc4';
    ctx.fillRect(-r, -r, r * 2, r);
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(-r, 0, r * 2, r);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-r, -1, r * 2, 2);
    ctx.restore();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd640';
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy);
    ctx.lineTo(cx + 12, cy);
    ctx.lineTo(cx, cy + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', cx, cy + r + 13);
  }

  panel(ctx, title, lines, footnote) {
    const w = Math.min(620, this.w - 60);
    const h = 150 + lines.length * 26;
    const x = (this.w - w) / 2, y = (this.h - h) / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,22,0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ffd640';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#ffd640';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, this.w / 2, y + 42);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, this.w / 2, y + 80 + i * 26));
    if (footnote) {
      ctx.fillStyle = '#ffd640';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(footnote, this.w / 2, y + h - 20);
    }
    ctx.restore();
  }

  drawTitle(ctx, game) {
    this.panel(ctx, 'AURORA COURIER', [
      'A bush-pilot courier game over Gull Island.',
      'Thread the golden rings, mind your fuel,',
      'then land on Runway 09. Three sorties, one route.',
      '',
      'Keyboard: ↑↓ pitch · ←→ bank · SHIFT throttle up',
      'Mouse: steer by pointer position · Click to begin',
    ], 'CLICK OR PRESS ENTER TO FLY');
  }

  drawBriefing(ctx, game) {
    const m = game.campaign.mission;
    this.panel(ctx, m.name, [
      m.brief,
      '',
      `Rings: ${m.rings}   Storms: ${m.storms}   Fuel: ${m.fuel}%`,
      'Rings top up fuel (+6%). Landings score fuel left.',
    ], 'PRESS ENTER OR CLICK TO TAKE OFF');
  }

  drawPaused(ctx) {
    this.panel(ctx, 'PAUSED', ['The island waits.'], 'PRESS P TO RESUME');
  }

  drawLanded(ctx, game) {
    const p = game.plane;
    this.panel(ctx, 'SORTIE COMPLETE — LANDED', [
      `Score this sortie: ${p.score}`,
      `Fuel left: ${Math.round(p.fuel)}%   Time: ${Math.floor(p.time / 60)}:${String(Math.floor(p.time % 60)).padStart(2, '0')}`,
      `Campaign total: ${game.campaign.totalScore}`,
    ], game.campaign.isLastMission ? 'PRESS ENTER FOR THE FINAL RESULT' : 'PRESS ENTER FOR THE NEXT SORTIE');
  }

  drawCrashed(ctx, game) {
    const p = game.plane;
    this.panel(ctx, 'CRASHED', [
      p.crashReason || 'The island wins this round.',
      `Score kept: ${p.score}   Rings: ${p.ringsDone}/${game.world.rings.length}`,
      `Campaign total: ${game.campaign.totalScore}`,
    ], 'PRESS R TO FLY THE SORTIE AGAIN');
  }

  drawDone(ctx, game) {
    const lines = game.campaign.completed.map((c, i) => `${i + 1}. ${c.name} — ${c.score} pts`);
    lines.push('');
    lines.push(`FINAL TOTAL: ${game.campaign.totalScore} points`);
    this.panel(ctx, 'ROUTE COMPLETE — AURORA COURIER', lines, 'PRESS R TO FLY IT ALL AGAIN');
  }

  drawFlash(ctx, text) {
    ctx.save();
    ctx.fillStyle = '#ffd640';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, this.w / 2, this.h * 0.22);
    ctx.restore();
  }
}

// The frame: the pre-rendered city, skid marks, mission beacons, every car,
// pedestrian, cop and enemy sorted by depth, bullets, particles, floating
// text, the waypoint arrow and a warm sunlit grade on top.

import { WORLD_W, WORLD_H } from './config.js';
import { drawCar } from './vehicles.js';
import { drawPlayer } from './player.js';
import { drawPed } from './pedestrians.js';
import { drawCop } from './police.js';
import { drawEnemy, drawPickup } from './combat.js';
import { drawHUD } from './hud.js';
import { drawScreen } from './screens.js';

export function drawFrame(G, g) {
  const W = G.viewW;
  const H = G.viewH;
  const zoom = G.zoom;
  const shakeX = (Math.random() - 0.5) * G.shake;
  const shakeY = (Math.random() - 0.5) * G.shake;
  const camX = G.camera.x + shakeX / zoom;
  const camY = G.camera.y + shakeY / zoom;

  g.fillStyle = '#1f7fa3';
  g.fillRect(0, 0, W, H);
  g.save();
  g.scale(zoom, zoom);
  g.translate(-camX, -camY);

  // Static city layer, clipped to the view.
  const vw = W / zoom;
  const vh = H / zoom;
  g.drawImage(G.city.staticCanvas, camX, camY, vw, vh, camX, camY, vw, vh);

  drawSkids(G, g);
  drawBeacons(G, g);
  drawMissionItems(G, g);
  for (const pk of G.pickups) drawPickup(g, pk, G.time);

  // Depth-sorted actors.
  const actors = [];
  for (const car of G.cars) if (!car.removed) actors.push({ y: car.y, fn: () => drawCar(g, car, G.time) });
  for (const ped of G.peds) actors.push({ y: ped.y, fn: () => drawPed(g, ped, G.time) });
  for (const cop of G.cops) actors.push({ y: cop.y, fn: () => drawCop(g, cop, G.time) });
  for (const e of G.enemies) actors.push({ y: e.y, fn: () => drawEnemy(g, e, G.time) });
  if (!G.player.inCar && !G.player.dead) actors.push({ y: G.player.y, fn: () => drawPlayer(g, G.player, G.time) });
  actors.sort((a, b) => a.y - b.y);
  for (const a of actors) a.fn();

  drawBullets(G, g);
  drawParticles(G, g);
  drawFloats(G, g);
  g.restore();

  // Waypoint arrow at the screen edge when the target is off-screen.
  if (G.screen === 'play' && G.waypoint) drawWaypointArrow(G, g);

  // Warm sunlight grade.
  const sun = g.createLinearGradient(0, 0, W, H);
  sun.addColorStop(0, 'rgba(255,220,130,0.10)');
  sun.addColorStop(0.6, 'rgba(255,220,130,0.0)');
  sun.addColorStop(1, 'rgba(255,150,80,0.08)');
  g.fillStyle = sun;
  g.fillRect(0, 0, W, H);

  if (G.screen === 'play' || G.screen === 'pause') drawHUD(G, g);
  if (G.screen !== 'play') drawScreen(G, g);
}

function drawSkids(G, g) {
  for (const s of G.effects.skids) {
    const a = 0.35 * (1 - s.life / s.maxLife);
    g.strokeStyle = 'rgba(20,20,20,' + a.toFixed(2) + ')';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(s.x - Math.cos(s.angle) * 9, s.y - Math.sin(s.angle) * 9);
    g.lineTo(s.x + Math.cos(s.angle) * 9, s.y + Math.sin(s.angle) * 9);
    g.stroke();
  }
}

function drawBeacons(G, g) {
  const t = G.time;
  // Mission start marker: pink pillar.
  if (G.missionMarker) {
    const m = G.missionMarker;
    beacon(g, m.x, m.y, 'rgba(244,114,182,', t);
    g.fillStyle = '#f472b6';
    g.font = 'bold 22px Arial';
    g.textAlign = 'center';
    g.fillText('M', m.x, m.y - 52 - Math.sin(t * 3) * 4);
    g.font = 'bold 11px Arial';
    g.fillStyle = '#ffffff';
    g.fillText(m.name.toUpperCase(), m.x, m.y - 34);
  }
  // Taxi rank.
  if (G.taxiJob && !G.taxiJob.active) {
    beacon(g, G.taxiJob.x, G.taxiJob.y, 'rgba(250,204,21,', t);
    g.fillStyle = '#facc15';
    g.font = 'bold 20px Arial';
    g.textAlign = 'center';
    g.fillText('T', G.taxiJob.x, G.taxiJob.y - 52 - Math.sin(t * 3) * 4);
  }
  // Waypoint: yellow pillar and diamond.
  if (G.waypoint) {
    const w = G.waypoint;
    beacon(g, w.x, w.y, 'rgba(250,204,21,', t);
    g.save();
    g.translate(w.x, w.y - 46 - Math.sin(t * 3) * 5);
    g.rotate(Math.PI / 4);
    g.fillStyle = '#facc15';
    g.fillRect(-8, -8, 16, 16);
    g.strokeStyle = '#111111';
    g.lineWidth = 2;
    g.strokeRect(-8, -8, 16, 16);
    g.restore();
  }
  // Hideout and garage markers (small, always on).
  groundRing(g, G.city.places.hideout.x, G.city.places.hideout.y, '#4ade80', t);
  groundRing(g, G.city.places.garage.x, G.city.places.garage.y, '#38bdf8', t);
}

function beacon(g, x, y, rgbPrefix, t) {
  const grad = g.createLinearGradient(x, y - 130, x, y);
  grad.addColorStop(0, rgbPrefix + '0)');
  grad.addColorStop(1, rgbPrefix + '0.4)');
  g.fillStyle = grad;
  g.fillRect(x - 10, y - 130, 20, 130);
  g.fillStyle = rgbPrefix + '0.5)';
  g.beginPath();
  g.ellipse(x, y, 26, 9, 0, 0, Math.PI * 2);
  g.fill();
}

function groundRing(g, x, y, color, t) {
  const r = 24 + Math.sin(t * 2) * 3;
  g.strokeStyle = color;
  g.globalAlpha = 0.7;
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 1;
}

function drawMissionItems(G, g) {
  for (const item of G.missionItems || []) {
    if (item.taken) continue;
    const y = item.y + Math.sin(G.time * 3 + item.x) * 3;
    g.save();
    g.translate(item.x, y);
    g.fillStyle = 'rgba(250,204,21,0.35)';
    g.beginPath();
    g.arc(0, 8, 18, 0, Math.PI * 2);
    g.fill();
    if (item.kind === 'briefcase') {
      g.fillStyle = '#6b4423';
      g.fillRect(-12, -8, 24, 16);
      g.fillStyle = '#8a5a2e';
      g.fillRect(-12, -8, 24, 5);
      g.strokeStyle = '#3a2412';
      g.lineWidth = 2;
      g.strokeRect(-12, -8, 24, 16);
      g.fillStyle = '#facc15';
      g.fillRect(-2, -3, 4, 4);
    } else {
      g.fillStyle = '#2f9e44';
      g.beginPath();
      g.arc(0, 2, 11, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1e7a32';
      g.fillRect(-3, -12, 6, 8);
      g.fillStyle = '#ffffff';
      g.font = 'bold 11px Arial';
      g.textAlign = 'center';
      g.fillText('$', 0, 6);
    }
    g.restore();
  }
}

function drawBullets(G, g) {
  g.strokeStyle = '#ffe98a';
  g.lineWidth = 2.5;
  for (const b of G.bullets) {
    g.beginPath();
    g.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    g.lineTo(b.x, b.y);
    g.stroke();
  }
}

function drawParticles(G, g) {
  for (const p of G.effects.particles) {
    const a = 1 - p.life / p.maxLife;
    g.globalAlpha = Math.max(0, a);
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(p.x, p.y, p.size * (p.color.indexOf('rgba') === 0 ? 1 + p.life : 1), 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

function drawFloats(G, g) {
  g.textAlign = 'center';
  g.font = 'bold 15px Arial';
  for (const f of G.effects.floats) {
    g.globalAlpha = Math.max(0, 1 - f.life / f.maxLife);
    g.fillStyle = f.color;
    g.fillText(f.text, f.x, f.y);
  }
  g.globalAlpha = 1;
}

function drawWaypointArrow(G, g) {
  const w = G.waypoint;
  const p = G.player;
  const zoom = G.zoom;
  const sx = (w.x - G.camera.x) * zoom;
  const sy = (w.y - G.camera.y) * zoom;
  if (sx > -20 && sx < G.viewW + 20 && sy > -20 && sy < G.viewH + 20) return;
  const cx = G.viewW / 2;
  const cy = G.viewH / 2;
  const angle = Math.atan2(sy - cy, sx - cx);
  const ex = cx + Math.cos(angle) * (Math.min(G.viewW, G.viewH) / 2 - 70);
  const ey = cy + Math.sin(angle) * (Math.min(G.viewW, G.viewH) / 2 - 70);
  const d = Math.round(Math.hypot(w.x - p.x, w.y - p.y) / 8);
  g.save();
  g.translate(ex, ey);
  g.rotate(angle);
  g.fillStyle = '#facc15';
  g.strokeStyle = '#111111';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(16, 0);
  g.lineTo(-8, -11);
  g.lineTo(-4, 0);
  g.lineTo(-8, 11);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
  g.fillStyle = '#ffffff';
  g.font = 'bold 12px Arial';
  g.textAlign = 'center';
  g.fillText(d + 'm', ex, ey + 26);
}

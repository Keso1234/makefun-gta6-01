// The minimap: a live circular slice of the city in the bottom-left corner,
// with the player arrow, the waypoint, police blips, mission markers and a
// north pointer. The static city layer is pre-rendered once by city.js.

import { WORLD_W, WORLD_H } from './config.js';

export const MINIMAP_R = 92;

export function minimapCenter(G) {
  return { x: MINIMAP_R + 22, y: G.viewH - MINIMAP_R - 22 };
}

export function drawMinimap(G, g) {
  const { x: cx, y: cy } = minimapCenter(G);
  const R = MINIMAP_R;
  const p = G.player;
  const scale = R / 950; // world px -> minimap px
  const mapScale = 0.1; // city.minimapCanvas is world * 0.1

  g.save();
  // Outer ring and shadow.
  g.beginPath();
  g.arc(cx + 3, cy + 4, R + 5, 0, Math.PI * 2);
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.fill();
  g.beginPath();
  g.arc(cx, cy, R + 4, 0, Math.PI * 2);
  g.fillStyle = '#101820';
  g.fill();
  // Clip to the circle and draw the map slice around the player.
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#22401e';
  g.fillRect(cx - R, cy - R, R * 2, R * 2);
  const view = R / scale; // world units across the radius
  const sx = (p.x - view) * mapScale;
  const sy = (p.y - view) * mapScale;
  const sw = view * 2 * mapScale;
  g.drawImage(G.city.minimapCanvas, sx, sy, sw, sw, cx - R, cy - R, R * 2, R * 2);

  const bx = (wx) => cx + (wx - p.x) * scale;
  const by = (wy) => cy + (wy - p.y) * scale;
  const inCircle = (wx, wy) => {
    const dx = (wx - p.x) * scale;
    const dy = (wy - p.y) * scale;
    return dx * dx + dy * dy < (R - 6) * (R - 6);
  };

  // Hideout and garage.
  drawBlip(g, bx(G.city.places.hideout.x), by(G.city.places.hideout.y), '#4ade80', 'H', R, cx, cy, inCircle(G.city.places.hideout.x, G.city.places.hideout.y));
  drawBlip(g, bx(G.city.places.garage.x), by(G.city.places.garage.y), '#38bdf8', 'G', R, cx, cy, inCircle(G.city.places.garage.x, G.city.places.garage.y));
  // Mission start marker.
  if (G.missionMarker) {
    const m = G.missionMarker;
    drawBlip(g, bx(m.x), by(m.y), '#f472b6', 'M', R, cx, cy, inCircle(m.x, m.y));
  }
  // Taxi rank.
  if (G.taxiJob && !G.taxiJob.active) {
    drawBlip(g, bx(G.taxiJob.x), by(G.taxiJob.y), '#facc15', 'T', R, cx, cy, inCircle(G.taxiJob.x, G.taxiJob.y));
  }
  // Mission items.
  for (const item of G.missionItems || []) {
    if (item.taken) continue;
    drawDot(g, bx(item.x), by(item.y), '#fde047', 5);
  }
  // Enemies.
  for (const e of G.enemies) {
    if (e.dead) continue;
    drawDot(g, bx(e.x), by(e.y), '#ef4444', 4);
  }
  // Police: flashing blue/red.
  const flash = Math.floor(G.time * 4) % 2 === 0;
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.removed) continue;
    drawDot(g, bx(car.x), by(car.y), flash ? '#3b82f6' : '#ef4444', 5);
  }
  for (const cop of G.cops) drawDot(g, bx(cop.x), by(cop.y), '#3b82f6', 3.5);
  // Waypoint: pulsing yellow diamond, clamped to the rim when far.
  if (G.waypoint) {
    let wx = (G.waypoint.x - p.x) * scale;
    let wy = (G.waypoint.y - p.y) * scale;
    const d = Math.hypot(wx, wy);
    if (d > R - 12) {
      wx = (wx / d) * (R - 12);
      wy = (wy / d) * (R - 12);
    }
    const pulse = 5 + Math.sin(G.time * 6) * 1.5;
    g.save();
    g.translate(cx + wx, cy + wy);
    g.rotate(Math.PI / 4);
    g.fillStyle = '#facc15';
    g.fillRect(-pulse, -pulse, pulse * 2, pulse * 2);
    g.strokeStyle = '#111111';
    g.lineWidth = 1.5;
    g.strokeRect(-pulse, -pulse, pulse * 2, pulse * 2);
    g.restore();
  }
  // Player arrow.
  g.save();
  g.translate(cx, cy);
  g.rotate(p.angle + Math.PI / 2);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#111111';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, -9);
  g.lineTo(6.5, 7);
  g.lineTo(0, 3.5);
  g.lineTo(-6.5, 7);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
  g.restore();

  // North pointer.
  g.fillStyle = '#ffffff';
  g.font = 'bold 12px Arial';
  g.textAlign = 'center';
  g.fillText('N', cx, cy - R - 8);
}

function drawBlip(g, x, y, color, letter, R, cx, cy, visible) {
  if (!visible) return;
  g.beginPath();
  g.arc(x, y, 9, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  g.strokeStyle = '#111111';
  g.lineWidth = 1.5;
  g.stroke();
  g.fillStyle = '#111111';
  g.font = 'bold 10px Arial';
  g.textAlign = 'center';
  g.fillText(letter, x, y + 3.5);
}

function drawDot(g, x, y, color, r) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = 1;
  g.stroke();
}

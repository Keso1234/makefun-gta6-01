// The HUD: objective tracker, cash and clock, wanted stars, health and armor,
// speedometer, subtitles, banners and the interaction prompt — everything the
// player needs without ever leaving the game.

import { formatMoney, formatClock } from './utils.js';
import { nearestStreetName } from './city.js';
import { drawMinimap } from './minimap.js';

export function drawHUD(G, g) {
  const W = G.viewW;
  const p = G.player;
  drawMinimap(G, g);
  drawObjective(G, g);
  drawTopRight(G, g, W);
  drawBottomRight(G, g, W);
  drawSubtitles(G, g, W);
  drawPrompt(G, g, W);
  drawBanner(G, g, W);
  drawVignette(G, g, W);
  if (G.showHelp) drawHelpHint(G, g, W);
}

function panel(g, x, y, w, h) {
  g.fillStyle = 'rgba(8,14,22,0.62)';
  roundRect(g, x, y, w, h, 8);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.14)';
  g.lineWidth = 1;
  roundRect(g, x, y, w, h, 8);
  g.stroke();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawObjective(G, g) {
  const m = G.mission;
  const t = G.taxiJob;
  let title = null;
  let text = null;
  let timer = null;
  if (m && m.started) {
    const step = m.def.steps[m.stepIdx];
    title = m.def.name.toUpperCase();
    text = step.text;
    if (step.type === 'timed') timer = Math.max(0, m.timer);
    if (step.type === 'kill') {
      const alive = m.spawnedEnemies.filter((e) => !e.dead).length;
      text += '  (' + alive + ' left)';
    }
    if (step.type === 'pickup' && step.count) text += '  (' + m.collected + '/' + step.count + ')';
  } else if (t && t.active) {
    title = 'TAXI JOB';
    text = t.stage === 'pickup' ? 'Pick up the passenger' : 'Drop off the passenger';
    timer = t.timer;
  } else if (G.missionMarker) {
    title = 'NEXT MISSION';
    text = G.missionMarker.name + ' — head to the pink M marker';
  } else if (G.missionsDone.every(Boolean)) {
    title = 'STORY COMPLETE';
    text = 'Solmar is yours. Free roam, taxi jobs, or just drive.';
  }
  if (!title) return;
  const lines = wrapText(g, text, 300);
  const h = 34 + lines.length * 18 + (timer !== null ? 20 : 0) + (G.waypoint ? 20 : 0);
  panel(g, 16, 16, 340, h);
  g.fillStyle = '#facc15';
  g.font = 'bold 13px Arial';
  g.textAlign = 'left';
  g.fillText(title, 30, 38);
  g.fillStyle = '#ffffff';
  g.font = '14px Arial';
  lines.forEach((line, i) => g.fillText(line, 30, 60 + i * 18));
  if (timer !== null) {
    g.fillStyle = timer < 15 ? '#ff6b6b' : '#7CFC00';
    g.font = 'bold 15px Arial';
    g.fillText('TIME  ' + Math.ceil(timer) + 's', 30, 60 + lines.length * 18 + 4);
  }
  if (G.waypoint) {
    const d = Math.hypot(G.waypoint.x - G.player.x, G.waypoint.y - G.player.y);
    g.fillStyle = '#9fb3c8';
    g.font = '12px Arial';
    g.fillText(G.waypoint.label + ' — ' + Math.round(d / 8) + 'm', 30, 60 + lines.length * 18 + (timer !== null ? 22 : 4));
  }
}

function drawTopRight(G, g, W) {
  const p = G.player;
  const x = W - 16;
  // Cash.
  g.textAlign = 'right';
  g.font = 'bold 26px Arial';
  g.fillStyle = '#7CFC00';
  g.fillText(formatMoney(p.cash), x, 42);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.font = '13px Arial';
  g.fillText(formatClock(G.clock) + '  •  ' + nearestStreetName(p.x, p.y), x, 62);
  // Wanted stars.
  const stars = G.wanted.stars;
  for (let i = 0; i < 5; i += 1) {
    const sx = x - 12 - i * 30;
    const sy = 86;
    const on = i < stars;
    const flash = G.wanted.flash > 0 && Math.floor(G.time * 8) % 2 === 0;
    drawStar(g, sx, sy, 12, on ? (flash ? '#ffffff' : '#facc15') : 'rgba(255,255,255,0.18)');
  }
  if (stars > 0) {
    g.fillStyle = '#ff6b6b';
    g.font = 'bold 12px Arial';
    g.fillText('WANTED', x, 112);
  }
  // Bust progress.
  if (G.bustProgress > 0.05) {
    const bw = 180;
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(x - bw, 122, bw, 10);
    g.fillStyle = '#3b82f6';
    g.fillRect(x - bw, 122, bw * Math.min(1, G.bustProgress), 10);
    g.fillStyle = '#ffffff';
    g.font = 'bold 11px Arial';
    g.fillText('BUSTED…', x, 142);
  }
}

function drawStar(g, cx, cy, r, color) {
  g.save();
  g.translate(cx, cy);
  g.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) g.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 1;
  g.stroke();
  g.restore();
}

function drawBottomRight(G, g, W) {
  const p = G.player;
  const x = W - 16;
  let y = G.viewH - 16;
  // Speed when driving.
  if (p.inCar) {
    const kmh = Math.round(Math.abs(p.inCar.speed) * 0.36);
    g.textAlign = 'right';
    g.font = 'bold 34px Arial';
    g.fillStyle = '#ffffff';
    g.fillText(kmh, x - 34, y);
    g.font = '12px Arial';
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText('km/h', x, y);
    g.font = '13px Arial';
    g.fillText(p.inCar.spec.name + '  •  ' + Math.max(0, Math.round(p.inCar.health)) + '%', x, y - 40);
    y -= 66;
  }
  // Weapon.
  g.textAlign = 'right';
  g.font = 'bold 14px Arial';
  g.fillStyle = '#ffffff';
  const weaponText = p.weapon === 'smg' ? 'SMG  •  ' + p.smgAmmo + ' rounds' : 'Pistol  •  ∞';
  g.fillText(weaponText, x, y);
  y -= 12;
  // Health bar.
  bar(g, x - 200, y - 14, 200, 12, p.health / 100, p.health > 30 ? '#4ade80' : '#ef4444');
  g.fillStyle = '#ffffff';
  g.font = 'bold 11px Arial';
  g.fillText('HP', x - 206, y - 3);
  y -= 20;
  // Armor bar.
  bar(g, x - 200, y - 14, 200, 12, p.armor / 100, '#38bdf8');
  g.fillStyle = '#ffffff';
  g.fillText('ARMOR', x - 206, y - 3);
}

function bar(g, x, y, w, h, frac, color) {
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = color;
  g.fillRect(x, y, Math.max(0, w * frac), h);
}

function drawSubtitles(G, g, W) {
  if (!G.dialogue) return;
  const line = G.dialogue.lines[G.dialogue.i];
  if (!line) return;
  g.textAlign = 'center';
  g.font = 'bold 14px Arial';
  const whoW = g.measureText(line.who + ':  ').width;
  g.font = '15px Arial';
  const textW = g.measureText(line.text).width;
  const w = whoW + textW + 36;
  const y = G.viewH - 56;
  panel(g, W / 2 - w / 2, y - 24, w, 34);
  g.textAlign = 'left';
  g.font = 'bold 14px Arial';
  g.fillStyle = '#facc15';
  g.fillText(line.who + ':', W / 2 - w / 2 + 18, y);
  g.font = '15px Arial';
  g.fillStyle = '#ffffff';
  g.fillText(line.text, W / 2 - w / 2 + 18 + whoW, y);
}

function drawPrompt(G, g, W) {
  if (!G.prompt) return;
  g.textAlign = 'center';
  g.font = 'bold 15px Arial';
  const w = g.measureText(G.prompt).width + 36;
  const y = G.viewH - 110;
  panel(g, W / 2 - w / 2, y - 22, w, 32);
  g.fillStyle = '#ffffff';
  g.fillText(G.prompt, W / 2, y);
}

function drawBanner(G, g, W) {
  if (!G.banner) return;
  const b = G.banner;
  const a = b.t < 0.25 ? b.t / 0.25 : b.t > b.dur - 0.4 ? Math.max(0, (b.dur - b.t) / 0.4) : 1;
  g.save();
  g.globalAlpha = a;
  g.textAlign = 'center';
  g.font = 'bold 44px Arial';
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillText(b.text, W / 2 + 2, 168);
  g.fillStyle = '#ffffff';
  g.fillText(b.text, W / 2, 166);
  if (b.sub) {
    g.font = '17px Arial';
    g.fillStyle = '#facc15';
    g.fillText(b.sub, W / 2, 196);
  }
  g.restore();
}

function drawVignette(G, g, W) {
  const p = G.player;
  const lowHealth = p.health < 35 ? (0.35 + Math.sin(G.time * 5) * 0.12) * (1 - p.health / 35) : 0;
  const a = Math.max(p.hurtFlash * 0.5, lowHealth);
  if (a <= 0.01) return;
  const grad = g.createRadialGradient(W / 2, G.viewH / 2, Math.min(W, G.viewH) * 0.35, W / 2, G.viewH / 2, Math.max(W, G.viewH) * 0.75);
  grad.addColorStop(0, 'rgba(180,0,0,0)');
  grad.addColorStop(1, 'rgba(180,0,0,' + a.toFixed(2) + ')');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, G.viewH);
}

function drawHelpHint(G, g, W) {
  const lines = [
    'WASD / Arrows — move & drive   •   E — enter car / interact',
    'Mouse — aim   •   Click — shoot   •   Space — handbrake',
    'Shift — run   •   M — mute   •   H — help   •   Esc — pause',
  ];
  g.font = '13px Arial';
  const w = Math.max(...lines.map((l) => g.measureText(l).width)) + 24;
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.beginPath();
  g.roundRect(W - 16 - w, 116, w, 66, 8);
  g.fill();
  g.textAlign = 'right';
  g.fillStyle = 'rgba(255,255,255,0.85)';
  lines.forEach((line, i) => g.fillText(line, W - 28, 134 + i * 18));
}

function wrapText(g, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  g.font = '14px Arial';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (g.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Combat: bullets, the player's pistol and SMG, mission enemies who shoot
// back, and pickups (health, armor, the SMG, cash). Shooting is loud —
// witnesses and nearby officers raise the heat.

import { WEAPONS } from './config.js';
import { pointBlocked } from './city.js';
import { dist, angleTo, clamp } from './utils.js';
import { spawnSparks, spawnMuzzle, spawnBlood, addFloat } from './particles.js';
import { playShot, playHit, playPickup, playCash } from './audio.js';
import { addCrime } from './wanted.js';
import { damagePlayer, healPlayer } from './player.js';
import { damageCar } from './vehicles.js';
import { scarePeds } from './pedestrians.js';

export function spawnBullet(G, x, y, angle, from, damage) {
  const speed = 950;
  G.bullets.push({
    x: x + Math.cos(angle) * 16,
    y: y + Math.sin(angle) * 16,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    from,
    damage,
    life: 0,
    maxLife: 0.8,
  });
}

export function tryPlayerFire(G, dt) {
  const p = G.player;
  if (p.fireCooldown > 0 || p.inCar) return;
  const weapon = WEAPONS[p.weapon];
  if (p.weapon === 'smg' && p.smgAmmo <= 0) {
    p.weapon = 'pistol';
    G.banner = { text: 'SMG EMPTY', sub: 'Back to the pistol', t: 0, dur: 1.6 };
    return;
  }
  if (!weapon.auto && !G.input.mousePressed) return;
  p.fireCooldown = weapon.fireRate;
  if (p.weapon === 'smg') p.smgAmmo -= 1;
  const spread = (Math.random() - 0.5) * 2 * weapon.spread;
  const angle = p.angle + spread;
  spawnBullet(G, p.x, p.y, angle, 'player', weapon.damage);
  spawnMuzzle(G, p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, p.angle);
  playShot(G.audio, p.weapon === 'smg');
  G.lastGunshot = { x: p.x, y: p.y, t: G.time };
  scarePeds(G, p.x, p.y, 320);
  // Shooting where the law can hear it adds heat.
  if (G.wanted.stars > 0 || G.cops.some((c) => dist(c.x, c.y, p.x, p.y) < 420)) addCrime(G, 'shoot');
}

export function spawnEnemy(G, x, y, opts) {
  const o = opts || {};
  const enemy = {
    x, y,
    angle: o.angle || 0,
    hp: o.hp || 70,
    maxHp: o.hp || 70,
    shootTimer: 0.8 + Math.random(),
    walkPhase: Math.random() * 6,
    state: o.state || 'guard',
    tx: x, ty: y,
    shirt: o.shirt || '#8e44ad',
    dead: false,
  };
  G.enemies.push(enemy);
  return enemy;
}

export function updateCombat(G, dt) {
  updateBullets(G, dt);
  updateEnemies(G, dt);
  updatePickups(G, dt);
}

function updateBullets(G, dt) {
  for (let i = G.bullets.length - 1; i >= 0; i -= 1) {
    const b = G.bullets[i];
    b.life += dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let hit = b.life >= b.maxLife;
    if (!hit && pointBlocked(G.city, b.x, b.y)) {
      spawnSparks(G, b.x, b.y, Math.atan2(b.vy, b.vx));
      hit = true;
    }
    if (!hit && b.from === 'player') {
      // Enemies first.
      for (const e of G.enemies) {
        if (e.dead) continue;
        if (dist(b.x, b.y, e.x, e.y) < 14) {
          e.hp -= b.damage;
          spawnBlood(G, e.x, e.y);
          playHit(G.audio);
          if (e.hp <= 0) killEnemy(G, e);
          hit = true;
          break;
        }
      }
      // Then cars.
      if (!hit) {
        for (const car of G.cars) {
          if (car.removed || car.dead) continue;
          if (dist(b.x, b.y, car.x, car.y) < 24) {
            damageCar(G, car, b.damage * 0.6, 'player');
            spawnSparks(G, b.x, b.y, Math.atan2(b.vy, b.vx));
            if (car.driver === 'police') addCrime(G, 'hitCop');
            else if (car.driver === 'traffic') addCrime(G, 'hitCar');
            hit = true;
            break;
          }
        }
      }
      // Then pedestrians (an accident the law notices).
      if (!hit) {
        for (const ped of G.peds) {
          if (ped.down > 0) continue;
          if (dist(b.x, b.y, ped.x, ped.y) < 12) {
            ped.down = 4;
            ped.state = 'down';
            spawnBlood(G, ped.x, ped.y);
            addCrime(G, 'hitPed');
            scarePeds(G, ped.x, ped.y, 260);
            hit = true;
            break;
          }
        }
      }
    }
    if (!hit && b.from === 'enemy') {
      const p = G.player;
      if (!p.dead && dist(b.x, b.y, p.x, p.y) < (p.inCar ? 24 : 13)) {
        if (p.inCar) damageCar(G, p.inCar, b.damage, 'enemy');
        else damagePlayer(G, b.damage, 'wasted');
        hit = true;
      }
    }
    if (hit) G.bullets.splice(i, 1);
  }
}

function killEnemy(G, e) {
  e.dead = true;
  spawnBlood(G, e.x, e.y);
  G.missionKills = (G.missionKills || 0) + 1;
  if (Math.random() < 0.5) spawnPickup(G, e.x, e.y, 'cash');
}

function updateEnemies(G, dt) {
  const p = G.player;
  for (let i = G.enemies.length - 1; i >= 0; i -= 1) {
    const e = G.enemies[i];
    if (e.dead) {
      e.fade = (e.fade || 0) + dt;
      if (e.fade > 4) G.enemies.splice(i, 1);
      continue;
    }
    const d = dist(e.x, e.y, p.x, p.y);
    e.shootTimer -= dt;
    if (d < 480 && !p.dead) {
      e.angle = angleTo(e.x, e.y, p.x, p.y);
      e.state = 'combat';
      // Strafe a little so they are not statues.
      e.walkPhase += dt * 6;
      if (e.shootTimer <= 0) {
        e.shootTimer = 0.9 + Math.random() * 0.8;
        spawnBullet(G, e.x, e.y, e.angle + (Math.random() - 0.5) * 0.16, 'enemy', 9);
        spawnMuzzle(G, e.x + Math.cos(e.angle) * 18, e.y + Math.sin(e.angle) * 18, e.angle);
        playShot(G.audio, false);
        G.lastGunshot = { x: e.x, y: e.y, t: G.time };
      }
    } else if (e.state === 'guard') {
      e.angle += Math.sin(G.time * 0.5 + e.walkPhase) * 0.002;
    }
  }
}

export function spawnPickup(G, x, y, kind) {
  G.pickups.push({ x, y, kind, bob: Math.random() * 6, life: 0 });
}

function updatePickups(G, dt) {
  const p = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i -= 1) {
    const pk = G.pickups[i];
    pk.life += dt;
    pk.bob += dt * 3;
    if (pk.life > 60) { G.pickups.splice(i, 1); continue; }
    if (p.inCar || p.dead) continue;
    if (dist(p.x, p.y, pk.x, pk.y) < 26) {
      collectPickup(G, pk);
      G.pickups.splice(i, 1);
    }
  }
}

function collectPickup(G, pk) {
  const p = G.player;
  if (pk.kind === 'health') {
    healPlayer(G, 45);
    addFloat(G, p.x, p.y - 20, '+45 HEALTH', '#7CFC00');
    playPickup(G.audio);
  } else if (pk.kind === 'armor') {
    p.armor = clamp(p.armor + 50, 0, 100);
    addFloat(G, p.x, p.y - 20, '+50 ARMOR', '#7ec8ff');
    playPickup(G.audio);
  } else if (pk.kind === 'smg') {
    p.weapon = 'smg';
    p.smgAmmo = 120;
    addFloat(G, p.x, p.y - 20, 'SMG ACQUIRED', '#ffd24d');
    playPickup(G.audio);
  } else if (pk.kind === 'cash') {
    const amount = 25 + Math.floor(Math.random() * 75);
    p.cash += amount;
    addFloat(G, p.x, p.y - 20, '+$' + amount, '#7CFC00');
    playCash(G.audio);
  }
}

export function drawEnemy(g, e, time) {
  if (e.dead) {
    g.save();
    g.translate(e.x, e.y);
    g.rotate(e.angle + Math.PI / 2);
    g.globalAlpha = Math.max(0, 1 - (e.fade || 0) / 4);
    g.fillStyle = e.shirt;
    g.beginPath();
    g.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    return;
  }
  g.save();
  g.translate(e.x, e.y);
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath();
  g.ellipse(2, 4, 9, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.rotate(e.angle);
  g.fillStyle = '#222222';
  g.fillRect(-7, -6, 10, 4);
  g.fillRect(-7, 2, 10, 4);
  g.fillStyle = e.shirt;
  g.beginPath();
  g.arc(0, 0, 8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#222222';
  g.fillRect(8, -1.5, 10, 3);
  g.fillStyle = '#e8b88a';
  g.beginPath();
  g.arc(1, 0, 5, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // Health bar when hurt.
  if (e.hp < e.maxHp) {
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(e.x - 14, e.y - 22, 28, 4);
    g.fillStyle = '#e74c3c';
    g.fillRect(e.x - 13, e.y - 21, 26 * (e.hp / e.maxHp), 2);
  }
}

export function drawPickup(g, pk, time) {
  const y = pk.y + Math.sin(pk.bob) * 3;
  g.save();
  g.translate(pk.x, y);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(0, 10, 10, 4, 0, 0, Math.PI * 2);
  g.fill();
  if (pk.kind === 'health') {
    g.fillStyle = '#ffffff';
    g.fillRect(-9, -9, 18, 18);
    g.fillStyle = '#e74c3c';
    g.fillRect(-2.5, -7, 5, 14);
    g.fillRect(-7, -2.5, 14, 5);
  } else if (pk.kind === 'armor') {
    g.fillStyle = '#3498db';
    g.beginPath();
    g.moveTo(0, -10);
    g.lineTo(9, -6);
    g.lineTo(9, 2);
    g.quadraticCurveTo(9, 9, 0, 11);
    g.quadraticCurveTo(-9, 9, -9, 2);
    g.lineTo(-9, -6);
    g.closePath();
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = 'bold 10px Arial';
    g.textAlign = 'center';
    g.fillText('A', 0, 4);
  } else if (pk.kind === 'smg') {
    g.fillStyle = '#222222';
    g.fillRect(-11, -3, 22, 6);
    g.fillRect(-2, 3, 5, 7);
    g.fillStyle = '#888888';
    g.fillRect(8, -1.5, 6, 3);
  } else {
    g.fillStyle = '#27ae60';
    g.beginPath();
    g.arc(0, 0, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = 'bold 11px Arial';
    g.textAlign = 'center';
    g.fillText('$', 0, 4);
  }
  g.restore();
}

export function drawBullets(g) {
  // Bullets are drawn by render.js from G.bullets; kept here for the outline.
}

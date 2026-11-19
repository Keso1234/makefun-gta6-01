// Cars: arcade physics (forward speed plus a gripped lateral slide, so the
// handbrake really drifts), damage, smoke and fire, and top-down drawing for
// every model, including the police light bar.

import { CAR_MODELS, CAR_COLORS } from './config.js';
import { clamp, randPick } from './utils.js';
import { collideCircle } from './city.js';
import { spawnSparks, spawnSmoke, spawnExplosion, addSkid } from './particles.js';
import { playCrash, playExplosion } from './audio.js';

let nextId = 1;

export function createCar(model, x, y, angle, driver, color) {
  const spec = CAR_MODELS[model];
  return {
    id: nextId++,
    model,
    spec,
    x, y, angle,
    vx: 0, vy: 0,
    speed: 0,
    color: color || randPick(Math.random, CAR_COLORS),
    health: spec.health,
    driver: driver || null,
    sirenPhase: Math.random() * 10,
    smokeTimer: 0,
    skidTimer: 0,
    dead: false,
    removed: false,
    honkTimer: 0,
  };
}

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Arcade drive: `ctrl` is { throttle -1..1, steer -1..1, handbrake bool }.
export function driveCar(G, car, ctrl, dt) {
  const spec = car.spec;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const rx = -fy;
  const ry = fx;
  let fSpeed = car.vx * fx + car.vy * fy;
  let lSpeed = car.vx * rx + car.vy * ry;

  if (ctrl.throttle > 0) fSpeed += ctrl.throttle * spec.accel * dt;
  else if (ctrl.throttle < 0) {
    if (fSpeed > 30) fSpeed += ctrl.throttle * spec.accel * 2.2 * dt; // brake
    else fSpeed += ctrl.throttle * spec.accel * 0.6 * dt; // reverse
  }
  fSpeed -= fSpeed * 0.35 * dt;
  fSpeed -= fSpeed * Math.abs(fSpeed) * 0.00045 * dt;
  if (ctrl.handbrake) fSpeed -= fSpeed * 0.9 * dt;
  fSpeed = clamp(fSpeed, -130, spec.topSpeed);

  const speedFactor = clamp(fSpeed / 140, -1, 1);
  const turnRate = 2.9 / (1 + Math.abs(fSpeed) / 420);
  car.angle += ctrl.steer * turnRate * speedFactor * dt * (fSpeed < 0 ? -1 : 1);

  const grip = ctrl.handbrake ? spec.grip * 0.22 : spec.grip;
  lSpeed *= Math.exp(-grip * dt);

  const nfx = Math.cos(car.angle);
  const nfy = Math.sin(car.angle);
  const nrx = -nfy;
  const nry = nfx;
  car.vx = nfx * fSpeed + nrx * lSpeed;
  car.vy = nfy * fSpeed + nry * lSpeed;
  car.speed = fSpeed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // Skid marks while drifting or handbraking hard.
  if ((ctrl.handbrake && Math.abs(fSpeed) > 120) || Math.abs(lSpeed) > 90) {
    car.skidTimer -= dt;
    if (car.skidTimer <= 0) {
      car.skidTimer = 0.05;
      addSkid(G, car.x - nfx * spec.len * 0.3, car.y - nfy * spec.len * 0.3, car.angle);
    }
  }
  collideCarWorld(G, car);
}

function collideCarWorld(G, car) {
  const spec = car.spec;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const r = spec.wid * 0.58;
  for (const off of [-0.3, 0.3]) {
    const cx = car.x + fx * spec.len * off;
    const cy = car.y + fy * spec.len * off;
    const fixed = collideCircle(G.city, cx, cy, r);
    const dx = fixed.x - cx;
    const dy = fixed.y - cy;
    if (dx !== 0 || dy !== 0) {
      const impact = Math.abs(car.vx * dx + car.vy * dy) / (Math.hypot(dx, dy) || 1);
      car.x += dx;
      car.y += dy;
      car.vx *= 0.45;
      car.vy *= 0.45;
      car.speed *= 0.45;
      if (impact > 90) {
        damageCar(G, car, impact * 0.09, null);
        spawnSparks(G, cx, cy, Math.atan2(dy, dx));
        if (car.driver === 'player') {
          playCrash(G.audio);
          G.shake = Math.min(14, G.shake + impact * 0.03);
        }
      }
    }
  }
}

// Push overlapping cars apart and trade a little damage.
export function collideCars(G) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.removed) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.removed) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const rr = (a.spec.len + b.spec.len) / 4 + 4;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const push = (rr - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const rel = Math.abs((b.vx - a.vx) * nx + (b.vy - a.vy) * ny);
      const exchange = rel * 0.4;
      a.vx -= nx * exchange;
      a.vy -= ny * exchange;
      b.vx += nx * exchange;
      b.vy += ny * exchange;
      if (rel > 110) {
        damageCar(G, a, rel * 0.06, null);
        damageCar(G, b, rel * 0.06, null);
        spawnSparks(G, (a.x + b.x) / 2, (a.y + b.y) / 2, Math.atan2(dy, dx));
        if (a.driver === 'player' || b.driver === 'player') {
          playCrash(G.audio);
          G.shake = Math.min(12, G.shake + rel * 0.02);
        }
      }
    }
  }
}

export function damageCar(G, car, amount, cause) {
  if (car.dead || car.removed) return;
  // Screenshot staging is gentle with the cars so the scene stays intact.
  if (G.shotMode) amount *= 0.3;
  car.health -= amount;
  if (car.health <= 0 && !car.dead) {
    car.dead = true;
    car.health = 0;
    spawnExplosion(G, car.x, car.y);
    playExplosion(G.audio);
    G.shake = Math.min(18, G.shake + 10);
    if (car.driver === 'player') {
      // The player's ride blew up: eject them, hurt.
      G.player.inCar = null;
      car.driver = null;
      G.player.x = car.x + 40;
      G.player.y = car.y;
      G.player.health -= 25;
    }
    car.removeTimer = 3;
  }
}

export function updateCarDamage(G, car, dt) {
  if (car.dead) {
    car.removeTimer -= dt;
    if (car.removeTimer <= 0) car.removed = true;
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.12;
      spawnSmoke(G, car.x + (Math.random() - 0.5) * 20, car.y + (Math.random() - 0.5) * 12);
    }
    car.vx *= Math.max(0, 1 - 3 * dt);
    car.vy *= Math.max(0, 1 - 3 * dt);
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    return;
  }
  if (car.health < 45) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = car.health < 20 ? 0.06 : 0.18;
      spawnSmoke(G, car.x + Math.cos(car.angle) * car.spec.len * 0.35, car.y + Math.sin(car.angle) * car.spec.len * 0.35);
    }
  }
}

export function drawCar(g, car, time) {
  const spec = car.spec;
  const L = spec.len;
  const W = spec.wid;
  g.save();
  g.translate(car.x, car.y);
  // Soft shadow.
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(4, 6, L * 0.52, W * 0.62, car.angle, 0, Math.PI * 2);
  g.fill();
  g.rotate(car.angle);
  // Wheels.
  g.fillStyle = '#1a1a1a';
  const ww = 9;
  const wh = 4;
  g.fillRect(-L * 0.32 - ww / 2, -W / 2 - 1, ww, wh);
  g.fillRect(-L * 0.32 - ww / 2, W / 2 - wh + 1, ww, wh);
  g.fillRect(L * 0.32 - ww / 2, -W / 2 - 1, ww, wh);
  g.fillRect(L * 0.32 - ww / 2, W / 2 - wh + 1, ww, wh);
  // Body.
  const bodyColor = car.model === 'police' ? '#eef1f3' : car.model === 'taxi' ? '#f7c948' : car.color;
  roundRectPath(g, -L / 2, -W / 2, L, W, 7);
  g.fillStyle = bodyColor;
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 1.5;
  g.stroke();
  if (car.model === 'police') {
    g.fillStyle = '#1c2430';
    g.fillRect(-L * 0.08, -W / 2 + 1, L * 0.3, W - 2);
    g.fillStyle = '#1c2430';
    g.font = 'bold 7px Arial';
    g.textAlign = 'center';
    g.fillText('POLICE', 0, -W / 2 + 8);
  }
  // Cabin: windshield, roof, rear window.
  g.fillStyle = '#9fc6dd';
  roundRectPath(g, L * 0.12, -W / 2 + 4, L * 0.16, W - 8, 3);
  g.fill();
  g.fillStyle = car.model === 'truck' ? '#d8d3c8' : shade(bodyColor, -18);
  roundRectPath(g, -L * 0.22, -W / 2 + 3, L * 0.3, W - 6, 4);
  g.fill();
  g.fillStyle = '#9fc6dd';
  roundRectPath(g, -L * 0.42, -W / 2 + 4, L * 0.12, W - 8, 3);
  g.fill();
  if (car.model === 'sports') {
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(-L / 2 - 2, -W / 2 + 2, 4, W - 4);
  }
  if (car.model === 'taxi') {
    g.fillStyle = '#ffffff';
    g.fillRect(-6, -4, 12, 8);
    g.fillStyle = '#111111';
    g.font = 'bold 6px Arial';
    g.textAlign = 'center';
    g.fillText('TAXI', 0, 2);
  }
  if (car.model === 'truck') {
    g.fillStyle = '#cfc9bb';
    g.fillRect(-L / 2 + 2, -W / 2 + 2, L * 0.42, W - 4);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.strokeRect(-L / 2 + 2, -W / 2 + 2, L * 0.42, W - 4);
  }
  // Headlights and taillights.
  g.fillStyle = '#fff8c0';
  g.fillRect(L / 2 - 3, -W / 2 + 3, 3, 5);
  g.fillRect(L / 2 - 3, W / 2 - 8, 3, 5);
  g.fillStyle = '#e33';
  g.fillRect(-L / 2, -W / 2 + 3, 3, 5);
  g.fillRect(-L / 2, W / 2 - 8, 3, 5);
  // Police light bar, alternating red and blue.
  if (car.model === 'police') {
    const phase = Math.floor(time * 6 + car.sirenPhase) % 2 === 0;
    g.fillStyle = phase ? '#ff2a2a' : '#2a6bff';
    g.fillRect(-4, -W / 2 + 5, 8, 5);
    g.fillStyle = phase ? '#2a6bff' : '#ff2a2a';
    g.fillRect(-4, W / 2 - 10, 8, 5);
    g.fillStyle = phase ? 'rgba(255,42,42,0.25)' : 'rgba(42,107,255,0.25)';
    g.beginPath();
    g.arc(0, 0, 34, 0, Math.PI * 2);
    g.fill();
  }
  // Burnt wreck tint.
  if (car.dead) {
    roundRectPath(g, -L / 2, -W / 2, L, W, 7);
    g.fillStyle = 'rgba(20,20,20,0.55)';
    g.fill();
  }
  g.restore();
}

function shade(hex, amt) {
  if (!hex || hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const gg = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return 'rgb(' + r + ',' + gg + ',' + b + ')';
}

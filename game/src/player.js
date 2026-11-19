// The player: Kai Marlow, on foot or behind the wheel. On foot he walks, runs
// and aims with the mouse; in a car the same keys drive. E is the do-everything
// key: steal or enter a car, start a mission, save at the hideout.

import { PLAYER } from './config.js';
import { clamp, dist, angleTo } from './utils.js';
import { collideCircle } from './city.js';
import { driveCar } from './vehicles.js';
import { addFloat } from './particles.js';
import { keyDown, keyPressed, moveVector } from './input.js';
import { addCrime } from './wanted.js';
import { tryPlayerFire } from './combat.js';
import { setEngine } from './audio.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    health: PLAYER.maxHealth,
    armor: 0,
    cash: 250,
    weapon: 'pistol',
    smgAmmo: 0,
    inCar: null,
    speed: 0,
    walkPhase: 0,
    moving: false,
    fireCooldown: 0,
    hurtFlash: 0,
    dead: false,
  };
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  if (p.dead) return;
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt * 2.2);

  if (p.inCar) {
    updateDriving(G, dt);
    return;
  }

  // On foot.
  const mv = moveVector(input);
  const running = keyDown(input, 'ShiftLeft') || keyDown(input, 'ShiftRight');
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.moving = mv.x !== 0 || mv.y !== 0;
  if (p.moving) {
    p.walkPhase += dt * (running ? 13 : 9);
    const nx = p.x + mv.x * speed * dt;
    const ny = p.y + mv.y * speed * dt;
    const fixed = collideCircle(G.city, nx, ny, PLAYER.radius);
    p.x = fixed.x;
    p.y = fixed.y;
    p.speed = speed;
    // Face the way we run when not aiming; the mouse wins while firing.
    if (!input.mouseDown) p.angle = Math.atan2(mv.y, mv.x);
  } else {
    p.speed = 0;
  }

  // Aim at the mouse in world space.
  const wx = G.camera.x + input.mouseX / G.zoom;
  const wy = G.camera.y + input.mouseY / G.zoom;
  if (input.mouseDown || p.aiming) p.angle = angleTo(p.x, p.y, wx, wy);
  if (input.mouseDown) tryPlayerFire(G, dt);

  if (keyPressed(input, 'KeyE')) tryInteract(G);
  setEngine(G.audio, 0, false);
}

function updateDriving(G, dt) {
  const p = G.player;
  const car = p.inCar;
  const input = G.input;
  const throttle = (keyDown(input, 'KeyW') || keyDown(input, 'ArrowUp') ? 1 : 0) - (keyDown(input, 'KeyS') || keyDown(input, 'ArrowDown') ? 1 : 0);
  const steer = (keyDown(input, 'KeyD') || keyDown(input, 'ArrowRight') ? 1 : 0) - (keyDown(input, 'KeyA') || keyDown(input, 'ArrowLeft') ? 1 : 0);
  const handbrake = keyDown(input, 'Space');
  driveCar(G, car, { throttle, steer, handbrake }, dt);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = Math.abs(car.speed);
  setEngine(G.audio, Math.abs(car.speed) / car.spec.topSpeed, true);
  if (keyPressed(input, 'KeyE')) exitCar(G);
}

export function enterCar(G, car) {
  const p = G.player;
  if (p.inCar || car.dead) return false;
  // Stealing a traffic car: its driver bails out and flees.
  if (car.driver === 'traffic') {
    addCrime(G, 'stealCar');
    G.fleeFrom = { x: car.x, y: car.y, t: 0 };
    spawnFleeingDriver(G, car);
    G.banner = { text: 'CAR STOLEN', sub: 'The owner called the cops', t: 0, dur: 2.2 };
  } else if (car.driver === 'police') {
    addCrime(G, 'stealCar');
    addCrime(G, 'stealCar');
    G.banner = { text: 'POLICE CAR STOLEN', sub: 'That was bold', t: 0, dur: 2.2 };
  }
  car.driver = 'player';
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
  return true;
}

function spawnFleeingDriver(G, car) {
  const a = car.angle + Math.PI / 2;
  G.peds.push({
    x: car.x + Math.cos(a) * 26,
    y: car.y + Math.sin(a) * 26,
    angle: a,
    speed: 0,
    shirt: '#e67e22',
    skin: '#c68642',
    state: 'flee',
    fleeX: car.x,
    fleeY: car.y,
    fleeT: 4,
    walkPhase: Math.random() * 6,
    down: 0,
  });
}

export function exitCar(G) {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  car.driver = null;
  p.inCar = null;
  const side = car.angle + Math.PI / 2;
  const nx = car.x + Math.cos(side) * 30;
  const ny = car.y + Math.sin(side) * 30;
  const fixed = collideCircle(G.city, nx, ny, PLAYER.radius);
  p.x = fixed.x;
  p.y = fixed.y;
  p.angle = car.angle;
  setEngine(G.audio, 0, false);
}

function tryInteract(G) {
  const p = G.player;
  // Mission start marker first.
  const marker = G.missionMarker;
  if (marker && dist(p.x, p.y, marker.x, marker.y) < 90) {
    G.startMissionRequest = marker.missionIndex;
    return;
  }
  // Taxi rank: start a fare.
  if (G.taxiJob && !G.taxiJob.active && dist(p.x, p.y, G.taxiJob.x, G.taxiJob.y) < 80) {
    G.startTaxiRequest = true;
    return;
  }
  // Hideout: save the game.
  if (dist(p.x, p.y, G.city.places.hideout.x, G.city.places.hideout.y) < 80) {
    G.saveRequest = true;
    return;
  }
  // Nearest car.
  let best = null;
  let bd = 70;
  for (const car of G.cars) {
    if (car.dead || car.removed) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  if (best) enterCar(G, best);
}

export function damagePlayer(G, amount, cause) {
  const p = G.player;
  if (p.dead) return;
  // Screenshot staging never kills the player mid-frame.
  if (G.shotMode) amount *= 0.1;
  let remaining = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, remaining * 0.6);
    p.armor -= absorbed;
    remaining -= absorbed;
  }
  p.health -= remaining;
  p.hurtFlash = 1;
  G.shake = Math.min(10, G.shake + 4);
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    G.deathCause = cause || 'wasted';
  }
}

export function healPlayer(G, amount) {
  G.player.health = clamp(G.player.health + amount, 0, PLAYER.maxHealth);
}

export function addCash(G, amount, x, y) {
  G.player.cash += amount;
  if (x !== undefined) {
    addFloat(G, x, y, (amount >= 0 ? '+' : '') + '$' + Math.abs(Math.floor(amount)), amount >= 0 ? '#7CFC00' : '#ff6b6b');
  }
}

// Top-down walker: shadow, legs that swing, torso, head, and a gun arm when firing.
export function drawPlayer(g, p, time) {
  const bob = p.moving ? Math.sin(p.walkPhase) * 2 : 0;
  g.save();
  g.translate(p.x, p.y);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(3, 5, 11, 8, 0, 0, Math.PI * 2);
  g.fill();
  g.rotate(p.angle);
  // Legs.
  g.fillStyle = '#2c3e50';
  g.fillRect(-8, -7 + bob * 0.5, 12, 5);
  g.fillRect(-8, 2 - bob * 0.5, 12, 5);
  // Torso (Kai's teal jacket).
  g.fillStyle = '#1abc9c';
  g.beginPath();
  g.arc(0, 0, 9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#16a085';
  g.beginPath();
  g.arc(2, 0, 6, 0, Math.PI * 2);
  g.fill();
  // Gun arm and pistol.
  g.fillStyle = '#1abc9c';
  g.fillRect(4, -3, 10, 5);
  g.fillStyle = '#222222';
  g.fillRect(10, -1.5, 9, 3);
  // Head.
  g.fillStyle = '#e8b88a';
  g.beginPath();
  g.arc(0, 0, 5.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3a2a1a';
  g.beginPath();
  g.arc(-1.5, 0, 4.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

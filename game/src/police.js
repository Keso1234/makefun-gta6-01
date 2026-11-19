// The Solmar PD: patrol cars that spawn by wanted level and chase the player
// down, ramming to stop them, and foot officers who pile out to make the
// arrest — or open fire at three stars and up. Lose them out of sight and the
// heat cools; the siren fades with the last car.

import { randomRoadPoint, hasLineOfSight, collideCircle, nearestNode, onRoad } from './city.js';
import { createCar, driveCar, updateCarDamage } from './vehicles.js';
import { angleDiff, angleTo, clamp, dist } from './utils.js';
import { spawnBullet } from './combat.js';
import { setSiren } from './audio.js';

const CARS_BY_STARS = [0, 1, 2, 3, 4, 5];
const COPS_BY_STARS = [0, 0, 2, 3, 4, 4];

export function createPoliceState() {
  return { spawnTimer: 0, sirenOn: false };
}

export function updatePolice(G, dt) {
  const stars = G.wanted.stars;
  const p = G.player;

  // Count current units.
  let cars = 0;
  let cops = 0;
  for (const car of G.cars) if (car.driver === 'police' && !car.removed) cars += 1;
  cops = G.cops.length;

  // Spawn patrol cars up to the wanted level's quota.
  G.police.spawnTimer -= dt;
  if (stars > 0 && cars < CARS_BY_STARS[stars] && G.police.spawnTimer <= 0) {
    G.police.spawnTimer = 1.4;
    spawnPoliceCar(G);
  }
  // Foot officers join once the player is on foot and wanted.
  if (stars >= 2 && !p.inCar && cops < COPS_BY_STARS[stars] && G.police.spawnTimer <= 0) {
    G.police.spawnTimer = 1.0;
    spawnFootCop(G);
  }

  // Drive the pursuit.
  let seen = false;
  let anyNear = false;
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.removed) continue;
    updateCarDamage(G, car, dt);
    if (car.dead) continue;
    if (stars === 0) {
      // Heat off: the unit pulls away and leaves.
      car.leaving = true;
      driveCar(G, car, { throttle: 0.6, steer: 0, handbrake: false }, dt);
      if (dist(car.x, car.y, p.x, p.y) > 1000) car.removed = true;
      continue;
    }
    car.leaving = false;
    const d = dist(car.x, car.y, p.x, p.y);
    if (d < 700) anyNear = true;
    if (d < 560 && hasLineOfSight(G.city, car.x, car.y, p.x, p.y)) seen = true;
    pursuitDrive(G, car, dt);
  }

  // Foot officers.
  for (let i = G.cops.length - 1; i >= 0; i -= 1) {
    const cop = G.cops[i];
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (stars === 0 || d > 1300) {
      G.cops.splice(i, 1);
      continue;
    }
    if (d < 520 && hasLineOfSight(G.city, cop.x, cop.y, p.x, p.y)) seen = true;
    if (d < 700) anyNear = true;
    updateFootCop(G, cop, dt, d);
  }

  G.wanted.seen = seen;
  setSiren(G.audio, anyNear && stars > 0);
}

function spawnPoliceCar(G) {
  const pt = randomRoadPoint(Math.random, G.player.x, G.player.y, 850);
  const car = createCar('police', pt.x, pt.y, angleTo(pt.x, pt.y, G.player.x, G.player.y), 'police', '#ffffff');
  G.cars.push(car);
}

function spawnFootCop(G) {
  const pt = randomRoadPoint(Math.random, G.player.x, G.player.y, 420);
  G.cops.push({
    x: pt.x, y: pt.y, angle: 0, walkPhase: Math.random() * 6,
    bust: 0, shootTimer: 1 + Math.random(), speed: 0,
  });
}

function pursuitDrive(G, car, dt) {
  const p = G.player;
  const d = dist(car.x, car.y, p.x, p.y);
  let tx;
  let ty;
  if (!onRoad(car.x, car.y)) {
    // Knocked off the road: get back to the nearest intersection first.
    const node = nearestNode(G.city, car.x, car.y);
    tx = node.x;
    ty = node.y;
  } else if (d > 240) {
    // Far off: head for the player's nearest intersection, so the chase stays
    // on the roads instead of ploughing through buildings.
    const node = nearestNode(G.city, p.x, p.y);
    tx = node.x;
    ty = node.y;
  } else {
    // Close in: aim slightly ahead of the player and ram.
    const lead = 0.35;
    tx = p.x + (p.inCar ? p.inCar.vx * lead : 0);
    ty = p.y + (p.inCar ? p.inCar.vy * lead : 0);
  }
  const targetAngle = angleTo(car.x, car.y, tx, ty);
  const turn = angleDiff(car.angle, targetAngle);
  let steer = clamp(turn * 2.6, -1, 1);
  let throttle = d < 60 ? 0.5 : 1;
  // Brake into sharp turns like a driver who wants to make the corner.
  if (Math.abs(turn) > 0.5 && Math.abs(car.speed) > 220) throttle = -0.6;
  // Stuck against something? Back out and try again.
  car.stuckTimer = car.stuckTimer || 0;
  car.reverseTimer = car.reverseTimer || 0;
  if (Math.abs(car.speed) < 25 && d > 80) {
    car.stuckTimer += dt;
    if (car.stuckTimer > 1.2) {
      car.reverseTimer = 0.8;
      car.stuckTimer = 0;
    }
  } else {
    car.stuckTimer = 0;
  }
  if (car.reverseTimer > 0) {
    car.reverseTimer -= dt;
    throttle = -1;
    steer = -steer;
  }
  driveCar(G, car, { throttle, steer, handbrake: false }, dt);

  // Close on a player on foot: bail out and chase on foot.
  if (!p.inCar && d < 70 && Math.abs(car.speed) < 120 && G.cops.length < COPS_BY_STARS[G.wanted.stars]) {
    car.driver = null; // the empty cruiser can be stolen now
    G.cops.push({
      x: car.x + 24, y: car.y, angle: 0, walkPhase: 0,
      bust: 0, shootTimer: 1, speed: 0,
    });
  }
}

function updateFootCop(G, cop, dt, d) {
  const p = G.player;
  const stars = G.wanted.stars;
  cop.shootTimer -= dt;
  if (p.inCar && Math.abs(p.inCar.speed) > 150) {
    // Cannot catch a speeding car: hold position and radio it in.
    cop.bust = 0;
    return;
  }
  const targetAngle = angleTo(cop.x, cop.y, p.x, p.y);
  cop.angle = targetAngle;
  const speed = 252;
  cop.walkPhase += dt * 13;
  const nx = cop.x + Math.cos(targetAngle) * speed * dt;
  const ny = cop.y + Math.sin(targetAngle) * speed * dt;
  const fixed = collideCircle(G.city, nx, ny, 11);
  cop.x = fixed.x;
  cop.y = fixed.y;

  // Bust: standing on the player while they are slow.
  if (d < 30 && p.speed < 90 && !p.inCar) {
    cop.bust += dt;
    G.bustProgress = Math.max(G.bustProgress || 0, cop.bust / 1.2);
    if (cop.bust > 1.2) G.bustedRequest = true;
  } else {
    cop.bust = Math.max(0, cop.bust - dt * 2);
  }
  // Shoot at three stars and up, inaccurately.
  if (stars >= 3 && d < 380 && d > 60 && cop.shootTimer <= 0 && hasLineOfSight(G.city, cop.x, cop.y, p.x, p.y)) {
    cop.shootTimer = 0.9 + Math.random() * 0.7;
    spawnBullet(G, cop.x, cop.y, targetAngle + (Math.random() - 0.5) * 0.22, 'enemy', 8);
  }
}

export function drawCop(g, cop, time) {
  const bob = Math.sin(cop.walkPhase) * 1.6;
  g.save();
  g.translate(cop.x, cop.y);
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath();
  g.ellipse(2, 4, 9, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.rotate(cop.angle);
  g.fillStyle = '#1c2430';
  g.fillRect(-7, -6 + bob * 0.4, 10, 4);
  g.fillRect(-7, 2 - bob * 0.4, 10, 4);
  g.fillStyle = '#24344d';
  g.beginPath();
  g.arc(0, 0, 8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f1c40f';
  g.beginPath();
  g.arc(5, -3, 1.8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e8b88a';
  g.beginPath();
  g.arc(1, 0, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#16202e';
  g.beginPath();
  g.arc(0, 0, 5, Math.PI * 0.5, Math.PI * 1.5);
  g.fill();
  g.fillRect(3, -5, 5, 2);
  g.restore();
}

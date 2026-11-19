// Pedestrians: Solmar's residents strolling the sidewalks, who scatter when
// gunfire cracks or a car mounts the kerb. They are the city's life — and the
// reason reckless driving earns stars.

import { ROAD_W, WORLD_W, WORLD_H } from './config.js';
import { collideCircle, randomRoadPoint, onRoad } from './city.js';
import { dist, angleTo, randPick, clamp } from './utils.js';
import { spawnBlood } from './particles.js';
import { addCrime } from './wanted.js';
import { playHit } from './audio.js';

const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8', '#2ecc71', '#f39c12'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const PED_COUNT = 26;

export function initPeds(G) {
  for (let i = 0; i < PED_COUNT; i += 1) spawnPed(G, true);
}

export function spawnPed(G, anywhere) {
  const p = G.player;
  const pt = randomRoadPoint(Math.random, p.x, p.y, anywhere ? 1000 : 800);
  // Stand on a sidewalk beside the road.
  const onVertical = Math.abs(pt.x - Math.round(pt.x / 400) * 400) < 200;
  const side = Math.random() < 0.5 ? -1 : 1;
  const x = onVertical ? pt.x + side * (ROAD_W / 2 + 9) : pt.x;
  const y = onVertical ? pt.y : pt.y + side * (ROAD_W / 2 + 9);
  const ped = {
    x: clamp(x, 30, WORLD_W - 30),
    y: clamp(y, 30, WORLD_H - 30),
    angle: Math.random() * Math.PI * 2,
    speed: 0,
    shirt: randPick(Math.random, SHIRTS),
    skin: randPick(Math.random, SKINS),
    state: 'walk',
    walkPhase: Math.random() * 6,
    tx: 0, ty: 0,
    fleeT: 0,
    down: 0,
  };
  pickWalkTarget(G, ped);
  G.peds.push(ped);
  return ped;
}

function pickWalkTarget(G, ped) {
  // A new sidewalk point: a road point near the ped, offset onto the kerb.
  const pt = randomRoadPoint(Math.random, ped.x, ped.y, 420);
  const side = Math.random() < 0.5 ? -1 : 1;
  const vertical = Math.random() < 0.5;
  ped.tx = clamp(vertical ? pt.x + side * (ROAD_W / 2 + 9) : pt.x, 30, WORLD_W - 30);
  ped.ty = clamp(vertical ? pt.y : pt.y + side * (ROAD_W / 2 + 9), 30, WORLD_H - 30);
}

export function scarePeds(G, x, y, radius) {
  for (const ped of G.peds) {
    if (ped.down > 0) continue;
    if (dist(ped.x, ped.y, x, y) < radius) {
      ped.state = 'flee';
      ped.fleeX = x;
      ped.fleeY = y;
      ped.fleeT = 2.5 + Math.random() * 2;
    }
  }
}

export function updatePeds(G, dt) {
  let count = 0;
  for (let i = G.peds.length - 1; i >= 0; i -= 1) {
    const ped = G.peds[i];
    count += 1;
    if (dist(ped.x, ped.y, G.player.x, G.player.y) > 1500) {
      G.peds.splice(i, 1);
      count -= 1;
      continue;
    }
    if (ped.down > 0) {
      ped.down -= dt;
      if (ped.down <= 0) {
        ped.state = 'flee';
        ped.fleeT = 5;
        ped.fleeX = G.player.x;
        ped.fleeY = G.player.y;
      }
      continue;
    }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const away = angleTo(ped.fleeX, ped.fleeY, ped.x, ped.y);
      ped.angle = away;
      movePed(G, ped, away, 285, dt);
      if (ped.fleeT <= 0) {
        ped.state = 'walk';
        pickWalkTarget(G, ped);
      }
    } else {
      // Flee from nearby gunfire or the player's speeding car.
      if (G.lastGunshot && dist(ped.x, ped.y, G.lastGunshot.x, G.lastGunshot.y) < 260 && G.time - G.lastGunshot.t < 1.5) {
        ped.state = 'flee';
        ped.fleeX = G.lastGunshot.x;
        ped.fleeY = G.lastGunshot.y;
        ped.fleeT = 3;
        continue;
      }
      const targetAngle = angleTo(ped.x, ped.y, ped.tx, ped.ty);
      ped.angle = targetAngle;
      movePed(G, ped, targetAngle, 68, dt);
      if (dist(ped.x, ped.y, ped.tx, ped.ty) < 14) pickWalkTarget(G, ped);
    }
    // Hit by a moving car?
    for (const car of G.cars) {
      if (car.removed || car.dead) continue;
      if (Math.abs(car.speed) < 70) continue;
      if (dist(ped.x, ped.y, car.x, car.y) < 24) {
        ped.down = 3.5;
        ped.state = 'down';
        spawnBlood(G, ped.x, ped.y);
        playHit(G.audio);
        if (car.driver === 'player') addCrime(G, 'hitPed');
        scarePeds(G, ped.x, ped.y, 220);
        break;
      }
    }
  }
  while (count < PED_COUNT) {
    spawnPed(G, false);
    count += 1;
  }
}

function movePed(G, ped, angle, speed, dt) {
  ped.walkPhase += dt * (speed > 150 ? 14 : 8);
  ped.speed = speed;
  const nx = ped.x + Math.cos(angle) * speed * dt;
  const ny = ped.y + Math.sin(angle) * speed * dt;
  const fixed = collideCircle(G.city, nx, ny, 10);
  // If blocked, pick a new target rather than grinding against a wall.
  if (Math.abs(fixed.x - nx) > 2 || Math.abs(fixed.y - ny) > 2) {
    if (ped.state === 'walk') pickWalkTarget(G, ped);
    else ped.angle += 0.9;
  }
  ped.x = fixed.x;
  ped.y = fixed.y;
}

export function drawPed(g, ped, time) {
  g.save();
  g.translate(ped.x, ped.y);
  if (ped.down > 0) {
    // Lying flat.
    g.rotate(ped.angle + Math.PI / 2);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath();
    g.ellipse(2, 3, 13, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = ped.shirt;
    g.beginPath();
    g.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = ped.skin;
    g.beginPath();
    g.arc(12, 0, 4.5, 0, Math.PI * 2);
    g.fill();
    g.restore();
    return;
  }
  const bob = Math.sin(ped.walkPhase) * 1.6;
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath();
  g.ellipse(2, 4, 9, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.rotate(ped.angle);
  g.fillStyle = '#333333';
  g.fillRect(-7, -6 + bob * 0.4, 10, 4);
  g.fillRect(-7, 2 - bob * 0.4, 10, 4);
  g.fillStyle = ped.shirt;
  g.beginPath();
  g.arc(0, 0, 8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = ped.skin;
  g.beginPath();
  g.arc(1, 0, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2a1f14';
  g.beginPath();
  g.arc(0, 0, 4.5, Math.PI * 0.5, Math.PI * 1.5);
  g.fill();
  g.restore();
}

// Civilian traffic: cars that follow the road grid node to node, keep to the
// right-hand lane, brake for what is ahead of them, and honk at the player.
// Parked cars line the kerbs and are free to steal. The population is kept
// near the player and recycled as they drive off.

import { AVENUES_X, STREETS_Y, ROAD_W, WORLD_W, WORLD_H } from './config.js';
import { createCar, driveCar, updateCarDamage } from './vehicles.js';
import { nearestNode, nodeNeighbours, randomRoadPoint, onRoad } from './city.js';
import { angleDiff, dist, randPick, clamp } from './utils.js';
import { playHonk } from './audio.js';

const TRAFFIC_MODELS = ['sedan', 'sedan', 'coupe', 'taxi', 'van', 'sedan', 'coupe', 'truck'];
const TRAFFIC_COUNT = 13;
const PARKED_COUNT = 22;

export function initTraffic(G) {
  G.trafficSeed = 7;
  for (let i = 0; i < PARKED_COUNT; i += 1) spawnParkedCar(G);
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) spawnTrafficCar(G, true);
}

function spawnParkedCar(G) {
  const rng = Math.random;
  const vertical = rng() < 0.5;
  let x;
  let y;
  let angle;
  if (vertical) {
    x = randPick(rng, AVENUES_X) + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 16);
    y = 120 + rng() * (WORLD_H - 240);
    angle = rng() < 0.5 ? -Math.PI / 2 : Math.PI / 2;
  } else {
    y = randPick(rng, STREETS_Y) + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 16);
    x = 120 + rng() * (WORLD_W - 260);
    angle = rng() < 0.5 ? 0 : Math.PI;
  }
  // Keep the player's spawn street clear-ish.
  if (dist(x, y, G.player.x, G.player.y) < 120) return;
  const car = createCar(randPick(rng, TRAFFIC_MODELS), x, y, angle, null);
  G.cars.push(car);
}

function spawnTrafficCar(G, anywhere) {
  const p = G.player;
  const pt = anywhere
    ? randomRoadPoint(Math.random, p.x, p.y, 1100)
    : randomRoadPoint(Math.random, p.x, p.y, 900);
  const node = nearestNode(G.city, pt.x, pt.y);
  const car = createCar(randPick(Math.random, TRAFFIC_MODELS), pt.x, pt.y, Math.random() * Math.PI * 2, 'traffic');
  car.ai = { node, prev: null, cruise: 150 + Math.random() * 70, lane: 15 };
  G.cars.push(car);
}

export function updateTraffic(G, dt) {
  let trafficCount = 0;
  for (let i = G.cars.length - 1; i >= 0; i -= 1) {
    const car = G.cars[i];
    if (car.removed) { G.cars.splice(i, 1); continue; }
    updateCarDamage(G, car, dt);
    if (car.driver !== 'traffic' || car.dead) continue;
    trafficCount += 1;
    // Recycle cars that wandered far from the player.
    if (dist(car.x, car.y, G.player.x, G.player.y) > 1600) {
      G.cars.splice(i, 1);
      trafficCount -= 1;
      continue;
    }
    driveTrafficCar(G, car, dt);
  }
  while (trafficCount < TRAFFIC_COUNT) {
    spawnTrafficCar(G, false);
    trafficCount += 1;
  }
}

function driveTrafficCar(G, car, dt) {
  const ai = car.ai;
  // Pick a new node when we reach the current one.
  if (!ai.node || dist(car.x, car.y, ai.node.x, ai.node.y) < 40) {
    const options = nodeNeighbours(G.city, ai.node || nearestNode(G.city, car.x, car.y))
      .filter((n) => n !== ai.prev);
    ai.prev = ai.node;
    ai.node = options.length ? randPick(Math.random, options) : ai.prev;
  }
  const targetAngle = Math.atan2(ai.node.y - car.y, ai.node.x - car.x);
  const steer = clamp(angleDiff(car.angle, targetAngle) * 2.2, -1, 1);

  // Brake for anything stopped ahead.
  let throttle = 0.55;
  const ahead = obstacleAhead(G, car);
  if (ahead !== null) {
    throttle = ahead < 45 ? -0.9 : 0.1;
    if (ahead < 60 && car.honkTimer <= 0 && (G.player.inCar === car || obstacleIsPlayer(G, car))) {
      car.honkTimer = 3 + Math.random() * 3;
      playHonk(G.audio);
    }
  }
  car.honkTimer -= dt;
  // Ease toward cruise speed.
  if (car.speed > ai.cruise) throttle = Math.min(throttle, 0);
  driveCar(G, car, { throttle, steer, handbrake: false }, dt);
}

// Distance to the nearest car ahead in our lane, or null.
function obstacleAhead(G, car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let best = null;
  for (const other of G.cars) {
    if (other === car || other.removed) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = dx * fx + dy * fy;
    const lateral = Math.abs(dx * -fy + dy * fx);
    if (forward > 10 && forward < 110 && lateral < 26) {
      if (best === null || forward < best) best = forward;
    }
  }
  return best;
}

function obstacleIsPlayer(G, car) {
  const p = G.player;
  if (!p.inCar) return false;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const dx = p.x - car.x;
  const dy = p.y - car.y;
  return dx * fx + dy * fy > 0 && dx * fx + dy * fy < 110 && Math.abs(dx * -fy + dy * fx) < 26;
}

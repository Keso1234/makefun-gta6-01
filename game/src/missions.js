// The story: five missions for Kai Marlow, from a first fare for Mama Rosa to
// the Grand Solmar getaway, plus a repeatable taxi job. Each mission is data —
// a list of steps (go to, steal, drive, survive a timer, clear enemies, pick
// up, escape) — and this module runs the state machine around them.

import { PLACES } from './config.js';
import { dist } from './utils.js';
import { createCar } from './vehicles.js';
import { spawnEnemy, spawnPickup } from './combat.js';
import { setWanted, clearWanted } from './wanted.js';
import { saveGame } from './save.js';
import { playMissionPass, playMissionFail, playCash } from './audio.js';
import { addCash } from './player.js';

export const MISSIONS = [
  {
    id: 'first-fare',
    name: 'First Fare',
    giver: 'Mama Rosa',
    start: PLACES.diner,
    reward: 150,
    brief: [
      'Mama Rosa runs the diner on Marina Ave, and she needs a driver.',
      'Grab a car, take her lunch order down to the pier, then come back.',
      'Easy money. Do not scratch the paint. Probably.',
    ],
    steps: [
      { type: 'getin', text: 'Get in a car', say: [{ who: 'Rosa', text: 'Take my old sedan out back, sweetie. Keys are in it.' }] },
      { type: 'driveTo', x: PLACES.pier.x, y: PLACES.pier.y, r: 90, text: 'Deliver the lunch order to Solmar Pier', say: [{ who: 'Kai', text: 'Pier run. Nice and easy.' }] },
      { type: 'driveTo', x: PLACES.diner.x, y: PLACES.diner.y, r: 80, text: 'Head back to the diner', say: [{ who: 'Rosa', text: 'Come back in one piece, you hear me?' }] },
    ],
  },
  {
    id: 'hot-wheels',
    name: 'Hot Wheels',
    giver: 'Lena',
    start: PLACES.garage,
    reward: 300,
    brief: [
      'Lena needs a very specific sports car, and it is parked outside the Grand Solmar.',
      'It is not hers. It will be. Steal it and bring it to the garage.',
      'The cops will notice. They always notice.',
    ],
    steps: [
      { type: 'getin', car: { model: 'sports', x: 2140, y: 760, color: '#c0392b' }, text: 'Steal the red sports car at the Grand Solmar', say: [{ who: 'Lena', text: 'Red coupe, valet row. Do not ask whose it is.' }] },
      { type: 'driveTo', x: PLACES.garage.x, y: PLACES.garage.y, r: 80, text: 'Bring the car to Lena\u2019s Garage', say: [{ who: 'Lena', text: 'Cops on you? Outrun them. I will handle the paint.' }] },
    ],
  },
  {
    id: 'the-drop',
    name: 'The Drop',
    giver: 'Dex',
    start: PLACES.park,
    reward: 400,
    brief: [
      'Dex has a briefcase at Port Solmar that needs to be at the Grand Solmar.',
      'Somebody tipped off the cops, so you will have company.',
      'Seventy-five seconds. Dex does not pay late.',
    ],
    steps: [
      { type: 'pickup', kind: 'briefcase', x: 480, y: 2080, text: 'Pick up the briefcase at Port Solmar', say: [{ who: 'Dex', text: 'Case is by the blue containers. Move.' }] },
      { type: 'timed', x: PLACES.casino.x, y: PLACES.casino.y, r: 90, seconds: 75, text: 'Deliver the briefcase to the Grand Solmar', say: [{ who: 'Dex', text: 'Clock is running, Kai. Seventy-five seconds.' }] },
    ],
  },
  {
    id: 'harbor-heat',
    name: 'Harbor Heat',
    giver: 'Dex',
    start: PLACES.port,
    reward: 500,
    brief: [
      'The Harbor Crew took Dex\u2019s ledger and they are holding the port.',
      'Take it back. Lena left you an SMG by the gate.',
      'Watch your back — they shoot first.',
    ],
    steps: [
      { type: 'kill', enemies: [
        { x: 300, y: 2050 }, { x: 380, y: 2150 }, { x: 240, y: 2200 }, { x: 430, y: 2250 }, { x: 180, y: 2100 },
      ], text: 'Clear the Harbor Crew from the port', say: [{ who: 'Dex', text: 'Five of them. The ledger is in the warehouse office.' }] },
      { type: 'pickup', kind: 'briefcase', x: 330, y: 2120, text: 'Recover Dex\u2019s ledger', say: [{ who: 'Kai', text: 'Got it. Time to go home.' }] },
      { type: 'goto', x: PLACES.hideout.x, y: PLACES.hideout.y, r: 90, text: 'Bring the ledger to your apartment', say: [] },
    ],
  },
  {
    id: 'grand-getaway',
    name: 'The Grand Getaway',
    giver: 'Lena',
    start: PLACES.garage,
    reward: 1200,
    brief: [
      'One last job. The Grand Solmar\u2019s weekend take, sitting in three bags.',
      'Grab the bags, then run — the whole city will be on you.',
      'Get home. After this, you are done owing anybody anything.',
    ],
    steps: [
      { type: 'goto', x: PLACES.casino.x, y: PLACES.casino.y, r: 80, text: 'Reach the Grand Solmar', say: [{ who: 'Lena', text: 'In and out. Bags are by the service door.' }] },
      { type: 'pickup', kind: 'cashbag', count: 3, spots: [{ x: 2100, y: 780 }, { x: 2240, y: 840 }, { x: 2160, y: 700 }], text: 'Grab the three cash bags', say: [{ who: 'Kai', text: 'Three bags. Let us go.' }] },
      { type: 'driveTo', x: PLACES.hideout.x, y: PLACES.hideout.y, r: 90, text: 'Escape to your apartment — 4 stars!', say: [{ who: 'Lena', text: 'Every cop in Solmar is coming. Do not stop.' }] },
    ],
  },
];

export function nextMissionIndex(G) {
  for (let i = 0; i < MISSIONS.length; i += 1) {
    if (!G.missionsDone[i]) return i;
  }
  return -1;
}

export function updateMissionMarker(G) {
  if (G.mission) { G.missionMarker = null; return; }
  const idx = nextMissionIndex(G);
  if (idx === -1) { G.missionMarker = null; return; }
  const def = MISSIONS[idx];
  G.missionMarker = { x: def.start.x, y: def.start.y, missionIndex: idx, name: def.name, giver: def.giver };
}

export function startMission(G, index) {
  const def = MISSIONS[index];
  G.missionMarker = null; // the M beacon and start prompt go away once it starts
  G.mission = {
    def,
    index,
    stepIdx: 0,
    timer: 0,
    killsAtStart: G.missionKills || 0,
    spawnedCars: [],
    spawnedEnemies: [],
    collected: 0,
    started: false,
  };
  G.screen = 'briefing';
}

export function beginMission(G) {
  const m = G.mission;
  if (!m) return;
  m.started = true;
  G.screen = 'play';
  startStep(G);
}

function startStep(G) {
  const m = G.mission;
  const step = m.def.steps[m.stepIdx];
  m.timer = step.seconds || 0;
  m.collected = 0;
  G.waypoint = null;
  if (step.say) sayLines(G, step.say);
  if (step.type === 'getin' && step.car) {
    const car = createCar(step.car.model, step.car.x, step.car.y, 0, null, step.car.color);
    car.missionCar = true;
    G.cars.push(car);
    m.spawnedCars.push(car);
    G.waypoint = { x: step.car.x, y: step.car.y, label: 'Target car' };
  } else if (step.type === 'getin') {
    const car = createCar('sedan', G.player.x + 60, G.player.y - 40, 0, null, '#7f8c8d');
    car.missionCar = true;
    G.cars.push(car);
    m.spawnedCars.push(car);
    G.waypoint = { x: car.x, y: car.y, label: 'Rosa\u2019s sedan' };
  } else if (step.type === 'kill') {
    for (const e of step.enemies) {
      const enemy = spawnEnemy(G, e.x, e.y, { hp: 70 });
      m.spawnedEnemies.push(enemy);
    }
    spawnPickup(G, G.player.x + 50, G.player.y + 30, 'smg');
    G.waypoint = { x: step.enemies[0].x, y: step.enemies[0].y, label: 'Harbor Crew' };
  } else if (step.type === 'pickup') {
    G.missionItems = [];
    if (step.spots) {
      for (const s of step.spots) G.missionItems.push({ x: s.x, y: s.y, kind: step.kind, taken: false });
      G.waypoint = { x: step.spots[0].x, y: step.spots[0].y, label: 'Cash bags' };
    } else {
      G.missionItems.push({ x: step.x, y: step.y, kind: step.kind, taken: false });
      G.waypoint = { x: step.x, y: step.y, label: step.kind === 'briefcase' ? 'Briefcase' : 'Pickup' };
    }
  } else if (step.type === 'timed') {
    setWanted(G, 1);
    G.waypoint = { x: step.x, y: step.y, label: 'Deliver' };
  } else if (step.type === 'driveTo' || step.type === 'goto') {
    if (m.def.id === 'grand-getaway' && step.type === 'driveTo') setWanted(G, 4);
    G.waypoint = { x: step.x, y: step.y, label: 'Destination' };
  }
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (!m || !m.started) return;
  const step = m.def.steps[m.stepIdx];
  const p = G.player;
  let done = false;

  if (step.type === 'goto' || step.type === 'driveTo') {
    if (dist(p.x, p.y, step.x, step.y) < step.r) done = true;
  } else if (step.type === 'timed') {
    m.timer -= dt;
    if (dist(p.x, p.y, step.x, step.y) < step.r) done = true;
    else if (m.timer <= 0) { failMission(G, 'Too slow — Dex does not pay late.'); return; }
  } else if (step.type === 'getin') {
    if (p.inCar && p.inCar.missionCar) done = true;
    else if (m.spawnedCars.length && m.spawnedCars[0].dead) { failMission(G, 'The target car was wrecked.'); return; }
  } else if (step.type === 'kill') {
    const alive = m.spawnedEnemies.filter((e) => !e.dead).length;
    if (alive === 0) done = true;
  } else if (step.type === 'pickup') {
    const need = step.count || 1;
    for (const item of G.missionItems) {
      if (!item.taken && dist(p.x, p.y, item.x, item.y) < 34) {
        item.taken = true;
        m.collected += 1;
        playCash(G.audio);
      }
    }
    if (m.collected >= need) done = true;
  } else if (step.type === 'escape') {
    if (G.wanted.stars === 0) done = true;
  }

  if (!done) return;
  // In screenshot mode the staged step stays put so the frame keeps its story.
  if (G.shotMode) return;
  m.stepIdx += 1;
  if (m.stepIdx >= m.def.steps.length) completeMission(G);
  else startStep(G);
}

function completeMission(G) {
  const m = G.mission;
  const reward = m.def.reward;
  addCash(G, reward, G.player.x, G.player.y - 30);
  playMissionPass(G.audio);
  G.missionsDone[m.index] = true;
  if (m.def.id === 'hot-wheels' || m.def.id === 'grand-getaway') clearWanted(G);
  G.screen = 'passed';
  G.passedInfo = { name: m.def.name, reward, last: nextMissionIndex(G) === -1 };
  cleanupMission(G);
  saveGame(G);
}

export function failMission(G, reason) {
  playMissionFail(G.audio);
  G.screen = 'failed';
  G.failedInfo = { name: G.mission ? G.mission.def.name : 'Mission', reason, index: G.mission ? G.mission.index : 0 };
  cleanupMission(G);
}

function cleanupMission(G) {
  const m = G.mission;
  if (!m) return;
  for (const e of m.spawnedEnemies) if (!e.dead) e.hp = 0, e.dead = true;
  G.missionItems = [];
  G.waypoint = null;
  G.mission = null;
  updateMissionMarker(G);
}

export function retryMission(G) {
  const idx = G.failedInfo ? G.failedInfo.index : nextMissionIndex(G);
  startMission(G, idx);
}

// ---- Dialogue subtitles --------------------------------------------------

export function sayLines(G, lines) {
  if (!lines || lines.length === 0) return;
  G.dialogue = { lines, i: 0, t: 0 };
}

export function updateDialogue(G, dt) {
  if (!G.dialogue) return;
  G.dialogue.t += dt;
  if (G.dialogue.t > 3.6) {
    G.dialogue.t = 0;
    G.dialogue.i += 1;
    if (G.dialogue.i >= G.dialogue.lines.length) G.dialogue = null;
  }
}

// ---- Taxi side job -------------------------------------------------------

export function createTaxiJob(G) {
  return {
    x: PLACES.taxiRank.x, y: PLACES.taxiRank.y,
    active: false, stage: 'idle',
    px: 0, py: 0, dx: 0, dy: 0,
    timer: 0, faresDone: 0, fare: 0,
  };
}

export function startTaxiJob(G) {
  const t = G.taxiJob;
  t.active = true;
  t.faresDone = 0;
  nextFare(G);
  G.banner = { text: 'TAXI JOB', sub: 'Pick up the passenger', t: 0, dur: 2.2 };
}

function randomFarePoint(G) {
  const pt = { x: 0, y: 0 };
  const roads = [160, 560, 960, 1360, 1760, 2160, 2560, 2960];
  const streets = [160, 460, 760, 1060, 1360, 1660, 1960, 2260];
  if (Math.random() < 0.5) {
    pt.x = roads[Math.floor(Math.random() * roads.length)];
    pt.y = 140 + Math.random() * 2100;
  } else {
    pt.y = streets[Math.floor(Math.random() * streets.length)];
    pt.x = 140 + Math.random() * 2800;
  }
  return pt;
}

function nextFare(G) {
  const t = G.taxiJob;
  const pickup = randomFarePoint(G);
  const drop = randomFarePoint(G);
  t.px = pickup.x; t.py = pickup.y;
  t.dx = drop.x; t.dy = drop.y;
  t.stage = 'pickup';
  t.timer = 120;
  t.fare = 40 + Math.floor(Math.random() * 40);
  G.waypoint = { x: t.px, y: t.py, label: 'Passenger' };
}

export function updateTaxiJob(G, dt) {
  const t = G.taxiJob;
  if (!t.active) return;
  const p = G.player;
  t.timer -= dt;
  if (t.timer <= 0) {
    t.active = false;
    t.stage = 'idle';
    G.waypoint = null;
    G.banner = { text: 'FARE LOST', sub: 'The passenger gave up waiting', t: 0, dur: 2.2 };
    return;
  }
  if (t.stage === 'pickup') {
    if (p.inCar && dist(p.x, p.y, t.px, t.py) < 55) {
      t.stage = 'dropoff';
      t.timer = 100;
      G.waypoint = { x: t.dx, y: t.dy, label: 'Destination' };
      G.banner = { text: 'PASSENGER ABOARD', sub: 'Take them to the marker', t: 0, dur: 2 };
      playCash(G.audio);
    }
  } else if (t.stage === 'dropoff') {
    if (p.inCar && dist(p.x, p.y, t.dx, t.dy) < 60) {
      addCash(G, t.fare, p.x, p.y - 30);
      playCash(G.audio);
      t.faresDone += 1;
      if (t.faresDone >= 3) {
        t.active = false;
        t.stage = 'idle';
        G.waypoint = null;
        G.banner = { text: 'SHIFT DONE', sub: 'Three fares banked. Nice driving.', t: 0, dur: 2.6 };
        saveGame(G);
      } else {
        nextFare(G);
      }
    }
  }
}

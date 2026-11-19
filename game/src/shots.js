// Screenshot staging: `?shot=<name>` drops the game straight into a composed
// scene — the title screen, a street on foot, a drive, a police chase, or the
// port firefight — so the screenshots show the real game at its best. Each
// scene is the live simulation, staged, not a mockup.

import { PLACES } from './config.js';
import { MISSIONS, sayLines, updateMissionMarker } from './missions.js';
import { setWanted } from './wanted.js';
import { createCar } from './vehicles.js';
import { spawnEnemy, spawnPickup } from './combat.js';
import { initTraffic } from './traffic.js';
import { spawnPed, initPeds } from './pedestrians.js';

export function stageShot(G, name) {
  G.shotMode = name;
  G.showHelp = false;
  if (name === 'start') {
    G.screen = 'title';
    return;
  }
  G.screen = 'play';
  if (name === 'street') stageStreet(G);
  else if (name === 'drive') stageDrive(G);
  else if (name === 'chase') stageChase(G);
  else if (name === 'port') stagePort(G);
  else G.screen = 'title';
  // No stale mission-start beacon while a mission is staged; otherwise show it.
  if (!G.mission) updateMissionMarker(G);
  else G.missionMarker = null;
}

function resetActors(G) {
  G.cars = [];
  G.peds = [];
  G.cops = [];
  G.enemies = [];
  G.bullets = [];
  G.pickups = [];
  G.missionItems = [];
  G.mission = null;
  G.waypoint = null;
  G.dialogue = null;
  G.banner = null;
  G.player.inCar = null;
  G.player.dead = false;
  G.player.health = 100;
  G.player.armor = 50;
}

function stageStreet(G) {
  resetActors(G);
  const p = G.player;
  p.x = 1410;
  p.y = 1150;
  p.angle = 0.4;
  p.weapon = 'pistol';
  G.clock = 630; // 10:30 AM
  G.camera.x = p.x - (G.viewW / G.zoom) / 2;
  G.camera.y = p.y - (G.viewH / G.zoom) / 2;
  initTraffic(G);
  initPeds(G);
  for (let i = 0; i < 6; i += 1) spawnPed(G, false);
  G.banner = { text: 'SOLMAR CITY', sub: 'Downtown — Coral St & Vista Ave', t: 0, dur: 2.6 };
}

function stageDrive(G) {
  resetActors(G);
  const p = G.player;
  const car = createCar('sports', 2800, 1060, Math.PI, 'player', '#2980b9');
  car.speed = 420;
  car.vx = -420;
  car.vy = 0;
  G.cars.push(car);
  G.shotHeading = Math.PI; // westbound down Vista Ave, into downtown
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  G.clock = 660; // 11:00 AM
  G.camera.x = p.x - (G.viewW / G.zoom) / 2;
  G.camera.y = p.y - (G.viewH / G.zoom) / 2;
  initTraffic(G);
  initPeds(G);
  G.banner = { text: 'MARINA AVE', sub: 'Solmar Blvd straight ahead', t: 0, dur: 2.2 };
}

function stageChase(G) {
  resetActors(G);
  const p = G.player;
  // Mission 2, getaway step: bring the stolen car to Lena's Garage.
  const def = MISSIONS[1];
  G.mission = {
    def, index: 1, stepIdx: 1, timer: 0,
    killsAtStart: 0, spawnedCars: [], spawnedEnemies: [], collected: 0, started: true,
  };
  G.waypoint = { x: PLACES.garage.x, y: PLACES.garage.y, label: 'Lena\u2019s Garage' };
  setWanted(G, 3);
  const car = createCar('sports', 2560, 1060, Math.PI, 'player', '#c0392b');
  car.speed = 430;
  car.vx = -430;
  car.vy = 0;
  G.cars.push(car);
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.cash = 1240;
  G.clock = 930; // 3:30 PM
  G.camera.x = p.x - (G.viewW / G.zoom) / 2;
  G.camera.y = p.y - (G.viewH / G.zoom) / 2;
  // Three cruisers in pursuit, staggered behind on Vista Ave.
  const spots = [
    { x: 2740, y: 1060 }, { x: 2800, y: 1020 }, { x: 2720, y: 1100 },
  ];
  for (const s of spots) {
    const cop = createCar('police', s.x, s.y, Math.PI, 'police', '#ffffff');
    cop.speed = 430;
    cop.vx = -430;
    cop.vy = 0;
    G.cars.push(cop);
  }
  initTraffic(G);
  initPeds(G);
  sayLines(G, [{ who: 'Lena', text: 'Cops on you? Outrun them. I will handle the paint.' }]);
}

function stagePort(G) {
  resetActors(G);
  const p = G.player;
  const def = MISSIONS[3];
  G.mission = {
    def, index: 3, stepIdx: 0, timer: 0,
    killsAtStart: 0, spawnedCars: [], spawnedEnemies: [], collected: 0, started: true,
  };
  G.waypoint = { x: 300, y: 2050, label: 'Harbor Crew' };
  p.x = 430;
  p.y = 2120;
  p.angle = Math.PI;
  p.weapon = 'smg';
  p.smgAmmo = 120;
  p.health = 82;
  p.armor = 50;
  G.clock = 720; // Noon
  G.camera.x = p.x - (G.viewW / G.zoom) / 2;
  G.camera.y = p.y - (G.viewH / G.zoom) / 2;
  const spots = [
    { x: 300, y: 2050 }, { x: 380, y: 2150 }, { x: 240, y: 2200 }, { x: 180, y: 2100 },
  ];
  for (const s of spots) {
    const e = spawnEnemy(G, s.x, s.y, { hp: 70 });
    G.mission.spawnedEnemies.push(e);
  }
  spawnPickup(G, 470, 2080, 'health');
  initTraffic(G);
  initPeds(G);
  sayLines(G, [{ who: 'Dex', text: 'Five of them. The ledger is in the warehouse office.' }]);
}

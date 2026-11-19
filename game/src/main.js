// Solmar City — boot, game loop, screen flow and the glue between systems.
// The state object G carries everything; each module owns one system and is
// updated here in a fixed order every frame.

import { generateCity, planRoute } from './city.js';
import { createInput, endFrameInput, keyPressed, keyDown } from './input.js';
import { createAudio, unlockAudio, setMuted, setEngine } from './audio.js';
import { createPlayer, updatePlayer } from './player.js';
import { initTraffic, updateTraffic } from './traffic.js';
import { initPeds, updatePeds } from './pedestrians.js';
import { createWanted, updateWanted, tryRespray, clearWanted } from './wanted.js';
import { createPoliceState, updatePolice } from './police.js';
import { updateCombat, spawnPickup } from './combat.js';
import { updateMission, updateMissionMarker, updateDialogue, startMission, updateTaxiJob, createTaxiJob, failMission, startTaxiJob } from './missions.js';
import { updateEffects, createEffects } from './particles.js';
import { collideCars } from './vehicles.js';
import { saveGame, loadSave } from './save.js';
import { drawFrame } from './render.js';
import { handleMenuKeys, saveFromMenu } from './screens.js';
import { stageShot } from './shots.js';
import { dist, clamp, angleDiff } from './utils.js';
import { BAIL_COST, HOSPITAL_COST, PLACES, WORLD_W, WORLD_H, RESPRAY_COST_PER_STAR } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const G = {
  viewW: 1280, viewH: 720, zoom: 1,
  canvas, ctx,
  input: createInput(canvas),
  audio: createAudio(),
  city: null,
  player: null,
  cars: [], peds: [], cops: [], enemies: [], bullets: [], pickups: [],
  missionItems: [],
  effects: createEffects(),
  wanted: createWanted(),
  police: createPoliceState(),
  mission: null,
  missionsDone: [false, false, false, false, false],
  missionMarker: null,
  waypoint: null,
  taxiJob: null,
  dialogue: null,
  banner: null,
  prompt: null,
  camera: { x: 0, y: 0 },
  shake: 0,
  time: 0,
  clock: 480,
  playTime: 0,
  screen: 'title',
  menuSel: 0,
  helpReturn: 'title',
  uiAction: null,
  showHelp: false,
  helpTimer: 0,
  bustProgress: 0,
  bustedRequest: false,
  deathCause: null,
  lastGunshot: null,
  missionKills: 0,
  shotMode: null,
  shotReady: false,
  frames: 0,
  passedInfo: null,
  failedInfo: null,
  startMissionRequest: null,
  startTaxiRequest: false,
  saveRequest: false,
};

function resize() {
  G.viewW = window.innerWidth;
  G.viewH = window.innerHeight;
  canvas.width = G.viewW;
  canvas.height = G.viewH;
  G.zoom = clamp(Math.min(G.viewW / 1150, G.viewH / 640), 0.75, 1.5);
}
window.addEventListener('resize', resize);
resize();

function resetWorld(save) {
  G.cars = [];
  G.peds = [];
  G.cops = [];
  G.enemies = [];
  G.bullets = [];
  G.pickups = [];
  G.missionItems = [];
  G.effects = createEffects();
  G.wanted = createWanted();
  G.police = createPoliceState();
  G.mission = null;
  G.missionsDone = save && save.missionsDone ? save.missionsDone.slice() : [false, false, false, false, false];
  G.missionMarker = null;
  G.waypoint = null;
  G.dialogue = null;
  G.banner = null;
  G.prompt = null;
  G.taxiJob = createTaxiJob(G);
  const sx = save ? save.x : PLACES.hideout.x;
  const sy = save ? save.y : PLACES.hideout.y;
  G.player = createPlayer(sx, sy);
  if (save) {
    G.player.cash = save.cash;
    G.player.health = save.health;
    G.player.armor = save.armor;
    G.player.weapon = save.weapon || 'pistol';
    G.player.smgAmmo = save.smgAmmo || 0;
    G.player.angle = save.angle || -Math.PI / 2;
    G.clock = save.clock || 480;
    G.playTime = save.playTime || 0;
  } else {
    G.clock = 480;
    G.playTime = 0;
  }
  G.bustProgress = 0;
  G.bustedRequest = false;
  G.deathCause = null;
  G.missionKills = 0;
  G.showHelp = false;
  snapCamera();
  initTraffic(G);
  initPeds(G);
  spawnPickup(G, PLACES.hospital.x + 40, PLACES.hospital.y, 'health');
  spawnPickup(G, PLACES.garage.x + 50, PLACES.garage.y, 'armor');
  spawnPickup(G, PLACES.port.x + 40, PLACES.port.y - 60, 'smg');
  updateMissionMarker(G);
}

function snapCamera() {
  const vw = G.viewW / G.zoom;
  const vh = G.viewH / G.zoom;
  G.camera.x = clamp(G.player.x - vw / 2, 0, Math.max(0, WORLD_W - vw));
  G.camera.y = clamp(G.player.y - vh / 2, 0, Math.max(0, WORLD_H - vh));
}

function updateCamera(dt) {
  const vw = G.viewW / G.zoom;
  const vh = G.viewH / G.zoom;
  const tx = clamp(G.player.x - vw / 2, 0, Math.max(0, WORLD_W - vw));
  const ty = clamp(G.player.y - vh / 2, 0, Math.max(0, WORLD_H - vh));
  const k = 1 - Math.exp(-5 * dt);
  G.camera.x += (tx - G.camera.x) * k;
  G.camera.y += (ty - G.camera.y) * k;
  G.shake = Math.max(0, G.shake - dt * 26);
}

// In screenshot mode the player car drives itself along the road route to the
// waypoint, so chase and drive scenes stay dynamic while the shot is taken.
function shotAutopilot(dt) {
  if (!G.shotMode || (G.shotMode !== 'chase' && G.shotMode !== 'drive')) return;
  const p = G.player;
  if (!p.inCar) return;
  const input = G.input;
  input.keys.add('KeyW');
  let target = G.shotHeading !== undefined && G.shotMode === 'drive' ? G.shotHeading : -Math.PI / 2;
  if (G.shotMode === 'chase' && G.waypoint) {
    G.shotReplan = (G.shotReplan || 0) - dt;
    if (!G.shotRoute || G.shotRoute.length === 0 || G.shotReplan <= 0) {
      G.shotRoute = planRoute(G.city, p.x, p.y, G.waypoint.x, G.waypoint.y);
      G.shotReplan = 2;
    }
    const next = G.shotRoute[0];
    if (next && dist(p.x, p.y, next.x, next.y) < 70) G.shotRoute.shift();
    const node = G.shotRoute[0];
    if (node) target = Math.atan2(node.y - p.y, node.x - p.x);
    else target = Math.atan2(G.waypoint.y - p.y, G.waypoint.x - p.x);
  }
  const d = angleDiff(p.angle, target);
  input.keys.delete('KeyA');
  input.keys.delete('KeyD');
  input.keys.delete('KeyS');
  // Brake into sharp turns so the car makes the corner instead of the wall.
  if (Math.abs(d) > 0.45 && Math.abs(p.inCar.speed) > 200) {
    input.keys.delete('KeyW');
    input.keys.add('KeyS');
  }
  if (d > 0.12) input.keys.add('KeyD');
  else if (d < -0.12) input.keys.add('KeyA');
}

function computePrompt() {
  const p = G.player;
  G.prompt = null;
  if (p.dead || G.screen !== 'play') return;
  if (p.inCar) {
    if (Math.abs(p.inCar.speed) < 30) G.prompt = 'E — Get out of the car';
    if (G.wanted.stars > 0 && dist(p.x, p.y, PLACES.garage.x, PLACES.garage.y) < 90) {
      G.prompt = 'R — Respray ($' + RESPRAY_COST_PER_STAR * G.wanted.stars + ') — lose the cops';
    }
    return;
  }
  if (G.missionMarker && dist(p.x, p.y, G.missionMarker.x, G.missionMarker.y) < 90) {
    G.prompt = 'E — Start mission: ' + G.missionMarker.name;
    return;
  }
  if (G.taxiJob && !G.taxiJob.active && dist(p.x, p.y, G.taxiJob.x, G.taxiJob.y) < 80) {
    G.prompt = 'E — Start a taxi shift';
    return;
  }
  if (dist(p.x, p.y, PLACES.hideout.x, PLACES.hideout.y) < 80) {
    G.prompt = 'E — Save game at your apartment';
    return;
  }
  let best = null;
  let bd = 70;
  for (const car of G.cars) {
    if (car.dead || car.removed) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  if (best) G.prompt = best.driver === 'traffic' ? 'E — Steal the car' : 'E — Get in the car';
}

function updateWorld(dt) {
  G.time += dt;
  G.playTime += dt;
  G.clock = (G.clock + dt * 0.5) % 1440;
  if (G.banner) {
    G.banner.t += dt;
    if (G.banner.t >= G.banner.dur) G.banner = null;
  }
  if (G.showHelp) {
    G.helpTimer -= dt;
    if (G.helpTimer <= 0) G.showHelp = false;
  }
  shotAutopilot(dt);
  updatePlayer(G, dt);
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateCombat(G, dt);
  updateMission(G, dt);
  updateTaxiJob(G, dt);
  updateWanted(G, dt);
  updateDialogue(G, dt);
  updateEffects(G, dt);
  collideCars(G);
  updateCamera(dt);
  computePrompt();

  // Bust progress bleeds off when no officer is on top of the player.
  const copNear = G.cops.some((c) => dist(c.x, c.y, G.player.x, G.player.y) < 40);
  if (!copNear) G.bustProgress = Math.max(0, G.bustProgress - dt * 0.5);

  // Respray from the driver's seat.
  if (keyPressed(G.input, 'KeyR') && G.player.inCar && G.wanted.stars > 0 &&
      dist(G.player.x, G.player.y, PLACES.garage.x, PLACES.garage.y) < 90) {
    tryRespray(G);
  }

  // Requests raised by the player and the menus.
  if (G.startMissionRequest !== null && G.startMissionRequest !== undefined) {
    const idx = G.startMissionRequest;
    G.startMissionRequest = null;
    startMission(G, idx);
  }
  if (G.startTaxiRequest) {
    G.startTaxiRequest = false;
    startTaxiJob(G);
  }
  if (G.saveRequest) {
    G.saveRequest = false;
    if (saveGame(G)) G.banner = { text: 'GAME SAVED', sub: 'Progress stored', t: 0, dur: 2 };
  }
  if (G.player.dead && G.screen === 'play') handleDeath(G);
  if (G.bustedRequest && G.screen === 'play') handleBusted(G);
}

function handleDeath(G) {
  G.deathCause = 'wasted';
  if (G.mission) failMission(G, 'Kai did not make it.');
  G.player.cash = Math.max(0, G.player.cash - HOSPITAL_COST);
  G.screen = 'wasted';
  setEngine(G.audio, 0, false);
}

function handleBusted(G) {
  G.bustedRequest = false;
  G.deathCause = 'busted';
  if (G.mission) failMission(G, 'Busted mid-job.');
  G.player.cash = Math.max(0, G.player.cash - BAIL_COST);
  clearWanted(G);
  G.cops = [];
  G.screen = 'busted';
  setEngine(G.audio, 0, false);
}

function respawn(G) {
  const p = G.player;
  p.dead = false;
  p.health = 100;
  p.armor = 0;
  if (p.inCar) {
    p.inCar.driver = null;
    p.inCar = null;
  }
  const spot = G.deathCause === 'busted' ? PLACES.policeHq : PLACES.hospital;
  p.x = spot.x;
  p.y = spot.y;
  p.angle = -Math.PI / 2;
  clearWanted(G);
  G.cops = [];
  G.bustProgress = 0;
  G.deathCause = null;
  snapCamera();
  G.screen = 'play';
  G.banner = { text: 'BACK ON THE STREETS', sub: 'Solmar does not wait', t: 0, dur: 2.2 };
}

function updateTitleWorld(dt) {
  G.time += dt;
  // Slow cinematic pan over downtown.
  const vw = G.viewW / G.zoom;
  const vh = G.viewH / G.zoom;
  const cx = 1700 + Math.sin(G.time * 0.05) * 480;
  const cy = 1150 + Math.cos(G.time * 0.037) * 320;
  G.camera.x = clamp(cx - vw / 2, 0, Math.max(0, WORLD_W - vw));
  G.camera.y = clamp(cy - vh / 2, 0, Math.max(0, WORLD_H - vh));
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updateEffects(G, dt);
}

function consumeUiAction() {
  const a = G.uiAction;
  if (!a) return;
  G.uiAction = null;
  if (a === 'new') {
    resetWorld(null);
    G.screen = 'play';
    G.showHelp = true;
    G.helpTimer = 45;
    G.banner = { text: 'WELCOME TO SOLMAR', sub: 'Mama Rosa has work — follow the pink M marker', t: 0, dur: 3.2 };
  } else if (a === 'continue') {
    const save = loadSave();
    resetWorld(save);
    G.screen = 'play';
    G.banner = { text: 'WELCOME BACK', sub: 'Solmar missed you', t: 0, dur: 2.2 };
  } else if (a === 'resume') {
    G.screen = 'play';
  } else if (a === 'save') {
    saveFromMenu(G);
    G.screen = 'play';
  } else if (a === 'help') {
    G.helpReturn = G.screen;
    G.screen = 'help';
  } else if (a === 'helpBack') {
    G.screen = G.helpReturn || 'play';
  } else if (a === 'quit') {
    resetWorld(null);
    G.screen = 'title';
    G.menuSel = 0;
  } else if (a === 'respawn') {
    respawn(G);
  }
}

function handleGlobalKeys() {
  const input = G.input;
  if (input.pressed.size > 0 || input.mousePressed) unlockAudio(G.audio);
  if (keyPressed(input, 'KeyM')) {
    setMuted(G.audio, !G.audio.muted);
    G.banner = { text: G.audio.muted ? 'SOUND OFF' : 'SOUND ON', sub: '', t: 0, dur: 1.2 };
  }
  if (G.screen === 'play') {
    if (keyPressed(input, 'Escape')) {
      G.screen = 'pause';
      G.menuSel = 0;
      // Eat the press: the pause menu also listens for Escape to resume, and
      // the same press must not pause and unpause in one frame.
      input.pressed.delete('Escape');
    } else if (keyPressed(input, 'KeyH')) {
      G.helpReturn = 'play';
      G.screen = 'help';
    }
  }
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  handleGlobalKeys();
  handleMenuKeys(G);
  consumeUiAction();
  if (G.screen === 'play') updateWorld(dt);
  else if (G.screen === 'title') updateTitleWorld(dt);
  drawFrame(G, ctx);
  endFrameInput(G.input);
  G.frames += 1;
  if (G.shotMode && !G.shotReady && G.frames > 5) G.shotReady = true;
}

// ---- Boot ----------------------------------------------------------------

const params = new URLSearchParams(window.location.search);
const seedParam = parseInt(params.get('seed') || '1337', 10);
G.city = generateCity(Number.isFinite(seedParam) ? seedParam : 1337);
resetWorld(null);
const shot = params.get('shot');
if (shot) {
  stageShot(G, shot);
  // Let the staged scene settle for a second and a half of simulation.
  if (G.screen === 'play') {
    for (let i = 0; i < 90; i += 1) updateWorld(1 / 60);
  }
}

// Test harness hook: the screenshot script waits for `ready`, then shoots.
// `G` is exposed so automated playtests can stage situations (teleport the
// player, set the wanted level, start a mission) without faking input.
window.__solmar = {
  G,
  get ready() { return G.shotReady || G.frames > 5; },
  get shot() { return G.shotMode; },
  state() {
    return {
      screen: G.screen,
      x: Math.round(G.player.x),
      y: Math.round(G.player.y),
      inCar: !!G.player.inCar,
      wanted: G.wanted.stars,
      mission: G.mission ? G.mission.def.id : null,
      step: G.mission ? G.mission.stepIdx : -1,
      cash: G.player.cash,
      health: Math.round(G.player.health),
      cars: G.cars.length,
      peds: G.peds.length,
      cops: G.cops.length,
      enemies: G.enemies.filter((e) => !e.dead).length,
    };
  },
};

requestAnimationFrame(frame);

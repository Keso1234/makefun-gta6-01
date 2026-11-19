// The wanted system: crimes add heat, heat sets the star level, and stars
// decide how hard the Solmar PD comes after the player. Hide out of sight and
// the heat bleeds away; the garage or the hideout clears it outright.

import { CRIME_HEAT, STAR_HEAT, RESPRAY_COST_PER_STAR } from './config.js';
import { playMissionFail } from './audio.js';

export function createWanted() {
  return {
    heat: 0,
    stars: 0,
    hiddenTimer: 0,
    seen: false,
    flash: 0,
  };
}

export function starsForHeat(heat) {
  let stars = 0;
  for (let i = 1; i < STAR_HEAT.length; i += 1) {
    if (heat >= STAR_HEAT[i]) stars = i;
  }
  return stars;
}

export function addCrime(G, kind) {
  // Screenshot staging sets the wanted level directly; gameplay crimes stay out.
  if (G.shotMode) return;
  const w = G.wanted;
  const amount = CRIME_HEAT[kind] || 0;
  if (amount === 0) return;
  const before = w.stars;
  w.heat += amount;
  w.hiddenTimer = 0;
  w.stars = starsForHeat(w.heat);
  if (w.stars > before) {
    w.flash = 1;
    G.banner = { text: 'WANTED LEVEL ' + w.stars, sub: wantedLine(w.stars), t: 0, dur: 2.4 };
    playMissionFail(G.audio);
  }
}

function wantedLine(stars) {
  return [
    '',
    'Solmar PD is on its way',
    'Patrol cars are closing in',
    'They are shooting to stop you',
    'Every unit in the city is hunting you',
    'The whole force is on you — run',
  ][stars] || '';
}

export function setWanted(G, stars) {
  const w = G.wanted;
  w.stars = stars;
  w.heat = STAR_HEAT[stars] || 0;
  w.hiddenTimer = 0;
}

export function clearWanted(G) {
  G.wanted.heat = 0;
  G.wanted.stars = 0;
  G.wanted.hiddenTimer = 0;
}

// Called every frame: while no officer can see the player, heat drains and
// stars fall one at a time.
export function updateWanted(G, dt) {
  const w = G.wanted;
  w.flash = Math.max(0, w.flash - dt);
  if (w.stars === 0) return;
  if (w.seen) {
    w.hiddenTimer = 0;
    return;
  }
  w.hiddenTimer += dt;
  if (w.hiddenTimer > 7) {
    w.hiddenTimer = 0;
    w.heat = Math.max(0, w.heat - 26);
    const now = starsForHeat(w.heat);
    if (now < w.stars) {
      w.stars = now;
      G.banner = { text: now === 0 ? 'YOU LOST THEM' : 'WANTED LEVEL ' + now, sub: now === 0 ? 'The heat is off — for now' : 'They are losing your trail', t: 0, dur: 2 };
    }
  }
}

// Respray at Lena's garage: cash clears the stars, but not while a cop watches.
export function tryRespray(G) {
  const w = G.wanted;
  if (w.stars === 0) return false;
  if (w.seen) {
    G.banner = { text: 'TOO HOT', sub: 'Lose the cops first', t: 0, dur: 2 };
    return false;
  }
  const cost = RESPRAY_COST_PER_STAR * w.stars;
  if (G.player.cash < cost) {
    G.banner = { text: 'NOT ENOUGH CASH', sub: 'Respray costs $' + cost, t: 0, dur: 2 };
    return false;
  }
  G.player.cash -= cost;
  clearWanted(G);
  G.banner = { text: 'FRESH PAINT', sub: 'New plates, new color — clean', t: 0, dur: 2.4 };
  return true;
}

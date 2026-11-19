// Save and load through localStorage: cash, health, position, story progress and
// the clock. The game autosaves after every mission and saves on demand at the
// hideout or from the pause menu.

import { SAVE_KEY } from './config.js';

export function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch (e) {
    return false;
  }
}

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      cash: Math.floor(state.player.cash),
      health: Math.floor(state.player.health),
      armor: Math.floor(state.player.armor),
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      angle: state.player.angle,
      weapon: state.player.weapon,
      smgAmmo: state.player.smgAmmo,
      missionsDone: state.missionsDone.slice(),
      clock: state.clock,
      playTime: state.playTime,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    // No storage available; nothing to clear.
  }
}

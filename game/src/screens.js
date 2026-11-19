// Every screen that is not the game itself: the title menu, pause, mission
// briefings, pass/fail cards, busted/wasted, and the help sheet. All drawn on
// the canvas, driven by mouse or keyboard, and each one sets a single
// `G.uiAction` flag that main.js consumes.

import { hasSave, saveGame } from './save.js';
import { beginMission, retryMission, updateMissionMarker } from './missions.js';
import { keyPressed } from './input.js';
import { playClick } from './audio.js';

const TITLE = 'SOLMAR CITY';

export function drawScreen(G, g) {
  const W = G.viewW;
  const H = G.viewH;
  if (G.screen === 'title') drawTitle(G, g, W, H);
  else if (G.screen === 'pause') drawPause(G, g, W, H);
  else if (G.screen === 'briefing') drawBriefing(G, g, W, H);
  else if (G.screen === 'passed') drawPassed(G, g, W, H);
  else if (G.screen === 'failed') drawFailed(G, g, W, H);
  else if (G.screen === 'busted') drawBusted(G, g, W, H);
  else if (G.screen === 'wasted') drawWasted(G, g, W, H);
  else if (G.screen === 'help') drawHelp(G, g, W, H);
}

function dim(g, W, H, a) {
  g.fillStyle = 'rgba(6,10,18,' + a + ')';
  g.fillRect(0, 0, W, H);
}

function menuItemsFor(G) {
  if (G.screen === 'title') {
    const items = [{ label: 'NEW GAME', action: 'new', sub: 'Start Kai\u2019s story in Solmar' }];
    if (hasSave()) items.push({ label: 'CONTINUE', action: 'continue', sub: 'Pick up where you left off' });
    items.push({ label: 'HOW TO PLAY', action: 'help', sub: 'Controls and tips' });
    return items;
  }
  if (G.screen === 'pause') {
    return [
      { label: 'RESUME', action: 'resume' },
      { label: 'SAVE GAME', action: 'save' },
      { label: 'HOW TO PLAY', action: 'help' },
      { label: 'QUIT TO TITLE', action: 'quit' },
    ];
  }
  return [];
}

// Draw a vertical menu, track hover/click, and return the chosen action or null.
function drawMenu(G, g, items, cx, y0) {
  const W = 380;
  const H = 52;
  let chosen = null;
  items.forEach((item, i) => {
    const y = y0 + i * (H + 10);
    const hover = G.input.mouseX >= cx - W / 2 && G.input.mouseX <= cx + W / 2 && G.input.mouseY >= y && G.input.mouseY <= y + H;
    if (hover) G.menuSel = i;
    const sel = G.menuSel === i;
    g.fillStyle = sel ? 'rgba(250,204,21,0.92)' : 'rgba(10,16,26,0.72)';
    roundRect(g, cx - W / 2, y, W, H, 8);
    g.fill();
    g.strokeStyle = sel ? '#facc15' : 'rgba(255,255,255,0.2)';
    g.lineWidth = 2;
    roundRect(g, cx - W / 2, y, W, H, 8);
    g.stroke();
    g.textAlign = 'center';
    g.font = 'bold 19px Arial';
    g.fillStyle = sel ? '#111111' : '#ffffff';
    g.fillText(item.label, cx, y + (item.sub ? 24 : 33));
    if (item.sub) {
      g.font = '12px Arial';
      g.fillStyle = sel ? '#444444' : 'rgba(255,255,255,0.6)';
      g.fillText(item.sub, cx, y + 42);
    }
    if (hover && G.input.mousePressed) chosen = item.action;
  });
  return chosen;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function menuKeys(G, count) {
  if (keyPressed(G.input, 'ArrowUp') || keyPressed(G.input, 'KeyW')) {
    G.menuSel = (G.menuSel + count - 1) % count;
    playClick(G.audio);
  }
  if (keyPressed(G.input, 'ArrowDown') || keyPressed(G.input, 'KeyS')) {
    G.menuSel = (G.menuSel + 1) % count;
    playClick(G.audio);
  }
}

function drawTitle(G, g, W, H) {
  // Sunset gradient over the slowly panning city behind.
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(20,10,40,0.55)');
  grad.addColorStop(0.55, 'rgba(20,10,40,0.25)');
  grad.addColorStop(1, 'rgba(10,6,24,0.75)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  g.textAlign = 'center';
  const sunGrad = g.createLinearGradient(0, H * 0.16, 0, H * 0.32);
  sunGrad.addColorStop(0, '#ffe259');
  sunGrad.addColorStop(0.5, '#ffa751');
  sunGrad.addColorStop(1, '#ff5e62');
  g.font = '900 84px Arial';
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillText(TITLE, W / 2 + 4, H * 0.26 + 4);
  g.fillStyle = sunGrad;
  g.fillText(TITLE, W / 2, H * 0.26);
  g.font = 'italic 21px Georgia, serif';
  g.fillStyle = '#ffe9b0';
  g.fillText('An open-world crime story on the Solmar coast', W / 2, H * 0.26 + 36);
  g.font = '13px Arial';
  g.fillStyle = 'rgba(255,255,255,0.65)';
  g.fillText('Steal cars  •  Outrun the law  •  Run the city  •  Five story missions  •  Taxi shifts  •  Free roam', W / 2, H * 0.26 + 62);

  const items = menuItemsFor(G);
  const chosen = drawMenu(G, g, items, W / 2, H * 0.42);
  if (chosen) G.uiAction = chosen;
  if (keyPressed(G.input, 'Enter')) G.uiAction = items[G.menuSel] ? items[G.menuSel].action : null;

  g.font = '12px Arial';
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.fillText('WASD drive & walk  •  E interact  •  Mouse aim, click shoot  •  Esc pause  •  M mute', W / 2, H - 44);
  g.fillText('An original game. Solmar City, its people and its story are invented — no affiliation with any commercial title.', W / 2, H - 24);
}

function drawPause(G, g, W, H) {
  dim(g, W, H, 0.6);
  g.textAlign = 'center';
  g.font = 'bold 40px Arial';
  g.fillStyle = '#ffffff';
  g.fillText('PAUSED', W / 2, H * 0.24);
  g.font = '14px Arial';
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.fillText('Solmar waits for no one. Well — for you, just this once.', W / 2, H * 0.24 + 28);
  const items = menuItemsFor(G);
  const chosen = drawMenu(G, g, items, W / 2, H * 0.36);
  if (chosen) G.uiAction = chosen;
  if (keyPressed(G.input, 'Enter')) G.uiAction = items[G.menuSel] ? items[G.menuSel].action : null;
}

function card(g, W, H, w, h) {
  const x = W / 2 - w / 2;
  const y = H / 2 - h / 2;
  g.fillStyle = 'rgba(8,14,22,0.88)';
  roundRect(g, x, y, w, h, 14);
  g.fill();
  g.strokeStyle = 'rgba(250,204,21,0.5)';
  g.lineWidth = 2;
  roundRect(g, x, y, w, h, 14);
  g.stroke();
  return { x, y, w, h };
}

function drawBriefing(G, g, W, H) {
  dim(g, W, H, 0.55);
  const m = G.mission;
  if (!m) return;
  const c = card(g, W, H, 640, 380);
  g.textAlign = 'center';
  g.font = 'bold 30px Arial';
  g.fillStyle = '#facc15';
  g.fillText(m.def.name.toUpperCase(), W / 2, c.y + 56);
  g.font = '15px Arial';
  g.fillStyle = '#9fb3c8';
  g.fillText('A job from ' + m.def.giver + '  •  Reward $' + m.def.reward, W / 2, c.y + 84);
  g.font = '16px Arial';
  g.fillStyle = '#ffffff';
  let y = c.y + 122;
  for (const line of m.def.brief) {
    g.fillText(line, W / 2, y);
    y += 26;
  }
  g.font = 'bold 15px Arial';
  g.fillStyle = '#7CFC00';
  g.fillText('ENTER — Take the job', W / 2, c.y + c.h - 56);
  g.font = '13px Arial';
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.fillText('ESC — Not right now', W / 2, c.y + c.h - 32);
  if (keyPressed(G.input, 'Enter')) {
    playClick(G.audio);
    beginMission(G);
  }
  if (keyPressed(G.input, 'Escape')) {
    G.mission = null;
    G.screen = 'play';
    updateMissionMarker(G);
  }
}

function drawPassed(G, g, W, H) {
  dim(g, W, H, 0.55);
  const info = G.passedInfo || { name: 'Mission', reward: 0 };
  const c = card(g, W, H, 560, 280);
  g.textAlign = 'center';
  g.font = 'bold 34px Arial';
  g.fillStyle = '#7CFC00';
  g.fillText('MISSION PASSED', W / 2, c.y + 62);
  g.font = '20px Arial';
  g.fillStyle = '#ffffff';
  g.fillText(info.name, W / 2, c.y + 100);
  g.font = 'bold 26px Arial';
  g.fillStyle = '#facc15';
  g.fillText('+$' + info.reward, W / 2, c.y + 142);
  g.font = '14px Arial';
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.fillText(info.last ? 'That was the last job. Solmar is yours now.' : 'Progress saved. The next job is on the map.', W / 2, c.y + 176);
  g.font = 'bold 15px Arial';
  g.fillStyle = '#ffffff';
  g.fillText('ENTER — Continue', W / 2, c.y + c.h - 36);
  if (keyPressed(G.input, 'Enter')) G.screen = 'play';
}

function drawFailed(G, g, W, H) {
  dim(g, W, H, 0.55);
  const info = G.failedInfo || { name: 'Mission', reason: '' };
  const c = card(g, W, H, 560, 280);
  g.textAlign = 'center';
  g.font = 'bold 34px Arial';
  g.fillStyle = '#ff6b6b';
  g.fillText('MISSION FAILED', W / 2, c.y + 62);
  g.font = '20px Arial';
  g.fillStyle = '#ffffff';
  g.fillText(info.name, W / 2, c.y + 100);
  g.font = '15px Arial';
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.fillText(info.reason, W / 2, c.y + 136);
  g.font = 'bold 15px Arial';
  g.fillStyle = '#7CFC00';
  g.fillText('R — Retry the mission', W / 2, c.y + 190);
  g.font = '14px Arial';
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.fillText('ENTER — Free roam', W / 2, c.y + 216);
  if (keyPressed(G.input, 'KeyR')) retryMission(G);
  if (keyPressed(G.input, 'Enter')) G.screen = 'play';
}

function drawBusted(G, g, W, H) {
  dim(g, W, H, 0.65);
  g.textAlign = 'center';
  g.font = 'bold 64px Arial';
  g.fillStyle = '#3b82f6';
  g.fillText('BUSTED', W / 2, H * 0.4);
  g.font = '17px Arial';
  g.fillStyle = '#ffffff';
  g.fillText('The Solmar PD got you. Bail is $200 — the city keeps your cash, not your freedom.', W / 2, H * 0.4 + 40);
  g.font = 'bold 15px Arial';
  g.fillStyle = '#facc15';
  g.fillText('ENTER — Walk free', W / 2, H * 0.4 + 80);
  if (keyPressed(G.input, 'Enter')) G.uiAction = 'respawn';
}

function drawWasted(G, g, W, H) {
  dim(g, W, H, 0.65);
  g.textAlign = 'center';
  g.font = 'bold 64px Arial';
  g.fillStyle = '#ef4444';
  g.fillText('WASTED', W / 2, H * 0.4);
  g.font = '17px Arial';
  g.fillStyle = '#ffffff';
  g.fillText('You flatlined. Solmar General patched you up — the $150 bill is yours.', W / 2, H * 0.4 + 40);
  g.font = 'bold 15px Arial';
  g.fillStyle = '#facc15';
  g.fillText('ENTER — Back on your feet', W / 2, H * 0.4 + 80);
  if (keyPressed(G.input, 'Enter')) G.uiAction = 'respawn';
}

function drawHelp(G, g, W, H) {
  dim(g, W, H, 0.7);
  const c = card(g, W, H, 620, 440);
  g.textAlign = 'left';
  g.font = 'bold 26px Arial';
  g.fillStyle = '#facc15';
  g.fillText('HOW TO PLAY', c.x + 32, c.y + 48);
  const rows = [
    ['Move / drive', 'WASD or arrow keys'],
    ['Run', 'Shift (on foot)'],
    ['Handbrake / drift', 'Space (in a car)'],
    ['Enter / steal car, interact', 'E'],
    ['Aim', 'Mouse'],
    ['Shoot', 'Left click (on foot)'],
    ['Pause', 'Esc'],
    ['Mute', 'M'],
    ['Help', 'H'],
    ['', ''],
    ['Earn stars', 'Steal cars, hit people, shoot near cops'],
    ['Lose stars', 'Hide until the heat cools, or pay for a respray at Lena\u2019s Garage (G)'],
    ['Save', 'At your apartment (H), or from the pause menu'],
    ['Missions', 'Drive to the pink M marker and press E'],
    ['Taxi shifts', 'Visit the yellow T rank and press E'],
  ];
  g.font = '14px Arial';
  let y = c.y + 86;
  for (const [k, v] of rows) {
    if (k === '') { y += 8; continue; }
    g.fillStyle = '#facc15';
    g.fillText(k, c.x + 32, y);
    g.fillStyle = '#ffffff';
    g.fillText(v, c.x + 250, y);
    y += 24;
  }
  g.textAlign = 'center';
  g.font = 'bold 14px Arial';
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.fillText('ESC — Back', W / 2, c.y + c.h - 24);
  if (keyPressed(G.input, 'Escape') || keyPressed(G.input, 'Enter')) G.uiAction = 'helpBack';
}

// Keyboard navigation for the two menu screens; click handling lives in drawMenu.
export function handleMenuKeys(G) {
  if (G.screen === 'title' || G.screen === 'pause') {
    menuKeys(G, menuItemsFor(G).length);
    if (G.screen === 'pause' && keyPressed(G.input, 'Escape')) G.uiAction = 'resume';
  }
}

export function saveFromMenu(G) {
  if (saveGame(G)) {
    G.banner = { text: 'GAME SAVED', sub: 'Progress stored', t: 0, dur: 2 };
  } else {
    G.banner = { text: 'SAVE FAILED', sub: 'Browser storage is unavailable', t: 0, dur: 2 };
  }
}

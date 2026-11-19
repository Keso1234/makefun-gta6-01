// Solmar City itself: a seeded, deterministic grid city — downtown towers, a
// park, a port, a beach and a boardwalk — with its roads, buildings, props,
// collision grid and two pre-rendered layers (the full static map and the
// minimap) so the frame loop never redraws the city itself.

import { AVENUES_X, STREETS_Y, AVENUE_NAMES, STREET_NAMES, ROAD_W, SIDEWALK, WORLD_W, WORLD_H, BEACH_X, SEA_X, PALETTE, PLACES } from './config.js';
import { mulberry32, randRange, randPick, randInt, circleRectPush, clamp } from './utils.js';

const CELL = 200;

export function generateCity(seed) {
  const rng = mulberry32(seed || 1337);
  const city = {
    seed,
    buildings: [],
    containers: [],
    trees: [],
    palms: [],
    lamps: [],
    umbrellas: [],
    blocks: [],
    nodes: [],
    colliders: [],
    grid: new Map(),
    places: PLACES,
  };

  // Intersection graph: every avenue x every street is a node for traffic.
  for (const ax of AVENUES_X) {
    for (const sy of STREETS_Y) city.nodes.push({ x: ax, y: sy });
  }

  // Blocks between neighbouring roads.
  for (let i = 0; i < AVENUES_X.length - 1; i += 1) {
    for (let j = 0; j < STREETS_Y.length - 1; j += 1) {
      const x0 = AVENUES_X[i] + ROAD_W / 2 + SIDEWALK;
      const y0 = STREETS_Y[j] + ROAD_W / 2 + SIDEWALK;
      const x1 = AVENUES_X[i + 1] - ROAD_W / 2 - SIDEWALK;
      const y1 = STREETS_Y[j + 1] - ROAD_W / 2 - SIDEWALK;
      const block = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
      block.district = districtOf(block.cx, block.cy);
      city.blocks.push(block);
      fillBlock(city, block, rng);
    }
  }

  // Boardwalk shops in the strip between Ocean Dr and the beach.
  for (let j = 0; j < STREETS_Y.length - 1; j += 1) {
    const y0 = STREETS_Y[j] + ROAD_W / 2 + SIDEWALK;
    const y1 = STREETS_Y[j + 1] - ROAD_W / 2 - SIDEWALK;
    const n = randInt(rng, 2, 3);
    for (let k = 0; k < n; k += 1) {
      const h = (y1 - y0) / n - 14;
      city.buildings.push({
        x: 3030, y: y0 + k * ((y1 - y0) / n) + 7, w: 42, h,
        color: randPick(rng, PALETTE.roofColors), hgt: 14, kind: 'shop', seed: rng(),
      });
    }
  }

  // Palms along Ocean Dr and the beach; trees in the park and outskirts.
  for (let y = 120; y < WORLD_H - 100; y += 90) {
    city.palms.push({ x: 2985 + randRange(rng, -6, 6), y: y + randRange(rng, -14, 14) });
    city.palms.push({ x: 3120 + randRange(rng, -8, 8), y: y + randRange(rng, -20, 20) });
  }
  for (let i = 0; i < 90; i += 1) {
    const x = randRange(rng, 60, 1400);
    const y = randRange(rng, 60, 780);
    if (onRoad(x, y)) continue;
    city.trees.push({ x, y, r: randRange(rng, 12, 20) });
  }
  for (let i = 0; i < 60; i += 1) {
    const x = randRange(rng, 60, WORLD_W - 200);
    const y = randRange(rng, 60, WORLD_H - 60);
    if (onRoad(x, y) || x > BEACH_X) continue;
    if (city.buildings.some((b) => x > b.x - 24 && x < b.x + b.w + 24 && y > b.y - 24 && y < b.y + b.h + 24)) continue;
    city.trees.push({ x, y, r: randRange(rng, 10, 16) });
  }
  // Beach umbrellas.
  for (let i = 0; i < 14; i += 1) {
    city.umbrellas.push({ x: randRange(rng, 3130, 3260), y: randRange(rng, 150, WORLD_H - 150), color: randPick(rng, ['#e74c3c', '#f1c40f', '#3498db', '#ecf0f1', '#e67e22']) });
  }
  // Street lamps at every intersection.
  for (const n of city.nodes) {
    city.lamps.push({ x: n.x - ROAD_W / 2 - 4, y: n.y - ROAD_W / 2 - 4 });
    city.lamps.push({ x: n.x + ROAD_W / 2 + 4, y: n.y + ROAD_W / 2 + 4 });
  }

  city.colliders = city.buildings.concat(city.containers);
  buildGrid(city);
  city.staticCanvas = renderStaticLayer(city);
  city.minimapCanvas = renderMinimapLayer(city);
  return city;
}

export function districtOf(x, y) {
  if (x > BEACH_X) return 'beach';
  if (x < 560 && y > 1960) return 'port';
  if (x >= 560 && x <= 1360 && y >= 160 && y <= 760) return 'park';
  if (x >= 1360 && x <= 2560 && y >= 760 && y <= 1660) return 'downtown';
  return 'residential';
}

function fillBlock(city, block, rng) {
  const { x, y, w, h } = block;
  if (block.district === 'park') {
    for (let i = 0; i < 7; i += 1) city.trees.push({ x: x + randRange(rng, 20, w - 20), y: y + randRange(rng, 20, h - 20), r: randRange(rng, 13, 22) });
    return;
  }
  if (block.district === 'port') {
    const wh = randInt(rng, 1, 2);
    for (let k = 0; k < wh; k += 1) {
      const bw = randRange(rng, 120, 170);
      const bh = randRange(rng, 60, 90);
      city.buildings.push({
        x: x + 14 + k * ((w - 28 - bw) / Math.max(1, wh - 1 || 1)), y: y + 16, w: bw, h: bh,
        color: randPick(rng, ['#8d99ae', '#a8a29a', '#7d8a96']), hgt: 16, kind: 'warehouse', seed: rng(),
      });
    }
    for (let i = 0; i < 8; i += 1) {
      city.containers.push({
        x: x + 12 + (i % 4) * ((w - 24) / 4), y: y + h - 58 - Math.floor(i / 4) * 26,
        w: 34, h: 20, color: randPick(rng, ['#c0392b', '#2980b9', '#27ae60', '#e67e22', '#7f8c8d']),
      });
    }
    return;
  }
  if (block.district === 'downtown') {
    const n = randInt(rng, 1, 2);
    for (let k = 0; k < n; k += 1) {
      const bw = randRange(rng, 90, Math.min(150, w - 30));
      const bh = randRange(rng, 80, Math.min(130, h - 30));
      city.buildings.push({
        x: x + 14 + k * Math.max(0, (w - 28 - bw) / Math.max(1, n - 1)), y: y + 14 + randRange(rng, 0, Math.max(0, h - 28 - bh)),
        w: bw, h: bh, color: randPick(rng, PALETTE.downtownColors), hgt: randRange(rng, 26, 44), kind: 'tower', seed: rng(),
      });
    }
    return;
  }
  // Residential: small houses with yards.
  const cols = w > 200 ? 2 : 1;
  const rows = h > 180 ? 2 : 1;
  for (let cx = 0; cx < cols; cx += 1) {
    for (let cy = 0; cy < rows; cy += 1) {
      if (rng() < 0.15) continue;
      const bw = randRange(rng, 46, 64);
      const bh = randRange(rng, 40, 56);
      city.buildings.push({
        x: x + 16 + cx * ((w - 32) / cols) + randRange(rng, 0, Math.max(0, (w - 32) / cols - bw - 8)),
        y: y + 14 + cy * ((h - 28) / rows) + randRange(rng, 0, Math.max(0, (h - 28) / rows - bh - 8)),
        w: bw, h: bh, color: randPick(rng, PALETTE.houseColors), hgt: 12, kind: 'house', seed: rng(),
      });
    }
  }
}

function buildGrid(city) {
  city.colliders.forEach((r, idx) => {
    const x0 = Math.floor(r.x / CELL);
    const x1 = Math.floor((r.x + r.w) / CELL);
    const y0 = Math.floor(r.y / CELL);
    const y1 = Math.floor((r.y + r.h) / CELL);
    for (let cx = x0; cx <= x1; cx += 1) {
      for (let cy = y0; cy <= y1; cy += 1) {
        const key = cx + ',' + cy;
        if (!city.grid.has(key)) city.grid.set(key, []);
        city.grid.get(key).push(idx);
      }
    }
  });
}

// Push a circle out of buildings, containers, the sea and the world edge.
export function collideCircle(city, x, y, r) {
  let px = clamp(x, r, WORLD_W - r);
  let py = clamp(y, r, WORLD_H - r);
  if (px > SEA_X - r) px = SEA_X - r;
  const cx = Math.floor(px / CELL);
  const cy = Math.floor(py / CELL);
  for (let gx = cx - 1; gx <= cx + 1; gx += 1) {
    for (let gy = cy - 1; gy <= cy + 1; gy += 1) {
      const list = city.grid.get(gx + ',' + gy);
      if (!list) continue;
      for (const idx of list) {
        const b = city.colliders[idx];
        const push = circleRectPush(px, py, r, b.x, b.y, b.w, b.h);
        if (push) { px += push.x; py += push.y; }
      }
    }
  }
  return { x: px, y: py };
}

// Is a point inside any building or container? Grid lookup, so it stays cheap.
export function pointBlocked(city, x, y) {
  const list = city.grid.get(Math.floor(x / CELL) + ',' + Math.floor(y / CELL));
  if (!list) return false;
  for (const idx of list) {
    const b = city.colliders[idx];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

// Line of sight between two points, sampled every 40 px against the grid.
export function hasLineOfSight(city, x1, y1, x2, y2) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.ceil(d / 40);
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (pointBlocked(city, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
  }
  return true;
}

export function onRoad(x, y) {  for (const ax of AVENUES_X) if (Math.abs(x - ax) < ROAD_W / 2) return true;
  for (const sy of STREETS_Y) if (Math.abs(y - sy) < ROAD_W / 2) return true;
  return false;
}

export function nearestStreetName(x, y) {
  let bestD = Infinity;
  let name = 'Solmar City';
  AVENUES_X.forEach((ax, i) => {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; name = AVENUE_NAMES[i]; }
  });
  STREETS_Y.forEach((sy, i) => {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; name = STREET_NAMES[i]; }
  });
  if (x > BEACH_X) return 'Solmar Beach';
  return name;
}

export function nearestNode(city, x, y) {
  let best = city.nodes[0];
  let bd = Infinity;
  for (const n of city.nodes) {
    const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

export function nodeNeighbours(city, node) {
  const out = [];
  for (const n of city.nodes) {
    if (n === node) continue;
    if (n.x === node.x && Math.abs(n.y - node.y) <= 310) out.push(n);
    if (n.y === node.y && Math.abs(n.x - node.x) <= 410) out.push(n);
  }
  return out;
}

// Shortest road route between two points, as a list of intersections (BFS
// over the grid). Used by the screenshot autopilot and police pursuit.
export function planRoute(city, fromX, fromY, toX, toY) {
  const start = nearestNode(city, fromX, fromY);
  const goal = nearestNode(city, toX, toY);
  const prev = new Map();
  const queue = [start];
  prev.set(start, null);
  while (queue.length > 0) {
    const n = queue.shift();
    if (n === goal) break;
    for (const nb of nodeNeighbours(city, n)) {
      if (!prev.has(nb)) {
        prev.set(nb, n);
        queue.push(nb);
      }
    }
  }
  if (!prev.has(goal)) return [goal];
  const path = [];
  let cur = goal;
  while (cur) {
    path.unshift(cur);
    cur = prev.get(cur);
  }
  return path;
}

export function randomRoadPoint(rng, cx, cy, radius) {
  for (let tries = 0; tries < 24; tries += 1) {
    const a = rng() * Math.PI * 2;
    const d = radius * (0.4 + rng() * 0.6);
    const x = clamp(cx + Math.cos(a) * d, 80, WORLD_W - 120);
    const y = clamp(cy + Math.sin(a) * d, 80, WORLD_H - 80);
    // Snap onto the nearest road centreline.
    let bx = x;
    let by = y;
    let bd = Infinity;
    for (const ax of AVENUES_X) { const dd = Math.abs(x - ax); if (dd < bd) { bd = dd; bx = ax; } }
    let bd2 = Infinity;
    for (const sy of STREETS_Y) { const dd = Math.abs(y - sy); if (dd < bd2) { bd2 = dd; by = sy; } }
    if (bd < bd2) return { x: bx, y };
    return { x, y: by };
  }
  return { x: AVENUES_X[2], y: STREETS_Y[2] };
}

// ---- Pre-rendered layers -------------------------------------------------

function renderStaticLayer(city) {
  const c = document.createElement('canvas');
  c.width = WORLD_W;
  c.height = WORLD_H;
  const g = c.getContext('2d');

  // Ground.
  g.fillStyle = PALETTE.grass;
  g.fillRect(0, 0, WORLD_W, WORLD_H);
  // Mow stripes for a little texture.
  g.fillStyle = PALETTE.grassDark;
  for (let y = 0; y < WORLD_H; y += 160) g.fillRect(0, y, WORLD_W, 80);

  // Park.
  g.fillStyle = PALETTE.parkGreen;
  g.fillRect(560, 160, 800, 600);
  // Pond.
  g.fillStyle = PALETTE.sea;
  g.beginPath();
  g.ellipse(1160, 610, 95, 62, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = PALETTE.seaDeep;
  g.beginPath();
  g.ellipse(1160, 610, 70, 42, 0, 0, Math.PI * 2);
  g.fill();

  // Port concrete.
  g.fillStyle = PALETTE.concrete;
  g.fillRect(0, 1960, 560, 640);

  // Beach sand and sea.
  g.fillStyle = PALETTE.sand;
  g.fillRect(BEACH_X, 0, SEA_X - BEACH_X, WORLD_H);
  g.fillStyle = PALETTE.sea;
  g.fillRect(SEA_X, 0, WORLD_W - SEA_X, WORLD_H);
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  for (let y = 40; y < WORLD_H; y += 130) {
    g.beginPath();
    for (let x = SEA_X + 8; x < WORLD_W - 6; x += 24) g.lineTo(x, y + Math.sin(x / 22) * 4);
    g.stroke();
  }
  // Boardwalk.
  g.fillStyle = '#b98d5e';
  g.fillRect(BEACH_X - 14, 0, 16, WORLD_H);
  g.fillStyle = '#a67c4e';
  for (let y = 0; y < WORLD_H; y += 26) g.fillRect(BEACH_X - 14, y, 16, 3);

  // Roads.
  g.fillStyle = PALETTE.asphalt;
  for (const ax of AVENUES_X) g.fillRect(ax - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const sy of STREETS_Y) g.fillRect(0, sy - ROAD_W / 2, WORLD_W, ROAD_W);
  // Asphalt patch variation.
  g.fillStyle = PALETTE.asphaltDark;
  const rng = mulberry32(99);
  for (let i = 0; i < 40; i += 1) {
    const ax = randPick(rng, AVENUES_X);
    g.fillRect(ax - ROAD_W / 2 + randRange(rng, 4, 60), randRange(rng, 0, WORLD_H - 80), randRange(rng, 20, 40), randRange(rng, 40, 90));
  }
  // Centre dashes and edge lines.
  g.strokeStyle = '#e8c33a';
  g.lineWidth = 3;
  g.setLineDash([26, 22]);
  for (const ax of AVENUES_X) { g.beginPath(); g.moveTo(ax, 0); g.lineTo(ax, WORLD_H); g.stroke(); }
  for (const sy of STREETS_Y) { g.beginPath(); g.moveTo(0, sy); g.lineTo(WORLD_W, sy); g.stroke(); }
  g.setLineDash([]);
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 2;
  for (const ax of AVENUES_X) {
    g.beginPath(); g.moveTo(ax - ROAD_W / 2 + 5, 0); g.lineTo(ax - ROAD_W / 2 + 5, WORLD_H); g.stroke();
    g.beginPath(); g.moveTo(ax + ROAD_W / 2 - 5, 0); g.lineTo(ax + ROAD_W / 2 - 5, WORLD_H); g.stroke();
  }
  for (const sy of STREETS_Y) {
    g.beginPath(); g.moveTo(0, sy - ROAD_W / 2 + 5); g.lineTo(WORLD_W, sy - ROAD_W / 2 + 5); g.stroke();
    g.beginPath(); g.moveTo(0, sy + ROAD_W / 2 - 5); g.lineTo(WORLD_W, sy + ROAD_W / 2 - 5); g.stroke();
  }
  // Crosswalks at every intersection.
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (const ax of AVENUES_X) {
    for (const sy of STREETS_Y) {
      for (const dy of [-1, 1]) {
        for (let i = -3; i <= 3; i += 1) g.fillRect(ax + i * 13 - 4, sy + dy * (ROAD_W / 2 + 10) - 4, 8, 8);
      }
      for (const dx of [-1, 1]) {
        for (let i = -3; i <= 3; i += 1) g.fillRect(ax + dx * (ROAD_W / 2 + 10) - 4, sy + i * 13 - 4, 8, 8);
      }
    }
  }
  // Street name labels.
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.font = 'bold 15px Arial, sans-serif';
  g.textAlign = 'center';
  AVENUES_X.forEach((ax, i) => {
    g.save();
    g.translate(ax + 26, 1300);
    g.rotate(-Math.PI / 2);
    g.fillText(AVENUE_NAMES[i].toUpperCase(), 0, 0);
    g.restore();
  });
  STREETS_Y.forEach((sy, i) => {
    g.fillText(STREET_NAMES[i].toUpperCase(), 1700, sy + 26);
  });

  // Sidewalks and block ground.
  for (const b of city.blocks) {
    g.fillStyle = PALETTE.sidewalk;
    g.fillRect(b.x - SIDEWALK, b.y - SIDEWALK, b.w + SIDEWALK * 2, b.h + SIDEWALK * 2);
    g.fillStyle = b.district === 'park' ? PALETTE.parkGreen : b.district === 'port' ? PALETTE.concrete : b.district === 'downtown' ? '#9d968a' : '#8fae6b';
    g.fillRect(b.x, b.y, b.w, b.h);
  }

  // Pier into the sea.
  g.fillStyle = '#8a6a45';
  g.fillRect(3260, 1370, 130, 60);
  g.fillStyle = '#a07c50';
  for (let x = 3260; x < 3390; x += 14) g.fillRect(x, 1370, 7, 60);
  g.fillStyle = '#6e5233';
  for (let x = 3270; x < 3390; x += 30) { g.fillRect(x, 1364, 6, 6); g.fillRect(x, 1424, 6, 6); }

  // Containers.
  for (const cn of city.containers) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(cn.x + 4, cn.y + 5, cn.w, cn.h);
    g.fillStyle = cn.color;
    g.fillRect(cn.x, cn.y, cn.w, cn.h);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 4; i < cn.w; i += 8) g.fillRect(cn.x + i, cn.y + 2, 2, cn.h - 4);
  }

  // Buildings: shadow, side face for height, roof, details.
  for (const b of city.buildings) {
    const sh = b.hgt;
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(b.x + sh * 0.5, b.y + sh * 0.6, b.w, b.h);
    g.fillStyle = shade(b.color, -28);
    g.fillRect(b.x, b.y + sh * 0.35, b.w, b.h);
    g.fillStyle = b.color;
    g.fillRect(b.x, b.y, b.w, b.h);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2;
    g.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // Roof details: AC units, skylights, vents.
    const brng = mulberry32(Math.floor(b.seed * 1e9));
    g.fillStyle = 'rgba(255,255,255,0.35)';
    const nDetail = b.kind === 'tower' ? 4 : b.kind === 'warehouse' ? 3 : 1;
    for (let i = 0; i < nDetail; i += 1) {
      const dw = randRange(brng, 8, 18);
      const dh = randRange(brng, 6, 14);
      g.fillRect(b.x + randRange(brng, 6, Math.max(7, b.w - dw - 6)), b.y + randRange(brng, 6, Math.max(7, b.h - dh - 6)), dw, dh);
    }
    if (b.kind === 'house') {
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.2, b.w * 0.6, b.h * 0.6);
    }
    if (b.kind === 'tower') {
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(b.x + b.w / 2 - 3, b.y + b.h / 2 - 3, 6, 6);
    }
  }

  // Trees and palms.
  for (const t of city.trees) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(t.x + 5, t.y + 7, t.r, t.r * 0.8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2f7a33';
    g.beginPath(); g.arc(t.x, t.y, t.r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#43a047';
    g.beginPath(); g.arc(t.x - 3, t.y - 3, t.r * 0.62, 0, Math.PI * 2); g.fill();
  }
  for (const p of city.palms) {
    g.strokeStyle = '#7a5a36';
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(p.x, p.y + 8); g.lineTo(p.x + 2, p.y - 6); g.stroke();
    g.strokeStyle = '#2e8b3a';
    g.lineWidth = 3;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.moveTo(p.x + 2, p.y - 6);
      g.quadraticCurveTo(p.x + 2 + Math.cos(a) * 10, p.y - 6 + Math.sin(a) * 10 - 4, p.x + 2 + Math.cos(a) * 16, p.y - 6 + Math.sin(a) * 16 + 3);
      g.stroke();
    }
  }
  // Beach umbrellas.
  for (const u of city.umbrellas) {
    g.strokeStyle = '#8a6a45';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(u.x, u.y); g.lineTo(u.x, u.y - 10); g.stroke();
    g.fillStyle = u.color;
    g.beginPath(); g.arc(u.x, u.y - 10, 12, Math.PI, 0); g.fill();
  }
  // Lamps.
  g.fillStyle = '#5a5a5a';
  for (const l of city.lamps) {
    g.beginPath(); g.arc(l.x, l.y, 3, 0, Math.PI * 2); g.fill();
  }
  return c;
}

function renderMinimapLayer(city) {
  const scale = 0.1;
  const c = document.createElement('canvas');
  c.width = WORLD_W * scale;
  c.height = WORLD_H * scale;
  const g = c.getContext('2d');
  g.fillStyle = '#22401e';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#3f7a35';
  g.fillRect(56, 16, 80, 60);
  g.fillStyle = '#c9b078';
  g.fillRect(BEACH_X * scale, 0, (SEA_X - BEACH_X) * scale, c.height);
  g.fillStyle = '#1f7fa3';
  g.fillRect(SEA_X * scale, 0, (WORLD_W - SEA_X) * scale, c.height);
  g.fillStyle = '#8a8578';
  g.fillRect(0, 196, 56, 64);
  g.strokeStyle = '#d8d2c0';
  g.lineWidth = 10;
  for (const ax of AVENUES_X) { g.beginPath(); g.moveTo(ax * scale, 0); g.lineTo(ax * scale, c.height); g.stroke(); }
  for (const sy of STREETS_Y) { g.beginPath(); g.moveTo(0, sy * scale); g.lineTo(c.width, sy * scale); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (const b of city.buildings) g.fillRect(b.x * scale, b.y * scale, Math.max(2, b.w * scale), Math.max(2, b.h * scale));
  return c;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255);
  const gg = clamp(((n >> 8) & 0xff) + amt, 0, 255);
  const b = clamp((n & 0xff) + amt, 0, 255);
  return 'rgb(' + r + ',' + gg + ',' + b + ')';
}

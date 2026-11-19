// Small shared helpers: a seeded RNG so the city is identical every load, plus
// the angle, distance and collision math every system uses.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
export function angleTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }

// Shortest signed turn from angle `from` toward angle `to`, in (-PI, PI].
export function angleDiff(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
export function randPick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

// Circle vs axis-aligned rect: returns the push-out vector, or null when clear.
export function circleRectPush(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx;
  const dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    return { x: (dx / d) * (r - d), y: (dy / d) * (r - d) };
  }
  // Centre inside the rect: push out along the smallest penetration axis.
  const left = cx - rx;
  const right = rx + rw - cx;
  const top = cy - ry;
  const bottom = ry + rh - cy;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: -(left + r), y: 0 };
  if (m === right) return { x: right + r, y: 0 };
  if (m === top) return { x: 0, y: -(top + r) };
  return { x: 0, y: bottom + r };
}

export function pointInRect(x, y, rx, ry, rw, rh) {
  return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
}

// Does the segment (x1,y1)-(x2,y2) cross any rect in `rects`? Sampled, cheap and
// good enough for line-of-sight checks between buildings.
export function segmentBlocked(x1, y1, x2, y2, rects) {
  const steps = Math.ceil(dist(x1, y1, x2, y2) / 24);
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = lerp(x1, x2, t);
    const y = lerp(y1, y2, t);
    for (let j = 0; j < rects.length; j += 1) {
      const r = rects[j];
      if (pointInRect(x, y, r.x, r.y, r.w, r.h)) return true;
    }
  }
  return false;
}

export function formatMoney(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }

export function formatClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  const hh = h % 12 === 0 ? 12 : h % 12;
  const ap = h < 12 ? 'AM' : 'PM';
  return hh + ':' + String(m).padStart(2, '0') + ' ' + ap;
}

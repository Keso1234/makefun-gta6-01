// Particles, skid marks and floating text: the juice. Sparks on impacts, smoke
// from wrecked cars, muzzle flashes, cash popups — all short-lived, all pooled
// on the game state and drawn by render.js.

export function createEffects() {
  return { particles: [], skids: [], floats: [] };
}

export function spawnParticles(G, x, y, opts) {
  const count = opts.count || 8;
  for (let i = 0; i < count; i += 1) {
    if (G.effects.particles.length > 400) return;
    const a = Math.random() * Math.PI * 2;
    const sp = (opts.speed || 120) * (0.3 + Math.random() * 0.9);
    G.effects.particles.push({
      x, y,
      vx: Math.cos(a) * sp + (opts.vx || 0),
      vy: Math.sin(a) * sp + (opts.vy || 0),
      life: 0,
      maxLife: (opts.life || 0.5) * (0.6 + Math.random() * 0.8),
      size: (opts.size || 3) * (0.6 + Math.random() * 0.8),
      color: opts.color || '#ffcc33',
      gravity: opts.gravity || 0,
      drag: opts.drag || 2,
    });
  }
}

export function spawnSparks(G, x, y, dir) {
  spawnParticles(G, x, y, { count: 10, speed: 220, life: 0.4, size: 2.5, color: '#ffdd55', vx: Math.cos(dir) * 80, vy: Math.sin(dir) * 80 });
}
export function spawnSmoke(G, x, y) {
  spawnParticles(G, x, y, { count: 2, speed: 25, life: 1.1, size: 7, color: 'rgba(60,60,60,0.5)', vx: 0, vy: -18 });
}
export function spawnMuzzle(G, x, y, angle) {
  spawnParticles(G, x, y, { count: 4, speed: 90, life: 0.09, size: 4, color: '#ffea88', vx: Math.cos(angle) * 140, vy: Math.sin(angle) * 140 });
}
export function spawnBlood(G, x, y) {
  spawnParticles(G, x, y, { count: 8, speed: 130, life: 0.45, size: 3, color: '#c0392b', gravity: 300 });
}
export function spawnExplosion(G, x, y) {
  spawnParticles(G, x, y, { count: 40, speed: 320, life: 0.7, size: 6, color: '#ff8833' });
  spawnParticles(G, x, y, { count: 24, speed: 180, life: 1.1, size: 9, color: 'rgba(50,50,50,0.55)' });
  spawnParticles(G, x, y, { count: 14, speed: 420, life: 0.35, size: 3, color: '#ffee88' });
}

export function addSkid(G, x, y, angle) {
  const s = G.effects.skids;
  s.push({ x, y, angle, life: 0, maxLife: 5 });
  if (s.length > 300) s.splice(0, s.length - 300);
}

export function addFloat(G, x, y, text, color) {
  G.effects.floats.push({ x, y, text, color: color || '#ffffff', life: 0, maxLife: 1.4 });
  if (G.effects.floats.length > 24) G.effects.floats.shift();
}

export function updateEffects(G, dt) {
  const fx = G.effects;
  for (let i = fx.particles.length - 1; i >= 0; i -= 1) {
    const p = fx.particles[i];
    p.life += dt;
    if (p.life >= p.maxLife) { fx.particles.splice(i, 1); continue; }
    p.vy += p.gravity * dt;
    const d = Math.max(0, 1 - p.drag * dt);
    p.vx *= d;
    p.vy *= d;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  for (let i = fx.skids.length - 1; i >= 0; i -= 1) {
    fx.skids[i].life += dt;
    if (fx.skids[i].life >= fx.skids[i].maxLife) fx.skids.splice(i, 1);
  }
  for (let i = fx.floats.length - 1; i >= 0; i -= 1) {
    const f = fx.floats[i];
    f.life += dt;
    f.y -= 26 * dt;
    if (f.life >= f.maxLife) fx.floats.splice(i, 1);
  }
}

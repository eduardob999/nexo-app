import type { Particle } from './sky';

export interface P { x: number; y: number; vx: number; vy: number; r: number; a: number; spin: number; hue: number }

/** How many particles for a kind at an intensity, on a screen of this area. Capped so a phone never struggles. */
export function countFor(kind: Particle, intensity: number, w: number, h: number): number {
  const area = (w * h) / (390 * 700);
  const per = kind === 'rain' ? 110 : kind === 'snow' ? 55 : kind === 'petals' ? 16 : kind === 'leaves' ? 14 : kind === 'fireflies' ? 14 : kind === 'stars' ? 70 : 0;
  return Math.min(180, Math.round(per * area * Math.max(0, Math.min(1, intensity))));
}

export function make(kind: Particle, n: number, w: number, h: number, rand: () => number): P[] {
  return Array.from({ length: n }, () => spawn(kind, w, h, rand, true));
}

export function spawn(kind: Particle, w: number, h: number, rand: () => number, anywhere = false): P {
  const x = rand() * w;
  const y = anywhere ? rand() * h : -10;
  switch (kind) {
    case 'rain': return { x, y, vx: -40, vy: 520 + rand() * 260, r: 8 + rand() * 10, a: 0.25 + rand() * 0.25, spin: 0, hue: 210 };
    case 'snow': return { x, y, vx: (rand() - 0.5) * 24, vy: 28 + rand() * 40, r: 1.2 + rand() * 2.4, a: 0.5 + rand() * 0.4, spin: rand() * 6, hue: 0 };
    case 'petals': return { x, y, vx: 14 + rand() * 20, vy: 24 + rand() * 24, r: 3 + rand() * 3, a: 0.7, spin: rand() * 6, hue: 340 };
    case 'leaves': return { x, y, vx: 10 + rand() * 24, vy: 30 + rand() * 30, r: 4 + rand() * 3, a: 0.75, spin: rand() * 6, hue: 18 + rand() * 24 };
    case 'fireflies': return { x, y: anywhere ? rand() * h * 0.7 : rand() * h * 0.7, vx: (rand() - 0.5) * 10, vy: (rand() - 0.5) * 8, r: 1.6 + rand() * 1.4, a: rand(), spin: rand() * 6, hue: 62 };
    case 'stars': return { x, y: rand() * h, vx: 0, vy: 0, r: 0.5 + rand() * 1.1, a: 0.3 + rand() * 0.7, spin: rand() * 6, hue: 0 };
    default: return { x, y, vx: 0, vy: 0, r: 0, a: 0, spin: 0, hue: 0 };
  }
}

/** Advance one particle by dt seconds. Returns the moved particle, or null when it left the screen and should respawn. */
export function step(p: P, kind: Particle, dt: number, w: number, h: number, t: number): P | null {
  if (kind === 'stars') return { ...p, a: 0.35 + 0.65 * Math.abs(Math.sin(t * 0.8 + p.spin)) };
  if (kind === 'fireflies') {
    const x = p.x + (p.vx + Math.sin(t + p.spin) * 8) * dt, y = p.y + (p.vy + Math.cos(t * 0.7 + p.spin) * 6) * dt;
    return { ...p, x: (x + w) % w, y: Math.max(0, Math.min(h * 0.75, y)), a: 0.25 + 0.75 * Math.abs(Math.sin(t * 1.3 + p.spin)) };
  }
  const sway = kind === 'petals' || kind === 'leaves' || kind === 'snow' ? Math.sin(t * 1.1 + p.spin) * 14 : 0;
  const x = p.x + (p.vx + sway) * dt, y = p.y + p.vy * dt;
  if (y > h + 12 || x > w + 24 || x < -24) return null;
  return { ...p, x, y };
}

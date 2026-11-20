import { useEffect, useRef } from 'react';
import { countFor, make, spawn, step, type P } from './particles';
import { contrast, groundAlpha, hex, type Particle, type SkyState } from './sky';

export const GROUND = { light: { bg: '#f3f4f1', ink: '#15171b' }, dark: { bg: '#0f1114', ink: '#f5f4ef' } } as const;

/** How much of the sky may show behind the title, never so much that the title loses 4.5 contrast. */
export function skyAlpha(state: SkyState, dark: boolean, mode: 'subtle' | 'full'): number {
  const g = dark ? GROUND.dark : GROUND.light;
  return groundAlpha(state.stops[0], g.bg, g.ink, mode === 'full' ? 0.7 : 0.38);
}

function draw(ctx: CanvasRenderingContext2D, kind: Particle, ps: P[], w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  for (const p of ps) {
    ctx.globalAlpha = p.a;
    if (kind === 'rain') { ctx.strokeStyle = '#a8c4e8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * 0.02, p.y - p.r); ctx.stroke(); }
    else if (kind === 'snow' || kind === 'stars') { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill(); }
    else if (kind === 'fireflies') { ctx.fillStyle = `hsl(${p.hue} 90% 65%)`; ctx.shadowColor = `hsl(${p.hue} 90% 60%)`; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill(); ctx.shadowBlur = 0; }
    else { ctx.fillStyle = kind === 'petals' ? `hsl(${p.hue} 70% 82%)` : `hsl(${p.hue} 75% 50%)`; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin + p.y * 0.01); ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, 6.3); ctx.fill(); ctx.restore(); }
  }
  ctx.globalAlpha = 1;
}

/** The sky behind the app. Fixed, never takes a tap, and stands still when the person asks for less motion. */
export function Sky({ state, dark, mode, still }: { state: SkyState; dark: boolean; mode: 'subtle' | 'full'; still?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const alpha = skyAlpha(state, dark, mode);
  const reduce = still ?? (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const { particle, intensity } = state;
  useEffect(() => {
    const el = canvas.current;
    if (!el || particle === 'none') return undefined;
    const w = el.clientWidth || 390, h = el.clientHeight || 400;
    el.width = w; el.height = h;
    const ctx = el.getContext('2d');
    if (!ctx) return undefined;
    const rand = Math.random;
    let ps = make(particle, countFor(particle, intensity, w, h), w, h, rand);
    if (reduce) { draw(ctx, particle, ps, w, h); return undefined; }
    let raf = 0, last = performance.now(), acc = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; acc += dt;
      if (acc < 1 / 30) return;
      const t = now / 1000;
      ps = ps.map((p) => step(p, particle, acc, w, h, t) ?? spawn(particle, w, h, rand));
      acc = 0;
      draw(ctx, particle, ps, w, h);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [particle, intensity, reduce]);
  if (alpha <= 0.02 && state.dim <= 0 && !state.edge) return null;
  const [top, mid, low] = state.stops;
  const sunX = state.sun ? 8 + state.sun.x * 84 : 0, sunY = state.sun ? 62 - state.sun.y * 44 : 0;
  const moon = state.moon;
  return (
    <div className="sky" aria-hidden="true" style={{ opacity: 1 }}>
      <div className="sky-grad" style={{ background: `linear-gradient(180deg, ${top} 0%, ${mid} 55%, ${low} 100%)`, opacity: alpha }} />
      <svg className="sky-svg" viewBox="0 0 100 60" preserveAspectRatio="none" style={{ opacity: Math.min(1, alpha * 1.6) }}>
        {state.sun ? <circle cx={sunX} cy={sunY * 0.9} r="3.4" fill="#fff3c4" /> : null}
        {moon ? <><circle cx={8 + moon.x * 84} cy={(62 - moon.y * 44) * 0.9} r="2.8" fill="#f2f0e4" /><circle cx={8 + moon.x * 84 + (moon.phase < 0.5 ? 1.4 : -1.4) * (1 - Math.abs(moon.phase - 0.5) * 2)} cy={(62 - moon.y * 44) * 0.9} r="2.6" fill={mid} /></> : null}
        {state.horizon ? <path d="M0 55 L12 54 L24 55 L40 53.5 L56 55 L72 54 L100 55" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="0.6" fill="none" strokeDasharray="1.2 1.2" /> : null}
      </svg>
      {particle !== 'none' ? <canvas ref={canvas} className="sky-canvas" /> : null}
      {state.edge ? <div className="sky-edge" style={{ boxShadow: `inset 0 0 ${14 + state.edge.strength * 40}px ${2 + state.edge.strength * 8}px ${state.edge.color}`, opacity: 0.18 + state.edge.strength * 0.5 }} /> : null}
      {dark && state.dim > 0 ? <div className="sky-dim" style={{ background: `rgba(0,0,0,${state.dim})` }} /> : null}
    </div>
  );
}

export { contrast, hex };

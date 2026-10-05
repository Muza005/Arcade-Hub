// Бот «Точек» (DOTS_SPEC): летит к ближайшей звезде, без рывка. Решает по состоянию симуляции — детерминированно.
import type { InputState } from '../engine/input';
import type { Sim } from './sim';

export function botInput(sim: Sim, id: string): InputState {
  const dot = sim.dots.find((d) => d.id === id);
  if (!dot || sim.stars.length === 0) return { x: 0, y: 0, btn: false };
  let best = sim.stars[0] as (typeof sim.stars)[number];
  let bestDist = Infinity;
  for (const star of sim.stars) {
    const d = Math.hypot(star.x - dot.pos.x, star.y - dot.pos.y);
    if (d < bestDist) {
      bestDist = d;
      best = star;
    }
  }
  if (bestDist === 0) return { x: 0, y: 0, btn: false };
  const x = (best.x - dot.pos.x) / bestDist;
  const y = (best.y - dot.pos.y) / bestDist;
  return { x, y, btn: false };
}

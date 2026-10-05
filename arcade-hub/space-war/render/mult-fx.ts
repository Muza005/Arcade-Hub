// След и искры множителя (SPACE_WAR_SPEC §5 «Показ множителя»): с ×4 — блестящий след и искры, с ×5 — длиннее.
// След — аддитивная линия; искры — общие частицы (лимит делится между всеми, на низком качестве их нет).
// Время — по шагам симуляции: на паузе всё замирает.
import { Graphics, type Texture } from 'pixi.js';
import { MULT_SPARK_PER_S, MULT_SPARK_S, MULT_TRAIL_S, SPARK_SPEED, TRAIL_ALPHA, TRAIL_LINE_PX } from '../config';
import type { Particles } from './particles';

interface Point {
  x: number;
  y: number;
  t: number;
}

export interface MultFx {
  readonly view: Graphics;
  sparks: boolean;
  /** Шаг: позиция корабля, его ступень и цвет. */
  track(id: string, x: number, y: number, mult: number, color: string, dtS: number): void;
  /** Корабль погиб — его след пропадает. */
  drop(id: string): void;
  update(dtS: number): void;
  draw(): void;
}

export function createMultFx(particles: Particles, spark: Texture): MultFx {
  const view = new Graphics();
  view.blendMode = 'add';
  const trails = new Map<string, { points: Point[]; color: string; lifeS: number }>();
  const debt = new Map<string, number>();
  let now = 0;

  const fx: MultFx = {
    view,
    sparks: true,
    track(id, x, y, mult, color, dtS) {
      const i = mult - 1;
      const lifeS = MULT_TRAIL_S[i] ?? 0;
      let trail = trails.get(id);
      if (!trail) trails.set(id, (trail = { points: [], color, lifeS }));
      trail.color = color;
      trail.lifeS = lifeS;
      if (lifeS > 0) trail.points.push({ x, y, t: now });

      const rate = MULT_SPARK_PER_S[i] ?? 0;
      if (rate <= 0 || !fx.sparks) return;
      let d = (debt.get(id) ?? 0) + rate * dtS;
      const count = Math.floor(d);
      d -= count;
      debt.set(id, d);
      if (count > 0) {
        particles.burst(x, y, { texture: spark, color, count, speed: [0, SPARK_SPEED], life: MULT_SPARK_S[i] ?? 1 });
      }
    },
    drop(id) {
      trails.delete(id);
      debt.delete(id);
    },
    update(dtS) {
      now += dtS;
      for (const trail of trails.values()) {
        const cut = trail.points.findIndex((p) => now - p.t <= trail.lifeS);
        if (cut === -1) trail.points.length = 0;
        else if (cut > 0) trail.points.splice(0, cut);
      }
    },
    draw() {
      view.clear();
      for (const trail of trails.values()) {
        const pts = trail.points;
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1] as Point;
          const b = pts[i] as Point;
          const k = 1 - (now - b.t) / trail.lifeS;
          if (k <= 0) continue;
          view
            .moveTo(a.x, a.y)
            .lineTo(b.x, b.y)
            .stroke({ color: trail.color, width: TRAIL_LINE_PX * k, alpha: TRAIL_ALPHA * k, cap: 'round' });
        }
      }
    },
  };
  return fx;
}

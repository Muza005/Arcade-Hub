// След и искры множителя (SPACE_WAR_SPEC §5 «Показ множителя»): с ×4 — блестящий след и искры, с ×5 — длиннее.
// Искры делят общий лимит SPARKS_MAX: при толпе лидеров у всех гаснут старые — эффект короче, но не пропадает.
// Время — по шагам симуляции (на паузе всё замирает); случайность — своя, только для вида.
import { Graphics } from 'pixi.js';
import type { Rng } from '../../engine/rng';
import {
  MULT_SPARK_PER_S,
  MULT_SPARK_S,
  MULT_TRAIL_S,
  SPARK_RADIUS,
  SPARK_SPEED,
  SPARKS_MAX,
  TRAIL_ALPHA,
  TRAIL_LINE_PX,
} from '../config';

interface Point {
  x: number;
  y: number;
  t: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  color: string;
}

export interface MultFx {
  readonly view: Graphics;
  /** Шаг: позиция корабля, его ступень и цвет. */
  track(id: string, x: number, y: number, mult: number, color: string, dtS: number): void;
  /** Корабль погиб или вышел — его след пропадает. */
  drop(id: string): void;
  update(dtS: number): void;
  draw(): void;
}

export function createMultFx(rng: Rng): MultFx {
  const view = new Graphics();
  view.blendMode = 'add';
  const trails = new Map<string, { points: Point[]; color: string; lifeS: number }>();
  const sparks: Spark[] = [];
  const debt = new Map<string, number>();
  let now = 0;

  return {
    view,
    track(id, x, y, mult, color, dtS) {
      const i = mult - 1;
      const lifeS = MULT_TRAIL_S[i] ?? 0;
      let trail = trails.get(id);
      if (!trail) trails.set(id, (trail = { points: [], color, lifeS }));
      trail.color = color;
      trail.lifeS = lifeS;
      if (lifeS > 0) trail.points.push({ x, y, t: now });

      const rate = MULT_SPARK_PER_S[i] ?? 0;
      if (rate <= 0) return;
      let d = (debt.get(id) ?? 0) + rate * dtS;
      while (d >= 1) {
        d--;
        const a = rng.next() * Math.PI * 2;
        const speed = SPARK_SPEED * rng.next();
        sparks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, age: 0, life: MULT_SPARK_S[i] ?? 1, color });
        if (sparks.length > SPARKS_MAX) sparks.shift();
      }
      debt.set(id, d);
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
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i] as Spark;
        s.age += dtS;
        if (s.age >= s.life) {
          sparks.splice(i, 1);
          continue;
        }
        s.x += s.vx * dtS;
        s.y += s.vy * dtS;
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
      for (const s of sparks) view.circle(s.x, s.y, SPARK_RADIUS).fill({ color: s.color, alpha: 1 - s.age / s.life });
    },
  };
}

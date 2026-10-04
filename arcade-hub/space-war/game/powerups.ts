// Усиления (SPACE_WAR_SPEC §5 «Усиления», «Перегрузка»): выпадают из разбитых снарядами камней,
// лежат на поле 10 с, медленно плывут в случайную сторону (от краёв отскакивают), подбираются пролётом.
import type { Rng } from '../../engine/rng';
import { POWERUP_DRIFT_SPEED, POWERUP_LIFETIME_S, POWERUP_RADIUS, POWERUPS_OF_MODE, type Mode, type PowerupKind } from '../config';
import type { Bounds, Vec } from './ship';

export interface Powerup {
  id: number;
  kind: PowerupKind;
  pos: Vec;
  prev: Vec;
  vel: Vec;
  /** Сколько ещё лежать на поле, с. */
  leftS: number;
}

export interface Powerups {
  readonly list: readonly Powerup[];
  /** Выпадение в точке: вид — случайный из усилений режима, направление дрейфа — случайное. */
  drop(x: number, y: number): Powerup;
  remove(p: Powerup): void;
  step(dtS: number): void;
}

export function createPowerups(rng: Rng, mode: Mode, bounds: Bounds): Powerups {
  const list: Powerup[] = [];
  const kinds = POWERUPS_OF_MODE[mode];
  let nextId = 1;
  return {
    list,
    drop(x, y) {
      const a = rng.range(0, Math.PI * 2);
      const p = {
        id: nextId++,
        kind: rng.pick(kinds),
        pos: { x, y },
        prev: { x, y },
        vel: { x: Math.cos(a) * POWERUP_DRIFT_SPEED, y: Math.sin(a) * POWERUP_DRIFT_SPEED },
        leftS: POWERUP_LIFETIME_S,
      };
      list.push(p);
      return p;
    },
    remove(p) {
      const i = list.indexOf(p);
      if (i !== -1) list.splice(i, 1);
    },
    step(dtS) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i] as Powerup;
        p.leftS -= dtS;
        if (p.leftS <= 0) {
          list.splice(i, 1);
          continue;
        }
        p.prev.x = p.pos.x;
        p.prev.y = p.pos.y;
        p.pos.x += p.vel.x * dtS;
        p.pos.y += p.vel.y * dtS;
        // Внутри поля: у края — отскок.
        const r = POWERUP_RADIUS;
        if (p.pos.x < bounds.left + r || p.pos.x > bounds.right - r) {
          p.vel.x = -p.vel.x;
          p.pos.x = Math.min(bounds.right - r, Math.max(bounds.left + r, p.pos.x));
        }
        if (p.pos.y < bounds.top + r || p.pos.y > bounds.bottom - r) {
          p.vel.y = -p.vel.y;
          p.pos.y = Math.min(bounds.bottom - r, Math.max(bounds.top + r, p.pos.y));
        }
      }
    },
  };
}

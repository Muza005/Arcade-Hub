// Снаряды Power: летят прямо, с упреждением в выбранный камень; попадают в любой камень на пути.
import { Pool } from '../../engine/pool';
import { BULLET_LIFE_S, BULLET_SPEED, BULLETS_MAX } from '../config';
import type { Asteroid } from './asteroids';
import type { Vec } from './ship';

export interface Bullet {
  owner: string;
  pos: Vec;
  prev: Vec;
  vel: Vec;
  ttlS: number;
}

/** Точка встречи с камнем, летящим прямо: |p + v·t − s| = BULLET_SPEED · t. Нет решения — в текущую точку. */
export function leadDirection(from: Vec, rock: Asteroid): Vec {
  const rx = rock.pos.x - from.x;
  const ry = rock.pos.y - from.y;
  const { x: vx, y: vy } = rock.vel;
  const a = vx * vx + vy * vy - BULLET_SPEED * BULLET_SPEED;
  const b = 2 * (rx * vx + ry * vy);
  const c = rx * rx + ry * ry;
  let t = 0;
  const disc = b * b - 4 * a * c;
  if (a !== 0 && disc >= 0) {
    const sq = Math.sqrt(disc);
    const t1 = (-b - sq) / (2 * a);
    const t2 = (-b + sq) / (2 * a);
    t = Math.min(...[t1, t2].filter((v) => v > 0), Infinity);
    if (!Number.isFinite(t)) t = 0;
  }
  const dx = rx + vx * t;
  const dy = ry + vy * t;
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}

export interface Bullets {
  readonly list: Bullet[];
  fire(owner: string, from: Vec, target: Asteroid): Bullet | null;
  remove(b: Bullet): void;
  step(dtS: number): void;
}

export function createBullets(): Bullets {
  const list: Bullet[] = [];
  const pool = new Pool<Bullet>(
    () => ({ owner: '', pos: { x: 0, y: 0 }, prev: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, ttlS: 0 }),
    () => undefined,
    BULLETS_MAX,
  );
  const remove = (b: Bullet): void => {
    const i = list.indexOf(b);
    if (i === -1) return;
    list.splice(i, 1);
    pool.release(b);
  };
  return {
    list,
    fire(owner, from, target) {
      if (list.length >= BULLETS_MAX) return null;
      const dir = leadDirection(from, target);
      const b = pool.acquire();
      b.owner = owner;
      b.pos.x = b.prev.x = from.x;
      b.pos.y = b.prev.y = from.y;
      b.vel.x = dir.x * BULLET_SPEED;
      b.vel.y = dir.y * BULLET_SPEED;
      b.ttlS = BULLET_LIFE_S;
      list.push(b);
      return b;
    },
    remove,
    step(dtS) {
      for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i] as Bullet;
        b.prev.x = b.pos.x;
        b.prev.y = b.pos.y;
        b.pos.x += b.vel.x * dtS;
        b.pos.y += b.vel.y * dtS;
        b.ttlS -= dtS;
        if (b.ttlS <= 0) remove(b);
      }
    },
  };
}

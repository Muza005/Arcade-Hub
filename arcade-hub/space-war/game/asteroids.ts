// Астероиды (SPACE_WAR_SPEC §5 «Астероиды»): рождаются за краем поля, дрейфуют насквозь и уходят;
// крупный раскалывается на два средних, средний — на два мелких, мелкий рассыпается безвредными осколками.
import { Pool } from '../../engine/pool';
import type { Rng } from '../../engine/rng';
import {
  ASTEROID_AIM_INSET,
  ASTEROID_HP,
  ASTEROID_RADIUS,
  ASTEROID_SHAPE_VARIANTS,
  ASTEROID_SIZE_WEIGHTS,
  ASTEROID_SPAWN_GAP,
  ASTEROID_SPEED,
  ASTEROID_SPIN,
  ASTEROIDS_MAX,
  CURRENT_SPREAD_RAD,
  SPLIT_COUNT,
  SPLIT_SPEED_K,
  SPLIT_SPREAD_RAD,
  type AsteroidSize,
} from '../config';
import type { Bounds, Vec } from './ship';

export interface Asteroid {
  id: number;
  size: AsteroidSize;
  pos: Vec;
  prev: Vec;
  vel: Vec;
  radius: number;
  hp: number;
  maxHp: number;
  /** Вариант процедурной формы. */
  shape: number;
  angle: number;
  spin: number;
  /** Камень Роя: пули его не берут, при ударе о корабль он не разбивается. */
  immortal: boolean;
  /** Ведёт босс: не удаляется за краем, пока его держат. */
  held: boolean;
  /** Броня Крепости: неуязвима, но автонаведение в неё целится — патроны уходят в броню. */
  armor: boolean;
  /** Осложнение «Бомбы»: вместо камня — бомба (взрывается от удара, выстрела и другой бомбы). */
  bomb: boolean;
  /** Осложнение «Призрак»: сколько ещё камень виден после попадания, с. */
  seenS: number;
  /** Камень саботажника: кто бросил (контур в его цвет); обычный — null. */
  owner: string | null;
}

const SIZES: readonly AsteroidSize[] = ['small', 'medium', 'large'];
const SMALLER: Record<AsteroidSize, AsteroidSize | null> = { large: 'medium', medium: 'small', small: null };

function hpFor(size: AsteroidSize, rng: Rng): number {
  const hp = ASTEROID_HP[size];
  if (typeof hp === 'number') return hp;
  // Диапазон [min, max] включительно.
  return hp[0] + Math.floor(rng.next() * (hp[1] - hp[0] + 1));
}

function pickSize(rng: Rng): AsteroidSize {
  let roll = rng.next();
  for (const size of SIZES) {
    roll -= ASTEROID_SIZE_WEIGHTS[size];
    if (roll < 0) return size;
  }
  return 'large';
}

export interface Field {
  readonly list: Asteroid[];
  /** Новый камень с края поля: размер — случайный или заданный, скорость — × speedK. */
  spawn(options?: SpawnOptions): Asteroid | null;
  /** Раскол: дети встают на место родителя. Возвращает детей (у мелкого — пусто). */
  split(a: Asteroid): Asteroid[];
  remove(a: Asteroid): void;
  /** Камень в заданной точке с заданной скоростью (выброс босса, откол, Рой). */
  launch(size: AsteroidSize, x: number, y: number, vx: number, vy: number): Asteroid | null;
  /** Дрейф и уход за границу. */
  step(dtS: number): void;
  /** Воронка: камни, летящие к точке, ускоряются к ней; пролетевшие — уходят. */
  attract(x: number, y: number, accel: number, dtS: number): void;
}

export interface SpawnOptions {
  size?: AsteroidSize;
  speedK?: number;
  /** Течение: камень входит с наветренного края и идёт по течению (единичный вектор по оси). */
  dir?: { x: number; y: number };
}

export function createAsteroidField(rng: Rng, bounds: Bounds): Field {
  const list: Asteroid[] = [];
  let nextId = 1;
  const pool = new Pool<Asteroid>(
    () => ({
      id: 0,
      size: 'small',
      pos: { x: 0, y: 0 },
      prev: { x: 0, y: 0 },
      vel: { x: 0, y: 0 },
      radius: 0,
      hp: 0,
      maxHp: 0,
      shape: 0,
      angle: 0,
      spin: 0,
      immortal: false,
      held: false,
      armor: false,
      bomb: false,
      seenS: 0,
      owner: null,
    }),
    () => undefined,
    ASTEROIDS_MAX,
  );

  const make = (size: AsteroidSize, x: number, y: number, vx: number, vy: number): Asteroid | null => {
    if (list.length >= ASTEROIDS_MAX) return null;
    const a = pool.acquire();
    const hp = hpFor(size, rng);
    a.id = nextId++;
    a.size = size;
    a.pos.x = a.prev.x = x;
    a.pos.y = a.prev.y = y;
    a.vel.x = vx;
    a.vel.y = vy;
    a.radius = ASTEROID_RADIUS[size];
    a.hp = a.maxHp = hp;
    a.shape = Math.floor(rng.next() * ASTEROID_SHAPE_VARIANTS);
    a.angle = rng.range(0, Math.PI * 2);
    a.spin = rng.range(-ASTEROID_SPIN, ASTEROID_SPIN);
    a.immortal = false;
    a.held = false;
    a.armor = false;
    a.bomb = false;
    a.seenS = 0;
    a.owner = null;
    list.push(a);
    return a;
  };

  const w = bounds.right - bounds.left;
  const h = bounds.bottom - bounds.top;

  const remove = (a: Asteroid): void => {
    const i = list.indexOf(a);
    if (i === -1) return;
    list.splice(i, 1);
    pool.release(a);
  };

  return {
    list,
    spawn(options = {}) {
      // Бросок размера — всегда: заданный размер не сдвигает остальную случайность.
      const rolled = pickSize(rng);
      const size = options.size ?? rolled;
      const r = ASTEROID_RADIUS[size];
      const out = r + ASTEROID_SPAWN_GAP;
      // Сторона — пропорционально её длине: на широком экране чаще слева и справа не будет.
      let t = rng.next() * (w + h) * 2;
      let x: number;
      let y: number;
      if (t < w) {
        x = bounds.left + t;
        y = bounds.top - out;
      } else if ((t -= w) < w) {
        x = bounds.left + t;
        y = bounds.bottom + out;
      } else if ((t -= w) < h) {
        x = bounds.left - out;
        y = bounds.top + t;
      } else {
        t -= h;
        x = bounds.right + out;
        y = bounds.top + t;
      }
      // Течение: с наветренного края, почти параллельно течению.
      if (options.dir && (options.dir.x !== 0 || options.dir.y !== 0)) {
        const { x: dx, y: dy } = options.dir;
        const along = rng.next();
        const sx = dx !== 0 ? (dx > 0 ? bounds.left - out : bounds.right + out) : bounds.left + along * w;
        const sy = dy !== 0 ? (dy > 0 ? bounds.top - out : bounds.bottom + out) : bounds.top + along * h;
        const [min, max] = ASTEROID_SPEED[size];
        const v = rng.range(min, max) * (options.speedK ?? 1);
        const a = Math.atan2(dy, dx) + rng.range(-CURRENT_SPREAD_RAD, CURRENT_SPREAD_RAD);
        return make(size, sx, sy, Math.cos(a) * v, Math.sin(a) * v);
      }
      // Летит в случайную точку середины поля.
      const tx = rng.range(bounds.left + w * ASTEROID_AIM_INSET, bounds.right - w * ASTEROID_AIM_INSET);
      const ty = rng.range(bounds.top + h * ASTEROID_AIM_INSET, bounds.bottom - h * ASTEROID_AIM_INSET);
      const [min, max] = ASTEROID_SPEED[size];
      const speed = rng.range(min, max) * (options.speedK ?? 1);
      const d = Math.hypot(tx - x, ty - y) || 1;
      return make(size, x, y, ((tx - x) / d) * speed, ((ty - y) / d) * speed);
    },
    split(a) {
      const child = SMALLER[a.size];
      const x = a.pos.x;
      const y = a.pos.y;
      const base = Math.atan2(a.vel.y, a.vel.x);
      const speed = Math.hypot(a.vel.x, a.vel.y) * SPLIT_SPEED_K;
      remove(a);
      if (!child) return [];
      const kids: Asteroid[] = [];
      for (let i = 0; i < SPLIT_COUNT; i++) {
        // Веером вокруг направления родителя.
        const angle = base + SPLIT_SPREAD_RAD * (i - (SPLIT_COUNT - 1) / 2) * 2;
        const kid = make(child, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed);
        if (kid) kids.push(kid);
      }
      return kids;
    },
    remove,
    launch: make,
    step(dtS) {
      for (let i = list.length - 1; i >= 0; i--) {
        const a = list[i] as Asteroid;
        a.prev.x = a.pos.x;
        a.prev.y = a.pos.y;
        a.pos.x += a.vel.x * dtS;
        a.pos.y += a.vel.y * dtS;
        a.angle += a.spin * dtS;
        if (a.held) continue;
        // Ушёл за границу и удаляется от поля — больше не вернётся.
        const out = a.radius + ASTEROID_SPAWN_GAP * 2;
        const gone =
          (a.pos.x < bounds.left - out && a.vel.x <= 0) ||
          (a.pos.x > bounds.right + out && a.vel.x >= 0) ||
          (a.pos.y < bounds.top - out && a.vel.y <= 0) ||
          (a.pos.y > bounds.bottom + out && a.vel.y >= 0);
        if (gone) remove(a);
      }
    },
    attract(x, y, accel, dtS) {
      for (const a of list) {
        const dx = x - a.pos.x;
        const dy = y - a.pos.y;
        const d = Math.hypot(dx, dy);
        if (d === 0 || a.vel.x * dx + a.vel.y * dy <= 0) continue;
        a.vel.x += (dx / d) * accel * dtS;
        a.vel.y += (dy / d) * accel * dtS;
      }
    },
  };
}

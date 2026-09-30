// Боссы (SPACE_WAR_SPEC §5 «Боссы»): Сеятель (5), Рой (10), Гигант (15), Воронка (20).
// Цель — с прочностью, волна идёт, пока она жива; испытание — без прочности, ровно своё время.
// Модуль двигает босса и его камни; удары, очки и события — в симуляции.
import type { Rng } from '../../engine/rng';
import {
  ASTEROID_RADIUS,
  ASTEROID_SPEED,
  BOSS_BASE_HP,
  BOSS_ENTRY_SPEED,
  BOSS_HP_PLAYER_K,
  BOSS_ROAM_INSET,
  BOSS_ROAM_S,
  BOSS_STEER,
  FLOW_PLAYER_K,
  GIANT_CHUNK,
  GIANT_CHUNK_SPREAD_RAD,
  GIANT_RADIUS,
  GIANT_SPEED,
  GIANT_SPIN,
  SEEDER_EMIT_PER_S,
  SEEDER_MEDIUM_CHANCE,
  SEEDER_RADIUS,
  SEEDER_SPEED,
  SEEDER_SPIN,
  SWARM_GAP,
  SWARM_OUTSIDE,
  SWARM_PER_WALL,
  SWARM_PLAYER_K,
  SWARM_ROCKS,
  SWARM_SPEED_MAX,
  SWARM_STIFFNESS,
  SWARM_WALL_SPACING,
  SWARM_WALL_SPEED,
  SWARM_REFORM_S,
  VORTEX_BOSS_K,
  VORTEX_CORE_RADIUS,
  VORTEX_PLAYER_K,
  VORTEX_ROCK_PULL,
  VORTEX_SHIP_PULL,
  VORTEX_SPIN,
  type BossKind,
} from '../config';
import type { Asteroid, Field } from './asteroids';
import type { Bounds, Vec } from './ship';

export interface Boss {
  readonly kind: BossKind;
  pos: Vec;
  prev: Vec;
  vel: Vec;
  /** Тело, о которое бьются корабли; у Роя тела нет (0). */
  radius: number;
  /** Цель: прочность есть; испытание: maxHp = 0. */
  hp: number;
  maxHp: number;
  angle: number;
  /** Тяга к центру: корабли и камни (px/с²); 0 — не тянет. */
  shipPull: number;
  rockPull: number;
  /** Сколько раз по боссу попали — для вида повреждений. */
  hits: number;
}

export interface BossControl {
  readonly boss: Boss;
  readonly target: boolean;
  step(dtS: number): void;
  /** Пуля попала в цель: минус прочность; у Гиганта откалывается кусок. true — босс убит. */
  hit(at: Vec): boolean;
  /** Волна кончилась: камни Роя отпускаются и улетают. */
  release(): void;
}

export const bossHp = (kind: 'seeder' | 'giant', players: number): number =>
  Math.round(BOSS_BASE_HP[kind] * (1 + BOSS_HP_PLAYER_K * (players - 1)));

export function createBoss(kind: BossKind, rng: Rng, field: Field, bounds: Bounds, players: number, speedK: number): BossControl {
  const cx = (bounds.left + bounds.right) / 2;
  const cy = (bounds.top + bounds.bottom) / 2;
  const w = bounds.right - bounds.left;
  const h = bounds.bottom - bounds.top;
  const boss: Boss = {
    kind,
    pos: { x: cx, y: cy },
    prev: { x: cx, y: cy },
    vel: { x: 0, y: 0 },
    radius: 0,
    hp: 0,
    maxHp: 0,
    angle: 0,
    shipPull: 0,
    rockPull: 0,
    hits: 0,
  };
  const noop = (): void => undefined;

  if (kind === 'vortex') {
    // Неуязвимое ядро в центре; тяга растёт с числом игроков.
    const k = VORTEX_BOSS_K * (1 + VORTEX_PLAYER_K * (players - 1));
    boss.radius = VORTEX_CORE_RADIUS;
    boss.shipPull = VORTEX_SHIP_PULL * k;
    boss.rockPull = VORTEX_ROCK_PULL * k;
    return {
      boss,
      target: false,
      step(dtS) {
        boss.angle += VORTEX_SPIN * dtS;
      },
      hit: () => false,
      release: noop,
    };
  }

  if (kind === 'swarm') return createSwarm(boss, rng, field, bounds, players);

  // Цели: вплывают из-за верхнего края и бродят по середине поля.
  const seeder = kind === 'seeder';
  boss.radius = seeder ? SEEDER_RADIUS : GIANT_RADIUS;
  boss.hp = boss.maxHp = bossHp(kind, players);
  boss.pos.y = boss.prev.y = bounds.top - boss.radius;
  boss.vel.y = BOSS_ENTRY_SPEED;
  const speed = seeder ? SEEDER_SPEED : GIANT_SPEED;
  const spin = seeder ? SEEDER_SPIN : GIANT_SPIN;
  let entering = true;
  let roamS = 0;
  let way: Vec = { x: cx, y: cy };
  const emitPerS = SEEDER_EMIT_PER_S * (1 + FLOW_PLAYER_K * (players - 1));
  let emitDebt = 0;

  /** Камень от края босса наружу: направление — угол от центра. */
  const throwRock = (size: Asteroid['size'], angle: number): void => {
    const [min, max] = ASTEROID_SPEED[size];
    const v = rng.range(min, max) * speedK;
    const r = boss.radius + ASTEROID_RADIUS[size];
    field.launch(size, boss.pos.x + Math.cos(angle) * r, boss.pos.y + Math.sin(angle) * r, Math.cos(angle) * v, Math.sin(angle) * v);
  };

  return {
    boss,
    target: true,
    step(dtS) {
      boss.prev.x = boss.pos.x;
      boss.prev.y = boss.pos.y;
      boss.angle += spin * dtS;
      if (entering) {
        if (boss.pos.y >= bounds.top + h * BOSS_ROAM_INSET) entering = false;
      } else {
        roamS -= dtS;
        if (roamS <= 0) {
          roamS = BOSS_ROAM_S;
          way = {
            x: rng.range(bounds.left + w * BOSS_ROAM_INSET, bounds.right - w * BOSS_ROAM_INSET),
            y: rng.range(bounds.top + h * BOSS_ROAM_INSET, bounds.bottom - h * BOSS_ROAM_INSET),
          };
        }
        const dx = way.x - boss.pos.x;
        const dy = way.y - boss.pos.y;
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, BOSS_STEER * dtS);
        boss.vel.x += ((dx / d) * speed * Math.min(1, d / speed) - boss.vel.x) * k;
        boss.vel.y += ((dy / d) * speed * Math.min(1, d / speed) - boss.vel.y) * k;
      }
      boss.pos.x += boss.vel.x * dtS;
      boss.pos.y += boss.vel.y * dtS;
      if (!seeder) return;
      emitDebt += emitPerS * dtS;
      while (emitDebt >= 1) {
        emitDebt--;
        throwRock(rng.next() < SEEDER_MEDIUM_CHANCE ? 'medium' : 'small', rng.range(0, Math.PI * 2));
      }
    },
    hit(at) {
      boss.hits++;
      boss.hp = Math.max(0, boss.hp - 1);
      // Гигант: живой кусок откалывается от места попадания наружу.
      if (!seeder && boss.hp > 0) {
        const base = Math.atan2(at.y - boss.pos.y, at.x - boss.pos.x);
        throwRock(GIANT_CHUNK, base + rng.range(-GIANT_CHUNK_SPREAD_RAD, GIANT_CHUNK_SPREAD_RAD));
      }
      return boss.hp <= 0;
    },
    release: noop,
  };
}

/** Рой: стены камней проходят поле насквозь с проходом в каждой; после прохода — перестраиваются. */
function createSwarm(boss: Boss, rng: Rng, field: Field, bounds: Bounds, players: number): BossControl {
  const count = Math.round(SWARM_ROCKS * (1 + SWARM_PLAYER_K * (players - 1)));
  const walls = Math.max(1, Math.ceil(count / SWARM_PER_WALL));
  const rocks: Asteroid[] = [];
  /** Стена i-го камня и его место в ней. */
  const slots: Array<{ wall: number; j: number; n: number }> = [];
  for (let i = 0; i < count; i++) {
    const wall = i % walls;
    const n = Math.floor(count / walls) + (wall < count % walls ? 1 : 0);
    slots.push({ wall, j: Math.floor(i / walls), n });
  }

  // Проход: ось (x — стена вертикальная, идёт вдоль x), направление, место прохода у каждой стены.
  let axis: 'x' | 'y' = rng.next() < 0.5 ? 'x' : 'y';
  let dir = rng.next() < 0.5 ? 1 : -1;
  let gaps: number[] = [];
  let sweepS = 0;
  const span = (a: 'x' | 'y'): [number, number] => (a === 'x' ? [bounds.left, bounds.right] : [bounds.top, bounds.bottom]);
  const pathLen = (): number => {
    const [lo, hi] = span(axis);
    return hi - lo + SWARM_OUTSIDE * 2 + (walls - 1) * SWARM_WALL_SPACING;
  };
  const newSweep = (): void => {
    const [lo, hi] = span(axis === 'x' ? 'y' : 'x');
    gaps = Array.from({ length: walls }, () => rng.range(lo, hi - SWARM_GAP));
    sweepS = -SWARM_REFORM_S;
  };
  newSweep();

  /** Где сейчас место камня. Стены идут друг за другом; до старта (сбор) стоят за краем. */
  const slotPos = (i: number): Vec => {
    const s = slots[i] as (typeof slots)[number];
    const [lo, hi] = span(axis);
    const progress = Math.max(0, sweepS) * SWARM_WALL_SPEED;
    const start = dir > 0 ? lo - SWARM_OUTSIDE : hi + SWARM_OUTSIDE;
    const along = start + dir * (progress - s.wall * SWARM_WALL_SPACING);
    const [alo, ahi] = span(axis === 'x' ? 'y' : 'x');
    const usable = ahi - alo - SWARM_GAP;
    let across = alo + ((s.j + 0.5) * usable) / s.n;
    const gap = gaps[s.wall] ?? alo;
    if (across > gap) across += SWARM_GAP;
    return axis === 'x' ? { x: along, y: across } : { x: across, y: along };
  };

  for (let i = 0; i < count; i++) {
    const p = slotPos(i);
    const rock = field.launch('small', p.x, p.y, 0, 0);
    if (!rock) continue;
    rock.immortal = true;
    rock.held = true;
    rocks[i] = rock;
  }

  return {
    boss,
    target: false,
    step(dtS) {
      sweepS += dtS;
      if (sweepS * SWARM_WALL_SPEED >= pathLen()) {
        // Перестройка: та же ось — обратно; другая — камни идут к новому краю.
        const nextAxis = rng.next() < 0.5 ? 'x' : 'y';
        dir = nextAxis === axis ? -dir : rng.next() < 0.5 ? 1 : -1;
        axis = nextAxis;
        newSweep();
      }
      rocks.forEach((rock, i) => {
        if (!rock?.held) return;
        const p = slotPos(i);
        let vx = (p.x - rock.pos.x) * SWARM_STIFFNESS;
        let vy = (p.y - rock.pos.y) * SWARM_STIFFNESS;
        const v = Math.hypot(vx, vy);
        if (v > SWARM_SPEED_MAX) {
          vx = (vx / v) * SWARM_SPEED_MAX;
          vy = (vy / v) * SWARM_SPEED_MAX;
        }
        rock.vel.x = vx;
        rock.vel.y = vy;
      });
    },
    hit: () => false,
    release() {
      // Отпущенные камни летят дальше своим ходом и уходят за край.
      for (const rock of rocks) {
        if (!rock) continue;
        rock.held = false;
        const v = Math.hypot(rock.vel.x, rock.vel.y);
        if (v < SWARM_WALL_SPEED) {
          const ax = axis === 'x' ? dir : 0;
          const ay = axis === 'y' ? dir : 0;
          rock.vel.x = ax * SWARM_WALL_SPEED;
          rock.vel.y = ay * SWARM_WALL_SPEED;
        }
      }
    },
  };
}

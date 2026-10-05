// Боссы (SPACE_WAR_SPEC §5 «Боссы»): Сеятель (4), Охотник (8), Рой (11), Крепость (14), Гигант (17), Воронка (20).
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
  FORTRESS_BREAK_SPEED,
  FORTRESS_CORE_RADIUS,
  FORTRESS_FORM_S,
  FORTRESS_RINGS,
  FORTRESS_ROCK,
  FORTRESS_SPIN_PLAYER_K,
  HUNTER_PUSH,
  HUNTER_PUSH_RADIUS,
  HUNTER_RADIUS,
  HUNTER_SHOT_RANGE,
  HUNTER_SHOT_S,
  HUNTER_SHOT_SPEED,
  HUNTER_SPEED,
  HUNTER_STEER,
  HUNTER_SWITCH_K,
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
  SWARM_GAP_INSET,
  SWARM_OUTSIDE,
  SWARM_PAIR_CHANCE,
  SWARM_PLAYER_K,
  SWARM_SPACING,
  SWARM_WALL_EVERY_S,
  SWARM_WALL_SPEED,
  SWARM_WALLS,
  SWARM_WARN_S,
  VORTEX_BOSS_K,
  VORTEX_CORE_RADIUS,
  VORTEX_PLAYER_K,
  VORTEX_ROCK_PULL,
  VORTEX_SHIP_PULL,
  VORTEX_SPIN,
  type BossKind,
  type TargetBossKind,
} from '../config';
import type { Asteroid, Field } from './asteroids';
import { leadDirection } from './bullets';
import type { Bounds, Vec } from './ship';

/** Кольцо Крепости для рисунка: текущий радиус, поворот, места и где разрывы. */
export interface FortressRing {
  radius: number;
  angle: number;
  slots: number;
  /** Пустые места кольца (разрывы). */
  empty: readonly number[];
}

/** Стена Роя для рисунка: ось движения, направление, где линия, проход и ширина поля поперёк. */
export interface SwarmWall {
  axis: 'x' | 'y';
  dir: 1 | -1;
  along: number;
  gap: number;
  gapSize: number;
  lo: number;
  hi: number;
  /** Ещё ждёт за краем (мигает предупреждение). */
  warnS: number;
}

/** Корабль, за которым может гнаться Охотник. */
export interface Prey {
  id: string;
  pos: Vec;
  vel: Vec;
  /** Неуязвимого (только что ударенного) Охотник не преследует. */
  invulnerable: boolean;
}

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
  /** Охотник: за кем гонится (рисунок красится в его цвет); у других — null. */
  prey: string | null;
  /** Крепость: кольца брони; у других — пусто. */
  rings: FortressRing[];
  /** Рой: стены на поле и у края; у других — пусто. */
  walls: SwarmWall[];
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

export const bossHp = (kind: TargetBossKind, players: number): number =>
  Math.round(BOSS_BASE_HP[kind] * (1 + BOSS_HP_PLAYER_K * (players - 1)));

const NO_PREY = (): readonly Prey[] => [];

export function createBoss(
  kind: BossKind,
  rng: Rng,
  field: Field,
  bounds: Bounds,
  players: number,
  speedK: number,
  prey: () => readonly Prey[] = NO_PREY,
): BossControl {
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
    prey: null,
    rings: [],
    walls: [],
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
  if (kind === 'hunter') return createHunter(boss, field, bounds, players, speedK, prey);
  if (kind === 'fortress') return createFortress(boss, rng, field, bounds, players);

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

/** Рой: 10 стен камней с проходом, по очереди с разных сторон; иногда пара сразу с противоположных сторон
 *  (проходы на одной линии — стоя в проходе, пропускаешь обе). Перед выходом стена мигает у края. */
function createSwarm(boss: Boss, rng: Rng, field: Field, bounds: Bounds, players: number): BossControl {
  const speed = SWARM_WALL_SPEED * (1 + SWARM_PLAYER_K * (players - 1));
  type Dir = { axis: 'x' | 'y'; dir: 1 | -1 };
  const DIRS: readonly Dir[] = [
    { axis: 'y', dir: -1 }, // снизу вверх
    { axis: 'x', dir: 1 }, // слева направо
    { axis: 'x', dir: -1 }, // справа налево
    { axis: 'y', dir: 1 }, // сверху вниз
  ];
  const span = (a: 'x' | 'y'): [number, number] => (a === 'x' ? [bounds.left, bounds.right] : [bounds.top, bounds.bottom]);
  const across = (a: 'x' | 'y'): 'x' | 'y' => (a === 'x' ? 'y' : 'x');

  // Расписание: первые три — как у заказчика (снизу, слева, справа), дальше — случайно, не два одинаковых подряд.
  const plan: Array<{ atS: number; dir: Dir; pair: boolean }> = [];
  let walls = 0;
  let last: Dir | null = null;
  for (let k = 0; walls < SWARM_WALLS; k++) {
    const dir: Dir = k < 3 ? (DIRS[k] as Dir) : rng.pick(DIRS.filter((d) => d !== last));
    const pair = k >= 3 && walls + 2 <= SWARM_WALLS && rng.next() < SWARM_PAIR_CHANCE;
    plan.push({ atS: k * SWARM_WALL_EVERY_S, dir, pair });
    walls += pair ? 2 : 1;
    last = dir;
  }

  interface Wall extends SwarmWall {
    rocks: Asteroid[];
  }
  const live: Wall[] = [];
  let timeS = 0;
  let next = 0;

  const launch = (d: Dir, gap: number): void => {
    const [lo, hi] = span(d.axis);
    const [alo, ahi] = span(across(d.axis));
    const along = d.dir > 0 ? lo - SWARM_OUTSIDE : hi + SWARM_OUTSIDE;
    const wall: Wall = { axis: d.axis, dir: d.dir, along, gap, gapSize: SWARM_GAP, lo: alo, hi: ahi, warnS: SWARM_WARN_S, rocks: [] };
    for (let c = alo + SWARM_SPACING / 2; c < ahi; c += SWARM_SPACING) {
      if (c > gap - SWARM_SPACING / 2 && c < gap + SWARM_GAP + SWARM_SPACING / 2) continue;
      const x = d.axis === 'x' ? along : c;
      const y = d.axis === 'x' ? c : along;
      const rock = field.launch('small', x, y, 0, 0);
      if (!rock) continue;
      rock.immortal = true;
      rock.held = true;
      wall.rocks.push(rock);
    }
    live.push(wall);
  };

  const sync = (): void => {
    boss.walls = live.map((w) => ({ axis: w.axis, dir: w.dir, along: w.along, gap: w.gap, gapSize: w.gapSize, lo: w.lo, hi: w.hi, warnS: w.warnS }));
  };

  return {
    boss,
    target: false,
    step(dtS) {
      timeS += dtS;
      while (next < plan.length && timeS >= (plan[next] as (typeof plan)[number]).atS) {
        const g = plan[next] as (typeof plan)[number];
        next++;
        const [alo, ahi] = span(across(g.dir.axis));
        const gap = rng.range(alo + SWARM_GAP_INSET, ahi - SWARM_GAP_INSET - SWARM_GAP);
        launch(g.dir, gap);
        if (g.pair) launch({ axis: g.dir.axis, dir: g.dir.dir > 0 ? -1 : 1 }, gap);
      }
      for (let i = live.length - 1; i >= 0; i--) {
        const w = live[i] as Wall;
        if (w.warnS > 0) w.warnS = Math.max(0, w.warnS - dtS);
        else w.along += w.dir * speed * dtS;
        const [lo, hi] = span(w.axis);
        const gone = w.dir > 0 ? w.along > hi + SWARM_OUTSIDE : w.along < lo - SWARM_OUTSIDE;
        if (gone) {
          for (const r of w.rocks) field.remove(r);
          live.splice(i, 1);
          continue;
        }
        // Камни — точно на линию стены к концу шага (сдвиг делает field.step).
        for (const r of w.rocks) {
          if (!r.held) continue;
          const tx = w.axis === 'x' ? w.along : r.pos.x;
          const ty = w.axis === 'x' ? r.pos.y : w.along;
          r.vel.x = (tx - r.pos.x) / dtS;
          r.vel.y = (ty - r.pos.y) / dtS;
        }
      }
      sync();
    },
    hit: () => false,
    release() {
      // Конец испытания: идущие стены уходят своим ходом, ещё не вышедшие — исчезают.
      for (const w of live) {
        for (const r of w.rocks) {
          if (w.warnS > 0) {
            field.remove(r);
            continue;
          }
          r.held = false;
          r.vel.x = w.axis === 'x' ? w.dir * speed : 0;
          r.vel.y = w.axis === 'y' ? w.dir * speed : 0;
        }
      }
      live.length = 0;
      sync();
    },
  };
}

/** Цель вплывает из-за верхнего края с полной прочностью. */
function enter(boss: Boss, bounds: Bounds): void {
  boss.pos.y = boss.prev.y = bounds.top - boss.radius;
  boss.vel.y = BOSS_ENTRY_SPEED;
  boss.hp = boss.maxHp;
}

/** Охотник: гонится за ближайшим, расталкивает камни, бросает мелкие камни в жертву. */
function createHunter(
  boss: Boss,
  field: Field,
  bounds: Bounds,
  players: number,
  speedK: number,
  prey: () => readonly Prey[],
): BossControl {
  boss.radius = HUNTER_RADIUS;
  boss.maxHp = bossHp('hunter', players);
  enter(boss, bounds);
  const shotEveryS = HUNTER_SHOT_S / (1 + FLOW_PLAYER_K * (players - 1));
  let shotS = shotEveryS;
  let entering = true;

  /** Ближайший; нынешняя жертва держится, пока другой не ближе заметно. */
  const choose = (): Prey | null => {
    const all = prey();
    const open = all.filter((p) => !p.invulnerable);
    const pool = open.length > 0 ? open : all;
    let best: Prey | null = null;
    let bestD = Infinity;
    let current: Prey | null = null;
    let currentD = Infinity;
    for (const p of pool) {
      const d = Math.hypot(p.pos.x - boss.pos.x, p.pos.y - boss.pos.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
      if (p.id === boss.prey) {
        current = p;
        currentD = d;
      }
    }
    if (current && bestD > currentD * HUNTER_SWITCH_K) return current;
    return best;
  };

  return {
    boss,
    target: true,
    step(dtS) {
      boss.prev.x = boss.pos.x;
      boss.prev.y = boss.pos.y;
      if (entering && boss.pos.y >= bounds.top + boss.radius) entering = false;
      const victim = entering ? null : choose();
      boss.prey = victim?.id ?? boss.prey;
      if (victim) {
        // Небольшая инерция: скорость догоняет желаемую не сразу — резкий манёвр уводит.
        const dx = victim.pos.x - boss.pos.x;
        const dy = victim.pos.y - boss.pos.y;
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, HUNTER_STEER * dtS);
        boss.vel.x += ((dx / d) * HUNTER_SPEED - boss.vel.x) * k;
        boss.vel.y += ((dy / d) * HUNTER_SPEED - boss.vel.y) * k;
        boss.angle = Math.atan2(boss.vel.y, boss.vel.x);
        // Бросок мелкого камня в жертву — с упреждением.
        shotS -= dtS;
        if (shotS <= 0 && d < HUNTER_SHOT_RANGE) {
          shotS = shotEveryS;
          const from = { x: boss.pos.x + (dx / d) * boss.radius, y: boss.pos.y + (dy / d) * boss.radius };
          const dir = leadDirection(from, victim);
          const v = HUNTER_SHOT_SPEED * speedK;
          const r = ASTEROID_RADIUS.small;
          field.launch('small', from.x + dir.x * r, from.y + dir.y * r, dir.x * v, dir.y * v);
        }
      }
      boss.pos.x += boss.vel.x * dtS;
      boss.pos.y += boss.vel.y * dtS;
      if (!entering) {
        boss.pos.x = Math.min(bounds.right - boss.radius, Math.max(bounds.left + boss.radius, boss.pos.x));
        boss.pos.y = Math.min(bounds.bottom - boss.radius, Math.max(bounds.top + boss.radius, boss.pos.y));
      }
      // Камни перед собой расталкивает.
      for (const a of field.list) {
        if (a.held) continue;
        const ax = a.pos.x - boss.pos.x;
        const ay = a.pos.y - boss.pos.y;
        const d = Math.hypot(ax, ay);
        if (d === 0 || d > HUNTER_PUSH_RADIUS + a.radius) continue;
        a.vel.x += (ax / d) * HUNTER_PUSH * dtS;
        a.vel.y += (ay / d) * HUNTER_PUSH * dtS;
      }
    },
    hit() {
      boss.hits++;
      boss.hp = Math.max(0, boss.hp - 1);
      return boss.hp <= 0;
    },
    release: () => undefined,
  };
}

/** Крепость: ядро в центре поля, два кольца брони навстречу друг другу с разрывами. */
function createFortress(boss: Boss, rng: Rng, field: Field, bounds: Bounds, players: number): BossControl {
  const cx = (bounds.left + bounds.right) / 2;
  const cy = (bounds.top + bounds.bottom) / 2;
  boss.radius = FORTRESS_CORE_RADIUS;
  boss.maxHp = bossHp('fortress', players);
  enter(boss, bounds);
  const spinK = 1 + FORTRESS_SPIN_PLAYER_K * (players - 1);
  let ageS = 0;
  let entering = true;
  const armor: Array<{ rock: Asteroid; ring: number; slot: number }> = [];
  FORTRESS_RINGS.forEach((def, ring) => {
    // Разрывы — равномерно по кругу, с поворотом из сида.
    const empty: number[] = [];
    const first = Math.floor(rng.next() * def.slots);
    for (let g = 0; g < def.gaps; g++) {
      const at = first + Math.round((g * def.slots) / def.gaps);
      for (let k = 0; k < def.gap; k++) empty.push((at + k) % def.slots);
    }
    boss.rings.push({ radius: 0, angle: rng.range(0, Math.PI * 2), slots: def.slots, empty });
    for (let slot = 0; slot < def.slots; slot++) {
      if (empty.includes(slot)) continue;
      const rock = field.launch(FORTRESS_ROCK, boss.pos.x, boss.pos.y, 0, 0);
      if (!rock) continue;
      rock.immortal = true;
      rock.held = true;
      rock.armor = true;
      armor.push({ rock, ring, slot });
    }
  });

  /** Куда камню к концу шага: кольцо разворачивается от ядра за FORTRESS_FORM_S. */
  const place = (dtS: number): void => {
    const form = Math.min(1, ageS / FORTRESS_FORM_S);
    const ease = 1 - (1 - form) ** 3;
    boss.rings.forEach((ring, i) => {
      const def = FORTRESS_RINGS[i];
      if (!def) return;
      ring.radius = def.radius * ease;
      ring.angle += def.spin * spinK * dtS;
    });
    for (const a of armor) {
      if (!a.rock.held) continue;
      const ring = boss.rings[a.ring];
      if (!ring) continue;
      const t = ring.angle + (a.slot / ring.slots) * Math.PI * 2;
      const x = boss.pos.x + Math.cos(t) * ring.radius;
      const y = boss.pos.y + Math.sin(t) * ring.radius;
      // Точно на место к концу шага (сам сдвиг делает field.step).
      a.rock.vel.x = (x - a.rock.pos.x) / dtS;
      a.rock.vel.y = (y - a.rock.pos.y) / dtS;
    }
  };

  const release = (): void => {
    // Броня разлетается обычными камнями — их можно добить.
    for (const { rock } of armor) {
      if (!rock.held) continue;
      rock.held = false;
      rock.immortal = false;
      rock.armor = false;
      const dx = rock.pos.x - boss.pos.x;
      const dy = rock.pos.y - boss.pos.y;
      const d = Math.hypot(dx, dy) || 1;
      rock.vel.x = (dx / d) * FORTRESS_BREAK_SPEED;
      rock.vel.y = (dy / d) * FORTRESS_BREAK_SPEED;
    }
  };

  return {
    boss,
    target: true,
    step(dtS) {
      ageS += dtS;
      boss.prev.x = boss.pos.x;
      boss.prev.y = boss.pos.y;
      boss.angle += dtS;
      if (entering) {
        boss.pos.y += boss.vel.y * dtS;
        if (boss.pos.y >= cy) {
          boss.pos.y = cy;
          boss.vel.y = 0;
          entering = false;
        }
      }
      boss.pos.x = cx;
      place(dtS);
    },
    hit() {
      boss.hits++;
      boss.hp = Math.max(0, boss.hp - 1);
      return boss.hp <= 0;
    },
    release,
  };
}

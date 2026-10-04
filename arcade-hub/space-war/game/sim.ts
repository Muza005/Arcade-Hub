// Симуляция Space War без графики: по сиду и потоку ввода матч воспроизводится один в один.
// Б1 — корабли; Б2 — астероиды, жизни, конец игры; Б3 — стрельба, патроны, множитель, очки; Б8 — волны; Б9 — боссы; Б10 — призрак и саботаж; Б11 — усиления.
import type { InputState } from '../../engine/input';
import { createRng } from '../../engine/rng';
import {
  ASTEROID_HITBOX_K,
  ROCK_BOUNCE_DEFAULT,
  ROCK_RESTITUTION,
  ASTEROID_RADIUS,
  AMMO_MAX,
  DOUBLE_DAMAGE,
  DOUBLE_OFFSET,
  DOUBLE_S,
  ASTEROID_SPAWN_PER_S,
  FREEZE_S,
  JAMMER_S,
  OVERLOAD_S,
  POWERUP_DROP_CHANCE,
  POWERUP_RATE_DEFAULT,
  POWERUP_RATES,
  POWERUP_RADIUS,
  SHIELD_S,
  SHIP_LIVES,
  type PowerupKind,
  BOSS_FLOW,
  BOSS_HITBOX_K,
  BULLET_RADIUS,
  COMPLICATION_FLOW,
  COMPLICATION_SPEED,
  DIFFICULTY_DEFAULT,
  DIFFICULTY_WAVE_SHIFT,
  FIELD_INSET,
  FLOW_PLAYER_K,
  GAME_OVER_DELAY_S,
  GHOST_S,
  GRID_CELL,
  HIT_INVULN_S,
  HIT_STOP_DEATH_S,
  HIT_STOP_S,
  NEAR_MISS_DISTANCE,
  SCORE_ASTEROID,
  SCORE_BOSS,
  SCORE_LIFE_LEFT,
  SCORE_WAVE,
  VORTEX_ROCK_PULL,
  VORTEX_SHIP_PULL,
  WAVE_DENSITY_GROWTH,
  WAVE_FINISH_DELAY_S,
  WAVE_GROWTH_MIN,
  WAVE_LIMIT,
  WAVE_SPEED_GROWTH,
  SHIP_BOUNCE,
  SHIP_PUSH_MIN,
  SHIP_HITBOX_RADIUS,
  SPAWN_RING_RADIUS,
  WORLD_H,
  type AsteroidSize,
  type BossKind,
  type Difficulty,
  type Mode,
} from '../config';
import { FEATURES } from '../features';
import { createAsteroidField, type Asteroid } from './asteroids';
import { createAfterlife, type AfterlifeEvents, type Bomb, type SabShot, type Shard } from './afterlife';
import { createBoss, type Boss, type BossControl } from './bosses';
import { createPowerups, type Powerup } from './powerups';
import { createBullets, type Bullet, type Mover } from './bullets';
import { Grid } from './grid';
import { checkIdle, createPilot, nearMiss, regenAmmo, resetMult, totalMult, type Pilot } from './pilot';
import { clampToBounds, createShip, stepShip, type Bounds, type Ship } from './ship';
import { createWaves, type WaveEvent, type Waves } from './waves';

export type { Pilot } from './pilot';

/** Что случилось на последнем шаге — для графики и обратной связи на телефоне. */
export interface SimEvents extends AfterlifeEvents {
  hits: string[];
  deaths: string[];
  breaks: Array<{ x: number; y: number; size: AsteroidSize }>;
  /** Попадание без раскола — искры и смена вида камня. */
  chips: Array<{ x: number; y: number }>;
  shots: string[];
  near: Array<{ id: string; x: number; y: number }>;
  /** У кого добавился патрон — вспышка на кнопке телефона. */
  reloads: string[];
  /** Корабли столкнулись: точка удара и был ли это таран (множитель сброшен обоим). */
  bumps: Array<{ a: string; b: string; x: number; y: number; ram: boolean }>;
  /** Волна началась или кончилась (в конце — бонус SCORE_WAVE × номер живым). */
  waves: WaveEvent[];
  /** Цель-босс убита: кем и где. */
  bossDown: Array<{ kind: BossKind; by: string; x: number; y: number }>;
  /** Подобранные усиления. */
  pickups: Array<{ id: string; kind: PowerupKind; x: number; y: number }>;
  /** Кого заглушили. */
  jammed: string[];
  /** Выпало усиление — вспышка и свечение на месте. */
  drops: Array<{ x: number; y: number; kind: PowerupKind }>;
  /** Кому Ремонт добавил жизнь — подрастает новое сердечко. */
  healed: string[];
}

export interface SimOptions {
  mode?: Mode;
  /** Настройка лобби «Столкновения кораблей»: выключены — корабли проходят насквозь. */
  collisions?: boolean;
  /** Команда игрока (в командном режиме — его цвет). */
  teamOf?: (id: string) => string;
  /** Стартовая сложность из лобби. */
  difficulty?: Difficulty;
  /** С какой волны начать (проверка поздних волн и боссов); по умолчанию — с первой. */
  startWave?: number;
  /** Время призрака из лобби, с. */
  ghostS?: number;
  /** Настройка лобби «Саботаж погибших». */
  sabotage?: boolean;
  /** Настройка лобби «Усиления». */
  powerups?: boolean;
  /** Настройка лобби «Частота усилений»: множитель шанса выпадения. */
  powerupRate?: number;
  /** Настройка лобби «Камни отскакивают друг от друга». */
  rockBounce?: boolean;
}

export interface Sim {
  readonly bounds: Bounds;
  readonly ships: readonly Ship[];
  readonly pilots: ReadonlyMap<string, Pilot>;
  readonly asteroids: readonly Asteroid[];
  readonly bullets: readonly Bullet[];
  readonly waves: Waves;
  /** Босс текущей волны или null. */
  readonly boss: Boss | null;
  /** Осколки погибших (кооператив, командное) и бомбы саботажников. */
  readonly shards: readonly Shard[];
  readonly bombs: readonly Bomb[];
  /** Усиления на поле. */
  readonly powerups: readonly Powerup[];
  /** Заморозка: сколько ещё камни стоят, с. */
  readonly freezeS: number;
  /** Выстрел саботажника; false — не саботажник или снаряд ещё не готов. */
  sabotage(id: string, shot: SabShot): boolean;
  /** Полный кулдаун снаряда сейчас (база + за погибших). */
  sabCooldownS(kind: SabShot['kind']): number;
  readonly events: SimEvents;
  readonly timeS: number;
  /** Все погибли или пройдена последняя волна — и пауза после этого прошла. */
  readonly over: boolean;
  /** Hit-stop: мир замер на мгновение после удара — шаг ничего не двигает. */
  readonly frozen: boolean;
  step(dtS: number, read: (id: string) => InputState): void;
  /** Итоговые очки: накопленные плюс SCORE_LIFE_LEFT за каждую оставшуюся жизнь. */
  finalScore(id: string): number;
}

export function fieldBounds(worldW: number, worldH: number = WORLD_H): Bounds {
  return { left: FIELD_INSET, top: FIELD_INSET, right: worldW - FIELD_INSET, bottom: worldH - FIELD_INSET };
}

const inside = (b: Bounds, p: { x: number; y: number }): boolean =>
  p.x > b.left && p.x < b.right && p.y > b.top && p.y < b.bottom;

/** worldH — высота мира с учётом отдаления камеры (worldZoom); без неё — WORLD_H. */
export function createSim(
  playerIds: readonly string[],
  worldW: number,
  seed: number,
  worldH: number = WORLD_H,
  options: SimOptions = {},
): Sim {
  const mode = options.mode ?? 'versus';
  const collisions = options.collisions ?? true;
  const teamOf = options.teamOf ?? ((id: string) => id);
  /** Пары кораблей, которые касаются сейчас: таран считается один раз за касание. */
  const touching = new Set<string>();
  const bounds = fieldBounds(worldW, worldH);
  const rng = createRng(seed);
  const cx = (bounds.left + bounds.right) / 2;
  const cy = (bounds.top + bounds.bottom) / 2;
  // Корабли стартуют по кругу носом наружу; один игрок — в центре носом вверх.
  const ships = playerIds.map((id, i) => {
    const a = (i / playerIds.length) * Math.PI * 2 - Math.PI / 2;
    const ring = playerIds.length === 1 ? 0 : SPAWN_RING_RADIUS;
    return createShip(id, { x: cx + Math.cos(a) * ring, y: cy + Math.sin(a) * ring }, a);
  });
  const pilots = new Map<string, Pilot>(ships.map((ship) => [ship.id, createPilot(ship)]));

  const field = createAsteroidField(rng, bounds);
  const bullets = createBullets();
  const grid = new Grid<Asteroid>(GRID_CELL, bounds.right + bounds.left, ASTEROID_RADIUS.large * 2);
  const near: Asteroid[] = [];
  const hits: Array<{ pilot: Pilot; rock: Asteroid }> = [];
  const claimed = new Set<Asteroid>();
  const killed: Array<{ rock: Asteroid; by: Pilot }> = [];
  const spent: Bullet[] = [];
  const events: SimEvents = {
    hits: [], deaths: [], breaks: [], chips: [], shots: [], near: [], reloads: [], bumps: [], waves: [], bossDown: [],
    ghosts: [], revives: [], saboteurs: [], blasts: [], sabShots: [], pickups: [], jammed: [], drops: [], healed: [],
  };
  const powerupsOn = (options.powerups ?? true) && FEATURES.powerups;
  const dropChance = POWERUP_DROP_CHANCE * (options.powerupRate ?? POWERUP_RATES[POWERUP_RATE_DEFAULT]);
  const powerups = createPowerups(rng, mode, bounds);
  let freezeS = 0;
  let bossCtl: BossControl | null = null;
  const spawnPerS = ASTEROID_SPAWN_PER_S * (1 + FLOW_PLAYER_K * (playerIds.length - 1));
  const waves = createWaves(seed, WAVE_LIMIT, options.startWave);
  const shift = DIFFICULTY_WAVE_SHIFT[options.difficulty ?? DIFFICULTY_DEFAULT];
  /** Рост с номером волны, сдвинутый стартовой сложностью. */
  const growth = (k: number): number => Math.max(WAVE_GROWTH_MIN, 1 + k * (waves.wave - 1 + shift));
  const afterlife = createAfterlife({
    pilots,
    bounds,
    field,
    rng,
    mode,
    teamOf,
    ghostS: options.ghostS ?? GHOST_S,
    sabotage: options.sabotage ?? true,
    events,
    speedK: () => growth(WAVE_SPEED_GROWTH),
  });
  let spawnDebt = 0;
  let timeS = 0;
  let overInS: number | null = null;
  let hitStopS = 0;

  const rebuildGrid = (): void => {
    grid.clear();
    for (const a of field.list) grid.insert(a);
  };

  /** Камни отскакивают друг от друга: упругий удар, масса ∝ площади. Камни Роя идут своим строем. */
  const rockBounce = options.rockBounce ?? ROCK_BOUNCE_DEFAULT;
  const bounceRocks = (): void => {
    rebuildGrid();
    for (const a of field.list) {
      if (a.held) continue;
      for (const b of grid.query(a.pos.x, a.pos.y, a.radius, near)) {
        if (b.id <= a.id || b.held) continue;
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const d = Math.hypot(dx, dy);
        const min = (a.radius + b.radius) * ASTEROID_HITBOX_K;
        if (d >= min) continue;
        const nx = d > 0 ? dx / d : 1;
        const ny = d > 0 ? dy / d : 0;
        const ma = a.radius * a.radius;
        const mb = b.radius * b.radius;
        // Раздвинуть: лёгкий уходит больше.
        const overlap = min - d;
        a.pos.x -= nx * overlap * (mb / (ma + mb));
        a.pos.y -= ny * overlap * (mb / (ma + mb));
        b.pos.x += nx * overlap * (ma / (ma + mb));
        b.pos.y += ny * overlap * (ma / (ma + mb));
        const closing = (a.vel.x - b.vel.x) * nx + (a.vel.y - b.vel.y) * ny;
        if (closing <= 0) continue;
        const j = ((1 + ROCK_RESTITUTION) * closing) / (1 / ma + 1 / mb);
        a.vel.x -= (j / ma) * nx;
        a.vel.y -= (j / ma) * ny;
        b.vel.x += (j / mb) * nx;
        b.vel.y += (j / mb) * ny;
      }
    }
  };

  /** Камень разбился: мелкий рассыпается, крупные раскалываются. */
  const shatter = (a: Asteroid): void => {
    events.breaks.push({ x: a.pos.x, y: a.pos.y, size: a.size });
    field.split(a);
  };

  /** Ближайший камень на поле или цель-босс (до его края) — цель автонаведения. Камни Роя не цель. */
  const nearestRock = (from: { x: number; y: number }): Mover | null => {
    let best: Mover | null = null;
    let bestD = Infinity;
    const boss = bossCtl?.target ? bossCtl.boss : null;
    // Бомбу саботажника тоже можно сбить.
    for (const b of afterlife.bombs) {
      if (!inside(bounds, b.pos)) continue;
      const d = (b.pos.x - from.x) ** 2 + (b.pos.y - from.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (boss && inside(bounds, boss.pos)) {
      bestD = Math.max(0, Math.hypot(boss.pos.x - from.x, boss.pos.y - from.y) - boss.radius) ** 2;
      best = boss;
    }
    for (const a of field.list) {
      if (a.immortal || !inside(bounds, a.pos)) continue;
      const d = (a.pos.x - from.x) ** 2 + (a.pos.y - from.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  };

  /** Удар: камень разбивается (камень Роя и тело босса — нет), корабль теряет жизнь и множитель, ненадолго неуязвим. */
  const hitShip = (pilot: Pilot, rock: Asteroid | null): void => {
    if (rock && !rock.immortal) shatter(rock);
    pilot.lives--;
    pilot.stats.hits++;
    pilot.invulnS = HIT_INVULN_S;
    resetMult(pilot);
    events.hits.push(pilot.ship.id);
    hitStopS = Math.max(hitStopS, HIT_STOP_S);
    if (pilot.lives > 0) return;
    hitStopS = Math.max(hitStopS, HIT_STOP_DEATH_S);
    pilot.shieldS = 0;
    pilot.overloadS = 0;
    pilot.jamS = 0;
    pilot.doubleS = 0;
    pilot.diedAtS = timeS;
    events.deaths.push(pilot.ship.id);
    afterlife.die(pilot);
  };

  /** Таран: не в кооперативе и не по своим — множитель теряют оба. */
  const rammable = (a: Pilot, b: Pilot): boolean =>
    mode !== 'coop' && (mode !== 'teams' || teamOf(a.ship.id) !== teamOf(b.ship.id));

  /** Корабли отталкиваются друг от друга, как упругие шары одной массы. */
  const collideShips = (): void => {
    const alive = [...pilots.values()].filter((p) => p.alive);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i] as Pilot;
        const b = alive[j] as Pilot;
        const key = `${a.ship.id}|${b.ship.id}`;
        const dx = b.ship.pos.x - a.ship.pos.x;
        const dy = b.ship.pos.y - a.ship.pos.y;
        const d = Math.hypot(dx, dy);
        const min = SHIP_HITBOX_RADIUS * 2;
        if (!collisions || d >= min) {
          touching.delete(key);
          continue;
        }
        const nx = d > 0 ? dx / d : 1;
        const ny = d > 0 ? dy / d : 0;
        const push = (min - d) / 2;
        a.ship.pos.x -= nx * push;
        a.ship.pos.y -= ny * push;
        b.ship.pos.x += nx * push;
        b.ship.pos.y += ny * push;
        clampToBounds(a.ship, bounds);
        clampToBounds(b.ship, bounds);
        // Скорости вдоль линии удара: сближались — обмен с потерей; расходятся не медленнее SHIP_PUSH_MIN.
        const closing = (a.ship.vel.x - b.ship.vel.x) * nx + (a.ship.vel.y - b.ship.vel.y) * ny;
        let impulse = closing > 0 ? (closing * (1 + SHIP_BOUNCE)) / 2 : 0;
        const apart = -closing + impulse * 2;
        if (apart < SHIP_PUSH_MIN) impulse += (SHIP_PUSH_MIN - apart) / 2;
        a.ship.vel.x -= nx * impulse;
        a.ship.vel.y -= ny * impulse;
        b.ship.vel.x += nx * impulse;
        b.ship.vel.y += ny * impulse;
        if (touching.has(key)) continue;
        touching.add(key);
        const ram = rammable(a, b);
        if (ram) {
          a.stats.rams++;
          b.stats.rams++;
          resetMult(a);
          resetMult(b);
        }
        events.bumps.push({ a: a.ship.id, b: b.ship.id, x: a.ship.pos.x + nx * SHIP_HITBOX_RADIUS, y: a.ship.pos.y + ny * SHIP_HITBOX_RADIUS, ram });
      }
    }
  };

  /** Воронка тянет корабль к центру поля; тяга и сопротивление корабля с ней спорят. */
  const pull = (ship: Ship, accel: number, dtS: number): void => {
    const dx = cx - ship.pos.x;
    const dy = cy - ship.pos.y;
    const d = Math.hypot(dx, dy);
    if (d === 0) return;
    ship.vel.x += (dx / d) * accel * dtS;
    ship.vel.y += (dy / d) * accel * dtS;
  };

  /** Цель убита: очки добившему, волна кончается. */
  const bossKilled = (by: Pilot): void => {
    if (!bossCtl) return;
    const { boss } = bossCtl;
    by.score += SCORE_BOSS;
    events.bossDown.push({ kind: boss.kind, by: by.ship.id, x: boss.pos.x, y: boss.pos.y });
    hitStopS = Math.max(hitStopS, HIT_STOP_DEATH_S);
    bossCtl.release();
    bossCtl = null;
    waves.finishWave();
  };

  const fire = (pilot: Pilot, btn: boolean): void => {
    const pressed = btn && !pilot.prevBtn;
    pilot.prevBtn = btn;
    if (!FEATURES.shooting || !pressed || pilot.ammo <= 0 || pilot.jamS > 0) return;
    const target = nearestRock(pilot.ship.pos);
    if (!target) return; // стрелять не во что — патрон не тратится
    // «×2 пули»: два снаряда рядом, двойной урон, патрон — один.
    if (pilot.doubleS > 0) {
      const a = bullets.fire(pilot.ship.id, pilot.ship.pos, target, DOUBLE_DAMAGE, -DOUBLE_OFFSET);
      const b = bullets.fire(pilot.ship.id, pilot.ship.pos, target, DOUBLE_DAMAGE, DOUBLE_OFFSET);
      if (!a && !b) return;
    } else if (!bullets.fire(pilot.ship.id, pilot.ship.pos, target)) return;
    pilot.ammo--;
    pilot.stats.shots++;
    events.shots.push(pilot.ship.id);
  };

  /** Снаряды: урон 1; камень без прочности разбивается, очки — стрелку по его ступени множителя. */
  const resolveBullets = (): void => {
    killed.length = 0;
    spent.length = 0;
    claimed.clear();
    for (const b of bullets.list) {
      if (!inside(bounds, b.pos)) {
        spent.push(b);
        continue;
      }
      if (afterlife.shootBomb(b.pos, BULLET_RADIUS)) {
        spent.push(b);
        continue;
      }
      // Тело босса: цель теряет прочность, ядро Воронки просто гасит снаряд.
      const boss = bossCtl?.boss;
      if (bossCtl && boss && boss.radius > 0 && Math.hypot(boss.pos.x - b.pos.x, boss.pos.y - b.pos.y) < BULLET_RADIUS + boss.radius) {
        spent.push(b);
        events.chips.push({ x: b.pos.x, y: b.pos.y });
        const shooter = pilots.get(b.owner);
        if (bossCtl.target) {
          let dead = false;
          for (let d = 0; d < b.damage && !dead; d++) dead = bossCtl.hit(b.pos);
          if (dead && shooter) bossKilled(shooter);
        }
        continue;
      }
      for (const rock of grid.query(b.pos.x, b.pos.y, BULLET_RADIUS, near)) {
        if (claimed.has(rock)) continue;
        const reach = BULLET_RADIUS + rock.radius;
        if ((rock.pos.x - b.pos.x) ** 2 + (rock.pos.y - b.pos.y) ** 2 >= reach * reach) continue;
        spent.push(b);
        // Камень Роя не разбить: снаряд гаснет искрами.
        if (rock.immortal) {
          events.chips.push({ x: b.pos.x, y: b.pos.y });
          break;
        }
        rock.hp -= b.damage;
        const shooter = pilots.get(b.owner);
        if (rock.hp <= 0 && shooter) {
          claimed.add(rock);
          killed.push({ rock, by: shooter });
        } else {
          events.chips.push({ x: b.pos.x, y: b.pos.y });
        }
        break;
      }
    }
    for (const b of spent) bullets.remove(b);
    for (const { rock, by } of killed) {
      by.score += SCORE_ASTEROID[rock.size] * totalMult(by);
      by.stats.kills++;
      // Выпадение усиления — из камня, разбитого снарядом.
      if (powerupsOn && rng.next() < dropChance) {
        const up = powerups.drop(rock.pos.x, rock.pos.y);
        events.drops.push({ x: up.pos.x, y: up.pos.y, kind: up.kind });
      }
      shatter(rock);
    }
  };

  /** Союзник ли: в кооперативе все, в командном — своя команда. */
  const ally = (a: string, b: string): boolean => a === b || mode === 'coop' || (mode === 'teams' && teamOf(a) === teamOf(b));

  /** Подбор усиления пролётом (SPACE_WAR_SPEC §5 «Усиления»). Таймеры при повторном подборе только сбрасываются. */
  const apply = (pilot: Pilot, kind: PowerupKind): void => {
    const alive = [...pilots.values()].filter((p) => p.alive);
    switch (kind) {
      case 'repair': {
        // Лично; в кооперативе и командном — в общий пул: тому из своих, у кого жизней меньше всех.
        const pool = mode === 'versus' ? [pilot] : alive.filter((p) => ally(p.ship.id, pilot.ship.id));
        const target = pool.reduce((best, p) => (p.lives < best.lives ? p : best), pilot);
        if (target.lives < SHIP_LIVES) events.healed.push(target.ship.id);
        target.lives = Math.min(SHIP_LIVES, target.lives + 1);
        return;
      }
      case 'ammo':
        pilot.ammo = AMMO_MAX;
        pilot.ammoProgress = 0;
        return;
      case 'shield':
        pilot.shieldS = SHIELD_S;
        return;
      case 'freeze':
        freezeS = FREEZE_S;
        return;
      case 'double':
        pilot.doubleS = DOUBLE_S;
        return;
      case 'overload':
        pilot.overloadS = OVERLOAD_S;
        return;
      case 'jammer': {
        // Решение заказчика: глушит всех соперников (в командном — только чужую команду).
        const rivals = alive.filter((p) => !ally(p.ship.id, pilot.ship.id));
        for (const r of rivals) {
          r.jamS = JAMMER_S;
          events.jammed.push(r.ship.id);
        }
        return;
      }
    }
  };

  const collectPowerups = (): void => {
    for (let i = powerups.list.length - 1; i >= 0; i--) {
      const p = powerups.list[i] as Powerup;
      const picker = [...pilots.values()].find(
        (pilot) => pilot.alive && Math.hypot(pilot.ship.pos.x - p.pos.x, pilot.ship.pos.y - p.pos.y) < SHIP_HITBOX_RADIUS + POWERUP_RADIUS,
      );
      if (!picker) continue;
      powerups.remove(p);
      apply(picker, p.kind);
      picker.stats.pickups++;
      events.pickups.push({ id: picker.ship.id, kind: p.kind, x: p.pos.x, y: p.pos.y });
    }
  };

  return {
    bounds,
    ships,
    pilots,
    asteroids: field.list,
    bullets: bullets.list,
    waves,
    get boss() {
      return bossCtl?.boss ?? null;
    },
    powerups: powerups.list,
    get freezeS() {
      return freezeS;
    },
    shards: afterlife.shards,
    bombs: afterlife.bombs,
    sabotage: (id, shot) => afterlife.sabotage(id, shot),
    sabCooldownS: (kind) => afterlife.cooldownS(kind),
    events,
    get timeS() {
      return timeS;
    },
    get over() {
      return overInS !== null && overInS <= 0;
    },
    get frozen() {
      return hitStopS > 0;
    },
    finalScore(id) {
      const p = pilots.get(id);
      return p ? p.score + Math.max(0, p.lives) * SCORE_LIFE_LEFT : 0;
    },
    step(dtS, read) {
      for (const list of Object.values(events)) (list as unknown[]).length = 0;
      if (hitStopS > 0) {
        hitStopS -= dtS;
        return;
      }
      timeS += dtS;

      const wave = waves.step(dtS);
      if (wave) {
        events.waves.push(wave);
        if (wave.kind === 'start' && waves.boss) {
          bossCtl = createBoss(waves.boss, rng, field, bounds, playerIds.length, growth(WAVE_SPEED_GROWTH));
        }
        if (wave.kind === 'end') {
          // Испытание пройдено или цель ушла недобитой.
          bossCtl?.release();
          bossCtl = null;
          for (const p of pilots.values()) {
            if (!p.alive) continue;
            p.score += SCORE_WAVE * wave.wave;
            p.stats.waves++;
          }
          if (waves.phase === 'done' && overInS === null) overInS = WAVE_FINISH_DELAY_S;
        }
      }

      // Камни идут только во время волны; на передышке и после финиша поле пустеет.
      const comp = waves.complication;
      bossCtl?.step(dtS);
      const bossFlow = waves.boss ? BOSS_FLOW[waves.boss] : 1;
      if (waves.phase === 'wave') {
        spawnDebt += spawnPerS * growth(WAVE_DENSITY_GROWTH) * (comp ? COMPLICATION_FLOW[comp] : 1) * bossFlow * dtS;
        const speedK = growth(WAVE_SPEED_GROWTH) * (comp ? COMPLICATION_SPEED[comp] : 1);
        const size = comp === 'small' || comp === 'large' ? comp : undefined;
        while (spawnDebt >= 1) {
          spawnDebt--;
          field.spawn(size ? { size, speedK } : { speedK });
        }
      }
      // Воронка: осложнение или босс. Ядро босса глотает камни.
      const rockPull = comp === 'vortex' ? VORTEX_ROCK_PULL : (bossCtl?.boss.rockPull ?? 0);
      const shipPull = comp === 'vortex' ? VORTEX_SHIP_PULL : (bossCtl?.boss.shipPull ?? 0);
      // Заморозка: камни стоят (новые всё так же появляются за краем).
      freezeS = Math.max(0, freezeS - dtS);
      if (freezeS === 0) {
        if (rockPull > 0) field.attract(cx, cy, rockPull, dtS);
        field.step(dtS);
        if (rockBounce) bounceRocks();
      } else {
        for (const a of field.list) {
          a.prev.x = a.pos.x;
          a.prev.y = a.pos.y;
        }
      }
      powerups.step(dtS);
      afterlife.moveGhosts(dtS, read);
      afterlife.step(dtS);
      if (bossCtl?.boss.kind === 'vortex') {
        const core = bossCtl.boss;
        for (let i = field.list.length - 1; i >= 0; i--) {
          const a = field.list[i] as Asteroid;
          if (Math.hypot(a.pos.x - core.pos.x, a.pos.y - core.pos.y) < core.radius) {
            events.breaks.push({ x: a.pos.x, y: a.pos.y, size: a.size });
            field.remove(a);
          }
        }
      }

      for (const pilot of pilots.values()) {
        if (!pilot.alive) continue;
        const input = read(pilot.ship.id);
        stepShip(pilot.ship, input, dtS, bounds);
        pilot.invulnS = Math.max(0, pilot.invulnS - dtS);
        pilot.shieldS = Math.max(0, pilot.shieldS - dtS);
        pilot.overloadS = Math.max(0, pilot.overloadS - dtS);
        pilot.jamS = Math.max(0, pilot.jamS - dtS);
        pilot.doubleS = Math.max(0, pilot.doubleS - dtS);
        if (shipPull > 0) pull(pilot.ship, shipPull, dtS);
        fire(pilot, input.btn);
        // Глушение: патроны не копятся.
        if (comp !== 'jam' && regenAmmo(pilot, dtS)) events.reloads.push(pilot.ship.id);
      }

      collideShips();
      bullets.step(dtS);
      rebuildGrid();
      resolveBullets();

      // Столкновения кораблей с камнями. Сначала находим удары, потом применяем: раскол меняет список камней.
      // Неуязвимый корабль проходит сквозь камни — удар не превращается в таран.
      rebuildGrid();
      hits.length = 0;
      claimed.clear();
      for (const pilot of pilots.values()) {
        if (!pilot.alive || pilot.invulnS > 0) continue;
        const { pos } = pilot.ship;
        for (const rock of grid.query(pos.x, pos.y, SHIP_HITBOX_RADIUS, near)) {
          if (claimed.has(rock)) continue;
          const reach = SHIP_HITBOX_RADIUS + rock.radius * ASTEROID_HITBOX_K;
          if ((rock.pos.x - pos.x) ** 2 + (rock.pos.y - pos.y) ** 2 >= reach * reach) continue;
          claimed.add(rock);
          hits.push({ pilot, rock });
          break;
        }
      }
      // Щит: камень разбивается о него, жизнь и множитель целы.
      for (const { pilot, rock } of hits) {
        if (pilot.shieldS > 0) {
          if (!rock.immortal) shatter(rock);
        } else hitShip(pilot, rock);
      }
      collectPowerups();
      // Тело босса: минус жизнь, босс цел; неуязвимость даёт выбраться.
      const body = bossCtl?.boss;
      if (body && body.radius > 0) {
        for (const pilot of pilots.values()) {
          if (!pilot.alive || pilot.invulnS > 0 || pilot.shieldS > 0) continue;
          const { pos } = pilot.ship;
          if (Math.hypot(body.pos.x - pos.x, body.pos.y - pos.y) < SHIP_HITBOX_RADIUS + body.radius * BOSS_HITBOX_K) hitShip(pilot, null);
        }
      }

      // Сближения: пролёт вплотную к камню, но без удара. Неуязвимый множитель не копит.
      rebuildGrid();
      for (const pilot of pilots.values()) {
        if (!pilot.alive) continue;
        if (pilot.invulnS === 0) {
          const { pos } = pilot.ship;
          for (const rock of grid.query(pos.x, pos.y, SHIP_HITBOX_RADIUS + NEAR_MISS_DISTANCE, near)) {
            const gap = Math.hypot(rock.pos.x - pos.x, rock.pos.y - pos.y) - SHIP_HITBOX_RADIUS - rock.radius * ASTEROID_HITBOX_K;
            if (gap <= 0 || gap >= NEAR_MISS_DISTANCE) continue;
            if (nearMiss(pilot, rock.id, timeS)) {
              pilot.stats.near++;
              pilot.stats.maxMult = Math.max(pilot.stats.maxMult, totalMult(pilot));
              events.near.push({ id: pilot.ship.id, x: rock.pos.x, y: rock.pos.y });
            }
          }
        }
        checkIdle(pilot, timeS);
        // Память о засчитанных камнях — только о тех, что ещё на поле.
        if (pilot.nearIds.size > field.list.length * 2) {
          const alive = new Set(field.list.map((a) => a.id));
          for (const id of pilot.nearIds) if (!alive.has(id)) pilot.nearIds.delete(id);
        }
      }

      if (overInS === null && [...pilots.values()].every((p) => !p.alive)) overInS = GAME_OVER_DELAY_S;
      else if (overInS !== null) overInS -= dtS;
    },
  };
}

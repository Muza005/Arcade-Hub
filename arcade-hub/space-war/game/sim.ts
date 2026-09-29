// Симуляция Space War без графики: по сиду и потоку ввода матч воспроизводится один в один.
// Б1 — корабли; Б2 — астероиды, жизни, конец игры; Б3 — стрельба, патроны, множитель, очки.
import type { InputState } from '../../engine/input';
import { createRng } from '../../engine/rng';
import {
  ASTEROID_HITBOX_K,
  ASTEROID_RADIUS,
  ASTEROID_SPAWN_PER_S,
  BULLET_RADIUS,
  FIELD_INSET,
  FLOW_PLAYER_K,
  GAME_OVER_DELAY_S,
  GRID_CELL,
  HIT_INVULN_S,
  HIT_STOP_DEATH_S,
  HIT_STOP_S,
  NEAR_MISS_DISTANCE,
  SCORE_ASTEROID,
  SCORE_LIFE_LEFT,
  SHIP_HITBOX_RADIUS,
  SPAWN_RING_RADIUS,
  WORLD_H,
  type AsteroidSize,
} from '../config';
import { FEATURES } from '../features';
import { createAsteroidField, type Asteroid } from './asteroids';
import { createBullets, type Bullet } from './bullets';
import { Grid } from './grid';
import { checkIdle, createPilot, nearMiss, regenAmmo, resetMult, type Pilot } from './pilot';
import { createShip, stepShip, type Bounds, type Ship } from './ship';

export type { Pilot } from './pilot';

/** Что случилось на последнем шаге — для графики и обратной связи на телефоне. */
export interface SimEvents {
  hits: string[];
  deaths: string[];
  breaks: Array<{ x: number; y: number; size: AsteroidSize }>;
  /** Попадание без раскола — искры и смена вида камня. */
  chips: Array<{ x: number; y: number }>;
  shots: string[];
  near: Array<{ id: string; x: number; y: number }>;
  /** У кого добавился патрон — вспышка на кнопке телефона. */
  reloads: string[];
}

export interface Sim {
  readonly bounds: Bounds;
  readonly ships: readonly Ship[];
  readonly pilots: ReadonlyMap<string, Pilot>;
  readonly asteroids: readonly Asteroid[];
  readonly bullets: readonly Bullet[];
  readonly events: SimEvents;
  readonly timeS: number;
  /** Все погибли и пауза на взрыв прошла. */
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
export function createSim(playerIds: readonly string[], worldW: number, seed: number, worldH: number = WORLD_H): Sim {
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
  const events: SimEvents = { hits: [], deaths: [], breaks: [], chips: [], shots: [], near: [], reloads: [] };
  const spawnPerS = ASTEROID_SPAWN_PER_S * (1 + FLOW_PLAYER_K * (playerIds.length - 1));
  let spawnDebt = 0;
  let timeS = 0;
  let overInS: number | null = null;
  let hitStopS = 0;

  const rebuildGrid = (): void => {
    grid.clear();
    for (const a of field.list) grid.insert(a);
  };

  /** Камень разбился: мелкий рассыпается, крупные раскалываются. */
  const shatter = (a: Asteroid): void => {
    events.breaks.push({ x: a.pos.x, y: a.pos.y, size: a.size });
    field.split(a);
  };

  /** Ближайший камень на поле — цель автонаведения. */
  const nearestRock = (from: { x: number; y: number }): Asteroid | null => {
    let best: Asteroid | null = null;
    let bestD = Infinity;
    for (const a of field.list) {
      if (!inside(bounds, a.pos)) continue;
      const d = (a.pos.x - from.x) ** 2 + (a.pos.y - from.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  };

  /** Удар: камень разбивается, корабль теряет жизнь и множитель, ненадолго становится неуязвимым. */
  const hitShip = (pilot: Pilot, rock: Asteroid): void => {
    shatter(rock);
    pilot.lives--;
    pilot.invulnS = HIT_INVULN_S;
    resetMult(pilot);
    events.hits.push(pilot.ship.id);
    hitStopS = Math.max(hitStopS, HIT_STOP_S);
    if (pilot.lives > 0) return;
    hitStopS = Math.max(hitStopS, HIT_STOP_DEATH_S);
    pilot.alive = false;
    pilot.diedAtS = timeS;
    events.deaths.push(pilot.ship.id);
  };

  const fire = (pilot: Pilot, btn: boolean): void => {
    const pressed = btn && !pilot.prevBtn;
    pilot.prevBtn = btn;
    if (!FEATURES.shooting || !pressed || pilot.ammo <= 0) return;
    const target = nearestRock(pilot.ship.pos);
    if (!target) return; // стрелять не во что — патрон не тратится
    if (!bullets.fire(pilot.ship.id, pilot.ship.pos, target)) return;
    pilot.ammo--;
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
      for (const rock of grid.query(b.pos.x, b.pos.y, BULLET_RADIUS, near)) {
        if (claimed.has(rock)) continue;
        const reach = BULLET_RADIUS + rock.radius;
        if ((rock.pos.x - b.pos.x) ** 2 + (rock.pos.y - b.pos.y) ** 2 >= reach * reach) continue;
        spent.push(b);
        rock.hp--;
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
      by.score += SCORE_ASTEROID[rock.size] * by.mult;
      shatter(rock);
    }
  };

  return {
    bounds,
    ships,
    pilots,
    asteroids: field.list,
    bullets: bullets.list,
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

      spawnDebt += spawnPerS * dtS;
      while (spawnDebt >= 1) {
        spawnDebt--;
        field.spawn();
      }
      field.step(dtS);

      for (const pilot of pilots.values()) {
        if (!pilot.alive) continue;
        const input = read(pilot.ship.id);
        stepShip(pilot.ship, input, dtS, bounds);
        pilot.invulnS = Math.max(0, pilot.invulnS - dtS);
        fire(pilot, input.btn);
        if (regenAmmo(pilot, dtS)) events.reloads.push(pilot.ship.id);
      }

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
      for (const { pilot, rock } of hits) hitShip(pilot, rock);

      // Сближения: пролёт вплотную к камню, но без удара. Неуязвимый множитель не копит.
      rebuildGrid();
      for (const pilot of pilots.values()) {
        if (!pilot.alive) continue;
        if (pilot.invulnS === 0) {
          const { pos } = pilot.ship;
          for (const rock of grid.query(pos.x, pos.y, SHIP_HITBOX_RADIUS + NEAR_MISS_DISTANCE, near)) {
            const gap = Math.hypot(rock.pos.x - pos.x, rock.pos.y - pos.y) - SHIP_HITBOX_RADIUS - rock.radius * ASTEROID_HITBOX_K;
            if (gap <= 0 || gap >= NEAR_MISS_DISTANCE) continue;
            if (nearMiss(pilot, rock.id, timeS)) events.near.push({ id: pilot.ship.id, x: rock.pos.x, y: rock.pos.y });
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

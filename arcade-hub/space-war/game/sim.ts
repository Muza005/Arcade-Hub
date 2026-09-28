// Симуляция Space War без графики: по сиду и потоку ввода матч воспроизводится один в один.
// Б1 — корабли; Б2 — астероиды, жизни, конец игры. Стрельба, множитель и волны — следующие этапы.
import type { InputState } from '../../engine/input';
import { createRng } from '../../engine/rng';
import {
  ASTEROID_HITBOX_K,
  ASTEROID_RADIUS,
  ASTEROID_SPAWN_PER_S,
  FIELD_INSET,
  FLOW_PLAYER_K,
  GAME_OVER_DELAY_S,
  GRID_CELL,
  HIT_INVULN_S,
  SHIP_HITBOX_RADIUS,
  SHIP_LIVES,
  SPAWN_RING_RADIUS,
  WORLD_H,
  type AsteroidSize,
} from '../config';
import { createAsteroidField, type Asteroid } from './asteroids';
import { Grid } from './grid';
import { createShip, stepShip, type Bounds, type Ship } from './ship';

export interface Pilot {
  readonly ship: Ship;
  lives: number;
  /** Неуязвимость после удара, с. */
  invulnS: number;
  alive: boolean;
  /** Время гибели от начала матча — для мест в итогах. */
  diedAtS: number | null;
}

/** Что случилось на последнем шаге — для графики и обратной связи на телефоне. */
export interface SimEvents {
  hits: string[];
  deaths: string[];
  breaks: Array<{ x: number; y: number; size: AsteroidSize }>;
}

export interface Sim {
  readonly bounds: Bounds;
  readonly ships: readonly Ship[];
  readonly pilots: ReadonlyMap<string, Pilot>;
  readonly asteroids: readonly Asteroid[];
  readonly events: SimEvents;
  readonly timeS: number;
  /** Все погибли и пауза на взрыв прошла. */
  readonly over: boolean;
  step(dtS: number, read: (id: string) => InputState): void;
}

export function fieldBounds(worldW: number): Bounds {
  return { left: FIELD_INSET, top: FIELD_INSET, right: worldW - FIELD_INSET, bottom: WORLD_H - FIELD_INSET };
}

export function createSim(playerIds: readonly string[], worldW: number, seed: number): Sim {
  const bounds = fieldBounds(worldW);
  const rng = createRng(seed);
  const cx = (bounds.left + bounds.right) / 2;
  const cy = (bounds.top + bounds.bottom) / 2;
  // Корабли стартуют по кругу носом наружу; один игрок — в центре носом вверх.
  const ships = playerIds.map((id, i) => {
    const a = (i / playerIds.length) * Math.PI * 2 - Math.PI / 2;
    const ring = playerIds.length === 1 ? 0 : SPAWN_RING_RADIUS;
    return createShip(id, { x: cx + Math.cos(a) * ring, y: cy + Math.sin(a) * ring }, a);
  });
  const pilots = new Map<string, Pilot>(
    ships.map((ship) => [ship.id, { ship, lives: SHIP_LIVES, invulnS: 0, alive: true, diedAtS: null }]),
  );

  const field = createAsteroidField(rng, bounds);
  const grid = new Grid<Asteroid>(GRID_CELL, bounds.right + bounds.left, ASTEROID_RADIUS.large * 2);
  const near: Asteroid[] = [];
  const hits: Array<{ pilot: Pilot; rock: Asteroid }> = [];
  const claimed = new Set<Asteroid>();
  const events: SimEvents = { hits: [], deaths: [], breaks: [] };
  const spawnPerS = ASTEROID_SPAWN_PER_S * (1 + FLOW_PLAYER_K * (playerIds.length - 1));
  let spawnDebt = 0;
  let timeS = 0;
  let overInS: number | null = null;

  /** Камень разбился: мелкий рассыпается, крупные раскалываются. */
  const shatter = (a: Asteroid): void => {
    events.breaks.push({ x: a.pos.x, y: a.pos.y, size: a.size });
    field.split(a);
  };

  /** Удар: камень разбивается, корабль теряет жизнь и ненадолго становится неуязвимым. */
  const hitShip = (pilot: Pilot, rock: Asteroid): void => {
    shatter(rock);
    pilot.lives--;
    pilot.invulnS = HIT_INVULN_S;
    events.hits.push(pilot.ship.id);
    if (pilot.lives > 0) return;
    pilot.alive = false;
    pilot.diedAtS = timeS;
    events.deaths.push(pilot.ship.id);
  };

  return {
    bounds,
    ships,
    pilots,
    asteroids: field.list,
    events,
    get timeS() {
      return timeS;
    },
    get over() {
      return overInS !== null && overInS <= 0;
    },
    step(dtS, read) {
      events.hits.length = 0;
      events.deaths.length = 0;
      events.breaks.length = 0;
      timeS += dtS;

      spawnDebt += spawnPerS * dtS;
      while (spawnDebt >= 1) {
        spawnDebt--;
        field.spawn();
      }
      field.step(dtS);

      for (const pilot of pilots.values()) {
        if (!pilot.alive) continue;
        stepShip(pilot.ship, read(pilot.ship.id), dtS, bounds);
        pilot.invulnS = Math.max(0, pilot.invulnS - dtS);
      }

      // Столкновения: камни по сетке, каждый корабль смотрит только соседние ячейки.
      // Сначала находим удары, потом применяем: раскол меняет список камней.
      // Неуязвимый корабль проходит сквозь камни — удар не превращается в таран.
      grid.clear();
      for (const a of field.list) grid.insert(a);
      hits.length = 0;
      claimed.clear();
      for (const pilot of pilots.values()) {
        if (!pilot.alive || pilot.invulnS > 0) continue;
        const { pos } = pilot.ship;
        for (const rock of grid.query(pos.x, pos.y, SHIP_HITBOX_RADIUS, near)) {
          if (claimed.has(rock)) continue;
          const reach = SHIP_HITBOX_RADIUS + rock.radius * ASTEROID_HITBOX_K;
          const dx = rock.pos.x - pos.x;
          const dy = rock.pos.y - pos.y;
          if (dx * dx + dy * dy >= reach * reach) continue;
          claimed.add(rock);
          hits.push({ pilot, rock });
          break;
        }
      }
      for (const { pilot, rock } of hits) hitShip(pilot, rock);

      if (overInS === null && [...pilots.values()].every((p) => !p.alive)) overInS = GAME_OVER_DELAY_S;
      else if (overInS !== null) overInS -= dtS;
    },
  };
}

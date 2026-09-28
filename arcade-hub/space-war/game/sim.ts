// Симуляция Space War без графики: по сиду и потоку ввода матч воспроизводится один в один.
// Этап Б1 — только корабли; камни, стрельба и волны добавляются следующими этапами.
import type { InputState } from '../../engine/input';
import { FIELD_INSET, SPAWN_RING_RADIUS, WORLD_H } from '../config';
import { createShip, stepShip, type Bounds, type Ship } from './ship';

export interface Sim {
  readonly bounds: Bounds;
  readonly ships: readonly Ship[];
  step(dtS: number, read: (id: string) => InputState): void;
}

export function fieldBounds(worldW: number): Bounds {
  return { left: FIELD_INSET, top: FIELD_INSET, right: worldW - FIELD_INSET, bottom: WORLD_H - FIELD_INSET };
}

export function createSim(playerIds: readonly string[], worldW: number): Sim {
  const bounds = fieldBounds(worldW);
  const cx = (bounds.left + bounds.right) / 2;
  const cy = (bounds.top + bounds.bottom) / 2;
  // Корабли стартуют по кругу носом наружу; один игрок — в центре носом вверх.
  const ships = playerIds.map((id, i) => {
    const a = (i / playerIds.length) * Math.PI * 2 - Math.PI / 2;
    const ring = playerIds.length === 1 ? 0 : SPAWN_RING_RADIUS;
    return createShip(id, { x: cx + Math.cos(a) * ring, y: cy + Math.sin(a) * ring }, a);
  });

  return {
    bounds,
    ships,
    step(dtS, read) {
      for (const ship of ships) stepShip(ship, read(ship.id), dtS, bounds);
    },
  };
}

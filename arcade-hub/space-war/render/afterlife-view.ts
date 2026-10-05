// Рисунок того, что остаётся после гибели: светящиеся осколки погибшего (ромбы в его цвет, пульсируют),
// кольцо оставшегося времени вокруг призрака, бомбы саботажника (заливка в его цвет и мигающий фитиль).
import { Graphics } from 'pixi.js';
import {
  BOMB_FUSE_HZ,
  BOMB_RADIUS,
  GHOST_RING_GAP,
  GHOST_RING_PX,
  SHARD_PULSE_HZ,
  SHARD_RADIUS,
  SHIP_HITBOX_RADIUS,
} from '../config';
import type { Bomb, Shard } from '../game/afterlife';

const PULSE = 0.25;
const FUSE_K = 0.45; // фитиль — точка на краю бомбы
const FUSE_R = 5;
const RING_ALPHA = 0.6;
const FUSE_COLOR = '#FFD23F';

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

export interface GhostMark {
  x: number;
  y: number;
  color: string;
  /** Доля оставшегося времени призрака, 0…1. */
  left: number;
}

export interface AfterlifeView {
  readonly view: Graphics;
  draw(
    shards: readonly Shard[],
    bombs: readonly Bomb[],
    ghosts: readonly GhostMark[],
    colorOf: (id: string) => string,
    alpha: number,
    timeS: number,
  ): void;
}

export function createAfterlifeView(): AfterlifeView {
  const view = new Graphics();
  return {
    view,
    draw(shards, bombs, ghosts, colorOf, alpha, timeS) {
      view.clear();
      const pulse = 1 + PULSE * Math.sin(timeS * SHARD_PULSE_HZ * Math.PI * 2);
      for (const s of shards) {
        const x = lerp(s.prev.x, s.pos.x, alpha);
        const y = lerp(s.prev.y, s.pos.y, alpha);
        const r = SHARD_RADIUS * pulse;
        view.poly([x, y - r, x + r * 0.7, y, x, y + r, x - r * 0.7, y]).fill({ color: colorOf(s.owner) });
      }
      for (const g of ghosts) {
        const r = SHIP_HITBOX_RADIUS + GHOST_RING_GAP;
        const start = -Math.PI / 2;
        view
          .moveTo(g.x + Math.cos(start) * r, g.y + Math.sin(start) * r)
          .arc(g.x, g.y, r, start, start + Math.PI * 2 * g.left)
          .stroke({ color: g.color, width: GHOST_RING_PX, alpha: RING_ALPHA });
      }
      const fuseOn = Math.floor(timeS * BOMB_FUSE_HZ * 2) % 2 === 0;
      for (const b of bombs) {
        const x = lerp(b.prev.x, b.pos.x, alpha);
        const y = lerp(b.prev.y, b.pos.y, alpha);
        view.circle(x, y, BOMB_RADIUS).fill({ color: colorOf(b.owner) });
        if (fuseOn) view.circle(x + BOMB_RADIUS * FUSE_K, y - BOMB_RADIUS * FUSE_K * 2, FUSE_R).fill({ color: FUSE_COLOR });
      }
    },
  };
}

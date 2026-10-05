// Осложнение «Инопланетяне» (решение заказчика): мельче мелкого камня и быстрее камней; появляются с краёв и
// летят к ближайшему кораблю сквозь камни. Три попадания — сбит. Долетел — цепляется к кораблю и висит на нём,
// корабль медленнее (до пяти прилипших, дальше не хуже); снять нельзя — в конце волны отстают и уходят.
// Щит сжигает инопланетянина при касании.
import type { Rng } from '../../engine/rng';
import {
  ALIEN_HP,
  ALIEN_LEAVE_SPEED,
  ALIEN_RADIUS,
  ALIEN_SLOW_MAX_COUNT,
  ALIEN_SLOW_STEP,
  ALIEN_SPEED,
  ALIEN_STEER,
  ALIENS_MAX,
  ASTEROID_SPAWN_GAP,
  SHIP_HITBOX_RADIUS,
} from '../config';
import type { Bounds, Vec } from './ship';

export interface Alien {
  id: number;
  pos: Vec;
  prev: Vec;
  vel: Vec;
  hp: number;
  /** На ком висит; null — летит сам. */
  host: string | null;
  /** Где висит относительно корабля. */
  offset: Vec;
  /** Конец волны: отстал и уходит за край. */
  leaving: boolean;
}

export interface AlienHost {
  id: string;
  pos: Vec;
  /** Щит: касание сжигает инопланетянина. */
  shielded: boolean;
}

export interface Aliens {
  readonly list: Alien[];
  /** Новый с края поля. */
  spawn(): void;
  /** Полёт к ближайшему кораблю, прилипание; возвращает сожжённых щитом. */
  step(dtS: number, hosts: readonly AlienHost[]): Vec[];
  /** Попадание: true — сбит (и убран). */
  hit(a: Alien, damage: number): boolean;
  /** Сколько висит на корабле. */
  stuck(id: string): number;
  /** Во сколько раз корабль слабее из-за прилипших (1 — не мешают). */
  powerK(id: string): number;
  /** Отстать и уйти: всем (конец волны) или с одного корабля (погиб). */
  leave(host?: string): void;
}

export function createAliens(rng: Rng, bounds: Bounds): Aliens {
  const list: Alien[] = [];
  let nextId = 1;
  const w = bounds.right - bounds.left;
  const h = bounds.bottom - bounds.top;
  const out = ALIEN_RADIUS + ASTEROID_SPAWN_GAP;

  const remove = (a: Alien): void => {
    const i = list.indexOf(a);
    if (i >= 0) list.splice(i, 1);
  };
  const detach = (a: Alien): void => {
    const d = Math.hypot(a.offset.x, a.offset.y) || 1;
    a.host = null;
    a.leaving = true;
    a.vel.x = (a.offset.x / d) * ALIEN_LEAVE_SPEED;
    a.vel.y = (a.offset.y / d) * ALIEN_LEAVE_SPEED;
  };

  return {
    list,
    spawn() {
      if (list.length >= ALIENS_MAX) return;
      let t = rng.next() * (w + h) * 2;
      let x: number;
      let y: number;
      if (t < w) [x, y] = [bounds.left + t, bounds.top - out];
      else if ((t -= w) < w) [x, y] = [bounds.left + t, bounds.bottom + out];
      else if ((t -= w) < h) [x, y] = [bounds.left - out, bounds.top + t];
      else [x, y] = [bounds.right + out, bounds.top + t - h];
      const cx = (bounds.left + bounds.right) / 2;
      const cy = (bounds.top + bounds.bottom) / 2;
      const d = Math.hypot(cx - x, cy - y) || 1;
      list.push({
        id: nextId++,
        pos: { x, y },
        prev: { x, y },
        vel: { x: ((cx - x) / d) * ALIEN_SPEED, y: ((cy - y) / d) * ALIEN_SPEED },
        hp: ALIEN_HP,
        host: null,
        offset: { x: 0, y: 0 },
        leaving: false,
      });
    },
    step(dtS, hosts) {
      const burnt: Vec[] = [];
      const byId = new Map(hosts.map((s) => [s.id, s]));
      for (let i = list.length - 1; i >= 0; i--) {
        const a = list[i] as Alien;
        a.prev.x = a.pos.x;
        a.prev.y = a.pos.y;
        if (a.host) {
          const host = byId.get(a.host);
          if (!host) {
            detach(a);
          } else {
            a.pos.x = host.pos.x + a.offset.x;
            a.pos.y = host.pos.y + a.offset.y;
            continue;
          }
        }
        if (!a.leaving) {
          // Доворачивает на ближайший корабль.
          let best: AlienHost | null = null;
          let bestD = Infinity;
          for (const s of hosts) {
            const d = Math.hypot(s.pos.x - a.pos.x, s.pos.y - a.pos.y);
            if (d < bestD) [best, bestD] = [s, d];
          }
          if (best) {
            const k = Math.min(1, ALIEN_STEER * dtS);
            const d = bestD || 1;
            a.vel.x += (((best.pos.x - a.pos.x) / d) * ALIEN_SPEED - a.vel.x) * k;
            a.vel.y += (((best.pos.y - a.pos.y) / d) * ALIEN_SPEED - a.vel.y) * k;
            if (bestD < SHIP_HITBOX_RADIUS + ALIEN_RADIUS) {
              if (best.shielded) {
                burnt.push({ x: a.pos.x, y: a.pos.y });
                list.splice(i, 1);
                continue;
              }
              // Цепляется там, где коснулся, — по краю корпуса.
              a.host = best.id;
              const r = SHIP_HITBOX_RADIUS * 0.9;
              a.offset.x = ((a.pos.x - best.pos.x) / d) * r;
              a.offset.y = ((a.pos.y - best.pos.y) / d) * r;
              a.pos.x = best.pos.x + a.offset.x;
              a.pos.y = best.pos.y + a.offset.y;
              continue;
            }
          }
        }
        a.pos.x += a.vel.x * dtS;
        a.pos.y += a.vel.y * dtS;
        if (a.leaving) {
          const far = ALIEN_RADIUS + ASTEROID_SPAWN_GAP * 2;
          if (a.pos.x < bounds.left - far || a.pos.x > bounds.right + far || a.pos.y < bounds.top - far || a.pos.y > bounds.bottom + far) {
            list.splice(i, 1);
          }
        }
      }
      return burnt;
    },
    hit(a, damage) {
      a.hp -= damage;
      if (a.hp > 0) return false;
      remove(a);
      return true;
    },
    stuck(id) {
      let n = 0;
      for (const a of list) if (a.host === id) n++;
      return n;
    },
    powerK(id) {
      let n = 0;
      for (const a of list) if (a.host === id) n++;
      return 1 - ALIEN_SLOW_STEP * Math.min(n, ALIEN_SLOW_MAX_COUNT);
    },
    leave(host) {
      for (const a of list) {
        if (host !== undefined && a.host !== host) continue;
        if (a.host) detach(a);
        else if (host === undefined) {
          // Свободные разворачиваются от центра и уходят.
          a.leaving = true;
          const cx = (bounds.left + bounds.right) / 2;
          const cy = (bounds.top + bounds.bottom) / 2;
          const d = Math.hypot(a.pos.x - cx, a.pos.y - cy) || 1;
          a.vel.x = ((a.pos.x - cx) / d) * ALIEN_LEAVE_SPEED;
          a.vel.y = ((a.pos.y - cy) / d) * ALIEN_LEAVE_SPEED;
        }
      }
    },
  };
}

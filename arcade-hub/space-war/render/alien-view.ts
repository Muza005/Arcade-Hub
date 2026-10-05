// Инопланетяне и Течение — рисунок осложнений.
// Инопланетянин: зелёное тельце с фиолетовым глазом и тремя короткими фиолетовыми лучами-следом за ним
// (решение заказчика: след не длиннее пары сантиметров); прилипший — без следа, с усиками к кораблю.
// Течение: бледные чёрточки плывут через поле по течению — видно, куда сносит.
import { Graphics } from 'pixi.js';
import type { Rng } from '../../engine/rng';
import {
  ALIEN_BEAM,
  ALIEN_BODY,
  ALIEN_EYE,
  ALIEN_RADIUS,
  ALIEN_TRAIL_PX,
  CURRENT_STREAK_ALPHA,
  CURRENT_STREAK_PX,
  CURRENT_STREAKS,
  CURRENT_SHIP_ACCEL,
} from '../config';
import type { Alien } from '../game/aliens';
import type { Bounds, Vec } from '../game/ship';

const BEAMS = 3;
const BEAM_SPREAD = 0.35;
const WOBBLE_HZ = 6;
/** Чёрточки течения бегут быстрее кораблей, которых оно сносит. */
const STREAK_SPEED = CURRENT_SHIP_ACCEL;
const FADE_S = 0.6;

export interface AlienView {
  readonly view: Graphics;
  draw(list: readonly Alien[], alpha: number, timeS: number, ships: (id: string) => Vec | undefined): void;
}

export function createAlienView(): AlienView {
  const view = new Graphics();
  return {
    view,
    draw(list, alpha, timeS, ships) {
      view.clear();
      for (const a of list) {
        const x = a.prev.x + (a.pos.x - a.prev.x) * alpha;
        const y = a.prev.y + (a.pos.y - a.prev.y) * alpha;
        const wob = Math.sin(timeS * WOBBLE_HZ * Math.PI * 2 + a.id);
        if (!a.host) {
          // Лучи-след: против скорости, чуть расходятся и подрагивают.
          const v = Math.hypot(a.vel.x, a.vel.y) || 1;
          const back = Math.atan2(-a.vel.y, -a.vel.x);
          for (let i = 0; i < BEAMS; i++) {
            const t = back + (i - (BEAMS - 1) / 2) * BEAM_SPREAD + wob * 0.08;
            const len = ALIEN_TRAIL_PX * (i === 1 ? 1 : 0.7) * Math.min(1, v / 100);
            view.moveTo(x, y).lineTo(x + Math.cos(t) * len, y + Math.sin(t) * len);
          }
          view.stroke({ color: ALIEN_BEAM, width: 3, alpha: 0.55, cap: 'round' });
        } else {
          // Усики к кораблю.
          const host = ships(a.host);
          if (host) {
            view.moveTo(x, y).quadraticCurveTo((x + host.x) / 2 + wob * 4, (y + host.y) / 2 - wob * 4, host.x, host.y);
            view.stroke({ color: ALIEN_BEAM, width: 2, alpha: 0.6 });
          }
        }
        const r = ALIEN_RADIUS * (1 + wob * 0.06);
        view.circle(x, y, r * 1.8).fill({ color: ALIEN_BODY, alpha: 0.15 });
        view.circle(x, y, r).fill({ color: '#0B1A12' }).stroke({ color: ALIEN_BODY, width: 2.5 });
        view.circle(x, y, r * 0.45).fill({ color: ALIEN_EYE });
        view.circle(x + r * 0.12, y - r * 0.12, r * 0.15).fill({ color: '#FFFFFF' });
      }
    },
  };
}

export interface CurrentView {
  readonly view: Graphics;
  update(on: boolean, dir: Vec, dtS: number): void;
  draw(): void;
}

export function createCurrentView(rng: Rng, bounds: Bounds, color: string): CurrentView {
  const view = new Graphics();
  const w = bounds.right - bounds.left;
  const h = bounds.bottom - bounds.top;
  const streaks = Array.from({ length: CURRENT_STREAKS }, () => ({ u: rng.next(), v: rng.next(), k: rng.range(0.6, 1.4) }));
  let shift = 0;
  let k = 0;
  let dir: Vec = { x: 1, y: 0 };
  return {
    view,
    update(on, d, dtS) {
      k = Math.min(1, Math.max(0, k + (on ? dtS : -dtS) / FADE_S));
      if (on) dir = { x: d.x, y: d.y };
      shift += STREAK_SPEED * dtS;
    },
    draw() {
      view.clear();
      view.visible = k > 0;
      if (!view.visible) return;
      const len = dir.x !== 0 ? w : h;
      for (const s of streaks) {
        // Положение вдоль течения бежит и заворачивается; поперёк — своё.
        const along = (((s.u * len + shift * s.k) % len) + len) % len;
        const signed = (dir.x || dir.y) > 0 ? along : len - along;
        const x0 = dir.x !== 0 ? bounds.left + signed : bounds.left + s.v * w;
        const y0 = dir.y !== 0 ? bounds.top + signed : bounds.top + s.v * h;
        view.moveTo(x0, y0).lineTo(x0 - dir.x * CURRENT_STREAK_PX * s.k, y0 - dir.y * CURRENT_STREAK_PX * s.k);
      }
      view.stroke({ color, width: 2, alpha: CURRENT_STREAK_ALPHA * k, cap: 'round' });
    },
  };
}

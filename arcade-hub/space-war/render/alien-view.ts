// Инопланетяне и Течение — рисунок осложнений.
// Инопланетянин: зелёное тельце с фиолетовым глазом; за ним — неоновый фиолетовый след, который гаснет со временем
// (решение заказчика); прилипший новый след не оставляет, к кораблю тянутся усики.
// Течение: бледные чёрточки плывут через поле по течению — видно, куда сносит.
import { Graphics } from 'pixi.js';
import type { Rng } from '../../engine/rng';
import {
  ALIEN_BEAM,
  ALIEN_BODY,
  ALIEN_EYE,
  ALIEN_RADIUS,
  ALIEN_TRAIL_PX,
  ALIEN_TRAIL_S,
  CURRENT_STREAK_ALPHA,
  CURRENT_STREAK_PX,
  CURRENT_STREAKS,
  CURRENT_SHIP_ACCEL,
} from '../config';
import type { Alien } from '../game/aliens';
import type { Bounds, Vec } from '../game/ship';

const TRAIL_LAYERS = [
  { w: 2.6, a: 0.18 },
  { w: 1, a: 0.85 },
] as const;
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
  /** След каждого: точки с временем — старые тускнеют и тоньшают, потом пропадают. */
  const trails = new Map<number, Array<{ x: number; y: number; t: number }>>();
  return {
    view,
    draw(list, alpha, timeS, ships) {
      view.clear();
      const alive = new Set<number>();
      for (const a of list) {
        alive.add(a.id);
        const x = a.prev.x + (a.pos.x - a.prev.x) * alpha;
        const y = a.prev.y + (a.pos.y - a.prev.y) * alpha;
        const wob = Math.sin(timeS * WOBBLE_HZ * Math.PI * 2 + a.id);
        let trail = trails.get(a.id);
        if (!trail) trails.set(a.id, (trail = []));
        // Прилипший след не оставляет — старый догорает.
        if (!a.host) trail.push({ x, y, t: timeS });
        while (trail.length > 0 && timeS - (trail[0] as { t: number }).t > ALIEN_TRAIL_S) trail.shift();
        // Неоновый фиолетовый след: широкий бледный ореол и яркая линия, к хвосту тоньше и прозрачнее.
        for (const layer of TRAIL_LAYERS) {
          for (let i = 1; i < trail.length; i++) {
            const p0 = trail[i - 1] as { x: number; y: number; t: number };
            const p1 = trail[i] as { x: number; y: number; t: number };
            const k = 1 - (timeS - p1.t) / ALIEN_TRAIL_S;
            if (k <= 0) continue;
            view.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y);
            view.stroke({ color: ALIEN_BEAM, width: ALIEN_TRAIL_PX * k * layer.w, alpha: k * layer.a, cap: 'round' });
          }
        }
        if (a.host) {
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
      for (const id of trails.keys()) if (!alive.has(id)) trails.delete(id);
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

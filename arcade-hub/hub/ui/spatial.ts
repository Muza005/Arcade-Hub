// Пространственная навигация (ARCADE_HUB_SPEC §8): стрелка ведёт к ближайшему элементу в этом направлении.
import { NAV_CROSS_WEIGHT, NAV_EPSILON_PX, NAV_TIE_WEIGHT } from '../../shared/config';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Зазор между отрезками [a1, a2] и [b1, b2]; 0 — если перекрываются. */
function gap(a1: number, a2: number, b1: number, b2: number): number {
  return Math.max(0, b1 - a2, a1 - b2);
}

/**
 * Лучший кандидат в направлении dir или -1.
 * Кандидат должен лежать дальше по направлению (по центру). Цена — расстояние вдоль направления
 * между краями плюс взвешенный зазор поперёк: соседи в том же ряду или колонке выигрывают.
 */
export function pickNext(from: Box, candidates: readonly Box[], dir: Direction): number {
  const cx = (from.left + from.right) / 2;
  const cy = (from.top + from.bottom) / 2;
  let best = -1;
  let bestScore = Infinity;

  candidates.forEach((box, i) => {
    const bx = (box.left + box.right) / 2;
    const by = (box.top + box.bottom) / 2;
    let along: number;
    let cross: number;
    switch (dir) {
      case 'right':
        if (bx - cx < NAV_EPSILON_PX) return;
        along = Math.max(0, box.left - from.right);
        cross = gap(from.top, from.bottom, box.top, box.bottom);
        break;
      case 'left':
        if (cx - bx < NAV_EPSILON_PX) return;
        along = Math.max(0, from.left - box.right);
        cross = gap(from.top, from.bottom, box.top, box.bottom);
        break;
      case 'down':
        if (by - cy < NAV_EPSILON_PX) return;
        along = Math.max(0, box.top - from.bottom);
        cross = gap(from.left, from.right, box.left, box.right);
        break;
      case 'up':
        if (cy - by < NAV_EPSILON_PX) return;
        along = Math.max(0, from.top - box.bottom);
        cross = gap(from.left, from.right, box.left, box.right);
        break;
    }
    // При равенстве — ближе по центрам.
    const score = along + NAV_CROSS_WEIGHT * cross + Math.hypot(bx - cx, by - cy) * NAV_TIE_WEIGHT;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

// Геометрия корпусов (SPACE_WAR_SPEC §8) — одни данные для игры (PixiJS) и для иконок в лобби (SVG).
// Без графических библиотек: манифест грузится сразу и тянет только эти строки.
// Решение заказчика: 30 корпусов в пяти разделах по шесть, контуры — точь-в-точь из его макета
// (SVG-путь в квадрате 24×24, нос вверх). В игре тот же путь повёрнут носом вправо (угол 0).
// Хитбокс у всех один (SHIP_HITBOX_RADIUS); рисунок — только вид.
import type { Hull } from './config';

export const HULL_GROUPS = ['tri', 'round', 'facet', 'wing', 'special'] as const;
export type HullGroup = (typeof HULL_GROUPS)[number];

export interface HullShape {
  group: HullGroup;
  /** Контур из макета: SVG-путь, квадрат 24×24, центр (12, 12), нос вверх. */
  d: string;
  /** Поворот в игре, рад: у «Кометы» шар смотрит по диагонали — в полёте он впереди, лучи сзади. */
  tilt?: number;
}

/** Иконки и рисунок в игре: квадрат макета и толщина линии в нём. */
export const HULL_VIEW = 24;
export const HULL_CENTER = 12;
export const HULL_ICON_STROKE = 1.75;

export const HULL_SHAPES: Record<Hull, HullShape> = {
  // ─── Треугольные ───
  arrow: { group: 'tri', d: 'M12 3l7 17-7-4-7 4z' },
  spire: { group: 'tri', d: 'M12 3l5 8-3.5-1v8l2 3h-7l2-3v-8l-3.5 1z' },
  delta: { group: 'tri', d: 'M12 3l3 12 5 5-8-3-8 3 5-5z' },
  needle: { group: 'tri', d: 'M12 3l3.5 17-3.5-3-3.5 3z' },
  stealth: { group: 'tri', d: 'M12 4l9 13-5-2-4 4-4-4-5 2z' },
  chevron: { group: 'tri', d: 'M12 6l9 11-9-4-9 4z' },
  // ─── Круглые ───
  planet: { group: 'round', d: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM3.5 15.1a9 3 -20 1 0 17-6.2 9 3 -20 1 0-17 6.2z' },
  jelly: { group: 'round', d: 'M5 12a7 7 0 0 1 14 0zM8 12v6M12 12v8M16 12v6' },
  saucer: { group: 'round', d: 'M4 14c0-2 3.6-3.5 8-3.5s8 1.5 8 3.5-3.6 3.5-8 3.5-8-1.5-8-3.5zM8.5 11a3.5 3.5 0 0 1 7 0' },
  comet: { group: 'round', d: 'M15 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 12l-7 7M10.5 8.5L5 14M15.5 13.5L10 19', tilt: -Math.PI / 4 },
  arch: { group: 'round', d: 'M8 20v-7a4 4 0 0 1 8 0v7h3v-7a7 7 0 0 0-14 0v7z' },
  dome: { group: 'round', d: 'M5 17a8 8 0 1 1 14 0 9 9 0 0 0-14 0z' },
  // ─── Гранёные ───
  diamond: { group: 'facet', d: 'M12 3l6 9-6 9-6-9z' },
  gem: { group: 'facet', d: 'M12 3l5 6-5 12-5-12zM7 9h10' },
  crystal: { group: 'facet', d: 'M13 3l5 9-4 9-7-6 2-7zM13 3l-1 9 2 9' },
  prism: { group: 'facet', d: 'M12 3l4 5v11l-4 2-4-2V8zM8 8l4 2 4-2M12 10v11' },
  ark: { group: 'facet', d: 'M12 3l7 10-3 6H8l-3-6zM5 13h14M9 13l3-10 3 10' },
  tower: { group: 'facet', d: 'M12 3l3 5v13H9V8zM9 12l-4 2v7h4M15 12l4 2v7h-4' },
  // ─── Крылатые ───
  rocket: { group: 'wing', d: 'M12 3c2 2 3 5 3 8l4 6v2h-4l-1 2h-4l-1-2H5v-2l4-6c0-3 1-6 3-8z' },
  jet: { group: 'wing', d: 'M12 3l2 7 6 5v3l-6-2-2 4-2-4-6 2v-3l6-5z' },
  raptor: { group: 'wing', d: 'M12 3l2 9 7 6-9-2-9 2 7-6z' },
  starship: { group: 'wing', d: 'M12 3l2 6 7 3-6 2 1 6-4-3-4 3 1-6-6-2 7-3z' },
  nova: { group: 'wing', d: 'M12 3l1.5 6H21l-7.5 4 1 6-2.5-2-2.5 2 1-6L3 9h7.5z' },
  bat: { group: 'wing', d: 'M12 5l2 3 7-2c0 5-2 8-5 9l-2-2-2 4-2-4-2 2c-3-1-5-4-5-9l7 2z' },
  // ─── Особые ───
  spark: { group: 'special', d: 'M12 3c.8 5 2.5 7.5 9 9-6.5 1.5-8.2 4-9 9-.8-5-2.5-7.5-9-9 6.5-1.5 8.2-4 9-9z' },
  star: { group: 'special', d: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z' },
  bolt: { group: 'special', d: 'M13.5 3L6 13.5h5L9.5 21 18 10h-5z' },
  sword: { group: 'special', d: 'M12 3l2 3v9h3v2h-4v4h-2v-4H7v-2h3V6z' },
  cat: { group: 'special', d: 'M5 4l4 4h6l4-4v9a7 7 0 0 1-14 0z' },
  ghost: { group: 'special', d: 'M6 20v-9a6 6 0 0 1 12 0v9l-3-2-3 2-3-2z' },
};

/** Иконка корпуса как в макете (нос вверх); цвет — currentColor. */
export function hullSvg(hull: Hull): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${HULL_VIEW} ${HULL_VIEW}" fill="none" stroke="currentColor" ` +
    `stroke-width="${HULL_ICON_STROKE}" stroke-linejoin="round" stroke-linecap="round"><path d="${HULL_SHAPES[hull].d}"/></svg>`
  );
}

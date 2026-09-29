// Геометрия корпусов (SPACE_WAR_SPEC §8) — одни данные для игры (PixiJS) и для иконок в лобби (SVG).
// Без графических библиотек: манифест грузится сразу и тянет только эти числа.
// Нос — вправо (угол 0). Хитбокс у всех один (SHIP_HITBOX_RADIUS); рисунок — только вид.
import { SHIP_SIZE, SHIP_TAIL_K, type Hull } from './config';

export type HullGroup = 'tri' | 'round' | 'square' | 'star';

/** Часть рисунка: ломаная или окружность; fill — полупрозрачная заливка (доля непрозрачности). */
export type HullPart = { poly: number[]; fill?: number } | { circle: [number, number, number]; fill?: number };

export interface HullShape {
  group: HullGroup;
  parts: HullPart[];
  /** Корма: отсюда рисуется пламя тяги. */
  tail: number;
}

const S = SHIP_SIZE;
const T = S * SHIP_TAIL_K;
const R = S * 0.8; // радиус круглых корпусов
const HALF_FILL = 0.45;
const STEPS_HALF = 10; // точек на полуокружность заливки

/** Зубец-нос: у симметричных корпусов видно, куда летит корабль. */
const nose = (from: number): HullPart => ({ poly: [S, 0, from, -S * 0.22, from, S * 0.22] });

/** Звезда носом вправо. */
function star(points: number, outer: number, inner: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? outer : inner;
    out.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return out;
}

/** Половина круга (сторона левого борта) — заливка для «Полукруга». */
function halfDisc(r: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= STEPS_HALF; i++) {
    const a = Math.PI + (i / STEPS_HALF) * Math.PI;
    out.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return out;
}

const ARROW = [S, 0, -T, -T, -T * 0.45, 0, -T, T];
const DELTA = [S, 0, -T, -T, -T, T];
const DIAMOND = [S, 0, 0, -S * 0.72, -R, 0, 0, S * 0.72];

export const HULL_SHAPES: Record<Hull, HullShape> = {
  arrow: { group: 'tri', parts: [{ poly: ARROW }], tail: -T * 0.45 },
  delta: { group: 'tri', parts: [{ poly: DELTA }], tail: -T },
  wing: {
    group: 'tri',
    parts: [{ poly: [S, 0, -T * 0.35, -S * 0.32, -T, -S * 0.9, -T * 0.55, 0, -T, S * 0.9, -T * 0.35, S * 0.32] }],
    tail: -T * 0.55,
  },
  dart: { group: 'tri', parts: [{ poly: [S, 0, -T, -S * 0.45, -T * 0.55, 0, -T, S * 0.45] }], tail: -T * 0.55 },
  chevron: {
    group: 'tri',
    parts: [{ poly: ARROW }, { poly: [S * 0.3, 0, -T * 0.5, -T * 0.5, -T * 0.2, 0, -T * 0.5, T * 0.5] }],
    tail: -T * 0.45,
  },
  needle: { group: 'tri', parts: [{ poly: DELTA }, { poly: [S, 0, -T, 0, -T, T], fill: HALF_FILL }], tail: -T },
  ring: { group: 'round', parts: [{ circle: [0, 0, R] }, nose(R * 0.9)], tail: -R },
  core: { group: 'round', parts: [{ circle: [0, 0, R] }, { circle: [0, 0, S * 0.32] }, nose(R * 0.9)], tail: -R },
  half: { group: 'round', parts: [{ circle: [0, 0, R] }, { poly: halfDisc(R), fill: HALF_FILL }, nose(R * 0.9)], tail: -R },
  box: { group: 'square', parts: [{ poly: [S * 0.7, -S * 0.42, S * 0.7, S * 0.42, -S * 0.7, S * 0.7, -S * 0.7, -S * 0.7] }, nose(S * 0.7)], tail: -S * 0.7 },
  diamond: { group: 'square', parts: [{ poly: DIAMOND }], tail: -R },
  kite: { group: 'square', parts: [{ poly: DIAMOND }, { poly: [S, 0, 0, -S * 0.72, -R, 0], fill: HALF_FILL }], tail: -R },
  prism: { group: 'square', parts: [{ poly: DIAMOND }, { poly: [S * 0.45, 0, 0, -S * 0.34, -S * 0.4, 0, 0, S * 0.34] }], tail: -R },
  star5: { group: 'star', parts: [{ poly: star(5, S, S * 0.45) }], tail: -S * 0.45 },
  star4: { group: 'star', parts: [{ poly: star(4, S, S * 0.4) }], tail: -S * 0.4 },
};

const ICON_VIEW = S + 4;
const ICON_STROKE = 3.5;
const r2 = (v: number): string => String(Math.round(v * 100) / 100);

/** Иконка корпуса носом вверх; цвет — currentColor. */
export function hullSvg(hull: Hull): string {
  const parts = HULL_SHAPES[hull].parts.map((p) => {
    const fill = p.fill ? `fill="currentColor" fill-opacity="${p.fill}" stroke="none"` : '';
    if ('circle' in p) return `<circle cx="${r2(p.circle[0])}" cy="${r2(p.circle[1])}" r="${r2(p.circle[2])}" ${fill}/>`;
    const pts = [];
    for (let i = 0; i < p.poly.length; i += 2) pts.push(`${r2(p.poly[i] ?? 0)},${r2(p.poly[i + 1] ?? 0)}`);
    return `<polygon points="${pts.join(' ')}" ${fill}/>`;
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-ICON_VIEW} ${-ICON_VIEW} ${ICON_VIEW * 2} ${ICON_VIEW * 2}" ` +
    `fill="none" stroke="currentColor" stroke-width="${ICON_STROKE}" stroke-linejoin="round">` +
    `<g transform="rotate(-90)">${parts.join('')}</g></svg>`
  );
}

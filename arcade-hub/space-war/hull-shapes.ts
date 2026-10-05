// Геометрия корпусов (SPACE_WAR_SPEC §8) — одни данные для игры (PixiJS) и для иконок в лобби (SVG).
// Без графических библиотек: манифест грузится сразу и тянет только эти числа.
// Решение заказчика: 30 корпусов в пяти разделах по шесть — треугольные, круглые, гранёные, крылатые, особые.
// Рисуем как на иконке — носом вверх, в долях SHIP_SIZE (u — вправо, v — вниз); в игре нос — вправо (угол 0).
// Хитбокс у всех один (SHIP_HITBOX_RADIUS); рисунок — только вид.
import { SHIP_SIZE, type Hull } from './config';

export const HULL_GROUPS = ['tri', 'round', 'facet', 'wing', 'special'] as const;
export type HullGroup = (typeof HULL_GROUPS)[number];

/** Часть рисунка: замкнутый контур, открытая линия или окружность; fill — полупрозрачная заливка. */
export type HullPart =
  | { poly: number[]; fill?: number }
  | { line: number[] }
  | { circle: [number, number, number]; fill?: number };

export interface HullShape {
  group: HullGroup;
  parts: HullPart[];
  /** Корма: отсюда рисуется пламя тяги. */
  tail: number;
}

const S = SHIP_SIZE;
const ARC_STEPS = 12;

/** Точки «как на иконке» (u, v — доли размера, нос вверх) → координаты корабля (нос вправо). */
const pts = (...uv: number[]): number[] => {
  const out: number[] = [];
  for (let i = 0; i < uv.length; i += 2) out.push(-(uv[i + 1] ?? 0) * S, (uv[i] ?? 0) * S);
  return out;
};
const poly = (...uv: number[]): HullPart => ({ poly: pts(...uv) });
const line = (...uv: number[]): HullPart => ({ line: pts(...uv) });
const circle = (u: number, v: number, r: number): HullPart => ({ circle: [-v * S, u * S, r * S] });

/** Дуга (u, v, r) от угла a0 до a1 (радианы, 0 — вправо, по часовой на иконке) — точки для контура. */
function arc(u: number, v: number, r: number, a0: number, a1: number, steps = ARC_STEPS): number[] {
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push(u + Math.cos(a) * r, v + Math.sin(a) * r);
  }
  return out;
}

/** Эллипс с наклоном — точки замкнутого контура. */
function ellipse(rx: number, ry: number, tilt: number, steps = ARC_STEPS * 2): number[] {
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push(x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt));
  }
  return out;
}

/** Звезда носом вверх. */
function star(points: number, outer: number, inner: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? outer : inner;
    out.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return out;
}

const HALF = Math.PI;

/** Корма — самая нижняя точка рисунка на иконке. */
function shape(group: HullGroup, parts: HullPart[]): HullShape {
  let tail = 0;
  for (const p of parts) {
    if ('circle' in p) tail = Math.min(tail, p.circle[0] - p.circle[2]);
    else {
      const xs = 'poly' in p ? p.poly : p.line;
      for (let i = 0; i < xs.length; i += 2) tail = Math.min(tail, xs[i] ?? 0);
    }
  }
  return { group, parts, tail };
}

export const HULL_SHAPES: Record<Hull, HullShape> = {
  // ─── Треугольные ───
  arrow: shape('tri', [poly(0, -1, 0.62, 0.72, 0, 0.32, -0.62, 0.72)]),
  spire: shape('tri', [poly(0, -1, 0.42, -0.45, 0.16, -0.45, 0.16, 0.5, 0.4, 0.95, 0, 0.75, -0.4, 0.95, -0.16, 0.5, -0.16, -0.45, -0.42, -0.45)]),
  delta: shape('tri', [poly(0, -1, 0.16, 0.25, 0.8, 0.8, 0, 0.55, -0.8, 0.8, -0.16, 0.25)]),
  needle: shape('tri', [poly(0, -1, 0.26, 0.9, 0, 0.62, -0.26, 0.9), line(0, -0.55, 0, 0.6)]),
  stealth: shape('tri', [poly(0, -0.65, 0.95, 0.35, 0.45, 0.35, 0, -0.05, -0.45, 0.35, -0.95, 0.35), line(-0.45, 0.35, 0, 0.05, 0.45, 0.35)]),
  chevron: shape('tri', [poly(0, -0.55, 1, 0.35, 0.72, 0.5, 0, -0.08, -0.72, 0.5, -1, 0.35)]),
  // ─── Круглые ───
  planet: shape('round', [circle(0, 0, 0.5), { poly: pts(...ellipse(0.98, 0.3, -0.45)) }]),
  jelly: shape('round', [
    poly(...arc(0, 0.05, 0.72, HALF, HALF * 2), 0.72, 0.05),
    line(-0.4, 0.05, -0.45, 0.85),
    line(0, 0.05, 0, 0.95),
    line(0.4, 0.05, 0.45, 0.85),
  ]),
  saucer: shape('round', [{ poly: pts(...ellipse(0.98, 0.34, 0)) }, poly(...arc(0, -0.1, 0.45, HALF, HALF * 2))]),
  comet: shape('round', [circle(0.32, -0.42, 0.4), line(-0.02, -0.35, -0.8, 0.43), line(0.12, -0.12, -0.65, 0.78), line(0.35, -0.02, -0.25, 0.6)]),
  arch: shape('round', [poly(...arc(0, 0, 0.82, HALF, HALF * 2), 0.82, 0.85, 0.4, 0.85, 0.4, 0, ...arc(0, 0, 0.4, 0, -HALF), -0.4, 0.85, -0.82, 0.85)]),
  dome: shape('round', [poly(...arc(0, 0.3, 0.9, HALF, HALF * 2), ...arc(0, 1.4, 1.42, -0.885, -2.256))]),
  // ─── Гранёные ───
  diamond: shape('facet', [poly(0, -1, 0.58, 0, 0, 1, -0.58, 0)]),
  gem: shape('facet', [poly(-0.5, -0.65, 0.5, -0.65, 0.68, -0.3, 0, 1, -0.68, -0.3), line(-0.68, -0.3, 0.68, -0.3), line(-0.2, -0.65, 0, 1, 0.2, -0.65)]),
  crystal: shape('facet', [poly(0, -1, 0.42, -0.35, 0.26, 0.85, -0.26, 0.85, -0.42, -0.35), line(0, -1, 0.05, 0.85)]),
  prism: shape('facet', [poly(0, -1, 0.45, -0.7, 0.45, 0.7, 0, 1, -0.45, 0.7, -0.45, -0.7), line(-0.45, -0.7, 0, -0.4, 0.45, -0.7), line(0, -0.4, 0, 1)]),
  ark: shape('facet', [poly(-0.8, -0.05, 0.8, -0.05, 0.5, 0.65, -0.5, 0.65), poly(0, -0.9, 0.45, -0.05, -0.45, -0.05)]),
  tower: shape('facet', [poly(0, -1, 0.22, -0.6, 0.22, -0.05, 0.6, 0.2, 0.6, 0.9, -0.6, 0.9, -0.6, 0.2, -0.22, -0.05, -0.22, -0.6)]),
  // ─── Крылатые ───
  rocket: shape('wing', [poly(0, -1, 0.3, -0.5, 0.3, 0.4, 0.62, 0.85, 0.15, 0.72, -0.15, 0.72, -0.62, 0.85, -0.3, 0.4, -0.3, -0.5)]),
  jet: shape('wing', [poly(0, -1, 0.16, -0.35, 0.92, 0.32, 0.16, 0.22, 0.32, 0.85, 0, 0.65, -0.32, 0.85, -0.16, 0.22, -0.92, 0.32, -0.16, -0.35)]),
  raptor: shape('wing', [poly(0, -1, 0.17, 0.2, 0.98, 0.72, 0.12, 0.55, 0, 0.85, -0.12, 0.55, -0.98, 0.72, -0.17, 0.2)]),
  starship: shape('wing', [{ poly: pts(...star(5, 1, 0.48)) }]),
  nova: shape('wing', [{ poly: pts(...star(5, 1, 0.3)) }, circle(0, 0.05, 0.16)]),
  bat: shape('wing', [poly(0, -0.4, 0.3, -0.65, 0.98, -0.45, 0.78, 0.05, 0.45, 0.05, 0.3, 0.45, 0, 0.25, -0.3, 0.45, -0.45, 0.05, -0.78, 0.05, -0.98, -0.45, -0.3, -0.65)]),
  // ─── Особые ───
  spark: shape('special', [{ poly: pts(...star(4, 1, 0.3)) }]),
  star: shape('special', [{ poly: pts(...star(5, 1, 0.45)) }]),
  bolt: shape('special', [poly(0.2, -1, -0.55, 0.12, 0, 0.12, -0.2, 1, 0.55, -0.12, 0, -0.12)]),
  sword: shape('special', [poly(0, -1, 0.13, -0.82, 0.13, 0.3, 0.45, 0.3, 0.45, 0.47, 0.13, 0.47, 0.13, 0.85, 0, 1, -0.13, 0.85, -0.13, 0.47, -0.45, 0.47, -0.45, 0.3, -0.13, 0.3, -0.13, -0.82)]),
  cat: shape('special', [poly(-0.72, -0.9, -0.3, -0.52, 0.3, -0.52, 0.72, -0.9, 0.76, 0.15, 0.5, 0.65, 0, 0.85, -0.5, 0.65, -0.76, 0.15)]),
  ghost: shape('special', [poly(...arc(0, -0.15, 0.66, HALF, HALF * 2), 0.66, 0.9, 0.33, 0.62, 0, 0.9, -0.33, 0.62, -0.66, 0.9)]),
};

const ICON_VIEW = S + 4;
const ICON_STROKE = 3.5;
const r2 = (v: number): string => String(Math.round(v * 100) / 100);
const pointList = (xs: number[]): string => {
  const out = [];
  for (let i = 0; i < xs.length; i += 2) out.push(`${r2(xs[i] ?? 0)},${r2(xs[i + 1] ?? 0)}`);
  return out.join(' ');
};

/** Иконка корпуса носом вверх; цвет — currentColor. */
export function hullSvg(hull: Hull): string {
  const parts = HULL_SHAPES[hull].parts.map((p) => {
    if ('line' in p) return `<polyline points="${pointList(p.line)}"/>`;
    const fill = p.fill ? `fill="currentColor" fill-opacity="${p.fill}" stroke="none"` : '';
    if ('circle' in p) return `<circle cx="${r2(p.circle[0])}" cy="${r2(p.circle[1])}" r="${r2(p.circle[2])}" ${fill}/>`;
    return `<polygon points="${pointList(p.poly)}" ${fill}/>`;
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-ICON_VIEW} ${-ICON_VIEW} ${ICON_VIEW * 2} ${ICON_VIEW * 2}" ` +
    `fill="none" stroke="currentColor" stroke-width="${ICON_STROKE}" stroke-linejoin="round" stroke-linecap="round">` +
    `<g transform="rotate(-90)">${parts.join('')}</g></svg>`
  );
}

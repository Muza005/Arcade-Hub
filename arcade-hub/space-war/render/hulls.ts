// Рисунок корпуса в PixiJS по общим данным (hull-shapes.ts): контур одной обводкой, заливки полупрозрачные.
import type { Graphics } from 'pixi.js';
import type { Hull } from '../config';
import { HULL_SHAPES } from '../hull-shapes';

export const HULL_TAIL_X = Object.fromEntries(Object.entries(HULL_SHAPES).map(([k, v]) => [k, v.tail])) as Record<Hull, number>;

export interface HullStroke {
  color: string;
  width: number;
  alpha: number;
  join: 'round';
}

export function drawHull(g: Graphics, hull: Hull, stroke: HullStroke): Graphics {
  for (const part of HULL_SHAPES[hull].parts) {
    if ('circle' in part) g.circle(part.circle[0], part.circle[1], part.circle[2]);
    else g.poly(part.poly);
    if (part.fill) g.fill({ color: stroke.color, alpha: part.fill * stroke.alpha });
    else g.stroke(stroke);
  }
  return g;
}

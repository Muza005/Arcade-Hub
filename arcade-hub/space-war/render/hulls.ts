// Рисунок корпуса в PixiJS по общим данным (hull-shapes.ts): контур из макета одной обводкой.
// Путь рисуется в координатах макета (24×24, нос вверх), а сама графика повёрнута носом вправо и
// масштабирована так, что нос — на SHIP_SIZE от центра. Поворот дуг PixiJS матрицей не умеет — поэтому
// поворачиваем не путь, а графику; толщина линии делится на масштаб.
import { Graphics, GraphicsPath } from 'pixi.js';
import { HULLS, SHIP_SIZE, type Hull } from '../config';
import { HULL_CENTER, HULL_SHAPES } from '../hull-shapes';

/** Нос макета — y = 3: на 9 единиц выше центра. */
const NOSE_UNITS = 9;
const SCALE = SHIP_SIZE / NOSE_UNITS;

const PATHS = Object.fromEntries(HULLS.map((h) => [h, new GraphicsPath(HULL_SHAPES[h].d)])) as Record<Hull, GraphicsPath>;

/** Корма в координатах корабля (нос вправо): самая дальняя назад точка рисунка — отсюда пламя. */
function tailOf(hull: Hull): number {
  const g = new Graphics().path(PATHS[hull]).stroke({ width: 1 });
  const b = g.getLocalBounds();
  g.destroy();
  const tilt = HULL_SHAPES[hull].tilt ?? 0;
  // Углы рамки, повёрнутые на наклон; корма — наибольшая «глубина» вниз по макету.
  let back = 0;
  for (const [u, v] of [[b.minX, b.minY], [b.maxX, b.minY], [b.minX, b.maxY], [b.maxX, b.maxY]] as const) {
    const du = u - HULL_CENTER;
    const dv = v - HULL_CENTER;
    back = Math.max(back, du * Math.sin(tilt) + dv * Math.cos(tilt));
  }
  return -back * SCALE;
}

export const HULL_TAIL_X = Object.fromEntries(HULLS.map((h) => [h, tailOf(h)])) as Record<Hull, number>;

export interface HullStroke {
  color: string;
  width: number;
  alpha: number;
  join: 'round';
}

export function drawHull(g: Graphics, hull: Hull, stroke: HullStroke): Graphics {
  g.pivot.set(HULL_CENTER, HULL_CENTER);
  g.scale.set(SCALE);
  g.rotation = Math.PI / 2 + (HULL_SHAPES[hull].tilt ?? 0);
  return g.path(PATHS[hull]).stroke({ ...stroke, width: stroke.width / SCALE, cap: 'round' });
}

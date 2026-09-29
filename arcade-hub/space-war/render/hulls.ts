// Формы корпуса (SPACE_WAR_SPEC §8): треугольник (стрела, дельта, крыло), круг (кольцо, ядро),
// квадрат (короб, ромб), звезда (пять и четыре луча). Нос — вправо (угол 0); у круглых и квадратного
// корпуса направление показывает маленький зубец спереди. Хитбокс у всех один (SHIP_HITBOX_RADIUS).
import type { Graphics, StrokeInput } from 'pixi.js';
import { SHIP_SIZE, SHIP_TAIL_K, type Hull } from '../config';

const S = SHIP_SIZE;
const T = S * SHIP_TAIL_K;
const ROUND_K = 0.8; // радиус кольца и ядра
const CORE_K = 0.32; // внутренний круг ядра
const BOX_K = 0.68; // половина стороны короба
const STAR5_INNER = 0.45;
const STAR4_INNER = 0.4;
/** Звезда Pixi рисует первый луч вверх; поворот ставит его носом вправо. */
const STAR_TURN = Math.PI / 2;

/** Зубец-нос: у симметричных корпусов видно, куда летит корабль. */
const nose = (from: number): number[] => [S, 0, from, -S * 0.22, from, S * 0.22];

const POLYS: Partial<Record<Hull, number[]>> = {
  arrow: [S, 0, -T, -T, -T * 0.45, 0, -T, T],
  delta: [S, 0, -T, -T, -T, T],
  wing: [S, 0, -T * 0.35, -S * 0.32, -T, -S * 0.9, -T * 0.55, 0, -T, S * 0.9, -T * 0.35, S * 0.32],
  diamond: [S, 0, 0, -S * 0.72, -S * ROUND_K, 0, 0, S * 0.72],
};

/** Откуда рисовать пламя тяги (корма), по оси X. */
export const HULL_TAIL_X: Record<Hull, number> = {
  arrow: -T * 0.45,
  delta: -T,
  wing: -T * 0.55,
  ring: -S * ROUND_K,
  core: -S * ROUND_K,
  box: -S * BOX_K,
  diamond: -S * ROUND_K,
  star5: -S * STAR5_INNER,
  star4: -S * STAR4_INNER,
};

/** Контур корпуса одной обводкой. */
export function drawHull(g: Graphics, hull: Hull, stroke: StrokeInput): Graphics {
  const poly = POLYS[hull];
  if (poly) return g.poly(poly).stroke(stroke);
  switch (hull) {
    case 'ring':
      return g.circle(0, 0, S * ROUND_K).stroke(stroke).poly(nose(S * ROUND_K * 0.9)).stroke(stroke);
    case 'core':
      return g
        .circle(0, 0, S * ROUND_K)
        .stroke(stroke)
        .circle(0, 0, S * CORE_K)
        .stroke(stroke)
        .poly(nose(S * ROUND_K * 0.9))
        .stroke(stroke);
    case 'box':
      return g
        .rect(-S * BOX_K, -S * BOX_K, S * BOX_K * 2, S * BOX_K * 2)
        .stroke(stroke)
        .poly(nose(S * BOX_K))
        .stroke(stroke);
    case 'star5':
      return g.star(0, 0, 5, S, S * STAR5_INNER, STAR_TURN).stroke(stroke);
    default:
      return g.star(0, 0, 4, S, S * STAR4_INNER, STAR_TURN).stroke(stroke);
  }
}

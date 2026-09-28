// Вид корабля: неоновый контур в цвет игрока с мягким свечением, язычок тяги и ник над кораблём.
// Корпус рисуется носом вправо (угол 0) и поворачивается целиком; ник не поворачивается.
import { Container, Graphics, Text } from 'pixi.js';
import {
  FLAME_ALPHA,
  FLAME_LENGTH,
  FLAME_WIDTH_K,
  NICK_ALPHA,
  NICK_FONT_PX,
  NICK_GAP_PX,
  SHIP_GLOW_ALPHA,
  SHIP_GLOW_PX,
  SHIP_LINE_PX,
  SHIP_SIZE,
  SHIP_TAIL_K,
} from '../config';

export interface ShipView {
  readonly node: Container;
  /** Положение, поворот носа и тяга 0…1. */
  set(x: number, y: number, angle: number, thrust: number): void;
  /** Поле: ник у стены не уходит за край, у верхней — встаёт под корабль. */
  setBounds(bounds: { left: number; top: number; right: number }): void;
  paint(color: string, nick: string): void;
}

const FONT_UI = 'Golos Text';
const FONT_FALLBACK = 'sans-serif';

/** Треугольник-стрелка: нос в (SHIP_SIZE, 0), корма с выемкой. */
function hullPoints(): number[] {
  const s = SHIP_SIZE;
  const tail = s * SHIP_TAIL_K;
  return [s, 0, -tail, -tail, -tail * 0.45, 0, -tail, tail];
}

export function createShipView(textColor: string): ShipView {
  const node = new Container();
  const body = new Container();
  const flame = new Graphics();
  const hull = new Graphics();
  body.addChild(flame, hull);
  const nick = new Text({
    text: '',
    style: { fontFamily: [FONT_UI, FONT_FALLBACK], fontWeight: '600', fontSize: NICK_FONT_PX, fill: textColor },
  });
  nick.anchor.set(0.5, 1);
  nick.alpha = NICK_ALPHA;
  nick.y = -SHIP_SIZE - NICK_GAP_PX;
  node.addChild(body, nick);

  let color = textColor;
  let bounds = { left: -Infinity, top: -Infinity, right: Infinity };
  const above = -SHIP_SIZE - NICK_GAP_PX;
  const tailX = -SHIP_SIZE * SHIP_TAIL_K * 0.45;

  return {
    node,
    set(x, y, angle, thrust) {
      node.position.set(x, y);
      body.rotation = angle;
      const half = nick.width / 2;
      nick.x = Math.min(Math.max(0, bounds.left + half - x), bounds.right - half - x);
      const flip = y + above - nick.height < bounds.top;
      nick.anchor.y = flip ? 0 : 1;
      nick.y = flip ? -above : above;
      flame.clear();
      if (thrust <= 0) return;
      const len = FLAME_LENGTH * thrust;
      const w = SHIP_SIZE * FLAME_WIDTH_K;
      flame.poly([tailX, -w / 2, tailX - len, 0, tailX, w / 2]).fill({ color, alpha: FLAME_ALPHA * thrust });
    },
    setBounds(next) {
      bounds = next;
    },
    paint(nextColor, nextNick) {
      color = nextColor;
      nick.text = nextNick;
      const points = hullPoints();
      hull
        .clear()
        .poly(points)
        .stroke({ color, width: SHIP_GLOW_PX, alpha: SHIP_GLOW_ALPHA, join: 'round' })
        .poly(points)
        .stroke({ color, width: SHIP_LINE_PX, join: 'round' });
    },
  };
}

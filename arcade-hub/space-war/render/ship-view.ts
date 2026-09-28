// Вид корабля: неоновый контур в цвет игрока, язычок тяги, жизни точками, ник и множитель над кораблём.
// Корпус рисуется носом вправо (угол 0) и поворачивается целиком; подписи не поворачиваются.
// Множитель (SPACE_WAR_SPEC §5 «Показ множителя»): цифра только с ×2, корпус ярче по ступеням, с ×3 — свечение.
import { Container, Graphics, Text } from 'pixi.js';
import {
  FLAME_ALPHA,
  FLAME_LENGTH,
  FLAME_WIDTH_K,
  HUD_POP_S,
  HUD_POP_SCALE,
  INVULN_ALPHA,
  LIVES_LOST_ALPHA,
  LIVES_PIP_GAP,
  LIVES_PIP_RADIUS,
  LIVES_Y,
  MULT_FONT_PX,
  MULT_GAP_PX,
  MULT_GLOW_ALPHA,
  MULT_GLOW_PX,
  MULT_HULL_ALPHA,
  NICK_ALPHA,
  NICK_FONT_PX,
  NICK_GAP_PX,
  SHIP_LINE_PX,
  SHIP_SIZE,
  SHIP_TAIL_K,
} from '../config';

export interface ShipView {
  readonly node: Container;
  /** Положение, поворот носа и тяга 0…1. */
  set(x: number, y: number, angle: number, thrust: number): void;
  /** Поле: подписи у стены не уходят за край, у верхней — встают под корабль. */
  setBounds(bounds: { left: number; top: number; right: number }): void;
  paint(color: string, nick: string): void;
  /** Жизни точками под кораблём. */
  setLives(lives: number, max: number): void;
  /** Мигание неуязвимости. */
  setBlink(dim: boolean): void;
  /** Ступень множителя ×1…×5. */
  setMult(mult: number): void;
  /** Анимации подписи — по шагам симуляции. */
  update(dtS: number): void;
}

const FONT_UI = 'Golos Text';
const FONT_DISPLAY = 'Unbounded';
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
  const glow = new Graphics();
  const hull = new Graphics();
  body.addChild(flame, glow, hull);
  const pips = new Graphics();
  pips.y = LIVES_Y;
  const label = new Container();
  const nick = new Text({
    text: '',
    style: { fontFamily: [FONT_UI, FONT_FALLBACK], fontWeight: '600', fontSize: NICK_FONT_PX, fill: textColor },
  });
  nick.anchor.set(0, 1);
  nick.alpha = NICK_ALPHA;
  const multText = new Text({
    text: '',
    style: { fontFamily: [FONT_DISPLAY, FONT_FALLBACK], fontWeight: '700', fontSize: MULT_FONT_PX, fill: textColor },
  });
  multText.anchor.set(0.5, 1);
  label.addChild(nick, multText);
  node.addChild(body, pips, label);

  const points = hullPoints();
  const tailX = -SHIP_SIZE * SHIP_TAIL_K * 0.45;
  const above = -SHIP_SIZE - NICK_GAP_PX;
  let color = textColor;
  let bounds = { left: -Infinity, top: -Infinity, right: Infinity };
  let lastLives = -1;
  let maxLives = 0;
  let mult = 1;
  let pop = 0;

  const drawPips = (): void => {
    const step = LIVES_PIP_RADIUS * 2 + LIVES_PIP_GAP;
    const x0 = (-(maxLives - 1) * step) / 2;
    pips.clear();
    for (let i = 0; i < maxLives; i++) {
      pips.circle(x0 + i * step, 0, LIVES_PIP_RADIUS).fill({ color, alpha: i < lastLives ? 1 : LIVES_LOST_ALPHA });
    }
  };

  const drawHull = (): void => {
    const i = mult - 1;
    glow
      .clear()
      .poly(points)
      .stroke({ color, width: MULT_GLOW_PX[i] ?? SHIP_LINE_PX, alpha: MULT_GLOW_ALPHA[i] ?? 0, join: 'round' });
    hull.clear().poly(points).stroke({ color, width: SHIP_LINE_PX, alpha: MULT_HULL_ALPHA[i] ?? 1, join: 'round' });
  };

  /** Ник и цифра множителя одной строкой по центру над кораблём. */
  const layoutLabel = (): void => {
    const showMult = mult >= 2;
    multText.visible = showMult;
    const multW = showMult ? multText.width + MULT_GAP_PX : 0;
    const total = nick.width + multW;
    nick.x = -total / 2;
    multText.x = nick.x + nick.width + MULT_GAP_PX + multText.width / 2;
  };

  return {
    node,
    set(x, y, angle, thrust) {
      node.position.set(x, y);
      body.rotation = angle;
      const half = label.width / 2;
      label.x = Math.min(Math.max(0, bounds.left + half - x), bounds.right - half - x);
      const flip = y + above - label.height < bounds.top;
      label.y = flip ? -above + label.height : above;
      multText.scale.set(1 + HUD_POP_SCALE * pop);
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
      nick.style.fill = color;
      multText.style.fill = color;
      drawHull();
      layoutLabel();
      if (maxLives > 0) drawPips();
    },
    setLives(lives, max) {
      if (lives === lastLives && max === maxLives) return;
      lastLives = lives;
      maxLives = max;
      drawPips();
    },
    setBlink(dim) {
      body.alpha = dim ? INVULN_ALPHA : 1;
    },
    setMult(next) {
      if (next === mult) return;
      if (next > mult) pop = 1;
      mult = next;
      multText.text = `×${mult}`;
      drawHull();
      layoutLabel();
    },
    update(dtS) {
      pop = Math.max(0, pop - dtS / HUD_POP_S);
    },
  };
}

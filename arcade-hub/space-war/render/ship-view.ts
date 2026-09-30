// Вид корабля: неоновый контур в цвет игрока, язычок тяги, жизни точками, цифра множителя над кораблём.
// Корпус рисуется носом вправо (угол 0) и поворачивается целиком; подписи не поворачиваются.
// Множитель (SPACE_WAR_SPEC §5 «Показ множителя»): цифра только с ×2, корпус ярче по ступеням, с ×3 — свечение.
import { Container, Graphics, Text } from 'pixi.js';
import {
  FLAME_ALPHA,
  FLAME_LENGTH,
  FLAME_WIDTH_K,
  HUD_POP_S,
  HUD_POP_SCALE,
  GHOST_ALPHA,
  INVULN_ALPHA,
  LIVES_LOST_ALPHA,
  LIVES_PIP_GAP,
  LIVES_PIP_RADIUS,
  LIVES_Y,
  MULT_FONT_PX,
  MULT_GLOW_ALPHA,
  MULT_GLOW_PX,
  MULT_HULL_ALPHA,
  LABEL_GAP_PX,
  OVERLOAD_COLOR,
  POWERUP_COLOR,
  SHIELD_ALPHA,
  SHIELD_LINE_PX,
  SHIELD_RADIUS_K,
  SHIP_LINE_PX,
  SHIP_SIZE,
  type Hull,
} from '../config';
import { drawHull, HULL_TAIL_X } from './hulls';

export interface ShipView {
  /** Корпус и пламя — в слой свечения. */
  readonly node: Container;
  /** Цифра множителя и жизни — отдельным слоем без bloom, чтобы оставались чёткими. */
  readonly tag: Container;
  setVisible(visible: boolean): void;
  /** Положение, поворот носа и тяга 0…1. */
  set(x: number, y: number, angle: number, thrust: number): void;
  /** Поле: подписи у стены не уходят за край, у верхней — встают под корабль. */
  setBounds(bounds: { left: number; top: number; right: number }): void;
  paint(color: string, hull: Hull): void;
  /** Жизни точками под кораблём. */
  setLives(lives: number, max: number): void;
  /** Мигание неуязвимости. */
  setBlink(dim: boolean): void;
  /** Призрак: полупрозрачный корпус, без подписи. */
  setGhost(ghost: boolean): void;
  /** Ступень множителя ×1…×5. */
  setMult(mult: number): void;
  /** Перегрузка: цвет корпуса и пламени (бордовый, к концу тускнеет) и значок «×2»; null — нет. */
  setOverload(hullColor: string | null): void;
  /** Пузырь щита; blink — последние секунды мигает. */
  setShield(on: boolean, blink: boolean): void;
  /** Анимации подписи — по шагам симуляции. */
  update(dtS: number): void;
}

const FONT_DISPLAY = 'Unbounded';
const FONT_FALLBACK = 'sans-serif';


export function createShipView(textColor: string): ShipView {
  const node = new Container();
  const body = new Container();
  const flame = new Graphics();
  const glow = new Graphics();
  const outline = new Graphics();
  body.addChild(flame, glow, outline);
  const pips = new Graphics();
  pips.y = LIVES_Y;
  const label = new Container();
  const multText = new Text({
    text: '',
    style: { fontFamily: [FONT_DISPLAY, FONT_FALLBACK], fontWeight: '700', fontSize: MULT_FONT_PX, fill: textColor },
  });
  multText.anchor.set(0.5, 1);
  // «×5 ×2»: значок Перегрузки — отдельно от накопленного множителя, бордовым.
  const overText = new Text({
    text: '×2',
    style: { fontFamily: [FONT_DISPLAY, FONT_FALLBACK], fontWeight: '700', fontSize: MULT_FONT_PX, fill: OVERLOAD_COLOR },
  });
  overText.anchor.set(0.5, 1);
  overText.visible = false;
  label.addChild(multText, overText);
  const shield = new Graphics().circle(0, 0, SHIP_SIZE * SHIELD_RADIUS_K);
  shield.visible = false;
  node.addChild(body, shield);
  const tag = new Container();
  tag.addChild(pips, label);

  let hull: Hull = 'arrow';
  const above = -SHIP_SIZE - LABEL_GAP_PX;
  let color = textColor;
  let bounds = { left: -Infinity, top: -Infinity, right: Infinity };
  let lastLives = -1;
  let maxLives = 0;
  let mult = 1;
  let pop = 0;
  /** Цвет корпуса поверх цвета игрока (Перегрузка). */
  let hullColor: string | null = null;

  const drawPips = (): void => {
    const step = LIVES_PIP_RADIUS * 2 + LIVES_PIP_GAP;
    const x0 = (-(maxLives - 1) * step) / 2;
    pips.clear();
    for (let i = 0; i < maxLives; i++) {
      pips.circle(x0 + i * step, 0, LIVES_PIP_RADIUS).fill({ color, alpha: i < lastLives ? 1 : LIVES_LOST_ALPHA });
    }
  };

  const repaint = (): void => {
    const i = mult - 1;
    const tint = hullColor ?? color;
    drawHull(glow.clear(), hull, { color: tint, width: MULT_GLOW_PX[i] ?? SHIP_LINE_PX, alpha: MULT_GLOW_ALPHA[i] ?? 0, join: 'round' });
    drawHull(outline.clear(), hull, { color: tint, width: SHIP_LINE_PX, alpha: MULT_HULL_ALPHA[i] ?? 1, join: 'round' });
  };

  /** Над кораблём — только цифра множителя, с ×2 (ников в игре нет: игрока находят по цвету). */
  const layoutLabel = (): void => {
    multText.visible = mult >= 2;
    overText.visible = hullColor !== null;
    // Обе цифры — рядом по центру; одна — по центру.
    const gap = MULT_FONT_PX / 3;
    if (multText.visible && overText.visible) {
      multText.x = -(overText.width + gap) / 2;
      overText.x = (multText.width + gap) / 2;
    } else {
      multText.x = 0;
      overText.x = 0;
    }
  };

  return {
    node,
    tag,
    setVisible(visible) {
      node.visible = visible;
      tag.visible = visible;
    },
    set(x, y, angle, thrust) {
      node.position.set(x, y);
      tag.position.set(x, y);
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
      const tailX = HULL_TAIL_X[hull];
      flame.poly([tailX, -w / 2, tailX - len, 0, tailX, w / 2]).fill({ color: hullColor ?? color, alpha: FLAME_ALPHA * thrust });
    },
    setBounds(next) {
      bounds = next;
    },
    paint(nextColor, nextHull) {
      color = nextColor;
      hull = nextHull;
      multText.style.fill = color;
      repaint();
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
    setGhost(ghost) {
      node.alpha = ghost ? GHOST_ALPHA : 1;
      if (ghost) tag.visible = false;
    },
    setMult(next) {
      if (next === mult) return;
      if (next > mult) pop = 1;
      mult = next;
      multText.text = `×${mult}`;
      repaint();
      layoutLabel();
    },
    setOverload(next) {
      if (next === hullColor) return;
      const was = hullColor !== null;
      hullColor = next;
      repaint();
      if (was !== (next !== null)) layoutLabel();
    },
    setShield(on, blink) {
      shield.visible = on && !blink;
      if (shield.visible) shield.clear().circle(0, 0, SHIP_SIZE * SHIELD_RADIUS_K).stroke({ color: POWERUP_COLOR.shield, width: SHIELD_LINE_PX, alpha: SHIELD_ALPHA });
    },
    update(dtS) {
      pop = Math.max(0, pop - dtS / HUD_POP_S);
    },
  };
}

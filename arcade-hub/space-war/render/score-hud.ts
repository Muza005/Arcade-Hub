// Счёт в углу (как в «Точках»): кружок цвета игрока и число, по местам; лидер — первым.
// Мелко и полупрозрачно; при очке фишка вспыхивает, при обгоне плавно меняется местами.
import { Container, Graphics, Text } from 'pixi.js';
import {
  HUD_ALPHA,
  HUD_POP_S,
  HUD_POP_SCALE,
  HUD_SLIDE_RATE,
  SCORE_DOT_GAP_PX,
  SCORE_DOT_RADIUS,
  SCORE_FONT_PX,
  SCORE_GAP_PX,
} from '../config';

interface Chip {
  node: Container;
  dot: Graphics;
  text: Text;
  x: number;
  targetX: number;
  pop: number;
  score: number;
}

export interface ScoreHud {
  readonly view: Container;
  setColor(id: string, color: string): void;
  /** Очки по игрокам (порядок входа — при равенстве). */
  update(scores: ReadonlyArray<{ id: string; score: number }>, dtS: number): void;
  draw(): void;
}

const FONT_DISPLAY = 'Unbounded';
const FONT_FALLBACK = 'sans-serif';

export function createScoreHud(players: ReadonlyArray<{ id: string; color: string }>, x0: number, y: number, textColor: string): ScoreHud {
  const view = new Container();
  const chips = new Map<string, Chip>();
  for (const p of players) {
    const node = new Container();
    const dot = new Graphics().circle(0, 0, SCORE_DOT_RADIUS).fill(p.color);
    const text = new Text({
      text: '0',
      style: { fontFamily: [FONT_DISPLAY, FONT_FALLBACK], fontWeight: '700', fontSize: SCORE_FONT_PX, fill: textColor },
    });
    text.anchor.set(0, 0.5);
    text.x = SCORE_DOT_RADIUS + SCORE_DOT_GAP_PX;
    node.addChild(dot, text);
    node.y = y;
    view.addChild(node);
    chips.set(p.id, { node, dot, text, x: x0, targetX: x0, pop: 0, score: 0 });
  }
  let first = true;

  return {
    view,
    setColor(id, color) {
      chips.get(id)?.dot.clear().circle(0, 0, SCORE_DOT_RADIUS).fill(color);
    },
    update(scores, dtS) {
      let changed = first;
      for (const { id, score } of scores) {
        const chip = chips.get(id);
        if (!chip || chip.score === score) continue;
        if (score > chip.score) chip.pop = 1;
        chip.score = score;
        chip.text.text = String(score);
        changed = true;
      }
      if (changed) {
        let x = x0 + SCORE_DOT_RADIUS;
        for (const { id } of [...scores].sort((a, b) => b.score - a.score)) {
          const chip = chips.get(id);
          if (!chip) continue;
          chip.targetX = x;
          if (first) chip.x = x;
          x += SCORE_DOT_RADIUS * 2 + SCORE_DOT_GAP_PX + chip.text.width + SCORE_GAP_PX;
        }
        first = false;
      }
      const slide = Math.min(1, dtS * HUD_SLIDE_RATE);
      for (const chip of chips.values()) {
        chip.x += (chip.targetX - chip.x) * slide;
        chip.pop = Math.max(0, chip.pop - dtS / HUD_POP_S);
      }
    },
    draw() {
      for (const chip of chips.values()) {
        chip.node.x = chip.x;
        chip.node.scale.set(1 + HUD_POP_SCALE * chip.pop);
        chip.node.alpha = HUD_ALPHA + (1 - HUD_ALPHA) * chip.pop;
      }
    },
  };
}

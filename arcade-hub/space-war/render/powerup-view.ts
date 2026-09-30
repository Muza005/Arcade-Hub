// Значки усилений на поле: кружок с контуром своего цвета и простой символ; последние секунды мигают.
import { Graphics } from 'pixi.js';
import { POWERUP_BLINK_HZ, POWERUP_BLINK_S, POWERUP_COLOR, POWERUP_RADIUS, type PowerupKind } from '../config';
import type { Powerup } from '../game/powerups';

const LINE = 4;
const PLATE_ALPHA = 0.85;
const S = POWERUP_RADIUS * 0.5; // размер символа

/** Символ в точке (x, y): плюс, патроны, щит, снежинка, лучи, двойной шеврон, перечёркнутый круг. */
function symbol(g: Graphics, kind: PowerupKind, x: number, y: number, color: string): void {
  const stroke = { color, width: LINE, cap: 'round' as const, join: 'round' as const };
  switch (kind) {
    case 'repair':
      g.moveTo(x - S, y).lineTo(x + S, y).moveTo(x, y - S).lineTo(x, y + S).stroke(stroke);
      return;
    case 'ammo':
      for (const dx of [-S * 0.7, 0, S * 0.7]) g.moveTo(x + dx, y - S * 0.8).lineTo(x + dx, y + S * 0.8);
      g.stroke(stroke);
      return;
    case 'shield':
      g.poly([x, y - S, x + S * 0.9, y - S * 0.5, x + S * 0.7, y + S * 0.5, x, y + S, x - S * 0.7, y + S * 0.5, x - S * 0.9, y - S * 0.5]).stroke(stroke);
      return;
    case 'freeze':
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        g.moveTo(x - Math.cos(a) * S, y - Math.sin(a) * S).lineTo(x + Math.cos(a) * S, y + Math.sin(a) * S);
      }
      g.stroke(stroke);
      return;
    case 'clear':
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.moveTo(x + Math.cos(a) * S * 0.4, y + Math.sin(a) * S * 0.4).lineTo(x + Math.cos(a) * S, y + Math.sin(a) * S);
      }
      g.stroke(stroke);
      return;
    case 'overload':
      g.moveTo(x - S * 0.8, y).lineTo(x, y - S * 0.7).lineTo(x + S * 0.8, y);
      g.moveTo(x - S * 0.8, y + S * 0.8).lineTo(x, y + S * 0.1).lineTo(x + S * 0.8, y + S * 0.8);
      g.stroke(stroke);
      return;
    case 'jammer':
      g.circle(x, y, S).moveTo(x - S * 0.7, y + S * 0.7).lineTo(x + S * 0.7, y - S * 0.7).stroke(stroke);
      return;
  }
}

export interface PowerupView {
  readonly view: Graphics;
  draw(list: readonly Powerup[], timeS: number, bg: string): void;
}

export function createPowerupView(): PowerupView {
  const view = new Graphics();
  return {
    view,
    draw(list, timeS, bg) {
      view.clear();
      const blinkOff = Math.floor(timeS * POWERUP_BLINK_HZ * 2) % 2 === 1;
      for (const p of list) {
        if (p.leftS < POWERUP_BLINK_S && blinkOff) continue;
        const color = POWERUP_COLOR[p.kind];
        view.circle(p.pos.x, p.pos.y, POWERUP_RADIUS).fill({ color: bg, alpha: PLATE_ALPHA }).stroke({ color, width: LINE });
        symbol(view, p.kind, p.pos.x, p.pos.y, color);
      }
    },
  };
}

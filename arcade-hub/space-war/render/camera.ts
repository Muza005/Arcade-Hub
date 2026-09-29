// Камера Space War: тряска (trauma), вспышка экрана и импульс хроматической аберрации.
// Сила — из настроек хаба: ползунки «Тряска» и «Вспышки», «Уменьшить движение» выключает оба.
// Время — по шагам симуляции (на паузе замирает); случайность — своя, только для вида.
import { Graphics } from 'pixi.js';
import type { Rng } from '../../engine/rng';
import type { HubSettings } from '../../shared/hub-settings';
import {
  CHROMA_DECAY_S,
  FLASH_DECAY_S,
  SHAKE_DECAY_PER_S,
  SHAKE_FREQ_HZ,
  SHAKE_MAX_PX,
} from '../config';

const PERCENT = 100;

export interface Camera {
  /** Полноэкранная вспышка — поверх сцены. */
  readonly flash: Graphics;
  readonly offsetX: number;
  readonly offsetY: number;
  /** Импульс аберрации 0…1. */
  readonly chroma: number;
  shake(trauma: number): void;
  flashScreen(color: string, alpha: number): void;
  pulseChroma(): void;
  update(dtS: number): void;
}

export function createCamera(settings: HubSettings, width: number, height: number, rng: Rng): Camera {
  const calm = settings.reducedMotion;
  const shakeK = calm ? 0 : settings.shake / PERCENT;
  const flashK = calm ? 0 : settings.flash / PERCENT;
  const flash = new Graphics();
  flash.visible = false;
  let trauma = 0;
  let t = 0;
  let flashPeak = 0;
  /** 1 в момент вспышки, спадает до 0 за FLASH_DECAY_S. */
  let flashLevel = 0;
  let flashColor = '#ffffff';
  let chroma = 0;
  let ox = 0;
  let oy = 0;
  // Свои фазы по осям — тряска не ходит по диагонали.
  const px = rng.next() * Math.PI * 2;
  const py = rng.next() * Math.PI * 2;

  return {
    flash,
    get offsetX() {
      return ox;
    },
    get offsetY() {
      return oy;
    },
    get chroma() {
      return chroma;
    },
    shake(amount) {
      trauma = Math.min(1, trauma + amount * shakeK);
    },
    flashScreen(color, alpha) {
      const a = alpha * flashK;
      if (a <= flashPeak * flashLevel) return;
      flashPeak = a;
      flashLevel = 1;
      flashColor = color;
    },
    pulseChroma() {
      chroma = calm ? 0 : 1;
    },
    update(dtS) {
      t += dtS;
      trauma = Math.max(0, trauma - SHAKE_DECAY_PER_S * dtS);
      const amp = SHAKE_MAX_PX * trauma * trauma;
      const w = Math.PI * 2 * SHAKE_FREQ_HZ;
      ox = amp * (Math.sin(t * w + px) * 0.7 + Math.sin(t * w * 1.7 + py) * 0.3);
      oy = amp * (Math.sin(t * w * 1.3 + py) * 0.7 + Math.sin(t * w * 0.6 + px) * 0.3);
      flashLevel = Math.max(0, flashLevel - dtS / FLASH_DECAY_S);
      chroma = Math.max(0, chroma - dtS / CHROMA_DECAY_S);
      const alpha = flashPeak * flashLevel;
      flash.visible = alpha > 0;
      if (flash.visible) flash.clear().rect(0, 0, width, height).fill({ color: flashColor, alpha });
    },
  };
}

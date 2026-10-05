// Качество графики Space War (SPACE_WAR_SPEC §9): низкое / среднее / высокое.
// «Авто» в настройках хаба — начинаем с высокого и спускаемся на ступень, если кадр дольше
// QUALITY_DOWNGRADE_FRAME_MS держится QUALITY_DOWNGRADE_HOLD_S подряд. Ручной выбор не меняется.
import type { Quality } from '../../shared/hub-settings';
import { QUALITY_DOWNGRADE_FRAME_MS, QUALITY_DOWNGRADE_HOLD_S, QUALITY_WARMUP_S } from '../config';

export type Level = 'low' | 'mid' | 'high';

const LOWER: Record<Level, Level | null> = { high: 'mid', mid: 'low', low: null };
const MS_PER_S = 1000;

export interface QualityControl {
  readonly level: Level;
  readonly adaptive: boolean;
  /** Длительность последнего кадра, мс. true — качество понизилось. */
  sample(frameMs: number): boolean;
}

export function createQuality(setting: Quality): QualityControl {
  const adaptive = setting === 'auto';
  let level: Level = adaptive ? 'high' : setting;
  let warmupS = QUALITY_WARMUP_S;
  let slowS = 0;
  return {
    get level() {
      return level;
    },
    adaptive,
    sample(frameMs) {
      if (!adaptive) return false;
      const dtS = frameMs / MS_PER_S;
      if (warmupS > 0) {
        warmupS -= dtS;
        return false;
      }
      slowS = frameMs > QUALITY_DOWNGRADE_FRAME_MS ? slowS + dtS : 0;
      const lower = LOWER[level];
      if (slowS < QUALITY_DOWNGRADE_HOLD_S || !lower) return false;
      level = lower;
      slowS = 0;
      // После спуска — снова прогрев: новое качество должно успеть показать себя.
      warmupS = QUALITY_WARMUP_S;
      return true;
    },
  };
}

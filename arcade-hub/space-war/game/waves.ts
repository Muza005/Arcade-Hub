// Волны (SPACE_WAR_SPEC §5 «Волны»): 20 волн, между ними передышка; после 20-й — финиш.
// Осложнения разыгрываются заранее из сида матча — порядок не зависит от того, как шла игра.
import { createRng } from '../../engine/rng';
import {
  BOSS_WAVES,
  COMPLICATION_CHANCE,
  COMPLICATION_FROM_WAVE,
  COMPLICATIONS,
  WAVE_LIMIT,
  WAVE_PAUSE_S,
  WAVES_SEED_SALT,
  waveDurationS,
  type Complication,
} from '../config';

export type WavePhase = 'wave' | 'break' | 'done';

export interface WaveEvent {
  kind: 'start' | 'end';
  wave: number;
}

export interface Waves {
  /** Текущая волна; на передышке — только что пройденная. */
  readonly wave: number;
  readonly phase: WavePhase;
  /** Сколько осталось до конца волны или передышки. */
  readonly leftS: number;
  /** Осложнение текущей волны (на передышке — нет). */
  readonly complication: Complication | null;
  /** Волна босса (Б9). */
  readonly boss: boolean;
  /** Шаг времени; возвращает событие, если волна началась или кончилась. */
  step(dtS: number): WaveEvent | null;
}

export const isBossWave = (wave: number): boolean => BOSS_WAVES.includes(wave);

/** Осложнения всех волн (индекс — номер волны): не на первых, не у боссов, не два одинаковых подряд. */
export function rollComplications(seed: number, limit: number = WAVE_LIMIT): Array<Complication | null> {
  const rng = createRng((seed ^ WAVES_SEED_SALT) >>> 0);
  const out: Array<Complication | null> = [null];
  let last: Complication | null = null;
  for (let wave = 1; wave <= limit; wave++) {
    // Бросок — на каждую волну, даже без шанса: номер волны не сдвигает случайность соседних.
    const roll = rng.next();
    const pick = rng.pick(COMPLICATIONS.filter((c) => c !== last));
    const allowed = wave >= COMPLICATION_FROM_WAVE && !isBossWave(wave);
    const c = allowed && roll < COMPLICATION_CHANCE ? pick : null;
    out.push(c);
    last = c;
  }
  return out;
}

/** Первая волна начинается сразу; событие её начала — на первом шаге. */
export function createWaves(seed: number, limit: number = WAVE_LIMIT): Waves {
  const complications = rollComplications(seed, limit);
  let wave = 1;
  let phase: WavePhase = 'wave';
  let leftS = waveDurationS(1);
  let started = false;

  return {
    get wave() {
      return wave;
    },
    get phase() {
      return phase;
    },
    get leftS() {
      return leftS;
    },
    get complication() {
      return phase === 'wave' ? (complications[wave] ?? null) : null;
    },
    get boss() {
      return isBossWave(wave);
    },
    step(dtS) {
      if (!started) {
        started = true;
        return { kind: 'start', wave };
      }
      if (phase === 'done') return null;
      leftS -= dtS;
      if (leftS > 0) return null;
      if (phase === 'wave') {
        phase = wave >= limit ? 'done' : 'break';
        leftS = phase === 'break' ? WAVE_PAUSE_S : 0;
        return { kind: 'end', wave };
      }
      wave++;
      phase = 'wave';
      leftS = waveDurationS(wave);
      return { kind: 'start', wave };
    },
  };
}

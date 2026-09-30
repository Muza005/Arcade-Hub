// Волны (SPACE_WAR_SPEC §5 «Волны»): 20 волн, между ними передышка; после 20-й — финиш.
// Осложнения разыгрываются заранее из сида матча — порядок не зависит от того, как шла игра.
import { createRng } from '../../engine/rng';
import {
  BOSS_OF_WAVE,
  BOSS_TARGET_MAX_S,
  BOSS_WAVES,
  COMPLICATION_CHANCE,
  COMPLICATION_FROM_WAVE,
  COMPLICATIONS,
  WAVE_LIMIT,
  WAVE_PAUSE_S,
  SWARM_DURATION_S,
  VORTEX_DURATION_S,
  WAVES_SEED_SALT,
  waveDurationS,
  type BossKind,
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
  /** Босс текущей волны. */
  readonly boss: BossKind | null;
  /** Цель убита — волна кончается на следующем шаге. */
  finishWave(): void;
  /** Шаг времени; возвращает событие, если волна началась или кончилась. */
  step(dtS: number): WaveEvent | null;
}

export const isBossWave = (wave: number): boolean => BOSS_WAVES.includes(wave);

/** Длина волны: обычная — по формуле; испытание — ровно своё время; цель — пока жива (с пределом). */
export function waveLengthS(wave: number): number {
  const boss = BOSS_OF_WAVE[wave];
  if (boss === 'swarm') return SWARM_DURATION_S;
  if (boss === 'vortex') return VORTEX_DURATION_S;
  if (boss) return BOSS_TARGET_MAX_S;
  return waveDurationS(wave);
}

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

/** Первая волна начинается сразу; событие её начала — на первом шаге. startWave — для проверки поздних волн. */
export function createWaves(seed: number, limit: number = WAVE_LIMIT, startWave = 1): Waves {
  const complications = rollComplications(seed, limit);
  let wave = Math.min(Math.max(1, startWave), limit);
  let phase: WavePhase = 'wave';
  let leftS = waveLengthS(wave);
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
      return phase === 'wave' ? (BOSS_OF_WAVE[wave] ?? null) : null;
    },
    finishWave() {
      if (phase === 'wave') leftS = 0;
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
      leftS = waveLengthS(wave);
      return { kind: 'start', wave };
    },
  };
}

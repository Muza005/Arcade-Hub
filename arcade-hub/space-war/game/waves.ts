// Волны (SPACE_WAR_SPEC §5 «Волны»): 20 волн, между ними передышка; после 20-й — финиш.
// Осложнения разыгрываются заранее из сида матча — порядок не зависит от того, как шла игра.
import { createRng } from '../../engine/rng';
import {
  BOSS_OF_WAVE,
  BOSS_TARGET_MAX_S,
  BOSS_WAVES,
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
  /** Течение: куда сносит (единичный вектор по оси); вне Течения — нулевой. */
  readonly flow: { x: number; y: number };
  /** Сколько прошло с начала волны, с. */
  readonly elapsedS: number;
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

const FLOW_DIRS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
] as const;
const NO_FLOW = { x: 0, y: 0 };
const FLOW_SALT = 0x51f7;

/** Осложнения всех волн (индекс — номер волны), решение заказчика: в каждой волне, кроме первой и волн
 *  боссов, и без повторов в матче — колода осложнений тасуется по сиду и раздаётся по порядку. */
export function rollComplications(seed: number, limit: number = WAVE_LIMIT): Array<Complication | null> {
  const rng = createRng((seed ^ WAVES_SEED_SALT) >>> 0);
  const deck = [...COMPLICATIONS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [deck[i], deck[j]] = [deck[j] as Complication, deck[i] as Complication];
  }
  const out: Array<Complication | null> = [null];
  for (let wave = 1; wave <= limit; wave++) {
    const allowed = wave >= COMPLICATION_FROM_WAVE && !isBossWave(wave);
    out.push(allowed ? (deck.shift() ?? null) : null);
  }
  return out;
}

/** Течение каждой волны: сторона — из сида (своя случайность, порядок осложнений не сдвигает). */
export function rollFlows(seed: number, limit: number = WAVE_LIMIT): Array<{ x: number; y: number }> {
  const rng = createRng((seed ^ WAVES_SEED_SALT ^ FLOW_SALT) >>> 0);
  return Array.from({ length: limit + 1 }, () => rng.pick(FLOW_DIRS));
}

/** Первая волна начинается сразу; событие её начала — на первом шаге. startWave — для проверки поздних волн. */
export function createWaves(seed: number, limit: number = WAVE_LIMIT, startWave = 1): Waves {
  const complications = rollComplications(seed, limit);
  const flows = rollFlows(seed, limit);
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
    get flow() {
      return phase === 'wave' && complications[wave] === 'current' ? (flows[wave] ?? NO_FLOW) : NO_FLOW;
    },
    get elapsedS() {
      return phase === 'wave' ? waveLengthS(wave) - leftS : 0;
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

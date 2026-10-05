import { describe, expect, it } from 'vitest';
import { FIXED_STEP_HZ } from '../../shared/config';
import type { BotLevel } from '../config';
import { createBots } from './bots';
import { createSim } from './sim';

const DT = 1 / FIXED_STEP_HZ;
const W = 1920;
const MATCH_S = 90;

/** Сколько секунд продержится один корабль: без ввода или под ботом уровня level. */
function survive(seed: number, level: BotLevel | null): { timeS: number; mult: number; shots: number } {
  const sim = createSim(['p'], W, seed);
  const bots = level ? createBots(sim, ['p'], level, seed) : null;
  let maxMult = 1;
  let shots = 0;
  for (let i = 0; i < MATCH_S * FIXED_STEP_HZ; i++) {
    sim.step(DT, (id) => (bots ? bots.input(id) : { x: 0, y: 0, btn: false }));
    shots += sim.events.shots.length;
    maxMult = Math.max(maxMult, sim.pilots.get('p')!.mult);
    if (!sim.pilots.get('p')!.alive) break;
  }
  return { timeS: sim.pilots.get('p')!.diedAtS ?? sim.timeS, mult: maxMult, shots };
}

const SEEDS = [1, 2, 3, 4, 5, 6];
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('боты', () => {
  const idle = avg(SEEDS.map((s) => survive(s, null).timeS));
  const runs = Object.fromEntries(
    (['weak', 'mid', 'strong'] as const).map((l) => [l, SEEDS.map((s) => survive(s, l))]),
  ) as Record<BotLevel, ReturnType<typeof survive>[]>;

  it('каждый уровень живёт дольше неподвижного корабля', () => {
    console.log('idle', idle.toFixed(1), Object.entries(runs).map(([l, r]) => `${l} ${avg(r.map((x) => x.timeS)).toFixed(1)}s ×${Math.max(...r.map((x) => x.mult))} shots ${avg(r.map((x) => x.shots)).toFixed(0)}`).join(' | '));
    for (const level of ['weak', 'mid', 'strong'] as const) expect(avg(runs[level].map((r) => r.timeS))).toBeGreaterThan(idle);
  });

  it('слабый не стреляет, сильный набирает множитель', () => {
    expect(runs.weak.every((r) => r.shots === 0)).toBe(true);
    expect(Math.max(...runs.strong.map((r) => r.mult))).toBeGreaterThanOrEqual(2);
  });

  it('одинаковый сид — одинаковый матч', () => {
    expect(survive(7, 'strong')).toEqual(survive(7, 'strong'));
  });
});

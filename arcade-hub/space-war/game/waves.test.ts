import { describe, expect, it } from 'vitest';
import { FIXED_STEP_HZ } from '../../shared/config';
import { BOSS_WAVES, COMPLICATION_FROM_WAVE, COMPLICATIONS, SCORE_WAVE, WAVE_LIMIT, WAVE_PAUSE_S, waveDurationS } from '../config';
import { createSim } from './sim';
import { createWaves, rollComplications, waveLengthS, type WaveEvent } from './waves';

const DT = 1 / FIXED_STEP_HZ;
const IDLE = { x: 0, y: 0, btn: false };

/** Прогоняет волны до финиша, собирая события и время каждого. */
function runAll(seed: number): Array<WaveEvent & { atS: number }> {
  const waves = createWaves(seed);
  const out: Array<WaveEvent & { atS: number }> = [];
  let t = 0;
  for (let i = 0; i < FIXED_STEP_HZ * 60 * 30 && waves.phase !== 'done'; i++) {
    const e = waves.step(DT);
    if (e) out.push({ ...e, atS: t });
    t += DT;
  }
  return out;
}

describe('волны', () => {
  it('длительность min(30 + 3·(n−1), 60)', () => {
    expect(waveDurationS(1)).toBe(30);
    expect(waveDurationS(2)).toBe(33);
    expect(waveDurationS(11)).toBe(60);
    expect(waveDurationS(20)).toBe(60);
  });

  it('20 волн с передышкой 5 с, потом финиш', () => {
    const events = runAll(7);
    const starts = events.filter((e) => e.kind === 'start');
    const ends = events.filter((e) => e.kind === 'end');
    expect(starts.map((e) => e.wave)).toEqual(Array.from({ length: WAVE_LIMIT }, (_, i) => i + 1));
    expect(ends).toHaveLength(WAVE_LIMIT);
    for (let n = 1; n <= WAVE_LIMIT; n++) {
      const start = starts[n - 1]!;
      const end = ends[n - 1]!;
      expect(end.atS - start.atS).toBeCloseTo(waveLengthS(n), 1);
      const next = starts[n];
      if (next) expect(next.atS - end.atS).toBeCloseTo(WAVE_PAUSE_S, 1);
    }
  });

  it('осложнения: в каждой волне, кроме первой и боссов, без повторов, по сиду', () => {
    for (let seed = 0; seed < 50; seed++) {
      const c = rollComplications(seed);
      expect(c).toEqual(rollComplications(seed));
      for (let n = 1; n < COMPLICATION_FROM_WAVE; n++) expect(c[n]).toBeNull();
      for (const n of BOSS_WAVES) expect(c[n]).toBeNull();
      const used = c.filter((x) => x !== null);
      expect(new Set(used).size).toBe(used.length);
      for (let n = COMPLICATION_FROM_WAVE; n <= WAVE_LIMIT; n++) if (!BOSS_WAVES.includes(n)) expect(c[n]).not.toBeNull();
    }
    // Обычных волн столько же, сколько осложнений: каждое — ровно раз за матч.
    expect(new Set(rollComplications(7).filter((x) => x !== null))).toEqual(new Set(COMPLICATIONS));
    expect(rollComplications(1)).not.toEqual(rollComplications(2));
  });

  it('на передышке новые камни не появляются; живым — очки за волну', () => {
    const sim = createSim(['p'], 1920, 3);
    let maxId = 0;
    let ended = false;
    let bonusChecked = false;
    for (let i = 0; i < FIXED_STEP_HZ * (waveDurationS(1) + WAVE_PAUSE_S - 1); i++) {
      const before = sim.pilots.get('p')!.score;
      sim.step(DT, () => IDLE);
      for (const r of sim.asteroids) {
        if (ended) expect(r.id).toBeLessThanOrEqual(maxId);
        maxId = Math.max(maxId, r.id);
      }
      const e = sim.events.waves.find((w) => w.kind === 'end');
      if (e) {
        ended = true;
        if (sim.pilots.get('p')!.alive) {
          expect(sim.pilots.get('p')!.score - before).toBeGreaterThanOrEqual(SCORE_WAVE * e.wave);
          bonusChecked = true;
        }
      }
    }
    expect(ended).toBe(true);
    expect(sim.waves.phase).toBe('break');
    expect(bonusChecked || !sim.pilots.get('p')!.alive).toBe(true);
  });
});

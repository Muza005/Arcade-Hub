import { describe, expect, it } from 'vitest';
import type { InputState } from '../engine/input';
import { createRng } from '../engine/rng';
import { DASH_COOLDOWN_S, DOT_SPEED, FIELD } from './config';
import { createSim } from './sim';

const STEP = 1 / 60;
const idle = (): InputState => ({ x: 0, y: 0, btn: false });

/** Детерминированный «игрок»: ввод из своего генератора. */
function botInput(seed: number) {
  const rng = createRng(seed);
  return (): InputState => ({ x: rng.range(-1, 1), y: rng.range(-1, 1), btn: rng.next() < 0.05 });
}

function playMatch(seed: number) {
  const sim = createSim(['a', 'b', 'c'], seed, { durationS: 10, dashEnabled: true });
  const inputs = { a: botInput(1), b: botInput(2), c: botInput(3) };
  while (!sim.over) sim.step(STEP, (id) => inputs[id as keyof typeof inputs]());
  return sim.dots.map((d) => ({ id: d.id, score: d.score, x: d.pos.x, y: d.pos.y }));
}

describe('Точки: симуляция', () => {
  it('один сид и один ввод — один и тот же матч', () => {
    expect(playMatch(123)).toEqual(playMatch(123));
  });

  it('матч заканчивается по времени', () => {
    const sim = createSim(['a'], 1, { durationS: 1, dashEnabled: true });
    let steps = 0;
    while (!sim.over) {
      sim.step(STEP, idle);
      steps++;
    }
    expect(steps).toBeGreaterThanOrEqual(60);
    expect(steps).toBeLessThanOrEqual(61);
    expect(sim.timeLeftS).toBe(0);
  });

  it('точка не выходит за поле', () => {
    const sim = createSim(['a'], 1, { durationS: 5, dashEnabled: true });
    for (let i = 0; i < 300; i++) sim.step(STEP, () => ({ x: -1, y: -1, btn: false }));
    const dot = sim.dots[0]!;
    expect(dot.pos.x).toBeGreaterThan(FIELD.left);
    expect(dot.pos.y).toBeGreaterThan(FIELD.top);
  });

  it('рывок быстрее обычного движения и уходит на перезарядку', () => {
    const plain = createSim(['a'], 1, { durationS: 5, dashEnabled: true });
    const dash = createSim(['a'], 1, { durationS: 5, dashEnabled: true });
    const x0 = plain.dots[0]!.pos.x;
    for (let i = 0; i < 6; i++) {
      plain.step(STEP, () => ({ x: 1, y: 0, btn: false }));
      dash.step(STEP, () => ({ x: 1, y: 0, btn: true }));
    }
    expect(plain.dots[0]!.pos.x - x0).toBeCloseTo(DOT_SPEED * STEP * 6);
    expect(dash.dots[0]!.pos.x).toBeGreaterThan(plain.dots[0]!.pos.x);
    expect(dash.dashReady('a')).toBeLessThan(1);
    // Удержание кнопки не перезапускает рывок: нужен новый нажим после перезарядки.
    for (let i = 0; i < DASH_COOLDOWN_S * 60 + 1; i++) dash.step(STEP, idle);
    expect(dash.dashReady('a')).toBe(1);
  });

  it('рывок выключен настройкой', () => {
    const sim = createSim(['a'], 1, { durationS: 5, dashEnabled: false });
    sim.step(STEP, () => ({ x: 1, y: 0, btn: true }));
    expect(sim.dashReady('a')).toBe(1);
  });

  it('звезда даёт очко и появляется заново', () => {
    const sim = createSim(['a'], 1, { durationS: 60, dashEnabled: false });
    const starsBefore = sim.stars.length;
    let steps = 0;
    // Идём к ближайшей звезде, пока не соберём одну.
    while (sim.dots[0]!.score === 0 && steps < 60 * 30) {
      const dot = sim.dots[0]!;
      const star = [...sim.stars].sort(
        (p, q) => Math.hypot(p.x - dot.pos.x, p.y - dot.pos.y) - Math.hypot(q.x - dot.pos.x, q.y - dot.pos.y),
      )[0]!;
      const len = Math.hypot(star.x - dot.pos.x, star.y - dot.pos.y) || 1;
      sim.step(STEP, () => ({ x: (star.x - dot.pos.x) / len, y: (star.y - dot.pos.y) / len, btn: false }));
      steps++;
    }
    expect(sim.dots[0]!.score).toBe(1);
    expect(sim.stars.length).toBe(starsBefore);
  });
});

describe('Точки: бот', () => {
  it('бот собирает звёзды сам', async () => {
    const { botInput } = await import('./bot');
    const sim = createSim(['bot-1'], 5, { durationS: 20, dashEnabled: true });
    while (!sim.over) sim.step(STEP, (id) => botInput(sim, id));
    expect(sim.dots[0]!.score).toBeGreaterThan(3);
  });
});

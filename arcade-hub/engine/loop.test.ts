import { describe, expect, it } from 'vitest';
import { MAX_FRAME_S } from '../shared/config';
import { FixedLoop } from './loop';

const noScheduler = { request: () => 0, cancel: () => {} };

function makeLoop(hz = 60) {
  const ticks: number[] = [];
  const alphas: number[] = [];
  const loop = new FixedLoop(
    { update: (_dt, tick) => ticks.push(tick), render: (a) => alphas.push(a) },
    noScheduler,
    hz,
  );
  return { loop, ticks, alphas };
}

describe('FixedLoop', () => {
  it('число шагов зависит от прошедшего времени, а не от числа кадров', () => {
    const { loop, ticks } = makeLoop(60);
    loop.advance(0);
    for (let t = 1; t <= 1000; t++) loop.advance(t); // 1 с кадрами по 1 мс
    expect(ticks.length).toBe(60);
  });

  it('dt всегда один и тот же', () => {
    const dts: number[] = [];
    const loop = new FixedLoop({ update: (dt) => dts.push(dt), render: () => {} }, noScheduler, 60);
    loop.advance(0);
    loop.advance(7);
    loop.advance(40);
    loop.advance(41);
    expect(new Set(dts)).toEqual(new Set([1 / 60]));
  });

  it('alpha в [0, 1) — остаток шага для интерполяции', () => {
    const { loop, alphas } = makeLoop(10); // шаг 100 мс
    loop.advance(0);
    loop.advance(150);
    expect(alphas.at(-1)).toBeCloseTo(0.5);
  });

  it('длинный кадр (вкладка в фоне) обрезается до MAX_FRAME_S', () => {
    const { loop, ticks } = makeLoop(60);
    loop.advance(0);
    loop.advance(60_000);
    expect(ticks.length).toBe(Math.floor(MAX_FRAME_S * 60));
  });
});

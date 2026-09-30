import { describe, expect, it } from 'vitest';
import { AMMO_BASE_S, AMMO_MAX, MULT_IDLE_RESET_S, MULT_STEPS, NEAR_MISS_COOLDOWN_S, SCORE_NEAR_MISS } from '../config';
import { ammoTimeS, checkIdle, createPilot, nearMiss, regenAmmo } from './pilot';
import { createShip } from './ship';

const pilot = () => createPilot(createShip('p', { x: 0, y: 0 }, 0));

describe('патроны', () => {
  it('не больше максимума и копятся по формуле', () => {
    const p = pilot();
    p.ammo = 0;
    let t = 0;
    while (p.ammo === 0) {
      regenAmmo(p, 0.01);
      t += 0.01;
    }
    expect(t).toBeCloseTo(AMMO_BASE_S, 1);
    for (let i = 0; i < 10_000; i++) regenAmmo(p, 0.1);
    expect(p.ammo).toBe(AMMO_MAX);
  });

  it('множитель ускоряет накопление: ×1 — 2 с, ×5 — около 0,5 с (решение заказчика)', () => {
    expect(ammoTimeS(1)).toBeCloseTo(2, 5);
    expect(ammoTimeS(5)).toBeLessThanOrEqual(0.5);
    expect(ammoTimeS(5)).toBeGreaterThan(0.4);
  });
});

describe('множитель', () => {
  it('×5 — за 28 сближений, не быстрее паузы между ними', () => {
    const p = pilot();
    let now = 1;
    let rock = 1;
    const total = MULT_STEPS.reduce((a, b) => a + b, 0);
    for (let i = 0; i < total; i++) {
      expect(nearMiss(p, rock++, now)).toBe(true);
      // Второй камень в ту же паузу не засчитывается.
      expect(nearMiss(p, rock++, now + NEAR_MISS_COOLDOWN_S / 2)).toBe(false);
      now += NEAR_MISS_COOLDOWN_S;
    }
    expect(p.mult).toBe(5);
    // Минимум (28 − 1) × 0,5 с — ×5 за секунды не набрать.
    expect(now - 1).toBeGreaterThanOrEqual((total - 1) * NEAR_MISS_COOLDOWN_S);
  });

  it('каждый камень засчитывается один раз', () => {
    const p = pilot();
    expect(nearMiss(p, 7, 1)).toBe(true);
    expect(nearMiss(p, 7, 5)).toBe(false);
  });

  it('очки за сближение умножаются на ступень', () => {
    const p = pilot();
    p.mult = 3;
    nearMiss(p, 1, 1);
    expect(p.score).toBe(SCORE_NEAR_MISS * 3);
  });

  it('простой дольше таймера обнуляет сразу до ×1', () => {
    const p = pilot();
    p.mult = 4;
    p.multProgress = 2;
    p.lastNearS = 10;
    expect(checkIdle(p, 10 + MULT_IDLE_RESET_S - 0.01)).toBe(false);
    expect(checkIdle(p, 10 + MULT_IDLE_RESET_S)).toBe(true);
    expect(p.mult).toBe(1);
    expect(p.multProgress).toBe(0);
  });
});

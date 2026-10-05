import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('rng', () => {
  it('один сид — одна последовательность', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('разные сиды — разные последовательности', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('next в [0, 1), range в [min, max), pick из массива', () => {
    const rng = createRng(7);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 10_000; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      const r = rng.range(-5, 5);
      expect(r).toBeGreaterThanOrEqual(-5);
      expect(r).toBeLessThan(5);
      expect(items).toContain(rng.pick(items));
    }
  });

  it('pick из пустого массива — ошибка', () => {
    expect(() => createRng(1).pick([])).toThrow();
  });
});

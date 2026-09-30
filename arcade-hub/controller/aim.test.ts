import { describe, expect, it } from 'vitest';
import { aimEntry, aimStep } from './aim';

describe('прицел', () => {
  it('ступени силы по доле диагонали', () => {
    expect(aimStep(10, 100)).toBe(1);
    expect(aimStep(30, 100)).toBe(2);
    expect(aimStep(60, 100)).toBe(3);
    expect(aimStep(80, 100)).toBe(4);
  });

  it('якорь в центре, палец к правому нижнему углу — вход из левого верхнего угла', () => {
    const d = Math.SQRT1_2;
    const e = aimEntry(50, 50, d, d, 100, 100)!;
    expect(e.x).toBeCloseTo(0);
    expect(e.y).toBeCloseTo(0);
  });

  it('якорь за рамкой: вход там, где линия впервые пересекает рамку', () => {
    const e = aimEntry(-20, 30, 1, 0, 100, 60)!;
    expect(e).toEqual({ x: 0, y: 0.5 });
    // Линия мимо рамки — выстрела нет.
    expect(aimEntry(-20, -20, 1, 0, 100, 60)).toBeNull();
  });
});

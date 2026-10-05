import { describe, expect, it } from 'vitest';
import { QUALITY_DOWNGRADE_FRAME_MS, QUALITY_DOWNGRADE_HOLD_S, QUALITY_WARMUP_S } from '../config';
import { createQuality } from './quality';

const run = (q: ReturnType<typeof createQuality>, frameMs: number, seconds: number): number => {
  let downs = 0;
  for (let t = 0; t < seconds * 1000; t += frameMs) if (q.sample(frameMs)) downs++;
  return downs;
};

describe('качество', () => {
  it('авто: начинает с высокого и спускается при долгих кадрах', () => {
    const q = createQuality('auto');
    expect(q.level).toBe('high');
    const slow = QUALITY_DOWNGRADE_FRAME_MS + 5;
    run(q, slow, QUALITY_WARMUP_S + QUALITY_DOWNGRADE_HOLD_S + 0.1);
    expect(q.level).toBe('mid');
    run(q, slow, 60);
    expect(q.level).toBe('low');
  });

  it('короткие провалы не понижают', () => {
    const q = createQuality('auto');
    for (let i = 0; i < 100; i++) {
      run(q, 16, 1);
      run(q, QUALITY_DOWNGRADE_FRAME_MS + 10, QUALITY_DOWNGRADE_HOLD_S / 2);
    }
    expect(q.level).toBe('high');
  });

  it('ручной выбор не меняется', () => {
    const q = createQuality('mid');
    run(q, 100, 30);
    expect(q.level).toBe('mid');
  });
});

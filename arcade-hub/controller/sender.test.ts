import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InputState } from '../shared/protocol';
import { createInputSender } from './sender';

describe('createInputSender', () => {
  let t = 0;
  let sent: InputState[] = [];
  const make = () => createInputSender((s) => sent.push(s), () => t);

  beforeEach(() => {
    vi.useFakeTimers();
    t = 1000;
    sent = [];
  });
  afterEach(() => vi.useRealTimers());

  it('мелкие изменения не отправляются', () => {
    const s = make();
    s.update({ x: 0.5, y: 0, btn: false });
    s.update({ x: 0.505, y: 0, btn: false });
    vi.runAllTimers();
    expect(sent).toEqual([{ x: 0.5, y: 0, btn: false }]);
  });

  it('не чаще INPUT_SEND_HZ: поток изменений сжимается', () => {
    const s = make();
    for (let i = 1; i <= 10; i++) {
      s.update({ x: i / 10, y: 0, btn: false });
      t += 5;
      vi.advanceTimersByTime(5);
    }
    t += 100;
    vi.runAllTimers();
    // 50 мс изменений → первое сразу, дальше не чаще раза в ~17 мс
    expect(sent.length).toBeLessThanOrEqual(5);
    expect(sent.at(-1)?.x).toBe(1);
  });

  it('нажатие кнопки уходит сразу, без ожидания интервала', () => {
    const s = make();
    s.update({ x: 0.5, y: 0, btn: false });
    t += 1;
    s.update({ x: 0.5, y: 0, btn: true });
    expect(sent.at(-1)).toEqual({ x: 0.5, y: 0, btn: true });
  });

  it('отпускание до нуля всегда доходит', () => {
    const s = make();
    s.update({ x: 0.01, y: 0, btn: true });
    t += 100;
    s.release();
    vi.runAllTimers();
    expect(sent.at(-1)).toEqual({ x: 0, y: 0, btn: false });
  });
});

import { describe, expect, it } from 'vitest';
import { pickNext, type Box } from './spatial';

const box = (left: number, top: number, w = 100, h = 50): Box => ({ left, top, right: left + w, bottom: top + h });

// Сетка 3×2 карточек, сверху справа — две кнопки.
const grid = [box(0, 100), box(120, 100), box(240, 100), box(0, 170), box(120, 170), box(240, 170)];
const topButtons = [box(260, 0, 30, 30), box(300, 0, 30, 30)];
const all = [...grid, ...topButtons];

describe('pickNext', () => {
  it('вправо и влево — соседи в ряду', () => {
    expect(pickNext(grid[0]!, all, 'right')).toBe(1);
    expect(pickNext(grid[2]!, all, 'left')).toBe(1);
  });

  it('вниз — в той же колонке', () => {
    expect(pickNext(grid[1]!, all, 'down')).toBe(4);
  });

  it('вверх из сетки — к ближайшей кнопке сверху', () => {
    expect(pickNext(grid[2]!, all, 'up')).toBe(6);
  });

  it('с края — некуда', () => {
    expect(pickNext(grid[3]!, all, 'left')).toBe(-1);
    expect(pickNext(grid[5]!, all, 'down')).toBe(-1);
  });

  it('из кнопки вниз — в сетку, а не в соседнюю кнопку', () => {
    expect(pickNext(topButtons[1]!, all, 'down')).toBe(2);
  });
});

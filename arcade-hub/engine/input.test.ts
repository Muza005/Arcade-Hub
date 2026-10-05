import { describe, expect, it } from 'vitest';
import { clampUnit, createKeyboardSource, IDLE_INPUT, InputHub } from './input';

function fakeWindow() {
  const target = new EventTarget();
  const press = (type: 'keydown' | 'keyup', code: string) => {
    const e = new Event(type, { cancelable: true }) as Event & { code: string };
    e.code = code;
    target.dispatchEvent(e);
  };
  return { target: target as unknown as Window, press };
}

describe('input', () => {
  it('стрелки дают оси, диагональ не длиннее 1', () => {
    const { target, press } = fakeWindow();
    const hub = new InputHub();
    hub.add(createKeyboardSource('p1', 'arrows', target));

    press('keydown', 'ArrowRight');
    expect(hub.read('p1')).toEqual({ x: 1, y: 0, btn: false });

    press('keydown', 'ArrowUp');
    const { x, y } = hub.read('p1');
    expect(Math.hypot(x, y)).toBeCloseTo(1);
    expect(y).toBeLessThan(0);

    press('keyup', 'ArrowRight');
    press('keyup', 'ArrowUp');
    expect(hub.read('p1')).toEqual(IDLE_INPUT);
  });

  it('WASD и стрелки — разные игроки', () => {
    const { target, press } = fakeWindow();
    const hub = new InputHub();
    hub.add(createKeyboardSource('arrows', 'arrows', target));
    hub.add(createKeyboardSource('wasd', 'wasd', target));
    press('keydown', 'KeyA');
    expect(hub.read('wasd').x).toBe(-1);
    expect(hub.read('arrows').x).toBe(0);
  });

  it('неизвестный игрок — покой', () => {
    expect(new InputHub().read('nobody')).toEqual(IDLE_INPUT);
  });

  it('clampUnit не трогает короткие векторы', () => {
    expect(clampUnit(0.3, 0.4)).toEqual({ x: 0.3, y: 0.4 });
  });
});

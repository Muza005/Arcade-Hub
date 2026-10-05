// Единый поток ввода. Игра читает состояние игрока по id и не знает, откуда оно пришло:
// клавиатура сейчас, телефоны (сообщения `in`) и тестовые игроки — на следующих этапах.
import { KEYBOARD_KEYS, type KeyboardScheme } from '../shared/config';
import type { InputState } from '../shared/protocol';

export type { InputState, KeyboardScheme };

export interface InputSource {
  readonly id: string;
  read(): InputState;
  dispose(): void;
}

export const IDLE_INPUT: Readonly<InputState> = Object.freeze({ x: 0, y: 0, btn: false });

/** Ограничивает вектор единичной длиной, чтобы по диагонали не было быстрее. */
export function clampUnit(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y);
  return len > 1 ? { x: x / len, y: y / len } : { x, y };
}

/** Клавиатурный игрок: движение и главная кнопка по раскладке KEYBOARD_KEYS. */
export function createKeyboardSource(id: string, scheme: KeyboardScheme, target: Window = window): InputSource {
  const map = KEYBOARD_KEYS[scheme];
  const handled = new Set<string>(Object.values(map));
  const down = new Set<string>();

  const onKeyDown = (e: KeyboardEvent): void => {
    if (!handled.has(e.code)) return;
    e.preventDefault();
    down.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (!handled.has(e.code)) return;
    down.delete(e.code);
  };
  const onBlur = (): void => down.clear();

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  const axis = (neg: string, pos: string): number => (down.has(pos) ? 1 : 0) - (down.has(neg) ? 1 : 0);

  return {
    id,
    read: () => ({ ...clampUnit(axis(map.left, map.right), axis(map.up, map.down)), btn: down.has(map.btn) }),
    dispose: () => {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
      down.clear();
    },
  };
}

/** Все источники ввода в одном месте. */
export class InputHub {
  private readonly sources = new Map<string, InputSource>();

  add(source: InputSource): void {
    this.sources.get(source.id)?.dispose();
    this.sources.set(source.id, source);
  }

  remove(id: string): void {
    this.sources.get(id)?.dispose();
    this.sources.delete(id);
  }

  has(id: string): boolean {
    return this.sources.has(id);
  }

  ids(): string[] {
    return [...this.sources.keys()];
  }

  /** Состояние игрока; у неизвестного id — покой. */
  read(id: string): InputState {
    return this.sources.get(id)?.read() ?? { ...IDLE_INPUT };
  }

  dispose(): void {
    for (const source of this.sources.values()) source.dispose();
    this.sources.clear();
  }
}

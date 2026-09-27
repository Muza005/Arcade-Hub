// Запись и воспроизведение потока ввода (ARCADE_HUB_SPEC §2, §12): матч = сид + ввод по тикам.
// Хранятся только изменения: [тик, номер игрока, x, y, кнопка].
import { INPUT_QUANT } from '../shared/config';
import { IDLE_INPUT, type InputState } from './input';

export type InputEvent = [tick: number, player: number, x: number, y: number, btn: 0 | 1];

const quant = (v: number): number => Math.round(v * INPUT_QUANT) / INPUT_QUANT;

/** Округлённый ввод: его видит игра и его же пишет запись. */
export function quantize(input: InputState): InputState {
  return { x: quant(input.x), y: quant(input.y), btn: input.btn };
}

export interface InputRecorder {
  /** Обёртка над read: отдаёт игре округлённый ввод и пишет изменения. */
  read(playerId: string): InputState;
  setTick(tick: number): void;
  readonly events: readonly InputEvent[];
}

export function createInputRecorder(
  players: readonly string[],
  read: (playerId: string) => InputState,
): InputRecorder {
  const index = new Map(players.map((id, i) => [id, i]));
  const last = new Map<string, InputState>();
  const events: InputEvent[] = [];
  let tick = 0;

  return {
    events,
    setTick(t) {
      tick = t;
    },
    read(playerId) {
      const input = quantize(read(playerId));
      const i = index.get(playerId);
      if (i === undefined) return input;
      const prev = last.get(playerId) ?? IDLE_INPUT;
      if (prev.x !== input.x || prev.y !== input.y || prev.btn !== input.btn) {
        events.push([tick, i, input.x, input.y, input.btn ? 1 : 0]);
        last.set(playerId, input);
      }
      return input;
    },
  };
}

/** Ввод из записи: состояние игрока на заданном тике. */
export function createInputPlayback(players: readonly string[], events: readonly InputEvent[]) {
  const state = players.map(() => ({ ...IDLE_INPUT }));
  let cursor = 0;
  return {
    /** Применить все события до тика включительно. Тики идут только вперёд. */
    advance(tick: number): void {
      while (cursor < events.length && (events[cursor] as InputEvent)[0] <= tick) {
        const [, i, x, y, btn] = events[cursor] as InputEvent;
        state[i] = { x, y, btn: btn === 1 };
        cursor++;
      }
    },
    read(playerId: string): InputState {
      const i = players.indexOf(playerId);
      return i === -1 ? { ...IDLE_INPUT } : (state[i] as InputState);
    },
  };
}

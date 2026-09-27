// Отправка ввода (§10): не чаще INPUT_SEND_HZ и только при заметном изменении.
import { INPUT_EPSILON, INPUT_SEND_HZ } from '../shared/config';
import type { InputState } from '../shared/protocol';

const MS_PER_S = 1000;

export interface InputSender {
  update(next: InputState): void;
  /** Отпустить всё (открыли настройки, пауза, потеря фокуса). */
  release(): void;
}

export function createInputSender(
  send: (state: InputState) => void,
  now: () => number = () => performance.now(),
): InputSender {
  const interval = MS_PER_S / INPUT_SEND_HZ;
  let current: InputState = { x: 0, y: 0, btn: false };
  let sent: InputState = { ...current };
  let lastAt = -Infinity;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const axisChanged = (a: number, b: number): boolean => Math.abs(a - b) >= INPUT_EPSILON || (a === 0 && b !== 0);
  const changed = (): boolean =>
    current.btn !== sent.btn || axisChanged(current.x, sent.x) || axisChanged(current.y, sent.y);

  const flush = (): void => {
    timer = null;
    if (!changed()) return;
    lastAt = now();
    sent = { ...current };
    send(sent);
  };

  const update = (next: InputState): void => {
    current = next;
    if (timer || !changed()) return;
    const wait = lastAt + interval - now();
    if (wait <= 0) flush();
    else timer = setTimeout(flush, wait);
  };

  return { update, release: () => update({ x: 0, y: 0, btn: false }) };
}

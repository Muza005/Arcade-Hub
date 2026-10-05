// Отправка ввода (§10): не чаще INPUT_SEND_HZ и только при заметном изменении; нажатие и отпускание — сразу.
import { INPUT_EPSILON, INPUT_SEND_HZ } from '../shared/config';
import type { InputState } from '../shared/protocol';

const MS_PER_S = 1000;

export interface InputSender {
  update(next: InputState): void;
  /** Отпустить всё (открыли настройки, пауза, потеря фокуса). */
  release(): void;
  /** Повторить последнее отправленное состояние (канал без гарантии доставки). */
  resend(): void;
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
    const pressChanged = next.btn !== current.btn;
    const released = next.x === 0 && next.y === 0 && (current.x !== 0 || current.y !== 0);
    current = next;
    // Нажатие кнопки и отпускание джойстика уходят сразу — их задержку чувствуешь сильнее всего.
    if ((pressChanged || released) && changed()) {
      if (timer) clearTimeout(timer);
      timer = null;
      flush();
      return;
    }
    if (timer || !changed()) return;
    const wait = lastAt + interval - now();
    if (wait <= 0) flush();
    else timer = setTimeout(flush, wait);
  };

  return {
    update,
    release: () => update({ x: 0, y: 0, btn: false }),
    resend: () => {
      if (!timer) send({ ...sent });
    },
  };
}

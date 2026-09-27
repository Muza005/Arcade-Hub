// Короткое сообщение внизу экрана («Теперь выбирает Аня»). Сообщения без технических кодов (§15).
import { TOAST_MS } from '../../shared/config';
import { h } from './dom';

export interface Toast {
  readonly el: HTMLElement;
  show(text: string, color?: string): void;
}

export function createToast(): Toast {
  const el = h('div', { class: 'toast', role: 'status', hidden: true });
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    el,
    show(text, color) {
      el.textContent = text;
      el.style.cssText = color ? `--player: ${color}` : '';
      el.hidden = false;
      el.classList.remove('toast--in');
      void el.offsetWidth;
      el.classList.add('toast--in');
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => (el.hidden = true), TOAST_MS);
    },
  };
}

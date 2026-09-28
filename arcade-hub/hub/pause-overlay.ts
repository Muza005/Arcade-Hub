// Пауза на большом экране (ARCADE_HUB_SPEC §10 «Пауза», артборд «Пауза — большой экран»):
// игра замирает под затемнением, по центру — значок, «ПАУЗА», кто поставил, «Продолжить» и «Завершить матч»
// (клавиатура, мышь; с телефона ведущего — своё окно). Esc — продолжить.
// Снизу — QR комнаты: выпавший игрок возвращается на своё место прямо посреди матча.
import { QR_SIZE_PX } from '../shared/config';
import { t } from '../shared/i18n';
import { h } from './ui/dom';
import { BACK_EVENT } from './ui/focus';
import { qrSvg } from './ui/qr';

export interface PauseOverlay {
  readonly el: HTMLElement;
  /** paused = false — убрать. by — ник поставившего (пусто — с клавиатуры). */
  show(paused: boolean, by?: string, roomCode?: string | null): void;
}

export interface PauseActions {
  resume(): void;
  end(): void;
}

export function createPauseOverlay(actions: PauseActions): PauseOverlay {
  const by = h('p', { class: 'pause__by' });
  const qr = h('div', { class: 'pause__qr', 'aria-hidden': 'true' });
  const code = h('p', { class: 'pause__code' });
  const resume = h('button', { class: 'btn pause__resume', type: 'button', autofocus: true }, t('ctrl.pause.resume'));
  const end = h('button', { class: 'btn btn--ghost pause__end', type: 'button' }, t('ctrl.pause.end'));
  resume.addEventListener('click', () => actions.resume());
  end.addEventListener('click', () => actions.end());
  const rejoin = h(
    'div',
    { class: 'pause__rejoin' },
    qr,
    h('div', {}, h('p', { class: 'pause__rejoin-text' }, t('pause.rejoin')), code),
  );
  const el = h(
    'div',
    { class: 'pause', role: 'status', hidden: true, 'data-focus-scope': true },
    h('span', { class: 'pause__icon', 'aria-hidden': 'true' }),
    h('p', { class: 'pause__title' }, t('pause.title')),
    by,
    h('div', { class: 'pause__actions' }, resume, end),
    rejoin,
  );
  el.addEventListener(BACK_EVENT, () => actions.resume());
  return {
    el,
    show(paused, nick = '', roomCode) {
      const wasHidden = el.hidden;
      el.hidden = !paused;
      if (!paused) return;
      by.hidden = nick === '';
      by.textContent = nick ? t('pause.by', { nick }) : '';
      rejoin.hidden = !roomCode;
      if (roomCode) {
        qr.innerHTML = qrSvg(roomCode, QR_SIZE_PX);
        code.textContent = roomCode;
      }
      if (wasHidden) resume.focus();
    },
  };
}

// Пауза на большом экране (ARCADE_HUB_SPEC §10 «Пауза», артборд «Пауза — большой экран»):
// игра замирает под затемнением, по центру — значок, «ПАУЗА», кто поставил и что делать дальше.
// Снизу — QR комнаты: выпавший игрок возвращается на своё место прямо посреди матча.
import { QR_SIZE_PX } from '../shared/config';
import { t } from '../shared/i18n';
import { h } from './ui/dom';
import { qrSvg } from './ui/qr';

export interface PauseOverlay {
  readonly el: HTMLElement;
  show(nick: string | null, roomCode?: string | null): void;
}

export function createPauseOverlay(): PauseOverlay {
  const by = h('p', { class: 'pause__by' });
  const qr = h('div', { class: 'pause__qr', 'aria-hidden': 'true' });
  const code = h('p', { class: 'pause__code' });
  const rejoin = h(
    'div',
    { class: 'pause__rejoin' },
    qr,
    h('div', {}, h('p', { class: 'pause__rejoin-text' }, t('pause.rejoin')), code),
  );
  const el = h(
    'div',
    { class: 'pause', role: 'status', hidden: true },
    h('span', { class: 'pause__icon', 'aria-hidden': 'true' }),
    h('p', { class: 'pause__title' }, t('pause.title')),
    by,
    h('p', { class: 'pause__hint' }, t('pause.hint')),
    rejoin,
  );
  return {
    el,
    show(nick, roomCode) {
      el.hidden = nick === null;
      if (nick === null) return;
      by.textContent = t('pause.by', { nick });
      rejoin.hidden = !roomCode;
      if (roomCode) {
        qr.innerHTML = qrSvg(roomCode, QR_SIZE_PX);
        code.textContent = roomCode;
      }
    },
  };
}

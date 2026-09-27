// Пауза на большом экране (ARCADE_HUB_SPEC §10 «Пауза», артборд «Пауза — большой экран»):
// игра замирает под затемнением, по центру — значок, «ПАУЗА», кто поставил и что делать дальше.
import { t } from '../shared/i18n';
import { h } from './ui/dom';

export interface PauseOverlay {
  readonly el: HTMLElement;
  show(nick: string | null): void;
}

export function createPauseOverlay(): PauseOverlay {
  const by = h('p', { class: 'pause__by' });
  const el = h(
    'div',
    { class: 'pause', role: 'status', hidden: true },
    h('span', { class: 'pause__icon', 'aria-hidden': 'true' }),
    h('p', { class: 'pause__title' }, t('pause.title')),
    by,
    h('p', { class: 'pause__hint' }, t('pause.hint')),
  );
  return {
    el,
    show(nick) {
      el.hidden = nick === null;
      if (nick !== null) by.textContent = t('pause.by', { nick });
    },
  };
}

// Окно игры поверх меню (ARCADE_HUB_SPEC §7).
// Закрывается по Esc, клику по затемнению, крестику и «Назад к играм»; фокус возвращается на карточку.
import type { GameControl, GameManifest } from '../../shared/game-manifest';
import { t } from '../../shared/i18n';
import { h, icon } from '../ui/dom';
import { BACK_EVENT } from '../ui/focus';
import { ICONS } from '../ui/icons';
import { accentStyle, gameText, minutesLabel, playersLabel } from './game-card';
import { recordsView } from './records-view';

export interface GameWindow {
  readonly el: HTMLDialogElement;
  readonly openGameId: string | null;
  open(game: GameManifest, returnFocus: HTMLElement): void;
  close(): void;
}

function controlsLabel(controls: readonly GameControl[]): string {
  const keyboard = controls.includes('keyboard');
  const phone = controls.some((c) => c !== 'keyboard');
  if (keyboard && phone) return t('game.controls.keyboardPhone');
  return keyboard ? t('game.controls.keyboard') : t('game.controls.phone');
}

function recordLines(game: GameManifest): string[] {
  const meta = game.meta?.();
  const lines = [meta?.dailyBest, meta?.localBest ?? meta?.lastMatch].filter((l): l is string => Boolean(l));
  return lines.length > 0 ? lines : [t('game.noRecord')];
}

function fact(svg: string, text: string): HTMLElement {
  return h('li', { class: 'chip' }, icon(svg, 'chip__icon'), text);
}

function content(game: GameManifest, onPlay: () => void, onClose: () => void, onRecords: () => void): HTMLElement {
  const tg = gameText(game);
  const play = h('button', { class: 'btn btn--play', type: 'button', autofocus: true }, t('game.play'));
  const back = h('button', { class: 'btn btn--ghost', type: 'button' }, t('game.back'));
  const records = h('button', { class: 'link-btn gw__records', type: 'button' }, t('game.records'));
  records.addEventListener('click', onRecords);
  const close = h(
    'button',
    { class: 'gw__close', type: 'button', 'aria-label': t('game.close') },
    h('kbd', { class: 'gw__close-key' }, t('game.closeKey')),
    icon(ICONS.close, 'gw__close-icon'),
  );
  play.addEventListener('click', onPlay);
  back.addEventListener('click', onClose);
  close.addEventListener('click', onClose);

  return h(
    'article',
    { class: 'gw', style: accentStyle(game), 'aria-labelledby': 'gw-title' },
    h(
      'header',
      { class: 'gw__cover' },
      h('img', { class: 'gw__cover-img', src: game.cover, alt: '' }),
      h('span', { class: 'gw__scrim' }),
      h(
        'div',
        { class: 'gw__heading' },
        h('h2', { class: 'gw__title', id: 'gw-title' }, tg(game.title)),
        h('p', { class: 'gw__tagline' }, tg(game.tagline)),
      ),
      close,
    ),
    h(
      'div',
      { class: 'gw__body' },
      h(
        'div',
        { class: 'gw__main' },
        h(
          'ul',
          { class: 'gw__facts' },
          fact(ICONS.users, playersLabel(game)),
          fact(ICONS.clock, minutesLabel(game)),
          fact(ICONS.gamepad, controlsLabel(game.controls)),
        ),
        h(
          'ul',
          { class: 'gw__modes' },
          ...game.modes.map((mode) =>
            h(
              'li',
              { class: 'mode' },
              h('img', { class: 'mode__icon', src: mode.icon, alt: '' }),
              h('span', { class: 'mode__title' }, tg(mode.title)),
              h('span', { class: 'mode__desc' }, tg(mode.description)),
            ),
          ),
        ),
        h(
          'section',
          { class: 'gw__how' },
          h('h3', { class: 'gw__label' }, t('game.howTo')),
          h('ol', { class: 'steps' }, ...game.howToPlay.map((step) => h('li', { class: 'step' }, tg(step)))),
        ),
      ),
      h(
        'aside',
        { class: 'gw__side' },
        h(
          'section',
          { class: 'gw__record' },
          h('h3', { class: 'gw__label' }, t('game.record')),
          ...recordLines(game).map((line) => h('p', { class: 'gw__record-line' }, line)),
        ),
        records,
        h('div', { class: 'gw__actions' }, play, back),
      ),
    ),
  );
}

export function createGameWindow(onPlay: (game: GameManifest) => void): GameWindow {
  const el = h('dialog', { class: 'gw-dialog' });
  let current: { game: GameManifest; returnFocus: HTMLElement } | null = null;

  const close = (): void => {
    if (!current) return;
    const { returnFocus } = current;
    current = null;
    el.close();
    el.replaceChildren();
    returnFocus.focus();
  };

  // Esc: закрываем сами, чтобы фокус вернулся на карточку.
  el.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  el.addEventListener(BACK_EVENT, () => close());
  // Клик мимо окна: диалог растянут на весь экран, само окно — внутри.
  el.addEventListener('click', (e) => {
    if (e.target === el) close();
  });

  return {
    el,
    get openGameId() {
      return current?.game.id ?? null;
    },
    open(game, returnFocus) {
      current = { game, returnFocus };
      const showMain = (): void => {
        el.replaceChildren(
          content(
            game,
            () => onPlay(game),
            () => close(),
            () => {
              el.replaceChildren(recordsView(game, showMain));
              el.querySelector<HTMLElement>('[autofocus]')?.focus();
            },
          ),
        );
        el.querySelector<HTMLElement>('[autofocus]')?.focus();
      };
      showMain();
      el.showModal();
    },
    close,
  };
}

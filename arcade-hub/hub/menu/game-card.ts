// Карточка игры в сетке (ARCADE_HUB_SPEC §6 «Карточка игры»).
import type { GameManifest } from '../../shared/game-manifest';
import { createTranslator, t, tn } from '../../shared/i18n';
import { h, icon } from '../ui/dom';
import { ICONS } from '../ui/icons';
import { range, type Badge } from './catalog';

export function gameText(game: GameManifest): (key: string) => string {
  const tg = createTranslator(game.strings);
  return (key) => tg(key);
}

export function playersLabel(game: GameManifest): string {
  const { min, max } = game.players;
  return tn('game.players', max, { range: range([min, max]) });
}

export function minutesLabel(game: GameManifest): string {
  return t('game.minutes', { range: range(game.sessionMinutes) });
}

function badgeLabel(badge: Badge): string {
  switch (badge.kind) {
    case 'daily':
      return t('badge.daily');
    case 'needMore':
      return t('badge.needMore', { n: badge.n });
    case 'max':
      return t('badge.max', { n: badge.n });
    case 'new':
      return t('badge.new');
  }
}

/** Цвет фона-заглушки, пока грузится обложка. */
export function accentStyle(game: GameManifest): string {
  return `--accent: ${game.accent}; --accent-alt: ${game.accentAlt ?? game.accent}`;
}

export function gameCard(game: GameManifest, badge: Badge | null): HTMLButtonElement {
  const tg = gameText(game);
  return h(
    'button',
    { class: 'card', type: 'button', 'data-game': game.id, style: accentStyle(game) },
    h('img', { class: 'card__cover', src: game.cover, alt: '', decoding: 'async' }),
    h('span', { class: 'card__scrim' }),
    badge && h('span', { class: `badge badge--${badge.kind === 'new' ? 'white' : 'yellow'}` }, badgeLabel(badge)),
    h(
      'span',
      { class: 'card__footer' },
      h('span', { class: 'card__title' }, tg(game.title)),
      h('span', { class: 'card__meta' }, `${playersLabel(game)} · ${minutesLabel(game)}`),
    ),
  );
}

/** Последняя карточка: без названий и обещаний. Фокусируется, чтобы стрелками можно было докрутить сетку до конца. */
export function soonCard(): HTMLElement {
  return h(
    'div',
    { class: 'card card--soon', tabindex: '0', 'data-focusable': true },
    icon(ICONS.plus, 'card__plus'),
    h('span', { class: 'card__soon-label' }, t('menu.soon')),
  );
}

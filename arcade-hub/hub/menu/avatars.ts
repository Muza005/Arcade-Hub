// Ряд игроков в нижней полосе (ARCADE_HUB_SPEC §6 «Ряд игроков»).
import { MENU_AVATARS_MAX } from '../../shared/config';
import { t } from '../../shared/i18n';
import type { RoomPlayer } from '../room';
import { h, icon } from '../ui/dom';
import { ICONS } from '../ui/icons';

export function avatar(player: RoomPlayer, isNew = false): HTMLElement {
  const classes = ['avatar', player.connected ? '' : 'avatar--offline', isNew ? 'avatar--new' : '']
    .filter(Boolean)
    .join(' ');
  const title = [player.nick, player.leader && t('menu.leader'), !player.connected && t('menu.offline')]
    .filter(Boolean)
    .join(' · ');
  return h(
    'li',
    { class: classes, title, style: `--player: ${player.color}` },
    h(
      'span',
      { class: 'avatar__circle' },
      player.nick.slice(0, 1).toUpperCase(),
      player.leader && icon(ICONS.crown, 'avatar__crown'),
      !player.connected && icon(ICONS.offline, 'avatar__offline'),
    ),
    h('span', { class: 'avatar__nick' }, player.nick),
  );
}

/** Не больше MENU_AVATARS_MAX мест: если людей больше, последнее место — «+N». */
export function avatarRow(players: readonly RoomPlayer[], fresh: ReadonlySet<string> = new Set()): HTMLElement {
  const overflow = players.length > MENU_AVATARS_MAX;
  const shown = overflow ? players.slice(0, MENU_AVATARS_MAX - 1) : players;
  const row = h('ul', { class: 'avatars' }, ...shown.map((p) => avatar(p, fresh.has(p.id))));
  if (overflow) {
    row.append(
      h(
        'li',
        { class: 'avatar avatar--more' },
        h('span', { class: 'avatar__circle' }, `+${players.length - shown.length}`),
      ),
    );
  }
  return row;
}

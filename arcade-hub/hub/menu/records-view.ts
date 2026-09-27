// «Рекорды и записи» в окне игры (§7, §12): карточки рекордов, пьедестал последнего матча, записи матчей.
// Воспроизведение записи — дело игры; здесь только то, что хранит платформа.
import type { GameManifest } from '../../shared/game-manifest';
import { getLang, t } from '../../shared/i18n';
import { dailyBest, readRecords, type MatchRow, type RecordEntry } from '../../shared/records';
import { isCompatible, listReplays, type Replay } from '../../shared/replays';
import { h, icon } from '../ui/dom';
import { ICONS } from '../ui/icons';
import { accentStyle, gameText } from './game-card';

/** Пьедестал: второе место слева, первое в центре, третье справа. */
const PODIUM_ORDER = [2, 1, 3];
const PODIUM_SIZE = PODIUM_ORDER.length;
/** Сколько аватаров показать в записи, дальше — «+N». */
const REPLAY_AVATARS = 5;

function formatDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return day;
  return new Intl.DateTimeFormat(getLang(), { day: 'numeric', month: 'long' }).format(new Date(y, m - 1, d));
}

function avatar(nick: string, color: string | undefined, className = 'rv-avatar'): HTMLElement {
  return h(
    'span',
    { class: `${className}${color ? '' : ' rv-avatar--plain'}`, style: color ? `--player: ${color}` : '' },
    nick.slice(0, 1).toUpperCase(),
  );
}

function recordCard(kind: 'best' | 'daily', svg: string, label: string, entry: RecordEntry | undefined): HTMLElement {
  if (!entry) {
    return h(
      'div',
      { class: `rcard rcard--${kind} rcard--empty` },
      h('span', { class: 'rcard__icon' }, icon(svg)),
      h('span', { class: 'rcard__label' }, label),
      h('span', { class: 'rcard__none' }, t('records.none')),
    );
  }
  return h(
    'div',
    { class: `rcard rcard--${kind}`, style: entry.color ? `--player: ${entry.color}` : '' },
    h('span', { class: 'rcard__icon' }, icon(svg)),
    h('span', { class: 'rcard__label' }, label),
    h('span', { class: 'rcard__score' }, String(entry.score)),
    h('span', { class: 'rcard__who' }, avatar(entry.nick, entry.color), h('span', { class: 'rcard__nick' }, entry.nick)),
    h('span', { class: 'rcard__date' }, formatDate(entry.date)),
  );
}

function podium(rows: readonly MatchRow[]): HTMLElement {
  const sorted = [...rows].sort((a, b) => a.place - b.place);
  const top = sorted.slice(0, PODIUM_SIZE);
  const rest = sorted.slice(PODIUM_SIZE);
  const steps = PODIUM_ORDER.map((rank) => top[rank - 1])
    .filter((r): r is MatchRow => r !== undefined)
    .map((r) =>
      h(
        'li',
        { class: `pstep pstep--${Math.min(r.place, PODIUM_SIZE)}` },
        avatar(r.nick, r.color, 'rv-avatar pstep__avatar'),
        h('span', { class: 'pstep__nick' }, r.nick),
        h('span', { class: 'pstep__score' }, String(r.score)),
        h('span', { class: 'pstep__block' }, h('span', { class: 'pstep__place' }, String(r.place))),
      ),
    );
  return h(
    'div',
    { class: 'podium' },
    h('ol', { class: 'podium__steps' }, ...steps),
    rest.length > 0 &&
      h(
        'ul',
        { class: 'podium__rest' },
        ...rest.map((r) =>
          h(
            'li',
            { class: 'rest-chip' },
            h('span', { class: 'rest-chip__place' }, String(r.place)),
            avatar(r.nick, r.color, 'rv-avatar rv-avatar--sm'),
            r.nick,
            h('span', { class: 'rest-chip__score' }, String(r.score)),
          ),
        ),
      ),
  );
}

function replayCard(replay: Replay, version: string): HTMLElement {
  const compatible = isCompatible(replay, version);
  const shown = replay.players.slice(0, REPLAY_AVATARS);
  const more = replay.players.length - shown.length;
  return h(
    'li',
    { class: `replay${compatible ? '' : ' replay--old'}` },
    h('span', { class: 'replay__icon' }, icon(ICONS.film)),
    h('span', { class: 'replay__date' }, formatDate(replay.date)),
    h(
      'span',
      { class: 'replay__players', title: replay.players.map((p) => p.nick).join(', ') },
      ...shown.map((p) => avatar(p.nick, p.color, 'rv-avatar rv-avatar--sm replay__avatar')),
      more > 0 && h('span', { class: 'rv-avatar rv-avatar--sm rv-avatar--plain replay__avatar' }, `+${more}`),
    ),
    h(
      'span',
      { class: 'replay__tags' },
      replay.daily && h('span', { class: 'tag tag--daily' }, icon(ICONS.sun), t('records.dailyMark')),
      !compatible && h('span', { class: 'tag tag--old' }, icon(ICONS.alert), t('records.incompatible')),
    ),
  );
}

export function recordsView(game: GameManifest, onBack: () => void): HTMLElement {
  const records = readRecords(game.id);
  const replays = listReplays(game.id);
  const back = h(
    'button',
    { class: 'rv__back', type: 'button', autofocus: true },
    icon(ICONS.back),
    t('lobby.back'),
  );
  back.addEventListener('click', onBack);

  const sectionTitle = (svg: string, text: string): HTMLElement =>
    h('h3', { class: 'rv__section-title' }, icon(svg), text);

  return h(
    'article',
    { class: 'gw rv', style: accentStyle(game), 'aria-labelledby': 'gw-title' },
    h(
      'header',
      { class: 'rv__head' },
      h('img', { class: 'gw__cover-img', src: game.cover, alt: '' }),
      h('span', { class: 'gw__scrim' }),
      h(
        'div',
        { class: 'rv__heading' },
        h('span', { class: 'rv__badge' }, icon(ICONS.trophy)),
        h(
          'div',
          {},
          h('h2', { class: 'rv__title', id: 'gw-title' }, gameText(game)(game.title)),
          h('p', { class: 'rv__subtitle' }, t('game.records')),
        ),
      ),
      back,
    ),
    h(
      'div',
      { class: 'rv__body' },
      h(
        'div',
        { class: 'rv__col rv__col--cards' },
        recordCard('best', ICONS.trophy, t('records.best'), records.best),
        recordCard('daily', ICONS.sun, t('records.daily'), dailyBest(records)),
      ),
      h(
        'div',
        { class: 'rv__col' },
        h(
          'section',
          { class: 'rv__section' },
          sectionTitle(ICONS.flag, records.last ? `${t('records.last')} · ${formatDate(records.last.date)}` : t('records.last')),
          records.last ? podium(records.last.rows) : h('p', { class: 'rv__none' }, t('records.none')),
        ),
        h(
          'section',
          { class: 'rv__section' },
          sectionTitle(ICONS.film, t('records.replays')),
          replays.length > 0
            ? h('ul', { class: 'replays' }, ...replays.map((r) => replayCard(r, game.version)))
            : h('p', { class: 'rv__none' }, t('records.none')),
        ),
      ),
    ),
  );
}

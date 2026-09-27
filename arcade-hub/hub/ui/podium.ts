// Пьедестал мест: второе слева, первое в центре и выше, третье справа, остальные — чипы.
// Общий для итогов матча и экрана «Рекорды и записи».
import { h } from './dom';

/** Строка пьедестала: счёт — число или готовая строка игры. */
export interface PodiumRow {
  nick: string;
  color?: string;
  place: number;
  score: number | string;
}

const PODIUM_ORDER = [2, 1, 3];
const PODIUM_SIZE = PODIUM_ORDER.length;

export function avatar(nick: string, color: string | undefined, className = 'rv-avatar'): HTMLElement {
  return h(
    'span',
    { class: `${className}${color ? '' : ' rv-avatar--plain'}`, style: color ? `--player: ${color}` : '' },
    nick.slice(0, 1).toUpperCase(),
  );
}

export function podium(rows: readonly PodiumRow[]): HTMLElement {
  const sorted = [...rows].sort((a, b) => a.place - b.place);
  const top = sorted.slice(0, PODIUM_SIZE);
  const rest = sorted.slice(PODIUM_SIZE);
  const steps = PODIUM_ORDER.map((rank) => top[rank - 1])
    .filter((r): r is PodiumRow => r !== undefined)
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

// Пьедестал мест: второе слева, первое в центре и выше, третье справа, остальные — чипы.
// Общий для итогов матча и экрана «Рекорды и записи».
import { h } from './dom';

/** Строка пьедестала: счёт — число или готовая строка игры. */
export interface PodiumRow {
  nick: string;
  color?: string;
  place: number;
  score: number | string;
  /** SVG-аватар в цвете игрока вместо буквы. */
  icon?: string;
  /** Полоска под ником: value из max. */
  bar?: { value: number; max: number };
}

const barOf = (r: PodiumRow, className: string): HTMLElement | false =>
  r.bar !== undefined &&
  h(
    'span',
    { class: className, style: `--fill: ${r.bar.max > 0 ? Math.min(1, Math.max(0, r.bar.value / r.bar.max)) : 0}` },
    h('span', { class: 'pbar__fill' }),
  );

const avatarOf = (r: PodiumRow, className: string): HTMLElement => {
  const node = avatar(r.nick, r.color, className);
  if (r.icon) {
    node.classList.add('rv-avatar--icon');
    node.innerHTML = r.icon;
  }
  return node;
};

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
        avatarOf(r, 'rv-avatar pstep__avatar'),
        h('span', { class: 'pstep__nick' }, r.nick),
        barOf(r, 'pbar'),
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
            avatarOf(r, 'rv-avatar rv-avatar--sm'),
            r.nick,
            barOf(r, 'pbar pbar--chip'),
            h('span', { class: 'rest-chip__score' }, String(r.score)),
          ),
        ),
      ),
  );
}

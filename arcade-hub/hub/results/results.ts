// Итоги матча (ARCADE_HUB_SPEC §12) в три шага: повтор конца → именные награды → места (пьедестал).
// Содержимое шагов присылает игра; оболочка отвечает за порядок, анимацию и кнопки.
// После итогов фокус на «Ещё раз»; рядом «К игре» и «В меню».
import { RESULTS_AWARD_STEP_MS, RESULTS_AWARDS_HOLD_MS } from '../../shared/config';
import type { GamePlayer, MatchResult, MatchResults, ResultsTable } from '../../shared/game-manifest';
import { t } from '../../shared/i18n';
import { h, icon } from '../ui/dom';
import { ICONS } from '../ui/icons';
import { podium } from '../ui/podium';

export type ResultsChoice = 'again' | 'game' | 'menu';

export interface ResultsInput {
  result: MatchResult;
  players: readonly GamePlayer[];
  content: MatchResults | undefined;
  /** Шаг 1: повтор на сцене игры. Нет — итоги начинаются с наград (повтор выключен в настройках хаба). */
  replay?: () => Promise<void>;
  beaten: { best: boolean; daily: boolean };
  accent: string;
  /** Рекорд дня этой игры (строка из meta()) — над таблицей. */
  daily?: string;
}

export interface Results {
  readonly el: HTMLElement;
  /** Проводит итоги и ждёт выбора игроков. */
  run(input: ResultsInput): Promise<ResultsChoice>;
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Аватар награды: иконка игры (корабль) или буква ника. */
function awardAvatar(svg: string | undefined, nick: string): HTMLElement {
  const node = h('span', { class: `award__avatar${svg ? ' award__avatar--icon' : ''}` }, svg ? '' : nick.slice(0, 1).toUpperCase());
  if (svg) node.innerHTML = svg;
  return node;
}

export function createResults(): Results {
  const el = h('section', { class: 'results', 'data-focus-scope': true, hidden: true });

  return {
    el,
    async run(input) {
      const { result, players, content } = input;
      const byId = new Map(players.map((p) => [p.id, p]));
      el.style.cssText = `--accent: ${input.accent}`;
      el.hidden = false;

      // «Дальше» пропускает текущий шаг — с клавиатуры или главной кнопкой ведущего.
      let skip: () => void = () => undefined;
      const skipButton = h('button', { class: 'results__skip', type: 'button', autofocus: true }, t('results.skip'));
      skipButton.addEventListener('click', () => skip());
      const skippable = (work: Promise<void>): Promise<void> =>
        Promise.race([work, new Promise<void>((r) => (skip = r))]);

      // 1. Повтор конца матча — на сцене игры, под плашкой.
      if (input.replay) {
        el.dataset.step = 'replay';
        el.replaceChildren(h('span', { class: 'results__chip' }, t('results.replay')), skipButton);
        skipButton.focus();
        await skippable(input.replay());
      }

      // 2. Именные награды — по одной.
      const awards = content?.awards ?? [];
      if (awards.length > 0) {
        el.dataset.step = 'awards';
        const list = h('ul', { class: 'awards' });
        el.replaceChildren(h('h2', { class: 'results__title' }, t('results.title')), list, skipButton);
        skipButton.focus();
        await skippable(
          (async () => {
            for (const award of awards) {
              const player = byId.get(award.playerId);
              list.append(
                h(
                  'li',
                  { class: 'award', style: `--player: ${player?.color ?? 'var(--text)'}` },
                  awardAvatar(award.icon, player?.nick ?? '?'),
                  h('span', { class: 'award__title' }, award.title),
                  h('span', { class: 'award__nick' }, player?.nick ?? ''),
                  award.value && h('span', { class: 'award__value' }, award.value),
                ),
              );
              await wait(RESULTS_AWARD_STEP_MS);
            }
            await wait(RESULTS_AWARDS_HOLD_MS);
          })(),
        );
      }

      // 3. Таблица по строке на игрока и кнопки.
      el.dataset.step = 'table';
      const table: ResultsTable = content?.table ?? {
        columns: [t('results.score')],
        rows: result.rows.map((r) => ({ playerId: r.playerId, cells: [String(r.score)] })),
      };
      const placeOf = new Map(result.rows.map((r) => [r.playerId, r.place]));
      const note = input.beaten.daily ? t('results.newDaily') : input.beaten.best ? t('results.newBest') : '';
      const again = h('button', { class: 'btn btn--play', type: 'button' }, t('results.again'));
      const toGame = h('button', { class: 'btn btn--ghost', type: 'button' }, t('results.toGame'));
      const toMenu = h('button', { class: 'btn btn--ghost', type: 'button' }, t('results.toMenu'));
      el.replaceChildren(
        h(
          'div',
          { class: 'results__panel' },
          h(
            'header',
            { class: 'results__head' },
            h('span', { class: 'results__badge' }, icon(ICONS.trophy)),
            h('h2', { class: 'results__title' }, t('results.title')),
            table.columns[0] && h('span', { class: 'results__column' }, table.columns[0]),
            note && h('span', { class: 'results__note' }, note),
          ),
          input.daily && h('p', { class: 'results__daily' }, input.daily),
          podium(
            table.rows.map((row) => {
              const player = byId.get(row.playerId);
              return {
                nick: player?.nick ?? row.playerId,
                ...(player?.color ? { color: player.color } : {}),
                place: placeOf.get(row.playerId) ?? 0,
                // Счёт — первая колонка игры; её заголовок стоит рядом с «Итоги».
                score: row.cells[0] ?? '',
                ...(row.icon ? { icon: row.icon } : {}),
                ...(row.bar ? { bar: row.bar } : {}),
              };
            }),
          ),
          h('div', { class: 'results__actions' }, again, toGame, toMenu),
        ),
      );
      again.focus();

      const choice = await new Promise<ResultsChoice>((resolve) => {
        again.addEventListener('click', () => resolve('again'));
        toGame.addEventListener('click', () => resolve('game'));
        toMenu.addEventListener('click', () => resolve('menu'));
      });
      el.hidden = true;
      el.replaceChildren();
      return choice;
    },
  };
}

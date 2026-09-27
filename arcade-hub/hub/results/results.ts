// Итоги матча (ARCADE_HUB_SPEC §12) в три шага: повтор конца → именные награды → таблица.
// Содержимое шагов присылает игра; оболочка отвечает за порядок, анимацию и кнопки.
// После итогов фокус на «Ещё раз»; рядом «К игре» и «В меню».
import { RESULTS_AWARD_STEP_MS, RESULTS_AWARDS_HOLD_MS } from '../../shared/config';
import type { GamePlayer, MatchResult, MatchResults } from '../../shared/game-manifest';
import { t } from '../../shared/i18n';
import { h } from '../ui/dom';

export type ResultsChoice = 'again' | 'game' | 'menu';

export interface ResultsInput {
  result: MatchResult;
  players: readonly GamePlayer[];
  content: MatchResults | undefined;
  /** Шаг 1: повтор на сцене игры. */
  replay(): Promise<void>;
  beaten: { best: boolean; daily: boolean };
  accent: string;
}

export interface Results {
  readonly el: HTMLElement;
  /** Проводит итоги и ждёт выбора игроков. */
  run(input: ResultsInput): Promise<ResultsChoice>;
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

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
      el.dataset.step = 'replay';
      el.replaceChildren(h('span', { class: 'results__chip' }, t('results.replay')), skipButton);
      skipButton.focus();
      await skippable(input.replay());

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
                  h('span', { class: 'award__avatar' }, (player?.nick ?? '?').slice(0, 1).toUpperCase()),
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
      const table = content?.table ?? {
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
          h('h2', { class: 'results__title' }, t('results.title')),
          note && h('p', { class: 'results__note' }, note),
          h(
            'table',
            { class: 'rtable' },
            h(
              'thead',
              {},
              h('tr', {}, h('th', {}, '#'), h('th', {}, t('results.player')), ...table.columns.map((c) => h('th', {}, c))),
            ),
            h(
              'tbody',
              {},
              ...table.rows.map((row) => {
                const player = byId.get(row.playerId);
                return h(
                  'tr',
                  { style: `--player: ${player?.color ?? 'var(--text)'}` },
                  h('td', { class: 'rtable__place' }, String(placeOf.get(row.playerId) ?? '')),
                  h('td', { class: 'rtable__player' }, h('span', { class: 'rtable__dot' }), player?.nick ?? row.playerId),
                  ...row.cells.map((c) => h('td', { class: 'rtable__cell' }, c)),
                );
              }),
            ),
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

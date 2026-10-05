// Просмотр записи матча (ARCADE_HUB_SPEC §12): пересчёт матча по сиду и потоку ввода с отрисовкой.
// Вперёд — быстрый пересчёт без отрисовки; назад — пересчёт с начала. На шкале — метки игры (волны, гибели).
// Управление: пауза (пробел), замедление, перемотка (← →, клик по шкале), закрыть (Esc).
import { createInputPlayback, type ActionEvent } from '../engine/replay';
import {
  DEFAULT_ASPECT,
  FIXED_STEP_HZ,
  REPLAY_MAX_STEPS_PER_FRAME,
  REPLAY_SEEK_BUDGET_MS,
  REPLAY_SEEK_STEP_S,
  REPLAY_SPEEDS,
} from '../shared/config';
import type { GameManifest, GameModule, GamePlayer } from '../shared/game-manifest';
import { t } from '../shared/i18n';
import type { Replay } from '../shared/replays';
import { h, icon } from './ui/dom';
import { ICONS } from './ui/icons';

const DT = 1 / FIXED_STEP_HZ;
const MS_PER_S = 1000;
const SECONDS_PER_MINUTE = 60;

const clock = (ticks: number): string => {
  const s = Math.floor(ticks / FIXED_STEP_HZ);
  return `${Math.floor(s / SECONDS_PER_MINUTE)}:${String(s % SECONDS_PER_MINUTE).padStart(2, '0')}`;
};

export interface ReplayPlayerHooks {
  /** Приглушить звук на время быстрой перемотки. */
  mute(on: boolean): void;
}

export interface ReplayPlayer {
  readonly el: HTMLElement;
  /** Показать запись; промис — когда закрыли. */
  play(game: GameManifest, replay: Replay): Promise<void>;
}

export function createReplayPlayer(hooks: ReplayPlayerHooks): ReplayPlayer {
  const el = h('section', { class: 'rplayer', hidden: true });
  const mount = h('div', { class: 'game-mount' });
  const playBtn = h('button', { class: 'rplayer__btn', type: 'button' });
  const speedBtn = h('button', { class: 'rplayer__speed', type: 'button', 'aria-label': t('replay.speed') });
  const track = h('div', { class: 'rplayer__track' });
  const fill = h('span', { class: 'rplayer__fill' });
  const marksLayer = h('div', { class: 'rplayer__marks' });
  track.append(fill, marksLayer);
  const time = h('span', { class: 'rplayer__time' });
  const closeBtn = h('button', { class: 'rplayer__btn', type: 'button', 'aria-label': t('replay.close') }, icon(ICONS.close));
  const seekingNote = h('span', { class: 'rplayer__seeking', hidden: true }, t('replay.seeking'));
  const bar = h('div', { class: 'rplayer__bar' }, playBtn, speedBtn, track, time, closeBtn);
  el.append(mount, seekingNote, bar);

  return {
    el,
    play(manifest, replay) {
      return new Promise<void>((done) => {
        const humans = replay.players.filter((p) => p.kind !== 'bot').map((p) => p.id);
        const actions: readonly ActionEvent[] = replay.actions ?? [];
        const lastInput = replay.inputs.at(-1)?.[0] ?? 0;
        const total = Math.max(1, replay.ticks ?? lastInput + FIXED_STEP_HZ);
        const players: GamePlayer[] = replay.players.map((p) => ({
          id: p.id,
          nick: p.nick,
          color: p.color,
          kind: p.kind === 'bot' || p.kind === 'keyboard' ? p.kind : 'phone',
          ...(p.fields ? { fields: p.fields } : {}),
        }));

        let game: GameModule | null = null;
        let playback = createInputPlayback(humans, replay.inputs);
        let cursor = 0;
        let tick = 0;
        let ended = false;
        let playing = true;
        let speedIndex = 0;
        let seeking = false;
        let closed = false;
        let acc = 0;
        let lastMs = performance.now();
        let raf = 0;
        /** Перемотка запрошена во время другой — выполним после. */
        let pendingSeek: number | null = null;

        const boot = async (): Promise<void> => {
          game?.dispose();
          mount.replaceChildren();
          game = await manifest.load();
          playback = createInputPlayback(humans, replay.inputs);
          cursor = 0;
          tick = 0;
          ended = false;
          await game.init({
            players,
            settings: replay.settings,
            mode: replay.mode,
            seed: replay.seed,
            input: { read: (id) => playback.read(id) },
            mount,
            aspect: replay.aspect ?? DEFAULT_ASPECT,
            fx: () => undefined,
            end: () => {
              ended = true;
            },
          });
        };

        /** Один шаг — как в матче: ввод и особые действия этого тика, потом шаг игры. */
        const step = (): void => {
          if (!game || ended) return;
          playback.advance(tick);
          while (cursor < actions.length && (actions[cursor] as ActionEvent)[0] <= tick) {
            const [, i, payload] = actions[cursor] as ActionEvent;
            const id = humans[i];
            if (id) game.action?.(id, payload);
            cursor++;
          }
          game.update(DT, tick);
          tick++;
          // Матч могли завершить досрочно («Завершить матч») — запись кончается там же.
          if (tick >= total) ended = true;
        };

        const drawUi = (): void => {
          fill.style.width = `${Math.min(1, tick / total) * 100}%`;
          time.textContent = `${clock(tick)} / ${clock(total)}`;
          playBtn.replaceChildren(icon(playing && !ended ? ICONS.pause : ICONS.play));
          playBtn.setAttribute('aria-label', t(playing && !ended ? 'replay.pause' : 'replay.play'));
          speedBtn.textContent = `${REPLAY_SPEEDS[speedIndex]}×`;
        };

        const seek = async (target: number): Promise<void> => {
          const goal = Math.max(0, Math.min(total, Math.round(target)));
          if (seeking) {
            pendingSeek = goal;
            return;
          }
          seeking = true;
          seekingNote.hidden = false;
          hooks.mute(true);
          if (goal < tick) await boot();
          // Считаем без отрисовки кусками: интерфейс не замирает.
          while (!closed && tick < goal && !ended) {
            const start = performance.now();
            while (tick < goal && !ended && performance.now() - start < REPLAY_SEEK_BUDGET_MS) step();
            drawUi();
            await new Promise((r) => requestAnimationFrame(r));
          }
          hooks.mute(false);
          seekingNote.hidden = true;
          acc = 0;
          seeking = false;
          if (pendingSeek !== null) {
            const next = pendingSeek;
            pendingSeek = null;
            await seek(next);
          }
        };

        const frame = (now: number): void => {
          if (closed) return;
          const dtS = Math.min(0.25, (now - lastMs) / MS_PER_S);
          lastMs = now;
          if (game && playing && !seeking && !ended) {
            acc += dtS * (REPLAY_SPEEDS[speedIndex] ?? 1);
            let steps = 0;
            while (acc >= DT && steps < REPLAY_MAX_STEPS_PER_FRAME) {
              step();
              acc -= DT;
              steps++;
            }
            if (steps === REPLAY_MAX_STEPS_PER_FRAME) acc = 0;
          }
          if (game && !seeking) game.render(Math.min(1, acc / DT));
          drawUi();
          raf = requestAnimationFrame(frame);
        };

        const close = (): void => {
          if (closed) return;
          closed = true;
          cancelAnimationFrame(raf);
          document.removeEventListener('keydown', onKey, true);
          game?.dispose();
          game = null;
          mount.replaceChildren();
          el.hidden = true;
          hooks.mute(false);
          done();
        };

        const onKey = (e: KeyboardEvent): void => {
          const handled = [' ', 'Escape', 'ArrowLeft', 'ArrowRight'].includes(e.key);
          if (!handled) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          if (e.key === 'Escape') close();
          else if (e.key === ' ') playing = !playing;
          else void seek(tick + (e.key === 'ArrowRight' ? 1 : -1) * REPLAY_SEEK_STEP_S * FIXED_STEP_HZ);
        };

        playBtn.onclick = () => {
          if (ended) void seek(0).then(() => (playing = true));
          else playing = !playing;
        };
        speedBtn.onclick = () => {
          speedIndex = (speedIndex + 1) % REPLAY_SPEEDS.length;
        };
        closeBtn.onclick = close;
        track.onclick = (e) => {
          const r = track.getBoundingClientRect();
          void seek(((e.clientX - r.left) / r.width) * total);
        };
        // Метки игры: волны — тонкие линии, гибели — точки; подпись — во всплывающей подсказке.
        marksLayer.replaceChildren(
          ...(replay.marks ?? []).map((m) =>
            h('span', {
              class: `rplayer__mark rplayer__mark--${m.kind}`,
              style: `left: ${Math.min(1, m.tick / total) * 100}%`,
              title: `${clock(m.tick)} · ${m.label}`,
            }),
          ),
        );

        el.hidden = false;
        document.addEventListener('keydown', onKey, true);
        void boot().then(() => {
          lastMs = performance.now();
          raf = requestAnimationFrame(frame);
        });
      });
    },
  };
}

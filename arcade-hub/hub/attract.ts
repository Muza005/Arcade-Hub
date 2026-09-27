// Режим витрины (ARCADE_HUB_SPEC §14): через 60 с без ввода при пустой комнате интерфейс уходит,
// по очереди показываются игры по 15 с: живая демо-сцена с ботами, ролик из манифеста или обложка.
// Поверх — крупный QR. Любой ввод или вход телефона возвращают меню с фокусом там, где он был.
import { ATTRACT_BOTS, ATTRACT_IDLE_S, ATTRACT_SLIDE_S, BOT_COLORS, QR_SIZE_PX } from '../shared/config';
import type { GameManifest, GamePlayer } from '../shared/game-manifest';
import { createTranslator, t } from '../shared/i18n';
import { randomSeed } from '../engine/rng';
import { runGame, type Match } from './game-runner';
import { h } from './ui/dom';
import { qrSvg } from './ui/qr';

const MS_PER_S = 1000;
const CHECK_MS = 1000;

export interface AttractOptions {
  games: readonly GameManifest[];
  /** Можно ли сейчас начать: меню на экране, комната пуста, «Уменьшить движение» выключено. */
  canStart(): boolean;
  roomCode(): string | null;
  /** Интерфейс меню уходит / возвращается. */
  onStart(): void;
  onStop(): void;
}

export interface Attract {
  readonly el: HTMLElement;
  readonly active: boolean;
  /** Отметить действие людей: сбрасывает отсчёт и останавливает витрину. */
  poke(): void;
}

function botPlayers(game: GameManifest): GamePlayer[] {
  const count = Math.min(ATTRACT_BOTS, game.players.max);
  return Array.from({ length: count }, (_, i) => ({
    id: `demo-${i + 1}`,
    nick: t('lobby.bot', { n: i + 1 }),
    color: BOT_COLORS[i % BOT_COLORS.length] as string,
    kind: 'bot' as const,
  }));
}

export function createAttract(options: AttractOptions): Attract {
  const stage = h('div', { class: 'attract__stage' });
  const qr = h('div', { class: 'attract__qr' });
  const title = h('p', { class: 'attract__game' });
  const code = h('p', { class: 'attract__code' });
  const el = h(
    'section',
    { class: 'attract', hidden: true, 'aria-hidden': 'true' },
    stage,
    h(
      'div',
      { class: 'attract__panel' },
      qr,
      h('div', {}, h('p', { class: 'attract__scan' }, t('attract.scan')), code),
    ),
    title,
  );

  let active = false;
  let lastInput = performance.now();
  let slide = 0;
  let slideTimer: ReturnType<typeof setTimeout> | null = null;
  let match: Match | null = null;

  const clearSlide = (): void => {
    if (slideTimer) clearTimeout(slideTimer);
    slideTimer = null;
    match?.dispose();
    match = null;
    stage.replaceChildren();
  };

  const showSlide = async (): Promise<void> => {
    clearSlide();
    const available = options.games.filter((g) => g.status === 'available');
    const game = available[slide % available.length];
    slide++;
    if (!active || !game) return;
    title.textContent = createTranslator(game.strings)(game.title);
    const roomCode = options.roomCode();
    qr.innerHTML = roomCode ? qrSvg(roomCode, QR_SIZE_PX) : '';
    code.textContent = roomCode ?? '';
    el.style.setProperty('--accent', game.accent);
    slideTimer = setTimeout(() => void showSlide(), ATTRACT_SLIDE_S * MS_PER_S);

    if (game.attract?.kind === 'live') {
      const mount = h('div', { class: 'attract__live' });
      stage.append(mount);
      try {
        const demo = await runGame(game, mount, { players: botPlayers(game), sources: [], seed: randomSeed(), fx: () => undefined });
        if (!active) demo.dispose();
        else match = demo;
      } catch {
        // Демо не загрузилось — остаётся обложка.
        stage.replaceChildren(h('img', { class: 'attract__cover', src: game.cover, alt: '' }));
      }
    } else if (game.attract?.kind === 'video') {
      stage.append(h('video', { class: 'attract__cover', src: game.attract.src, autoplay: true, muted: true, loop: true, playsinline: true }));
    } else {
      stage.append(h('img', { class: 'attract__cover attract__cover--drift', src: game.cover, alt: '' }));
    }
  };

  const start = (): void => {
    active = true;
    el.hidden = false;
    options.onStart();
    void showSlide();
  };

  const stop = (): void => {
    if (!active) return;
    active = false;
    clearSlide();
    el.hidden = true;
    options.onStop();
  };

  setInterval(() => {
    if (active || !options.canStart()) return;
    if (performance.now() - lastInput >= ATTRACT_IDLE_S * MS_PER_S) start();
  }, CHECK_MS);

  const poke = (): void => {
    lastInput = performance.now();
    stop();
  };

  // Любой ввод возвращает меню; сам ввод меню не достаётся, чтобы не открыть случайно игру.
  const onInput = (e: Event): void => {
    if (active) {
      e.preventDefault();
      e.stopPropagation();
    }
    poke();
  };
  document.addEventListener('keydown', onInput, true);
  document.addEventListener('pointerdown', onInput, true);
  document.addEventListener('wheel', () => poke(), { capture: true, passive: true });
  document.addEventListener('pointermove', (e) => {
    if (e.movementX !== 0 || e.movementY !== 0) poke();
  });

  return {
    el,
    get active() {
      return active;
    },
    poke,
  };
}

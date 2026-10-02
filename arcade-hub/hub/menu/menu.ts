// Меню игр (ARCADE_HUB_SPEC §6): верхняя полоса, заголовок, сетка, нижняя полоса с QR и игроками.
// В простое ничего не рисуется: движение — только в ответ на действие.
import { CONTROLLER_PATH, QR_SIZE_PX, QR_ZOOM_SIZE_PX } from '../../shared/config';
import type { Replay } from '../../shared/replays';
import type { GameManifest } from '../../shared/game-manifest';
import { t } from '../../shared/i18n';
import type { Room } from '../room';
import { h, icon } from '../ui/dom';
import { qrSvg } from '../ui/qr';
import { ICONS } from '../ui/icons';
import { avatarRow } from './avatars';
import { badgeFor, orderGames } from './catalog';
import { gameCard, gameText, soonCard } from './game-card';
import { createGameWindow } from './game-window';

export interface MenuOptions {
  games: readonly GameManifest[];
  history: () => readonly string[];
  sound: { get(): boolean; set(on: boolean): void };
  onPlay(game: GameManifest): void;
  /** Посмотреть запись матча (из «Рекордов и записей»). */
  onWatch(game: GameManifest, replay: Replay): void;
  onSettings(): void;
  /** Убрать отключённого игрока из комнаты. */
  onRemovePlayer(id: string): void;
}

export interface Menu {
  readonly el: HTMLElement;
  setRoom(room: Room): void;
  /** Сервер комнат недоступен (§15): вместо QR — сообщение и «Повторить». */
  setOnline(online: boolean, retry: () => void): void;
  /** Перерисовать сетку (например, после запуска игры порядок меняется) и поставить фокус.
   *  openWindow — сразу открыть окно этой игры («Назад» из лобби, «К игре»). */
  show(focusGameId?: string, openWindow?: boolean, failed?: { retry(): void }): void;
  hide(): void;
}

export function createMenu(options: MenuOptions): Menu {
  let room: Room = { code: null, players: [] };
  /** Игроки, которых уже показывали: анимация входа — только для новых. */
  let seen: Set<string> | null = null;
  let qrFor: string | null = null;

  const roomCode = h('span', { class: 'room__code' });
  const soundButton = h('button', { class: 'icon-btn', type: 'button' });
  const settingsButton = h(
    'button',
    { class: 'icon-btn', type: 'button', 'aria-label': t('menu.settings'), title: t('menu.settings') },
    icon(ICONS.gear),
  );

  settingsButton.addEventListener('click', () => options.onSettings());

  const renderSound = (): void => {
    const on = options.sound.get();
    const label = on ? t('menu.soundOn') : t('menu.soundOff');
    soundButton.replaceChildren(icon(on ? ICONS.soundOn : ICONS.soundOff));
    soundButton.setAttribute('aria-label', label);
    soundButton.setAttribute('aria-pressed', String(on));
    soundButton.title = label;
  };
  soundButton.addEventListener('click', () => {
    options.sound.set(!options.sound.get());
    renderSound();
  });
  renderSound();

  const topBar = h(
    'header',
    { class: 'topbar' },
    h('div', { class: 'logo' }, h('span', { class: 'logo__mark', 'aria-hidden': 'true' }), t('hub.title')),
    h(
      'div',
      { class: 'topbar__actions' },
      h('div', { class: 'room' }, h('span', { class: 'room__label' }, t('menu.room')), roomCode),
      soundButton,
      settingsButton,
    ),
  );

  const countLine = h('p', { class: 'heading__count' });
  const heading = h(
    'div',
    { class: 'heading' },
    h('div', {}, h('h1', { class: 'heading__title' }, t('menu.heading')), countLine),
    h('p', { class: 'heading__keys' }, t('menu.keys')),
  );

  const grid = h('div', { class: 'grid', role: 'list' });

  // QR по нажатию раскрывается почти на весь экран — телефоны сканируют его с дивана; закрывает клик или Esc.
  const qr = h('button', { class: 'join__qr', type: 'button', 'aria-label': t('menu.qrZoom'), title: t('menu.qrZoom') });
  const qrBig = h('div', { class: 'qr-zoom__code' });
  const qrBigRoom = h('p', { class: 'qr-zoom__room' });
  const qrZoom = h('dialog', { class: 'qr-zoom' }, h('div', { class: 'qr-zoom__plate' }, qrBig), qrBigRoom);
  qr.addEventListener('click', () => {
    if (!qrFor) return;
    qrBig.innerHTML = qrSvg(qrFor, QR_ZOOM_SIZE_PX);
    qrBigRoom.textContent = t('menu.qrZoomRoom', { code: qrFor });
    qrZoom.showModal();
  });
  qrZoom.addEventListener('click', () => qrZoom.close());
  // Esc закрывает только QR — меню под ним его не видит.
  qrZoom.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      qrZoom.close();
    }
  });
  const joinCode = h('p', { class: 'join__code' });
  const inRoom = h('p', { class: 'players__count' });
  const avatarsSlot = h('div', { class: 'players__row' });
  const joinArea = h(
    'div',
    { class: 'join' },
    qr,
    h('div', {}, h('p', { class: 'join__title' }, t('menu.joinTitle')), joinCode),
  );
  const retryButton = h('button', { class: 'btn btn--ghost join__retry', type: 'button' }, icon(ICONS.refresh), t('err.retry'));
  const offlineArea = h(
    'div',
    { class: 'join join--offline', hidden: true, role: 'status' },
    h('span', { class: 'join__offline-icon' }, icon(ICONS.wifiOff)),
    h('p', { class: 'join__title' }, t('err.serverDown')),
    retryButton,
  );
  let onRetry: () => void = () => undefined;
  let online = true;
  retryButton.addEventListener('click', () => onRetry());
  const bottomBar = h(
    'footer',
    { class: 'bottombar' },
    joinArea,
    offlineArea,
    h('div', { class: 'players' }, inRoom, avatarsSlot),
  );

  const gameWindow = createGameWindow(
    (game) => {
      gameWindow.close();
      options.onPlay(game);
    },
    (game, replay) => options.onWatch(game, replay),
  );

  const el = h('main', { class: 'menu', 'data-focus-scope': true }, topBar, heading, grid, bottomBar, gameWindow.el, qrZoom);

  const title = (g: GameManifest): string => gameText(g)(g.title);

  const renderRoom = (): void => {
    // Без связи с сервером код ничего не даёт — как при загрузке.
    const code = (online ? room.code : null) ?? t('menu.roomPending');
    roomCode.textContent = code;
    joinCode.textContent = t('menu.joinCode', { url: `${location.host}${CONTROLLER_PATH}`, code });
    if (room.code !== qrFor) {
      qrFor = room.code;
      qr.innerHTML = room.code ? qrSvg(room.code, QR_SIZE_PX) : '';
    }
    const people = room.players.length;
    countLine.textContent = people > 0 ? t('menu.count', { n: people }) : t('menu.countEmpty');
    inRoom.textContent = people > 0 ? t('menu.inRoom', { n: people }) : '';
    const fresh = new Set(seen ? room.players.map((p) => p.id).filter((id) => !seen?.has(id)) : []);
    seen = new Set(room.players.map((p) => p.id));
    avatarsSlot.replaceChildren(avatarRow(room.players, fresh, options.onRemovePlayer));
  };

  const renderGrid = (): void => {
    const history = options.history();
    const people = room.players.length;
    const cards = orderGames(options.games, history, title).map((game) => {
      const card = gameCard(game, badgeFor(game, people, history.includes(game.id), online));
      card.setAttribute('role', 'listitem');
      card.dataset.sound = 'open';
      card.addEventListener('click', () => gameWindow.open(game, card));
      return card;
    });
    grid.replaceChildren(...cards, soonCard());
  };

  const cardFor = (id: string | undefined): HTMLButtonElement | null =>
    (id ? grid.querySelector<HTMLButtonElement>(`.card[data-game="${CSS.escape(id)}"]`) : null) ??
    grid.querySelector<HTMLButtonElement>('button.card');

  return {
    el,
    setRoom(next) {
      room = next;
      renderRoom();
      if (el.hidden) return;
      // Бейджи зависят от числа людей: перерисовываем сетку, сохраняя выбранную карточку.
      const focused = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.game : undefined;
      renderGrid();
      if (focused) cardFor(focused)?.focus();
    },
    setOnline(next, retry) {
      onRetry = retry;
      if (online === next) return;
      online = next;
      joinArea.hidden = !next;
      offlineArea.hidden = next;
      renderRoom();
      if (!el.hidden) {
        const focused = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.game : undefined;
        renderGrid();
        if (focused) cardFor(focused)?.focus();
      }
    },
    show(focusGameId, openWindow = false, failed) {
      renderRoom();
      renderGrid();
      el.hidden = false;
      const card = cardFor(focusGameId);
      card?.focus();
      const game = options.games.find((g) => g.id === focusGameId);
      if (openWindow && card && game) gameWindow.open(game, card, failed);
    },
    hide() {
      gameWindow.close();
      el.hidden = true;
    },
  };
}

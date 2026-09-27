// Меню игр (ARCADE_HUB_SPEC §6): верхняя полоса, заголовок, сетка, нижняя полоса с QR и игроками.
// В простое ничего не рисуется: движение — только в ответ на действие.
import QRCode from 'qrcode-svg';
import { CONTROLLER_PATH, QR_SIZE_PX } from '../../shared/config';
import type { GameManifest } from '../../shared/game-manifest';
import { t } from '../../shared/i18n';
import type { Room } from '../room';
import { h, icon } from '../ui/dom';
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
}

export interface Menu {
  readonly el: HTMLElement;
  setRoom(room: Room): void;
  /** Перерисовать сетку (например, после запуска игры порядок меняется) и поставить фокус. */
  show(focusGameId?: string): void;
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

  const qr = h('div', { class: 'join__qr', 'aria-hidden': 'true' });
  const joinCode = h('p', { class: 'join__code' });
  const inRoom = h('p', { class: 'players__count' });
  const avatarsSlot = h('div', { class: 'players__row' });
  const bottomBar = h(
    'footer',
    { class: 'bottombar' },
    h(
      'div',
      { class: 'join' },
      qr,
      h('div', {}, h('p', { class: 'join__title' }, t('menu.joinTitle')), joinCode),
    ),
    h('div', { class: 'players' }, inRoom, avatarsSlot),
  );

  const gameWindow = createGameWindow((game) => {
    gameWindow.close();
    options.onPlay(game);
  });

  const el = h('main', { class: 'menu', 'data-focus-scope': true }, topBar, heading, grid, bottomBar, gameWindow.el);

  const title = (g: GameManifest): string => gameText(g)(g.title);

  const renderRoom = (): void => {
    const code = room.code ?? t('menu.roomPending');
    roomCode.textContent = code;
    joinCode.textContent = t('menu.joinCode', { url: `${location.host}${CONTROLLER_PATH}`, code });
    if (room.code !== qrFor) {
      qrFor = room.code;
      qr.innerHTML = room.code
        ? new QRCode({
            content: `${location.origin}${CONTROLLER_PATH}?room=${room.code}`,
            padding: 0,
            width: QR_SIZE_PX,
            height: QR_SIZE_PX,
            ecl: 'M',
            join: true,
            container: 'svg-viewbox',
          }).svg()
        : '';
    }
    const people = room.players.length;
    countLine.textContent = people > 0 ? t('menu.count', { n: people }) : t('menu.countEmpty');
    inRoom.textContent = people > 0 ? t('menu.inRoom', { n: people }) : '';
    const fresh = new Set(seen ? room.players.map((p) => p.id).filter((id) => !seen?.has(id)) : []);
    seen = new Set(room.players.map((p) => p.id));
    avatarsSlot.replaceChildren(avatarRow(room.players, fresh));
  };

  const renderGrid = (): void => {
    const history = options.history();
    const people = room.players.length;
    const cards = orderGames(options.games, history, title).map((game) => {
      const card = gameCard(game, badgeFor(game, people, history.includes(game.id)));
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
    show(focusGameId) {
      renderRoom();
      renderGrid();
      el.hidden = false;
      cardFor(focusGameId)?.focus();
    },
    hide() {
      gameWindow.close();
      el.hidden = true;
    },
  };
}

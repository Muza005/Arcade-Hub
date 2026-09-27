// Телефоны на стороне хаба (ARCADE_HUB_SPEC §8, §10): в меню джойстик ведущего ведёт фокус,
// в матче — пауза, «Завершить матч», ободок главной кнопки и состояние для контроллеров.
import {
  INPUT_SEND_HZ,
  MAIN_BUTTON_STEP,
  MENU_NAV_REPEAT_DELAY_MS,
  MENU_NAV_REPEAT_MS,
  MENU_NAV_THRESHOLD,
  ST_INTERVAL_S,
} from '../shared/config';
import type { GameControl, GameManifest } from '../shared/game-manifest';
import { createTranslator } from '../shared/i18n';
import type { ControlMode, ControllerLayout, MainButtonState, StMsg } from '../shared/protocol';
import type { Match } from './game-runner';
import type { RoomClient } from './room-client';
import type { Direction } from './ui/spatial';

const MS_PER_S = 1000;

const MODE_OF: Partial<Record<GameControl, ControlMode>> = {
  'phone-buttons': 'arrows',
  'phone-gyro': 'gyro',
  'phone-joystick': 'joystick',
};

const MENU_LAYOUT: ControllerLayout = { screen: 'menu', modes: ['joystick'], mainButton: true };

export function gameLayout(game: GameManifest): ControllerLayout {
  const modes = game.controls.map((c) => MODE_OF[c]).filter((m): m is ControlMode => m !== undefined);
  const warningKey = game.controllerLayout.warning;
  return {
    screen: 'game',
    modes: modes.length > 0 ? modes : ['joystick'],
    mainButton: game.controllerLayout.mainButton,
    ...(warningKey ? { warning: createTranslator(game.strings)(warningKey) } : {}),
  };
}

/** Направление из осей джойстика: по большей оси, если она дальше порога. */
export function axisToDirection(x: number, y: number): Direction | null {
  if (Math.max(Math.abs(x), Math.abs(y)) < MENU_NAV_THRESHOLD) return null;
  if (Math.abs(x) >= Math.abs(y)) return x > 0 ? 'right' : 'left';
  return y > 0 ? 'down' : 'up';
}

export interface PhonesOptions {
  room: RoomClient;
  nav: { move(dir: Direction): void; select(): void; back(): void };
  /** Пауза на большом экране: показать (ник поставившего) или убрать (null). */
  showPause(nick: string | null): void;
  nickOf(playerId: string): string;
}

export interface Phones {
  enterMenu(): void;
  enterGame(game: GameManifest, match: Match): void;
}

export function connectPhones({ room, nav, showPause, nickOf }: PhonesOptions): Phones {
  let layout: ControllerLayout = MENU_LAYOUT;
  let match: Match | null = null;
  let pausedBy: string | null = null;
  /** Последний отправленный ободок по игрокам — шлём только заметные изменения. */
  const sentButton = new Map<string, string>();

  const stFor = (playerId: string): StMsg => {
    const mainButton = match?.mainButton(playerId);
    const status = match?.status();
    return {
      t: 'st',
      alive: true,
      paused: pausedBy !== null,
      layout,
      ...(mainButton ? { mainButton } : {}),
      ...(pausedBy ? { pausedBy } : {}),
      ...(status && playerId === room.leaderId() ? { status } : {}),
    };
  };
  const broadcast = (): void => room.sendEach(stFor);

  // Меню: джойстик ведущего с автоповтором, главная кнопка — выбрать.
  let navDir: Direction | null = null;
  let navTimer: ReturnType<typeof setTimeout> | null = null;
  let prevBtn = false;
  const stopRepeat = (): void => {
    if (navTimer) clearTimeout(navTimer);
    navTimer = null;
  };
  const repeat = (delay: number): void => {
    navTimer = setTimeout(() => {
      if (!navDir) return;
      nav.move(navDir);
      repeat(MENU_NAV_REPEAT_MS);
    }, delay);
  };

  room.onInput((playerId, input) => {
    if (layout.screen !== 'menu' || playerId !== room.leaderId()) return;
    const dir = axisToDirection(input.x, input.y);
    if (dir !== navDir) {
      navDir = dir;
      stopRepeat();
      if (dir) {
        nav.move(dir);
        repeat(MENU_NAV_REPEAT_DELAY_MS);
      }
    }
    if (input.btn && !prevBtn) nav.select();
    prevBtn = input.btn;
  });

  room.onCmd((playerId, msg, leader) => {
    if (!leader) return;
    if (layout.screen === 'menu') {
      if (msg.cmd === 'back' || msg.cmd === 'pause') nav.back();
      return;
    }
    if (!match) return;
    if (msg.cmd === 'pause' && !match.paused) {
      match.pause();
      pausedBy = nickOf(playerId);
      showPause(pausedBy);
      broadcast();
    } else if (msg.cmd === 'resume' && match.paused) {
      match.resume();
      pausedBy = null;
      showPause(null);
      broadcast();
    } else if (msg.cmd === 'end') {
      match.finish();
    }
  });

  // Раз в секунду — всем; чаще — только тем, у кого заметно сдвинулся ободок главной кнопки.
  setInterval(broadcast, ST_INTERVAL_S * MS_PER_S);
  setInterval(() => {
    if (!match || layout.screen !== 'game') return;
    for (const playerId of match.players) {
      const state = match.mainButton(playerId);
      const key = quantize(state);
      if (sentButton.get(playerId) === key) continue;
      sentButton.set(playerId, key);
      room.send(playerId, stFor(playerId));
    }
  }, MS_PER_S / INPUT_SEND_HZ);

  // Новый телефон сразу получает состояние.
  room.onChange(() => broadcast());

  return {
    enterMenu() {
      layout = MENU_LAYOUT;
      match = null;
      pausedBy = null;
      showPause(null);
      sentButton.clear();
      broadcast();
    },
    enterGame(game, m) {
      layout = gameLayout(game);
      match = m;
      navDir = null;
      stopRepeat();
      broadcast();
    },
  };
}

function quantize(state: MainButtonState | undefined): string {
  if (!state) return '';
  const progress = state.progress === undefined ? '' : Math.round(state.progress / MAIN_BUTTON_STEP);
  return `${state.value ?? ''}|${progress}`;
}

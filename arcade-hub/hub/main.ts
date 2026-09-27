// Точка входа хаба: меню игр → окно игры → матч → снова меню.
// Лобби — этап А6; пока «Играть» запускает матч с подключёнными телефонами,
// а если телефонов нет — с двумя игроками на клавиатуре.
import '../shared/ui/fonts';
import './styles.css';
import { createKeyboardSource, type InputSource, type KeyboardScheme } from '../engine/input';
import { DEV_TEST_PHONE_KEY, PLAYER_COLORS } from '../shared/config';
import type { GameManifest, GamePlayer } from '../shared/game-manifest';
import { GAMES } from '../shared/games';
import { getLang, t } from '../shared/i18n';
import { createUiSounds } from './audio';
import { runGame } from './game-runner';
import { createMenu } from './menu/menu';
import { createPauseOverlay } from './pause-overlay';
import { connectPhones, type Phones } from './phones';
import type { Room } from './room';
import { connectRoom, type RoomClient } from './room-client';
import { applyReducedMotion, launchHistory, rememberLaunch, setSoundEnabled, soundEnabled } from './storage';
import { createFocusManager } from './ui/focus';

document.documentElement.lang = getLang();
document.title = t('hub.title');
applyReducedMotion();

const root = document.getElementById('hub');
if (!root) throw new Error('#hub not found');

let games: readonly GameManifest[] = GAMES;
/** Нарисованная комната для проверки вёрстки (только dev, ?players=N). */
let fixtureRoom: Room | null = null;
if (import.meta.env.DEV) {
  const dev = await import('./dev/fixtures');
  games = dev.devGames(GAMES);
  fixtureRoom = dev.devRoom();
}

const KEYBOARD_PLAYERS: readonly KeyboardScheme[] = ['wasd', 'arrows'];

/** Игроки матча до лобби (этап А6): телефоны по порядку входа, не больше максимума игры. */
function matchPlayers(game: GameManifest, room: RoomClient | null): { players: GamePlayer[]; sources: InputSource[] } {
  const phones = (room?.room.players ?? []).filter((p) => p.connected).slice(0, game.players.max);
  if (room && phones.length > 0) {
    return {
      players: phones.map((p) => ({ id: p.id, nick: p.nick, color: p.color, kind: 'phone' })),
      sources: phones.map((p) => ({ id: p.id, read: () => room.inputOf(p.id), dispose: () => undefined })),
    };
  }
  const keyboard = KEYBOARD_PLAYERS.slice(0, game.players.keyboardMax);
  return {
    players: keyboard.map((scheme, i) => ({
      id: `kb-${scheme}`,
      nick: t('player.keyboard', { n: i + 1 }),
      color: PLAYER_COLORS[i % PLAYER_COLORS.length] as string,
      kind: 'keyboard',
    })),
    sources: keyboard.map((scheme) => createKeyboardSource(`kb-${scheme}`, scheme)),
  };
}

const gameMount = document.createElement('div');
gameMount.className = 'game-mount';
gameMount.hidden = true;
const pause = createPauseOverlay();

const sounds = createUiSounds(soundEnabled());
const focus = createFocusManager(sounds);

let room: RoomClient | null = null;
let phones: Phones | null = null;

async function play(game: GameManifest): Promise<void> {
  menu.hide();
  gameMount.hidden = false;
  rememberLaunch(game.id);
  const { players, sources } = matchPlayers(game, room);
  try {
    const match = await runGame(game, gameMount, {
      players,
      sources,
      fx: (playerId, fx) => room?.send(playerId, { t: 'fx', ...fx }),
    });
    phones?.enterGame(game, match);
    await match.result;
  } catch (err) {
    // Сообщение об ошибке запуска — этап А8.
    console.error(err);
    for (const source of sources) source.dispose();
  }
  gameMount.hidden = true;
  phones?.enterMenu();
  menu.show(game.id);
}

const menu = createMenu({
  games,
  history: launchHistory,
  sound: {
    get: soundEnabled,
    set: (on) => {
      setSoundEnabled(on);
      sounds.setEnabled(on);
    },
  },
  onPlay: (game) => void play(game),
});

root.append(menu.el, gameMount, pause.el);

if (fixtureRoom) {
  menu.setRoom(fixtureRoom);
} else {
  const client = connectRoom();
  room = client;
  menu.setRoom(client.room);
  client.onChange((r) => menu.setRoom(r));
  client.onJoin(() => sounds.play('join'));
  phones = connectPhones({
    room: client,
    nav: focus,
    showPause: (nick) => pause.show(nick),
    nickOf: (id) => client.room.players.find((p) => p.id === id)?.nick ?? '',
  });
  if (import.meta.env.DEV) await enableTestPhones(() => client.room.code);
}
menu.show();

/** Dev: P — добавить тестовый телефон, Shift+P — отключить последний. */
async function enableTestPhones(code: () => string | null): Promise<void> {
  const { connectTestPhone } = await import('./dev/test-phone');
  const list: Array<{ close(): void }> = [];
  let count = 0;
  document.addEventListener('keydown', (e) => {
    const current = code();
    if (e.code !== DEV_TEST_PHONE_KEY || !current || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.shiftKey) list.pop()?.close();
    else list.push(connectTestPhone(current, t('dev.testPlayer', { n: ++count })));
  });
}

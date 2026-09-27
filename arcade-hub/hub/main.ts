// Точка входа хаба: меню игр → окно игры → матч → снова меню.
// Лобби — этап А6; пока «Играть» запускает матч с двумя клавиатурными игроками.
import '../shared/ui/fonts';
import './styles.css';
import type { KeyboardScheme } from '../engine/input';
import { PLAYER_COLORS } from '../shared/config';
import type { GameManifest, GamePlayer } from '../shared/game-manifest';
import { GAMES } from '../shared/games';
import { getLang, t } from '../shared/i18n';
import { createUiSounds } from './audio';
import { runGame } from './game-runner';
import { createMenu } from './menu/menu';
import { emptyRoom, type Room } from './room';
import { applyReducedMotion, launchHistory, rememberLaunch, setSoundEnabled, soundEnabled } from './storage';
import { createFocusManager } from './ui/focus';

document.documentElement.lang = getLang();
document.title = t('hub.title');
applyReducedMotion();

const root = document.getElementById('hub');
if (!root) throw new Error('#hub not found');

let games: readonly GameManifest[] = GAMES;
let room: Room = emptyRoom();
if (import.meta.env.DEV) {
  const dev = await import('./dev/fixtures');
  games = dev.devGames(GAMES);
  room = dev.devRoom();
}

/** Временные игроки до лобби (этап А6): двое с клавиатуры. */
const KEYBOARD_PLAYERS: readonly KeyboardScheme[] = ['wasd', 'arrows'];
const players: GamePlayer[] = KEYBOARD_PLAYERS.map((scheme, i) => ({
  id: `kb-${scheme}`,
  nick: t('player.keyboard', { n: i + 1 }),
  color: PLAYER_COLORS[i % PLAYER_COLORS.length] as string,
  kind: 'keyboard',
}));
const keyboard = new Map(KEYBOARD_PLAYERS.map((scheme) => [`kb-${scheme}`, scheme] as const));

const gameMount = document.createElement('div');
gameMount.className = 'game-mount';
gameMount.hidden = true;

async function play(game: GameManifest): Promise<void> {
  menu.hide();
  gameMount.hidden = false;
  rememberLaunch(game.id);
  try {
    await runGame(game, gameMount, { players, keyboard });
  } catch (err) {
    // Сообщение об ошибке запуска — этап А8.
    console.error(err);
  }
  gameMount.hidden = true;
  menu.show(game.id);
}

const sounds = createUiSounds(soundEnabled());
createFocusManager(sounds);

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

root.append(menu.el, gameMount);
menu.setRoom(room);
menu.show();

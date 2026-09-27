// Точка входа хаба: меню игр → окно игры → лобби → матч → итоги → «Ещё раз» / «К игре» / «В меню».
// «Играть» в окне игры ведёт в лобби: там собираются телефоны, клавиатура и боты.
import '../shared/ui/fonts';
import './styles.css';
import { createKeyboardSource, type InputSource } from '../engine/input';
import { DEV_TEST_PHONE_KEY } from '../shared/config';
import type { GameManifest } from '../shared/game-manifest';
import { GAMES } from '../shared/games';
import { getLang, t } from '../shared/i18n';
import { createUiSounds } from './audio';
import { randomSeed } from '../engine/rng';
import { dailySeed, today } from '../shared/daily';
import { recordMatch } from '../shared/records';
import { saveReplay } from '../shared/replays';
import { runGame } from './game-runner';
import { createResults, type ResultsChoice } from './results/results';
import { createLobby, type LobbyStart } from './lobby/lobby';
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

const gameMount = document.createElement('div');
gameMount.className = 'game-mount';
gameMount.hidden = true;
const pause = createPauseOverlay();
const results = createResults();

const sounds = createUiSounds(soundEnabled());
const focus = createFocusManager(sounds);

let room: RoomClient | null = null;
let phones: Phones | null = null;

/** Источники ввода матча: телефоны — из комнаты, клавиатура — своя раскладка. Ботов ведёт сама игра. */
function inputSources(start: LobbyStart): InputSource[] {
  const sources: InputSource[] = [];
  for (const player of start.players) {
    const scheme = start.keyboard.get(player.id);
    if (scheme) sources.push(createKeyboardSource(player.id, scheme));
    else if (player.kind === 'phone' && room) {
      const client = room;
      sources.push({ id: player.id, read: () => client.inputOf(player.id), dispose: () => undefined });
    }
  }
  return sources;
}

async function play(start: LobbyStart): Promise<void> {
  const { game, players, mode, settings, daily } = start;
  lobby.hide();
  gameMount.hidden = false;
  rememberLaunch(game.id);
  const sources = inputSources(start);
  const seed = daily ? dailySeed() : randomSeed();
  let choice: ResultsChoice | null = null;
  try {
    const match = await runGame(game, gameMount, {
      players,
      sources,
      seed,
      mode,
      settings,
      fx: (playerId, fx) => room?.send(playerId, { t: 'fx', ...fx }),
    });
    phones?.enterGame(game, match);
    const result = await match.result;
    // Итоги ведёт ведущий тем же контроллером, что и меню.
    phones?.enterMenu();

    // В рекорды идут только люди: рекорд бота компании ничего не говорит.
    const humans = new Map(players.filter((p) => p.kind !== 'bot').map((p) => [p.id, p.nick]));
    const beaten = recordMatch(
      game.id,
      result.rows
        .filter((r) => humans.has(r.playerId))
        .map((r) => ({ nick: humans.get(r.playerId) ?? r.playerId, score: r.score, place: r.place })),
      daily,
    );
    saveReplay({
      gameId: game.id,
      version: game.version,
      date: today(),
      seed,
      daily,
      mode,
      settings: { ...settings },
      players: players.map(({ id, nick, color, kind }) => ({ id, nick, color, kind })),
      inputs: [...match.inputs],
    });

    choice = await results.run({
      result,
      players,
      content: match.results(),
      replay: () => match.replay(),
      beaten,
      accent: game.accent,
    });
    match.dispose();
  } catch (err) {
    // Сообщение об ошибке запуска — этап А8.
    console.error(err);
    for (const source of sources) source.dispose();
  }
  gameMount.hidden = true;
  phones?.enterMenu();

  if (choice === 'again') {
    const next = lobby.restart();
    if (next) return play(next);
    lobby.show();
  } else if (choice === 'game') {
    menu.show(game.id, true);
  } else if (choice === 'menu') {
    menu.show(game.id);
  } else {
    lobby.show();
  }
}

const lobby = createLobby({
  onStart: (start) => void play(start),
  onBack: (game) => {
    lobby.hide();
    menu.show(game.id, true);
  },
});

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
  onPlay: (game) => {
    menu.hide();
    lobby.open(game);
  },
});

root.append(menu.el, lobby.el, gameMount, results.el, pause.el);

if (fixtureRoom) {
  menu.setRoom(fixtureRoom);
  lobby.setRoom(fixtureRoom);
} else {
  const client = connectRoom();
  room = client;
  menu.setRoom(client.room);
  lobby.setRoom(client.room);
  client.onChange((r) => {
    menu.setRoom(r);
    lobby.setRoom(r);
  });
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

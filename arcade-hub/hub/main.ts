// Точка входа хаба: меню игр → окно игры → лобби → матч → итоги → «Ещё раз» / «К игре» / «В меню».
// «Играть» в окне игры ведёт в лобби: там собираются телефоны, клавиатура и боты.
import '../shared/ui/fonts';
import './styles.css';
import { createKeyboardSource, type InputSource } from '../engine/input';
import { DEV_TEST_PHONE_KEY, SPLASH_MS } from '../shared/config';
import type { GameManifest, GamePlayer } from '../shared/game-manifest';
import { GAMES } from '../shared/games';
import { readHubSettings, writeHubSettings, type HubSettings } from '../shared/hub-settings';
import { getLang, setLang, t } from '../shared/i18n';
import { createUiSounds } from './audio';
import { randomSeed } from '../engine/rng';
import { dailySeed, today } from '../shared/daily';
import { recordMatch } from '../shared/records';
import { saveReplay } from '../shared/replays';
import { runGame, type Match } from './game-runner';
import { createResults, type ResultsChoice } from './results/results';
import { createLobby, type LobbyStart } from './lobby/lobby';
import { createMenu } from './menu/menu';
import { createPauseOverlay } from './pause-overlay';
import { connectPhones, type Phones } from './phones';
import type { Room } from './room';
import { connectRoom, type RoomClient } from './room-client';
import { createAttract } from './attract';
import { createSettingsScreen } from './settings/settings';
import { launchHistory, rememberLaunch, setSoundEnabled, soundEnabled } from './storage';
import { createToast } from './ui/toast';
import { createFocusManager } from './ui/focus';

// Язык — до первой строки интерфейса.
let hubSettings: HubSettings = readHubSettings();
setLang(hubSettings.lang);
document.documentElement.lang = getLang();
document.title = t('hub.title');

const PERCENT = 100;
const SPLASH_KEY = 'arcade-hub:splashed';

/** Настройки хаба (§13) применяются сразу. */
function applyHubSettings(next: HubSettings): void {
  const root = document.documentElement;
  root.style.setProperty('--ui-scale', String(next.uiScale / PERCENT));
  root.toggleAttribute('data-reduced-motion', next.reducedMotion);
  sounds.configure(next);
}

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
const pause = createPauseOverlay({ resume: () => phones?.resume(), end: () => phones?.end() });
const results = createResults();

const sounds = createUiSounds(soundEnabled());
const focus = createFocusManager(sounds);
const toast = createToast();
applyHubSettings(hubSettings);

let room: RoomClient | null = null;
let phones: Phones | null = null;
/** Идущий матч (до итогов) и его игроки: ник и цвет можно поменять с телефона прямо в игре. */
let live: { match: Match; players: GamePlayer[] } | null = null;

/** Телефон поменял профиль посреди матча — игра перерисовывает игрока, итоги и рекорды берут новое. */
function syncLivePlayers(r: Room): void {
  if (!live) return;
  const current = live;
  current.players = current.players.map((p) => {
    const now = p.kind === 'phone' ? r.players.find((rp) => rp.id === p.id) : undefined;
    if (!now || (now.nick === p.nick && now.color === p.color)) return p;
    const next = { ...p, nick: now.nick, color: now.color };
    current.match.updatePlayer(next);
    return next;
  });
}

// Esc в матче — пауза (игроки с клавиатуры без телефона ведущего). Продолжить — Esc или кнопка на экране.
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || e.defaultPrevented || !live || live.match.paused) return;
  e.preventDefault();
  phones?.pause();
});

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
  const { game, mode, settings, daily } = start;
  let players = start.players;
  lobby.hide();
  gameMount.hidden = false;
  sounds.music(false);
  rememberLaunch(game.id);
  const sources = inputSources(start);
  const seed = daily ? dailySeed() : randomSeed();
  let choice: ResultsChoice | null = null;
  let failed = false;
  try {
    const match = await runGame(game, gameMount, {
      players,
      sources,
      seed,
      mode,
      settings,
      fx: (playerId, fx) => room?.send(playerId, { t: 'fx', ...fx }),
    });
    live = { match, players: [...players] };
    if (room) syncLivePlayers(room.room);
    phones?.enterGame(game, match);
    const result = await match.result;
    players = live.players;
    live = null;
    // Итоги ведёт ведущий тем же контроллером, что и меню.
    phones?.enterMenu();

    // В рекорды идут только люди: рекорд бота компании ничего не говорит.
    const humans = new Map(players.filter((p) => p.kind !== 'bot').map((p) => [p.id, p]));
    const beaten = recordMatch(
      game.id,
      result.rows
        .filter((r) => humans.has(r.playerId))
        .map((r) => {
          const player = humans.get(r.playerId);
          return { nick: player?.nick ?? r.playerId, color: player?.color ?? '', score: r.score, place: r.place };
        }),
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
      aspect: match.aspect,
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
    // Игра не загрузилась (§15): окно игры с сообщением и «Повторить».
    console.error(err);
    live = null;
    failed = true;
    for (const source of sources) source.dispose();
  }
  gameMount.hidden = true;
  phones?.enterMenu();
  sounds.music(true);

  if (failed) {
    menu.show(game.id, true, { retry: () => void play(start) });
    return;
  }

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
  onSettings: () => {
    menu.hide();
    settingsScreen.show();
  },
  onRemovePlayer: (id) => room?.remove(id),
});

const settingsScreen = createSettingsScreen({
  get: () => hubSettings,
  set: (next) => {
    const langChanged = next.lang !== hubSettings.lang;
    hubSettings = next;
    writeHubSettings(next);
    // Язык меняет все строки — проще и надёжнее перезагрузить хаб (комната и телефоны вернутся сами).
    if (langChanged) location.reload();
    else applyHubSettings(next);
  },
  changeCode: () => room?.changeCode(),
  removeAll: () => room?.removeAll(),
  onBack: () => {
    settingsScreen.hide();
    menu.show();
  },
});

const attract = createAttract({
  games,
  canStart: () =>
    !menu.el.hidden &&
    !document.querySelector('dialog[open]') &&
    !hubSettings.reducedMotion &&
    !(room?.room.players.some((p) => p.connected) ?? false),
  roomCode: () => room?.room.code ?? null,
  onStart: () => undefined,
  onStop: () => undefined,
});

root.append(menu.el, lobby.el, settingsScreen.el, gameMount, results.el, pause.el, attract.el, toast.el);

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
    syncLivePlayers(r);
  });
  client.onJoin(() => {
    attract.poke();
    sounds.play('join');
  });
  client.onInput(() => attract.poke());
  client.onLeaderChange((player) => toast.show(t('toast.leader', { nick: player.nick }), player.color));
  client.onStatus((online) => menu.setOnline(online, () => client.retry()));
  phones = connectPhones({
    room: client,
    nav: focus,
    showPause: (paused, by) => pause.show(paused, by, client.room.code),
    nickOf: (id) => client.room.players.find((p) => p.id === id)?.nick ?? '',
  });
  if (import.meta.env.DEV) await enableTestPhones(() => client.room.code);
}
menu.show();
finishBoot();

/** Загрузка закончилась; при первом запуске за сессию — заставка на SPLASH_MS (§5). */
function finishBoot(): void {
  const boot = document.getElementById('boot');
  if (!boot) return;
  let first = false;
  try {
    first = sessionStorage.getItem(SPLASH_KEY) === null;
    sessionStorage.setItem(SPLASH_KEY, '1');
  } catch {
    // без хранилища — без заставки
  }
  const hide = (): void => {
    boot.classList.add('boot--done');
    setTimeout(() => boot.remove(), SPLASH_MS);
  };
  if (first && !hubSettings.reducedMotion) {
    boot.classList.add('boot--splash');
    setTimeout(hide, SPLASH_MS);
  } else hide();
}

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

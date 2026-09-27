// Точка входа хаба. На этапе А1 — временная кнопка запуска «Точек» и последний результат.
// Меню игр появится на этапе А2.
import '../shared/ui/fonts';
import './styles.css';
import type { KeyboardScheme } from '../engine/input';
import { PLAYER_COLORS } from '../shared/config';
import type { GameManifest, GamePlayer, MatchResult } from '../shared/game-manifest';
import { GAMES } from '../shared/games';
import { createTranslator, getLang, t } from '../shared/i18n';
import { runGame } from './game-runner';

document.documentElement.lang = getLang();
document.title = t('hub.title');

const root = document.getElementById('hub');
if (!root) throw new Error('#hub not found');

const game = GAMES[0];
if (!game) throw new Error('no games registered');

/** Временные игроки: двое с клавиатуры (лобби — этап А6). */
const KEYBOARD_PLAYERS: ReadonlyArray<{ scheme: KeyboardScheme }> = [{ scheme: 'wasd' }, { scheme: 'arrows' }];

const players: GamePlayer[] = KEYBOARD_PLAYERS.map(({ scheme }, i) => ({
  id: `kb-${scheme}`,
  nick: t('player.keyboard', { n: i + 1 }),
  color: PLAYER_COLORS[i % PLAYER_COLORS.length] as string,
  kind: 'keyboard',
}));
const keyboard = new Map(KEYBOARD_PLAYERS.map(({ scheme }) => [`kb-${scheme}`, scheme] as const));

const home = document.createElement('main');
home.className = 'dev-home';
const launchButton = document.createElement('button');
launchButton.className = 'dev-home__launch';
launchButton.style.setProperty('--accent', game.accent);
const keysHint = document.createElement('p');
keysHint.className = 'dev-home__hint';
keysHint.textContent = t('dev.keysHint');
const message = document.createElement('section');
message.className = 'dev-home__results';
message.setAttribute('aria-live', 'polite');
home.append(launchButton, keysHint, message);

const gameMount = document.createElement('div');
gameMount.className = 'game-mount';
gameMount.hidden = true;

root.append(home, gameMount);

function gameTitle(manifest: GameManifest): string {
  return createTranslator(manifest.strings)(manifest.title);
}

launchButton.textContent = t('dev.launchGame', { title: gameTitle(game) });

function showResults(result: MatchResult): void {
  const heading = document.createElement('h2');
  heading.textContent = t('dev.lastMatch');
  const list = document.createElement('ol');
  for (const row of result.rows) {
    const item = document.createElement('li');
    const nick = players.find((p) => p.id === row.playerId)?.nick ?? row.playerId;
    item.textContent = t('dev.resultRow', { place: row.place, nick, score: row.score });
    list.append(item);
  }
  message.replaceChildren(heading, list);
}

function showHome(): void {
  gameMount.hidden = true;
  home.hidden = false;
  launchButton.focus();
}

async function launch(): Promise<void> {
  home.hidden = true;
  gameMount.hidden = false;
  try {
    const result = await runGame(game as GameManifest, gameMount, { players, keyboard });
    showResults(result);
  } catch (err) {
    console.error(err);
    const failed = document.createElement('p');
    failed.textContent = t('dev.loadFailed');
    message.replaceChildren(failed);
  }
  showHome();
}

launchButton.addEventListener('click', () => void launch());
showHome();

// Манифест Space War (SPACE_WAR_SPEC §12, ARCADE_HUB_SPEC §16). Код игры грузится только в load().
import type { GameManifest } from '../shared/game-manifest';
import { createTranslator, getLang } from '../shared/i18n';
import { dailyBest, readRecords } from '../shared/records';
import { listReplays } from '../shared/replays';
import cardArt from './assets/card.svg';
import cover from './assets/cover.svg';
import logo from './assets/logo.svg';
import modeCoopIcon from './assets/mode-coop.svg';
import modeTeamsIcon from './assets/mode-teams.svg';
import modeVersusIcon from './assets/mode-versus.svg';
import { ACCENT, ACCENT_ALT, KEYBOARD_MAX } from './config';
import { strings } from './i18n/strings';
import { lobbySchema } from './lobby/schema';

const GAME_ID = 'space-war';
const t = createTranslator(strings);
/** Очки с разрядами по языку хаба: «23 400». */
const num = (n: number): string => new Intl.NumberFormat(getLang()).format(n);

export const spaceWarManifest: GameManifest = {
  id: GAME_ID,
  title: 'title',
  tagline: 'tagline',
  howToPlay: ['howTo1', 'howTo2', 'howTo3'],
  accent: ACCENT,
  accentAlt: ACCENT_ALT,
  cover,
  cardArt,
  logo,
  players: { min: 1, max: 10, keyboardMax: KEYBOARD_MAX },
  sessionMinutes: [15, 25],
  controls: ['keyboard', 'phone-joystick', 'phone-gyro'],
  modes: [
    { id: 'coop', title: 'modeCoop', description: 'modeCoopDesc', icon: modeCoopIcon },
    { id: 'versus', title: 'modeVersus', description: 'modeVersusDesc', icon: modeVersusIcon },
    // Цвет — это команда: в лобби несколько игроков могут выбрать один цвет.
    { id: 'teams', title: 'modeTeams', description: 'modeTeamsDesc', icon: modeTeamsIcon, sharedColors: true },
  ],
  status: 'available',
  version: '10', // 9 — боссы на 4, 8, 11, 14, 17, 20, Охотник и Крепость; 10 — осложнения в каждой волне, новый Рой
  load: async () => (await import('./game')).createSpaceWarGame(),
  strings,
  // Главная кнопка — Power (патроны и ободок накопления — этап Б3).
  controllerLayout: { mainButton: true, warning: 'warning' },
  // Боты — три уровня (этап Б6); до тех пор корабли ботов стоят на месте.
  bots: true,
  lobby: lobbySchema,
  // Карточка и окно игры (SPACE_WAR_SPEC §11): «Волна 14 · лучший — Мурад, 23 400», рекорд дня, лучший результат.
  meta: () => {
    const records = readRecords(GAME_ID);
    const daily = dailyBest(records);
    const last = records.last;
    const top = last?.rows.reduce<(typeof last.rows)[number] | undefined>((best, r) => (!best || r.score > best.score ? r : best), undefined);
    const wave = last?.meta?.wave;
    return {
      ...(top && wave ? { lastMatch: t('metaLast', { waves: wave, nick: top.nick, score: num(top.score) }) } : {}),
      ...(daily ? { dailyBest: t('metaDaily', { nick: daily.nick, score: num(daily.score) }) } : {}),
      ...(records.best ? { localBest: t('metaBest', { nick: records.best.nick, score: num(records.best.score) }) } : {}),
      hasReplays: listReplays(GAME_ID).length > 0,
    };
  },
};

// Манифест «Точек» (DOTS_SPEC «Манифест», ARCADE_HUB_SPEC §16). Код игры грузится только в load().
import type { GameManifest } from '../shared/game-manifest';
import { createTranslator } from '../shared/i18n';
import { dailyBest, readRecords } from '../shared/records';
import { listReplays } from '../shared/replays';
import cardArt from './assets/card.svg';
import cover from './assets/cover.svg';
import logo from './assets/logo.svg';
import modeFfaIcon from './assets/mode-ffa.svg';
import { ACCENT, DASH_ENABLED_DEFAULT, MATCH_S_DEFAULT, MATCH_S_OPTIONS, SHAPE_DEFAULT } from './config';
import { strings } from './strings';

const GAME_ID = 'dots';
/** Иконки формы для лобби (цвет — currentColor). */
const ICON_CIRCLE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="currentColor"/></svg>';
const ICON_SQUARE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="currentColor"/></svg>';
const t = createTranslator(strings);

export const dotsManifest: GameManifest = {
  id: GAME_ID,
  title: 'title',
  tagline: 'tagline',
  howToPlay: ['howTo1', 'howTo2', 'howTo3'],
  accent: ACCENT,
  cover,
  cardArt,
  logo,
  players: { min: 1, max: 10, keyboardMax: 2 },
  sessionMinutes: [1, 2],
  controls: ['keyboard', 'phone-joystick', 'phone-gyro', 'phone-buttons'],
  modes: [{ id: 'ffa', title: 'modeFfa', description: 'modeFfaDesc', icon: modeFfaIcon }],
  status: 'available',
  version: '2', // 2 — поле под ширину экрана
  load: async () => (await import('./game')).createDotsGame(),
  strings,
  controllerLayout: { mainButton: true },
  bots: true,
  attract: { kind: 'live' },
  meta: () => {
    const records = readRecords(GAME_ID);
    const daily = dailyBest(records);
    const top = records.last?.rows.find((r) => r.place === 1);
    return {
      ...(daily ? { dailyBest: t('metaDaily', { nick: daily.nick, score: daily.score }) } : {}),
      ...(records.best ? { localBest: t('metaBest', { nick: records.best.nick, score: records.best.score }) } : {}),
      ...(top ? { lastMatch: t('metaLast', { nick: top.nick, score: top.score }) } : {}),
      hasReplays: listReplays(GAME_ID).length > 0,
    };
  },
  lobby: {
    settings: [
      {
        key: 'durationS',
        label: 'setDuration',
        kind: 'select',
        options: MATCH_S_OPTIONS.map((s) => ({ value: s, label: `dur${s}` })),
        default: MATCH_S_DEFAULT,
      },
      { key: 'dash', label: 'setDash', kind: 'toggle', default: DASH_ENABLED_DEFAULT },
    ],
    playerFields: [
      {
        key: 'shape',
        label: 'setShape',
        kind: 'select',
        options: [
          { value: 'circle', label: 'shapeCircle', icon: ICON_CIRCLE },
          { value: 'square', label: 'shapeSquare', icon: ICON_SQUARE },
        ],
        default: SHAPE_DEFAULT,
      },
    ],
  },
};

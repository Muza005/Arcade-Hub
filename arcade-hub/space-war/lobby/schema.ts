// Схема лобби Space War (SPACE_WAR_SPEC §8) для общего лобби платформы (ARCADE_HUB_SPEC §11).
// Поле игрока — форма корпуса; настройки матча одинаковы для всех режимов.
// Что из настроек работает уже сейчас, а что ждёт своего этапа, — в комментариях.
import type { LobbySchema } from '../../shared/game-manifest';
import {
  BOT_LEVEL_COLOR,
  BOT_LEVEL_DEFAULT,
  BOT_LEVELS,
  DIFFICULTIES,
  DIFFICULTY_COLOR,
  DIFFICULTY_DEFAULT,
  RATE_COLOR,
  ROCK_BOUNCE_DEFAULT,
  POWERUP_RATE_DEFAULT,
  POWERUP_RATE_KEYS,
  GHOST_S,
  GHOST_S_RANGE,
  HULL_DEFAULT,
  HULLS,
  QUALITY_CHOICES,
} from '../config';
import { HULL_SHAPES, hullSvg } from '../hull-shapes';
import {
  BOT_LEVEL_ICONS,
  BOTS_FIELD_ICON,
  DIFFICULTY_FIELD_ICON,
  DIFFICULTY_ICONS,
  RATE_FIELD_ICON,
  RATE_ICONS,
} from './icons';

export const lobbySchema: LobbySchema = {
  playerFields: [
    {
      key: 'hull',
      label: 'setHull',
      kind: 'select',
      options: HULLS.map((h) => ({ value: h, label: `hull_${h}`, icon: hullSvg(h), group: HULL_SHAPES[h].group })),
      default: HULL_DEFAULT,
    },
  ],
  settings: [
    // Столкновения и таран — Б7.
    { key: 'collisions', label: 'setCollisions', kind: 'toggle', default: true },
    // Отскок астероидов друг от друга — решение заказчика после Б11.
    { key: 'rockBounce', label: 'setRockBounce', kind: 'toggle', default: ROCK_BOUNCE_DEFAULT },
    // Усиления — Б11.
    { key: 'powerups', label: 'setPowerups', kind: 'toggle', default: true },
    // Частота усилений — решение заказчика после Б13; без усилений гаснет.
    {
      key: 'powerupRate',
      label: 'setPowerupRate',
      kind: 'select',
      icon: RATE_FIELD_ICON,
      options: POWERUP_RATE_KEYS.map((r) => ({ value: r, label: `rate_${r}`, icon: RATE_ICONS[r], color: RATE_COLOR[r] })),
      default: POWERUP_RATE_DEFAULT,
      active: ({ settings }) => settings.powerups !== false,
    },
    // Саботаж погибших — Б10.
    { key: 'sabotage', label: 'setSabotage', kind: 'toggle', default: true },
    // Стартовая сложность волн — Б8.
    {
      key: 'difficulty',
      label: 'setDifficulty',
      kind: 'select',
      icon: DIFFICULTY_FIELD_ICON,
      options: DIFFICULTIES.map((d) => ({ value: d, label: `diff_${d}`, icon: DIFFICULTY_ICONS[d], color: DIFFICULTY_COLOR[d] })),
      default: DIFFICULTY_DEFAULT,
    },
    // Работает сейчас: «Авто» — берётся из настроек хаба.
    {
      key: 'quality',
      label: 'setQuality',
      kind: 'select',
      options: QUALITY_CHOICES.map((q) => ({ value: q, label: `q_${q}` })),
      default: 'auto',
    },
    // Время призрака — Б10. В соревновании погибший сразу саботажник — поле гаснет.
    { key: 'ghostS', label: 'setGhost', kind: 'slider', ...GHOST_S_RANGE, default: GHOST_S, active: ({ mode }) => mode !== 'versus' },
    // Уровень ботов — Б6; без ботов гаснет.
    {
      key: 'botLevel',
      label: 'setBots',
      kind: 'select',
      icon: BOTS_FIELD_ICON,
      options: BOT_LEVELS.map((b) => ({ value: b, label: `bot_${b}`, icon: BOT_LEVEL_ICONS[b], color: BOT_LEVEL_COLOR[b] })),
      default: BOT_LEVEL_DEFAULT,
      active: ({ bots }) => bots > 0,
    },
  ],
};

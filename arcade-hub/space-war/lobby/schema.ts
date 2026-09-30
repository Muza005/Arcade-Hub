// Схема лобби Space War (SPACE_WAR_SPEC §8) для общего лобби платформы (ARCADE_HUB_SPEC §11).
// Поле игрока — форма корпуса; настройки матча одинаковы для всех режимов.
// Что из настроек работает уже сейчас, а что ждёт своего этапа, — в комментариях.
import type { LobbySchema } from '../../shared/game-manifest';
import {
  BOT_LEVEL_DEFAULT,
  BOT_LEVELS,
  DIFFICULTIES,
  DIFFICULTY_DEFAULT,
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
    // Камни отскакивают друг от друга — решение заказчика после Б11.
    { key: 'rockBounce', label: 'setRockBounce', kind: 'toggle', default: ROCK_BOUNCE_DEFAULT },
    // Усиления — Б11.
    { key: 'powerups', label: 'setPowerups', kind: 'toggle', default: true },
    // Частота усилений — решение заказчика после Б13.
    {
      key: 'powerupRate',
      label: 'setPowerupRate',
      kind: 'select',
      options: POWERUP_RATE_KEYS.map((r) => ({ value: r, label: `rate_${r}` })),
      default: POWERUP_RATE_DEFAULT,
    },
    // Саботаж погибших — Б10.
    { key: 'sabotage', label: 'setSabotage', kind: 'toggle', default: true },
    // Стартовая сложность волн — Б8.
    {
      key: 'difficulty',
      label: 'setDifficulty',
      kind: 'select',
      options: DIFFICULTIES.map((d) => ({ value: d, label: `diff_${d}` })),
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
    // Время призрака — Б10.
    { key: 'ghostS', label: 'setGhost', kind: 'slider', ...GHOST_S_RANGE, default: GHOST_S },
    // Уровень ботов — Б6.
    {
      key: 'botLevel',
      label: 'setBots',
      kind: 'select',
      options: BOT_LEVELS.map((b) => ({ value: b, label: `bot_${b}` })),
      default: BOT_LEVEL_DEFAULT,
    },
  ],
};

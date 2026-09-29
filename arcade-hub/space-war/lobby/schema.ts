// Схема лобби Space War (SPACE_WAR_SPEC §8) для общего лобби платформы (ARCADE_HUB_SPEC §11).
// Поле игрока — форма корпуса; настройки матча одинаковы для всех режимов.
// Что из настроек работает уже сейчас, а что ждёт своего этапа, — в комментариях.
import type { LobbySchema } from '../../shared/game-manifest';
import {
  BOT_LEVEL_DEFAULT,
  BOT_LEVELS,
  DIFFICULTIES,
  DIFFICULTY_DEFAULT,
  GHOST_S,
  GHOST_S_RANGE,
  HULL_DEFAULT,
  HULLS,
  QUALITY_CHOICES,
} from '../config';

export const lobbySchema: LobbySchema = {
  playerFields: [
    {
      key: 'hull',
      label: 'setHull',
      kind: 'select',
      options: HULLS.map((h) => ({ value: h, label: `hull_${h}` })),
      default: HULL_DEFAULT,
    },
  ],
  settings: [
    // Столкновения и таран — Б7.
    { key: 'collisions', label: 'setCollisions', kind: 'toggle', default: true },
    // Усиления — Б11.
    { key: 'powerups', label: 'setPowerups', kind: 'toggle', default: true },
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

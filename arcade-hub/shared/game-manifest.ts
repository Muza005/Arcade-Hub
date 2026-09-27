// Контракт игры (ARCADE_HUB_SPEC §16). На этапе А0 — только типы.
// Хаб ничего не знает об играх, кроме манифеста.

/**
 * Модуль игры, который возвращает `load()`.
 * Жизненный цикл (init, update/render, pause/resume, конец матча, dispose) описывается на этапе А1.
 */
export type GameModule = object;

export type GameControl = 'keyboard' | 'phone-buttons' | 'phone-gyro' | 'phone-joystick';

export interface GameMode {
  id: string;
  /** Ключ i18n. */
  title: string;
  /** Ключ i18n, одна строка. */
  description: string;
  icon: string;
}

export interface GameMetaSummary {
  lastMatch?: string; // «14 волн · лучший — Мурад, 23 400»
  dailyBest?: string;
  localBest?: string;
  hasReplays: boolean;
}

export interface GameManifest {
  id: string; // 'space-war'
  title: string; // ключ i18n
  tagline: string; // ключ i18n, одна строка
  howToPlay: [string, string, string]; // три шага, ключи i18n
  accent: string; // основной цвет игры, '#3DE0FF'
  accentAlt?: string; // второй цвет для градиентов
  cover: string; // 1920×1080, важное в левой верхней трети
  cardArt: string; // 640×840
  logo: string; // SVG
  attract?: { kind: 'live' } | { kind: 'video'; src: string };
  players: { min: number; max: number; keyboardMax: number };
  sessionMinutes: [number, number]; // [15, 25]
  controls: GameControl[];
  modes: GameMode[];
  status: 'available' | 'soon';
  version: string; // для совместимости записей
  load: () => Promise<GameModule>; // ленивая загрузка, этап А1
  meta?: () => GameMetaSummary; // строка для карточки и блок меты
}

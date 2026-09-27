// Контракт игры (ARCADE_HUB_SPEC §16). Хаб ничего не знает об играх, кроме манифеста и модуля.
import type { GameStrings } from './i18n';
import type { InputState, LobbyValue } from './protocol';

export type GameControl = 'keyboard' | 'phone-buttons' | 'phone-gyro' | 'phone-joystick';

export interface GameMode {
  id: string;
  /** Ключ словаря игры. */
  title: string;
  /** Ключ словаря игры, одна строка. */
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
  title: string; // ключ словаря игры
  tagline: string; // ключ словаря игры, одна строка
  howToPlay: [string, string, string]; // три шага, ключи словаря игры
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
  /** Ленивая загрузка кода игры. Каждый вызов — новый модуль. */
  load: () => Promise<GameModule>;
  meta?: () => GameMetaSummary; // строка для карточки и блок меты
  /** Словарь игры: хабу нужны title, tagline, howToPlay, modes до загрузки кода. */
  strings: GameStrings;
}

// ─── Модуль игры (этап А1) ────────────────────────────────────────

export type PlayerKind = 'keyboard' | 'phone' | 'bot';

export interface GamePlayer {
  id: string;
  nick: string;
  color: string;
  kind: PlayerKind;
}

export type MatchSettings = Readonly<Record<string, LobbyValue>>;

export interface MatchResultRow {
  playerId: string;
  score: number;
  /** Место, с 1. У равных по очкам — одинаковое. */
  place: number;
}

export interface MatchResult {
  gameId: string;
  mode: string;
  seed: number;
  version: string;
  rows: MatchResultRow[];
}

export interface GameContext {
  players: readonly GamePlayer[];
  /** Настройки матча из лобби (этап А6). Чего нет — игра берёт своё значение по умолчанию. */
  settings: MatchSettings;
  mode: string;
  seed: number;
  input: { read(playerId: string): InputState };
  /** Элемент, внутри которого игра рисует. Занимает весь экран. */
  mount: HTMLElement;
  /** Сообщить конец матча. После этого платформа вызовет dispose(). */
  end(result: MatchResult): void;
}

export interface GameModule {
  init(ctx: GameContext): void | Promise<void>;
  /** Шаг симуляции с фиксированным dt (FIXED_STEP_HZ). */
  update(dtS: number, tick: number): void;
  /** Отрисовка; alpha ∈ [0, 1) — для интерполяции между шагами. */
  render(alpha: number): void;
  /** Игра сама замораживает симуляцию. */
  pause(): void;
  resume(): void;
  dispose(): void;
}

/** Места по очкам: больше — выше, равные делят место. */
export function rankByScore(scores: ReadonlyArray<{ playerId: string; score: number }>): MatchResultRow[] {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  return sorted.map((row) => ({ ...row, place: sorted.findIndex((r) => r.score === row.score) + 1 }));
}

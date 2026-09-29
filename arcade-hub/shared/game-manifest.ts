// Контракт игры (ARCADE_HUB_SPEC §16). Хаб ничего не знает об играх, кроме манифеста и модуля.
import type { GameStrings } from './i18n';
import type { FxMsg, InputState, LobbyValue, MainButtonState } from './protocol';

export type GameControl = 'keyboard' | 'phone-buttons' | 'phone-gyro' | 'phone-joystick';

export interface GameMode {
  id: string;
  /** Ключ словаря игры. */
  title: string;
  /** Ключ словаря игры, одна строка. */
  description: string;
  icon: string;
  /** Цвет — это команда (§11): в лобби несколько игроков могут выбрать один цвет. */
  sharedColors?: boolean;
}

// ─── Схема лобби (§11): игра описывает поля, лобби их рисует и сохраняет ───

interface FieldBase {
  key: string;
  /** Ключ словаря игры. */
  label: string;
}

export interface ToggleField extends FieldBase {
  kind: 'toggle';
  default: boolean;
}

export interface SliderField extends FieldBase {
  kind: 'slider';
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface SelectOption {
  value: string | number;
  /** Ключ словаря игры. */
  label: string;
  /** SVG-разметка иконки (цвет — currentColor): такой выбор рисуется сеткой иконок, а карточка игрока — иконкой. */
  icon?: string;
  /** Варианты с одной группой стоят в одном ряду (например, формы корпуса одного вида). */
  group?: string;
}

export interface SelectField extends FieldBase {
  kind: 'select';
  options: SelectOption[];
  default: string | number;
}

export type LobbyField = ToggleField | SliderField | SelectField;

export interface LobbySchema {
  /** Настройки матча: общие для всех. */
  settings: LobbyField[];
  /** Поля каждого игрока (например, форма корпуса). */
  playerFields?: LobbyField[];
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
  /** Можно ли добирать игроков ботами. Как бот играет, решает игра. */
  bots?: boolean;
  /** Настройки матча и поля игроков для лобби. */
  lobby?: LobbySchema;
  /** Контроллер на телефоне (§10). Виды управления берутся из `controls`. */
  controllerLayout: {
    mainButton: boolean;
    /** Ключ словаря игры: жёлтая плашка в настройках телефона. */
    warning?: string;
  };
}

// ─── Модуль игры (этап А1) ────────────────────────────────────────

export type PlayerKind = 'keyboard' | 'phone' | 'bot';

export interface GamePlayer {
  id: string;
  nick: string;
  color: string;
  kind: PlayerKind;
  /** Значения полей игрока из схемы лобби (playerFields). */
  fields?: Readonly<Record<string, LobbyValue>>;
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

// ─── Итоги (§12): содержимое шагов присылает игра, оболочка — порядок, анимация, кнопки ───

export interface Award {
  playerId: string;
  /** Название награды (уже переведённое). */
  title: string;
  value?: string;
}

export interface ResultsTable {
  /** Заголовки своих колонок игры (место и игрок оболочка рисует сама). */
  columns: string[];
  /** Строки в порядке мест. */
  rows: Array<{ playerId: string; cells: string[] }>;
}

export interface MatchResults {
  awards: Award[];
  table: ResultsTable;
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
  /** Соотношение сторон экрана на старте матча (ширина / высота, в пределах ASPECT_RANGE).
   *  Игра может растянуть мир по ширине под экран; в записи матча оно сохраняется. */
  aspect: number;
  /** Сообщить конец матча. После этого платформа вызовет dispose(). */
  end(result: MatchResult): void;
  /** Вибрация и вспышка на телефоне игрока (клавиатурным игрокам — ничего). */
  fx(playerId: string, fx: Omit<FxMsg, 't'>): void;
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
  /** «Завершить матч» ведущим: игра сразу вызывает ctx.end с текущим счётом. */
  finish(): void;
  dispose(): void;
  /** Число и ободок главной кнопки игрока, если игра их использует. */
  mainButton?(playerId: string): MainButtonState | undefined;
  /** Строка состояния матча для окна паузы («Осталось 0:42»). */
  status?(): string;
  /** Игрок сменил ник или цвет посреди матча (настройки телефона) — перерисовать его. */
  updatePlayer?(player: GamePlayer): void;
  /** Шаг 1 итогов: короткий повтор конца матча на своей сцене. Вызывается после end, до dispose. */
  replay?(): Promise<void>;
  /** Шаги 2–3 итогов: награды и строки таблицы. */
  results?(): MatchResults;
}

/** Места по очкам: больше — выше, равные делят место. */
export function rankByScore(scores: ReadonlyArray<{ playerId: string; score: number }>): MatchResultRow[] {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  return sorted.map((row) => ({ ...row, place: sorted.findIndex((r) => r.score === row.score) + 1 }));
}

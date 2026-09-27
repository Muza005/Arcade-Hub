// Протокол платформы (ARCADE_HUB_SPEC §17). JSON, поле `t` — тип сообщения.
// Всё, что относится к конкретной игре, едет внутри сообщения `g` или поля `game`
// и описывается в спецификации этой игры.

/** Произвольные данные игры. Форму задаёт спецификация игры. */
export type GamePayload = Record<string, unknown>;

/** Роль телефона в комнате. */
export type Role = 'leader' | 'guest';

/** Команды ведущего. */
export type LeaderCommand = 'start' | 'pause' | 'resume' | 'end' | 'again' | 'back' | 'select';

/** Значение поля лобби, объявленного игрой (переключатель, ползунок, выбор из списка). */
export type LobbyValue = string | number | boolean;

/** Состояние ввода одного игрока: оси в диапазоне [-1, 1] и главная кнопка. */
export interface InputState {
  x: number;
  y: number;
  btn: boolean;
}

// ─── Экран → сервер ───────────────────────────────────────────────

/** Открытие хаба; в ответ сервер присылает код комнаты (`room`). */
export interface HostMsg {
  t: 'host';
}

// ─── Сервер → экран ───────────────────────────────────────────────

/** Ответ на `host`: код созданной комнаты. Имя и поле — решение этапа А0, в §17 не названы. */
export interface RoomMsg {
  t: 'room';
  code: string;
}

// ─── Телефон → сервер ─────────────────────────────────────────────

/** Открытие страницы контроллера. С токеном — возврат в свой слот. */
export interface JoinMsg {
  t: 'join';
  room: string;
  token?: string;
}

// ─── Телефон → экран ──────────────────────────────────────────────

/** Ввод, ~30 Гц. Не буферизуется и не пересылается повторно. */
export interface InMsg extends InputState {
  t: 'in';
}

/** Изменение профиля игрока. */
export interface ProfileMsg {
  t: 'profile';
  nick: string;
  color: string;
}

/** Поле лобби, объявленное игрой. */
export interface LobbyMsg {
  t: 'lobby';
  key: string;
  value: LobbyValue;
}

// ─── Ведущий → экран ──────────────────────────────────────────────

/** Кнопки ведущего. */
export interface CmdMsg {
  t: 'cmd';
  cmd: LeaderCommand;
}

// ─── Экран → телефон ──────────────────────────────────────────────

/** Слот игрока после входа. */
export interface SlotMsg {
  t: 'slot';
  id: number;
  color: string;
  role: Role;
  token: string;
  /** Соотношение сторон игрового поля (ширина / высота). */
  aspect: number;
}

/** Число и прогресс ободка на главной кнопке, если игра их использует. */
export interface MainButtonState {
  value?: number;
  /** Прогресс ободка, 0…1. */
  progress?: number;
}

/** Состояние для телефона: раз в секунду и на событиях. */
export interface StMsg {
  t: 'st';
  alive: boolean;
  paused: boolean;
  /** Раскладка контроллера, заказанная игрой (controllerLayout, этап А5). */
  layout: string;
  mainButton?: MainButtonState;
  game?: GamePayload;
}

/** Обратная связь по команде игры. */
export interface FxMsg {
  t: 'fx';
  /** Длина вибрации, мс. */
  vib?: number;
  /** Цвет вспышки по краям экрана телефона. */
  flash?: string;
}

// ─── В обе стороны ────────────────────────────────────────────────

/** Особые действия игры. */
export interface GameMsg {
  t: 'g';
  game: GamePayload;
}

// ─── Объединения по направлениям ─────────────────────────────────

export type HostToServer = HostMsg;
export type ServerToHost = RoomMsg;
export type PhoneToServer = JoinMsg;
export type PhoneToScreen = InMsg | ProfileMsg | LobbyMsg | CmdMsg | GameMsg;
export type ScreenToPhone = SlotMsg | StMsg | FxMsg | GameMsg;

export type Message = HostToServer | ServerToHost | PhoneToServer | PhoneToScreen | ScreenToPhone;
export type MessageType = Message['t'];

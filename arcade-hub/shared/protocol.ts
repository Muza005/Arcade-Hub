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

/** Открытие хаба; в ответ сервер присылает код комнаты (`room`).
 *  С `code` — вернуться в свою комнату после перезагрузки хаба, если код свободен или комната без экрана. */
export interface HostMsg {
  t: 'host';
  code?: string;
}

/** Сообщение телефону (или всем телефонам комнаты, to = '*'). Сервер пересылает `msg` как есть. */
export interface ToMsg {
  t: 'to';
  to: string;
  msg: ScreenToPhone;
}

// ─── Сервер → экран ───────────────────────────────────────────────

/** Ответ на `host`: код созданной комнаты. Имя и поле — решение этапа А0, в §17 не названы. */
export interface RoomMsg {
  t: 'room';
  code: string;
}

/** Сообщение от телефона. `from` — id соединения, который выдал сервер. */
export interface FromMsg {
  t: 'from';
  from: string;
  msg: PhoneToServer | PhoneToScreen;
}

/** Телефон отключился. */
export interface GoneMsg {
  t: 'gone';
  from: string;
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

/** Слот игрока после входа и после каждого изменения профиля или комнаты. */
export interface SlotMsg {
  t: 'slot';
  id: number;
  nick: string;
  color: string;
  role: Role;
  token: string;
  /** Соотношение сторон игрового поля (ширина / высота). */
  aspect: number;
  /** Цвета, занятые другими игроками: на телефоне они неактивны. */
  taken: string[];
}

export type ErrorCode = 'no-room' | 'full';

/** Отказ во входе: комнаты нет или она заполнена. */
export interface ErrMsg {
  t: 'err';
  code: ErrorCode;
}

/** Экран хаба переподключился — телефону нужно заново прислать `join` со своим токеном. */
export interface RejoinMsg {
  t: 'rejoin';
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

export type HostToServer = HostMsg | ToMsg;
export type ServerToHost = RoomMsg | FromMsg | GoneMsg;
export type PhoneToServer = JoinMsg;
export type PhoneToScreen = InMsg | ProfileMsg | LobbyMsg | CmdMsg | GameMsg;
export type ScreenToPhone = SlotMsg | StMsg | FxMsg | GameMsg | ErrMsg;
export type ServerToPhone = ErrMsg | RejoinMsg;

/** Типы, которые телефон может слать экрану через сервер. */
export const PHONE_TO_SCREEN_TYPES: ReadonlySet<string> = new Set(['in', 'profile', 'lobby', 'cmd', 'g']);

export type Message = HostToServer | ServerToHost | PhoneToServer | PhoneToScreen | ScreenToPhone | ServerToPhone;
export type MessageType = Message['t'];

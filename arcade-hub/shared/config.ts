// Константы платформы (ARCADE_HUB_SPEC §4). Других чисел платформы в коде быть не должно.

// Движок
export const FIXED_STEP_HZ = 60;
/** Самый длинный кадр, который цикл честно досчитывает. Больше — обрезается, чтобы после
 *  возврата во вкладку не было лавины шагов. Решение этапа А0, в §4 не было. */
export const MAX_FRAME_S = 0.25;

// Игроки и комната
export const MAX_PLAYERS = 10;
export const MAX_KEYBOARD_PLAYERS = 2; // игра может разрешить меньше (keyboardMax в манифесте)
export const NICK_MAX_LEN = 8;
/** Цвета игроков (§4, §23): 12, не меньше MAX_PLAYERS. Тёмный #070912 на каждом — не ниже 7.3:1. */
export const PLAYER_COLORS = [
  '#FF7676', // красный
  '#FF9F43', // оранжевый
  '#FFD84D', // жёлтый
  '#B8F04A', // салатовый
  '#3DDC97', // зелёный
  '#2EE6D6', // бирюзовый
  '#4DD4FF', // голубой
  '#7AA8FF', // синий
  '#B69CFF', // фиолетовый
  '#F08CFF', // пурпурный
  '#FF7EB6', // розовый
  '#E8ECF5', // белый
] as const;
export const LEADER_HANDOFF_S = 10; // ведущий отключился → роль переходит дальше
export const ATTRACT_IDLE_S = 60; // витрина при пустой комнате

// Гироскоп и контроллер
export const TILT_FULL_DEG = { low: 35, mid: 22, high: 14 } as const; // по умолчанию mid
export const TILT_DEADZONE_DEG = 3;
export const TILT_LOWPASS_K = 0.18; // s = s + K * (raw - s)
export const INPUT_SEND_HZ = 30; // и только при заметном изменении
export const BUTTON_MIN_PX = 96;
export const BUTTON_PRESS_SCALE = 0.94;
export const VIBRATE_TAP_MS = 10;

// Клавиатура (§4, §11): движение и главная кнопка. Коды KeyboardEvent.code — не зависят от раскладки.
export interface KeyboardKeyMap {
  up: string;
  down: string;
  left: string;
  right: string;
  btn: string;
}
export const KEYBOARD_KEYS = {
  wasd: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', btn: 'KeyV' },
  arrows: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', btn: 'KeyL' },
} as const satisfies Record<string, KeyboardKeyMap>;
export type KeyboardScheme = keyof typeof KEYBOARD_KEYS;

// Бюджеты
export const BUNDLE_HUB_KB = 150; // меню без обложек, gzip; мягкий бюджет — поднимается с объяснением в отчёте
export const BUNDLE_CONTROLLER_KB = 30;
export const REPLAYS_KEPT = 3; // на каждую игру
export const MENU_MUSIC_VOLUME = 0.3; // от громкости игр

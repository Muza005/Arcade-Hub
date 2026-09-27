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

// Бюджеты
export const BUNDLE_HUB_KB = 150; // меню без обложек
export const BUNDLE_CONTROLLER_KB = 30;
export const REPLAYS_KEPT = 3; // на каждую игру
export const MENU_MUSIC_VOLUME = 0.3; // от громкости игр

// Dev: тестовая точка этапа А0 (уберётся на А1 вместе с точкой)
export const DEV_TEST_DOT = {
  radiusPx: 24,
  speedPxPerS: 480,
} as const;
export const DEV_FPS_SAMPLE_S = 0.5;

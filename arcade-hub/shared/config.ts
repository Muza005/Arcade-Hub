// Константы платформы (ARCADE_HUB_SPEC §4). Других чисел платформы в коде быть не должно.

// Движок
export const FIXED_STEP_HZ = 60;
/** Самый длинный кадр, который цикл честно досчитывает. Больше — обрезается, чтобы после
 *  возврата во вкладку не было лавины шагов. Решение этапа А0, в §4 не было. */
export const MAX_FRAME_S = 0.25;

// Игроки и комната
export const MAX_PLAYERS = 10;
export const MAX_KEYBOARD_PLAYERS = 2; // игра может разрешить меньше (keyboardMax в манифесте)
/** Выбор из списка в лобби: больше вариантов — рисуется переключателем «− значение +», а не рядом кнопок. */
export const LOBBY_SELECT_CHIPS_MAX = 4;
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

/** Боты (§11): своя приглушённая палитра, не пересекается с цветами игроков. Тёмный текст — от 7.8:1. */
export const BOT_COLORS = [
  '#9AA3B5',
  '#C2B8A3',
  '#A7C4BC',
  '#C9A9A6',
  '#B3B7D6',
  '#C8C48E',
  '#A9B8C9',
  '#C4A9C4',
  '#B5C49A',
  '#C7B294',
] as const;

// Сервер комнат (§2, §17)
export const WS_PATH = '/ws';
export const CONTROLLER_PATH = '/controller/';
export const ROOM_CODE_LEN = 4;
/** Без похожих друг на друга знаков (O/0, I/1): код читают с экрана через комнату. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const WS_MAX_PAYLOAD_BYTES = 16 * 1024;
export const TOKEN_BYTES = 16;
/** Сервер проверяет соединения: не ответил на ping за столько — отключён (закрытая вкладка телефона). */
export const HEARTBEAT_S = 5;
/** Паузы между попытками переподключения, с. Последняя повторяется. */
export const RECONNECT_DELAYS_S = [0.5, 1, 2, 4] as const;
/** Соотношение сторон поля по умолчанию, пока игра не задала своё (16:9). */
export const DEFAULT_ASPECT = 16 / 9;
/** Пределы соотношения сторон мира игры (ctx.aspect): уже 4:3 и шире 21:9 — поля по краям. */
export const ASPECT_RANGE = { min: 4 / 3, max: 21 / 9 } as const;
/** Экран шлёт телефонам состояние раз в столько секунд и на событиях (§17). */
export const ST_INTERVAL_S = 1;
/** Ободок главной кнопки отправляется, когда прогресс сдвинулся на столько. */
export const MAIN_BUTTON_STEP = 0.1;

// Меню игр (§6)
export const MENU_AVATARS_MAX = 8; // дальше — «+N»
export const QR_SIZE_PX = 92;

// Dev: тестовые телефоны с имитацией ввода по протоколу (§2)
export const DEV_TEST_PHONE_KEY = 'KeyP'; // P — добавить, Shift+P — отключить последнего
export const DEV_TEST_PHONE_TURN_RAD = 0.35; // насколько резко блуждает направление за отправку
export const DEV_TEST_PHONE_BTN_CHANCE = 0.03; // вероятность нажатия кнопки за отправку
export const MENU_HISTORY_KEPT = 20; // сколько последних запусков помнить для порядка карточек

// Навигация (§8): стрелка ведёт к ближайшему элементу в её направлении.
/** Во сколько раз смещение поперёк направления «дороже» расстояния вдоль него. */
export const NAV_CROSS_WEIGHT = 2;
/** Допуск в px: элемент считается лежащим в направлении, если сдвинут хотя бы на столько. */
export const NAV_EPSILON_PX = 1;
/** Вес расстояния между центрами — только чтобы развести равных кандидатов. */
export const NAV_TIE_WEIGHT = 0.001;

// Звуки меню (§19)
export const UI_SOUND_VOLUME = 0.5;

// Гироскоп и контроллер
export const TILT_FULL_DEG = { low: 35, mid: 22, high: 14 } as const; // по умолчанию mid
export const TILT_DEADZONE_DEG = 3;
export const TILT_LOWPASS_K = 0.18; // s = s + K * (raw - s)
export const INPUT_SEND_HZ = 60; // и только при заметном изменении (было 30 — заказчик: задержка джойстика)
export const BUTTON_MIN_PX = 96;
export const BUTTON_PRESS_SCALE = 0.94;
export const VIBRATE_TAP_MS = 10;
/** Изменение оси меньше этого не считается «заметным» и не отправляется. */
export const INPUT_EPSILON = 0.02;
// Прямой канал телефон ↔ экран (WebRTC): в одной сети ввод идёт мимо сервера — это и убирает задержку.
// STUN нужен, чтобы найти путь, когда телефон и ноутбук за разными роутерами; не нашли — остаётся сервер.
export const RTC_ICE_SERVERS: ReadonlyArray<{ urls: string }> = [{ urls: 'stun:stun.l.google.com:19302' }];
export const INPUT_REFRESH_S = 0.1; // по прямому каналу текущее состояние повторяется: потерянное отпускание не залипнет
/** Джойстик: доля радиуса для полного отклонения по чувствительности. */
export const JOYSTICK_FULL = { low: 1, mid: 0.8, high: 0.6 } as const;
export const JOYSTICK_DEADZONE = 0.08;
/** Меню с телефона (§8): порог оси, задержка и шаг автоповтора. */
export const MENU_NAV_THRESHOLD = 0.5;
export const MENU_NAV_REPEAT_DELAY_MS = 400;
export const MENU_NAV_REPEAT_MS = 150;

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
/** Оси ввода округляются до 1/INPUT_QUANT — и в игре, и в записи, чтобы повтор совпадал один в один. */
export const INPUT_QUANT = 1000;

// Итоги (§12)
export const RESULTS_AWARD_STEP_MS = 700; // награды появляются по одной
export const RESULTS_AWARDS_HOLD_MS = 2500; // после последней награды — к таблице
export const MENU_MUSIC_VOLUME = 0.3; // от громкости игр

// Настройки хаба (§13)
export const UI_SCALE_RANGE = { min: 90, max: 130, step: 10 } as const; // масштаб интерфейса, %
export const PERCENT_STEP = 10; // шаг ползунков 0–100 %
/** Качество графики (§13): предел чёткости сцены игры (доля от плотности пикселей экрана).
 *  Низкое — ещё и без сглаживания: для слабых ноутбуков и больших телевизоров. */
export const QUALITY_MAX_RESOLUTION = { auto: 2, low: 1, mid: 1.5, high: Number.POSITIVE_INFINITY } as const;
export const MUSIC_FADE_MS = 600; // музыка меню уходит при запуске игры

// Витрина и заставка (§5, §14)
export const ATTRACT_SLIDE_S = 15; // по столько секунд на игру
export const ATTRACT_BOTS = 4; // ботов в живой демо-сцене
export const SPLASH_MS = 1500; // заставка при первом запуске
export const LOADING_CAPTION_S = 3; // дольше — подпись «Загружаем игры…»

// Ошибки и связь (§15)
export const SERVER_DOWN_AFTER_S = 3; // столько без связи — «Телефоны сейчас недоступны»
export const TOAST_MS = 3500;

// Игровой интерфейс (§16, «Интерфейс матча»): уведомление в игре появляется и само уходит
export const NOTICE_S = 2.5; // столько видно целиком
export const NOTICE_FADE_S = 0.3; // появление и исчезновение

// ─── Раскладка «прицел» (§10 «Особые раскладки») ────────────────────
/** Ступени силы по длине линии — доли диагонали рамки поля: < 0,25 — 1, < 0,5 — 2, < 0,75 — 3, дальше — 4. */
export const AIM_STEP_THRESHOLDS = [0.25, 0.5, 0.75] as const;
export const AIM_STEPS = AIM_STEP_THRESHOLDS.length + 1;
/** Цвет конца линии по ступеням: зелёный, жёлтый, оранжевый, красный. */
export const AIM_STEP_COLORS = ['#3DDC97', '#FFD23F', '#FF9F43', '#FF4D5E'] as const;
/** Короче — отмена (тап тоже отмена). */
export const AIM_CANCEL_CM = 1.5;
export const CSS_PX_PER_CM = 96 / 2.54;
export const AIM_CARD_MIN_PX = 96;
export const AIM_CARD_HEIGHT_K = 1 / 3; // сторона карточки — не меньше трети высоты экрана
export const AIM_FRAME_MIN_HEIGHT = 0.6; // рамка поля — не меньше 60 % высоты телефона
export const AIM_TICK_MS = 100; // как часто телефон досчитывает кулдауны
export const VIBRATE_AIM_SHOT_MS = 35; // самая длинная на этом экране
export const VIBRATE_AIM_READY_MS = 4; // самая короткая: щелчок готовности

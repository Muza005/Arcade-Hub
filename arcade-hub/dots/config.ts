// Константы игры «Точки». Координаты — в пикселях мира 1920×1080 (макет большого экрана).

export const WORLD_W = 1920;
export const WORLD_H = 1080;

/** Поле — весь экран с тонким отступом; таймер и счёт лежат поверх, полупрозрачно. */
export const FIELD_INSET = 16;
export const FIELD = { left: FIELD_INSET, top: FIELD_INSET, right: WORLD_W - FIELD_INSET, bottom: WORLD_H - FIELD_INSET } as const;
export const FIELD_RADIUS = 28;

export const MATCH_S_DEFAULT = 60;
export const MATCH_S_OPTIONS = [30, 60, 90] as const; // схема лобби — этап А6
export const DASH_ENABLED_DEFAULT = true;

export const DOT_RADIUS = 28;
export const DOT_SPEED = 520; // px/с
export const DASH_SPEED = 1400; // px/с
export const DASH_S = 0.18;
export const DASH_COOLDOWN_S = 2;
/** Игроки стартуют по кругу вокруг центра поля. */
export const SPAWN_RING_RADIUS = 280;

export const STAR_RADIUS = 18;
export const STAR_INNER_RATIO = 0.45;
export const STAR_POINTS = 5;
export const STARS_BASE = 3;
export const STARS_PER_PLAYER = 1;
export const STAR_POINTS_SCORE = 1;

// Обратная связь на телефоне при сборе звезды
export const PICKUP_VIBRATE_MS = 25;
export const SECONDS_PER_MINUTE = 60;

// Итоги: повтор последних секунд матча (DOTS_SPEC)
export const REPLAY_TAIL_S = 3;
export const REPLAY_FRAME_HZ = 60;

// Графика
export const ACCENT = '#3DDC97';
export const STAR_COLOR = '#FFD84D';
export const FIELD_LINE_PX = 2;
export const NICK_FONT_PX = 22;
export const NICK_GAP_PX = 10;
// Интерфейс поверх поля: мелко, по краям, не мешает игре
export const HUD_ALPHA = 0.55;
export const HUD_PAD_PX = 28; // от края поля
export const TIMER_FONT_PX = 30;
export const SCORE_FONT_PX = 20;
export const SCORE_GAP_PX = 28;
export const SCORE_SWATCH_RADIUS = 7;

// Уведомления в игре (сами уходят через NOTICE_S платформы)
export const NOTICE_FONT_PX = 34;
export const NOTICE_Y = 140;
export const NOTICE_PAD_X = 32;
export const NOTICE_PAD_Y = 14;
export const NOTICE_PLATE_ALPHA = 0.7;
/** На скольких секундах до конца предупредить. */
export const NOTICE_LEFT_AT_S = [10] as const;

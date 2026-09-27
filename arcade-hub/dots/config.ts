// Константы игры «Точки». Координаты — в пикселях мира 1920×1080 (макет большого экрана).

export const WORLD_W = 1920;
export const WORLD_H = 1080;

/** Поле внутри мира: сверху место под таймер и счёт, по краям безопасная зона. */
export const FIELD = { left: 64, top: 144, right: 1856, bottom: 1016 } as const;
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
export const TIMER_FONT_PX = 56;
export const TIMER_Y = 72;
export const SCORE_FONT_PX = 26;
export const SCORE_GAP_PX = 40;
export const SCORE_SWATCH_RADIUS = 10;

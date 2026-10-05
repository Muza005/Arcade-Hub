// Константы игры «Точки». Координаты — в пикселях мира 1920×1080 (макет большого экрана).

export const WORLD_W = 1920;
export const WORLD_H = 1080;

/** Поле — весь экран с тонким отступом; таймер и счёт лежат поверх, полупрозрачно. */
export const FIELD_INSET = 16;

export interface Field {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Мир по высоте всегда WORLD_H, по ширине — под экран (ctx.aspect): поле тянется до краёв. */
export const worldWidth = (aspect: number): number => Math.round(WORLD_H * aspect);
export const fieldFor = (worldW: number): Field => ({
  left: FIELD_INSET,
  top: FIELD_INSET,
  right: worldW - FIELD_INSET,
  bottom: WORLD_H - FIELD_INSET,
});
/** Поле экрана 16:9 — по умолчанию (тесты, записи без aspect). */
export const FIELD = fieldFor(WORLD_W);
export const FIELD_RADIUS = 28;

export const MATCH_S_DEFAULT = 60;
export const MATCH_S_OPTIONS = [30, 60, 90] as const; // схема лобби — этап А6
/** Длительность в лобби — иконками (проверка выбора иконками): секундомер у названия; у вариантов — часы,
 *  сектор — доля полутора минут, цвет — от короткого к длинному. */
const ICON_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">';
export const DURATION_ICON = `${ICON_OPEN}<circle cx="12" cy="13.5" r="7.5"/><path d="M10 3h4M12 3v3M12 13.5V10"/></svg>`;
export const DURATION_ICONS: Record<(typeof MATCH_S_OPTIONS)[number], string> = {
  30: `${ICON_OPEN}<circle cx="12" cy="12" r="9.5"/><path d="M12 12V5.5A6.5 6.5 0 0 1 17.63 15.25Z" fill="currentColor" stroke="none"/></svg>`,
  60: `${ICON_OPEN}<circle cx="12" cy="12" r="9.5"/><path d="M12 12V5.5A6.5 6.5 0 1 1 6.37 15.25Z" fill="currentColor" stroke="none"/></svg>`,
  90: `${ICON_OPEN}<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="6.5" fill="currentColor" stroke="none"/></svg>`,
};
export const DURATION_COLORS: Record<(typeof MATCH_S_OPTIONS)[number], string> = { 30: '#7FE7FF', 60: '#FFC46B', 90: '#FF8A65' };
export const DASH_ENABLED_DEFAULT = true;
/** Бросок звёзд с телефона (проверка раскладки «прицел»): телефоны не летают, а бросают звёзды с края поля. */
export const THROW_ENABLED_DEFAULT = false;
export const THROW_COOLDOWN_S = 3;
export const THROW_SPEED = 500; // px/с на второй ступени
export const THROW_STEP_K = [0.5, 1, 2, 3] as const; // × скорость по ступеням силы
export const THROW_STAR_COLOR = '#8FF0C4';
/** Поле игрока в лобби (проверка полей на телефоне): форма точки и её фишки в счёте. */
export const SHAPES = ['circle', 'square'] as const;
export type Shape = (typeof SHAPES)[number];
export const SHAPE_DEFAULT: Shape = 'circle';
/** Иконки формы — в лобби и аватаром в итогах (цвет — currentColor). */
export const SHAPE_ICONS: Record<Shape, string> = {
  circle: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="currentColor"/></svg>',
  square:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="currentColor"/></svg>',
};
export const SQUARE_K = 0.9; // квадрат чуть меньше описанного — на глаз той же величины, что круг
export const SQUARE_CORNER_K = 0.25;

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
/** Поймал брошенную звезду — два коротких импульса (проверка узора вибрации). */
export const CATCH_VIBRATE_PATTERN = [20, 60, 20];
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
export const HUD_ALPHA = 0.55; // в покое; при событии — полностью видно
export const HUD_PAD_PX = 28; // от края поля
export const TIMER_FONT_PX = 30;
export const TIMER_URGENT_S = 10; // последние секунды: таймер яркий и пульсирует
// Счёт: кружок цвета игрока и число, по местам; лидер — в золотом ободке
export const SCORE_FONT_PX = 28;
export const SCORE_DOT_RADIUS = 12;
export const SCORE_DOT_GAP_PX = 10;
export const SCORE_GAP_PX = 26;
export const LEADER_RING_GAP_PX = 4;
export const LEADER_RING_PX = 3;
export const HUD_POP_SCALE = 0.3; // +30 % в момент очка
export const HUD_POP_S = 0.45;
export const HUD_SLIDE_RATE = 10; // 1/с: как быстро фишки меняются местами
// «+1» над игроком, собравшим звезду
export const PLUS_FONT_PX = 30;
export const PLUS_RISE_PX = 70;
export const PLUS_S = 0.8;

// Уведомления в игре (сами уходят через NOTICE_S платформы)
export const NOTICE_FONT_PX = 34;
export const NOTICE_Y = 140;
export const NOTICE_PAD_X = 32;
export const NOTICE_PAD_Y = 14;
export const NOTICE_PLATE_ALPHA = 0.7;
/** На скольких секундах до конца предупредить. */
export const NOTICE_LEFT_AT_S = [10] as const;

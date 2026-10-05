// Иконки настроек лобби Space War (24×24, цвет — currentColor; цвет варианта задаёт config.ts).
// Частота усилений — сколько искр; сложность — стрелка прибора; уровень ботов — нашивки.
import type { BotLevel, Difficulty, PowerupRate } from '../config';

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

/** Четырёхлучевая искра с центром (x, y) и лучом r. */
const SPARK_WAIST = 0.18;
const spark = (x: number, y: number, r: number): string => {
  const q = r * SPARK_WAIST;
  return `<path d="M${x} ${y - r}Q${x + q} ${y - q} ${x + r} ${y}Q${x + q} ${y + q} ${x} ${y + r}Q${x - q} ${y + q} ${x - r} ${y}Q${x - q} ${y - q} ${x} ${y - r}Z" fill="currentColor" stroke="none"/>`;
};

export const RATE_FIELD_ICON = svg(
  `<path d="M10 5Q11 12 17 13Q11 14 10 21Q9 14 3 13Q9 12 10 5Z"/>${spark(18.5, 5.5, 3)}`,
);

export const RATE_ICONS: Record<PowerupRate, string> = {
  rare: svg(spark(12, 12, 8)),
  normal: svg(spark(8.5, 8.5, 5.5) + spark(15.5, 15.5, 5.5)),
  often: svg(spark(12, 6.5, 4.5) + spark(6.5, 16.5, 4.5) + spark(17.5, 16.5, 4.5)),
  max: svg(spark(7, 7, 4.5) + spark(17, 7, 4.5) + spark(7, 17, 4.5) + spark(17, 17, 4.5)),
};

/** Сложность — гора. */
export const DIFFICULTY_FIELD_ICON = svg('<path d="M2 20L9 8l4 6 3-4 6 10Z"/>');

/** Прибор: дуга и стрелка — влево (легко), вверх, вправо (тяжело). */
const gauge = (nx: number, ny: number): string =>
  svg(`<path d="M3.5 17a8.5 8.5 0 0 1 17 0"/><path d="M12 17L${nx} ${ny}" stroke-width="2.5"/><circle cx="12" cy="17" r="1.6" fill="currentColor"/>`);

export const DIFFICULTY_ICONS: Record<Difficulty, string> = {
  easy: gauge(6.2, 13.6),
  normal: gauge(12, 10),
  hard: gauge(17.8, 13.6),
};

/** Уровень ботов — голова робота. */
export const BOTS_FIELD_ICON = svg(
  '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4.5"/><circle cx="12" cy="3.5" r="1" fill="currentColor"/><circle cx="9" cy="14" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.3" fill="currentColor" stroke="none"/>',
);

/** Нашивки: сколько уголков — такой уровень. */
const chevrons = (ys: readonly number[]): string => svg(ys.map((y) => `<path d="M5 ${y + 3}l7-5 7 5" stroke-width="2.5"/>`).join(''));

export const BOT_LEVEL_ICONS: Record<BotLevel, string> = {
  weak: chevrons([11.5]),
  mid: chevrons([8.5, 14.5]),
  strong: chevrons([6, 11.5, 17]),
};

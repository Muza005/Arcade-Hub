// Иконки настроек телефона (24×24, цвет — currentColor): виды управления, чувствительность, рука.
import type { ControlMode } from '../shared/protocol';
import type { Sensitivity } from './prefs';

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const MODE_ICONS: Record<ControlMode, string> = {
  // Джойстик — ручка на основании.
  joystick: svg('<ellipse cx="12" cy="18.5" rx="8" ry="3"/><path d="M12 18.5V9.5"/><circle cx="12" cy="6.5" r="3.5" fill="currentColor"/>'),
  // Гироскоп — наклонённый телефон и стрелки наклона.
  gyro: svg(
    '<rect x="8.5" y="3.5" width="7" height="13" rx="1.6" transform="rotate(18 12 10)"/><path d="M3.5 15.5a9.5 9.5 0 0 0 4 4.5"/><path d="M20.5 15.5a9.5 9.5 0 0 1-4 4.5"/><path d="M3.5 18.5v-3h3M20.5 18.5v-3h-3"/>',
  ),
};

/** Чувствительность — полоски: сколько горит, такая и сила. */
const BAR_X = [5, 11, 17] as const;
const BAR_H = [6, 11, 16] as const;
const BAR_DIM = 0.28;
const bars = (lit: number): string =>
  svg(
    BAR_X.map(
      (x, i) =>
        `<rect x="${x - 1.75}" y="${20 - (BAR_H[i] ?? 0)}" width="3.5" height="${BAR_H[i] ?? 0}" rx="1.2" fill="currentColor" stroke="none" opacity="${i < lit ? 1 : BAR_DIM}"/>`,
    ).join(''),
  );

export const SENS_ICONS: Record<Sensitivity, string> = { low: bars(1), mid: bars(2), high: bars(3) };

/** Рука — где окажутся джойстик (кольцо) и главная кнопка (точка) на телефоне. */
const layout = (stickX: number, buttonX: number): string =>
  svg(`<rect x="2" y="6" width="20" height="12" rx="3"/><circle cx="${stickX}" cy="12" r="2.6"/><circle cx="${buttonX}" cy="12" r="2.2" fill="currentColor" stroke="none"/>`);

export const HAND_ICONS: Record<'right' | 'left', string> = { right: layout(7.5, 16.5), left: layout(16.5, 7.5) };

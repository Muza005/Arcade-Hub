// Настройки управления на телефоне (§10): хранятся вместе с токеном и переживают матч.
import type { ControlMode } from '../shared/protocol';

export type Sensitivity = 'low' | 'mid' | 'high';

export interface Prefs {
  mode: ControlMode;
  /** Чувствительность запоминается отдельно для каждого вида. */
  sensitivity: Record<ControlMode, Sensitivity>;
  invertX: boolean;
  invertY: boolean;
  hand: 'right' | 'left';
  vibration: boolean;
}

const KEY = 'arcade-hub:controls';

export const defaultPrefs = (): Prefs => ({
  mode: 'joystick',
  sensitivity: { arrows: 'mid', gyro: 'mid', joystick: 'mid' },
  invertX: false,
  invertY: false,
  hand: 'right',
  vibration: true,
});

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultPrefs();
    const saved = JSON.parse(raw) as Partial<Prefs>;
    const base = defaultPrefs();
    return { ...base, ...saved, sensitivity: { ...base.sensitivity, ...saved.sensitivity } };
  } catch {
    return defaultPrefs();
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // без хранилища настройки живут до перезагрузки
  }
}

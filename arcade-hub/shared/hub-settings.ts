// Настройки хаба (ARCADE_HUB_SPEC §13): общие значения по умолчанию, которые игры берут, если у них нет своих.
// Хранятся на этом компьютере; каждое изменение применяется сразу.
import { UI_SCALE_RANGE } from './config';
import { DEFAULT_LANG, LANGS, type Lang } from './i18n';

export type Quality = 'auto' | 'low' | 'mid' | 'high';

export interface HubSettings {
  // Звук, 0–100
  master: number;
  music: number;
  effects: number;
  menuSounds: boolean;
  // Изображение
  quality: Quality;
  /** Масштаб интерфейса, 90–130 %. */
  uiScale: number;
  // Комфорт, 0–100
  flash: number;
  shake: number;
  bloom: number;
  reducedMotion: boolean;
  /** Итоги начинаются с повтора последних секунд матча (§12). */
  replay: boolean;
  lang: Lang;
}

const KEY = 'arcade-hub:settings';
const FULL = 100;
const QUALITIES: readonly Quality[] = ['auto', 'low', 'mid', 'high'];

export const defaultHubSettings = (): HubSettings => ({
  master: FULL,
  music: FULL,
  effects: FULL,
  menuSounds: true,
  quality: 'auto',
  uiScale: FULL,
  flash: FULL,
  shake: FULL,
  bloom: FULL,
  reducedMotion: false,
  replay: true,
  lang: DEFAULT_LANG,
});

const percent = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(FULL, Math.max(0, Math.round(v))) : fallback;

/** Проверенные настройки: чужие значения заменяются значениями по умолчанию. */
export function sanitizeHubSettings(raw: unknown): HubSettings {
  const d = defaultHubSettings();
  const s = typeof raw === 'object' && raw !== null ? (raw as Partial<Record<keyof HubSettings, unknown>>) : {};
  const scale = typeof s.uiScale === 'number' ? s.uiScale : d.uiScale;
  return {
    master: percent(s.master, d.master),
    music: percent(s.music, d.music),
    effects: percent(s.effects, d.effects),
    menuSounds: typeof s.menuSounds === 'boolean' ? s.menuSounds : d.menuSounds,
    quality: QUALITIES.includes(s.quality as Quality) ? (s.quality as Quality) : d.quality,
    uiScale: Math.min(UI_SCALE_RANGE.max, Math.max(UI_SCALE_RANGE.min, Math.round(scale))),
    flash: percent(s.flash, d.flash),
    shake: percent(s.shake, d.shake),
    bloom: percent(s.bloom, d.bloom),
    reducedMotion: typeof s.reducedMotion === 'boolean' ? s.reducedMotion : d.reducedMotion,
    replay: typeof s.replay === 'boolean' ? s.replay : d.replay,
    lang: LANGS.includes(s.lang as Lang) ? (s.lang as Lang) : d.lang,
  };
}

export function readHubSettings(): HubSettings {
  try {
    return sanitizeHubSettings(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return defaultHubSettings();
  }
}

export function writeHubSettings(settings: HubSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // без хранилища настройки живут до перезагрузки
  }
}

// Локальное хранилище хаба. Любая ошибка доступа (приватный режим, запрет) — просто значение по умолчанию.
import { MENU_HISTORY_KEPT } from '../shared/config';

const KEY_HISTORY = 'arcade-hub:launched';
const KEY_SOUND = 'arcade-hub:sound';
const KEY_REDUCED_MOTION = 'arcade-hub:reduced-motion';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // хранилище недоступно — работаем без памяти
  }
}

/** id игр по времени запуска, последние — первыми. */
export function launchHistory(): string[] {
  const value = read<unknown>(KEY_HISTORY, []);
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function rememberLaunch(gameId: string): void {
  const history = [gameId, ...launchHistory().filter((id) => id !== gameId)].slice(0, MENU_HISTORY_KEPT);
  write(KEY_HISTORY, history);
}

export function soundEnabled(): boolean {
  return read<unknown>(KEY_SOUND, true) !== false;
}

export function setSoundEnabled(on: boolean): void {
  write(KEY_SOUND, on);
}

/** Настройка «Уменьшить движение» (переключатель — в настройках хаба, этап А8). */
export function reducedMotion(): boolean {
  return read<unknown>(KEY_REDUCED_MOTION, false) === true;
}

export function setReducedMotion(on: boolean): void {
  write(KEY_REDUCED_MOTION, on);
  applyReducedMotion();
}

/** Системный prefers-reduced-motion работает через CSS сам; здесь — настройка хаба. */
export function applyReducedMotion(): void {
  document.documentElement.toggleAttribute('data-reduced-motion', reducedMotion());
}

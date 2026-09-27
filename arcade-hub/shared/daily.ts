// Ежедневный сид (ARCADE_HUB_SPEC §12): общий для всех игр сервис — один расклад на день.

/** Сегодняшняя дата по местному времени: 2026-09-27. */
export function today(date: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Сид дня: хеш FNV-1a от даты. У всех компьютеров в этот день он одинаковый. */
export function dailySeed(day: string = today()): number {
  let hash = FNV_OFFSET;
  for (const ch of `arcade-hub:${day}`) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash;
}

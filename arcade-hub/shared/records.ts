// Рекорды по играм на этом компьютере (§12). Аккаунтов нет. Пишет платформа, читает meta() игры.
import { today } from './daily';

export interface RecordEntry {
  nick: string;
  score: number;
  date: string;
  /** Цвет игрока (в старых записях его нет). */
  color?: string;
}

export interface GameRecords {
  /** Лучший результат за всё время. */
  best?: RecordEntry;
  /** Лучший результат по сиду дня (действует только в свой день). */
  daily?: RecordEntry;
  /** Последний матч: строки по местам. */
  last?: { date: string; rows: MatchRow[] };
}

export interface MatchRow {
  nick: string;
  score: number;
  place: number;
  color?: string;
}

const PREFIX = 'arcade-hub:records:';

export function readRecords(gameId: string): GameRecords {
  try {
    const raw = localStorage.getItem(PREFIX + gameId);
    return raw ? (JSON.parse(raw) as GameRecords) : {};
  } catch {
    return {};
  }
}

/** Рекорд дня — только если он сегодняшний. */
export function dailyBest(records: GameRecords, day: string = today()): RecordEntry | undefined {
  return records.daily?.date === day ? records.daily : undefined;
}

/** Записать матч. Возвращает, какие рекорды побиты. */
export function recordMatch(
  gameId: string,
  rows: readonly MatchRow[],
  daily: boolean,
  day: string = today(),
): { best: boolean; daily: boolean } {
  const records = readRecords(gameId);
  const top = [...rows].sort((a, b) => a.place - b.place)[0];
  const beaten = { best: false, daily: false };
  if (top) {
    const entry: RecordEntry = { nick: top.nick, score: top.score, date: day, ...(top.color ? { color: top.color } : {}) };
    if (!records.best || top.score > records.best.score) {
      records.best = entry;
      beaten.best = true;
    }
    const currentDaily = dailyBest(records, day);
    if (daily && (!currentDaily || top.score > currentDaily.score)) {
      records.daily = entry;
      beaten.daily = true;
    }
  }
  records.last = { date: day, rows: rows.map((r) => ({ ...r })) };
  try {
    localStorage.setItem(PREFIX + gameId, JSON.stringify(records));
  } catch {
    // без хранилища рекорды не сохраняются
  }
  return beaten;
}

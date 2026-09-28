import { beforeEach, describe, expect, it } from 'vitest';
import { dailySeed, today } from './daily';
import { dailyBest, readRecords, recordMatch } from './records';
import { listReplays, saveReplay, type Replay } from './replays';

// Простое хранилище в памяти вместо браузерного.
beforeEach(() => {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

describe('сид дня', () => {
  it('один день — один сид, другой день — другой', () => {
    expect(dailySeed('2026-09-27')).toBe(dailySeed('2026-09-27'));
    expect(dailySeed('2026-09-27')).not.toBe(dailySeed('2026-09-28'));
    expect(today(new Date(2026, 8, 7))).toBe('2026-09-07');
  });
});

describe('рекорды', () => {
  const rows = (score: number) => [
    { nick: 'Аня', score, place: 1 },
    { nick: 'Олег', score: 1, place: 2 },
  ];

  it('лучший результат обновляется только вверх', () => {
    expect(recordMatch('g', rows(5), false, '2026-09-27')).toEqual({ best: true, daily: false });
    expect(recordMatch('g', rows(3), false, '2026-09-27').best).toBe(false);
    expect(readRecords('g').best?.score).toBe(5);
    expect(readRecords('g').last?.rows[0]).toEqual({ nick: 'Аня', score: 3, place: 1 });
  });

  it('ноль очков — не рекорд, но последний матч запоминается', () => {
    expect(recordMatch('g', rows(0), true, '2026-09-27')).toEqual({ best: false, daily: false });
    expect(readRecords('g').best).toBeUndefined();
    expect(readRecords('g').last?.rows).toHaveLength(2);
  });

  it('рекорд дня живёт только свой день', () => {
    recordMatch('g', rows(4), true, '2026-09-27');
    expect(dailyBest(readRecords('g'), '2026-09-27')?.score).toBe(4);
    expect(dailyBest(readRecords('g'), '2026-09-28')).toBeUndefined();
  });
});

describe('записи', () => {
  it('хранятся последние три', () => {
    const replay = (seed: number): Replay => ({
      gameId: 'g', version: '1', date: '2026-09-27', seed, daily: false, mode: 'm', settings: {}, players: [], inputs: [],
    });
    for (let i = 1; i <= 5; i++) saveReplay(replay(i));
    expect(listReplays('g').map((r) => r.seed)).toEqual([5, 4, 3]);
  });
});

import { describe, expect, it } from 'vitest';
import { pickAwards, type AwardInput } from './awards';
import type { PilotStats } from './pilot';

const stats = (s: Partial<PilotStats>): PilotStats => ({
  hits: 0, near: 0, kills: 0, shots: 0, rams: 0, revives: 0, pickups: 0, sabShots: 0, maxMult: 1, waves: 0, ...s,
});
const player = (id: string, s: Partial<PilotStats>, survivedS = 100, score = 0): AwardInput => ({ id, stats: stats(s), survivedS, score });

describe('награды', () => {
  it('каждому — ровно одна, именные — по статистике', () => {
    const list = [
      player('a', { hits: 4, near: 40 }),
      player('b', { hits: 0 }),
      player('c', { hits: 3, kills: 20 }),
      player('d', { hits: 5, rams: 3 }),
      player('e', { hits: 2, revives: 2 }),
    ];
    const awards = pickAwards(list);
    expect(awards).toHaveLength(list.length);
    expect(new Set(awards.map((a) => a.id)).size).toBe(list.length);
    const of = (id: string) => awards.find((a) => a.id === id)?.key;
    expect(of('e')).toBe('livingShield');
    expect(of('b')).toBe('untouched');
    expect(of('a')).toBe('daredevil');
    expect(of('c')).toBe('sharpshooter');
    expect(of('d')).toBe('kamikaze');
  });

  it('десять одинаковых игроков — награды у всех', () => {
    const list = Array.from({ length: 10 }, (_, i) => player(`p${i}`, {}, 10, i));
    const awards = pickAwards(list);
    expect(awards).toHaveLength(10);
    expect(awards.filter((a) => a.key === 'onDuty').length).toBeGreaterThan(0);
  });
});

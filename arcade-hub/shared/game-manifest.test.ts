import { describe, expect, it } from 'vitest';
import { rankByScore } from './game-manifest';

describe('rankByScore', () => {
  it('больше очков — выше, равные делят место', () => {
    const rows = rankByScore([
      { playerId: 'a', score: 3 },
      { playerId: 'b', score: 7 },
      { playerId: 'c', score: 3 },
      { playerId: 'd', score: 1 },
    ]);
    expect(rows.map((r) => [r.playerId, r.place])).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 2],
      ['d', 4],
    ]);
  });
});

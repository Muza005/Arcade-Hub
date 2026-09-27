import { describe, expect, it } from 'vitest';
import type { GameManifest } from '../../shared/game-manifest';
import { badgeFor, orderGames, range } from './catalog';

const game = (id: string, over: Partial<GameManifest> = {}): GameManifest =>
  ({ id, title: id, status: 'available', players: { min: 2, max: 4, keyboardMax: 2 }, ...over }) as GameManifest;

describe('orderGames', () => {
  it('последние запущенные, потом остальные по алфавиту', () => {
    const games = [game('c'), game('a'), game('d'), game('b')];
    expect(orderGames(games, ['d', 'b'], (g) => g.id).map((g) => g.id)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('игры со статусом soon не показываются', () => {
    const games = [game('a'), game('b', { status: 'soon' })];
    expect(orderGames(games, [], (g) => g.id).map((g) => g.id)).toEqual(['a']);
  });
});

describe('badgeFor', () => {
  it('людей мало / много / пусто', () => {
    expect(badgeFor(game('a'), 1, true)).toEqual({ kind: 'needMore', n: 1 });
    expect(badgeFor(game('a'), 6, true)).toEqual({ kind: 'max', n: 4 });
    expect(badgeFor(game('a'), 0, true)).toBeNull();
  });

  it('новая игра — «Новое», но подсказка по игрокам важнее', () => {
    expect(badgeFor(game('a'), 3, false)).toEqual({ kind: 'new' });
    expect(badgeFor(game('a'), 1, false)).toEqual({ kind: 'needMore', n: 1 });
  });

  it('рекорд дня — первым', () => {
    const g = game('a', { meta: () => ({ dailyBest: '100', hasReplays: false }) });
    expect(badgeFor(g, 1, false)).toEqual({ kind: 'daily' });
  });
});

it('range', () => {
  expect(range([2, 4])).toBe('2–4');
  expect(range([4, 4])).toBe('4');
});

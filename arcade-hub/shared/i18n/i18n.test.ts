import { afterEach, describe, expect, it } from 'vitest';
import { setLang, tn } from './index';

describe('tn', () => {
  afterEach(() => setLang('ru'));

  it('русские формы числа', () => {
    expect(tn('game.players', 1, { range: '1' })).toBe('1 игрок');
    expect(tn('game.players', 4, { range: '2–4' })).toBe('2–4 игрока');
    expect(tn('game.players', 10, { range: '1–10' })).toBe('1–10 игроков');
  });

  it('английские формы числа', () => {
    setLang('en');
    expect(tn('game.players', 1, { range: '1' })).toBe('1 player');
    expect(tn('game.players', 10, { range: '1–10' })).toBe('1–10 players');
  });
});

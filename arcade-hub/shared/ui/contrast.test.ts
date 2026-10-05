// Контраст (ARCADE_HUB_SPEC §18, §21): весь текст — не ниже 4.5:1; тёмный текст на цветах игроков — от 7.3.
// Цвета берутся прямо из tokens.css и палитр, поэтому тест ловит любую правку.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOT_COLORS, PLAYER_COLORS } from '../config';
import { GAMES } from '../games';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const token = (name: string): string => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m?.[1]) throw new Error(`нет токена --${name}`);
  return m[1];
};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_MIN = 4.5;
const PLAYER_MIN = 7.3;

describe('контраст токенов', () => {
  const bg = token('bg');
  const surface = token('surface');
  const surface2 = token('surface-2');
  it.each([
    ['text на bg', token('text'), bg],
    ['text-2 на bg', token('text-2'), bg],
    ['text-3 на bg', token('text-3'), bg],
    ['text-3 на surface', token('text-3'), surface],
    ['text-2 на surface-2', token('text-2'), surface2],
    ['text на surface-2', token('text'), surface2],
    ['bg на ok', bg, token('ok')],
    ['bg на warn', bg, token('warn')],
    ['bg на danger', bg, token('danger')],
    ['danger на bg', token('danger'), bg],
    ['warn на bg', token('warn'), bg],
  ])('%s ≥ 4.5', (_name, fg, back) => {
    expect(contrast(fg, back)).toBeGreaterThanOrEqual(TEXT_MIN);
  });
});

describe('цвета игроков, ботов и игр', () => {
  it.each([...PLAYER_COLORS, ...BOT_COLORS])('тёмный текст на %s ≥ 7.3', (color) => {
    expect(contrast(token('bg'), color)).toBeGreaterThanOrEqual(PLAYER_MIN);
  });

  it.each(GAMES.map((g) => [g.id, g.accent] as const))('кнопка «Играть» %s: тёмный текст ≥ 4.5', (_id, accent) => {
    expect(contrast(token('on-accent'), accent)).toBeGreaterThanOrEqual(TEXT_MIN);
  });
});

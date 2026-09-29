import { describe, expect, it } from 'vitest';
import type { LobbyField } from '../../shared/game-manifest';
import { defaults, sanitize, stepValue } from './fields';
import { buildRoster } from './roster';

const fields: LobbyField[] = [
  { key: 'dur', label: 'dur', kind: 'select', options: [{ value: 30, label: 'a' }, { value: 60, label: 'b' }], default: 60 },
  { key: 'dash', label: 'dash', kind: 'toggle', default: true },
  { key: 'speed', label: 'speed', kind: 'slider', min: 1, max: 5, step: 0.5, default: 3 },
];

describe('поля лобби', () => {
  it('значения по умолчанию и проверка сохранённых', () => {
    expect(defaults(fields)).toEqual({ dur: 60, dash: true, speed: 3 });
    expect(sanitize(fields, { dur: 45, dash: 'yes', speed: 9, junk: 1 })).toEqual({ dur: 60, dash: true, speed: 5 });
    expect(sanitize(fields, { dur: 30, dash: false, speed: 1.7 })).toEqual({ dur: 30, dash: false, speed: 1.5 });
  });

  it('шаги значений', () => {
    const [dur, dash, speed] = fields as [LobbyField, LobbyField, LobbyField];
    expect(stepValue(dur, 60, -1)).toBe(30);
    expect(stepValue(dur, 30, -1)).toBe(30);
    expect(stepValue(dash, true, 1)).toBe(false);
    expect(stepValue(speed, 5, 1)).toBe(5);
    expect(stepValue(speed, 3, 1)).toBe(3.5);
  });
});

describe('состав матча', () => {
  const names = { player: (n: number) => `Игрок ${n}`, bot: (n: number) => `Бот ${n}` };
  const phone = (id: string, color: string, connected = true) => ({ id, nick: id, color, leader: id === '1', connected });

  it('телефоны, клавиатура и боты — до максимума, лишние ждут', () => {
    const roster = buildRoster({
      phones: [phone('1', '#FF7676'), phone('2', '#FF9F43'), phone('3', '#FFD84D', false)],
      keyboard: ['wasd', 'arrows'],
      bots: 5,
      players: { min: 2, max: 3 },
      names,
    });
    expect(roster.playing.map((p) => p.id)).toEqual(['1', '2', 'kb-wasd']);
    expect(roster.waiting.map((p) => p.id)).toEqual(['kb-arrows']);
    expect(roster.missing).toBe(0);
  });

  it('цвет клавиатуры не совпадает с телефонами, боты — своей палитрой', () => {
    const roster = buildRoster({
      phones: [phone('1', '#FF7676')],
      keyboard: ['wasd'],
      bots: 1,
      players: { min: 4, max: 10 },
      names,
    });
    const [p, kb, bot] = roster.playing;
    expect(kb?.color).not.toBe(p?.color);
    expect(bot).toMatchObject({ kind: 'bot', nick: 'Бот 1' });
    expect(roster.missing).toBe(1);
  });

  it('клавиатура — «Игрок N» со свободным номером, свой ник и цвет из профиля', () => {
    const roster = buildRoster({
      phones: [{ ...phone('1', '#FF7676'), nick: 'Игрок 1' }],
      keyboard: ['wasd', 'arrows'],
      profiles: new Map([['arrows', { nick: 'Аня', color: '#FF7676' }]]),
      bots: 0,
      players: { min: 1, max: 10 },
      names,
    });
    const [, wasd, arrows] = roster.playing;
    expect(wasd?.nick).toBe('Игрок 2');
    expect(arrows?.nick).toBe('Аня');
    // Цвет занят телефоном — клавиатура получает свободный.
    expect(arrows?.color).not.toBe('#FF7676');
  });

  it('убранный из матча телефон не играет, но виден отдельно', () => {
    const roster = buildRoster({
      phones: [phone('1', '#FF7676'), phone('2', '#FF9F43')],
      keyboard: [],
      benched: new Set(['2']),
      bots: 0,
      players: { min: 1, max: 10 },
      names,
    });
    expect(roster.playing.map((p) => p.id)).toEqual(['1']);
    expect(roster.benched.map((p) => p.id)).toEqual(['2']);
  });
});

import { describe, expect, it } from 'vitest';
import { cleanNick, RoomState } from './room-state';

const palette = ['red', 'orange', 'yellow', 'green'];
let tokens = 0;
const make = (maxPlayers = 3) =>
  new RoomState({ palette, maxPlayers, makeToken: () => `tok${++tokens}`, defaultNick: (n) => `P${n}` });

describe('RoomState', () => {
  it('первый вошедший — ведущий, цвета не повторяются', () => {
    const room = make();
    const a = room.join('c1');
    const b = room.join('c2');
    if ('error' in a || 'error' in b) throw new Error();
    expect(room.isLeader(a.slot)).toBe(true);
    expect(room.isLeader(b.slot)).toBe(false);
    expect(a.slot.color).not.toBe(b.slot.color);
  });

  it('по токену телефон возвращается в свой слот', () => {
    const room = make();
    const first = room.join('c1');
    if ('error' in first) throw new Error();
    room.profile('c1', 'Мурад', 'yellow');
    room.leave('c1');
    expect(room.players()[0]?.connected).toBe(false);

    const back = room.join('c9', first.slot.token);
    if ('error' in back) throw new Error();
    expect(back.returning).toBe(true);
    expect(back.slot).toMatchObject({ id: first.slot.id, nick: 'Мурад', color: 'yellow', cid: 'c9' });
  });

  it('отключившийся держит место: комната полна', () => {
    const room = make(1);
    room.join('c1');
    room.leave('c1');
    expect(room.join('c2')).toEqual({ error: 'full' });
  });

  it('занятый цвет — ближайший свободный', () => {
    const room = make();
    room.join('c1'); // red
    room.join('c2'); // orange
    room.profile('c1', 'A', 'yellow');
    const b = room.profile('c2', 'B', 'yellow');
    expect(b?.color).toBe('green'); // +1 от yellow
  });

  it('сохранение и восстановление после перезагрузки хаба', () => {
    const room = make();
    room.code = 'K7QX';
    room.join('c1');
    const saved = room.save()!;
    const again = make();
    again.restore(saved);
    expect(again.players()[0]).toMatchObject({ connected: false, leader: true });
    expect(again.join('c5', saved.slots[0]!.token)).toMatchObject({ returning: true });
  });
});

it('cleanNick', () => {
  expect(cleanNick('  Очень  длинный ник ')).toBe('Очень дл');
  expect(cleanNick('   ')).toBe('');
});

// Кто играет в матче (§11): телефоны по порядку входа, затем клавиатура, затем боты — не больше максимума игры.
import type { KeyboardScheme } from '../../engine/input';
import { BOT_COLORS, PLAYER_COLORS } from '../../shared/config';
import type { PlayerKind } from '../../shared/game-manifest';
import type { RoomPlayer } from '../room';

export interface RosterEntry {
  id: string;
  nick: string;
  color: string;
  kind: PlayerKind;
  leader: boolean;
  connected: boolean;
  scheme?: KeyboardScheme;
}

export interface Roster {
  playing: RosterEntry[];
  /** Не влезли в максимум игры — ждут следующего матча. */
  waiting: RosterEntry[];
  /** Сколько ещё нужно до минимума игры. */
  missing: number;
}

export interface RosterInput {
  phones: readonly RoomPlayer[];
  keyboard: readonly KeyboardScheme[];
  bots: number;
  players: { min: number; max: number };
  names: { keyboard(scheme: KeyboardScheme): string; bot(n: number): string };
}

/** Цвет клавиатурного игрока: первый из палитры, не занятый телефонами и другой клавиатурой. */
export function keyboardColor(taken: ReadonlySet<string>): string {
  return PLAYER_COLORS.find((c) => !taken.has(c)) ?? (PLAYER_COLORS[0] as string);
}

export function buildRoster({ phones, keyboard, bots, players, names }: RosterInput): Roster {
  const taken = new Set(phones.map((p) => p.color));
  const humans: RosterEntry[] = [
    // Отключившийся держит место в комнате, но в матч не идёт.
    ...phones
      .filter((p) => p.connected)
      .map((p) => ({ id: p.id, nick: p.nick, color: p.color, kind: 'phone' as const, leader: p.leader, connected: true })),
    ...keyboard.map((scheme) => {
      const color = keyboardColor(taken);
      taken.add(color);
      return {
        id: `kb-${scheme}`,
        nick: names.keyboard(scheme),
        color,
        kind: 'keyboard' as const,
        leader: false,
        connected: true,
        scheme,
      };
    }),
  ];
  const playing = humans.slice(0, players.max);
  const waiting = humans.slice(players.max);
  const botCount = Math.max(0, Math.min(bots, players.max - playing.length));
  for (let i = 0; i < botCount; i++) {
    playing.push({
      id: `bot-${i + 1}`,
      nick: names.bot(i + 1),
      color: BOT_COLORS[i % BOT_COLORS.length] as string,
      kind: 'bot',
      leader: false,
      connected: true,
    });
  }
  return { playing, waiting, missing: Math.max(0, players.min - playing.length) };
}

// Кто играет в матче (§11): телефоны по порядку входа, затем клавиатура, затем боты — не больше максимума игры.
// Клавиатурные игроки по умолчанию — «Игрок N» со свободным номером; ник и цвет можно поменять в лобби.
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
  /** Телефоны, которых убрали из этого матча в лобби: в комнате остаются, могут вернуться. */
  benched: RosterEntry[];
  /** Сколько ещё нужно до минимума игры. */
  missing: number;
}

export interface KeyboardProfile {
  nick?: string;
  color?: string;
}

export interface RosterInput {
  phones: readonly RoomPlayer[];
  keyboard: readonly KeyboardScheme[];
  /** Свой ник и цвет клавиатурного игрока (если меняли). */
  profiles?: ReadonlyMap<KeyboardScheme, KeyboardProfile>;
  benched?: ReadonlySet<string>;
  /** Режим «цвет — команда»: свой цвет клавиатурного игрока допускается, даже если занят. */
  sharedColors?: boolean;
  bots: number;
  players: { min: number; max: number };
  names: { player(n: number): string; bot(n: number): string };
}

/** Цвет клавиатурного игрока: первый из палитры, не занятый телефонами и другой клавиатурой. */
export function keyboardColor(taken: ReadonlySet<string>): string {
  return PLAYER_COLORS.find((c) => !taken.has(c)) ?? (PLAYER_COLORS[0] as string);
}

export function buildRoster({ phones, keyboard, profiles, benched, sharedColors, bots, players, names }: RosterInput): Roster {
  // Отключившийся держит место в комнате, но в матч не идёт.
  const online = phones.filter((p) => p.connected);
  const phoneEntry = (p: RoomPlayer): RosterEntry => ({
    id: p.id,
    nick: p.nick,
    color: p.color,
    kind: 'phone',
    leader: p.leader,
    connected: true,
  });
  const taken = new Set(online.map((p) => p.color));
  const usedNicks = new Set(online.map((p) => p.nick));
  for (const scheme of keyboard) {
    const nick = profiles?.get(scheme)?.nick;
    if (nick) usedNicks.add(nick);
  }
  let next = 1;
  const freeNick = (): string => {
    while (usedNicks.has(names.player(next))) next++;
    const nick = names.player(next);
    usedNicks.add(nick);
    return nick;
  };

  const humans: RosterEntry[] = [
    ...online.filter((p) => !benched?.has(p.id)).map(phoneEntry),
    ...keyboard.map((scheme) => {
      const profile = profiles?.get(scheme);
      const color = profile?.color && (sharedColors || !taken.has(profile.color)) ? profile.color : keyboardColor(taken);
      taken.add(color);
      return {
        id: `kb-${scheme}`,
        nick: profile?.nick || freeNick(),
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
  return {
    playing,
    waiting,
    benched: online.filter((p) => benched?.has(p.id)).map(phoneEntry),
    missing: Math.max(0, players.min - playing.length),
  };
}

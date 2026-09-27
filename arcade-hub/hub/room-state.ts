// Комната на экране — источник истины (ARCADE_HUB_SPEC §2, §9): слоты, токены, ведущий, профили.
// Сервер только пересылает; кто в каком слоте и какого цвета, решает хаб.
import { NICK_MAX_LEN } from '../shared/config';
import type { RoomPlayer } from './room';

export interface Slot {
  id: number;
  token: string;
  /** Id соединения на сервере; null — телефон отключился, место держится. */
  cid: string | null;
  nick: string;
  color: string;
}

export interface RoomStateOptions {
  palette: readonly string[];
  maxPlayers: number;
  makeToken: () => string;
  defaultNick: (n: number) => string;
}

export interface SavedRoom {
  code: string;
  nextId: number;
  slots: Array<Omit<Slot, 'cid'>>;
}

export type JoinResult = { slot: Slot; returning: boolean } | { error: 'full' };

/** Ник: без лишних пробелов, не длиннее NICK_MAX_LEN символов (не байт). */
export function cleanNick(nick: string): string {
  return [...nick.replace(/\s+/g, ' ').trim()].slice(0, NICK_MAX_LEN).join('');
}

export class RoomState {
  code: string | null = null;
  private slots: Slot[] = [];
  private nextId = 1;

  constructor(private readonly options: RoomStateOptions) {}

  get size(): number {
    return this.slots.length;
  }

  bySid(cid: string): Slot | undefined {
    return this.slots.find((s) => s.cid === cid);
  }

  connected(): Slot[] {
    return this.slots.filter((s) => s.cid !== null);
  }

  /** Ведущий — первый по порядку входа. Роль остаётся и при обрыве (передача — этап А8). */
  isLeader(slot: Slot): boolean {
    return this.slots[0] === slot;
  }

  /** Цвета, занятые другими игроками. */
  takenBy(slot: Slot | null): string[] {
    return this.slots.filter((s) => s !== slot).map((s) => s.color);
  }

  join(cid: string, token?: string): JoinResult {
    const known = token ? this.slots.find((s) => s.token === token) : undefined;
    if (known) {
      known.cid = cid;
      return { slot: known, returning: true };
    }
    if (this.slots.length >= this.options.maxPlayers) return { error: 'full' };
    const id = this.nextId++;
    const slot: Slot = {
      id,
      token: this.options.makeToken(),
      cid,
      nick: this.options.defaultNick(id),
      color: this.nearestFree(0, null),
    };
    this.slots.push(slot);
    return { slot, returning: false };
  }

  leave(cid: string): Slot | undefined {
    const slot = this.bySid(cid);
    if (slot) slot.cid = null;
    return slot;
  }

  /** Меняет профиль. Занятый цвет заменяется ближайшим свободным по палитре. */
  profile(cid: string, nick: string, color: string): Slot | undefined {
    const slot = this.bySid(cid);
    if (!slot) return undefined;
    const clean = cleanNick(nick);
    if (clean) slot.nick = clean;
    const index = this.options.palette.indexOf(color);
    if (index !== -1) slot.color = this.nearestFree(index, slot);
    return slot;
  }

  players(): RoomPlayer[] {
    return this.slots.map((s) => ({
      id: String(s.id),
      nick: s.nick,
      color: s.color,
      leader: this.isLeader(s),
      connected: s.cid !== null,
    }));
  }

  save(): SavedRoom | null {
    if (!this.code) return null;
    const slots = this.slots.map(({ id, token, nick, color }) => ({ id, token, nick, color }));
    return { code: this.code, nextId: this.nextId, slots };
  }

  /** После перезагрузки хаба: все телефоны сначала «не на связи», пока не пришлют join с токеном. */
  restore(saved: SavedRoom): void {
    this.code = saved.code;
    this.nextId = saved.nextId;
    this.slots = saved.slots.map((s) => ({ ...s, cid: null }));
  }

  private nearestFree(from: number, self: Slot | null): string {
    const { palette } = this.options;
    const taken = new Set(this.takenBy(self));
    for (let step = 0; step < palette.length; step++) {
      // Сначала сам цвет, потом соседи: +1, −1, +2, −2…
      for (const dir of step === 0 ? [0] : [1, -1]) {
        const i = (((from + dir * step) % palette.length) + palette.length) % palette.length;
        const color = palette[i] as string;
        if (!taken.has(color)) return color;
      }
    }
    return self?.color ?? (palette[from] as string);
  }
}

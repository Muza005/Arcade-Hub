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
  /** Браузер телефона не подходит (§15). */
  unsupported?: boolean;
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
  leaderId?: number | null;
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
  /** Ведущий — первый вошедший, пока роль не передали. */
  private leaderId: number | null = null;

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

  /** Роль остаётся у ведущего и при обрыве; автопередача через 10 с — этап А8. */
  isLeader(slot: Slot): boolean {
    return slot.id === this.leaderId;
  }

  leader(): Slot | undefined {
    return this.slots.find((s) => s.id === this.leaderId);
  }

  /** Ведущий на связи не вернулся (§15): роль — следующему подключённому по порядку входа. */
  autoHandoff(): Slot | undefined {
    const leader = this.leader();
    if (leader?.cid) return undefined;
    const next = this.slots.find((s) => s.cid !== null && s !== leader);
    if (next) this.leaderId = next.id;
    return next;
  }

  /**
   * «Это я»: телефон вошёл как новый (потерял токен — другой браузер, чистая история)
   * и забирает своё старое место. Место должно быть свободно; новый слот исчезает.
   */
  claim(cid: string, targetId: number): Slot | undefined {
    const current = this.bySid(cid);
    const target = this.slots.find((s) => s.id === targetId);
    if (!current || !target || target.cid !== null || target === current) return undefined;
    target.cid = cid;
    if (current.unsupported) target.unsupported = true;
    else delete target.unsupported;
    this.slots = this.slots.filter((s) => s !== current);
    if (this.leaderId === current.id) this.leaderId = target.id;
    return target;
  }

  /** Убрать отключённого игрока из комнаты (кнопка у его аватара). Подключённых не трогаем. */
  remove(id: number): boolean {
    const slot = this.slots.find((s) => s.id === id);
    if (!slot || slot.cid !== null) return false;
    this.slots = this.slots.filter((s) => s !== slot);
    if (this.leaderId === id) this.leaderId = (this.slots.find((s) => s.cid !== null) ?? this.slots[0])?.id ?? null;
    return true;
  }

  /** «Передать ведущего»: только текущий ведущий и только игроку этой комнаты. */
  handoff(fromCid: string, targetId: number): boolean {
    const from = this.bySid(fromCid);
    const target = this.slots.find((s) => s.id === targetId);
    if (!from || !target || !this.isLeader(from) || target === from) return false;
    this.leaderId = target.id;
    return true;
  }

  /** Цвета, занятые другими игроками. */
  takenBy(slot: Slot | null): string[] {
    return this.slots.filter((s) => s !== slot).map((s) => s.color);
  }

  join(cid: string, token?: string, unsupported = false): JoinResult {
    const known = token ? this.slots.find((s) => s.token === token) : undefined;
    if (known) {
      known.cid = cid;
      known.unsupported = unsupported;
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
      unsupported,
    };
    this.slots.push(slot);
    this.leaderId ??= slot.id;
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
      ...(s.unsupported ? { warning: true } : {}),
    }));
  }

  save(): SavedRoom | null {
    if (!this.code) return null;
    const slots = this.slots.map(({ id, token, nick, color }) => ({ id, token, nick, color }));
    return { code: this.code, nextId: this.nextId, leaderId: this.leaderId, slots };
  }

  /** После перезагрузки хаба: все телефоны сначала «не на связи», пока не пришлют join с токеном. */
  restore(saved: SavedRoom): void {
    this.code = saved.code;
    this.nextId = saved.nextId;
    this.slots = saved.slots.map((s) => ({ ...s, cid: null }));
    this.leaderId = saved.leaderId ?? this.slots[0]?.id ?? null;
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

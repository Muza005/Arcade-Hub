// Сервер комнат (ARCADE_HUB_SPEC §2): держит комнаты и пересылает сообщения. Игру не считает.
// Первое сообщение соединения решает его роль: `host` — экран хаба, `join` — телефон.
import { randomInt } from 'node:crypto';
import type { WebSocket } from 'ws';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LEN } from '../shared/config';
import {
  PHONE_TO_SCREEN_TYPES,
  type FromMsg,
  type GoneMsg,
  type Message,
  type RoomMsg,
  type ServerToPhone,
} from '../shared/protocol';

interface Room {
  code: string;
  host: WebSocket | null;
  phones: Map<string, WebSocket>;
}

export interface Relay {
  accept(ws: WebSocket): void;
  /** Для тестов и отладки. */
  roomCount(): number;
}

const OPEN = 1; // WebSocket.OPEN

function send(ws: WebSocket | null | undefined, msg: unknown): void {
  if (ws && ws.readyState === OPEN) ws.send(JSON.stringify(msg));
}

function parse(data: unknown): Message | null {
  try {
    const msg: unknown = JSON.parse(String(data));
    return typeof msg === 'object' && msg !== null && typeof (msg as { t?: unknown }).t === 'string'
      ? (msg as Message)
      : null;
  } catch {
    return null;
  }
}

function newCode(taken: (code: string) => boolean): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LEN; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    if (!taken(code)) return code;
  }
}

const isCode = (code: unknown): code is string =>
  typeof code === 'string' &&
  code.length === ROOM_CODE_LEN &&
  [...code].every((ch) => ROOM_CODE_ALPHABET.includes(ch));

export function createRelay(): Relay {
  const rooms = new Map<string, Room>();
  let nextId = 1;

  const dropIfEmpty = (room: Room): void => {
    if (!room.host && room.phones.size === 0) rooms.delete(room.code);
  };

  const becomeHost = (ws: WebSocket, requested: string | undefined): void => {
    const wanted = requested?.toUpperCase();
    let room = isCode(wanted) ? rooms.get(wanted) : undefined;
    const reattach = room !== undefined && room.host === null;
    if (!room || !reattach) {
      const code = isCode(wanted) && !rooms.has(wanted) ? wanted : newCode((c) => rooms.has(c));
      room = { code, host: null, phones: new Map() };
      rooms.set(code, room);
    }
    const current = room;
    current.host = ws;
    send(ws, { t: 'room', code: current.code } satisfies RoomMsg);
    // Телефоны, которые ждали экран, заново представляются по своим токенам.
    if (reattach) for (const phone of current.phones.values()) send(phone, { t: 'rejoin' } satisfies ServerToPhone);

    ws.on('message', (data) => {
      const msg = parse(data);
      if (msg?.t !== 'to') return;
      if (msg.to === '*') for (const phone of current.phones.values()) send(phone, msg.msg);
      else send(current.phones.get(msg.to), msg.msg);
    });
    ws.on('close', () => {
      if (current.host === ws) current.host = null;
      dropIfEmpty(current);
    });
  };

  const becomePhone = (ws: WebSocket, first: Message & { t: 'join' }): void => {
    const room = typeof first.room === 'string' ? rooms.get(first.room.toUpperCase()) : undefined;
    if (!room) {
      send(ws, { t: 'err', code: 'no-room' } satisfies ServerToPhone);
      ws.close();
      return;
    }
    const id = `p${nextId++}`;
    room.phones.set(id, ws);
    const forward = (msg: FromMsg['msg']): void => send(room.host, { t: 'from', from: id, msg } satisfies FromMsg);
    forward(first);

    ws.on('message', (data) => {
      const msg = parse(data);
      if (!msg) return;
      if (msg.t === 'join' || PHONE_TO_SCREEN_TYPES.has(msg.t)) forward(msg as FromMsg['msg']);
    });
    ws.on('close', () => {
      room.phones.delete(id);
      send(room.host, { t: 'gone', from: id } satisfies GoneMsg);
      dropIfEmpty(room);
    });
  };

  return {
    accept(ws) {
      ws.once('message', (data) => {
        const msg = parse(data);
        if (msg?.t === 'host') becomeHost(ws, msg.code);
        else if (msg?.t === 'join') becomePhone(ws, msg);
        else ws.close();
      });
    },
    roomCount: () => rooms.size,
  };
}

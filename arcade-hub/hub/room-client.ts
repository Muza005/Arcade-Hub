// Связь экрана с сервером комнат. Комната создаётся при открытии хаба и переживает смену игр (§2).
// При перезагрузке страницы хаб возвращается в ту же комнату: код и слоты лежат в sessionStorage.
import { IDLE_INPUT, type InputState } from '../engine/input';
import {
  DEFAULT_ASPECT,
  LEADER_HANDOFF_S,
  MAX_PLAYERS,
  PLAYER_COLORS,
  RECONNECT_DELAYS_S,
  SERVER_DOWN_AFTER_S,
  TOKEN_BYTES,
  WS_PATH,
} from '../shared/config';
import { t } from '../shared/i18n';
import type {
  CmdMsg,
  FromMsg,
  HostToServer,
  ScreenToPhone,
  ServerToHost,
  SlotMsg,
} from '../shared/protocol';
import type { Room, RoomPlayer } from './room';
import { RoomState, type SavedRoom, type Slot } from './room-state';

const SAVE_KEY = 'arcade-hub:room';
const MS_PER_S = 1000;

export interface RoomClient {
  readonly room: Room;
  onChange(cb: (room: Room) => void): void;
  /** Новый игрок вошёл (не возврат после обрыва) — для анимации и звука. */
  onJoin(cb: (player: RoomPlayer) => void): void;
  /** Роль ведущего перешла сама (ведущий не вернулся за LEADER_HANDOFF_S). */
  onLeaderChange(cb: (player: RoomPlayer) => void): void;
  /** Есть ли связь с сервером комнат (§15 «Сервер недоступен»). */
  readonly online: boolean;
  onStatus(cb: (online: boolean) => void): void;
  /** «Повторить»: переподключиться сейчас, не дожидаясь паузы. */
  retry(): void;
  /** Ввод с телефона пришёл (id игрока = id слота строкой). */
  onInput(cb: (playerId: string, input: InputState) => void): void;
  /** Команда с телефона (pause, back, …); `leader` — прислал ли её ведущий. */
  onCmd(cb: (playerId: string, msg: CmdMsg, leader: boolean) => void): void;
  /** Последний ввод игрока с телефона. */
  inputOf(playerId: string): InputState;
  leaderId(): string | null;
  send(playerId: string, msg: ScreenToPhone): void;
  /** Убрать всех игроков: телефоны получают «вас убрали», места освобождаются. */
  removeAll(): void;
  /** Новая комната с новым кодом; старые телефоны получают «вас убрали». */
  changeCode(): void;
  /** Каждому подключённому телефону — своё сообщение. */
  sendEach(make: (playerId: string) => ScreenToPhone): void;
}

function makeToken(): string {
  return [...crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function load(): SavedRoom | null {
  try {
    const raw = sessionStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as SavedRoom) : null;
  } catch {
    return null;
  }
}

function clearSaved(): void {
  try {
    sessionStorage.removeItem(SAVE_KEY);
  } catch {
    // нечего чистить
  }
}

function save(state: RoomState): void {
  try {
    const data = state.save();
    if (data) sessionStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // без хранилища комната просто не переживёт перезагрузку
  }
}

export function connectRoom(): RoomClient {
  const state = new RoomState({
    palette: PLAYER_COLORS,
    maxPlayers: MAX_PLAYERS,
    makeToken,
    defaultNick: (n) => t('player.default', { n }),
  });
  const saved = load();
  if (saved) state.restore(saved);

  const inputs = new Map<string, InputState>();
  const changeListeners: Array<(room: Room) => void> = [];
  const joinListeners: Array<(player: RoomPlayer) => void> = [];
  const inputListeners: Array<(playerId: string, input: InputState) => void> = [];
  const cmdListeners: Array<(playerId: string, msg: CmdMsg, leader: boolean) => void> = [];
  const leaderListeners: Array<(player: RoomPlayer) => void> = [];
  const statusListeners: Array<(online: boolean) => void> = [];
  let ws: WebSocket | null = null;
  let attempt = 0;
  let online = false;
  let downTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let handoffTimer: ReturnType<typeof setTimeout> | null = null;

  const setOnline = (value: boolean): void => {
    if (online === value) return;
    online = value;
    for (const cb of statusListeners) cb(value);
  };

  /** Ведущий отключился — ждём LEADER_HANDOFF_S, потом роль переходит дальше. */
  const scheduleHandoff = (): void => {
    if (handoffTimer) clearTimeout(handoffTimer);
    handoffTimer = setTimeout(() => {
      handoffTimer = null;
      const next = state.autoHandoff();
      if (!next) return;
      syncPhones();
      changed();
      const player = state.players().find((p) => p.id === String(next.id));
      if (player) for (const cb of leaderListeners) cb(player);
    }, LEADER_HANDOFF_S * MS_PER_S);
  };

  const snapshot = (): Room => ({ code: state.code, players: state.players() });
  const changed = (): void => {
    save(state);
    const room = snapshot();
    for (const cb of changeListeners) cb(room);
  };

  const send = (msg: HostToServer): void => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };
  const toPhone = (cid: string, msg: ScreenToPhone): void => send({ t: 'to', to: cid, msg });
  const slotById = (playerId: string): Slot | undefined =>
    state.connected().find((s) => String(s.id) === playerId);

  const slotMsg = (slot: Slot): SlotMsg => ({
    t: 'slot',
    id: slot.id,
    nick: slot.nick,
    color: slot.color,
    role: state.isLeader(slot) ? 'leader' : 'guest',
    token: slot.token,
    aspect: DEFAULT_ASPECT,
    taken: state.takenBy(slot),
    roster: state.players().map((p) => ({ id: Number(p.id), nick: p.nick, color: p.color, online: p.connected })),
  });
  /** Цвета, роли и список игроков меняются у всех — каждому телефону свой слот заново. */
  const syncPhones = (): void => {
    for (const slot of state.connected()) if (slot.cid) toPhone(slot.cid, slotMsg(slot));
  };

  const onPhone = ({ from, msg }: FromMsg): void => {
    switch (msg.t) {
      case 'join': {
        const result = state.join(from, typeof msg.token === 'string' ? msg.token : undefined, msg.unsupported === true);
        if ('error' in result) {
          toPhone(from, { t: 'err', code: result.error });
          return;
        }
        syncPhones();
        changed();
        if (!result.returning) {
          const player = state.players().find((p) => p.id === String(result.slot.id));
          if (player) for (const cb of joinListeners) cb(player);
        }
        return;
      }
      case 'profile':
        if (typeof msg.nick !== 'string' || typeof msg.color !== 'string') return;
        if (state.profile(from, msg.nick, msg.color)) {
          syncPhones();
          changed();
        }
        return;
      case 'in': {
        const slot = state.bySid(from);
        if (!slot) return;
        const input = { x: Number(msg.x) || 0, y: Number(msg.y) || 0, btn: msg.btn === true };
        const id = String(slot.id);
        inputs.set(id, input);
        for (const cb of inputListeners) cb(id, input);
        return;
      }
      case 'cmd': {
        const slot = state.bySid(from);
        if (!slot) return;
        if (msg.cmd === 'handoff') {
          if (typeof msg.target === 'number' && state.handoff(from, msg.target)) {
            syncPhones();
            changed();
          }
          return;
        }
        for (const cb of cmdListeners) cb(String(slot.id), msg, state.isLeader(slot));
        return;
      }
      default:
        // lobby, g — следующие этапы.
        return;
    }
  };

  const connect = (): void => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}${WS_PATH}`);
    ws.addEventListener('open', () => {
      attempt = 0;
      if (downTimer) clearTimeout(downTimer);
      downTimer = null;
      setOnline(true);
      send(state.code ? { t: 'host', code: state.code } : { t: 'host' });
    });
    ws.addEventListener('message', (e) => {
      let msg: ServerToHost;
      try {
        msg = JSON.parse(String(e.data)) as ServerToHost;
      } catch {
        return;
      }
      if (msg.t === 'room') {
        // Сервер мог выдать другой код (прошлая комната занята) — тогда это новая комната.
        if (state.code !== msg.code) state.restore({ code: msg.code, nextId: 1, slots: [] });
        changed();
      } else if (msg.t === 'from') {
        onPhone(msg);
      } else if (msg.t === 'gone') {
        const slot = state.leave(msg.from);
        if (slot) {
          inputs.delete(String(slot.id));
          if (state.isLeader(slot)) scheduleHandoff();
          syncPhones();
          changed();
        }
      }
    });
    ws.addEventListener('close', () => {
      // Пока сервера нет, телефоны считаются отключёнными; при возвращении они придут с токенами.
      for (const slot of state.connected()) if (slot.cid) state.leave(slot.cid);
      inputs.clear();
      changed();
      // Короткий обрыв (перезапуск сервера) не пугаем: «недоступен» — только после SERVER_DOWN_AFTER_S.
      downTimer ??= setTimeout(() => setOnline(false), SERVER_DOWN_AFTER_S * MS_PER_S);
      const delay = RECONNECT_DELAYS_S[Math.min(attempt, RECONNECT_DELAYS_S.length - 1)] ?? 1;
      attempt++;
      reconnectTimer = setTimeout(connect, delay * MS_PER_S);
    });
  };
  connect();
  // Сервер не ответил при открытии хаба — тоже «недоступен».
  downTimer = setTimeout(() => {
    if (ws?.readyState !== WebSocket.OPEN) setOnline(false);
  }, SERVER_DOWN_AFTER_S * MS_PER_S);

  return {
    get room() {
      return snapshot();
    },
    onChange: (cb) => void changeListeners.push(cb),
    onJoin: (cb) => void joinListeners.push(cb),
    onInput: (cb) => void inputListeners.push(cb),
    onLeaderChange: (cb) => void leaderListeners.push(cb),
    get online() {
      return online;
    },
    onStatus: (cb) => void statusListeners.push(cb),
    retry() {
      if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      attempt = 0;
      connect();
    },
    onCmd: (cb) => void cmdListeners.push(cb),
    inputOf: (id) => inputs.get(id) ?? { ...IDLE_INPUT },
    leaderId: () => {
      const leader = state.leader();
      return leader ? String(leader.id) : null;
    },
    send: (playerId, msg) => {
      const cid = slotById(playerId)?.cid;
      if (cid) toPhone(cid, msg);
    },
    sendEach: (make) => {
      for (const slot of state.connected()) if (slot.cid) toPhone(slot.cid, make(String(slot.id)));
    },
    removeAll() {
      send({ t: 'to', to: '*', msg: { t: 'err', code: 'removed' } });
      inputs.clear();
      state.restore({ code: state.code ?? '', nextId: 1, slots: [] });
      changed();
    },
    changeCode() {
      send({ t: 'to', to: '*', msg: { t: 'err', code: 'removed' } });
      inputs.clear();
      state.restore({ code: '', nextId: 1, slots: [] });
      state.code = null;
      clearSaved();
      // Переподключение без кода — сервер выдаст новую комнату.
      ws?.close();
    },
  };
}

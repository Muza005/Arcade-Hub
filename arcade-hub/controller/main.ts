// Страница телефона (ARCADE_HUB_SPEC §10). Этап А4: вход в комнату по коду, слот, токен, профиль.
// Геймпад (джойстик, кнопки, гироскоп) — этап А5. Только DOM, без canvas и постоянного rAF.
import '@fontsource/golos-text/500.css';
import '@fontsource/golos-text/600.css';
import '@fontsource/unbounded/700.css';
import './styles.css';
import { PLAYER_COLORS, RECONNECT_DELAYS_S, ROOM_CODE_ALPHABET, ROOM_CODE_LEN, NICK_MAX_LEN, WS_PATH } from '../shared/config';
import { getLang, t } from '../shared/i18n';
import type { JoinMsg, PhoneToScreen, ScreenToPhone, ServerToPhone, SlotMsg } from '../shared/protocol';
import { loadProfile, saveProfile, saveSession, tokenFor } from './storage';

const MS_PER_S = 1000;

document.documentElement.lang = getLang();

const app = document.getElementById('app');
if (!app) throw new Error('#app not found');

type Screen = 'code' | 'connecting' | 'profile' | 'error';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ─── Экраны ──────────────────────────────────────────────────────

const codeForm = el('form', 'screen code');
const codeInput = el('input', 'code__input');
codeInput.maxLength = ROOM_CODE_LEN;
codeInput.autocomplete = 'off';
codeInput.autocapitalize = 'characters';
codeInput.spellcheck = false;
codeInput.setAttribute('aria-label', t('ctrl.codeTitle'));
const codeError = el('p', 'code__error');
codeForm.append(el('h1', 'title', t('ctrl.codeTitle')), codeInput, codeError, el('button', 'btn', t('ctrl.enter')));

const connectingScreen = el('div', 'screen connecting');
connectingScreen.append(el('p', 'muted', t('ctrl.connecting')));

const errorScreen = el('div', 'screen error');
const errorText = el('p', 'title');
errorScreen.append(errorText);

const profileScreen = el('div', 'screen profile');
const avatar = el('div', 'avatar');
const avatarLetter = el('span', 'avatar__letter');
const crown = el('span', 'avatar__crown');
crown.title = t('ctrl.leader');
avatar.append(avatarLetter, crown);
const nickInput = el('input', 'nick');
nickInput.maxLength = NICK_MAX_LEN;
nickInput.autocomplete = 'off';
nickInput.enterKeyHint = 'done';
nickInput.setAttribute('aria-label', t('ctrl.nick'));
const colorGrid = el('div', 'colors');
colorGrid.setAttribute('role', 'radiogroup');
colorGrid.setAttribute('aria-label', t('ctrl.color'));
const colorButtons = PLAYER_COLORS.map((color) => {
  const b = el('button', 'color');
  b.type = 'button';
  b.style.setProperty('--c', color);
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-label', color);
  colorGrid.append(b);
  return b;
});
const roomLabel = el('p', 'muted');
profileScreen.append(avatar, nickInput, colorGrid, roomLabel);

const banner = el('div', 'banner', t('ctrl.reconnecting'));
banner.hidden = true;

const screens: Record<Screen, HTMLElement> = {
  code: codeForm,
  connecting: connectingScreen,
  profile: profileScreen,
  error: errorScreen,
};
app.append(...Object.values(screens), banner);

function show(screen: Screen): void {
  for (const [name, node] of Object.entries(screens)) node.hidden = name !== screen;
}

// ─── Связь ───────────────────────────────────────────────────────

let room = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
let ws: WebSocket | null = null;
let slot: SlotMsg | null = null;
let attempt = 0;
/** Первый слот после входа без токена: тогда отдаём экрану сохранённый профиль. */
let freshJoin = false;
let stopped = false;

function send(msg: JoinMsg | PhoneToScreen): void {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function join(): void {
  const token = tokenFor(room);
  freshJoin = !token;
  send(token ? { t: 'join', room, token } : { t: 'join', room });
}

function renderProfile(s: SlotMsg): void {
  profileScreen.style.setProperty('--player', s.color);
  avatarLetter.textContent = s.nick.slice(0, 1).toUpperCase();
  crown.hidden = s.role !== 'leader';
  if (document.activeElement !== nickInput) nickInput.value = s.nick;
  const taken = new Set(s.taken);
  colorButtons.forEach((b, i) => {
    const color = PLAYER_COLORS[i] as string;
    b.disabled = taken.has(color);
    b.setAttribute('aria-checked', String(color === s.color));
  });
  roomLabel.textContent = t('ctrl.room', { code: room });
}

function sendProfile(nick: string, color: string): void {
  send({ t: 'profile', nick, color });
}

function onMessage(msg: ScreenToPhone | ServerToPhone): void {
  switch (msg.t) {
    case 'slot': {
      slot = msg;
      saveSession({ room, token: msg.token });
      const stored = loadProfile();
      if (freshJoin && stored && (stored.nick !== msg.nick || stored.color !== msg.color)) {
        freshJoin = false;
        sendProfile(stored.nick, stored.color);
      } else {
        freshJoin = false;
        saveProfile({ nick: msg.nick, color: msg.color });
      }
      renderProfile(msg);
      show('profile');
      return;
    }
    case 'err':
      stopped = true;
      if (msg.code === 'no-room') {
        codeError.textContent = t('ctrl.noRoom');
        show('code');
      } else {
        errorText.textContent = t('ctrl.full');
        show('error');
      }
      return;
    case 'rejoin':
      join();
      return;
    default:
      // st, fx, g — этап А5.
      return;
  }
}

function connect(): void {
  stopped = false;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}${WS_PATH}`);
  ws.addEventListener('open', () => {
    attempt = 0;
    banner.hidden = true;
    join();
  });
  ws.addEventListener('message', (e) => {
    try {
      onMessage(JSON.parse(String(e.data)) as ScreenToPhone | ServerToPhone);
    } catch {
      // битое сообщение пропускаем
    }
  });
  ws.addEventListener('close', () => {
    if (stopped) return;
    banner.hidden = slot === null;
    const delay = RECONNECT_DELAYS_S[Math.min(attempt, RECONNECT_DELAYS_S.length - 1)] ?? 1;
    attempt++;
    setTimeout(connect, delay * MS_PER_S);
  });
}

function start(code: string): void {
  room = code;
  history.replaceState(null, '', `?room=${code}`);
  show('connecting');
  connect();
}

// ─── Действия ────────────────────────────────────────────────────

codeInput.addEventListener('input', () => {
  codeInput.value = [...codeInput.value.toUpperCase()].filter((ch) => ROOM_CODE_ALPHABET.includes(ch)).join('');
  codeError.textContent = '';
});
codeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (codeInput.value.length === ROOM_CODE_LEN) start(codeInput.value);
});

nickInput.addEventListener('change', () => {
  if (slot) sendProfile(nickInput.value, slot.color);
});
nickInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') nickInput.blur();
});
colorButtons.forEach((b, i) =>
  b.addEventListener('click', () => {
    if (slot) sendProfile(nickInput.value || slot.nick, PLAYER_COLORS[i] as string);
  }),
);

if (room.length === ROOM_CODE_LEN) start(room);
else show('code');

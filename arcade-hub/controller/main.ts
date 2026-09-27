// Страница телефона (ARCADE_HUB_SPEC §8, §10): вход в комнату → «Готов играть» → контроллер.
// Один контроллер на всё: в меню хаба джойстик ведущего ведёт выбор, в матче — управление игрой.
// Только DOM, без canvas/WebGL и постоянного rAF; ввод — не чаще 30 Гц и только при изменении.
import '@fontsource/golos-text/500.css';
import '@fontsource/golos-text/600.css';
import '@fontsource/unbounded/700.css';
import './styles.css';
import {
  RECONNECT_DELAYS_S,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LEN,
  TILT_FULL_DEG,
  VIBRATE_TAP_MS,
  WS_PATH,
} from '../shared/config';
import { getLang, t } from '../shared/i18n';
import type {
  ControlMode,
  ControllerLayout,
  JoinMsg,
  PhoneToScreen,
  ScreenToPhone,
  ServerToPhone,
  SlotMsg,
  StMsg,
} from '../shared/protocol';
import { createGyro, requestGyroPermission } from './gyro';
import { createPad } from './pad';
import { loadPrefs, savePrefs, type Prefs } from './prefs';
import { createInputSender } from './sender';
import { createSettings } from './settings';
import { loadProfile, saveProfile, saveSession, tokenFor } from './storage';
import { button, el } from './ui';

const MS_PER_S = 1000;
const MENU_LAYOUT: ControllerLayout = { screen: 'menu', modes: ['joystick'], mainButton: true };
const ALL_MODES: ControlMode[] = ['arrows', 'gyro', 'joystick'];

document.documentElement.lang = getLang();
const app = document.getElementById('app');
if (!app) throw new Error('#app not found');

// ─── Состояние ───────────────────────────────────────────────────

let room = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
let ws: WebSocket | null = null;
let slot: SlotMsg | null = null;
let st: StMsg = { t: 'st', alive: true, paused: false, layout: MENU_LAYOUT };
let prefs: Prefs = loadPrefs();
let ready = false;
let attempt = 0;
/** Первый слот после входа без токена: тогда отдаём экрану сохранённый профиль. */
let freshJoin = false;
let stopped = false;
const input = { x: 0, y: 0, btn: false };

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

const connectingScreen = el('div', 'screen');
connectingScreen.append(el('p', 'muted', t('ctrl.connecting')));

const errorScreen = el('div', 'screen');
const errorText = el('p', 'title');
errorScreen.append(errorText);

const readyScreen = el('div', 'screen ready');
const readyBtn = button('ready__btn', t('ctrl.ready'));
readyScreen.append(readyBtn);

const sender = createInputSender((state) => send({ t: 'in', ...state }));

const pad = createPad({
  axes(x, y) {
    input.x = x;
    input.y = y;
    pushInput();
  },
  button(pressed) {
    input.btn = pressed;
    if (pressed) vibrate(VIBRATE_TAP_MS);
    pushInput();
  },
  pause() {
    send({ t: 'cmd', cmd: st.layout.screen === 'menu' ? 'back' : 'pause' });
  },
  settings() {
    pad.release();
    settings.show(settingsContext());
    render();
  },
  recalibrate: () => gyro.calibrate(),
});

const settings = createSettings({
  prefs(next) {
    prefs = next;
    savePrefs(prefs);
    applyPrefs();
  },
  profile: (nick, color) => send({ t: 'profile', nick, color }),
  recalibrate: () => gyro.calibrate(),
  handoff: (target) => send({ t: 'cmd', cmd: 'handoff', target }),
  close() {
    settings.hide();
    render();
  },
});

// Окно паузы у ведущего
const pauseModal = el('div', 'pause-modal');
const pauseStatus = el('p', 'muted');
const resumeBtn = button('btn btn--player', t('ctrl.pause.resume'));
const endBtn = button('btn btn--danger', t('ctrl.pause.end'));
pauseModal.append(
  el('span', 'pause-modal__icon'),
  el('h1', 'title', t('ctrl.pause')),
  el('p', '', t('ctrl.pause.stopped')),
  pauseStatus,
  resumeBtn,
  endBtn,
  el('p', 'muted', t('ctrl.pause.endNote')),
);
resumeBtn.addEventListener('click', () => send({ t: 'cmd', cmd: 'resume' }));
endBtn.addEventListener('click', () => send({ t: 'cmd', cmd: 'end' }));

const flash = el('div', 'flash');
const banner = el('div', 'banner', t('ctrl.reconnecting'));
banner.hidden = true;

type Screen = 'code' | 'connecting' | 'ready' | 'pad' | 'error';
const screens: Record<Screen, HTMLElement> = {
  code: codeForm,
  connecting: connectingScreen,
  ready: readyScreen,
  pad: pad.el,
  error: errorScreen,
};
app.append(...Object.values(screens), pauseModal, settings.el, flash, banner);
let screen: Screen = 'connecting';

function show(next: Screen): void {
  screen = next;
  render();
}

// ─── Управление ──────────────────────────────────────────────────

const gyro = createGyro(
  (x, y) => {
    pad.setTilt(x, y);
    if (activeMode() !== 'gyro') return;
    input.x = x;
    input.y = y;
    pushInput();
  },
  () => render(),
);

function isLeader(): boolean {
  return slot?.role === 'leader';
}

/** В меню — всегда джойстик; в игре — выбранный вид, если игра его поддерживает. */
function activeMode(): ControlMode {
  const { layout } = st;
  if (layout.screen === 'menu') return 'joystick';
  const usable = layout.modes.filter((m) => m !== 'gyro' || gyro.available);
  return usable.includes(prefs.mode) ? prefs.mode : (usable[0] ?? 'joystick');
}

/** Можно ли сейчас управлять: гость в меню и все на паузе — нельзя. */
function controlsLive(): boolean {
  if (screen !== 'pad' || settings.open || st.paused) return false;
  return st.layout.screen === 'game' || isLeader();
}

function pushInput(): void {
  if (controlsLive()) sender.update({ ...input });
  else sender.release();
}

function vibrate(ms: number): void {
  if (prefs.vibration && 'vibrate' in navigator) navigator.vibrate(ms);
}

function applyPrefs(): void {
  app?.setAttribute('data-hand', prefs.hand);
  gyro.configure({ fullDeg: TILT_FULL_DEG[prefs.sensitivity.gyro], invertX: prefs.invertX, invertY: prefs.invertY });
  render();
}

function settingsContext() {
  if (!slot) throw new Error('no slot');
  return {
    slot,
    modes: st.layout.screen === 'menu' ? ALL_MODES : st.layout.modes,
    gyroAvailable: gyro.available,
    prefs,
    ...(st.layout.warning ? { warning: st.layout.warning } : {}),
  };
}

function render(): void {
  for (const [name, node] of Object.entries(screens)) node.hidden = name !== screen;
  const leader = isLeader();
  const inMenu = st.layout.screen === 'menu';
  const mode = activeMode();
  pad.setView({
    mode,
    sensitivity: prefs.sensitivity[mode],
    mainButton: st.layout.mainButton,
    leader,
    muted: inMenu && !leader,
    paused: st.paused,
  });
  pad.setMainButton(inMenu ? undefined : st.mainButton);
  // Пауза: у ведущего — окно, у остальных — карточка сверху и серые кнопки.
  pauseModal.hidden = !(screen === 'pad' && st.paused && leader && !settings.open);
  pauseStatus.textContent = st.status ?? '';
  pad.notice.hidden = !(st.paused && !leader);
  pad.notice.textContent = st.pausedBy ? t('ctrl.pause.guest', { nick: st.pausedBy }) : '';
  if (settings.open && slot) settings.update(settingsContext());
  if (!controlsLive()) sender.release();
}

// ─── Связь ───────────────────────────────────────────────────────

function send(msg: JoinMsg | PhoneToScreen): void {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function join(): void {
  const token = tokenFor(room);
  freshJoin = !token;
  send(token ? { t: 'join', room, token } : { t: 'join', room });
}

function playFlash(color: string): void {
  flash.style.setProperty('--flash', color);
  flash.classList.remove('is-on');
  void flash.offsetWidth;
  flash.classList.add('is-on');
}

function onMessage(msg: ScreenToPhone | ServerToPhone): void {
  switch (msg.t) {
    case 'slot': {
      slot = msg;
      saveSession({ room, token: msg.token });
      const stored = loadProfile();
      if (freshJoin && stored && (stored.nick !== msg.nick || stored.color !== msg.color)) {
        send({ t: 'profile', nick: stored.nick, color: stored.color });
      } else {
        saveProfile({ nick: msg.nick, color: msg.color });
      }
      freshJoin = false;
      pad.setProfile(msg.nick, msg.color);
      app?.style.setProperty('--player', msg.color);
      if (screen === 'connecting') show(ready ? 'pad' : 'ready');
      else render();
      return;
    }
    case 'st':
      st = msg;
      render();
      return;
    case 'fx':
      if (typeof msg.vib === 'number') vibrate(msg.vib);
      if (typeof msg.flash === 'string') playFlash(msg.flash);
      return;
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

// ─── «Готов играть»: разрешение гироскопа (iOS), Wake Lock, первая калибровка ───

let wakeLock: { release(): Promise<void> } | null = null;
async function keepAwake(): Promise<void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
    wakeLock = (await nav.wakeLock?.request('screen')) ?? null;
  } catch {
    wakeLock = null;
  }
}

readyBtn.addEventListener('click', () => {
  ready = true;
  void requestGyroPermission().then((granted) => {
    if (granted) {
      gyro.start();
      gyro.calibrate();
    }
    render();
  });
  void keepAwake();
  show('pad');
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ready && !wakeLock) void keepAwake();
  if (document.visibilityState === 'hidden') {
    wakeLock = null;
    pad.release();
  }
});

// ─── Ввод кода ───────────────────────────────────────────────────

codeInput.addEventListener('input', () => {
  codeInput.value = [...codeInput.value.toUpperCase()].filter((ch) => ROOM_CODE_ALPHABET.includes(ch)).join('');
  codeError.textContent = '';
});
codeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (codeInput.value.length === ROOM_CODE_LEN) start(codeInput.value);
});

applyPrefs();
if (room.length === ROOM_CODE_LEN) start(room);
else show('code');

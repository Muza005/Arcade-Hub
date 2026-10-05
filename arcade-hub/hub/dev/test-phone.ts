// Только dev: тестовый «телефон» — настоящее соединение с сервером комнат, ввод по протоколу.
// Позволяет проверять 10 игроков без людей (ARCADE_HUB_SPEC §2).
import { clampUnit } from '../../engine/input';
import { createRng, randomSeed } from '../../engine/rng';
import {
  DEV_TEST_PHONE_BTN_CHANCE,
  DEV_TEST_PHONE_TURN_RAD,
  INPUT_SEND_HZ,
  WS_PATH,
} from '../../shared/config';
import type { JoinMsg, PhoneToScreen, ScreenToPhone } from '../../shared/protocol';

const MS_PER_S = 1000;

export interface TestPhone {
  close(): void;
}

export function connectTestPhone(room: string, nick: string): TestPhone {
  const rng = createRng(randomSeed());
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}${WS_PATH}`);
  let token: string | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let angle = rng.range(0, Math.PI * 2);
  /** Ввод только в матче: в меню случайный джойстик водил бы фокус, если тестовый телефон — ведущий. */
  let inGame = false;

  const send = (msg: JoinMsg | PhoneToScreen): void => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };

  ws.addEventListener('open', () => send({ t: 'join', room }));
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(String(e.data)) as ScreenToPhone | { t: 'rejoin' };
    if (msg.t === 'rejoin') send(token ? { t: 'join', room, token } : { t: 'join', room });
    if (msg.t === 'st') inGame = msg.layout.screen === 'game';
    if (msg.t !== 'slot') return;
    if (!token) {
      token = msg.token;
      send({ t: 'profile', nick, color: msg.color });
    }
    // Блуждающий джойстик, как у человека, который водит пальцем.
    timer ??= setInterval(() => {
      if (!inGame) return;
      angle += rng.range(-DEV_TEST_PHONE_TURN_RAD, DEV_TEST_PHONE_TURN_RAD);
      const { x, y } = clampUnit(Math.cos(angle), Math.sin(angle));
      send({ t: 'in', x, y, btn: rng.next() < DEV_TEST_PHONE_BTN_CHANCE });
    }, MS_PER_S / INPUT_SEND_HZ);
  });
  ws.addEventListener('close', () => clearInterval(timer));

  return { close: () => ws.close() };
}

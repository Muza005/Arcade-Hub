// Реле комнат внутри dev-сервера Vite: один процесс, один порт — и одна ссылка через туннель для телефона.
// Для деплоя (этап А8) то же реле подключается к обычному HTTP-серверу.
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Plugin } from 'vite';
import { WebSocketServer } from 'ws';
import { HEARTBEAT_S, WS_MAX_PAYLOAD_BYTES, WS_PATH } from '../shared/config';
import { createRelay } from './relay';

const MS_PER_S = 1000;

type HttpServerLike = { on(event: 'upgrade', cb: (req: IncomingMessage, socket: Duplex, head: Buffer) => void): unknown };

export function attachRelay(httpServer: HttpServerLike | null): void {
  if (!httpServer) return;
  const wss = new WebSocketServer({ noServer: true, maxPayload: WS_MAX_PAYLOAD_BYTES });
  const relay = createRelay();
  // Закрытая вкладка телефона часто не шлёт «до свидания»: ping раз в HEARTBEAT_S, кто не ответил — отключён.
  const alive = new WeakMap<object, boolean>();
  wss.on('connection', (ws) => {
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    relay.accept(ws);
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.get(ws)) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, HEARTBEAT_S * MS_PER_S);
  wss.on('close', () => clearInterval(heartbeat));
  httpServer.on('upgrade', (req, socket, head) => {
    // Остальные upgrade (HMR Vite) не трогаем.
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== WS_PATH) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
}

export function relayPlugin(): Plugin {
  return {
    name: 'arcade-hub-relay',
    configureServer: (server) => attachRelay(server.httpServer),
    configurePreviewServer: (server) => attachRelay(server.httpServer),
  };
}

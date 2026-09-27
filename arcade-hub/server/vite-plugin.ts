// Реле комнат внутри dev-сервера Vite: один процесс, один порт — и одна ссылка через туннель для телефона.
// Для деплоя (этап А8) то же реле подключается к обычному HTTP-серверу.
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Plugin } from 'vite';
import { WebSocketServer } from 'ws';
import { WS_MAX_PAYLOAD_BYTES, WS_PATH } from '../shared/config';
import { createRelay } from './relay';

type HttpServerLike = { on(event: 'upgrade', cb: (req: IncomingMessage, socket: Duplex, head: Buffer) => void): unknown };

export function attachRelay(httpServer: HttpServerLike | null): void {
  if (!httpServer) return;
  const wss = new WebSocketServer({ noServer: true, maxPayload: WS_MAX_PAYLOAD_BYTES });
  const relay = createRelay();
  wss.on('connection', (ws) => relay.accept(ws));
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

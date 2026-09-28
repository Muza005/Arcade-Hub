// Production-сервер: один процесс отдаёт сайт и держит реле комнат на /ws.
// Запуск: npm run build && npm start. Порт — из переменной PORT (так его задают Railway и Render).
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { attachRelay } from './vite-plugin';
import { createStatic } from './static';
import { APP_VERSION } from '../shared/version';

const DEFAULT_PORT = 8080;
const HTTP_OK = 200;

const port = Number(process.env.PORT) || DEFAULT_PORT;
// Собранный сервер лежит в dist-server/, сайт — в dist/ рядом.
const siteRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const serveStatic = createStatic(siteRoot);

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(HTTP_OK, { 'content-type': 'text/plain', 'cache-control': 'no-store' }).end(`ok ${APP_VERSION}`);
    return;
  }
  serveStatic(req, res).catch(() => res.destroy());
});

attachRelay(server);
server.listen(port, () => console.log(`Arcade Hub: http://localhost:${port}`));

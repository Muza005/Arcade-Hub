// Раздача собранного сайта (dist/) в production: хаб на «/», телефон на «/controller/».
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/** Файлы в assets/ с хешем в имени — кешируются навсегда; html — всегда свежий. */
const IMMUTABLE = 'public, max-age=31536000, immutable';
const NO_CACHE = 'no-cache';
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_BAD_METHOD = 405;

export function createStatic(root: string): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const base = normalize(root + sep);

  const resolve = async (urlPath: string): Promise<string | null> => {
    const decoded = decodeURIComponent(urlPath);
    const path = normalize(join(base, decoded));
    if (!path.startsWith(base)) return null; // выход за пределы dist/
    try {
      const info = await stat(path);
      if (info.isFile()) return path;
      if (info.isDirectory()) {
        const index = join(path, 'index.html');
        if ((await stat(index)).isFile()) return index;
      }
    } catch {
      // нет такого файла
    }
    return null;
  };

  return async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(HTTP_BAD_METHOD).end();
      return;
    }
    const url = new URL(req.url ?? '/', 'http://localhost');
    const file = await resolve(url.pathname);
    if (!file) {
      res.writeHead(HTTP_NOT_FOUND, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    res.writeHead(HTTP_OK, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': url.pathname.startsWith('/assets/') ? IMMUTABLE : NO_CACHE,
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  };
}

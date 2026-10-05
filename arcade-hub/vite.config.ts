import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { relayPlugin } from './server/vite-plugin';

// Хаб открывается с корня (index.html → hub/main.ts), телефон — /controller/.
// Реле комнат работает внутри того же сервера на /ws.
const VERSION_LEN = 7;

/** Версия сборки — короткий коммит: Render даёт RENDER_GIT_COMMIT, локально — git. */
function buildVersion(): string {
  const fromHost = process.env.RENDER_GIT_COMMIT;
  if (fromHost) return fromHost.slice(0, VERSION_LEN);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  plugins: [relayPlugin()],
  define: { __APP_VERSION__: JSON.stringify(buildVersion()) },
  server: {
    // Телефон ходит через HTTPS-туннель cloudflared (гироскоп работает только по HTTPS).
    allowedHosts: ['.trycloudflare.com'],
  },
  preview: {
    allowedHosts: ['.trycloudflare.com'],
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        hub: fileURLToPath(new URL('./index.html', import.meta.url)),
        controller: fileURLToPath(new URL('./controller/index.html', import.meta.url)),
      },
    },
  },
});

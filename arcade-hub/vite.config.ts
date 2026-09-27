import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { relayPlugin } from './server/vite-plugin';

// Хаб открывается с корня (index.html → hub/main.ts), телефон — /controller/.
// Реле комнат работает внутри того же сервера на /ws.
export default defineConfig({
  plugins: [relayPlugin()],
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

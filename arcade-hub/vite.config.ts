import { defineConfig } from 'vite';

// Хаб открывается с корня: index.html → hub/main.ts.
export default defineConfig({
  build: {
    target: 'es2022',
  },
});

import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    // Mirrors the `@/*` -> `./src/*` mapping in tsconfig.app.json. Without it
    // TypeScript resolves the alias but Vite's dependency scanner does not,
    // so `npm run dev` fails to start.
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },

  server: {
    port: 5199,
    // Fail loudly instead of silently moving to another port, which would
    // break the CORS whitelist the backend is configured with.
    strictPort: true,
  },

  build: {
    // NOTE: this Vite builds with rolldown, whose `manualChunks` is a function
    // only — the object form silently fails the build. Left to rolldown's own
    // chunking, which already splits vendor code sensibly.
    chunkSizeWarningLimit: 1300,
  },
});

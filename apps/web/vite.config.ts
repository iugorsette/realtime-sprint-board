import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const { API_PORT = '3000' } = loadEnv(mode, root, '');
  const target = `http://127.0.0.1:${process.env.API_PORT ?? API_PORT}`;
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target, rewrite: (path) => path.replace(/^\/api/, '') },
        '/socket.io': { target, ws: true },
      },
    },
  };
});

import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';

function offlineShell(): Plugin {
  return {
    name: 'sprint-board-offline-shell',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const files = ['./', ...Object.keys(bundle).filter((file) => file.startsWith('assets/')).sort()];
        const template = readFileSync(new URL('./offline-worker.js', import.meta.url), 'utf8');
        const version = createHash('sha256').update(template).update(JSON.stringify(files)).digest('hex').slice(0, 16);
        this.emitFile({
          type: 'asset', fileName: 'offline-worker.js',
          source: template.replace('__BOARD_CACHE_NAME__', JSON.stringify(`sprint-board-shell:${version}`))
            .replace('__BOARD_BUILD_FILES__', JSON.stringify(files)),
        });
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const { API_PORT = '3000' } = loadEnv(mode, root, '');
  const target = `http://127.0.0.1:${process.env.API_PORT ?? API_PORT}`;
  return {
    plugins: [react(), offlineShell()],
    server: {
      proxy: {
        '/api': { target, rewrite: (path) => path.replace(/^\/api/, '') },
        '/socket.io': { target, ws: true },
      },
    },
  };
});

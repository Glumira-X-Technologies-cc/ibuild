import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// One Builder: server.js on 3001 serves the built page (dist) and the API. Daily use needs no Vite.
// Vite dev (5173) is for editing the page only; it proxies the API to that same Builder. The Builder refuses
// a foreign Host or Origin, so the proxy presents the Builder's own origin.
const BUILDER_URL = (process.env.BUILDER_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const builderProxy = () => Object.fromEntries(['/api', '/health', '/v1'].map(p => [p, {
  target: BUILDER_URL, changeOrigin: true,
  configure: (proxy: any) => proxy.on('proxyReq', (req: any) => { if (req.getHeader('origin')) req.setHeader('origin', BUILDER_URL); }),
}]));

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    preview: { port: Number(process.env.UI_PORT || 4173), host: '127.0.0.1', strictPort: true, proxy: builderProxy() },
    server: {
      port: Number(process.env.UI_PORT || 5173),
      strictPort: true,
      host: '127.0.0.1',
      // API calls go to the one Builder (server.js on 3001).
      proxy: builderProxy(),
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

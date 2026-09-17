import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Watches public/img so renaming or replacing a product image during dev
 * triggers a full browser reload. Vite's HMR only watches files under src/
 * by default, which is why a new or renamed asset in public/ would otherwise
 * leave the browser looking at stale URLs.
 */
function publicAssetReload(): Plugin {
  return {
    name: 'blessp-public-asset-reload',
    configureServer(server) {
      const publicDir = path.resolve(__dirname, 'public');
      server.watcher.add(publicDir);
      server.watcher.on('all', (event, filePath) => {
        if (!filePath.startsWith(publicDir)) return;
        if (!/\.(png|jpe?g|webp|avif|gif|svg)$/i.test(filePath)) return;
        server.ws.send({ type: 'full-reload', path: '*' });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), publicAssetReload()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
    // Disable browser caching of assets in dev so a renamed or replaced
    // public/ image does not sit behind a stale 304.
    headers: {
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
    },
  },
  build: {
    // Split heavy, route-independent libs out of the main chunk so the
    // landing page parses faster. Stripe and framer-motion are the two
    // largest third parties today.
    rollupOptions: {
      output: {
        manualChunks: {
          stripe: ['@stripe/stripe-js', '@stripe/react-stripe-js'],
          motion: ['framer-motion'],
          i18n: ['i18next', 'react-i18next'],
          router: ['react-router-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});

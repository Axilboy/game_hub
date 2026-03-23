import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildRobotsTxt, buildSitemapXml } from '../seo/sitemapConfig.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** robots.txt и sitemap.xml в dist (статический хостинг без Node). Задайте VITE_BASE_URL. */
function seoDistFilesPlugin() {
  let outDir = 'dist';
  let mode = 'production';
  return {
    name: 'seo-dist-files',
    configResolved(config) {
      outDir = config.build.outDir;
      mode = config.mode;
    },
    closeBundle() {
      const env = loadEnv(mode, __dirname, '');
      const baseRaw = env.VITE_BASE_URL || process.env.VITE_BASE_URL || '';
      if (!baseRaw && mode === 'production') {
        throw new Error('VITE_BASE_URL is required for production build to generate correct sitemap.xml/robots.txt');
      }
      const base = (baseRaw || 'http://localhost:5173').replace(/\/$/, '');
      const lastmod = new Date().toISOString().slice(0, 10);
      const dir = path.resolve(__dirname, outDir);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'robots.txt'), buildRobotsTxt(base), 'utf8');
      fs.writeFileSync(path.join(dir, 'sitemap.xml'), buildSitemapXml(base, lastmod), 'utf8');
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    seoDistFilesPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['og-share.svg'],
      manifestFilename: 'manifest.webmanifest',
      manifest: {
        name: 'GameHub',
        short_name: 'GameHub',
        description: 'Игры для компании: Шпион, Элиас, Мафия и др.',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'ru',
        icons: [
          {
            src: '/og-share.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Только precache сборки; API/socket не трогаем
        runtimeCaching: [],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
});

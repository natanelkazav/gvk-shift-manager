import { readFileSync } from 'node:fs';

import {
  defineConfig,
} from 'vite';

import react
  from '@vitejs/plugin-react';

import {
  VitePWA,
} from 'vite-plugin-pwa';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version?: string };

const appVersion = packageJson.version?.trim() || 'dev';
const appBuildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
  process.env.GITHUB_SHA?.slice(0, 8) ||
  process.env.VITE_APP_BUILD_ID?.trim() ||
  appVersion;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_BUILD_ID__: JSON.stringify(appBuildId),
  },
  plugins: [
    react(),

    VitePWA({
      strategies:
        'injectManifest',

      srcDir:
        'src',

      filename:
        'sw.ts',

      registerType:
        'prompt',
      injectManifest: {
        maximumFileSizeToCacheInBytes:
          5 * 1024 * 1024,
      },
      includeAssets: [
        'favicon.svg',
        'icon-96.png',
        'icon-192.png',
        'icon-512.png',
      ],

      devOptions: {
        enabled:
          true,

        type:
          'module',
      },

      manifest: {
        id:
          '/',

        name:
          'צוות GVK',

        short_name:
          'צוות GVK',

        description:
          'שיבוצים, אילוצים ועדכונים לצוות GVK',

        lang:
          'he',

        dir:
          'rtl',

        start_url:
          '/',

        scope:
          '/',

        display:
          'standalone',

        theme_color:
          '#0f172a',

        background_color:
          '#ffffff',

        icons: [
          {
            src:
              '/icon-192.png',

            sizes:
              '192x192',

            type:
              'image/png',

            purpose:
              'any',
          },

          {
            src:
              '/icon-512.png',

            sizes:
              '512x512',

            type:
              'image/png',

            purpose:
              'any',
          },

          {
            src:
              '/icon-512.png',

            sizes:
              '512x512',

            type:
              'image/png',

            purpose:
              'maskable',
          },
        ],
      },
    }),
  ],
});
import {
  defineConfig,
} from 'vite';

import react
  from '@vitejs/plugin-react';

import {
  VitePWA,
} from 'vite-plugin-pwa';

export default defineConfig({
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
          'GVK Shift Manager',

        short_name:
          'GVK משמרות',

        description:
          'מערכת ניהול ושיבוץ משמרות',

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
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
      registerType:
        'autoUpdate',

      includeAssets: [
        'favicon.svg',
        'icon-192.png',
        'icon-512.png',
      ],

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
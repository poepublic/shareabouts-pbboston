import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { djangoStaticFiles, djangoStatic } from './src/vite-plugin-django-staticfiles.js';

export default defineConfig({
  plugins: [
    vue(),
    djangoStaticFiles(),
  ],
  root: resolve(__dirname, 'src'),
  base: '/static/dist/',
  build: {
    outDir: resolve(__dirname, 'src/static/dist'),
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: {
        'sa_admin-dashboard': djangoStatic('sa_admin/dashboard/main.js'),
        'sa_admin-detail': djangoStatic('sa_admin/detail/main.js'),
        'sa_admin-report': djangoStatic('sa_admin/report/main.js'),
        'sa_vote': djangoStatic('sa_vote/main.js'),
      },
      external: ['leaflet'],
      output: {
        globals: {
          leaflet: 'L',
        },
      },
    },
  },
  server: {
    host: 'localhost',
    port: 5173,
    cors: true,
    open: false,
    watch: {
      usePolling: true,
    },
  },
});

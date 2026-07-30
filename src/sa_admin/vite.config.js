import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  root: resolve(__dirname, 'src'),
  base: '/static/sa_admin/dist/',
  build: {
    outDir: resolve(__dirname, 'static/sa_admin/dist'),
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: {
        dashboard: resolve(__dirname, 'src/dashboard/main.js'),
        detail: resolve(__dirname, 'src/detail/main.js'),
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

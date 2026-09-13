import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
    assetsDir: 'assets'
  },
  server: {
    host: true,
    port: 3000,
    open: false,
    watch: {
      usePolling: true,
      interval: 1000
    }
  }
});

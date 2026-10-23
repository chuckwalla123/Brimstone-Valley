import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const usePollingWatch = process.platform === 'win32';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  base: './', // Use relative paths for Electron compatibility
  server: {
    port: 5174,
    watch: usePollingWatch
      ? {
          usePolling: true,
          interval: 150
        }
      : undefined
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
});

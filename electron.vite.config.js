import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(__dirname, 'electron/main/index.js'),
      },
      outDir: 'out/main',
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'electron/preload/index.js'),
      },
      outDir: 'out/preload',
    },
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    plugins: [react()],
  },
});

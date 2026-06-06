import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        connector: resolve(__dirname, 'index.html'),
        popup: resolve(__dirname, 'popup.html'),
      },
    },
  },
});

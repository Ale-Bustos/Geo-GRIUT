import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Backend en Go (ver backend/README.md); en desarrollo /api se reenvía a él
const proxyApi = { '/api': 'http://localhost:8081' };

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Mismo puerto que usaba create-react-app
    proxy: proxyApi
  },
  preview: {
    proxy: proxyApi
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    css: true
  }
});

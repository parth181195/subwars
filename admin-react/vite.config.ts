import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 4205,
    host: true,
  },
  resolve: {
    alias: {
      // In production builds, replace environment.ts with environment.prod.ts
      ...(mode === 'production' && {
        '@config/environment': path.resolve(__dirname, './src/config/environment.prod.ts'),
      }),
    },
  },
}));

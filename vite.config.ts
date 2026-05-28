import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// Use a production-only base so the dev server serves from '/'
// Replace "your-github-repository-name" with your actual repo name before deploying.
export default defineConfig(() => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    base: isProd ? '/my-anime-watchlist/' : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});

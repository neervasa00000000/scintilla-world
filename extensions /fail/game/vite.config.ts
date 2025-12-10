import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Disable source maps completely to avoid Chrome extension issues
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'popup.html'),
        content: path.resolve(__dirname, 'src/content.ts')
      },
      output: {
        format: 'es', // Use ES modules for Chrome extensions
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Disable module preload for extensions
    modulePreload: false,
    // Ensure proper chunking
    chunkSizeWarningLimit: 1000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  base: './'
});


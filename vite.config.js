import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      // Polyfill Node.js stream module for browser compatibility (used by xml-js)
      stream: 'stream-browserify',
    },
  },
  server: {
    // Pin to port 5173 so the OAuth Authorized JavaScript Origin stays consistent.
    // If this port is changed, update the origin in Google Cloud Console too.
    port: 5173,
    strictPort: true,
    // Handle client-side routing - serve index.html for all routes
    historyApiFallback: true,
  },
  build: {
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
})

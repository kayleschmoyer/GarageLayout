import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use relative paths for Electron compatibility (file:// protocol)
  base: './',
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    // Handle client-side routing - serve index.html for all routes
    historyApiFallback: true,
  },
  build: {
    // Ensure assets use relative paths
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // Keep asset file names consistent
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
})

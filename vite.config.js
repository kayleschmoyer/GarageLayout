import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Handle client-side routing - serve index.html for all routes
    historyApiFallback: true,
  },
})

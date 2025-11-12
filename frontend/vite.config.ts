import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // force Vite to always use 5173
    strictPort: true, // if 5173 is taken, Vite will error instead of changing
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        // ✅ removed the rewrite, so `/api/...` stays `/api/...`
      },
    },
  },
})

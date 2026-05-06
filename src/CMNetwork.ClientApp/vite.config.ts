import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('react-dom') || id.includes('react/jsx-runtime') || id.includes('/react/')) {
            return 'vendor-react'
          }

          if (id.includes('react-router')) {
            return 'vendor-router'
          }

          if (id.includes('recharts')) {
            return 'vendor-recharts'
          }

          if (id.includes('@progress/kendo-react') || id.includes('@progress/kendo-')) {
            return 'vendor-kendo'
          }

          return 'vendor-misc'
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:5128',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

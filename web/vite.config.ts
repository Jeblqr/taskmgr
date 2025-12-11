import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/login': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Also proxy websocket if needed, but we handled that explicitly in components.
      // Actually TaskDetail uses explicit URL. But resource chart uses explicit URL too?
      // Dashboard.tsx uses: new WebSocket("ws://localhost:3000/api/stats"); -> wait, I updated it to be dynamic.
      // But dynamic logic says: import.meta.env.DEV ? "localhost:3000" : window.location.host;
      // If we use proxy, we might want to stick to window.location.host even in dev, and let vite proxy WS?
      // Vite prints: "ws proxy not supported" sometimes? No, it supports it.
    }
  }
})

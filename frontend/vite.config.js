import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

const apiProxy = {
  target: 'http://localhost:8080',
  changeOrigin: true,
  bypass: (req) => ((req.headers.accept ?? '').includes('text/html') ? req.url : undefined),
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': apiProxy,
      '/cleaners': apiProxy,
      '/uploads': apiProxy,
    },
  },
})

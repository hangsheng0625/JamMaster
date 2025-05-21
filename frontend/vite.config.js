import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Allow Cloud Run domain
    host: '0.0.0.0',
    port: 8080,
    allowedHosts: [
      'jammaster-frontend-5wvd4bkaxq-as.a.run.app',
      // You can also use a wildcard to allow all hosts
      // '*.a.run.app'
    ]
  }
})

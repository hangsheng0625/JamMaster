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
      '*.run.app',
      // Include the specific domain we're seeing
      'jammaster-frontend-567737315998.asia-southeast1.run.app'
    
    ]
  }
})

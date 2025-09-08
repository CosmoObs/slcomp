import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// For GitHub Pages deployment: set BASE_PATH environment variable to your repo name
// Example: export BASE_PATH=/slcomp/ before building
const basePath = process.env.BASE_PATH || '/';

export default defineConfig({
  base: basePath,
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react','react-dom'],
          mui: ['@mui/material','@mui/icons-material','@mui/x-data-grid','@emotion/react','@emotion/styled'],
          vendor: ['@tanstack/react-query', 'recoil']
        }
      }
    }
  },
  server: { 
    port: 5173,
    headers: {
      // Add headers to help with CORS during development
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
    }
  }
});

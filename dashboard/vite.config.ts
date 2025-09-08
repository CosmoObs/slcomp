import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// For GitHub Pages deployment: set BASE_PATH environment variable to your repo name
// Example: export BASE_PATH=/slcomp/ before building
const basePath = process.env.BASE_PATH || '/';

export default defineConfig({
  base: basePath,
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1100,
    sourcemap: false, // Disable source maps for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'mui-core': ['@mui/material', '@mui/system', '@emotion/react', '@emotion/styled'],
          'mui-icons': ['@mui/icons-material'],
          'mui-datagrid': ['@mui/x-data-grid'],
          'query-vendor': ['@tanstack/react-query'],
          'utils': ['recoil']
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom', 
      '@mui/material',
      '@mui/icons-material',
      '@mui/x-data-grid',
      '@tanstack/react-query'
    ]
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

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
      // Basic permissive headers (still need target server cooperation for true CORS)
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
    },
    // Dev-only proxy to inject the zrok interstitial bypass header and avoid CORS issues.
    proxy: {
      // Usage in code: fetch('/proxy-cutouts/<rest-of-cutouts-path>')
      '/proxy-cutouts': {
        target: 'https://l5s5a0sibv6w.share.zrok.io',
        changeOrigin: true,
        // Rewrite /proxy-cutouts/Processed_Cutouts/... -> /slcomp/Cutouts/Processed_Cutouts/...
        rewrite: (path) => path
          .replace(/^\/proxy-cutouts\/?/, '/slcomp/Cutouts/')
          .replace(/\/+/g,'/'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Header required by zrok to skip warning interstitial
            proxyReq.setHeader('skip_zrok_interstitial', 'true');
            proxyReq.setHeader('User-Agent', 'LaStBeRu-Explorer/1.0 (DevProxy)');
          });
        }
      }
    }
  }
});

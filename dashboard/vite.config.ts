import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
let outputDirectory = '';

// For GitHub Pages deployment: set BASE_PATH environment variable to your repo name
// Example: export BASE_PATH=/slcomp/ before building
const basePath = process.env.BASE_PATH || '/';

export default defineConfig({
  base: basePath,
  plugins: [react(), {
    name: 'omit-source-catalogs',
    apply: 'build',
    configResolved(config) { outputDirectory = resolve(config.root, config.build.outDir); },
    // Originals feed the exporter; browsers use the compact index and shards.
    closeBundle() {
      for (const file of ['database.json', 'consolidated_database.json', 'cutouts.json']) {
        rmSync(resolve(outputDirectory, 'data', file), { force: true });
      }
    }
  }],
  build: {
    target: 'baseline-widely-available',
    chunkSizeWarningLimit: 1100,
    sourcemap: false, // Disable source maps for production
    minify: 'oxc',
    rolldownOptions: {
      output: {
        minify: { compress: { dropConsole: true, dropDebugger: true } },
      }
    }
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@mui/material',
      '@mui/icons-material',
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

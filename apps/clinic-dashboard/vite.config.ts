import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const dashboardExportRoot = fileURLToPath(
  new URL('../../packages/dashboard-export/src', import.meta.url),
);
const moduleRegistryRoot = fileURLToPath(
  new URL('../../packages/module-registry/src', import.meta.url),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@booking/dashboard-export/pdf': `${dashboardExportRoot}/pdf.ts`,
      '@booking/dashboard-export/excel': `${dashboardExportRoot}/excel.ts`,
      '@booking/dashboard-export/word': `${dashboardExportRoot}/word.ts`,
      '@booking/dashboard-export/patient-word': `${dashboardExportRoot}/patient-word.ts`,
      '@booking/dashboard-export': `${dashboardExportRoot}/index.ts`,
      // Subpath exports must be listed before the package root alias.
      '@booking/module-registry/builtin': `${moduleRegistryRoot}/builtin/builtin-manifests.ts`,
      '@booking/module-registry/dashboard': `${moduleRegistryRoot}/dashboard/index.ts`,
      '@booking/module-registry/search': `${moduleRegistryRoot}/search/index.ts`,
      '@booking/module-registry/reporting': `${moduleRegistryRoot}/reporting/index.ts`,
      '@booking/module-registry/analytics': `${moduleRegistryRoot}/analytics/index.ts`,
      '@booking/module-registry/whitelabel': `${moduleRegistryRoot}/whitelabel/index.ts`,
      '@booking/module-registry/branch': `${moduleRegistryRoot}/branch/index.ts`,
      '@booking/module-registry/activity': `${moduleRegistryRoot}/activity/index.ts`,
      '@booking/module-registry/audit': `${moduleRegistryRoot}/audit/index.ts`,
      '@booking/module-registry/journey': `${moduleRegistryRoot}/journey/index.ts`,
      '@booking/module-registry/notification': `${moduleRegistryRoot}/notification/index.ts`,
      '@booking/module-registry': `${moduleRegistryRoot}/index.ts`,
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    fs: {
      allow: ['..', '../..'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        timeout: 0,
        rewrite: (p) => p.replace(/^\/api/, ''),
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req) => {
            const contentType = proxyRes.headers['content-type'] ?? '';
            if (contentType.includes('text/event-stream')) {
              proxyRes.headers['cache-control'] = 'no-cache, no-transform';
              proxyRes.headers['x-accel-buffering'] = 'no';
              req.socket?.setTimeout?.(0);
              proxyRes.socket?.setTimeout?.(0);
            }
          });
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      'exceljs',
      'pdf-lib',
      '@pdf-lib/fontkit',
      '@booking/dashboard-export',
      '@booking/dashboard-export/excel',
      '@booking/dashboard-export/pdf',
      '@booking/dashboard-export/word',
      '@booking/dashboard-export/patient-word',
      'docx',
    ],
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
var dashboardExportRoot = fileURLToPath(new URL('../../packages/dashboard-export/src', import.meta.url));
var moduleRegistryRoot = fileURLToPath(new URL('../../packages/module-registry/src', import.meta.url));
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            '@booking/dashboard-export/pdf': "".concat(dashboardExportRoot, "/pdf.ts"),
            '@booking/dashboard-export/excel': "".concat(dashboardExportRoot, "/excel.ts"),
            '@booking/dashboard-export/word': "".concat(dashboardExportRoot, "/word.ts"),
            '@booking/dashboard-export/patient-word': "".concat(dashboardExportRoot, "/patient-word.ts"),
            '@booking/dashboard-export': "".concat(dashboardExportRoot, "/index.ts"),
            '@booking/module-registry/builtin': "".concat(moduleRegistryRoot, "/builtin/builtin-manifests.ts"),
            '@booking/module-registry/dashboard': "".concat(moduleRegistryRoot, "/dashboard/index.ts"),
            '@booking/module-registry/search': "".concat(moduleRegistryRoot, "/search/index.ts"),
            '@booking/module-registry/reporting': "".concat(moduleRegistryRoot, "/reporting/index.ts"),
            '@booking/module-registry/analytics': "".concat(moduleRegistryRoot, "/analytics/index.ts"),
            '@booking/module-registry/whitelabel': "".concat(moduleRegistryRoot, "/whitelabel/index.ts"),
            '@booking/module-registry/branch': "".concat(moduleRegistryRoot, "/branch/index.ts"),
            '@booking/module-registry/activity': "".concat(moduleRegistryRoot, "/activity/index.ts"),
            '@booking/module-registry/audit': "".concat(moduleRegistryRoot, "/audit/index.ts"),
            '@booking/module-registry/journey': "".concat(moduleRegistryRoot, "/journey/index.ts"),
            '@booking/module-registry/notification': "".concat(moduleRegistryRoot, "/notification/index.ts"),
            '@booking/module-registry': "".concat(moduleRegistryRoot, "/index.ts"),
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
                rewrite: function (p) { return p.replace(/^\/api/, ''); },
                configure: function (proxy) {
                    proxy.on('proxyRes', function (proxyRes, req) {
                        var _a, _b, _c, _d, _e;
                        var contentType = (_a = proxyRes.headers['content-type']) !== null && _a !== void 0 ? _a : '';
                        if (contentType.includes('text/event-stream')) {
                            proxyRes.headers['cache-control'] = 'no-cache, no-transform';
                            proxyRes.headers['x-accel-buffering'] = 'no';
                            (_c = (_b = req.socket) === null || _b === void 0 ? void 0 : _b.setTimeout) === null || _c === void 0 ? void 0 : _c.call(_b, 0);
                            (_e = (_d = proxyRes.socket) === null || _d === void 0 ? void 0 : _d.setTimeout) === null || _e === void 0 ? void 0 : _e.call(_d, 0);
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

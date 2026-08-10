import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
var moduleRegistryRoot = fileURLToPath(new URL('../../packages/module-registry/src', import.meta.url));
/** Phase 46a security headers for dev/preview (CSP-compatible baseline). */
var securityHeaders = {
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' ws: wss: http://127.0.0.1:3000 http://localhost:3000; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            '@booking/module-registry/whitelabel': "".concat(moduleRegistryRoot, "/whitelabel/index.ts"),
            '@booking/module-registry': "".concat(moduleRegistryRoot, "/index.ts"),
        },
    },
    server: {
        host: '127.0.0.1',
        port: 5175,
        headers: securityHeaders,
        fs: {
            allow: ['..', '../..'],
        },
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                rewrite: function (p) { return p.replace(/^\/api/, ''); },
            },
        },
    },
    preview: {
        host: '127.0.0.1',
        port: 4175,
        headers: securityHeaders,
    },
});

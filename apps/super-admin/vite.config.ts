import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { SUPER_ADMIN_CSP_POLICY } from './src/security/csp-policy';

/** Scaffold security headers for Super Admin (platform control plane). */
const securityHeaders: Record<string, string> = {
  'Content-Security-Policy': SUPER_ADMIN_CSP_POLICY,
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
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5176,
    headers: securityHeaders,
    fs: {
      allow: ['..', '../..'],
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4176,
    headers: securityHeaders,
  },
});

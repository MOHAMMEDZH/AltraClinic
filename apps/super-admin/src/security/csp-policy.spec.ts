import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CSP_OWNERSHIP,
  parseCspDirectives,
  SUPER_ADMIN_CSP_POLICY,
} from './csp-policy';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const indexHtml = readFileSync(path.join(root, 'index.html'), 'utf8');
const viteConfig = readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
const directives = parseCspDirectives(SUPER_ADMIN_CSP_POLICY);

describe('Step 28 CSP01–CSP16 Super Admin CSP SSOT', () => {
  it('CSP01: SUPER_ADMIN_CSP_POLICY is non-empty and includes default-src self', () => {
    expect(SUPER_ADMIN_CSP_POLICY.length).toBeGreaterThan(20);
    expect(directives['default-src']).toContain("'self'");
  });

  it('CSP02: script-src is self-only (no unsafe-eval)', () => {
    expect(directives['script-src']).toEqual(["'self'"]);
    expect(SUPER_ADMIN_CSP_POLICY).not.toMatch(/unsafe-eval/);
  });

  it('CSP03: style-src allows self + unsafe-inline + fonts.googleapis', () => {
    expect(directives['style-src']).toEqual(
      expect.arrayContaining(["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']),
    );
  });

  it('CSP04: font-src allows self + fonts.gstatic', () => {
    expect(directives['font-src']).toEqual(
      expect.arrayContaining(["'self'", 'https://fonts.gstatic.com']),
    );
  });

  it('CSP05: img-src allows self + data:', () => {
    expect(directives['img-src']).toEqual(expect.arrayContaining(["'self'", 'data:']));
  });

  it('CSP06: frame-ancestors none', () => {
    expect(directives['frame-ancestors']).toEqual(["'none'"]);
  });

  it('CSP07: base-uri and form-action are self', () => {
    expect(directives['base-uri']).toEqual(["'self'"]);
    expect(directives['form-action']).toEqual(["'self'"]);
  });

  it('CSP08: index.html meta CSP content equals SUPER_ADMIN_CSP_POLICY', () => {
    // content="..." uses double quotes; policy itself contains single-quoted tokens like 'self'
    const m = indexHtml.match(
      /http-equiv=["']Content-Security-Policy["'][^>]*\bcontent="([^"]+)"/i,
    );
    expect(m?.[1]).toBe(SUPER_ADMIN_CSP_POLICY);
  });

  it('CSP09: vite.config.ts imports SUPER_ADMIN_CSP_POLICY SSOT', () => {
    expect(viteConfig).toMatch(/SUPER_ADMIN_CSP_POLICY/);
    expect(viteConfig).toMatch(/from ['"]\.\/src\/security\/csp-policy['"]/);
  });

  it('CSP10: CSP_OWNERSHIP documents deployment-external production serving', () => {
    expect(CSP_OWNERSHIP.productionServingOwner).toMatch(/deployment-external/);
    expect(CSP_OWNERSHIP.cspEnforcementOwner).toMatch(/REQUIRED of deploy owner/);
    expect(CSP_OWNERSHIP.repositoryConfig).toMatch(/index\.html/);
    expect(CSP_OWNERSHIP.productionCspPresent).toMatch(/deployment-owned/);
  });

  it('CSP11: Arabic/locale fonts not blocked — fonts.googleapis allowed in style-src', () => {
    expect(directives['style-src']).toContain('https://fonts.googleapis.com');
  });

  it('CSP12: Arabic/locale fonts not blocked — fonts.gstatic allowed in font-src', () => {
    expect(directives['font-src']).toContain('https://fonts.gstatic.com');
  });

  it('CSP13: parseCspDirectives round-trips directive names', () => {
    const again = parseCspDirectives(SUPER_ADMIN_CSP_POLICY);
    expect(Object.keys(again).sort()).toEqual(Object.keys(directives).sort());
  });

  it('CSP14: connect-src includes local API and ws for dev; prod API origin is deploy-owned', () => {
    const connect = directives['connect-src'] ?? [];
    expect(connect).toEqual(
      expect.arrayContaining([
        "'self'",
        'http://127.0.0.1:3000',
        'http://localhost:3000',
      ]),
    );
    expect(connect.some((t) => t.startsWith('ws:') || t.startsWith('ws://'))).toBe(true);
    // Production: deploy owner must allow the real API origin via edge CSP headers
    // (repository SSOT only documents local/dev API origins).
    expect(CSP_OWNERSHIP.cspEnforcementOwner).toMatch(/production edge headers REQUIRED/i);
  });

  it('CSP15: vite Content-Security-Policy header value must use SSOT import', () => {
    expect(viteConfig).toMatch(/['"]Content-Security-Policy['"]\s*:\s*SUPER_ADMIN_CSP_POLICY/);
  });

  it('CSP16: no secrets in policy (no tokens, passwords, private keys)', () => {
    expect(SUPER_ADMIN_CSP_POLICY).not.toMatch(/api[_-]?key|password|secret|Bearer|BEGIN PRIVATE/i);
    expect(SUPER_ADMIN_CSP_POLICY).not.toMatch(/sk-[a-zA-Z0-9]{10,}/);
  });
});

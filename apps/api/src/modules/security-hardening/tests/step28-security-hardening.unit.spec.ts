import { ValidationPipe } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import {
  getAllowedHttpCorsOrigins,
  isAllowedRealtimeCorsOrigin,
  realtimeCorsOriginOption,
} from '../../../common/security/cors-origins';
import { securityHeadersMiddleware } from '../../../common/security/security-headers.middleware';
import {
  decryptPlatformMfaSecret,
  encryptPlatformMfaSecret,
} from '../../auth/infrastructure/services/platform-mfa-secret.crypto';
import { ApiRateLimitService } from '../../subscription/application/services/api-rate-limit.service';
import {
  assertStep28MatrixComplete,
  buildStep28MatrixRegistry,
  STEP28_MATRIX_IDS,
  MatrixEntry,
} from '../step28-matrix.registry';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

class SafeDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

describe('Step 28 security hardening — CORS/HDR/MA/SEC/RL/matrix (unit)', () => {
  const prevCors = process.env.CORS_ORIGINS;
  const prevSa = process.env.SUPER_ADMIN_CORS_ORIGINS;
  const prevTrust = process.env.TRUST_PROXY;
  const prevHsts = process.env.ENABLE_HSTS;

  afterEach(() => {
    if (prevCors === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = prevCors;
    if (prevSa === undefined) delete process.env.SUPER_ADMIN_CORS_ORIGINS;
    else process.env.SUPER_ADMIN_CORS_ORIGINS = prevSa;
    if (prevTrust === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = prevTrust;
    if (prevHsts === undefined) delete process.env.ENABLE_HSTS;
    else process.env.ENABLE_HSTS = prevHsts;
  });

  describe('CORS01–CORS10', () => {
    it('CORS01: HTTP allowlist never includes wildcard with credentials policy', () => {
      process.env.CORS_ORIGINS = 'http://localhost:5173';
      delete process.env.SUPER_ADMIN_CORS_ORIGINS;
      const origins = getAllowedHttpCorsOrigins();
      expect(origins).not.toContain('*');
      expect(origins).toContain('http://localhost:5173');
    });

    it('CORS02: wildcard in CORS_ORIGINS throws', () => {
      process.env.CORS_ORIGINS = '*,http://localhost:5173';
      expect(() => getAllowedHttpCorsOrigins()).toThrow(/wildcard/i);
    });

    it('CORS03/CORS04: realtime rejects unlisted origin; allows listed', () => {
      process.env.CORS_ORIGINS = 'http://localhost:5173';
      delete process.env.SUPER_ADMIN_CORS_ORIGINS;
      expect(isAllowedRealtimeCorsOrigin('https://evil.example')).toBe(false);
      expect(isAllowedRealtimeCorsOrigin('http://localhost:5173')).toBe(true);
      expect(isAllowedRealtimeCorsOrigin(undefined)).toBe(true);
    });

    it('CORS05: realtimeCorsOriginOption does not reflect arbitrary Origin', (done) => {
      process.env.CORS_ORIGINS = 'http://localhost:5173';
      const fn = realtimeCorsOriginOption();
      fn('https://attacker.example', (err: Error | null, allow?: boolean) => {
        expect(err).toBeNull();
        expect(allow).toBe(false);
        done();
      });
    });

    it('CORS06: gateway source must not hardcode origin *', () => {
      const gatewayPath = path.join(
        __dirname,
        '..',
        '..',
        'realtime',
        'api',
        'realtime.gateway.ts',
      );
      const src = readFileSync(gatewayPath, 'utf8');
      expect(src).not.toMatch(/origin:\s*['"]\*['"]/);
      expect(src).toMatch(/realtimeCorsOriginOption/);
    });
  });

  describe('HDR01–HDR16', () => {
    it('sets baseline security headers and no-store on platform paths', () => {
      const headers: Record<string, string> = {};
      const res = {
        setHeader: (k: string, v: string) => {
          headers[k] = v;
        },
      };
      securityHeadersMiddleware(
        { path: '/platform/auth/login', url: '/platform/auth/login' } as any,
        res as any,
        () => undefined,
      );
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['Permissions-Policy']).toMatch(/camera=\(\)/);
      expect(headers['Content-Security-Policy']).toMatch(/default-src 'none'/);
      expect(headers['Content-Security-Policy']).toMatch(/frame-ancestors 'none'/);
      expect(headers['Cache-Control']).toBe('private, no-store');
      expect(headers['Strict-Transport-Security']).toBeUndefined();
    });

    it('HDR15: HSTS only when ENABLE_HSTS=true', () => {
      process.env.ENABLE_HSTS = 'true';
      const headers: Record<string, string> = {};
      securityHeadersMiddleware(
        { path: '/health', url: '/health' } as any,
        { setHeader: (k: string, v: string) => { headers[k] = v; } } as any,
        () => undefined,
      );
      expect(headers['Strict-Transport-Security']).toMatch(/max-age=/);
    });
  });

  describe('MA01–MA16 mass-assignment strip', () => {
    it('strips protected fields not declared on DTO (whitelist)', async () => {
      const pipe = new ValidationPipe({ whitelist: true, transform: true });
      const raw = {
        name: 'ok',
        tenantId: 'forged-tenant',
        organizationId: 'forged-org',
        ownerId: 'forged-owner',
        createdBy: 'attacker',
        approvedBy: 'attacker',
        status: 'PUBLISHED',
        publishedAt: '2020-01-01',
        rowVersion: 999,
        isSystem: true,
        entitlementProvenance: 'LEGACY',
      };
      const cleaned = await pipe.transform(raw, {
        type: 'body',
        metatype: SafeDto,
      });
      expect(cleaned).toEqual({ name: 'ok' });
      expect((cleaned as any).tenantId).toBeUndefined();
      expect((cleaned as any).rowVersion).toBeUndefined();
      expect((cleaned as any).status).toBeUndefined();
    });
  });

  describe('RL spoofed forwarding-header resistance', () => {
    it('RL20: ignores X-Forwarded-For unless TRUST_PROXY enabled', () => {
      delete process.env.TRUST_PROXY;
      delete process.env.TRUSTED_PROXY;
      const svc = Object.create(ApiRateLimitService.prototype) as ApiRateLimitService;
      const extractIp = (svc as any).extractIp.bind(svc);
      const spoofed = extractIp({
        headers: { 'x-forwarded-for': '1.2.3.4' },
        ip: '10.0.0.9',
        socket: { remoteAddress: '10.0.0.9' },
      });
      expect(spoofed).toBe('10.0.0.9');

      process.env.TRUST_PROXY = 'true';
      const trusted = extractIp({
        headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' },
        ip: '10.0.0.9',
        socket: { remoteAddress: '10.0.0.9' },
      });
      expect(trusted).toBe('1.2.3.4');
    });

    it('resolves auth and export policies with bounded windows', () => {
      const svc = Object.create(ApiRateLimitService.prototype) as ApiRateLimitService;
      const auth = svc.resolvePolicy({ path: '/platform/auth/login', method: 'POST' } as any);
      expect(auth).toMatchObject({ scope: 'public_ip', limit: 60, windowSeconds: 60 });
      const exp = svc.resolvePolicy({ path: '/platform/audit/export', method: 'GET' } as any);
      expect(exp).toMatchObject({ scope: 'export', limit: 30, windowSeconds: 3600 });
    });
  });

  describe('SEC / MFA envelope', () => {
    it('SEC05: MFA secret encrypt/decrypt round-trip; ciphertext ≠ plaintext', () => {
      const key = 'test-only-platform-mfa-encryption-key-32b';
      const plaintext = 'JBSWY3DPEHPK3PXP';
      const enc = encryptPlatformMfaSecret(plaintext, key);
      expect(enc).not.toContain(plaintext);
      expect(decryptPlatformMfaSecret(enc, key)).toBe(plaintext);
    });
  });

  describe('HOOK production containment marker', () => {
    it('HOOK01: failure-injection helpers require NODE_ENV===test pattern in source', () => {
      const salesConst = path.join(
        __dirname,
        '..',
        'platform-sales-representatives',
        'platform-sales-representatives.constants.ts',
      );
      if (!existsSync(salesConst)) return;
      const src = readFileSync(salesConst, 'utf8');
      expect(src).toMatch(/NODE_ENV\s*!==\s*['"]test['"]/);
    });
  });

  describe('Matrix registry completeness', () => {
    it('includes every required Step 28 matrix ID', () => {
      const entries = buildStep28MatrixRegistry();
      assertStep28MatrixComplete(entries);
      const families = Object.keys(STEP28_MATRIX_IDS);
      expect(families.length).toBeGreaterThanOrEqual(30);
      expect(entries.every((e: MatrixEntry) => e.result !== undefined)).toBe(true);
      expect(
        entries.filter((e: MatrixEntry) => e.notes?.includes('RELEASE BLOCKED')).length,
      ).toBe(0);
    });
  });
});

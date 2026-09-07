import { readFileSync } from 'fs';
import path from 'path';
import { assertProductionSecurityBootstrap } from '../../../common/security/production-security-bootstrap';
import { isApiRateLimitTestBypassActive } from '../../subscription/application/services/api-rate-limit-test-bypass';
import { ApiRateLimitService } from '../../subscription/application/services/api-rate-limit.service';
import { RateLimiterService } from '../../../infrastructure/redis/services/rate-limiter.service';
import { RedisKeyBuilder } from '../../../infrastructure/redis/redis-key.builder';
import { LicensingEngineService } from '../../subscription/application/services/licensing-engine.service';
import { LicensingAuditService } from '../../subscription/application/services/licensing-audit.service';
import { UNLIMITED } from '../../subscription/domain/config/plan-limits.config';

describe('Step 28 RLTEST01–RLTEST08 rate-limit / bootstrap containment', () => {
  const prev: Record<string, string | undefined> = {};
  const ENV_KEYS = [
    'NODE_ENV',
    'ALLOW_TEST_HTTP_BOOTSTRAP',
    'API_RATE_LIMIT_ALLOW_TEST_BYPASS',
    'JEST_WORKER_ID',
    'TRUST_PROXY',
    'TRUSTED_PROXY',
  ] as const;

  beforeEach(() => {
    for (const k of ENV_KEYS) prev[k] = process.env[k];
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  function mockDeps() {
    const rateLimiter = {
      checkFixedWindow: jest.fn().mockResolvedValue({
        allowed: true,
        count: 1,
        limit: 60,
        remaining: 59,
        resetAt: 9999999999,
      }),
      checkSlidingWindow: jest.fn().mockResolvedValue({
        allowed: true,
        count: 1,
        limit: 60,
        remaining: 59,
        resetAt: 9999999999,
      }),
    } as unknown as RateLimiterService;
    const licensing = {
      resolveLicense: jest.fn().mockResolvedValue({
        effectiveLimits: { maxApiRequestsPerDay: 2400 },
      }),
    } as unknown as LicensingEngineService;
    const audit = {
      recordLicenseEvent: jest.fn(),
    } as unknown as LicensingAuditService;
    return { rateLimiter, licensing, audit, keys: new RedisKeyBuilder('rltest') };
  }

  it('RLTEST01: NODE_ENV=production → bootstrap OK; bypass inactive without DI', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_TEST_HTTP_BOOTSTRAP;
    delete process.env.API_RATE_LIMIT_ALLOW_TEST_BYPASS;
    expect(() => assertProductionSecurityBootstrap()).not.toThrow();
    expect(isApiRateLimitTestBypassActive()).toBe(false);
    const { rateLimiter, licensing, audit, keys } = mockDeps();
    const svc = new ApiRateLimitService(rateLimiter, keys, licensing, audit);
    expect(svc.isTestHarnessBypassEnabled()).toBe(false);
  });

  it('RLTEST02: NODE_ENV=development → bootstrap OK; bypass inactive', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.API_RATE_LIMIT_ALLOW_TEST_BYPASS;
    expect(() => assertProductionSecurityBootstrap()).not.toThrow();
    expect(isApiRateLimitTestBypassActive()).toBe(false);
  });

  it('RLTEST03: NODE_ENV=test bootstrap gate; NODE_ENV=test alone does not activate bypass', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.ALLOW_TEST_HTTP_BOOTSTRAP;
    delete process.env.API_RATE_LIMIT_ALLOW_TEST_BYPASS;
    expect(() => assertProductionSecurityBootstrap()).toThrow(/ALLOW_TEST_HTTP_BOOTSTRAP/);

    process.env.ALLOW_TEST_HTTP_BOOTSTRAP = '1';
    expect(() => assertProductionSecurityBootstrap()).not.toThrow();

    // Dual-gate still closed without API_RATE_LIMIT_ALLOW_TEST_BYPASS=1
    expect(isApiRateLimitTestBypassActive()).toBe(false);
  });

  it('RLTEST04: DI testBypass=true → enforce returns unlimited without calling rateLimiter', async () => {
    delete process.env.API_RATE_LIMIT_ALLOW_TEST_BYPASS;
    const { rateLimiter, licensing, audit, keys } = mockDeps();
    const svc = new ApiRateLimitService(rateLimiter, keys, licensing, audit, true);
    const result = await svc.enforce({
      path: '/platform/auth/login',
      url: '/platform/auth/login',
      method: 'POST',
      headers: {},
      ip: '10.0.0.1',
    } as any);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(UNLIMITED);
    expect(rateLimiter.checkSlidingWindow).not.toHaveBeenCalled();
    expect(rateLimiter.checkFixedWindow).not.toHaveBeenCalled();
  });

  it('RLTEST05: ALLOW alone without JEST_WORKER_ID → false; NODE_ENV=test alone → false', () => {
    const savedWorker = process.env.JEST_WORKER_ID;
    delete process.env.JEST_WORKER_ID;
    process.env.API_RATE_LIMIT_ALLOW_TEST_BYPASS = '1';
    process.env.NODE_ENV = 'development';
    expect(isApiRateLimitTestBypassActive()).toBe(false);

    if (savedWorker !== undefined) process.env.JEST_WORKER_ID = savedWorker;
    else delete process.env.JEST_WORKER_ID;
    delete process.env.API_RATE_LIMIT_ALLOW_TEST_BYPASS;
    process.env.NODE_ENV = 'test';
    expect(isApiRateLimitTestBypassActive()).toBe(false);
  });

  it('RLTEST06: XFF ignored without TRUST_PROXY (enforce + sliding mock)', async () => {
    delete process.env.TRUST_PROXY;
    delete process.env.TRUSTED_PROXY;
    delete process.env.API_RATE_LIMIT_ALLOW_TEST_BYPASS;
    const { rateLimiter, licensing, audit, keys } = mockDeps();
    const svc = new ApiRateLimitService(rateLimiter, keys, licensing, audit);
    await svc.enforce({
      path: '/platform/auth/login',
      url: '/platform/auth/login',
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
      ip: '10.0.0.9',
      socket: { remoteAddress: '10.0.0.9' },
    } as any);
    expect(rateLimiter.checkSlidingWindow).toHaveBeenCalled();
    const key = (rateLimiter.checkSlidingWindow as jest.Mock).mock.calls[0][0] as string;
    expect(key).toContain('10.0.0.9');
    expect(key).not.toContain('1.2.3.4');
  });

  it('RLTEST07: authz hooks are dual-gated; ApiRateLimitService enforce has no NODE_ENV===test alone skip', () => {
    const rlSrc = readFileSync(
      path.join(__dirname, '..', '..', 'subscription', 'application', 'services', 'api-rate-limit.service.ts'),
      'utf8',
    );
    expect(rlSrc).not.toMatch(
      /if\s*\(\s*process\.env\.NODE_ENV\s*===\s*['"]test['"]\s*\)\s*\{[\s\S]{0,200}return\s*\{\s*allowed:\s*true/,
    );
    expect(rlSrc).toMatch(/never skip solely because NODE_ENV/);

    const ffConst = path.join(
      __dirname,
      '..',
      '..',
      'feature-flags-settings',
      'feature-flags-settings.constants.ts',
    );
    const ffSrc = readFileSync(ffConst, 'utf8');
    expect(ffSrc).toMatch(/NODE_ENV\s*!==\s*['"]test['"]/);
    expect(ffSrc).toMatch(/exact|selector|injection/i);

    const eerSrc = readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        'effective-entitlement-runtime',
        'domain',
        'runtime-provenance.ts',
      ),
      'utf8',
    );
    expect(eerSrc).not.toMatch(/if\s*\(\s*process\.env\.NODE_ENV\s*===\s*['"]test['"]\s*\)\s*return/);
  });

  it('RLTEST08: without DI and without dual-gate, enforce calls rate limiter', async () => {
    delete process.env.API_RATE_LIMIT_ALLOW_TEST_BYPASS;
    const { rateLimiter, licensing, audit, keys } = mockDeps();
    const svc = new ApiRateLimitService(rateLimiter, keys, licensing, audit);
    expect(svc.isTestHarnessBypassEnabled()).toBe(false);
    await svc.enforce({
      path: '/platform/auth/login',
      url: '/platform/auth/login',
      method: 'POST',
      headers: {},
      ip: '127.0.0.1',
    } as any);
    expect(rateLimiter.checkSlidingWindow).toHaveBeenCalled();
  });
});

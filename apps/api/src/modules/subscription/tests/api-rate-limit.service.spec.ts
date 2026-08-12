import { ApiRateLimitService } from '../application/services/api-rate-limit.service';
import { RateLimiterService } from '../../../infrastructure/redis/services/rate-limiter.service';
import { RedisKeyBuilder } from '../../../infrastructure/redis/redis-key.builder';
import { LicensingEngineService } from '../application/services/licensing-engine.service';
import { LicensingAuditService } from '../application/services/licensing-audit.service';
import { ApiRateLimitExceededException } from '../domain/exceptions/api-rate-limit-exceeded.exception';
import { UNLIMITED } from '../domain/config/plan-limits.config';

const TENANT = 'tenant-rate-1';

function mockRequest(path: string, user?: { sub: string; tenantId: string }) {
  return {
    path,
    url: path,
    method: 'GET',
    headers: {},
    ip: '127.0.0.1',
    user,
  } as never;
}

describe('ApiRateLimitService', () => {
  const rateLimiter = {
    checkFixedWindow: jest.fn(),
    checkSlidingWindow: jest.fn(),
  } as unknown as RateLimiterService;

  const licensing = {
    resolveLicense: jest.fn(),
  } as unknown as LicensingEngineService;

  const audit = {
    recordLicenseEvent: jest.fn(),
  } as unknown as LicensingAuditService;

  const svc = new ApiRateLimitService(rateLimiter, new RedisKeyBuilder('test'), licensing, audit, false);

  const prevNodeEnv = process.env.NODE_ENV;
  const prevBypass = process.env.API_RATE_LIMIT_ALLOW_TEST_BYPASS;
  const prevJest = process.env.JEST_WORKER_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    // Exercise real production enforce path: dual-gate bypass must be off.
    process.env.NODE_ENV = 'development';
    delete process.env.API_RATE_LIMIT_ALLOW_TEST_BYPASS;
    delete process.env.JEST_WORKER_ID;
  });

  afterEach(() => {
    process.env.NODE_ENV = prevNodeEnv;
    if (prevBypass === undefined) delete process.env.API_RATE_LIMIT_ALLOW_TEST_BYPASS;
    else process.env.API_RATE_LIMIT_ALLOW_TEST_BYPASS = prevBypass;
    if (prevJest === undefined) delete process.env.JEST_WORKER_ID;
    else process.env.JEST_WORKER_ID = prevJest;
  });

  it('allows tenant request under hourly plan limit', async () => {
    (licensing.resolveLicense as jest.Mock).mockResolvedValue({
      effectiveLimits: { maxApiRequestsPerDay: 2400 },
    });
    (rateLimiter.checkFixedWindow as jest.Mock).mockResolvedValue({
      allowed: true,
      count: 1,
      limit: 100,
      remaining: 99,
      resetAt: 9999999999,
    });

    const result = await svc.enforce(mockRequest('/patients', { sub: 'u1', tenantId: TENANT }));
    expect(result.allowed).toBe(true);
  });

  it('throws 429 when tenant limit exceeded', async () => {
    (licensing.resolveLicense as jest.Mock).mockResolvedValue({
      effectiveLimits: { maxApiRequestsPerDay: 2400 },
    });
    (rateLimiter.checkFixedWindow as jest.Mock).mockResolvedValue({
      allowed: false,
      count: 101,
      limit: 100,
      remaining: 0,
      resetAt: Math.floor(Date.now() / 1000) + 60,
    });

    await expect(svc.enforce(mockRequest('/patients', { sub: 'u1', tenantId: TENANT }))).rejects.toBeInstanceOf(
      ApiRateLimitExceededException,
    );
  });

  it('passes through unlimited enterprise plan', async () => {
    (licensing.resolveLicense as jest.Mock).mockResolvedValue({
      effectiveLimits: { maxApiRequestsPerDay: UNLIMITED },
    });

    const result = await svc.enforce(mockRequest('/dashboard', { sub: 'u1', tenantId: TENANT }));
    expect(result.allowed).toBe(true);
    expect(rateLimiter.checkFixedWindow).not.toHaveBeenCalled();
  });

  it('isolates tenants with different keys', async () => {
    (licensing.resolveLicense as jest.Mock).mockResolvedValue({
      effectiveLimits: { maxApiRequestsPerDay: 2400 },
    });
    (rateLimiter.checkFixedWindow as jest.Mock).mockResolvedValue({
      allowed: true,
      count: 1,
      limit: 100,
      remaining: 99,
      resetAt: 9999999999,
    });

    await svc.enforce(mockRequest('/patients', { sub: 'u1', tenantId: 'tenant-a' }));
    await svc.enforce(mockRequest('/patients', { sub: 'u1', tenantId: 'tenant-b' }));

    const keys = (rateLimiter.checkFixedWindow as jest.Mock).mock.calls.map((c) => c[0]);
    expect(keys[0]).not.toEqual(keys[1]);
  });

  it('uses sliding window for auth endpoints', async () => {
    (rateLimiter.checkSlidingWindow as jest.Mock).mockResolvedValue({
      allowed: true,
      count: 1,
      limit: 60,
      remaining: 59,
      resetAt: 9999999999,
    });

    await svc.enforce(mockRequest('/auth/login'));
    expect(rateLimiter.checkSlidingWindow).toHaveBeenCalled();
  });

  it('ignores spoofed X-Forwarded-For unless TRUST_PROXY is enabled', async () => {
    delete process.env.TRUST_PROXY;
    delete process.env.TRUSTED_PROXY;
    (rateLimiter.checkSlidingWindow as jest.Mock).mockResolvedValue({
      allowed: true,
      count: 1,
      limit: 60,
      remaining: 59,
      resetAt: 9999999999,
    });

    const req = {
      path: '/platform/auth/login',
      url: '/platform/auth/login',
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.9' },
      ip: '10.0.0.2',
      socket: { remoteAddress: '10.0.0.2' },
    } as never;

    await svc.enforce(req);
    const key = (rateLimiter.checkSlidingWindow as jest.Mock).mock.calls[0][0] as string;
    expect(key).toContain('10.0.0.2');
    expect(key).not.toContain('203.0.113.9');
  });
});

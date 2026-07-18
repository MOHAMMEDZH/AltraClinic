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

  const svc = new ApiRateLimitService(rateLimiter, new RedisKeyBuilder('test'), licensing, audit);

  beforeEach(() => jest.clearAllMocks());

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
});

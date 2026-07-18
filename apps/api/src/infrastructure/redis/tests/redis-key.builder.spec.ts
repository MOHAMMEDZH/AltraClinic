import { RedisKeyBuilder } from '../redis-key.builder';

describe('RedisKeyBuilder', () => {
  let kb: RedisKeyBuilder;

  beforeEach(() => {
    kb = new RedisKeyBuilder('app');
  });

  describe('key structure', () => {
    it('session key has correct format', () => {
      expect(kb.session('tenant-abc', 'sess-123')).toBe('app:session:tenant-abc:sid:sess-123');
    });

    it('sanitises colons in tenantId', () => {
      expect(kb.session('tenant:evil', 'sid')).toBe('app:session:tenant_evil:sid:sid');
    });

    it('IP rate limit uses _global scope', () => {
      expect(kb.ipRateLimit('192.168.1.1', '2026-06-15T10')).toContain(':_global:');
    });

    it('jti blacklist uses _global scope', () => {
      expect(kb.jtiBlacklist('jti-xyz')).toBe('app:jti:_global:blacklist:jti-xyz');
    });

    it('api rate limit is tenant-scoped', () => {
      const key = kb.apiRateLimit('tenant-123', '2026-06-15T10');
      expect(key).toBe('app:ratelimit:tenant-123:api:2026-06-15t10');
    });

    it('cache tag tenant key has correct format', () => {
      expect(kb.cacheTagTenant('tenant-abc')).toBe('app:cache:tags:tenant:tenant-abc');
    });

    it('distributed lock key is tenant-scoped', () => {
      expect(kb.lock('tenant-abc', 'subscription', 'create')).toBe('app:lock:tenant-abc:subscription:create');
    });

    it('password reset token key is global', () => {
      expect(kb.passwordResetToken('abc123hash')).toBe('app:token:_global:reset:abc123hash');
    });

    it('different tenants produce different session keys', () => {
      const a = kb.session('tenant-a', 'same-session');
      const b = kb.session('tenant-b', 'same-session');
      expect(a).not.toBe(b);
    });

    it('different tenants produce different rate limit keys', () => {
      const a = kb.apiRateLimit('tenant-a', '2026-06-15T10');
      const b = kb.apiRateLimit('tenant-b', '2026-06-15T10');
      expect(a).not.toBe(b);
    });
  });

  describe('sanitize', () => {
    it('replaces colons with underscores', () => {
      expect(kb.sanitize('evil:injection:key')).toBe('evil_injection_key');
    });

    it('lowercases all characters', () => {
      expect(kb.sanitize('TENANT-ABC')).toBe('tenant-abc');
    });
  });

  describe('static time helpers', () => {
    it('currentHourWindow returns a timestamp string', () => {
      const w = RedisKeyBuilder.currentHourWindow();
      expect(w).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}$/);
    });

    it('currentMinuteWindow is a substring extension of currentHourWindow', () => {
      const h = RedisKeyBuilder.currentHourWindow();
      const m = RedisKeyBuilder.currentMinuteWindow();
      expect(m).toContain(h);
    });

    it('todayUtc returns YYYY-MM-DD', () => {
      expect(RedisKeyBuilder.todayUtc()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('currentMonthUtc returns YYYY-MM', () => {
      expect(RedisKeyBuilder.currentMonthUtc()).toMatch(/^\d{4}-\d{2}$/);
    });
  });
});

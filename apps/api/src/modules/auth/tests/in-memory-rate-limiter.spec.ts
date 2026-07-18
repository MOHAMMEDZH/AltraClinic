import { InMemoryRateLimiter } from '../infrastructure/services/in-memory-rate-limiter.service';

describe('InMemoryRateLimiter', () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter();
  });

  it('increments counter', async () => {
    expect(await limiter.increment('key1', 60)).toBe(1);
    expect(await limiter.increment('key1', 60)).toBe(2);
    expect(await limiter.increment('key1', 60)).toBe(3);
  });

  it('getCount returns current count', async () => {
    await limiter.increment('k', 60);
    await limiter.increment('k', 60);
    expect(await limiter.getCount('k')).toBe(2);
  });

  it('returns 0 for unknown key', async () => {
    expect(await limiter.getCount('unknown')).toBe(0);
  });

  it('reset clears counter', async () => {
    await limiter.increment('k', 60);
    await limiter.reset('k');
    expect(await limiter.getCount('k')).toBe(0);
  });

  it('expires after window (simulated via short window)', async () => {
    // Very short window of 0.001 seconds = 1ms
    await limiter.increment('k', 0.001);
    await new Promise((r) => setTimeout(r, 10));
    // After expiry, increment should start fresh
    expect(await limiter.increment('k', 60)).toBe(1);
  });
});

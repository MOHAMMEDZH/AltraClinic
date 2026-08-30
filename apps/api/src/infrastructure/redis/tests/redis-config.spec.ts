import {
  loadRedisConfig,
  formatRedisUrlForLog,
  CI_REDIS_ABSENCE_ENFORCEMENT_ENV,
  PLAYWRIGHT_E2E_ABSENT_REDIS_URL,
} from '../redis-config';

describe('loadRedisConfig — Redis precedence', () => {
  const saved: Record<string, string | undefined> = {};
  const keys = [
    'REDIS_URL',
    'REDIS_OPTIONAL',
    'REDIS_PASSWORD',
    'REDIS_KEY_PREFIX',
    'REDIS_DB',
    'REDIS_CONNECT_TIMEOUT_MS',
    'REDIS_CLUSTER_NODES',
    'PLAYWRIGHT_REDIS_URL',
    CI_REDIS_ABSENCE_ENFORCEMENT_ENV,
    'CI',
    'NODE_ENV',
  ];

  beforeEach(() => {
    for (const k of keys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    process.env.REDIS_OPTIONAL = 'true';
  });

  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('production/non-E2E: uses REDIS_URL when set', () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6380/2';
    expect(loadRedisConfig().url).toBe('redis://127.0.0.1:6380/2');
  });

  it('production/non-E2E: defaults to localhost:6379 when REDIS_URL unset', () => {
    expect(loadRedisConfig().url).toBe('redis://localhost:6379');
  });

  it('generic CI=true alone does NOT force Redis absence', () => {
    process.env.CI = 'true';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    expect(loadRedisConfig().url).toBe('redis://127.0.0.1:6379');
  });

  it('CI_REDIS_ABSENCE_ENFORCEMENT + PLAYWRIGHT_REDIS_URL unset → 63999', () => {
    process.env[CI_REDIS_ABSENCE_ENFORCEMENT_ENV] = '1';
    process.env.REDIS_URL = 'redis://127.0.0.1:6380';
    expect(loadRedisConfig().url).toBe(PLAYWRIGHT_E2E_ABSENT_REDIS_URL);
  });

  it('CI_REDIS_ABSENCE_ENFORCEMENT + PLAYWRIGHT_REDIS_URL set → exact URL', () => {
    process.env[CI_REDIS_ABSENCE_ENFORCEMENT_ENV] = '1';
    process.env.PLAYWRIGHT_REDIS_URL = 'redis://127.0.0.1:6380/9';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    expect(loadRedisConfig().url).toBe('redis://127.0.0.1:6380/9');
  });

  it('child REDIS_URL ambient value loses when absence enforcement is on', () => {
    process.env[CI_REDIS_ABSENCE_ENFORCEMENT_ENV] = 'true';
    process.env.REDIS_URL = 'redis://localhost:6379';
    expect(loadRedisConfig().url).toBe(PLAYWRIGHT_E2E_ABSENT_REDIS_URL);
  });

  it('formatRedisUrlForLog omits credentials', () => {
    expect(formatRedisUrlForLog('redis://:secret@127.0.0.1:63999/0')).toBe('127.0.0.1:63999');
    expect(formatRedisUrlForLog('redis://user:pass@redis.example:6379')).toBe(
      'redis.example:6379',
    );
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveApiWebServerMfaEncryptionKey,
  resolveApiWebServerRedisUrl,
  buildApiWebServerEnv,
  formatRedisUrlForLog,
} from '../playwright.config';

const TEST_ONLY = 'test-only-platform-mfa-encryption-key-32b';
const JWT_A = 'ci-access-secret-minimum-32-characters-long';
const JWT_R = 'ci-refresh-secret-minimum-32-characters-long';
const configDir = path.dirname(fileURLToPath(import.meta.url));

describe('resolveApiWebServerMfaEncryptionKey', () => {
  it('returns an explicit normal value exactly', () => {
    const key = 'exact-explicit-mfa-key-value-unchanged';
    expect(
      resolveApiWebServerMfaEncryptionKey({
        PLATFORM_MFA_ENCRYPTION_KEY: key,
      } as NodeJS.ProcessEnv),
    ).toBe(key);
  });

  it('returns an explicit value with surrounding whitespace byte-for-byte when nonblank', () => {
    const key = '  padded-explicit-mfa-key  ';
    expect(
      resolveApiWebServerMfaEncryptionKey({
        CI: 'true',
        PLATFORM_MFA_ENCRYPTION_KEY: key,
      } as NodeJS.ProcessEnv),
    ).toBe(key);
  });

  it('treats whitespace-only as absent', () => {
    expect(
      resolveApiWebServerMfaEncryptionKey({
        PLATFORM_MFA_ENCRYPTION_KEY: '   \t  ',
      } as NodeJS.ProcessEnv),
    ).toBeUndefined();
  });

  it('returns undefined when CI is absent/false and no explicit key', () => {
    expect(resolveApiWebServerMfaEncryptionKey({} as NodeJS.ProcessEnv)).toBeUndefined();
    expect(
      resolveApiWebServerMfaEncryptionKey({ CI: 'false' } as NodeJS.ProcessEnv),
    ).toBeUndefined();
  });

  it('returns 96 lowercase hex when CI is active and no key; two calls differ', () => {
    const a = resolveApiWebServerMfaEncryptionKey({ CI: 'true' } as NodeJS.ProcessEnv);
    const b = resolveApiWebServerMfaEncryptionKey({ CI: '1' } as NodeJS.ProcessEnv);
    expect(typeof a).toBe('string');
    expect(a).toHaveLength(96);
    expect(a).toMatch(/^[0-9a-f]{96}$/);
    expect(typeof b).toBe('string');
    expect(b).toHaveLength(96);
    expect(a).not.toBe(b);
    expect(a).not.toBe(TEST_ONLY);
    expect(a).not.toBe(JWT_A);
    expect(a).not.toBe(JWT_R);
  });

  it('disables BullMQ workers/schedulers when CI pins unreachable Redis (no PLAYWRIGHT_REDIS_URL)', () => {
    const src = readFileSync(path.join(configDir, '..', 'playwright.config.ts'), 'utf8');
    expect(src).toMatch(/NODE_ENV\s*=\s*'development'/);
    expect(src).toMatch(/BACKGROUND_SCHEDULERS_ENABLED\s*=\s*inherited\.BACKGROUND_SCHEDULERS_ENABLED\s*\?\?\s*'false'/);
    expect(src).toMatch(/BACKGROUND_WORKERS_ENABLED\s*=\s*inherited\.BACKGROUND_WORKERS_ENABLED\s*\?\?\s*'false'/);
  });
});

describe('resolveApiWebServerRedisUrl', () => {
  const prevPinned = process.env.PLAYWRIGHT_REDIS_URL;

  afterEach(() => {
    if (prevPinned === undefined) delete process.env.PLAYWRIGHT_REDIS_URL;
    else process.env.PLAYWRIGHT_REDIS_URL = prevPinned;
  });

  it('pins unreachable Redis when PLAYWRIGHT_REDIS_URL is absent (CI ambient isolation)', () => {
    delete process.env.PLAYWRIGHT_REDIS_URL;
    expect(resolveApiWebServerRedisUrl({} as NodeJS.ProcessEnv)).toBe(
      'redis://127.0.0.1:63999',
    );
  });

  it('honors explicit PLAYWRIGHT_REDIS_URL from inherited env', () => {
    expect(
      resolveApiWebServerRedisUrl({
        PLAYWRIGHT_REDIS_URL: 'redis://127.0.0.1:6380/3',
      } as NodeJS.ProcessEnv),
    ).toBe('redis://127.0.0.1:6380/3');
  });

  it('does not default to localhost:6379 (ambient Redis trap)', () => {
    delete process.env.PLAYWRIGHT_REDIS_URL;
    const url = resolveApiWebServerRedisUrl({} as NodeJS.ProcessEnv);
    expect(url).not.toMatch(/localhost:6379|127\.0\.0\.1:6379/);
  });

  it('wires resolveApiWebServerRedisUrl into buildApiWebServerEnv source', () => {
    const src = readFileSync(path.join(configDir, '..', 'playwright.config.ts'), 'utf8');
    expect(src).toMatch(/resolveApiWebServerRedisUrl/);
    expect(src).toMatch(/REDIS_URL\s*=\s*resolveApiWebServerRedisUrl|REDIS_URL\s*=\s*redisUrl/);
    expect(src).toMatch(/REDIS_OPTIONAL\s*=\s*'true'/);
    expect(src).toMatch(/CI_REDIS_ABSENCE_ENFORCEMENT/);
  });
});

describe('buildApiWebServerEnv — Redis absence contract', () => {
  it('sets CI_REDIS_ABSENCE_ENFORCEMENT=1 and 63999 when PLAYWRIGHT_REDIS_URL unset', () => {
    const env = buildApiWebServerEnv({
      CI: 'true',
      REDIS_URL: 'redis://127.0.0.1:6380',
    } as NodeJS.ProcessEnv);
    expect(env.REDIS_URL).toBe('redis://127.0.0.1:63999');
    expect(env.CI_REDIS_ABSENCE_ENFORCEMENT).toBe('1');
    expect(env.REDIS_OPTIONAL).toBe('true');
    expect(env.BACKGROUND_SCHEDULERS_ENABLED).toBe('false');
    expect(env.BACKGROUND_WORKERS_ENABLED).toBe('false');
    expect(env.PLAYWRIGHT_REDIS_RESOLVED_HOSTPORT).toBe('127.0.0.1:63999');
  });

  it('honors PLAYWRIGHT_REDIS_URL and clears absence enforcement', () => {
    const env = buildApiWebServerEnv({
      CI: 'true',
      PLAYWRIGHT_REDIS_URL: 'redis://127.0.0.1:6380/4',
      REDIS_URL: 'redis://127.0.0.1:6379',
    } as NodeJS.ProcessEnv);
    expect(env.REDIS_URL).toBe('redis://127.0.0.1:6380/4');
    expect(env.CI_REDIS_ABSENCE_ENFORCEMENT).toBeUndefined();
    expect(env.BACKGROUND_WORKERS_ENABLED).toBe('true');
    expect(env.PLAYWRIGHT_REDIS_RESOLVED_HOSTPORT).toBe('127.0.0.1:6380');
  });

  it('process-inherited ambient REDIS_URL does not win over absence pin', () => {
    const env = buildApiWebServerEnv({
      REDIS_URL: 'redis://localhost:6379',
    } as NodeJS.ProcessEnv);
    expect(env.REDIS_URL).toBe('redis://127.0.0.1:63999');
  });

  it('formatRedisUrlForLog strips userinfo', () => {
    expect(formatRedisUrlForLog('redis://:s3cret@127.0.0.1:63999')).toBe('127.0.0.1:63999');
  });
});
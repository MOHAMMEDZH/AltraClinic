import {
  loadPlatformSecurityConfig,
  TEST_ONLY_PLATFORM_MFA_ENCRYPTION_KEY,
  validatePlatformMfaEncryptionKey,
} from '../config/platform-security.config';

describe('platform-security.config — MFA encryption key + disable-flag policy', () => {
  const validKey = 'local-dev-platform-mfa-encryption-key-min-32';

  it('NODE_ENV=test may use the deterministic test key when unset', () => {
    const cfg = loadPlatformSecurityConfig({ NODE_ENV: 'test' });
    expect(cfg.mfaEncryptionKey).toBe(TEST_ONLY_PLATFORM_MFA_ENCRYPTION_KEY);
  });

  it('test-key behavior is not available when NODE_ENV is absent', () => {
    expect(() => loadPlatformSecurityConfig({})).toThrow(
      /PLATFORM_MFA_ENCRYPTION_KEY is required/,
    );
  });

  it.each(['development', 'qa', 'preview', 'demo', 'staging', 'production'] as const)(
    '%s without an explicit MFA key fails startup',
    (envName) => {
      expect(() =>
        loadPlatformSecurityConfig({ NODE_ENV: envName }),
      ).toThrow(/PLATFORM_MFA_ENCRYPTION_KEY is required/);
    },
  );

  it('empty key fails startup', () => {
    expect(() =>
      loadPlatformSecurityConfig({
        NODE_ENV: 'development',
        PLATFORM_MFA_ENCRYPTION_KEY: '   ',
      }),
    ).toThrow(/PLATFORM_MFA_ENCRYPTION_KEY/);
  });

  it('invalid decoded length (too short) fails startup', () => {
    expect(() =>
      validatePlatformMfaEncryptionKey('too-short', { NODE_ENV: 'development' }),
    ).toThrow(/at least 32 characters/);
  });

  it('known placeholder values fail startup', () => {
    expect(() =>
      validatePlatformMfaEncryptionKey('change-me', { NODE_ENV: 'development' }),
    ).toThrow(/placeholder/);
  });

  it('JWT signing secrets are not accepted implicitly as MFA encryption keys', () => {
    const jwt = 'clinic-access-secret-min-32-characters-xx';
    expect(() =>
      validatePlatformMfaEncryptionKey(jwt, {
        NODE_ENV: 'development',
        JWT_ACCESS_SECRET: jwt,
      }),
    ).toThrow(/must not equal a JWT signing secret/);
  });

  it('deterministic test key is rejected outside NODE_ENV=test', () => {
    expect(() =>
      validatePlatformMfaEncryptionKey(TEST_ONLY_PLATFORM_MFA_ENCRYPTION_KEY, {
        NODE_ENV: 'development',
      }),
    ).toThrow(/test-only deterministic key/);
  });

  it('valid explicit configuration starts successfully', () => {
    const cfg = loadPlatformSecurityConfig({
      NODE_ENV: 'development',
      PLATFORM_MFA_ENCRYPTION_KEY: validKey,
    });
    expect(cfg.mfaEncryptionKey).toBe(validKey);
    expect(cfg.activityMinIntervalSeconds).toBe(60);
  });

  it('error messages identify the configuration name but never expose key material', () => {
    const secret = 'super-secret-key-material-that-must-not-leak!!';
    try {
      loadPlatformSecurityConfig({
        NODE_ENV: 'production',
        PLATFORM_MFA_ENCRYPTION_KEY: secret.slice(0, 10),
      });
      fail('expected throw');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toContain('PLATFORM_MFA_ENCRYPTION_KEY');
      expect(message).not.toContain(secret);
      expect(message).not.toContain(secret.slice(0, 10));
    }
  });

  it('PLATFORM_DISABLE_MFA outside tests fails startup', () => {
    expect(() =>
      loadPlatformSecurityConfig({
        NODE_ENV: 'development',
        PLATFORM_MFA_ENCRYPTION_KEY: validKey,
        PLATFORM_DISABLE_MFA: 'true',
      }),
    ).toThrow(/PLATFORM_DISABLE_MFA is not supported outside NODE_ENV=test/);

    expect(() =>
      loadPlatformSecurityConfig({
        NODE_ENV: 'staging',
        PLATFORM_MFA_ENCRYPTION_KEY: validKey,
        PLATFORM_DISABLE_MFA: 'false',
      }),
    ).toThrow(/PLATFORM_DISABLE_MFA/);

    expect(() =>
      loadPlatformSecurityConfig({
        NODE_ENV: 'production',
        PLATFORM_MFA_ENCRYPTION_KEY: validKey,
        PLATFORM_DISABLE_MFA: '1',
      }),
    ).toThrow(/PLATFORM_DISABLE_MFA/);
  });

  it('PLATFORM_DISABLE_MFA present under NODE_ENV=test does not disable MFA configuration loading', () => {
    const cfg = loadPlatformSecurityConfig({
      NODE_ENV: 'test',
      PLATFORM_DISABLE_MFA: 'true',
    });
    expect(cfg.mfaEncryptionKey).toBe(TEST_ONLY_PLATFORM_MFA_ENCRYPTION_KEY);
    // Config no longer exposes a disable flag — handlers always require MFA.
    expect(cfg).not.toHaveProperty('mfaDisabledForTesting');
  });
});

import {
  assertSafePlatformTestDatabaseUrl,
  platformDbSecurityEnabled,
} from './platform-db-security.harness';

describe('platform DB security harness safety', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it('rejects production-like database names and remote hosts', () => {
    process.env.ALLOW_TEST_DATABASE_RESET = 'true';
    process.env.RUN_PLATFORM_DB_SECURITY = 'true';
    expect(() =>
      assertSafePlatformTestDatabaseUrl('postgresql://u:p@localhost:5432/saas_emr'),
    ).toThrow(/unsafe database name/i);
    expect(() =>
      assertSafePlatformTestDatabaseUrl('postgresql://u:p@db.prod.example:5432/booking_test'),
    ).toThrow(/non-local/i);
  });

  it('requires explicit reset and run flags', () => {
    delete process.env.ALLOW_TEST_DATABASE_RESET;
    process.env.RUN_PLATFORM_DB_SECURITY = 'true';
    expect(() =>
      assertSafePlatformTestDatabaseUrl('postgresql://booking:booking_test@localhost:5433/booking_test'),
    ).toThrow(/ALLOW_TEST_DATABASE_RESET/);
  });

  it('accepts approved booking_test URL when flags are set', () => {
    process.env.ALLOW_TEST_DATABASE_RESET = 'true';
    process.env.RUN_PLATFORM_DB_SECURITY = 'true';
    expect(
      assertSafePlatformTestDatabaseUrl('postgresql://booking:booking_test@127.0.0.1:5433/booking_test')
        .hostname,
    ).toBe('127.0.0.1');
    expect(platformDbSecurityEnabled()).toBe(true);
  });

  it('is disabled unless RUN_PLATFORM_DB_SECURITY or RUN_INTEGRATION is set', () => {
    delete process.env.RUN_PLATFORM_DB_SECURITY;
    delete process.env.RUN_INTEGRATION;
    expect(platformDbSecurityEnabled()).toBe(false);
  });
});

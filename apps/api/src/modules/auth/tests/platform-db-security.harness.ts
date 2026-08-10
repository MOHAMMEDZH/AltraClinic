/**
 * Safe isolated PostgreSQL harness for Phase 47 Step 08 database-backed security tests.
 *
 * Requires:
 * - docker-compose.test.yml postgres on :5433 (database booking_test)
 * - RUN_PLATFORM_DB_SECURITY=true
 * - ALLOW_TEST_DATABASE_RESET=true
 * - INTEGRATION_DATABASE_URL (or default booking_test URL)
 */
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PasswordHasher } from '../../identity/infrastructure/password-hasher';

export const DEFAULT_PLATFORM_DB_SECURITY_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.PLATFORM_DB_SECURITY_DATABASE_URL ??
  'postgresql://booking:booking_test@localhost:5433/booking_test?schema=public';

const APPROVED_DB_NAMES = new Set(['booking_test']);

export function assertSafePlatformTestDatabaseUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid test database URL.');
  }
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error('Platform DB security tests require PostgreSQL.');
  }
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('/')[0] ?? '');
  const approvedName =
    APPROVED_DB_NAMES.has(dbName) || /_(test|integration)$/i.test(dbName) || /^test_/i.test(dbName);
  if (!approvedName) {
    throw new Error(`Refusing unsafe database name "${dbName}" for platform DB security tests.`);
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1' && host !== 'postgres-test') {
    throw new Error(`Refusing non-local test database host "${host}".`);
  }
  if (process.env.ALLOW_TEST_DATABASE_RESET !== 'true') {
    throw new Error('ALLOW_TEST_DATABASE_RESET=true is required before platform DB security cleanup.');
  }
  if (process.env.RUN_PLATFORM_DB_SECURITY !== 'true' && process.env.RUN_INTEGRATION !== 'true') {
    throw new Error('RUN_PLATFORM_DB_SECURITY=true (or RUN_INTEGRATION=true) is required.');
  }
  return parsed;
}

export function platformDbSecurityEnabled(): boolean {
  return process.env.RUN_PLATFORM_DB_SECURITY === 'true' || process.env.RUN_INTEGRATION === 'true';
}

export function createPlatformDbSecurityClient(url = DEFAULT_PLATFORM_DB_SECURITY_URL): PrismaClient {
  assertSafePlatformTestDatabaseUrl(url);
  const sep = url.includes('?') ? '&' : '?';
  const hardenedUrl = `${url}${sep}connection_limit=25&pool_timeout=60&connect_timeout=30`;
  return new PrismaClient({
    datasources: { db: { url: hardenedUrl } },
    // Integration hosts under load routinely exceed Prisma's 5s default interactive timeout.
    transactionOptions: {
      maxWait: 20_000,
      timeout: 60_000,
    },
  });
}

function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Wait for test Postgres (and reconnect Prisma after transient P1001). */
export async function ensurePlatformTestDbReady(
  prisma?: PrismaClient,
  attempts = 30,
): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    // Do not gate on Docker CLI — Desktop may hang/500 while Postgres TCP remains healthy.
    // Prefer a direct Prisma query (or a throwaway client when none is provided).
    const client =
      prisma ??
      new PrismaClient({
        datasources: {
          db: {
            url:
              process.env.INTEGRATION_DATABASE_URL ||
              'postgresql://booking:booking_test@localhost:5433/booking_test?schema=public',
          },
        },
        log: ['error'],
      });
    const owned = !prisma;
    try {
      await client.$connect();
      await client.$queryRaw`SELECT 1`;
      if (owned) await client.$disconnect();
      return;
    } catch (err) {
      lastErr = err;
      if (owned) {
        try {
          await client.$disconnect();
        } catch {
          /* ignore */
        }
      }
    }
    sleepMs(1000);
  }
  throw lastErr ?? new Error('Platform test Postgres not ready.');
}

export async function withPlatformDbRetry<T>(
  prisma: PrismaClient,
  fn: () => Promise<T>,
  attempts = 5,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await ensurePlatformTestDbReady(prisma, 10);
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string; errorCode?: string })?.code
        ?? (err as { errorCode?: string })?.errorCode;
      const transient =
        code === 'P1001' ||
        code === 'P1017' ||
        /Can't reach database server|Connection reset|ECONNRESET|server closed/i.test(msg);
      if (!transient || i === attempts - 1) throw err;
      sleepMs(1000 * (i + 1));
    }
  }
  throw lastErr;
}

/** Deterministic cleanup of Platform tables only (dependency order). */
export async function cleanupPlatformSecurityTables(
  prisma: PrismaClient,
  url = DEFAULT_PLATFORM_DB_SECURITY_URL,
): Promise<void> {
  assertSafePlatformTestDatabaseUrl(url);
  await withPlatformDbRetry(prisma, async () => {
    // Bound lock waits — TRUNCATE must not hang forever behind orphan backends.
    await prisma.$executeRawUnsafe(`SET lock_timeout = '15000'`);
    await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "platform_mfa_reset_requests",
      "platform_mfa_recovery_codes",
      "platform_user_invitations",
      "platform_user_roles",
      "platform_refresh_tokens",
      "platform_users"
    RESTART IDENTITY CASCADE
  `);
  });
}

export async function createPlatformUserFixture(
  prisma: PrismaClient,
  opts: {
    email: string;
    password?: string;
    status?: string;
    mfaEnabled?: boolean;
    mfaSecretEncrypted?: string | null;
    mfaPendingSecretEncrypted?: string | null;
    roleKeys?: string[];
  },
) {
  const passwordHash = await PasswordHasher.hash(opts.password ?? randomBytes(16).toString('hex'));
  const user = await prisma.platformUser.create({
    data: {
      email: opts.email.toLowerCase(),
      passwordHash,
      status: opts.status ?? 'active',
      isActive: (opts.status ?? 'active') !== 'suspended',
      mfaEnabled: opts.mfaEnabled ?? false,
      mfaSecretEncrypted: opts.mfaSecretEncrypted ?? null,
      mfaPendingSecretEncrypted: opts.mfaPendingSecretEncrypted ?? null,
      mfaPendingExpiresAt: opts.mfaPendingSecretEncrypted ? new Date(Date.now() + 60_000) : null,
      mfaConfirmedAt: opts.mfaEnabled ? new Date() : null,
    },
  });
  for (const roleKey of opts.roleKeys ?? []) {
    await prisma.platformUserRole.create({
      data: { platformUserId: user.id, roleKey },
    });
  }
  return user;
}

export async function createPlatformRefreshSession(
  prisma: PrismaClient,
  platformUserId: string,
  opts: { sessionId?: string; familyId?: string; stepUpVerifiedAt?: Date | null } = {},
) {
  const now = new Date();
  return prisma.platformRefreshToken.create({
    data: {
      platformUserId,
      tokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
      sessionId: opts.sessionId ?? randomUUID(),
      familyId: opts.familyId ?? randomUUID(),
      expiresAt: new Date(now.getTime() + 7 * 24 * 3600_000),
      absoluteExpiresAt: new Date(now.getTime() + 12 * 3600_000),
      lastActivityAt: now,
      mfaCompletedAt: now,
      assuranceLevel: 'mfa',
      stepUpVerifiedAt: opts.stepUpVerifiedAt === undefined ? now : opts.stepUpVerifiedAt,
      authMethod: 'totp',
      userAgent: 'Mozilla/5.0 TestAgent',
      ipAddress: '127.0.0.1',
    },
  });
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

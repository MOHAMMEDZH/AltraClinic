/**
 * Atomic Platform Owner bootstrap used by the CLI and database-backed tests.
 * Uses a PostgreSQL transaction advisory lock so concurrent bootstrap attempts
 * cannot create multiple initial owners.
 */
import bcrypt from 'bcryptjs';

/** Stable lock key for platform bootstrap (namespace 47 / step 08). */
export const PLATFORM_BOOTSTRAP_ADVISORY_LOCK_KEY = 470_008_001;

export class PlatformBootstrapConflictError extends Error {
  constructor(message = 'Platform users already exist; bootstrap refused.') {
    super(message);
    this.name = 'PlatformBootstrapConflictError';
  }
}

export async function bootstrapPlatformOwnerAtomic(
  prisma: any,
  input: { email: string; passwordHash: string },
  opts: { failAfterUserCreate?: boolean } = {},
): Promise<{ id: string; email: string }> {
  return prisma.$transaction(
    async (tx: any) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PLATFORM_BOOTSTRAP_ADVISORY_LOCK_KEY})`;
      const existing = await tx.platformUser.count();
      if (existing > 0) {
        throw new PlatformBootstrapConflictError();
      }
      const user = await tx.platformUser.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          status: 'active',
          isActive: true,
          mfaEnabled: false,
        },
      });
      if (opts.failAfterUserCreate) {
        throw new Error('Injected bootstrap failure after user create.');
      }
      await tx.platformUserRole.create({
        data: { platformUserId: user.id, roleKey: 'platform_owner' },
      });
      return { id: user.id, email: user.email };
    },
    { timeout: 30_000 },
  );
}

export async function hashBootstrapPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

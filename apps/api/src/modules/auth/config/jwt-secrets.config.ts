/**
 * Phase 49 K2 — minimal JWT signing-secret fail-closed helpers.
 *
 * Not a ConfigModule rewrite. Rejects known placeholders and equal access/refresh
 * material the same way PLATFORM_MFA_ENCRYPTION_KEY already rejects placeholders.
 */

const KNOWN_JWT_PLACEHOLDERS = new Set(
  [
    '',
    'change-me',
    'changeme',
    'secret',
    'password',
    'todo',
    'xxx',
    'replace-me',
    'your-key-here',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    // Values historically shown in apps/api/.env.example (must not boot).
    'change-this-access-secret-min-32-chars-use-crypto-random',
    'change-this-refresh-secret-min-32-chars-different-from-access',
  ].map((s) => s.toLowerCase()),
);

export interface JwtSigningSecrets {
  accessSecret: string;
  refreshSecret: string;
}

function isPlaceholder(value: string): boolean {
  return KNOWN_JWT_PLACEHOLDERS.has(value.trim().toLowerCase());
}

/**
 * Validate clinic JWT signing secrets (access + refresh).
 * Throws with config names only — never echoes secret material.
 */
export function validateJwtSigningSecrets(
  accessSecret: string | undefined,
  refreshSecret: string | undefined,
): JwtSigningSecrets {
  const access = (accessSecret ?? '').trim();
  const refresh = (refreshSecret ?? '').trim();

  if (!access || access.length < 32) {
    throw new Error(
      'JWT_ACCESS_SECRET must be at least 32 characters. Set it in your .env file.',
    );
  }
  if (!refresh || refresh.length < 32) {
    throw new Error(
      'JWT_REFRESH_SECRET must be at least 32 characters. Set it in your .env file.',
    );
  }
  if (isPlaceholder(access)) {
    throw new Error(
      'JWT_ACCESS_SECRET must not be a known placeholder value. Generate a random secret.',
    );
  }
  if (isPlaceholder(refresh)) {
    throw new Error(
      'JWT_REFRESH_SECRET must not be a known placeholder value. Generate a random secret.',
    );
  }
  if (access === refresh) {
    throw new Error(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different. Generate two independent secrets.',
    );
  }

  return { accessSecret: access, refreshSecret: refresh };
}

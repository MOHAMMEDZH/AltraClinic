/**
 * Phase 47 Step 07 correction — Platform MFA + session security configuration.
 *
 * - MFA encryption key: deterministic fallback ONLY when NODE_ENV=test.
 * - All other environments require an explicit PLATFORM_MFA_ENCRYPTION_KEY.
 * - PLATFORM_DISABLE_MFA is rejected outside NODE_ENV=test (and unused in handlers).
 */

export const TEST_ONLY_PLATFORM_MFA_ENCRYPTION_KEY =
  'test-only-platform-mfa-encryption-key-32b';

const KNOWN_PLACEHOLDERS = new Set([
  '',
  'change-me',
  'changeme',
  'secret',
  'password',
  'PLATFORM_MFA_ENCRYPTION_KEY',
  'your-key-here',
  'replace-me',
  'todo',
  'xxx',
]);

export interface PlatformSecurityConfig {
  mfaEncryptionKey: string;
  mfaIssuer: string;
  mfaEnrollmentTtlSeconds: number;
  mfaChallengeTtlSeconds: number;
  sessionIdleSeconds: number;
  sessionAbsoluteSeconds: number;
  stepUpSeconds: number;
  recoveryCodeCount: number;
  /** Minimum seconds between accepted interactive activity updates (server throttle). */
  activityMinIntervalSeconds: number;
}

function nodeEnv(env: NodeJS.ProcessEnv): string {
  return (env['NODE_ENV'] ?? '').trim().toLowerCase();
}

function isTestEnv(env: NodeJS.ProcessEnv): boolean {
  return nodeEnv(env) === 'test';
}

function isProduction(env: NodeJS.ProcessEnv): boolean {
  return nodeEnv(env) === 'production';
}

function parsePositiveInt(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Validate PLATFORM_MFA_ENCRYPTION_KEY material.
 * Key is hashed with SHA-256 before AES use, so we require sufficient entropy
 * via minimum length rather than raw 32-byte AES key length.
 */
export function validatePlatformMfaEncryptionKey(
  rawKey: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const key = rawKey.trim();
  if (!key) {
    throw new Error(
      'PLATFORM_MFA_ENCRYPTION_KEY is missing or empty. Set an explicit key (min 32 characters).',
    );
  }
  if (KNOWN_PLACEHOLDERS.has(key.toLowerCase())) {
    throw new Error(
      'PLATFORM_MFA_ENCRYPTION_KEY must not be a known placeholder value. Generate a random key.',
    );
  }
  if (key.length < 32) {
    throw new Error(
      'PLATFORM_MFA_ENCRYPTION_KEY must be at least 32 characters.',
    );
  }
  // Reject accidental reuse of JWT signing secrets as MFA keys.
  const jwtAccess = (env['JWT_ACCESS_SECRET'] ?? '').trim();
  const jwtRefresh = (env['JWT_REFRESH_SECRET'] ?? '').trim();
  const jwtPlatformAccess = (env['JWT_PLATFORM_ACCESS_SECRET'] ?? '').trim();
  const jwtPlatformRefresh = (env['JWT_PLATFORM_REFRESH_SECRET'] ?? '').trim();
  if (
    key === jwtAccess ||
    key === jwtRefresh ||
    key === jwtPlatformAccess ||
    key === jwtPlatformRefresh
  ) {
    throw new Error(
      'PLATFORM_MFA_ENCRYPTION_KEY must not equal a JWT signing secret. Use a dedicated key.',
    );
  }
  if (key === TEST_ONLY_PLATFORM_MFA_ENCRYPTION_KEY && !isTestEnv(env)) {
    throw new Error(
      'PLATFORM_MFA_ENCRYPTION_KEY must not use the test-only deterministic key outside NODE_ENV=test.',
    );
  }
  return key;
}

export function loadPlatformSecurityConfig(
  env: NodeJS.ProcessEnv = process.env,
): PlatformSecurityConfig {
  const production = isProduction(env);
  const test = isTestEnv(env);

  const disableMfaRaw = (env['PLATFORM_DISABLE_MFA'] ?? '').trim();
  if (disableMfaRaw !== '' && !test) {
    throw new Error(
      'PLATFORM_DISABLE_MFA is not supported outside NODE_ENV=test. Remove it from the environment.',
    );
  }

  const rawKey = (env['PLATFORM_MFA_ENCRYPTION_KEY'] ?? '').trim();
  let mfaEncryptionKey: string;
  if (!rawKey) {
    if (test) {
      mfaEncryptionKey = TEST_ONLY_PLATFORM_MFA_ENCRYPTION_KEY;
    } else {
      throw new Error(
        'PLATFORM_MFA_ENCRYPTION_KEY is required when NODE_ENV is not test. Set an explicit key in your untracked .env file.',
      );
    }
  } else {
    mfaEncryptionKey = validatePlatformMfaEncryptionKey(rawKey, env);
  }

  const sessionIdleSeconds = parsePositiveInt(env, 'PLATFORM_SESSION_IDLE_SECONDS', 1800);
  const sessionAbsoluteSeconds = parsePositiveInt(
    env,
    'PLATFORM_SESSION_ABSOLUTE_SECONDS',
    43200,
  );

  if (sessionIdleSeconds <= 0 || sessionAbsoluteSeconds <= 0) {
    throw new Error(
      'PLATFORM_SESSION_IDLE_SECONDS and PLATFORM_SESSION_ABSOLUTE_SECONDS must be positive.',
    );
  }
  if (sessionAbsoluteSeconds < sessionIdleSeconds) {
    throw new Error(
      'PLATFORM_SESSION_ABSOLUTE_SECONDS must be greater than or equal to PLATFORM_SESSION_IDLE_SECONDS.',
    );
  }

  // Extra production guard retained for clarity (same rules already above).
  if (production && (!mfaEncryptionKey || mfaEncryptionKey.length < 32)) {
    throw new Error('PLATFORM_MFA_ENCRYPTION_KEY is required in production.');
  }

  return {
    mfaEncryptionKey,
    mfaIssuer: env['PLATFORM_MFA_ISSUER'] ?? 'Booking Platform',
    mfaEnrollmentTtlSeconds: parsePositiveInt(env, 'PLATFORM_MFA_ENROLLMENT_TTL_SECONDS', 900),
    mfaChallengeTtlSeconds: parsePositiveInt(env, 'PLATFORM_MFA_CHALLENGE_TTL_SECONDS', 300),
    sessionIdleSeconds,
    sessionAbsoluteSeconds,
    stepUpSeconds: parsePositiveInt(env, 'PLATFORM_STEP_UP_SECONDS', 300),
    recoveryCodeCount: parsePositiveInt(env, 'PLATFORM_RECOVERY_CODE_COUNT', 10),
    activityMinIntervalSeconds: parsePositiveInt(
      env,
      'PLATFORM_ACTIVITY_MIN_INTERVAL_SECONDS',
      60,
    ),
  };
}

export const PLATFORM_SECURITY_CONFIG = 'PLATFORM_SECURITY_CONFIG';

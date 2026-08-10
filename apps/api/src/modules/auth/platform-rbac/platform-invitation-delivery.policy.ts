/**
 * Explicit invitation delivery environment policy.
 * Process-local development mailbox is denied by default (fail closed).
 */

export type PlatformAppEnvironment =
  | 'test'
  | 'local'
  | 'development'
  | 'qa'
  | 'preview'
  | 'demo'
  | 'uat'
  | 'staging'
  | 'production'
  | 'unknown';

export type PlatformInvitationDeliveryMode = 'dev-mailbox' | 'smtp';

const KNOWN: ReadonlySet<string> = new Set([
  'test',
  'local',
  'development',
  'dev',
  'qa',
  'preview',
  'demo',
  'uat',
  'staging',
  'stage',
  'production',
  'prod',
]);

export function classifyPlatformAppEnvironment(
  appEnv = process.env.APP_ENV,
  nodeEnv = process.env.NODE_ENV,
): PlatformAppEnvironment {
  const raw = (appEnv ?? nodeEnv ?? '').trim().toLowerCase();
  if (!raw) return 'unknown';
  if (!KNOWN.has(raw) && raw !== 'dev' && raw !== 'prod' && raw !== 'stage') return 'unknown';
  if (raw === 'dev') return 'development';
  if (raw === 'prod') return 'production';
  if (raw === 'stage') return 'staging';
  return raw as PlatformAppEnvironment;
}

export function resolveInvitationDeliveryMode(
  env: NodeJS.ProcessEnv = process.env,
): PlatformInvitationDeliveryMode {
  const explicit = (env.PLATFORM_INVITATION_DELIVERY_MODE ?? '').trim().toLowerCase();
  if (explicit === 'dev-mailbox' || explicit === 'smtp') return explicit;
  if (explicit) {
    throw new Error(`Unknown PLATFORM_INVITATION_DELIVERY_MODE: ${explicit}`);
  }
  // Default: automated tests may use mailbox; everything else requires smtp.
  if ((env.NODE_ENV ?? '').toLowerCase() === 'test') return 'dev-mailbox';
  return 'smtp';
}

export function isDevInvitationMailboxAllowed(
  env: NodeJS.ProcessEnv = process.env,
): { allowed: boolean; reason: string } {
  const appEnv = classifyPlatformAppEnvironment(env.APP_ENV, env.NODE_ENV);
  let mode: PlatformInvitationDeliveryMode;
  try {
    mode = resolveInvitationDeliveryMode(env);
  } catch (err) {
    return { allowed: false, reason: err instanceof Error ? err.message : 'Unknown delivery mode.' };
  }

  if (mode !== 'dev-mailbox') {
    return { allowed: false, reason: `Delivery mode is ${mode}; development mailbox is not selected.` };
  }

  if ((env.NODE_ENV ?? '').toLowerCase() === 'test') {
    return { allowed: true, reason: 'NODE_ENV=test allows process-local mailbox.' };
  }

  if (appEnv === 'unknown') {
    return { allowed: false, reason: 'Unknown application environment; development mailbox denied.' };
  }

  if (appEnv === 'local' || appEnv === 'development') {
    if (env.PLATFORM_ALLOW_DEV_INVITATION_MAILBOX === 'true') {
      return { allowed: true, reason: 'Explicit local development mailbox allow flag is set.' };
    }
    return {
      allowed: false,
      reason: 'Local development requires PLATFORM_ALLOW_DEV_INVITATION_MAILBOX=true.',
    };
  }

  return {
    allowed: false,
    reason: `Environment "${appEnv}" rejects the development invitation mailbox.`,
  };
}

export function assertDevInvitationMailboxAllowed(env: NodeJS.ProcessEnv = process.env): void {
  const decision = isDevInvitationMailboxAllowed(env);
  if (!decision.allowed) {
    throw new Error(decision.reason);
  }
}

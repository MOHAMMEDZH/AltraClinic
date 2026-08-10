import {
  assertDevInvitationMailboxAllowed,
  classifyPlatformAppEnvironment,
  isDevInvitationMailboxAllowed,
  resolveInvitationDeliveryMode,
} from '../platform-rbac/platform-invitation-delivery.policy';

describe('platform invitation mailbox environment policy', () => {
  const base = { ...process.env };

  afterEach(() => {
    process.env = { ...base };
  });

  it('allows mailbox in NODE_ENV=test', () => {
    const env = { NODE_ENV: 'test' } as NodeJS.ProcessEnv;
    expect(isDevInvitationMailboxAllowed(env).allowed).toBe(true);
    expect(() => assertDevInvitationMailboxAllowed(env)).not.toThrow();
  });

  it('allows local development only with explicit flag', () => {
    expect(
      isDevInvitationMailboxAllowed({
        NODE_ENV: 'development',
        APP_ENV: 'local',
        PLATFORM_INVITATION_DELIVERY_MODE: 'dev-mailbox',
      } as NodeJS.ProcessEnv).allowed,
    ).toBe(false);

    expect(
      isDevInvitationMailboxAllowed({
        NODE_ENV: 'development',
        APP_ENV: 'development',
        PLATFORM_INVITATION_DELIVERY_MODE: 'dev-mailbox',
        PLATFORM_ALLOW_DEV_INVITATION_MAILBOX: 'true',
      } as NodeJS.ProcessEnv).allowed,
    ).toBe(true);
  });

  it.each(['qa', 'preview', 'demo', 'uat', 'staging', 'production'])(
    'rejects development mailbox in %s',
    (appEnv) => {
      const decision = isDevInvitationMailboxAllowed({
        NODE_ENV: 'production',
        APP_ENV: appEnv,
        PLATFORM_INVITATION_DELIVERY_MODE: 'dev-mailbox',
        PLATFORM_ALLOW_DEV_INVITATION_MAILBOX: 'true',
      } as NodeJS.ProcessEnv);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).not.toMatch(/token=|activate\?/i);
    },
  );

  it('fails closed for unknown environment and unknown mode', () => {
    expect(classifyPlatformAppEnvironment('weird-cloud', 'weird-cloud')).toBe('unknown');
    expect(
      isDevInvitationMailboxAllowed({
        NODE_ENV: 'weird-cloud',
        APP_ENV: 'weird-cloud',
        PLATFORM_INVITATION_DELIVERY_MODE: 'dev-mailbox',
      } as NodeJS.ProcessEnv).allowed,
    ).toBe(false);

    expect(() =>
      resolveInvitationDeliveryMode({ PLATFORM_INVITATION_DELIVERY_MODE: 'console' } as NodeJS.ProcessEnv),
    ).toThrow(/Unknown PLATFORM_INVITATION_DELIVERY_MODE/);
  });

  it('defaults non-test environments to smtp and has no console mode', () => {
    expect(resolveInvitationDeliveryMode({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe('smtp');
    expect(resolveInvitationDeliveryMode({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBe('dev-mailbox');
  });

  it('missing environment classification fails safely for mailbox', () => {
    const decision = isDevInvitationMailboxAllowed({
      PLATFORM_INVITATION_DELIVERY_MODE: 'dev-mailbox',
    } as NodeJS.ProcessEnv);
    expect(decision.allowed).toBe(false);
  });
});

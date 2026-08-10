import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class UserLoggedInEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly sessionId: string,
    public readonly ipAddress: string,
    public readonly deviceName: string | null,
  ) { super(); }
}

export class UserLoggedOutEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly sessionId: string,
  ) { super(); }
}

export class LoginFailedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string | null,
    public readonly email: string,
    public readonly ipAddress: string,
    public readonly reason: string,
    public readonly failedCount: number,
  ) { super(); }
}

export class SuspiciousLoginEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly ipAddress: string,
    public readonly reason: string,
  ) { super(); }
}

export class PasswordResetRequestedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly email: string,
  ) { super(); }
}

export class PasswordChangedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
  ) { super(); }
}

/** Phase 47 Step 06 — platform authentication audit events (no secrets/tokens). */
export class PlatformLoginSucceededEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
    public readonly sessionId: string,
    public readonly ipAddress: string,
  ) { super(); }
}

export class PlatformLoginFailedEvent extends BaseDomainEvent {
  constructor(
    public readonly emailHashHint: string,
    public readonly ipAddress: string,
    public readonly reason: string,
    public readonly failedCount: number,
  ) { super(); }
}

export class PlatformAccountLockedEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
    public readonly ipAddress: string,
  ) { super(); }
}

export class PlatformRefreshSucceededEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
    public readonly sessionId: string,
  ) { super(); }
}

export class PlatformRefreshFailedEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string | null,
    public readonly reason: string,
  ) { super(); }
}

export class PlatformRefreshReuseDetectedEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
    public readonly familyId: string,
  ) { super(); }
}

export class PlatformLogoutEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
    public readonly sessionId: string,
  ) { super(); }
}

export class PlatformAccessDeniedEvent extends BaseDomainEvent {
  constructor(
    public readonly reason: string,
    public readonly attemptedPrincipal: string,
  ) { super(); }
}

/** Phase 47 Step 07 — platform MFA + session security events. Payloads never carry secrets/tokens. */
export class PlatformPasswordVerifiedEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
    public readonly requiresEnrollment: boolean,
  ) { super(); }
}

export class PlatformMfaEnrollmentStartedEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
  ) { super(); }
}

export class PlatformMfaEnrollmentConfirmedEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
  ) { super(); }
}

export class PlatformMfaChallengeFailedEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
    public readonly reason: string,
    public readonly failedCount: number,
  ) { super(); }
}

export class PlatformMfaChallengeSucceededEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
    public readonly sessionId: string,
    public readonly authMethod: 'totp' | 'recovery',
  ) { super(); }
}

export class PlatformMfaRecoveryCodeUsedEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
    public readonly remaining: number,
  ) { super(); }
}

export class PlatformMfaRecoveryCodesRegeneratedEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
  ) { super(); }
}

export class PlatformMfaReplaceStartedEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
  ) { super(); }
}

export class PlatformMfaReplaceConfirmedEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
  ) { super(); }
}

export class PlatformSessionIdleExpiredEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
    public readonly sessionId: string,
  ) { super(); }
}

export class PlatformSessionAbsoluteExpiredEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
    public readonly sessionId: string,
  ) { super(); }
}

export class PlatformSessionRevokedEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
    public readonly sessionId: string,
    public readonly reason: string,
  ) { super(); }
}

export class PlatformSessionsRevokedBulkEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
    public readonly reason: string,
    public readonly count: number,
  ) { super(); }
}

export class PlatformStepUpVerifiedEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
    public readonly sessionId: string,
  ) { super(); }
}

export class PlatformStepUpFailedEvent extends BaseDomainEvent {
  constructor(
    public readonly platformUserId: string,
    public readonly sessionId: string,
  ) { super(); }
}

/** Phase 47 Step 08 — platform RBAC audit events; never carry raw secrets or tokens. */
export class PlatformInvitationCreatedEvent extends BaseDomainEvent {
  constructor(public readonly platformUserId: string, public readonly invitedById: string) { super(); }
}
export class PlatformUserSuspendedEvent extends BaseDomainEvent {
  constructor(public readonly platformUserId: string, public readonly suspendedById: string) { super(); }
}
export class PlatformRoleChangedEvent extends BaseDomainEvent {
  constructor(public readonly platformUserId: string, public readonly actorId: string, public readonly roleKey: string, public readonly action: 'assigned' | 'removed') { super(); }
}
export class PlatformMfaResetDecidedEvent extends BaseDomainEvent {
  constructor(public readonly requestId: string, public readonly targetUserId: string, public readonly approverId: string, public readonly approved: boolean) { super(); }
}
export class PlatformOwnerBootstrappedEvent extends BaseDomainEvent {
  constructor(public readonly platformUserId: string) { super(); }
}

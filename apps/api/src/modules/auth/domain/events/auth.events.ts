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

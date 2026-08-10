import { randomUUID } from 'crypto';

export type LoginFailReason =
  | 'invalid_credentials'
  | 'account_locked'
  | 'account_inactive'
  | 'tenant_not_found'
  | 'email_not_verified';

export interface LoginAttemptProps {
  id: string;
  email: string;
  tenantId: string | null;
  ipAddress: string;
  userAgent: string | null;
  success: boolean;
  failReason: LoginFailReason | null;
  attemptedAt: Date;
}

export class LoginAttempt {
  public readonly id: string;
  public readonly email: string;
  public readonly tenantId: string | null;
  public readonly ipAddress: string;
  public readonly userAgent: string | null;
  public readonly success: boolean;
  public readonly failReason: LoginFailReason | null;
  public readonly attemptedAt: Date;

  private constructor(props: LoginAttemptProps) {
    this.id = props.id;
    this.email = props.email;
    this.tenantId = props.tenantId;
    this.ipAddress = props.ipAddress;
    this.userAgent = props.userAgent;
    this.success = props.success;
    this.failReason = props.failReason;
    this.attemptedAt = props.attemptedAt;
  }

  static recordSuccess(input: {
    email: string;
    tenantId: string | null;
    ipAddress: string;
    userAgent: string | null;
  }): LoginAttempt {
    return new LoginAttempt({
      id: randomUUID(),
      email: input.email,
      tenantId: input.tenantId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      success: true,
      failReason: null,
      attemptedAt: new Date(),
    });
  }

  static recordFailure(input: {
    email: string;
    tenantId: string | null;
    ipAddress: string;
    userAgent: string | null;
    reason: LoginFailReason;
  }): LoginAttempt {
    return new LoginAttempt({
      id: randomUUID(),
      email: input.email,
      tenantId: input.tenantId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      success: false,
      failReason: input.reason,
      attemptedAt: new Date(),
    });
  }

  static restore(props: LoginAttemptProps): LoginAttempt {
    return new LoginAttempt(props);
  }
}

import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

export interface RefreshTokenProps {
  id: string;
  userId: string;
  tenantId: string;
  tokenHash: string;
  sessionId: string;
  deviceName: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export class RefreshToken {
  public readonly id: string;
  public readonly userId: string;
  public readonly tenantId: string;
  public readonly tokenHash: string;
  public readonly sessionId: string;
  public readonly deviceName: string | null;
  public readonly expiresAt: Date;
  public readonly revokedAt: Date | null;
  public readonly ipAddress: string | null;
  public readonly userAgent: string | null;
  public readonly createdAt: Date;

  private constructor(props: RefreshTokenProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.tenantId = props.tenantId;
    this.tokenHash = props.tokenHash;
    this.sessionId = props.sessionId;
    this.deviceName = props.deviceName;
    this.expiresAt = props.expiresAt;
    this.revokedAt = props.revokedAt;
    this.ipAddress = props.ipAddress;
    this.userAgent = props.userAgent;
    this.createdAt = props.createdAt;
  }

  static create(input: {
    userId: string;
    tenantId: string;
    rawToken: string;
    sessionId: string;
    deviceName: string | null;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }): RefreshToken {
    return new RefreshToken({
      id: randomUUID(),
      userId: input.userId,
      tenantId: input.tenantId,
      tokenHash: RefreshToken.hash(input.rawToken),
      sessionId: input.sessionId,
      deviceName: input.deviceName,
      expiresAt: input.expiresAt,
      revokedAt: null,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      createdAt: new Date(),
    });
  }

  static restore(props: RefreshTokenProps): RefreshToken {
    return new RefreshToken(props);
  }

  static hash(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  isValid(): boolean {
    return !this.isExpired() && !this.isRevoked();
  }

  revoke(): RefreshToken {
    return RefreshToken.restore({ ...this.toProps(), revokedAt: new Date() });
  }

  private toProps(): RefreshTokenProps {
    return {
      id: this.id, userId: this.userId, tenantId: this.tenantId, tokenHash: this.tokenHash,
      sessionId: this.sessionId, deviceName: this.deviceName,
      expiresAt: this.expiresAt, revokedAt: this.revokedAt,
      ipAddress: this.ipAddress, userAgent: this.userAgent, createdAt: this.createdAt,
    };
  }
}

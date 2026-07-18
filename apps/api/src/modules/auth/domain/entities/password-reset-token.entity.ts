import { randomUUID, createHash, randomBytes } from 'crypto';

export interface PasswordResetTokenProps {
  id: string;
  userId: string;
  tenantId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  ipAddress: string | null;
  createdAt: Date;
}

export class PasswordResetToken {
  public readonly id: string;
  public readonly userId: string;
  public readonly tenantId: string;
  public readonly tokenHash: string;
  public readonly expiresAt: Date;
  public readonly usedAt: Date | null;
  public readonly ipAddress: string | null;
  public readonly createdAt: Date;

  private constructor(props: PasswordResetTokenProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.tenantId = props.tenantId;
    this.tokenHash = props.tokenHash;
    this.expiresAt = props.expiresAt;
    this.usedAt = props.usedAt;
    this.ipAddress = props.ipAddress;
    this.createdAt = props.createdAt;
  }

  /** Returns [entity, rawToken]. rawToken is emailed — never persisted. */
  static generate(input: {
    userId: string;
    tenantId: string;
    ipAddress: string | null;
    ttlMinutes?: number;
  }): [PasswordResetToken, string] {
    const raw = randomBytes(32).toString('hex');
    const token = new PasswordResetToken({
      id: randomUUID(),
      userId: input.userId,
      tenantId: input.tenantId,
      tokenHash: createHash('sha256').update(raw).digest('hex'),
      expiresAt: new Date(Date.now() + (input.ttlMinutes ?? 30) * 60_000),
      usedAt: null,
      ipAddress: input.ipAddress,
      createdAt: new Date(),
    });
    return [token, raw];
  }

  static restore(props: PasswordResetTokenProps): PasswordResetToken {
    return new PasswordResetToken(props);
  }

  static hashRaw(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  isUsed(): boolean {
    return this.usedAt !== null;
  }

  isValid(): boolean {
    return !this.isExpired() && !this.isUsed();
  }

  markUsed(): PasswordResetToken {
    return PasswordResetToken.restore({ ...this, usedAt: new Date() });
  }
}

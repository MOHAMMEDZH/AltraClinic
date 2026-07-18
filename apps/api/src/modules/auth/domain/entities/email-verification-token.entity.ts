import { randomUUID, createHash, randomBytes } from 'crypto';

export interface EmailVerificationTokenProps {
  id: string;
  userId: string;
  tenantId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export class EmailVerificationToken {
  public readonly id: string;
  public readonly userId: string;
  public readonly tenantId: string;
  public readonly tokenHash: string;
  public readonly expiresAt: Date;
  public readonly usedAt: Date | null;
  public readonly createdAt: Date;

  private constructor(props: EmailVerificationTokenProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.tenantId = props.tenantId;
    this.tokenHash = props.tokenHash;
    this.expiresAt = props.expiresAt;
    this.usedAt = props.usedAt;
    this.createdAt = props.createdAt;
  }

  static generate(input: { userId: string; tenantId: string; ttlHours?: number }): [EmailVerificationToken, string] {
    const raw = randomBytes(32).toString('hex');
    const token = new EmailVerificationToken({
      id: randomUUID(),
      userId: input.userId,
      tenantId: input.tenantId,
      tokenHash: createHash('sha256').update(raw).digest('hex'),
      expiresAt: new Date(Date.now() + (input.ttlHours ?? 24) * 3_600_000),
      usedAt: null,
      createdAt: new Date(),
    });
    return [token, raw];
  }

  static restore(props: EmailVerificationTokenProps): EmailVerificationToken {
    return new EmailVerificationToken(props);
  }

  static hashRaw(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  isValid(): boolean {
    return this.usedAt === null && !this.isExpired();
  }

  markUsed(): EmailVerificationToken {
    return EmailVerificationToken.restore({ ...this, usedAt: new Date() });
  }
}

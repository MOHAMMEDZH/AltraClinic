import { createHash, randomBytes, randomUUID } from 'crypto';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface MfaBackupCodeProps {
  id: string;
  userId: string;
  tenantId: string;
  codeHash: string;
  usedAt: Date | null;
  createdAt: Date;
}

export class MfaBackupCode {
  public readonly id: string;
  public readonly userId: string;
  public readonly tenantId: string;
  public readonly codeHash: string;
  public readonly usedAt: Date | null;
  public readonly createdAt: Date;

  private constructor(props: MfaBackupCodeProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.tenantId = props.tenantId;
    this.codeHash = props.codeHash;
    this.usedAt = props.usedAt;
    this.createdAt = props.createdAt;
  }

  static restore(props: MfaBackupCodeProps): MfaBackupCode {
    return new MfaBackupCode(props);
  }

  static hashRaw(raw: string): string {
    return createHash('sha256').update(MfaBackupCode.normalize(raw)).digest('hex');
  }

  static normalize(raw: string): string {
    return raw.replace(/[\s-]/g, '').toUpperCase();
  }

  static formatDisplay(raw: string): string {
    const normalized = MfaBackupCode.normalize(raw);
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
  }

  private static generateRaw(): string {
    let raw = '';
    const bytes = randomBytes(8);
    for (let i = 0; i < 8; i++) {
      raw += CHARSET[bytes[i]! % CHARSET.length];
    }
    return raw;
  }

  /** Returns [entities, rawCodes] — raw codes are shown once to the user. */
  static generateBatch(input: {
    userId: string;
    tenantId: string;
    count?: number;
  }): [MfaBackupCode[], string[]] {
    const count = input.count ?? 10;
    const now = new Date();
    const entities: MfaBackupCode[] = [];
    const rawCodes: string[] = [];

    for (let i = 0; i < count; i++) {
      const raw = MfaBackupCode.generateRaw();
      rawCodes.push(MfaBackupCode.formatDisplay(raw));
      entities.push(
        new MfaBackupCode({
          id: randomUUID(),
          userId: input.userId,
          tenantId: input.tenantId,
          codeHash: MfaBackupCode.hashRaw(raw),
          usedAt: null,
          createdAt: now,
        }),
      );
    }

    return [entities, rawCodes];
  }

  isUsed(): boolean {
    return this.usedAt !== null;
  }

  markUsed(): MfaBackupCode {
    return MfaBackupCode.restore({ ...this, usedAt: new Date() });
  }
}

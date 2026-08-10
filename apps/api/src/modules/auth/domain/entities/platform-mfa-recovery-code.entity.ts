import { createHash, randomBytes, randomUUID } from 'crypto';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface PlatformMfaRecoveryCodeProps {
  id: string;
  platformUserId: string;
  codeHash: string;
  usedAt: Date | null;
  createdAt: Date;
}

/** One-time platform MFA recovery codes — SHA-256 hash only, never stored raw. */
export class PlatformMfaRecoveryCode {
  public readonly id: string;
  public readonly platformUserId: string;
  public readonly codeHash: string;
  public readonly usedAt: Date | null;
  public readonly createdAt: Date;

  private constructor(props: PlatformMfaRecoveryCodeProps) {
    this.id = props.id;
    this.platformUserId = props.platformUserId;
    this.codeHash = props.codeHash;
    this.usedAt = props.usedAt;
    this.createdAt = props.createdAt;
  }

  static restore(props: PlatformMfaRecoveryCodeProps): PlatformMfaRecoveryCode {
    return new PlatformMfaRecoveryCode(props);
  }

  static hashRaw(raw: string): string {
    return createHash('sha256').update(PlatformMfaRecoveryCode.normalize(raw)).digest('hex');
  }

  static normalize(raw: string): string {
    return raw.replace(/[\s-]/g, '').toUpperCase();
  }

  static formatDisplay(raw: string): string {
    const normalized = PlatformMfaRecoveryCode.normalize(raw);
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
  }

  static looksLikeRecoveryCode(code: string): boolean {
    const normalized = PlatformMfaRecoveryCode.normalize(code);
    return normalized.length === 8 && !/^\d{6}$/.test(code.replace(/\s/g, ''));
  }

  private static generateRaw(): string {
    let raw = '';
    const bytes = randomBytes(8);
    for (let i = 0; i < 8; i++) {
      raw += CHARSET[bytes[i]! % CHARSET.length];
    }
    return raw;
  }

  /** Returns [entities, rawCodes] — raw codes are shown to the operator exactly once. */
  static generateBatch(input: {
    platformUserId: string;
    count: number;
  }): [PlatformMfaRecoveryCode[], string[]] {
    const now = new Date();
    const entities: PlatformMfaRecoveryCode[] = [];
    const rawCodes: string[] = [];

    for (let i = 0; i < input.count; i++) {
      const raw = PlatformMfaRecoveryCode.generateRaw();
      rawCodes.push(PlatformMfaRecoveryCode.formatDisplay(raw));
      entities.push(
        new PlatformMfaRecoveryCode({
          id: randomUUID(),
          platformUserId: input.platformUserId,
          codeHash: PlatformMfaRecoveryCode.hashRaw(raw),
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

  markUsed(): PlatformMfaRecoveryCode {
    return PlatformMfaRecoveryCode.restore({ ...this, usedAt: new Date() });
  }
}

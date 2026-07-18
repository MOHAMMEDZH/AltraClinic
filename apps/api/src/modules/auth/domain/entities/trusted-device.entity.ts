import { createHash, randomBytes, randomUUID } from 'crypto';

export const TRUSTED_DEVICE_TTL_DAYS = 30;

export interface TrustedDeviceProps {
  id: string;
  userId: string;
  tenantId: string;
  tokenHash: string;
  deviceName: string | null;
  expiresAt: Date;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export class TrustedDevice {
  public readonly id: string;
  public readonly userId: string;
  public readonly tenantId: string;
  public readonly tokenHash: string;
  public readonly deviceName: string | null;
  public readonly expiresAt: Date;
  public readonly lastUsedAt: Date | null;
  public readonly createdAt: Date;

  private constructor(props: TrustedDeviceProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.tenantId = props.tenantId;
    this.tokenHash = props.tokenHash;
    this.deviceName = props.deviceName;
    this.expiresAt = props.expiresAt;
    this.lastUsedAt = props.lastUsedAt;
    this.createdAt = props.createdAt;
  }

  static restore(props: TrustedDeviceProps): TrustedDevice {
    return new TrustedDevice(props);
  }

  static hashRaw(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Returns [entity, rawToken]. Raw token is returned to the client once. */
  static generate(input: {
    userId: string;
    tenantId: string;
    deviceName: string | null;
    ttlDays?: number;
  }): [TrustedDevice, string] {
    const raw = randomBytes(32).toString('hex');
    const entity = new TrustedDevice({
      id: randomUUID(),
      userId: input.userId,
      tenantId: input.tenantId,
      tokenHash: TrustedDevice.hashRaw(raw),
      deviceName: input.deviceName,
      expiresAt: new Date(Date.now() + (input.ttlDays ?? TRUSTED_DEVICE_TTL_DAYS) * 86_400_000),
      lastUsedAt: null,
      createdAt: new Date(),
    });
    return [entity, raw];
  }

  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  isValid(): boolean {
    return !this.isExpired();
  }

  touch(): TrustedDevice {
    return TrustedDevice.restore({ ...this, lastUsedAt: new Date() });
  }
}

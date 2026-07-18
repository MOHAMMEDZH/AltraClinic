import { TrustedDevice } from '../entities/trusted-device.entity';

export interface TrustedDeviceRepository {
  save(device: TrustedDevice): Promise<void>;
  findValidByTokenHash(hash: string, userId: string, tenantId: string): Promise<TrustedDevice | null>;
  deleteAllForUser(userId: string, tenantId: string): Promise<void>;
}

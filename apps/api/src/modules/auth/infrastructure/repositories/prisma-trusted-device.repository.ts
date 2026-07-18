import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TrustedDevice } from '../../domain/entities/trusted-device.entity';
import { TrustedDeviceRepository } from '../../domain/repositories/trusted-device.repository.interface';

@Injectable()
export class PrismaTrustedDeviceRepository implements TrustedDeviceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(device: TrustedDevice): Promise<void> {
    await this.prisma.trustedDevice.upsert({
      where: { id: device.id },
      create: {
        id: device.id,
        userId: device.userId,
        tenantId: device.tenantId,
        tokenHash: device.tokenHash,
        deviceName: device.deviceName,
        expiresAt: device.expiresAt,
        lastUsedAt: device.lastUsedAt,
        createdAt: device.createdAt,
      },
      update: {
        lastUsedAt: device.lastUsedAt,
        expiresAt: device.expiresAt,
      },
    });
  }

  async findValidByTokenHash(
    hash: string,
    userId: string,
    tenantId: string,
  ): Promise<TrustedDevice | null> {
    const row = await this.prisma.trustedDevice.findFirst({
      where: {
        tokenHash: hash,
        userId,
        tenantId,
        expiresAt: { gt: new Date() },
      },
    });
    return row ? this.toDomain(row) : null;
  }

  async deleteAllForUser(userId: string, tenantId: string): Promise<void> {
    await this.prisma.trustedDevice.deleteMany({ where: { userId, tenantId } });
  }

  private toDomain(row: {
    id: string;
    userId: string;
    tenantId: string;
    tokenHash: string;
    deviceName: string | null;
    expiresAt: Date;
    lastUsedAt: Date | null;
    createdAt: Date;
  }): TrustedDevice {
    return TrustedDevice.restore({
      id: row.id,
      userId: row.userId,
      tenantId: row.tenantId,
      tokenHash: row.tokenHash,
      deviceName: row.deviceName,
      expiresAt: row.expiresAt,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
    });
  }
}

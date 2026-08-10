import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Tenant } from '../domain/tenant.entity';
import { TenantRepository } from '../domain/tenant.repository.interface';
import { TenantSettingsVO } from '../domain/tenant-settings.vo';
import { TenantDomainVO } from '../domain/tenant-domain.vo';
import {
  assertNotPlatformAuditSentinelTenantId,
} from '../../platform-tenants/platform-tenants.tokens';

@Injectable()
export class PrismaTenantRepository implements TenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(tenant: Tenant): Promise<void> {
    assertNotPlatformAuditSentinelTenantId(tenant.id, 'PrismaTenantRepository.save');
    await this.prisma.tenant.upsert({
      where: { id: tenant.id },
      create: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.id,
        customDomain: tenant.domain?.value ?? null,
        timezone: tenant.settings.timezone,
        locale: tenant.settings.locale,
        dataRetentionDays: tenant.settings.dataRetentionDays ?? 365,
        features: tenant.settings.features as Record<string, boolean>,
        createdAt: tenant.createdAt,
      },
      update: {
        name: tenant.name,
        customDomain: tenant.domain?.value ?? null,
        timezone: tenant.settings.timezone,
        locale: tenant.settings.locale,
        dataRetentionDays: tenant.settings.dataRetentionDays ?? 365,
        features: tenant.settings.features as Record<string, boolean>,
        updatedAt: tenant.updatedAt ?? new Date(),
      },
    });
  }

  async findById(id: string): Promise<Tenant | null> {
    const row = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByDomain(domain: string): Promise<Tenant | null> {
    const row = await this.prisma.tenant.findFirst({
      where: { customDomain: domain.trim().toLowerCase(), deletedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: {
    id: string;
    name: string;
    customDomain: string | null;
    timezone: string;
    locale: string;
    dataRetentionDays: number;
    features: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): Tenant {
    const features = (row.features as Record<string, boolean> | null) ?? {};
    const tenantSettings = new TenantSettingsVO(
      row.timezone ?? 'UTC',
      row.locale ?? 'en-US',
      row.dataRetentionDays ?? 365,
      features,
    );

    const tenant = new Tenant(row.id, row.name, null, tenantSettings, row.createdAt);

    if (row.customDomain) {
      (tenant as { domain: TenantDomainVO | null }).domain = new TenantDomainVO(row.customDomain);
    }

    return tenant;
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { LicensingEngineService } from '../../../subscription/application/services/licensing-engine.service';
import { isFeatureAllowed } from '../../../subscription/domain/config/licensing.config';

@Injectable()
export class GetIdentityFeaturesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly licensing: LicensingEngineService,
  ) {}

  async execute(): Promise<Record<string, boolean>> {
    const tenant = await this.tenantContext.resolve();
    const [row, license] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenant.tenantId },
        select: { features: true },
      }),
      this.licensing.resolveLicense(tenant.tenantId),
    ]);

    const tenantFeatures = (row?.features as Record<string, boolean> | null) ?? {};
    const result: Record<string, boolean> = {};

    for (const [key, enabled] of Object.entries(license.backendFeatures)) {
      result[key] = Boolean(enabled);
    }

    for (const [featureId, state] of Object.entries(license.features)) {
      result[featureId] = isFeatureAllowed(state);
    }

    return {
      ...result,
      ...tenantFeatures,
      smsInvites: Boolean(license.backendFeatures.smsInvites && tenantFeatures.smsInvites),
    };
  }
}

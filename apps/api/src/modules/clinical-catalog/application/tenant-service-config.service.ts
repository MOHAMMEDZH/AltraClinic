import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import {
  ClinicalCatalogNotFoundError,
  ClinicalCatalogValidationError,
  ClinicalCatalogErrorCode,
} from '../domain/clinical-catalog.errors';
import {
  CLINICAL_CATALOG_AUDIT_LOG,
  ClinicalCatalogAuditLog,
} from './ports/clinical-catalog-audit-log.port';
import type { UpsertTenantServiceConfigDto } from './dto/clinical-catalog.dto';
import type { ClinicalCatalogActorContext } from './clinical-catalog.service';

@Injectable()
export class TenantServiceConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(CLINICAL_CATALOG_AUDIT_LOG)
    private readonly auditLog: ClinicalCatalogAuditLog,
  ) {}

  async listConfigs(
    actor: ClinicalCatalogActorContext,
    query: {
      clinicalServiceId?: string;
      scope: 'tenant' | 'branch' | 'all';
      branchId?: string;
    },
  ) {
    const tenantId = this.requireTenantId(actor);
    const where: Prisma.TenantServiceConfigurationWhereInput = {
      tenantId,
      clinicalServiceId: query.clinicalServiceId,
    };

    if (query.scope === 'tenant') {
      where.branchId = null;
    } else if (query.scope === 'branch') {
      if (!query.branchId) {
        throw new ClinicalCatalogValidationError('branchId is required when scope=branch.');
      }
      await this.assertBranchBelongsToTenant(tenantId, query.branchId);
      where.branchId = query.branchId;
    } else if (query.scope === 'all') {
      if (query.branchId) {
        throw new ClinicalCatalogValidationError('branchId must not be set when scope=all.');
      }
    } else {
      throw new ClinicalCatalogValidationError('scope must be tenant|branch|all.');
    }

    return this.prisma.withPlatformBypass((client) =>
      client.tenantServiceConfiguration.findMany({
        where,
        orderBy: [{ clinicalServiceId: 'asc' }, { branchId: 'asc' }],
      }),
    );
  }

  async getEffectiveConfig(
    actor: ClinicalCatalogActorContext,
    clinicalServiceId: string,
    branchId?: string | null,
  ) {
    const tenantId = this.requireTenantId(actor);
    await this.assertServiceReadable(tenantId, clinicalServiceId);

    // PA-06: validate branch ownership BEFORE any tenant-default fallback.
    if (branchId) {
      await this.assertBranchBelongsToTenant(tenantId, branchId);
    }

    const branchOverride = branchId
      ? await this.findConfig(tenantId, clinicalServiceId, branchId)
      : null;
    if (branchOverride) {
      return { scope: 'branch' as const, config: branchOverride };
    }

    const tenantDefault = await this.findConfig(tenantId, clinicalServiceId, null);
    if (tenantDefault) {
      return { scope: 'tenant' as const, config: tenantDefault };
    }

    throw new ClinicalCatalogNotFoundError('Tenant service configuration not found.');
  }

  async upsertConfig(actor: ClinicalCatalogActorContext, body: UpsertTenantServiceConfigDto) {
    const tenantId = this.requireTenantId(actor);
    await this.assertServiceReadable(tenantId, body.clinicalServiceId);
    if (body.branchId) {
      await this.assertBranchBelongsToTenant(tenantId, body.branchId);
    }

    const branchId = body.branchId ?? null;

    return this.prisma.withPlatformBypass(async (client) => {
      const existing = await client.tenantServiceConfiguration.findFirst({
        where: { tenantId, clinicalServiceId: body.clinicalServiceId, branchId },
      });

      const data = {
        enabled: body.enabled ?? existing?.enabled ?? true,
        defaultDurationOverride: body.defaultDurationOverride ?? existing?.defaultDurationOverride ?? null,
        requiresResourceTypes: (body.requiresResourceTypes ??
          (existing?.requiresResourceTypes as string[] | undefined) ??
          []) as Prisma.InputJsonValue,
        bookingVisibleOnPortal:
          body.bookingVisibleOnPortal ?? existing?.bookingVisibleOnPortal ?? false,
      };

      const saved = existing
        ? await client.tenantServiceConfiguration.update({
            where: { id: existing.id },
            data,
          })
        : await client.tenantServiceConfiguration.create({
            data: {
              tenantId,
              clinicalServiceId: body.clinicalServiceId,
              branchId,
              ...data,
            },
          });

      await this.auditLog.recordInTransaction(client, {
        tenantId,
        action: existing
          ? 'clinical_catalog.config.update'
          : 'clinical_catalog.config.create',
        resourceId: saved.id,
        actorId: actor.actorId,
        actorRoles: actor.actorRoles,
        descriptionEn: `Tenant service config ${saved.enabled ? 'updated' : 'saved'} for ${body.clinicalServiceId}`,
        descriptionAr: `تم حفظ إعدادات الخدمة للمستأجر`,
        details: {
          clinicalServiceId: body.clinicalServiceId,
          branchId: branchId ?? '',
          enabled: saved.enabled,
        },
      });

      return saved;
    });
  }

  async setEnabled(
    actor: ClinicalCatalogActorContext,
    configId: string,
    enabled: boolean,
  ) {
    const tenantId = this.requireTenantId(actor);
    const config = await this.prisma.withPlatformBypass((client) =>
      client.tenantServiceConfiguration.findFirst({
        where: { id: configId, tenantId },
      }),
    );
    if (!config) {
      throw new ClinicalCatalogNotFoundError('Tenant service configuration not found.');
    }

    return this.prisma.withPlatformBypass(async (client) => {
      const updated = await client.tenantServiceConfiguration.update({
        where: { id: configId },
        data: { enabled },
      });

      await this.auditLog.recordInTransaction(client, {
        tenantId,
        action: enabled ? 'clinical_catalog.config.enable' : 'clinical_catalog.config.disable',
        resourceId: updated.id,
        actorId: actor.actorId,
        actorRoles: actor.actorRoles,
        descriptionEn: `Service config ${enabled ? 'enabled' : 'disabled'}`,
        descriptionAr: enabled ? 'تم تفعيل إعدادات الخدمة' : 'تم تعطيل إعدادات الخدمة',
      });

      return updated;
    });
  }

  private requireTenantId(actor: ClinicalCatalogActorContext): string {
    if (!actor.tenantId) {
      throw new ClinicalCatalogValidationError('Tenant context required.');
    }
    return actor.tenantId;
  }

  private async findConfig(
    tenantId: string,
    clinicalServiceId: string,
    branchId: string | null,
  ) {
    return this.prisma.withPlatformBypass((client) =>
      client.tenantServiceConfiguration.findFirst({
        where: { tenantId, clinicalServiceId, branchId },
      }),
    );
  }

  private async assertBranchBelongsToTenant(tenantId: string, branchId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(branchId)) {
      throw new ClinicalCatalogValidationError('branchId must be a UUID.');
    }
    const branch = await this.prisma.withPlatformBypass((client) =>
      client.branch.findFirst({
        where: { id: branchId, tenantId, deletedAt: null },
        select: { id: true },
      }),
    );
    if (!branch) {
      throw new ClinicalCatalogValidationError(
        'Branch must belong to tenant.',
        ClinicalCatalogErrorCode.BRANCH_TENANT_MISMATCH,
      );
    }
  }

  private async assertServiceReadable(tenantId: string, clinicalServiceId: string) {
    const service = await this.prisma.withPlatformBypass((client) =>
      client.canonicalClinicalServiceDefinition.findUnique({
        where: { id: clinicalServiceId },
        select: { id: true, provenance: true, tenantId: true },
      }),
    );
    if (!service) {
      throw new ClinicalCatalogNotFoundError();
    }
    if (
      service.provenance === 'TENANT_CUSTOM' &&
      service.tenantId !== tenantId
    ) {
      throw new ClinicalCatalogValidationError(
        'Cross-tenant clinical service access denied.',
        ClinicalCatalogErrorCode.TENANT_ISOLATION,
      );
    }
  }
}

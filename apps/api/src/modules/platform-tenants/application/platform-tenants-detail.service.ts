/**
 * Release 47 Step 11 — tenant detail composition with per-section authorization.
 */
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { LicensingEngineService } from '../../subscription/application/services/licensing-engine.service';
import {
  PLATFORM_TENANTS_CONFIG,
  type PlatformTenantsConfig,
} from '../config/platform-tenants.config';
import { classifyFacilityType } from './facility-type.classifier';
import {
  findAccessCapability,
  mapTenantLicenseToAccessSummary,
} from './access-summary.mapper';
import type {
  AccessCapabilityDto,
  AccessSummaryDto,
  CommercialSectionDto,
  SectionMetaDto,
  TenantDetailResponseDto,
} from './dto/platform-tenants.dto';
import {
  PLATFORM_TENANTS_AUDIT_LOG,
  isPlatformAuditSentinelTenantId,
} from '../platform-tenants.tokens';
import type { PlatformTenantsAuditLog } from './ports/platform-tenants-audit-log.port';

function unavailableSection(id: string, reasonCode: string): SectionMetaDto {
  return { id, availability: 'unavailable', reasonCode };
}

function permissionLimitedSection(id: string, reasonCode = 'missing_permission'): SectionMetaDto {
  return { id, availability: 'permission_limited', reasonCode };
}

@Injectable()
export class PlatformTenantsDetailService {
  private readonly logger = new Logger(PlatformTenantsDetailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: PlatformAuthorizationService,
    private readonly licensing: LicensingEngineService,
    @Inject(PLATFORM_TENANTS_CONFIG) private readonly config: PlatformTenantsConfig,
    @Inject(PLATFORM_TENANTS_AUDIT_LOG) private readonly audit: PlatformTenantsAuditLog,
  ) {}

  async getDetail(claims: JwtClaimsVO, platformTenantId: string): Promise<TenantDetailResponseDto> {
    const permissions = await this.requireTenantView(claims);
    const row = await this.loadPlatformTenant(platformTenantId);
    if (!row) throw new NotFoundException('Platform tenant not found.');

    const warnings: string[] = [];
    const canViewPlan = permissions.has('plan.view');
    const canViewSubscription = permissions.has('subscription.view');
    const canViewAudit = permissions.has('audit.view');
    const canViewEntitlement = permissions.has('entitlement.view');
    const canViewOperations = permissions.has('operations.view');

    const commercial = this.buildCommercialSection(row, canViewPlan, canViewSubscription);

    let access: AccessSummaryDto | SectionMetaDto;
    if (canViewEntitlement) {
      try {
        const license = await this.licensing.resolveLicense(row.tenantId);
        access = mapTenantLicenseToAccessSummary(license);
      } catch (err) {
        this.logger.warn(`Access summary degraded for ${row.tenantId}: ${(err as Error)?.name ?? 'Error'}`);
        access = { id: 'access', availability: 'degraded', reasonCode: 'licensing_projection_failed' };
        warnings.push('access_degraded');
      }
    } else {
      access = permissionLimitedSection('access', 'missing_entitlement_view');
    }

    await this.recordAudit(claims, row.tenantId, platformTenantId, 'platform_tenants.detail.viewed', warnings);

    return {
      generatedAt: new Date().toISOString(),
      banner: {
        displayName: row.displayName,
        platformTenantId: row.id,
        status: row.status,
        region: row.region,
        messageKey: 'tenantDetail.banner.readOnly',
      },
      identity: {
        id: 'identity',
        availability: 'available',
        platformTenantId: row.id,
        tenantId: row.tenantId,
        displayName: row.displayName,
        slug: row.tenant.slug,
        tenantName: row.tenant.name,
        status: row.status,
        region: row.region,
        trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
        activatedAt: row.activatedAt?.toISOString() ?? null,
        suspendedAt: row.suspendedAt?.toISOString() ?? null,
        archivedAt: row.archivedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        readOnlyPlatformView: true,
      },
      facilityProfile: {
        id: 'facilityProfile',
        availability: 'available',
        facilityType: classifyFacilityType(row.tenant.features),
        specialties: unavailableSection('specialties', 'step12_catalog'),
      },
      contacts: unavailableSection('contacts', 'no_phi_in_step11'),
      commercial,
      access,
      operations: canViewOperations
        ? unavailableSection('operations', 'operations_console_deferred')
        : permissionLimitedSection('operations', 'missing_operations_view'),
      sales: unavailableSection('sales', 'step23_sales'),
      auditLink: canViewAudit
        ? { id: 'auditLink', availability: 'available', reasonCode: 'audit_route_step21' }
        : permissionLimitedSection('auditLink'),
      warnings,
    };
  }

  async getAccessSummary(claims: JwtClaimsVO, platformTenantId: string): Promise<AccessSummaryDto | SectionMetaDto> {
    const permissions = await this.requireEntitlementAccess(claims);
    void permissions;
    const row = await this.loadPlatformTenant(platformTenantId);
    if (!row) throw new NotFoundException('Platform tenant not found.');

    try {
      const license = await this.licensing.resolveLicense(row.tenantId);
      const summary = mapTenantLicenseToAccessSummary(license);
      await this.recordAudit(
        claims,
        row.tenantId,
        platformTenantId,
        'platform_tenants.access_summary.viewed',
        [],
      );
      return summary;
    } catch (err) {
      this.logger.warn(`Access summary failed for ${row.tenantId}: ${(err as Error)?.name ?? 'Error'}`);
      return { id: 'access', availability: 'degraded', reasonCode: 'licensing_projection_failed' };
    }
  }

  async getAccessSummaryItem(
    claims: JwtClaimsVO,
    platformTenantId: string,
    capabilityKey: string,
  ): Promise<AccessCapabilityDto | SectionMetaDto> {
    await this.requireEntitlementAccess(claims);
    const row = await this.loadPlatformTenant(platformTenantId);
    if (!row) throw new NotFoundException('Platform tenant not found.');

    let summary: AccessSummaryDto;
    try {
      const license = await this.licensing.resolveLicense(row.tenantId);
      summary = mapTenantLicenseToAccessSummary(license);
    } catch (err) {
      this.logger.warn(`Access summary item failed for ${row.tenantId}: ${(err as Error)?.name ?? 'Error'}`);
      return { id: 'access', availability: 'degraded', reasonCode: 'licensing_projection_failed' };
    }

    const found = findAccessCapability(summary, capabilityKey);
    if (!found) {
      throw new NotFoundException('Capability not found.');
    }

    const action =
      found.kind === 'limit'
        ? 'platform_tenants.limit_explanation.viewed'
        : 'platform_tenants.capability_explanation.viewed';
    await this.recordAudit(claims, row.tenantId, platformTenantId, action, [], {
      capabilityKey: found.key,
      section: found.kind,
    });
    return found;
  }

  private async requireTenantView(claims: JwtClaimsVO): Promise<Set<string>> {
    const permissions = new Set(await this.authz.resolveEffectivePermissions(claims.sub));
    if (!permissions.has('tenant.view')) {
      throw new ForbiddenException('Missing tenant.view permission.');
    }
    return permissions;
  }

  private async requireEntitlementAccess(claims: JwtClaimsVO): Promise<Set<string>> {
    const permissions = new Set(await this.authz.resolveEffectivePermissions(claims.sub));
    if (!permissions.has('tenant.view')) {
      throw new ForbiddenException('Missing tenant.view permission.');
    }
    if (!permissions.has('entitlement.view')) {
      throw new ForbiddenException('Missing entitlement.view permission.');
    }
    return permissions;
  }

  private async loadPlatformTenant(platformTenantId: string) {
    if (!platformTenantId?.trim() || isPlatformAuditSentinelTenantId(platformTenantId)) {
      return null;
    }

    const row = await this.prisma.withPlatformBypass((client) =>
      client.platformTenant.findUnique({
        where: { id: platformTenantId },
        include: {
          tenant: { select: { id: true, name: true, slug: true, features: true } },
          platformSubscriptions: {
            orderBy: { createdAt: 'desc' },
            take: this.config.maxSubscriptionHistory,
          },
        },
      }),
    );

    if (!row || isPlatformAuditSentinelTenantId(row.tenantId)) {
      return null;
    }
    return row;
  }

  private buildCommercialSection(
    row: NonNullable<Awaited<ReturnType<PlatformTenantsDetailService['loadPlatformTenant']>>>,
    canViewPlan: boolean,
    canViewSubscription: boolean,
  ): CommercialSectionDto {
    const subscriptionHistory = canViewSubscription
      ? row.platformSubscriptions.map((sub, index) => ({
          id: sub.id,
          status: sub.status,
          plan: sub.plan,
          startDate: sub.startDate.toISOString(),
          endDate: sub.endDate?.toISOString() ?? sub.startDate.toISOString(),
          createdAt: sub.createdAt.toISOString(),
          primaryForLicensing: index === 0,
        }))
      : undefined;

    return {
      planVersion: unavailableSection('planVersion', 'step13_plans'),
      legacyPlan: canViewPlan
        ? {
            id: 'legacyPlan',
            availability: 'available_legacy',
            reasonCode: 'legacy_platform_tenant_plan_column',
            plan: row.plan,
          }
        : permissionLimitedSection('legacyPlan'),
      subscription: canViewSubscription
        ? {
            id: 'subscription',
            availability: 'available',
            history: subscriptionHistory,
            semantics: 'Most recent subscription row is primary for licensing until Step 16 migration.',
          }
        : permissionLimitedSection('subscription'),
      addons: unavailableSection('addons', 'step15_addons'),
      overrides: unavailableSection('overrides', 'step15_overrides'),
    };
  }

  private async recordAudit(
    claims: JwtClaimsVO,
    tenantId: string,
    platformTenantId: string,
    action: string,
    warnings: string[],
    extraDetails: Record<string, string> = {},
  ): Promise<void> {
    try {
      await this.audit.record({
        tenantId,
        action,
        resourceId: platformTenantId,
        actorId: claims.sub,
        actorRoles: ['platform'],
        locale: null,
        descriptionEn: 'Platform tenant read view accessed',
        descriptionAr: 'تم الوصول إلى عرض قراءة مستأجر المنصة',
        details: {
          platformTenantId,
          ...(warnings.length ? { warnings: warnings.join(',') } : {}),
          ...extraDetails,
        },
        correlationId: claims.sessionId ?? null,
      });
    } catch (err) {
      this.logger.warn(`Detail audit failed: ${(err as Error)?.name ?? 'Error'}`);
    }
  }
}

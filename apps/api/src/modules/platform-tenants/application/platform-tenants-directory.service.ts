/**
 * Release 47 Step 11 — paginated tenant directory with batched facility + subscription data.
 */
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  PLATFORM_TENANTS_CONFIG,
  type PlatformTenantsConfig,
} from '../config/platform-tenants.config';
import { FACILITY_TYPE_SQL_CASE } from './facility-type.classifier';
import {
  resolveFacilityTypeFilter,
  resolveLegacyPlanFilter,
  resolveRegionFilter,
  resolveSortField,
  resolveStatusFilter,
  resolveSubscriptionStatusFilter,
  resolveTrialStateFilter,
  SORT_ALLOWLIST,
} from './directory-query.resolver';
import type {
  TenantDirectoryItemDto,
  TenantDirectoryResponseDto,
} from './dto/platform-tenants.dto';
import {
  PLATFORM_AUDIT_SENTINEL_TENANT_ID,
  PLATFORM_TENANTS_AUDIT_LOG,
  PLATFORM_TENANTS_DIRECTORY_AUDIT_TENANT_ID,
  excludePlatformAuditSentinelSql,
} from '../platform-tenants.tokens';
import type { PlatformTenantsAuditLog } from './ports/platform-tenants-audit-log.port';

export interface DirectoryQuery {
  page?: string;
  pageSize?: string;
  limit?: string;
  search?: string;
  status?: string;
  region?: string;
  trialState?: string;
  facilityType?: string;
  legacyPlan?: string;
  subscriptionStatus?: string;
  sort?: string;
  direction?: string;
}

interface DirectoryRow {
  platform_tenant_id: string;
  tenant_id: string;
  display_name: string;
  slug: string | null;
  status: string;
  region: string;
  trial_ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
  plan: string;
  facility_type: string;
  subscription_status: string | null;
  subscription_plan: string | null;
}

function escapeIlikePattern(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

@Injectable()
export class PlatformTenantsDirectoryService {
  private readonly logger = new Logger(PlatformTenantsDirectoryService.name);
  private readonly directoryHits = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: PlatformAuthorizationService,
    @Inject(PLATFORM_TENANTS_CONFIG) private readonly config: PlatformTenantsConfig,
    @Inject(PLATFORM_TENANTS_AUDIT_LOG) private readonly audit: PlatformTenantsAuditLog,
  ) {}

  async listDirectory(
    claims: JwtClaimsVO,
    query: DirectoryQuery,
  ): Promise<TenantDirectoryResponseDto> {
    const permissions = new Set(await this.authz.resolveEffectivePermissions(claims.sub));
    if (!permissions.has('tenant.view')) {
      throw new ForbiddenException('Missing tenant.view permission.');
    }

    if (query.limit?.toLowerCase() === 'all') {
      throw new BadRequestException('limit=all is not supported.');
    }

    if (!this.tryConsumeDirectoryToken(claims.sub)) {
      throw new HttpException('Directory rate limit exceeded.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(
      this.config.maxPageSize,
      Math.max(1, Number(query.pageSize) || this.config.defaultPageSize),
    );
    const offset = (page - 1) * pageSize;

    let search = query.search?.trim() ?? '';
    const warnings: string[] = [];
    if (search.length > this.config.maxSearchLength) {
      search = search.slice(0, this.config.maxSearchLength);
      warnings.push('search_truncated');
    }

    const appliedFilters: Record<string, string> = {};
    const conditions: Prisma.Sql[] = [
      Prisma.sql`t."deletedAt" IS NULL`,
      // Defense in depth: never surface the audit sentinel even if a platform_tenants row appears.
      excludePlatformAuditSentinelSql(Prisma.sql`t.id`, Prisma.sql`t.slug`),
      Prisma.sql`pt."tenantId" <> ${PLATFORM_AUDIT_SENTINEL_TENANT_ID}::uuid`,
    ];

    if (query.status) {
      const dbStatus = resolveStatusFilter(query.status);
      appliedFilters.status = dbStatus;
      conditions.push(Prisma.sql`pt.status = ${dbStatus}::platform_tenant_status`);
    }

    if (query.region) {
      const dbRegion = resolveRegionFilter(query.region);
      appliedFilters.region = dbRegion;
      conditions.push(Prisma.sql`pt.region = ${dbRegion}::platform_region`);
    }

    if (query.trialState) {
      const trial = resolveTrialStateFilter(query.trialState);
      appliedFilters.trialState = trial;
      if (trial === 'active') {
        conditions.push(
          Prisma.sql`pt."trialEndsAt" IS NOT NULL AND pt."trialEndsAt" > NOW() AND pt.status <> 'ARCHIVED'::platform_tenant_status`,
        );
      } else if (trial === 'expired') {
        conditions.push(Prisma.sql`pt."trialEndsAt" IS NOT NULL AND pt."trialEndsAt" <= NOW()`);
      } else if (trial === 'none') {
        conditions.push(Prisma.sql`pt."trialEndsAt" IS NULL`);
      }
    }

    if (query.facilityType) {
      const facilityType = resolveFacilityTypeFilter(query.facilityType);
      appliedFilters.facilityType = facilityType;
      conditions.push(
        Prisma.sql`(${Prisma.raw(FACILITY_TYPE_SQL_CASE.trim())}) = ${facilityType}`,
      );
    }

    if (query.legacyPlan) {
      if (!permissions.has('plan.view')) {
        throw new ForbiddenException('legacyPlan filter requires plan.view.');
      }
      const dbPlan = resolveLegacyPlanFilter(query.legacyPlan);
      appliedFilters.legacyPlan = dbPlan;
      conditions.push(Prisma.sql`pt.plan = ${dbPlan}::entitlement_plan`);
    }

    if (query.subscriptionStatus) {
      if (!permissions.has('subscription.view')) {
        throw new ForbiddenException('subscriptionStatus filter requires subscription.view.');
      }
      const subStatus = resolveSubscriptionStatusFilter(query.subscriptionStatus);
      appliedFilters.subscriptionStatus = subStatus;
      conditions.push(Prisma.sql`ls.status = ${subStatus}::subscription_status`);
    }

    if (search) {
      appliedFilters.search = 'applied';
      if (isUuid(search)) {
        conditions.push(
          Prisma.sql`(pt.id = ${search}::uuid OR pt."tenantId" = ${search}::uuid)`,
        );
      } else {
        const pattern = `%${escapeIlikePattern(search)}%`;
        conditions.push(
          Prisma.sql`(pt."displayName" ILIKE ${pattern} ESCAPE '\\' OR t.slug ILIKE ${pattern} ESCAPE '\\')`,
        );
      }
    }

    const sortField = resolveSortField(query.sort);
    const direction = query.direction?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const orderColumn = SORT_ALLOWLIST[sortField];

    const whereClause = Prisma.join(conditions, ' AND ');
    const lateralJoin = Prisma.sql`
      LEFT JOIN LATERAL (
        SELECT ps.status, ps.plan
        FROM platform_subscriptions ps
        WHERE ps."platformTenantId" = pt.id
        ORDER BY ps."createdAt" DESC
        LIMIT 1
      ) ls ON TRUE
    `;

    const canViewPlan = permissions.has('plan.view');
    const canViewSubscription = permissions.has('subscription.view');

    const result = await this.prisma.withPlatformBypass(async (client) => {
      const countRows = await client.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM platform_tenants pt
        INNER JOIN tenants t ON t.id = pt."tenantId"
        ${lateralJoin}
        WHERE ${whereClause}
      `);
      const total = Number(countRows[0]?.count ?? 0);

      const rows = await client.$queryRaw<DirectoryRow[]>(Prisma.sql`
        SELECT
          pt.id AS platform_tenant_id,
          pt."tenantId" AS tenant_id,
          pt."displayName" AS display_name,
          t.slug,
          pt.status::text AS status,
          pt.region::text AS region,
          pt."trialEndsAt" AS trial_ends_at,
          pt."createdAt" AS created_at,
          pt."updatedAt" AS updated_at,
          pt.plan::text AS plan,
          (${Prisma.raw(FACILITY_TYPE_SQL_CASE.trim())}) AS facility_type,
          ls.status::text AS subscription_status,
          ls.plan::text AS subscription_plan
        FROM platform_tenants pt
        INNER JOIN tenants t ON t.id = pt."tenantId"
        ${lateralJoin}
        WHERE ${whereClause}
        ORDER BY ${Prisma.raw(orderColumn)} ${Prisma.raw(direction)}, pt.id ASC
        LIMIT ${pageSize} OFFSET ${offset}
      `);

      return { rows, total };
    });

    const items: TenantDirectoryItemDto[] = result.rows.map((row) => {
      const legacyPlan = canViewPlan ? row.plan : null;
      const subscriptionSummary =
        canViewSubscription && row.subscription_status
          ? {
              status: row.subscription_status,
              plan: row.subscription_plan ?? 'UNKNOWN',
            }
          : null;

      return {
        platformTenantId: row.platform_tenant_id,
        tenantId: row.tenant_id,
        displayName: row.display_name,
        slug: row.slug,
        status: row.status,
        region: row.region,
        trialEndsAt: row.trial_ends_at?.toISOString() ?? null,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        facilityType: row.facility_type,
        legacyPlan,
        legacyPlanAvailability: canViewPlan ? 'available' : 'permission_limited',
        subscriptionSummary,
        subscriptionAvailability: canViewSubscription ? 'available' : 'permission_limited',
      };
    });

    try {
      await this.audit.record({
        tenantId: PLATFORM_TENANTS_DIRECTORY_AUDIT_TENANT_ID,
        action: 'platform_tenants.directory.listed',
        resourceId: PLATFORM_TENANTS_DIRECTORY_AUDIT_TENANT_ID,
        actorId: claims.sub,
        actorRoles: ['platform'],
        locale: null,
        descriptionEn: 'Platform tenant directory listed',
        descriptionAr: 'تم عرض دليل مستأجري المنصة',
        details: {
          page: String(page),
          pageSize: String(pageSize),
          resultCount: String(items.length),
          total: String(result.total),
          searchApplied: search ? 'true' : 'false',
          ...(search ? { searchLength: String(search.length) } : {}),
          ...appliedFilters,
        },
        correlationId: claims.sessionId ?? null,
      });
    } catch (err) {
      this.logger.warn(`Directory audit failed: ${(err as Error)?.name ?? 'Error'}`);
      warnings.push('audit_degraded');
    }

    return {
      generatedAt: new Date().toISOString(),
      items,
      pagination: {
        page,
        pageSize,
        total: result.total,
        hasNextPage: offset + items.length < result.total,
      },
      appliedFilters,
      sort: { field: sortField, direction: direction.toLowerCase() as 'asc' | 'desc' },
      availableFilters: [
        'status',
        'region',
        'trialState',
        'facilityType',
        ...(canViewPlan ? (['legacyPlan'] as const) : []),
        ...(canViewSubscription ? (['subscriptionStatus'] as const) : []),
      ],
      warnings,
    };
  }

  private tryConsumeDirectoryToken(userId: string): boolean {
    const windowMs = 60_000;
    const now = Date.now();
    const hits = (this.directoryHits.get(userId) ?? []).filter((ts) => now - ts < windowMs);
    if (hits.length >= this.config.directoryRateLimitPerMinute) {
      this.directoryHits.set(userId, hits);
      return false;
    }
    hits.push(now);
    this.directoryHits.set(userId, hits);
    return true;
  }
}

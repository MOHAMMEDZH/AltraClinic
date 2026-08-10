import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { PlatformHealthAggregatorService } from '../../observability/application/health/platform-health-aggregator.service';
import { EffectiveEntitlementRuntimeService } from '../../effective-entitlement-runtime/application/effective-entitlement-runtime.service';
import { WebhookEngineService } from '../../integrations/application/webhook/webhook-engine.service';
import {
  loadIntegrationsFoundationConfig,
  validateIntegrationsFoundationConfig,
} from '../../integrations/config/integrations-config';
import { BackupRestoreJobManager } from '../../backup-restore/application/backup-restore-job.manager';
import {
  type NormalizedOpsStatus,
  type OpsBackupRow,
  type OpsCompatibilityDto,
  type OpsEntitlementHealthDto,
  type OpsExpiryRow,
  type OpsHealthDto,
  type OpsIntegrationRow,
  type OpsJobListDto,
  type OpsJobRow,
  type OpsOverviewDto,
  type OpsProvisioningRow,
  type OpsSourceCard,
  OpsConsoleError,
} from '../domain/operations-console.types';
import {
  OPERATIONS_CONSOLE_ADAPTER_TIMEOUT_MS,
  OPERATIONS_CONSOLE_DEFAULT_PAGE_SIZE,
  OPERATIONS_CONSOLE_MAX_PAGE_SIZE,
  isOperationsConsoleFailureInjectionActive,
} from '../platform-operations-console.constants';
import { assertNoForbiddenLeak } from './ops-redaction';

function ageMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Date.now() - t;
}

function withStale(
  status: NormalizedOpsStatus,
  timestamp: string | null,
  softMs: number,
): { status: NormalizedOpsStatus; stale: boolean } {
  const age = ageMs(timestamp);
  if (age == null) {
    if (status === 'HEALTHY') return { status: 'UNKNOWN', stale: true };
    return { status, stale: status !== 'DISABLED' };
  }
  if (age > softMs && (status === 'HEALTHY' || status === 'DEGRADED' || status === 'RUNNING')) {
    return { status: 'STALE', stale: true };
  }
  return { status, stale: false };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

@Injectable()
export class OpsQueryService {
  private lastCacheInvalidateAt: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly redis?: RedisService,
    @Optional() private readonly healthAggregator?: PlatformHealthAggregatorService,
    @Optional() private readonly eer?: EffectiveEntitlementRuntimeService,
    @Optional() private readonly webhooks?: WebhookEngineService,
    @Optional() private readonly backupJobs?: BackupRestoreJobManager,
  ) {}

  markCacheInvalidated(at = new Date().toISOString()): void {
    this.lastCacheInvalidateAt = at;
  }

  async overview(): Promise<OpsOverviewDto> {
    const health = await this.health();
    const entitlement = await this.entitlementHealth();
    const compatibility = await this.compatibility();
    const cards: OpsSourceCard[] = [
      ...health.probes,
      {
        id: 'O08',
        title: 'Local API cache state',
        sourceStatus: entitlement.localCacheAdapterStatus,
        normalizedStatus: entitlement.localCacheAdapterStatus,
        sourceTimestamp: entitlement.thisInstanceLastInvalidationAt,
        stale: entitlement.localCacheAdapterStatus === 'STALE',
        correlationId: null,
        message: entitlement.note,
        retryable: false,
      },
      {
        id: 'O09',
        title: 'Compatibility validation',
        sourceStatus: compatibility.validatorJobStatus,
        normalizedStatus: compatibility.normalizedStatus,
        sourceTimestamp: compatibility.generatedAt,
        stale: false,
        correlationId: null,
        message: compatibility.note,
        retryable: false,
      },
    ];
    const dto = { generatedAt: new Date().toISOString(), cards };
    assertNoForbiddenLeak(dto);
    return dto;
  }

  async health(): Promise<OpsHealthDto> {
    if (isOperationsConsoleFailureInjectionActive('health_adapter')) {
      throw new OpsConsoleError('source_unavailable', 'Health adapter unavailable', 503);
    }
    const now = new Date().toISOString();
    const probes: OpsSourceCard[] = [];

    if (this.healthAggregator) {
      const report = await withTimeout(
        this.healthAggregator.aggregate(),
        OPERATIONS_CONSOLE_ADAPTER_TIMEOUT_MS,
        null as Awaited<ReturnType<PlatformHealthAggregatorService['aggregate']>> | null,
      );
      if (!report) {
        probes.push({
          id: 'O01',
          title: 'Platform/API health',
          sourceStatus: null,
          normalizedStatus: 'UNKNOWN',
          sourceTimestamp: now,
          stale: true,
          correlationId: null,
          message: 'Health aggregator timed out',
          retryable: false,
        });
      } else {
        const mapped: NormalizedOpsStatus =
          report.status === 'healthy'
            ? 'HEALTHY'
            : report.status === 'degraded'
              ? 'DEGRADED'
              : report.status === 'unhealthy'
                ? 'UNHEALTHY'
                : report.status === 'dormant'
                  ? 'DISABLED'
                  : 'UNKNOWN';
        const stamped = withStale(mapped, report.checkedAt ?? now, 60_000);
        probes.push({
          id: 'O01',
          title: 'Platform/API health',
          sourceStatus: String(report.status),
          normalizedStatus: stamped.status,
          sourceTimestamp: report.checkedAt ?? now,
          stale: stamped.stale,
          correlationId: null,
          message: null,
          retryable: false,
        });
      }
    } else {
      probes.push({
        id: 'O01',
        title: 'Platform/API health',
        sourceStatus: null,
        normalizedStatus: 'UNKNOWN',
        sourceTimestamp: null,
        stale: true,
        correlationId: null,
        message: 'Health aggregator not wired',
        retryable: false,
      });
    }

    let pgOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      pgOk = true;
    } catch {
      pgOk = false;
    }
    probes.push({
      id: 'O02',
      title: 'PostgreSQL readiness',
      sourceStatus: pgOk ? 'up' : 'down',
      normalizedStatus: pgOk ? 'HEALTHY' : 'UNHEALTHY',
      sourceTimestamp: now,
      stale: false,
      correlationId: null,
      message: null,
      retryable: false,
    });

    const redisAvail = this.redis?.isAvailable ?? null;
    probes.push({
      id: 'O03',
      title: 'Cache/Redis health',
      sourceStatus: redisAvail == null ? null : redisAvail ? 'available' : 'unavailable',
      normalizedStatus: redisAvail == null ? 'UNKNOWN' : redisAvail ? 'HEALTHY' : 'DEGRADED',
      sourceTimestamp: redisAvail == null ? null : now,
      stale: redisAvail == null,
      correlationId: null,
      message: redisAvail == null ? 'Redis service not wired' : null,
      retryable: false,
    });

    probes.push({
      id: 'O04',
      title: 'Worker/scheduler health',
      sourceStatus: null,
      normalizedStatus: 'UNKNOWN',
      sourceTimestamp: null,
      stale: true,
      correlationId: null,
      message: 'No dedicated Super Admin worker probe; see Background/BR hub wired flags',
      retryable: false,
    });

    const dto = { generatedAt: now, probes };
    assertNoForbiddenLeak(dto);
    return dto;
  }

  async listJobs(opts: { cursor?: string; limit?: number }): Promise<OpsJobListDto> {
    if (isOperationsConsoleFailureInjectionActive('queue_adapter')) {
      throw new OpsConsoleError('source_unavailable', 'Queue adapter unavailable', 503);
    }
    if (isOperationsConsoleFailureInjectionActive('job_lookup')) {
      throw new OpsConsoleError('source_unavailable', 'Job lookup unavailable', 503);
    }
    const limit = Math.min(
      Math.max(1, opts.limit ?? OPERATIONS_CONSOLE_DEFAULT_PAGE_SIZE),
      OPERATIONS_CONSOLE_MAX_PAGE_SIZE,
    );
    if (opts.cursor && !isUuid(opts.cursor)) {
      throw new OpsConsoleError('invalid_cursor', 'Invalid cursor', 400);
    }
    const rows = await this.prisma.withPlatformBypass(async (client) =>
      client.platformTenantProvisioningRequest.findMany({
        orderBy: { updatedAt: 'desc' },
        take: limit,
        ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
        select: {
          id: true,
          status: true,
          updatedAt: true,
          createdAt: true,
          correlationId: true,
          lastErrorCode: true,
          tenantId: true,
        },
      }),
    );
    const items: OpsJobRow[] = rows.map((r) => {
      const normalized = this.mapProvisioningStatus(r.status);
      const ts = r.updatedAt?.toISOString() ?? null;
      const stamped = withStale(normalized, ts, 15 * 60_000);
      return {
        ref: r.id,
        jobType: 'tenant_provisioning',
        sourceQueue: 'tenant_provisioning',
        sourceStatus: r.status,
        normalizedStatus: stamped.status,
        attempts: null,
        maxAttempts: null,
        createdAt: r.createdAt?.toISOString() ?? null,
        updatedAt: ts,
        nextRetryAt: null,
        retryable: r.status === 'FAILED_RETRYABLE',
        stale: stamped.stale,
        failureCategory: r.lastErrorCode ?? null,
        correlationId: r.correlationId ?? null,
        tenantSummary: r.tenantId ? `tenant:${r.tenantId.slice(0, 8)}` : null,
      };
    });
    const dto = {
      items,
      nextCursor: items.length === limit ? (items[items.length - 1]?.ref ?? null) : null,
    };
    assertNoForbiddenLeak(dto);
    return dto;
  }

  async getJob(ref: string): Promise<OpsJobRow> {
    const list = await this.listJobs({ limit: 100 });
    const found = list.items.find((j) => j.ref === ref);
    if (!found) throw new OpsConsoleError('not_found', 'Job not found', 404);
    return found;
  }

  async listProvisioning(opts: { limit?: number }): Promise<OpsProvisioningRow[]> {
    const limit = Math.min(
      Math.max(1, opts.limit ?? OPERATIONS_CONSOLE_DEFAULT_PAGE_SIZE),
      OPERATIONS_CONSOLE_MAX_PAGE_SIZE,
    );
    const rows = await this.prisma.withPlatformBypass(async (client) =>
      client.platformTenantProvisioningRequest.findMany({
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          tenantId: true,
          status: true,
          rowVersion: true,
          updatedAt: true,
          correlationId: true,
          lastErrorCode: true,
        },
      }),
    );
    return rows.map((r) => {
      const normalized = this.mapProvisioningStatus(r.status);
      const ts = r.updatedAt?.toISOString() ?? null;
      const stamped = withStale(normalized, ts, 15 * 60_000);
      return {
        requestId: r.id,
        tenantId: r.tenantId ?? null,
        status: r.status,
        normalizedStatus: stamped.status,
        step: null,
        lastTransitionAt: ts,
        attemptCount: null,
        failureCode: r.lastErrorCode ?? null,
        retryable: r.status === 'FAILED_RETRYABLE',
        rowVersion: r.rowVersion,
        correlationId: r.correlationId ?? null,
        stale: stamped.stale,
      };
    });
  }

  async listSubscriptionExpiry(opts: { limit?: number }): Promise<OpsExpiryRow[]> {
    const limit = Math.min(
      Math.max(1, opts.limit ?? OPERATIONS_CONSOLE_DEFAULT_PAGE_SIZE),
      OPERATIONS_CONSOLE_MAX_PAGE_SIZE,
    );
    const rows = await this.prisma.withPlatformBypass(async (client) =>
      client.platformSubscriptionCommercialConfig.findMany({
        orderBy: { commercialEnd: 'asc' },
        take: limit,
        where: { commercialEnd: { not: null }, isCurrent: true },
        select: {
          id: true,
          platformTenantId: true,
          lifecycle: true,
          commercialEnd: true,
        },
      }),
    );
    return rows.map((r) => ({
      id: r.id,
      kind: 'subscription' as const,
      tenantId: r.platformTenantId,
      expiresAt: r.commercialEnd?.toISOString() ?? null,
      state: r.lifecycle,
      jobSorStatus: 'DISABLED' as const,
      normalizedStatus: 'DISABLED' as const,
      correlationId: null,
      note: 'No dedicated Subscription expiry worker exists; expiry is evaluated at licensing resolve time.',
    }));
  }

  async listOverrideExpiry(opts: { limit?: number }): Promise<OpsExpiryRow[]> {
    const limit = Math.min(
      Math.max(1, opts.limit ?? OPERATIONS_CONSOLE_DEFAULT_PAGE_SIZE),
      OPERATIONS_CONSOLE_MAX_PAGE_SIZE,
    );
    const rows = await this.prisma.withPlatformBypass(async (client) =>
      client.platformCommercialOverride.findMany({
        orderBy: { expiresAt: 'asc' },
        take: limit,
        where: { expiresAt: { not: null } },
        select: {
          id: true,
          lifecycle: true,
          expiresAt: true,
        },
      }),
    );
    return rows.map((r) => ({
      id: r.id,
      kind: 'override' as const,
      tenantId: null,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      state: r.lifecycle,
      jobSorStatus: 'DISABLED' as const,
      normalizedStatus: 'DISABLED' as const,
      correlationId: null,
      note: 'No dedicated Override expiry worker exists; expiry is evaluated passively at composition time.',
    }));
  }

  async entitlementHealth(): Promise<OpsEntitlementHealthDto> {
    if (isOperationsConsoleFailureInjectionActive('entitlement_health_adapter')) {
      throw new OpsConsoleError('source_unavailable', 'Entitlement health adapter unavailable', 503);
    }
    const cacheWired = Boolean(this.eer);
    const last = this.lastCacheInvalidateAt;
    const local = withStale(cacheWired ? 'HEALTHY' : 'UNKNOWN', last, 5 * 60_000);
    // No distributed invalidation SoR — must not claim global HEALTHY from this instance.
    const globalInvalidationHealth: NormalizedOpsStatus = 'UNKNOWN';
    return {
      generatedAt: new Date().toISOString(),
      cacheTopology: 'process_local',
      localResolverHealth: cacheWired ? 'HEALTHY' : 'UNKNOWN',
      localCacheAdapterStatus: local.status,
      thisInstanceLastInvalidationAt: last,
      globalInvalidationHealth,
      invalidationBacklogCount: null,
      killSwitchOperational: 'UNKNOWN',
      note: cacheWired
        ? 'Local API cache state only (process-local Map). This instance last invalidation evidence; global invalidation health is UNKNOWN (no distributed SoR).'
        : 'Effective entitlement runtime not wired; local and global cache evidence UNKNOWN.',
      resolverHealth: cacheWired ? 'HEALTHY' : 'UNKNOWN',
      cacheHealth: local.status,
      lastInvalidationAt: last,
      backlogCount: null,
    };
  }

  async compatibility(): Promise<OpsCompatibilityDto> {
    const [items, translations, aliases, rules] = await this.prisma.withPlatformBypass(
      async (client) =>
        Promise.all([
          client.healthcareCatalogItem.count(),
          client.healthcareCatalogTranslation.count(),
          client.healthcareCatalogAlias.count(),
          client.healthcareCatalogCompatibilityRule.count(),
        ]),
    );
    const catalogIdentityOk =
      items === 68 && translations === 136 && aliases === 68 && rules === 13;
    return {
      generatedAt: new Date().toISOString(),
      catalogItems: items,
      catalogTranslations: translations,
      catalogAliases: aliases,
      catalogCompatibilityRules: rules,
      catalogIdentityOk,
      validatorJobStatus: 'DISABLED',
      normalizedStatus: catalogIdentityOk ? 'HEALTHY' : items === 0 ? 'UNKNOWN' : 'DEGRADED',
      note: 'Compatibility validation is synchronous at write/provision time; no background validation job.',
    };
  }

  async listIntegrations(): Promise<OpsIntegrationRow[]> {
    if (isOperationsConsoleFailureInjectionActive('integration_adapter')) {
      throw new OpsConsoleError('source_unavailable', 'Integration adapter unavailable', 503);
    }
    const config = loadIntegrationsFoundationConfig();
    const validation = validateIntegrationsFoundationConfig(config);
    if (!config.featureEnabled) {
      return [
        {
          type: 'integrations_foundation',
          enabled: false,
          enabledState: 'disabled',
          configurationState: 'not_applicable',
          classification: 'I-B',
          sourceStatus: 'feature_disabled',
          runtimeHealth: 'DISABLED',
          normalizedStatus: 'DISABLED',
          queueHealth: null,
          lastSuccessAt: null,
          lastFailureAt: null,
          failureCategory: null,
          retryable: false,
          stale: false,
          correlationId: null,
        },
      ];
    }
    if (!validation.valid) {
      return [
        {
          type: 'integrations_foundation',
          enabled: true,
          enabledState: 'enabled',
          configurationState: 'invalid',
          classification: 'I-C',
          sourceStatus: 'config_invalid',
          runtimeHealth: 'UNKNOWN',
          normalizedStatus: 'UNKNOWN',
          queueHealth: null,
          lastSuccessAt: null,
          lastFailureAt: null,
          failureCategory: 'config',
          retryable: false,
          stale: true,
          correlationId: null,
        },
      ];
    }
    // Enabled + valid config alone is NOT HEALTHY — requires runtime evidence.
    const rows: OpsIntegrationRow[] = [
      {
        type: 'integrations_foundation',
        enabled: true,
        enabledState: 'enabled',
        configurationState: 'valid',
        classification: 'I-A',
        sourceStatus: 'feature_enabled_no_runtime_probe',
        runtimeHealth: 'UNKNOWN',
        normalizedStatus: 'UNKNOWN',
        queueHealth: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        failureCategory: null,
        retryable: false,
        stale: true,
        correlationId: null,
      },
    ];
    if (this.webhooks) {
      const providers = this.webhooks.listProviders();
      const diag = this.webhooks.getQueueDiagnostics();
      for (const p of providers) {
        const disabled = p.status !== 'active';
        rows.push({
          type: `provider:${p.providerKey}`,
          enabled: !disabled,
          enabledState: disabled ? 'disabled' : 'enabled',
          configurationState: 'valid',
          classification: 'I-A',
          sourceStatus: String(p.status),
          // Catalog/provider seed status is runtime registry evidence (not config flag alone).
          runtimeHealth: disabled ? 'DISABLED' : 'HEALTHY',
          normalizedStatus: disabled ? 'DISABLED' : 'HEALTHY',
          queueHealth: null,
          lastSuccessAt: null,
          lastFailureAt: null,
          failureCategory: null,
          retryable: false,
          stale: false,
          correlationId: null,
        });
      }
      const queueDegraded = diag.failed > 0 || diag.dlq > 0;
      const queueHealth: NormalizedOpsStatus = !diag.wired
        ? 'UNKNOWN'
        : queueDegraded
          ? 'DEGRADED'
          : 'HEALTHY';
      rows.push({
        type: 'integrations_webhook_queue',
        enabled: true,
        enabledState: 'enabled',
        configurationState: 'valid',
        classification: 'I-A',
        sourceStatus: diag.wired ? 'wired' : 'unwired',
        runtimeHealth: queueHealth,
        normalizedStatus: queueHealth,
        queueHealth,
        lastSuccessAt: null,
        lastFailureAt: null,
        failureCategory: diag.dlq > 0 ? 'dead_letter' : diag.failed > 0 ? 'failed' : null,
        retryable: diag.dlq > 0,
        stale: !diag.wired,
        correlationId: null,
      });
    } else {
      rows.push({
        type: 'integrations_webhook_engine',
        enabled: false,
        enabledState: 'disabled',
        configurationState: 'not_applicable',
        classification: 'I-B',
        sourceStatus: 'not_wired_into_ops',
        runtimeHealth: 'DISABLED',
        normalizedStatus: 'DISABLED',
        queueHealth: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        failureCategory: null,
        retryable: false,
        stale: false,
        correlationId: null,
      });
    }
    return rows;
  }

  async listBackups(_opts: { limit?: number }): Promise<OpsBackupRow[]> {
    if (isOperationsConsoleFailureInjectionActive('backup_adapter')) {
      throw new OpsConsoleError('source_unavailable', 'Backup adapter unavailable', 503);
    }
    if (!this.backupJobs) {
      return [
        {
          ref: 'backup_restore_engine',
          category: 'foundation',
          classification: 'B-B',
          status: 'not_wired_into_ops',
          normalizedStatus: 'DISABLED',
          startedAt: null,
          endedAt: null,
          verificationState: null,
          retentionCategory: null,
          failureCategory: null,
          stale: false,
          correlationId: null,
          storagePathExposed: false,
        },
      ];
    }
    const health = await this.backupJobs.getEngineHealth();
    const rows: OpsBackupRow[] = [
      {
        ref: 'backup_scheduler',
        category: 'scheduler',
        classification: 'B-A',
        status: health.schedulerWired ? 'wired' : 'not_implemented',
        normalizedStatus: health.schedulerWired ? 'HEALTHY' : 'DISABLED',
        startedAt: null,
        endedAt: null,
        verificationState: null,
        retentionCategory: null,
        failureCategory: null,
        stale: false,
        correlationId: null,
        storagePathExposed: false,
      },
      {
        ref: 'backup_job_engine',
        category: 'job_engine',
        classification: 'B-A',
        status: health.jobEngineReady ? 'ready' : 'not_ready',
        normalizedStatus: health.featureEnabled
          ? health.jobEngineReady
            ? 'HEALTHY'
            : 'DEGRADED'
          : 'DISABLED',
        startedAt: null,
        endedAt: null,
        verificationState: null,
        retentionCategory: null,
        failureCategory: null,
        stale: false,
        correlationId: null,
        storagePathExposed: false,
      },
    ];
    const byStatus = health.jobsByStatus ?? {};
    for (const [status, count] of Object.entries(byStatus)) {
      if (!count) continue;
      rows.push({
        ref: `backup_jobs:${status}`,
        category: 'job_status_count',
        classification: 'B-A',
        status: `${status}:${count}`,
        normalizedStatus:
          status === 'failed' || status === 'dead_letter'
            ? 'FAILED'
            : status === 'succeeded' || status === 'completed'
              ? 'SUCCEEDED'
              : status === 'running' || status === 'queued'
                ? 'RUNNING'
                : 'UNKNOWN',
        startedAt: null,
        endedAt: null,
        verificationState: null,
        retentionCategory: null,
        failureCategory: status === 'failed' || status === 'dead_letter' ? status : null,
        stale: false,
        correlationId: null,
        storagePathExposed: false,
      });
    }
    return rows;
  }

  private mapProvisioningStatus(status: string): NormalizedOpsStatus {
    switch (status) {
      case 'COMPLETED':
        return 'SUCCEEDED';
      case 'FAILED_RETRYABLE':
        return 'RETRYABLE';
      case 'FAILED':
      case 'FAILED_TERMINAL':
      case 'COMPENSATED':
        return 'NON_RETRYABLE';
      case 'PROVISIONING':
        return 'RUNNING';
      case 'REQUESTED':
      case 'READY':
      case 'AWAITING_ACTIVATION':
        return 'PENDING';
      default:
        return 'UNKNOWN';
    }
  }
}

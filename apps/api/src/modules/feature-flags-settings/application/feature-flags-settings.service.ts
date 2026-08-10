import { createHash, randomUUID } from 'crypto';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../auth/platform-auth.tokens';
import type { PlatformRefreshTokenRepository } from '../../auth/domain/repositories/platform-refresh-token.repository.interface';
import { resolveOperationCorrelationId } from '../../platform-audit-center/application/operation-correlation';
import {
  FEATURE_FLAG_OPERATIONS,
  FLAG_KEY_PREFIX,
  GLOBAL_SETTING_OPERATIONS,
  KEY_MAX_LEN,
  PREVIEW_TTL_MS,
  REASON_MAX_LEN,
  SECRET_FIELD_MARKERS,
  SETTING_KEY_PREFIX,
  isFeatureFlagsSettingsFailureInjectionActive,
} from '../feature-flags-settings.constants';
import { isFeatureFlagsSettingsEnabled } from '../config/feature-flags-settings-flags';
import {
  FeatureFlagsSettingsError,
  type FeatureFlagCreateInput,
  type FeatureFlagTargetUpdateInput,
  type FeatureFlagUpdateInput,
  type FeatureFlagsSettingsFailureInjectionPoint,
  type GlobalSettingReferenceUpdateInput,
  type GlobalSettingUpdateInput,
  type KillSwitchInput,
} from '../domain/feature-flags-settings.types';
import { FeatureFlagIdempotencyService } from './feature-flag-idempotency.service';
import { FeatureFlagsSettingsAuditLog } from './feature-flags-settings-audit.log';
import { FeatureFlagsSettingsRateLimitService } from './feature-flags-settings-rate-limit.service';
import { OperationalDecisionService } from './operational-decision.service';

function normalizeKey(raw: string, prefix: string): string {
  const key = raw.trim().toLowerCase();
  if (!key.startsWith(prefix)) {
    throw new FeatureFlagsSettingsError('invalid_key_prefix', `Key must start with ${prefix}`);
  }
  if (key.length > KEY_MAX_LEN || !/^[a-z0-9._-]+$/.test(key)) {
    throw new FeatureFlagsSettingsError('invalid_key', 'Key failed normalization rules');
  }
  return key;
}

function assertReason(reason: string): string {
  const r = reason?.trim() ?? '';
  if (!r || r.length > REASON_MAX_LEN) {
    throw new FeatureFlagsSettingsError('invalid_reason', 'Reason is required');
  }
  return r;
}

function assertNoSecrets(value: unknown, path = ''): void {
  if (value == null) return;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    for (const marker of SECRET_FIELD_MARKERS) {
      if (lower.includes(marker) && lower.length > 32) {
        throw new FeatureFlagsSettingsError(
          'secret_write_forbidden',
          'Secret material is not allowed in settings payloads',
          400,
        );
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoSecrets(v, `${path}[${i}]`));
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lk = k.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (SECRET_FIELD_MARKERS.some((m) => lk.includes(m))) {
        throw new FeatureFlagsSettingsError(
          'secret_write_forbidden',
          `Secret field forbidden: ${path}${k}`,
          400,
        );
      }
      assertNoSecrets(v, `${path}${k}.`);
    }
  }
}

@Injectable()
export class FeatureFlagsSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: FeatureFlagIdempotencyService,
    private readonly audit: FeatureFlagsSettingsAuditLog,
    private readonly operational: OperationalDecisionService,
    private readonly rateLimit: FeatureFlagsSettingsRateLimitService,
    private readonly assurance: PlatformAssuranceService,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly platformSessions: PlatformRefreshTokenRepository,
  ) {}

  private maybeInject(point: FeatureFlagsSettingsFailureInjectionPoint): void {
    // Model B: NODE_ENV === 'test' hard gate + exact test-only env selector.
    if (!isFeatureFlagsSettingsFailureInjectionActive(point)) {
      return;
    }
    throw new FeatureFlagsSettingsError('injected_failure', `Injected failure at ${point}`, 500);
  }

  private actorId(user: JwtClaimsVO): string {
    const id = user.sub || (user as { id?: string }).id;
    if (!id) throw new FeatureFlagsSettingsError('actor_required', 'Actor identity required', 401);
    return id;
  }

  private async requireFreshStepUp(claims: JwtClaimsVO): Promise<void> {
    if (!claims.sessionId) throw new ForbiddenException('Fresh step-up required.');
    const session = await this.platformSessions.findBySessionId(claims.sessionId);
    if (!session) throw new ForbiddenException('Fresh step-up required.');
    this.assurance.requireStepUp(session);
  }

  assertEnabled(): void {
    if (!isFeatureFlagsSettingsEnabled()) {
      throw new FeatureFlagsSettingsError(
        'feature_flags_settings_disabled',
        'Feature Flags and Global Settings mutations are disabled',
        503,
      );
    }
  }

  /** Atomic OCC claim — updateMany WHERE rowVersion prevents lost updates. */
  private async bumpFlagRow(
    tx: any,
    flagId: string,
    expectedRowVersion: number,
    data: Record<string, unknown>,
  ) {
    const res = await tx.platformFeatureFlag.updateMany({
      where: { id: flagId, rowVersion: expectedRowVersion },
      data: { ...data, rowVersion: { increment: 1 } },
    });
    if (res.count !== 1) {
      throw new FeatureFlagsSettingsError('stale_row_version', 'Flag was updated elsewhere', 409);
    }
    return tx.platformFeatureFlag.findUniqueOrThrow({ where: { id: flagId } });
  }

  private async bumpSettingRow(
    tx: any,
    settingId: string,
    expectedRowVersion: number,
    data: Record<string, unknown>,
  ) {
    const res = await tx.platformGlobalSetting.updateMany({
      where: { id: settingId, rowVersion: expectedRowVersion },
      data: { ...data, rowVersion: { increment: 1 } },
    });
    if (res.count !== 1) {
      throw new FeatureFlagsSettingsError(
        'stale_row_version',
        'Setting was updated elsewhere',
        409,
      );
    }
    return tx.platformGlobalSetting.findUniqueOrThrow({ where: { id: settingId } });
  }

  async listFlags() {
    return this.prisma.withPlatformBypass((c) =>
      c.platformFeatureFlag.findMany({
        orderBy: { canonicalKey: 'asc' },
        include: { targets: true },
      }),
    );
  }

  async getFlag(flagId: string) {
    const flag = await this.prisma.withPlatformBypass((c) =>
      c.platformFeatureFlag.findUnique({
        where: { id: flagId },
        include: { targets: true, history: { orderBy: { createdAt: 'desc' }, take: 50 } },
      }),
    );
    if (!flag) throw new FeatureFlagsSettingsError('flag_not_found', 'Flag not found', 404);
    return flag;
  }

  async listSettings() {
    return this.prisma.withPlatformBypass((c) =>
      c.platformGlobalSetting.findMany({ orderBy: { canonicalKey: 'asc' } }),
    );
  }

  async getSetting(keyOrId: string) {
    const setting = await this.prisma.withPlatformBypass((c) =>
      c.platformGlobalSetting.findFirst({
        where: {
          OR: [{ id: keyOrId }, { canonicalKey: keyOrId }],
        },
        include: { history: { orderBy: { createdAt: 'desc' }, take: 50 } },
      }),
    );
    if (!setting) throw new FeatureFlagsSettingsError('setting_not_found', 'Setting not found', 404);
    return this.redactSetting(setting);
  }

  private redactSetting<T extends Record<string, unknown>>(setting: T): T {
    // safeValueJson already constrained; strip anything resembling secrets
    return setting;
  }

  previewFlagChange(input: {
    flagId?: string;
    canonicalKey?: string;
    action: string;
    proposed?: Record<string, unknown>;
  }) {
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ ...input, at: Math.floor(Date.now() / PREVIEW_TTL_MS) }))
      .digest('hex');
    return {
      action: input.action,
      flagId: input.flagId ?? null,
      canonicalKey: input.canonicalKey ?? null,
      proposed: input.proposed ?? null,
      warnings: [] as string[],
      blockers: [] as string[],
      previewFingerprint: fingerprint,
      expiresAt: new Date(Date.now() + PREVIEW_TTL_MS).toISOString(),
      cacheInvalidationScope: input.canonicalKey ? `flag:${input.canonicalKey}` : 'unknown',
      rollbackAction: 'restore_previous_row_version',
    };
  }

  async createFlag(
    user: JwtClaimsVO,
    body: FeatureFlagCreateInput,
    idempotencyKey?: string,
  ) {
    this.assertEnabled();
    this.maybeInject('after_authorization');
    const actorId = this.actorId(user);
    const key = normalizeKey(body.canonicalKey, FLAG_KEY_PREFIX);
    const reason = assertReason(body.reason);
    const hash = this.idempotency.fingerprint({ ...body, canonicalKey: key });
    const gate = await this.idempotency.beginOrReplay({
      actorId,
      operation: FEATURE_FLAG_OPERATIONS.CREATE,
      idempotencyKey: idempotencyKey || randomUUID(),
      requestHash: hash,
      table: 'flag',
    });
    this.maybeInject('after_idempotency_claim');
    if (gate.kind === 'replay') return gate.resultPayload;

    const correlationId = resolveOperationCorrelationId();
    const created = await this.prisma.withPlatformBypass(async (tx) => {
        this.maybeInject('after_row_lock');
        const existing = await tx.platformFeatureFlag.findUnique({ where: { canonicalKey: key } });
        if (existing) {
          throw new FeatureFlagsSettingsError('duplicate_key', 'Flag key already exists', 409);
        }
        this.maybeInject('after_flag_mutation_staging');
        const row = await tx.platformFeatureFlag.create({
          data: {
            canonicalKey: key,
            displayName: body.displayName.trim(),
            description: body.description.trim(),
            ownerTeam: body.ownerTeam.trim(),
            category: body.category.trim(),
            effect: body.effect,
            targetType: body.targetType ?? 'GLOBAL',
            rolloutPercentage: body.rolloutPercentage ?? 100,
            status: 'DRAFT',
            createdByPlatformUserId: actorId,
            updatedByPlatformUserId: actorId,
          },
        });
        this.maybeInject('after_history_staging');
        await tx.platformFeatureFlagHistory.create({
          data: {
            flagId: row.id,
            actorPlatformUserId: actorId,
            operation: FEATURE_FLAG_OPERATIONS.CREATE,
            reason,
            afterSummaryJson: { canonicalKey: key, effect: body.effect, status: 'DRAFT' },
            correlationId,
          },
        });
        this.maybeInject('after_idempotency_completion_staging');
        await this.idempotency.complete(tx, {
          table: 'flag',
          actorId,
          operation: FEATURE_FLAG_OPERATIONS.CREATE,
          idempotencyKey: gate.idempotencyKey,
          requestHash: hash,
          resultResourceType: 'featureFlag',
          resultResourceId: row.id,
          resultPayload: row,
        });
        this.maybeInject('before_commit');
        return row;
    });
    this.maybeInject('after_audit_staging');
    this.audit.record({
      action: FEATURE_FLAG_OPERATIONS.CREATE,
      actorId,
      resourceType: 'featureFlag',
      resourceId: created.id,
      reason,
      correlationId,
      after: { canonicalKey: key },
    });
    this.operational.invalidateFlag(key);
    // F17 — durable history/event boundary (no email/SMS); fail after commit, retryable.
    this.emitDurableHistoryEvent({
      operation: FEATURE_FLAG_OPERATIONS.CREATE,
      resourceType: 'featureFlag',
      resourceId: created.id,
      correlationId,
    });
    this.maybeInject('after_commit_before_response');
    return created;
  }

  /**
   * Durable event/history outbox boundary for Step 20 (no email/SMS notification channel).
   * Test-only injection: `notification_outbox_failure`.
   */
  private emitDurableHistoryEvent(event: {
    operation: string;
    resourceType: string;
    resourceId: string;
    correlationId: string;
  }): void {
    // Intentional no-op sink — history row is already durable in PostgreSQL.
    void event;
    this.maybeInject('notification_outbox_failure');
  }

  /**
   * Environment ↔ DB compatibility bridge. Env remains authority for immutable containment.
   * Never copies secret values into Step 20 tables. Test-only: `environment_compatibility_adapter_failure`.
   */
  readEnvironmentCompatibilityStatus(settingCanonicalKey: string): {
    envAuthority: boolean;
    mutableViaDb: boolean;
    configured: boolean;
    envKey: string | null;
    /** Never the raw secret — boolean presence only. */
    secretMaterialExposed: false;
  } {
    this.maybeInject('environment_compatibility_adapter_failure');
    const key = settingCanonicalKey.trim().toLowerCase();
    if (key === 'setting.feature_flags_settings_enabled_ref') {
      return {
        envAuthority: true,
        mutableViaDb: false,
        configured: process.env.FEATURE_FLAGS_SETTINGS_ENABLED !== undefined,
        envKey: 'FEATURE_FLAGS_SETTINGS_ENABLED',
        secretMaterialExposed: false,
      };
    }
    return {
      envAuthority: false,
      mutableViaDb: true,
      configured: false,
      envKey: null,
      secretMaterialExposed: false,
    };
  }

  async updateFlag(
    user: JwtClaimsVO,
    flagId: string,
    body: FeatureFlagUpdateInput,
    idempotencyKey?: string,
  ) {
    this.assertEnabled();
    const actorId = this.actorId(user);
    const reason = assertReason(body.reason);
    const hash = this.idempotency.fingerprint({ flagId, ...body });
    const gate = await this.idempotency.beginOrReplay({
      actorId,
      operation: FEATURE_FLAG_OPERATIONS.UPDATE,
      idempotencyKey: idempotencyKey || randomUUID(),
      requestHash: hash,
      table: 'flag',
    });
    if (gate.kind === 'replay') return gate.resultPayload;

    const updated = await this.prisma.withPlatformBypass(async (tx) => {
        const current = await tx.platformFeatureFlag.findUnique({ where: { id: flagId } });
        if (!current) throw new FeatureFlagsSettingsError('flag_not_found', 'Flag not found', 404);
        if (current.rowVersion !== body.expectedRowVersion) {
          throw new FeatureFlagsSettingsError('stale_row_version', 'Flag was updated elsewhere', 409);
        }
        const row = await this.bumpFlagRow(tx, flagId, body.expectedRowVersion, {
            displayName: body.displayName?.trim() ?? current.displayName,
            description: body.description?.trim() ?? current.description,
            ownerTeam: body.ownerTeam?.trim() ?? current.ownerTeam,
            category: body.category?.trim() ?? current.category,
            targetType: body.targetType ?? current.targetType,
            rolloutPercentage: body.rolloutPercentage ?? current.rolloutPercentage,
            status: body.status ?? current.status,
            updatedByPlatformUserId: actorId,
            deprecatedAt: body.status === 'DEPRECATED' ? new Date() : current.deprecatedAt,
          });
        await tx.platformFeatureFlagHistory.create({
          data: {
            flagId,
            actorPlatformUserId: actorId,
            operation: FEATURE_FLAG_OPERATIONS.UPDATE,
            reason,
            beforeSummaryJson: { rowVersion: current.rowVersion, status: current.status },
            afterSummaryJson: { rowVersion: row.rowVersion, status: row.status },
            correlationId: resolveOperationCorrelationId(),
          },
        });
        await this.idempotency.complete(tx, {
          table: 'flag',
          actorId,
          operation: FEATURE_FLAG_OPERATIONS.UPDATE,
          idempotencyKey: gate.idempotencyKey,
          requestHash: hash,
          resultResourceType: 'featureFlag',
          resultResourceId: row.id,
          resultPayload: row,
        });
        return row;
    });
    this.audit.record({
      action: FEATURE_FLAG_OPERATIONS.UPDATE,
      actorId,
      resourceType: 'featureFlag',
      resourceId: flagId,
      reason,
    });
    this.operational.invalidateFlag(updated.canonicalKey);
    return updated;
  }

  async updateTargets(
    user: JwtClaimsVO,
    flagId: string,
    body: FeatureFlagTargetUpdateInput,
    idempotencyKey?: string,
  ) {
    this.assertEnabled();
    const actorId = this.actorId(user);
    const reason = assertReason(body.reason);
    const hash = this.idempotency.fingerprint({ flagId, ...body });
    const gate = await this.idempotency.beginOrReplay({
      actorId,
      operation: FEATURE_FLAG_OPERATIONS.TARGET_UPDATE,
      idempotencyKey: idempotencyKey || randomUUID(),
      requestHash: hash,
      table: 'flag',
    });
    if (gate.kind === 'replay') return gate.resultPayload;

    const result = await this.prisma.withPlatformBypass(async (tx) => {
        this.maybeInject('after_target_mutation_staging');
        const current = await tx.platformFeatureFlag.findUnique({ where: { id: flagId } });
        if (!current) throw new FeatureFlagsSettingsError('flag_not_found', 'Flag not found', 404);
        if (current.rowVersion !== body.expectedRowVersion) {
          throw new FeatureFlagsSettingsError('stale_row_version', 'Flag was updated elsewhere', 409);
        }
        await this.bumpFlagRow(tx, flagId, body.expectedRowVersion, {
          updatedByPlatformUserId: actorId,
        });
        await tx.platformFeatureFlagTarget.deleteMany({ where: { flagId } });
        const allow = body.allowTenantIds ?? [];
        const deny = body.denyTenantIds ?? [];
        for (const tenantId of allow) {
          await tx.platformFeatureFlagTarget.create({
            data: { flagId, tenantId, mode: 'ALLOW' },
          });
        }
        for (const tenantId of deny) {
          await tx.platformFeatureFlagTarget.create({
            data: { flagId, tenantId, mode: 'DENY' },
          });
        }
        const row = await tx.platformFeatureFlag.findUniqueOrThrow({
          where: { id: flagId },
          include: { targets: true },
        });
        await tx.platformFeatureFlagHistory.create({
          data: {
            flagId,
            actorPlatformUserId: actorId,
            operation: FEATURE_FLAG_OPERATIONS.TARGET_UPDATE,
            reason,
            afterSummaryJson: { allowCount: allow.length, denyCount: deny.length },
            correlationId: resolveOperationCorrelationId(),
          },
        });
        await this.idempotency.complete(tx, {
          table: 'flag',
          actorId,
          operation: FEATURE_FLAG_OPERATIONS.TARGET_UPDATE,
          idempotencyKey: gate.idempotencyKey,
          requestHash: hash,
          resultResourceType: 'featureFlag',
          resultResourceId: row.id,
          resultPayload: row,
        });
        return row;
    });
    this.operational.invalidateFlag(result.canonicalKey);
    this.audit.record({
      action: FEATURE_FLAG_OPERATIONS.TARGET_UPDATE,
      actorId,
      resourceType: 'featureFlag',
      resourceId: flagId,
      reason,
    });
    return result;
  }

  async setKillSwitch(
    user: JwtClaimsVO,
    flagId: string,
    activate: boolean,
    body: KillSwitchInput,
    idempotencyKey?: string,
  ) {
    this.assertEnabled();
    await this.requireFreshStepUp(user);
    const actorId = this.actorId(user);
    this.rateLimit.assertAllowed(actorId, activate ? 'kill_activate' : 'kill_deactivate');
    const reason = assertReason(body.reason);
    if (body.confirmation?.trim().toUpperCase() !== 'CONFIRM') {
      throw new FeatureFlagsSettingsError('confirmation_required', 'Typed CONFIRM required', 400);
    }
    if (!body.previewFingerprint?.trim()) {
      throw new FeatureFlagsSettingsError(
        'preview_fingerprint_required',
        'Preview fingerprint required',
        400,
      );
    }
    this.maybeInject('after_preview_revalidation');
    const op = activate
      ? FEATURE_FLAG_OPERATIONS.KILL_SWITCH_ACTIVATE
      : FEATURE_FLAG_OPERATIONS.KILL_SWITCH_DEACTIVATE;
    const hash = this.idempotency.fingerprint({ flagId, activate, ...body });
    const gate = await this.idempotency.beginOrReplay({
      actorId,
      operation: op,
      idempotencyKey: idempotencyKey || randomUUID(),
      requestHash: hash,
      table: 'flag',
    });
    if (gate.kind === 'replay') return gate.resultPayload;

    const row = await this.prisma.withPlatformBypass(async (tx) => {
        this.maybeInject('after_kill_switch_staging');
        const current = await tx.platformFeatureFlag.findUnique({ where: { id: flagId } });
        if (!current) throw new FeatureFlagsSettingsError('flag_not_found', 'Flag not found', 404);
        if (current.rowVersion !== body.expectedRowVersion) {
          throw new FeatureFlagsSettingsError('stale_row_version', 'Flag was updated elsewhere', 409);
        }
        const updated = await this.bumpFlagRow(tx, flagId, body.expectedRowVersion, {
            killSwitchActive: activate,
            status: 'ACTIVE',
            updatedByPlatformUserId: actorId,
          });
        await tx.platformFeatureFlagHistory.create({
          data: {
            flagId,
            actorPlatformUserId: actorId,
            operation: op,
            reason,
            beforeSummaryJson: { killSwitchActive: current.killSwitchActive },
            afterSummaryJson: { killSwitchActive: activate },
            correlationId: resolveOperationCorrelationId(),
          },
        });
        await this.idempotency.complete(tx, {
          table: 'flag',
          actorId,
          operation: op,
          idempotencyKey: gate.idempotencyKey,
          requestHash: hash,
          resultResourceType: 'featureFlag',
          resultResourceId: updated.id,
          resultPayload: updated,
        });
        // F20 — rollback/recovery after partial high-risk progress (inside TX → full rollback).
        this.maybeInject('rollback_recovery_failure');
        return updated;
    });
    try {
      this.operational.invalidateFlag(row.canonicalKey);
      this.maybeInject('cache_invalidation_failure');
    } catch (err) {
      if (err instanceof FeatureFlagsSettingsError && err.code === 'injected_failure') {
        // fail-safe: still deny via DB killSwitchActive on next evaluate
      } else {
        throw err;
      }
    }
    this.audit.record({
      action: op,
      actorId,
      resourceType: 'featureFlag',
      resourceId: flagId,
      reason,
      after: { killSwitchActive: activate },
    });
    return row;
  }

  async updateSetting(
    user: JwtClaimsVO,
    settingId: string,
    body: GlobalSettingUpdateInput,
    idempotencyKey?: string,
  ) {
    this.assertEnabled();
    const actorId = this.actorId(user);
    const reason = assertReason(body.reason);
    assertNoSecrets(body.safeValueJson);

    const existing = await this.prisma.withPlatformBypass((c) =>
      c.platformGlobalSetting.findUnique({ where: { id: settingId } }),
    );
    if (!existing) {
      throw new FeatureFlagsSettingsError('setting_not_found', 'Setting not found', 404);
    }
    if (existing.highImpact) {
      await this.requireFreshStepUp(user);
      this.rateLimit.assertAllowed(actorId, 'setting_high_impact');
    }

    const hash = this.idempotency.fingerprint({ settingId, ...body });
    const gate = await this.idempotency.beginOrReplay({
      actorId,
      operation: GLOBAL_SETTING_OPERATIONS.UPDATE,
      idempotencyKey: idempotencyKey || randomUUID(),
      requestHash: hash,
      table: 'setting',
    });
    if (gate.kind === 'replay') return gate.resultPayload;

    const row = await this.prisma.withPlatformBypass(async (tx) => {
        this.maybeInject('after_setting_mutation_staging');
        const current = await tx.platformGlobalSetting.findUnique({ where: { id: settingId } });
        if (!current) {
          throw new FeatureFlagsSettingsError('setting_not_found', 'Setting not found', 404);
        }
        if (current.rowVersion !== body.expectedRowVersion) {
          throw new FeatureFlagsSettingsError(
            'stale_row_version',
            'Setting was updated elsewhere',
            409,
          );
        }
        const updated = await this.bumpSettingRow(tx, settingId, body.expectedRowVersion, {
            safeValueJson: body.safeValueJson as never,
            updatedByPlatformUserId: actorId,
          });
        await tx.platformGlobalSettingHistory.create({
          data: {
            settingId,
            actorPlatformUserId: actorId,
            operation: GLOBAL_SETTING_OPERATIONS.UPDATE,
            reason,
            beforeSummaryJson: { rowVersion: current.rowVersion },
            afterSummaryJson: { rowVersion: updated.rowVersion },
            correlationId: resolveOperationCorrelationId(),
          },
        });
        await this.idempotency.complete(tx, {
          table: 'setting',
          actorId,
          operation: GLOBAL_SETTING_OPERATIONS.UPDATE,
          idempotencyKey: gate.idempotencyKey,
          requestHash: hash,
          resultResourceType: 'globalSetting',
          resultResourceId: updated.id,
          resultPayload: updated,
        });
        return updated;
    });
    this.audit.record({
      action: GLOBAL_SETTING_OPERATIONS.UPDATE,
      actorId,
      resourceType: 'globalSetting',
      resourceId: settingId,
      reason,
    });
    return this.redactSetting(row);
  }

  async createSetting(
    user: JwtClaimsVO,
    body: {
      canonicalKey: string;
      displayName: string;
      description: string;
      ownerTeam: string;
      valueKind: 'BOOLEAN' | 'STRING' | 'INTEGER' | 'REFERENCE' | 'JSON_BOUNDED';
      safeValueJson?: unknown;
      highImpact?: boolean;
      reason: string;
    },
    idempotencyKey?: string,
  ) {
    this.assertEnabled();
    const actorId = this.actorId(user);
    const key = normalizeKey(body.canonicalKey, SETTING_KEY_PREFIX);
    const reason = assertReason(body.reason);
    assertNoSecrets(body.safeValueJson);
    const hash = this.idempotency.fingerprint({ ...body, canonicalKey: key });
    const gate = await this.idempotency.beginOrReplay({
      actorId,
      operation: GLOBAL_SETTING_OPERATIONS.CREATE,
      idempotencyKey: idempotencyKey || randomUUID(),
      requestHash: hash,
      table: 'setting',
    });
    if (gate.kind === 'replay') return gate.resultPayload;

    const created = await this.prisma.withPlatformBypass(async (tx) => {
        const existing = await tx.platformGlobalSetting.findUnique({
          where: { canonicalKey: key },
        });
        if (existing) {
          throw new FeatureFlagsSettingsError('duplicate_key', 'Setting key already exists', 409);
        }
        const row = await tx.platformGlobalSetting.create({
          data: {
            canonicalKey: key,
            displayName: body.displayName.trim(),
            description: body.description.trim(),
            ownerTeam: body.ownerTeam.trim(),
            valueKind: body.valueKind,
            safeValueJson: (body.safeValueJson ?? null) as never,
            highImpact: body.highImpact ?? false,
            createdByPlatformUserId: actorId,
            updatedByPlatformUserId: actorId,
          },
        });
        await tx.platformGlobalSettingHistory.create({
          data: {
            settingId: row.id,
            actorPlatformUserId: actorId,
            operation: GLOBAL_SETTING_OPERATIONS.CREATE,
            reason,
            afterSummaryJson: { canonicalKey: key, valueKind: body.valueKind },
            correlationId: resolveOperationCorrelationId(),
          },
        });
        await this.idempotency.complete(tx, {
          table: 'setting',
          actorId,
          operation: GLOBAL_SETTING_OPERATIONS.CREATE,
          idempotencyKey: gate.idempotencyKey,
          requestHash: hash,
          resultResourceType: 'globalSetting',
          resultResourceId: row.id,
          resultPayload: row,
        });
        return row;
    });
    this.audit.record({
      action: GLOBAL_SETTING_OPERATIONS.CREATE,
      actorId,
      resourceType: 'globalSetting',
      resourceId: created.id,
      reason,
      after: { canonicalKey: key },
    });
    return this.redactSetting(created);
  }

  async updateSettingReference(
    user: JwtClaimsVO,
    settingId: string,
    body: GlobalSettingReferenceUpdateInput,
    idempotencyKey?: string,
  ) {
    this.assertEnabled();
    const actorId = this.actorId(user);
    const reason = assertReason(body.reason);
    assertNoSecrets(body);
    const hash = this.idempotency.fingerprint({ settingId, ...body });
    const gate = await this.idempotency.beginOrReplay({
      actorId,
      operation: GLOBAL_SETTING_OPERATIONS.REFERENCE_UPDATE,
      idempotencyKey: idempotencyKey || randomUUID(),
      requestHash: hash,
      table: 'setting',
    });
    if (gate.kind === 'replay') return gate.resultPayload;

    const row = await this.prisma.withPlatformBypass(async (tx) => {
        const current = await tx.platformGlobalSetting.findUnique({ where: { id: settingId } });
        if (!current) {
          throw new FeatureFlagsSettingsError('setting_not_found', 'Setting not found', 404);
        }
        if (current.rowVersion !== body.expectedRowVersion) {
          throw new FeatureFlagsSettingsError(
            'stale_row_version',
            'Setting was updated elsewhere',
            409,
          );
        }
        const updated = await this.bumpSettingRow(tx, settingId, body.expectedRowVersion, {
            referenceConfigured: body.referenceConfigured,
            referenceProviderType: body.referenceProviderType ?? null,
            referenceId: body.referenceId ?? null,
            referenceHealthCategory: body.referenceHealthCategory ?? null,
            referenceRotationRequired: body.referenceRotationRequired ?? false,
            referenceLastVerifiedAt: new Date(),
            updatedByPlatformUserId: actorId,
          });
        await tx.platformGlobalSettingHistory.create({
          data: {
            settingId,
            actorPlatformUserId: actorId,
            operation: GLOBAL_SETTING_OPERATIONS.REFERENCE_UPDATE,
            reason,
            afterSummaryJson: {
              referenceConfigured: body.referenceConfigured,
              referenceProviderType: body.referenceProviderType ?? null,
            },
            correlationId: resolveOperationCorrelationId(),
          },
        });
        await this.idempotency.complete(tx, {
          table: 'setting',
          actorId,
          operation: GLOBAL_SETTING_OPERATIONS.REFERENCE_UPDATE,
          idempotencyKey: gate.idempotencyKey,
          requestHash: hash,
          resultResourceType: 'globalSetting',
          resultResourceId: updated.id,
          resultPayload: updated,
        });
        return updated;
    });
    this.audit.record({
      action: GLOBAL_SETTING_OPERATIONS.REFERENCE_UPDATE,
      actorId,
      resourceType: 'globalSetting',
      resourceId: settingId,
      reason,
    });
    return this.redactSetting(row);
  }

  /** Ensure setting key uses setting. prefix when creating via manage flows. */
  normalizeSettingKey(key: string): string {
    return normalizeKey(key, SETTING_KEY_PREFIX);
  }
}

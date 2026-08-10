import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TenantPolicyService } from '../../settings/application/services/tenant-policy.service';
import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';
import type { PermissionAction } from '../../../common/authorization/permission-matrix.validation';
import {
  API_CREDENTIAL_REPOSITORY,
  SERVICE_ACCOUNT_REPOSITORY,
  type ApiCredentialRepository,
  type ServiceAccountRepository,
} from './ports/repositories';
import type { CredentialService } from './ports/services';
import {
  generateApiCredentialMaterial,
  isPepperConfigured,
  resolvePepperMaterial,
  verifyApiCredentialHash,
  hashLegacySettingsKey,
  redactCredentialSecrets,
} from '../domain/credential-hashing';
import {
  mapLegacySettingsScopesToCenter,
  validateCredentialScopes,
} from '../domain/credential-scopes';
import {
  assertCredentialTransition,
  isCredentialAuthnEligible,
  isTerminalCredentialStatus,
} from '../domain/credential-status.machine';
import type {
  ApiCredential,
  ApiCredentialMetadata,
  ApiCredentialOwnerType,
  ServiceAccount,
} from '../domain/integrations.entities';
import { toCredentialMetadata } from '../domain/integrations.entities';
import {
  isApiKeysIntegrationsCenterEnabled,
  loadIntegrationsFoundationConfig,
} from '../config/integrations-config';
import {
  INTEGRATIONS_PERMISSION_RESOURCE,
  INTEGRATIONS_SERVICE_ACCOUNTS_ENABLED_ENV,
} from '../integrations.constants';
import { IntegrationsActivityEmitterService } from './integrations-activity.emitter';
import { IntegrationsAuditLog } from '../infrastructure/integrations-audit.log';
import { IntegrationsCredentialObservabilityHooks } from './integrations-credential-observability.hooks';
import { IntegrationsLegacyCompatibilityService } from './integrations-legacy-compatibility.service';
import { IntegrationsNotificationIntentRegistrar } from './integrations-notification-intent.registrar';

export interface CredentialActorContext {
  tenantId: string;
  actorId: string;
  actorRoles: readonly string[];
  branchId?: string | null;
  correlationId?: string;
  causationId?: string | null;
}

export interface IssueApiCredentialInput extends CredentialActorContext {
  name: string;
  scopes: readonly string[];
  ownerType: ApiCredentialOwnerType;
  ownerId: string;
  expiresAt?: string | null;
  integrationBound?: boolean;
}

export interface IssueApiCredentialResult {
  metadata: ApiCredentialMetadata;
  /** One-time reveal — never persisted / never logged. */
  rawCredential: string;
}

@Injectable()
export class CredentialEngineService implements CredentialService {
  readonly contractVersion = '44b' as const;

  constructor(
    @Inject(API_CREDENTIAL_REPOSITORY)
    private readonly credentials: ApiCredentialRepository,
    @Inject(SERVICE_ACCOUNT_REPOSITORY)
    private readonly serviceAccounts: ServiceAccountRepository,
    private readonly tenantPolicy: TenantPolicyService,
    private readonly activity: IntegrationsActivityEmitterService,
    private readonly audit: IntegrationsAuditLog,
    private readonly metrics: IntegrationsCredentialObservabilityHooks,
    private readonly legacy: IntegrationsLegacyCompatibilityService,
    private readonly notificationIntents: IntegrationsNotificationIntentRegistrar,
  ) {}

  private requireFeatureEnabled(): void {
    if (!isApiKeysIntegrationsCenterEnabled()) {
      throw new ForbiddenException(
        'API_KEYS_INTEGRATIONS_CENTER_ENABLED=false — Integrations Center dormant',
      );
    }
  }

  private requirePepper(): string {
    const pepper = resolvePepperMaterial();
    if (!pepper || !isPepperConfigured()) {
      throw new ForbiddenException(
        'API credential pepper not configured — fail closed',
      );
    }
    return pepper;
  }

  private async requireLicense(tenantId: string): Promise<void> {
    const policy = await this.tenantPolicy.getAdvancedPolicy(tenantId);
    if (!policy.allowIntegrations) {
      throw new ForbiddenException(
        'License denied: allowIntegrations=false',
      );
    }
  }

  private requirePermission(
    roles: readonly string[],
    action: PermissionAction,
  ): void {
    if (
      !rolesCanAccessResource([...roles], INTEGRATIONS_PERMISSION_RESOURCE, action)
    ) {
      throw new ForbiddenException(
        `Missing permission ${INTEGRATIONS_PERMISSION_RESOURCE}:${action}`,
      );
    }
  }

  private correlation(ctx: CredentialActorContext): string {
    return ctx.correlationId?.trim() || randomUUID();
  }

  private allowHighRisk(roles: readonly string[]): boolean {
    if (roles.map(String).includes('owner')) return true;
    return rolesCanAccessResource(
      [...roles],
      INTEGRATIONS_PERMISSION_RESOURCE,
      'approve',
    );
  }

  async listServiceAccounts(input: {
    tenantId: string;
    actorRoles: readonly string[];
  }): Promise<readonly ServiceAccount[]> {
    this.requireFeatureEnabled();
    await this.requireLicense(input.tenantId);
    this.requirePermission(input.actorRoles, 'view');
    return this.serviceAccounts.listByTenant(input.tenantId);
  }

  async createServiceAccount(input: {
    tenantId: string;
    actorId: string;
    actorRoles: readonly string[];
    displayName: string;
    roleBindings?: readonly string[];
    branchId?: string | null;
    correlationId?: string;
  }): Promise<ServiceAccount> {
    this.requireFeatureEnabled();
    await this.requireLicense(input.tenantId);
    this.requirePermission(input.actorRoles, 'create');
    const flags = loadIntegrationsFoundationConfig().flags;
    if (!flags.serviceAccountsEnabled) {
      throw new ForbiddenException(
        `${INTEGRATIONS_SERVICE_ACCOUNTS_ENABLED_ENV}=false`,
      );
    }

    const now = new Date().toISOString();
    const account: ServiceAccount = {
      id: randomUUID(),
      tenantId: input.tenantId,
      displayName: input.displayName.trim(),
      status: 'active',
      roleBindings: [...(input.roleBindings ?? [])],
      createdBy: input.actorId,
      createdAt: now,
      updatedAt: now,
      disabledAt: null,
    };
    if (!account.displayName) {
      throw new BadRequestException('displayName is required');
    }
    await this.serviceAccounts.save(account);
    const correlationId = input.correlationId ?? randomUUID();
    await this.activity.emit('service_account_created', {
      tenantId: input.tenantId,
      serviceAccountId: account.id,
      status: account.status,
      correlationId,
    });
    await this.audit.record({
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      action: 'integrations.service_account.created',
      resourceId: account.id,
      actorId: input.actorId,
      actorRoles: [...input.actorRoles],
      correlationId,
      details: { displayName: account.displayName, status: account.status },
    });
    return account;
  }

  async disableServiceAccount(input: {
    tenantId: string;
    serviceAccountId: string;
    actorId: string;
    actorRoles: readonly string[];
    branchId?: string | null;
    correlationId?: string;
  }): Promise<ServiceAccount> {
    this.requireFeatureEnabled();
    await this.requireLicense(input.tenantId);
    this.requirePermission(input.actorRoles, 'manage');

    const existing = await this.serviceAccounts.findById(
      input.tenantId,
      input.serviceAccountId,
    );
    if (!existing || existing.tenantId !== input.tenantId) {
      throw new NotFoundException('Service account not found');
    }
    if (existing.status === 'disabled') return existing;

    const now = new Date().toISOString();
    const updated: ServiceAccount = {
      ...existing,
      status: 'disabled',
      disabledAt: now,
      updatedAt: now,
    };
    await this.serviceAccounts.save(updated);
    const correlationId = input.correlationId ?? randomUUID();
    await this.activity.emit('service_account_disabled', {
      tenantId: input.tenantId,
      serviceAccountId: updated.id,
      status: updated.status,
      correlationId,
    });
    await this.audit.record({
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      action: 'integrations.service_account.disabled',
      resourceId: updated.id,
      actorId: input.actorId,
      actorRoles: [...input.actorRoles],
      correlationId,
      details: { status: updated.status },
    });
    return updated;
  }

  async validateCredentialScopes(
    scopes: readonly string[],
    actorRoles: readonly string[],
  ): Promise<readonly string[]> {
    return validateCredentialScopes(scopes, {
      allowHighRisk: this.allowHighRisk(actorRoles),
    });
  }

  async issueApiCredential(
    input: IssueApiCredentialInput,
  ): Promise<IssueApiCredentialResult> {
    this.requireFeatureEnabled();
    await this.requireLicense(input.tenantId);
    this.requirePermission(input.actorRoles, 'create');
    const pepper = this.requirePepper();

    const scopes = validateCredentialScopes(input.scopes, {
      allowHighRisk: this.allowHighRisk(input.actorRoles),
    });

    if (input.ownerType === 'service_account') {
      const sa = await this.serviceAccounts.findById(
        input.tenantId,
        input.ownerId,
      );
      if (!sa || sa.tenantId !== input.tenantId) {
        throw new NotFoundException('Service account owner not found');
      }
      if (sa.status !== 'active') {
        throw new BadRequestException('Service account is disabled');
      }
    }

    const material = generateApiCredentialMaterial({
      pepper,
      integrationBound: input.integrationBound === true,
    });

    const duplicate = await this.credentials.findByKeyHash(
      input.tenantId,
      material.keyHash,
    );
    if (duplicate) {
      throw new BadRequestException('Duplicate active credential hash');
    }

    const now = new Date().toISOString();
    const correlationId = this.correlation(input);
    const credential: ApiCredential = {
      id: randomUUID(),
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      name: input.name.trim(),
      prefix: material.prefix,
      keyHash: material.keyHash,
      hashAlgorithm: material.hashAlgorithm,
      status: 'active',
      scopes,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      expiresAt: input.expiresAt ?? null,
      lastUsedAt: null,
      createdBy: input.actorId,
      rotatedFromId: null,
      rotationGraceEndsAt: null,
      createdAt: now,
      updatedAt: now,
      revokedAt: null,
    };
    if (!credential.name) {
      throw new BadRequestException('name is required');
    }

    await this.credentials.save(credential);
    await this.legacy.dualWriteNewCredential({
      tenantId: input.tenantId,
      actorId: input.actorId,
      name: credential.name,
      prefix: credential.prefix,
      legacyHash: hashLegacySettingsKey(material.raw),
      centerCredentialId: credential.id,
      createdAt: credential.createdAt,
    });

    await this.activity.emit('credential_created', {
      tenantId: input.tenantId,
      branchId: input.branchId,
      credentialId: credential.id,
      status: credential.status,
      correlationId,
      causationId: input.causationId,
    });
    await this.audit.record({
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      action: 'integrations.credential.created',
      resourceId: credential.id,
      actorId: input.actorId,
      actorRoles: [...input.actorRoles],
      correlationId,
      causationId: input.causationId,
      details: {
        prefix: credential.prefix,
        status: credential.status,
        ownerType: credential.ownerType,
        scopes: scopes.join(','),
      },
    });
    this.metrics.increment('integrations.credentials.created');

    // Raw only in return value — not in audit/activity/metrics.
    return {
      metadata: toCredentialMetadata(credential),
      rawCredential: material.raw,
    };
  }

  async rotateApiCredential(input: {
    tenantId: string;
    credentialId: string;
    actorId: string;
    actorRoles: readonly string[];
    branchId?: string | null;
    correlationId?: string;
    causationId?: string | null;
  }): Promise<IssueApiCredentialResult> {
    this.requireFeatureEnabled();
    await this.requireLicense(input.tenantId);
    this.requirePermission(input.actorRoles, 'update');
    const pepper = this.requirePepper();

    const existing = await this.credentials.findById(
      input.tenantId,
      input.credentialId,
    );
    if (!existing || existing.tenantId !== input.tenantId) {
      throw new NotFoundException('Credential not found');
    }
    if (isTerminalCredentialStatus(existing.status)) {
      throw new BadRequestException(
        `Cannot rotate terminal credential status=${existing.status}`,
      );
    }
    if (existing.status === 'rotated') {
      throw new BadRequestException('Credential already rotated');
    }

    const material = generateApiCredentialMaterial({ pepper });
    const dup = await this.credentials.findByKeyHash(
      input.tenantId,
      material.keyHash,
    );
    if (dup) {
      throw new BadRequestException('Duplicate active credential hash');
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const graceHours =
      loadIntegrationsFoundationConfig().defaults.rotationGraceHours;
    const graceEnds = new Date(
      nowDate.getTime() + graceHours * 60 * 60 * 1000,
    ).toISOString();
    const correlationId = this.correlation(input);

    assertCredentialTransition(existing.status, 'rotated');
    const predecessor: ApiCredential = {
      ...existing,
      status: 'rotated',
      rotationGraceEndsAt: graceEnds,
      updatedAt: now,
    };

    const successor: ApiCredential = {
      id: randomUUID(),
      tenantId: existing.tenantId,
      branchId: existing.branchId,
      name: existing.name,
      prefix: material.prefix,
      keyHash: material.keyHash,
      hashAlgorithm: material.hashAlgorithm,
      status: 'active',
      scopes: existing.scopes,
      ownerType: existing.ownerType,
      ownerId: existing.ownerId,
      expiresAt: existing.expiresAt,
      lastUsedAt: null,
      createdBy: input.actorId,
      rotatedFromId: existing.id,
      rotationGraceEndsAt: null,
      createdAt: now,
      updatedAt: now,
      revokedAt: null,
    };

    await this.credentials.saveMany([predecessor, successor]);
    await this.legacy.dualWriteNewCredential({
      tenantId: input.tenantId,
      actorId: input.actorId,
      name: successor.name,
      prefix: successor.prefix,
      legacyHash: hashLegacySettingsKey(material.raw),
      centerCredentialId: successor.id,
      createdAt: successor.createdAt,
    });

    await this.activity.emit('credential_rotated', {
      tenantId: input.tenantId,
      branchId: input.branchId,
      credentialId: successor.id,
      status: successor.status,
      correlationId,
      causationId: input.causationId,
      reason: `predecessor=${predecessor.id}`,
    });
    await this.audit.record({
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      action: 'integrations.credential.rotated',
      resourceId: successor.id,
      actorId: input.actorId,
      actorRoles: [...input.actorRoles],
      correlationId,
      details: {
        predecessorId: predecessor.id,
        graceEndsAt: graceEnds,
        prefix: successor.prefix,
      },
    });
    this.metrics.increment('integrations.credentials.rotated');

    return {
      metadata: toCredentialMetadata(successor),
      rawCredential: material.raw,
    };
  }

  async revokeApiCredential(input: {
    tenantId: string;
    credentialId: string;
    actorId: string;
    actorRoles: readonly string[];
    branchId?: string | null;
    correlationId?: string;
    reason?: string;
  }): Promise<ApiCredentialMetadata> {
    this.requireFeatureEnabled();
    await this.requireLicense(input.tenantId);
    this.requirePermission(input.actorRoles, 'delete');

    const existing = await this.credentials.findById(
      input.tenantId,
      input.credentialId,
    );
    if (!existing || existing.tenantId !== input.tenantId) {
      throw new NotFoundException('Credential not found');
    }
    if (existing.status === 'revoked') {
      return toCredentialMetadata(existing);
    }
    if (existing.status === 'expired') {
      throw new BadRequestException(
        'Expired credential cannot be revoked (already terminal)',
      );
    }

    assertCredentialTransition(existing.status, 'revoked');
    const now = new Date().toISOString();
    const updated: ApiCredential = {
      ...existing,
      status: 'revoked',
      revokedAt: now,
      rotationGraceEndsAt: null,
      updatedAt: now,
    };
    await this.credentials.save(updated);
    const correlationId = this.correlation(input);
    await this.activity.emit('credential_revoked', {
      tenantId: input.tenantId,
      credentialId: updated.id,
      status: updated.status,
      correlationId,
      reason: input.reason,
    });
    await this.audit.record({
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      action: 'integrations.credential.revoked',
      resourceId: updated.id,
      actorId: input.actorId,
      actorRoles: [...input.actorRoles],
      correlationId,
      details: { prefix: updated.prefix, status: updated.status },
      reason: input.reason ?? null,
    });
    this.notificationIntents.recordIntent('credential_revoked', {
      tenantId: input.tenantId,
      credentialId: updated.id,
      correlationId,
    });
    this.metrics.increment('integrations.credentials.revoked');
    return toCredentialMetadata(updated);
  }

  /**
   * Expire credentials past expiresAt, and finalize rotation grace → revoked.
   */
  async expireApiCredentials(input: {
    tenantId: string;
    actorId?: string;
    actorRoles?: readonly string[];
    now?: Date;
  }): Promise<{ expired: number; graceRevoked: number }> {
    this.requireFeatureEnabled();
    await this.requireLicense(input.tenantId);
    if (input.actorRoles) {
      this.requirePermission(input.actorRoles, 'manage');
    }

    const now = input.now ?? new Date();
    const nowIso = now.toISOString();
    const list = await this.credentials.listByTenant(input.tenantId);
    let expired = 0;
    let graceRevoked = 0;

    for (const cred of list) {
      if (cred.tenantId !== input.tenantId) continue;

      if (
        cred.status === 'rotated' &&
        cred.rotationGraceEndsAt &&
        new Date(cred.rotationGraceEndsAt).getTime() <= now.getTime()
      ) {
        assertCredentialTransition('rotated', 'revoked');
        await this.credentials.save({
          ...cred,
          status: 'revoked',
          revokedAt: nowIso,
          rotationGraceEndsAt: null,
          updatedAt: nowIso,
        });
        graceRevoked += 1;
        await this.activity.emit('credential_revoked', {
          tenantId: input.tenantId,
          credentialId: cred.id,
          status: 'revoked',
          reason: 'rotation_grace_elapsed',
        });
        await this.audit.record({
          tenantId: input.tenantId,
          action: 'integrations.credential.revoked',
          resourceId: cred.id,
          actorId: input.actorId ?? 'system',
          actorRoles: input.actorRoles ? [...input.actorRoles] : ['system'],
          details: { reason: 'rotation_grace_elapsed' },
        });
        continue;
      }

      if (
        (cred.status === 'active' ||
          cred.status === 'expiring' ||
          cred.status === 'rotated') &&
        cred.expiresAt &&
        new Date(cred.expiresAt).getTime() <= now.getTime()
      ) {
        if (cred.status === 'rotated') {
          assertCredentialTransition('rotated', 'revoked');
          await this.credentials.save({
            ...cred,
            status: 'revoked',
            revokedAt: nowIso,
            updatedAt: nowIso,
          });
        } else {
          assertCredentialTransition(cred.status, 'expired');
          await this.credentials.save({
            ...cred,
            status: 'expired',
            updatedAt: nowIso,
          });
          expired += 1;
          await this.activity.emit('credential_expired', {
            tenantId: input.tenantId,
            credentialId: cred.id,
            status: 'expired',
          });
          await this.audit.record({
            tenantId: input.tenantId,
            action: 'integrations.credential.expired',
            resourceId: cred.id,
            actorId: input.actorId ?? 'system',
            actorRoles: input.actorRoles ? [...input.actorRoles] : ['system'],
            details: { prefix: cred.prefix },
          });
          this.notificationIntents.recordIntent('credential_expiring', {
            tenantId: input.tenantId,
            credentialId: cred.id,
          });
        }
      }
    }

    return { expired, graceRevoked };
  }

  async getCredentialMetadata(input: {
    tenantId: string;
    credentialId: string;
    actorRoles: readonly string[];
  }): Promise<ApiCredentialMetadata> {
    this.requireFeatureEnabled();
    await this.requireLicense(input.tenantId);
    this.requirePermission(input.actorRoles, 'view');

    const existing = await this.credentials.findById(
      input.tenantId,
      input.credentialId,
    );
    if (!existing || existing.tenantId !== input.tenantId) {
      throw new NotFoundException('Credential not found');
    }
    return toCredentialMetadata(existing);
  }

  async listCredentialMetadata(input: {
    tenantId: string;
    actorRoles: readonly string[];
  }): Promise<readonly ApiCredentialMetadata[]> {
    this.requireFeatureEnabled();
    await this.requireLicense(input.tenantId);
    this.requirePermission(input.actorRoles, 'view');

    const center = (await this.credentials.listByTenant(input.tenantId))
      .filter((c) => c.tenantId === input.tenantId)
      .map((c) => toCredentialMetadata(c, 'center'));

    const legacy = await this.legacy.listLegacyMetadata(input.tenantId);
    const centerIds = new Set(center.map((c) => c.id));
    const merged = [
      ...center,
      ...legacy.filter((l) => !centerIds.has(l.id)),
    ];
    return merged;
  }

  /**
   * Hash verification utility for tests / future 44d — not request middleware.
   */
  verifyRawCredential(
    raw: string,
    storedHash: string,
  ): boolean {
    const pepper = this.requirePepper();
    return verifyApiCredentialHash(raw, storedHash, pepper);
  }

  /** Expose authn eligibility helper without wiring middleware. */
  isAuthnEligible(credential: ApiCredential, now?: Date): boolean {
    return isCredentialAuthnEligible({
      status: credential.status,
      expiresAt: credential.expiresAt,
      rotationGraceEndsAt: credential.rotationGraceEndsAt,
      now,
    });
  }

  redact(value: string): string {
    return redactCredentialSecrets(value);
  }

  mapLegacyScopes(scopes: readonly string[]): readonly string[] {
    return mapLegacySettingsScopesToCenter(scopes);
  }
}

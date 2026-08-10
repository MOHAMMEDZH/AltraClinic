import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { loadIntegrationsFoundationConfig } from '../config/integrations-config';
import { mapLegacySettingsScopesToCenter } from '../domain/credential-scopes';
import type { ApiCredentialMetadata } from '../domain/integrations.entities';
import { randomUUID } from 'crypto';

interface LegacyApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  hash?: string;
  createdAt: string;
  createdBy?: string;
  lastUsedAt?: string | null;
  scopes?: string[];
  centerCredentialId?: string;
}

/**
 * Phase 44b — OD-MIGRATE dual-read / dual-write against Settings JSON.
 * Legacy scopes always map to ops.read only. Does not remove Settings SoR.
 */
@Injectable()
export class IntegrationsLegacyCompatibilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dual-read: when legacy read is enabled (or always during dual_read window),
   * return Settings developer keys as metadata with ops.read only.
   */
  async listLegacyMetadata(
    tenantId: string,
  ): Promise<readonly ApiCredentialMetadata[]> {
    const config = loadIntegrationsFoundationConfig();
    // Prefer Center; include Settings when rollback flag is ON or dual-read mode.
    const includeLegacy =
      config.flags.legacySettingsKeysRead || config.featureEnabled;
    if (!includeLegacy) return [];

    const keys = await this.readLegacyKeys(tenantId);
    return keys.map((k) => ({
      id: String(k.centerCredentialId ?? k.id),
      tenantId,
      branchId: null,
      name: String(k.name ?? ''),
      prefix: String(k.prefix ?? ''),
      status: 'active' as const,
      scopes: mapLegacySettingsScopesToCenter(
        Array.isArray(k.scopes) ? k.scopes.map(String) : [],
      ),
      ownerType: 'user' as const,
      ownerId: String(k.createdBy ?? 'legacy'),
      expiresAt: null,
      lastUsedAt: k.lastUsedAt ? String(k.lastUsedAt) : null,
      createdBy: String(k.createdBy ?? 'legacy'),
      rotatedFromId: null,
      rotationGraceEndsAt: null,
      createdAt: String(k.createdAt ?? new Date().toISOString()),
      updatedAt: String(k.createdAt ?? new Date().toISOString()),
      revokedAt: null,
      source: 'legacy_settings' as const,
    }));
  }

  /**
   * Dual-write: append a Settings JSON stub (legacy hash) so Settings UI listing
   * remains compatible. Raw never stored. Legacy scopes field kept as read-only
   * markers; Center SoR scopes are authoritative.
   */
  async dualWriteNewCredential(input: {
    tenantId: string;
    actorId: string;
    name: string;
    prefix: string;
    legacyHash: string;
    centerCredentialId: string;
    createdAt: string;
  }): Promise<void> {
    if (!loadIntegrationsFoundationConfig().featureEnabled) return;

    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: input.tenantId },
        select: { features: true },
      });
      if (!tenant) return;

      const features = {
        ...((tenant.features ?? {}) as Record<string, unknown>),
      };
      const dev = {
        ...((features.developerSettings as Record<string, unknown>) ?? {}),
      };
      const apiKeys = Array.isArray(dev.apiKeys)
        ? [...(dev.apiKeys as unknown[])]
        : [];

      apiKeys.push({
        id: input.centerCredentialId,
        name: input.name,
        prefix: input.prefix,
        hash: input.legacyHash,
        createdAt: input.createdAt,
        createdBy: input.actorId,
        lastUsedAt: null,
        scopes: ['read'],
        centerCredentialId: input.centerCredentialId,
        source: 'integrations_center',
      });
      features.developerSettings = { ...dev, apiKeys };
      await this.prisma.tenant.update({
        where: { id: input.tenantId },
        data: { features: features as Prisma.InputJsonValue },
      });
    } catch {
      // Dual-write best-effort — Center remains SoR; reconciliation surfaces drift.
    }
  }

  async reconcile(tenantId: string): Promise<{
    centerPreferred: number;
    legacyOnly: number;
    dualWritten: number;
    migrationStatus: 'not_started' | 'dual_read' | 'complete';
  }> {
    const legacy = await this.readLegacyKeys(tenantId);
    const dualWritten = legacy.filter(
      (k) => k.centerCredentialId || k.id,
    ).length;
    const legacyOnly = legacy.filter(
      (k) => !(k as { source?: string }).source && !k.centerCredentialId,
    ).length;

    return {
      centerPreferred: dualWritten,
      legacyOnly,
      dualWritten,
      migrationStatus: loadIntegrationsFoundationConfig().featureEnabled
        ? 'dual_read'
        : 'not_started',
    };
  }

  private async readLegacyKeys(tenantId: string): Promise<LegacyApiKeyRow[]> {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { features: true },
      });
      const features = (tenant?.features ?? {}) as Record<string, unknown>;
      const dev = features.developerSettings as
        | Record<string, unknown>
        | undefined;
      const keys = Array.isArray(dev?.apiKeys)
        ? (dev!.apiKeys as LegacyApiKeyRow[])
        : [];
      return keys;
    } catch {
      return [];
    }
  }

  /** Test helper: seed a pure-legacy key (no center id). */
  async seedLegacyKeyForTests(
    tenantId: string,
    entry: Partial<LegacyApiKeyRow> & { hash: string; prefix: string },
  ): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { features: true },
    });
    if (!tenant) return;
    const features = {
      ...((tenant.features ?? {}) as Record<string, unknown>),
    };
    const dev = {
      ...((features.developerSettings as Record<string, unknown>) ?? {}),
    };
    const apiKeys = Array.isArray(dev.apiKeys)
      ? [...(dev.apiKeys as unknown[])]
      : [];
    apiKeys.push({
      id: entry.id ?? randomUUID(),
      name: entry.name ?? 'legacy',
      prefix: entry.prefix,
      hash: entry.hash,
      createdAt: entry.createdAt ?? new Date().toISOString(),
      createdBy: entry.createdBy ?? 'legacy',
      lastUsedAt: null,
      scopes: entry.scopes ?? ['read', 'write'],
    });
    features.developerSettings = { ...dev, apiKeys };
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { features: features as Prisma.InputJsonValue },
    });
  }
}

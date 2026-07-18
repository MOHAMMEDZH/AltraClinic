import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { SubscriptionEnforcementService } from '../../../subscription/application/services/subscription-enforcement.service';
import { CreateBranchDto } from '../dto/create-branch.dto';
import { UpdateBillingSequencesDto } from '../dto/update-billing-sequences.dto';
import { UpdateBranchDto } from '../dto/update-branch.dto';
import { UpdateTenantSettingsDto } from '../dto/update-tenant-settings.dto';

export interface SettingsAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  messageKey: string;
  route?: string;
}

export interface SettingsOverview {
  setupProgress: number;
  health: 'good' | 'attention' | 'critical';
  alerts: SettingsAlert[];
  counts: {
    branches: number;
    users: number;
    departments: number;
  };
  recentChanges: Array<{ at: string; sections: string[] }>;
  tenant: {
    name: string;
    timezone: string;
    locale: string;
    hasBranding: boolean;
    hasClinicProfile: boolean;
  };
}

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): T {
  const result = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key as keyof T] = deepMerge(
        (base[key] as Record<string, unknown>) ?? {},
        value as Record<string, unknown>,
      ) as T[keyof T];
    } else {
      result[key as keyof T] = value as T[keyof T];
    }
  }
  return result;
}

function mergeFeatureBucket(
  current: Record<string, unknown>,
  key: string,
  patch?: Record<string, unknown>,
) {
  if (!patch) return;
  current[key] = deepMerge((current[key] as Record<string, unknown>) ?? {}, patch);
}

const FEATURE_BUCKETS = [
  'clinicProfile',
  'branding',
  'billingSettings',
  'inventorySettings',
  'securityPolicy',
  'auditSettings',
  'reportSettings',
  'notificationSettings',
  'integrationSettings',
  'developerSettings',
  'advancedSettings',
  'localizationSettings',
] as const;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionEnforcement: SubscriptionEnforcementService,
  ) {}

  async getOverview(tenantId: string): Promise<SettingsOverview> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        timezone: true,
        locale: true,
        features: true,
        customDomain: true,
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const features = (tenant.features ?? {}) as Record<string, unknown>;
    const clinicProfile = (features.clinicProfile ?? {}) as Record<string, unknown>;
    const branding = (features.branding ?? {}) as Record<string, unknown>;

    const [branches, users, departments] = await Promise.all([
      this.prisma.branch.count({ where: { tenantId, deletedAt: null, isActive: true } }),
      this.prisma.user.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.department.count({ where: { tenantId } }),
    ]);

    const alerts: SettingsAlert[] = [];
    if (!clinicProfile.phone && !clinicProfile.email) {
      alerts.push({ id: 'contact', severity: 'warning', messageKey: 'settings.alerts.missingContact', route: '/settings/general' });
    }
    if (!clinicProfile.description) {
      alerts.push({ id: 'profile', severity: 'info', messageKey: 'settings.alerts.missingProfile', route: '/settings/profile' });
    }
    if (!branding.logoStorageKey) {
      alerts.push({ id: 'logo', severity: 'info', messageKey: 'settings.alerts.missingLogo', route: '/settings/branding' });
    }
    if (branches === 0) {
      alerts.push({ id: 'branches', severity: 'warning', messageKey: 'settings.alerts.noBranches', route: '/settings/branches' });
    }

    const securityPolicy = (features.securityPolicy ?? {}) as Record<string, unknown>;
    const minPwd = Number(securityPolicy.minPasswordLength ?? 0);
    if (!minPwd || minPwd < 8) {
      alerts.push({ id: 'password-policy', severity: 'info', messageKey: 'settings.alerts.weakPasswordPolicy', route: '/settings/security-policies' });
    }

    let completed = 0;
    const checklist = [
      Boolean(tenant.name?.trim()),
      Boolean(tenant.timezone),
      Boolean(tenant.locale),
      Boolean(clinicProfile.phone || clinicProfile.email),
      branches > 0,
      Boolean(branding.primaryColor || branding.logoStorageKey),
      users > 1,
    ];
    completed = checklist.filter(Boolean).length;
    const setupProgress = Math.round((completed / checklist.length) * 100);

    const health =
      alerts.some((a) => a.severity === 'critical')
        ? 'critical'
        : alerts.some((a) => a.severity === 'warning')
          ? 'attention'
          : 'good';

    const recentChanges = Array.isArray(features.settingsHistory)
      ? (features.settingsHistory as Array<{ at: string; sections: string[] }>).slice(0, 5)
      : [];

    return {
      setupProgress,
      health,
      alerts,
      counts: { branches, users, departments },
      recentChanges,
      tenant: {
        name: tenant.name,
        timezone: tenant.timezone,
        locale: tenant.locale,
        hasBranding: Boolean(branding.logoStorageKey || branding.primaryColor),
        hasClinicProfile: Boolean(clinicProfile.legalName || clinicProfile.address),
      },
    };
  }

  async getTenantSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        branches: {
          where: { deletedAt: null },
          select: { id: true, name: true, isActive: true, phone: true, address: true },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const features = (tenant.features ?? {}) as Record<string, unknown>;

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      customDomain: tenant.customDomain,
      timezone: tenant.timezone,
      locale: tenant.locale,
      dataRetentionDays: tenant.dataRetentionDays,
      status: tenant.status,
      lifecycleStatus: tenant.lifecycleStatus,
      features,
      clinicProfile: (features.clinicProfile ?? {}) as Record<string, unknown>,
      branding: (features.branding ?? {}) as Record<string, unknown>,
      moduleFlags: (features.moduleFlags ?? {}) as Record<string, boolean>,
      billingSettings: (features.billingSettings ?? {}) as Record<string, unknown>,
      inventorySettings: (features.inventorySettings ?? {}) as Record<string, unknown>,
      securityPolicy: (features.securityPolicy ?? {}) as Record<string, unknown>,
      auditSettings: (features.auditSettings ?? {}) as Record<string, unknown>,
      reportSettings: (features.reportSettings ?? {}) as Record<string, unknown>,
      notificationSettings: (features.notificationSettings ?? {}) as Record<string, unknown>,
      integrationSettings: (features.integrationSettings ?? {}) as Record<string, unknown>,
      developerSettings: (features.developerSettings ?? {}) as Record<string, unknown>,
      advancedSettings: (features.advancedSettings ?? {}) as Record<string, unknown>,
      localizationSettings: (features.localizationSettings ?? {}) as Record<string, unknown>,
      branches: tenant.branches,
      updatedAt: tenant.updatedAt.toISOString(),
    };
  }

  async updateTenantSettings(tenantId: string, dto: UpdateTenantSettingsDto, actorId: string) {
    if (dto.branding !== undefined) {
      await this.subscriptionEnforcement.enforceLicensedFeature(tenantId, 'customBranding');
    }
    if (dto.customDomain !== undefined) {
      await this.subscriptionEnforcement.enforceLicensedFeature(tenantId, 'whiteLabel');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { features: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const currentFeatures = (tenant.features ?? {}) as Record<string, unknown>;
    let nextFeatures = { ...currentFeatures };

    for (const bucket of FEATURE_BUCKETS) {
      const patch = dto[bucket as keyof UpdateTenantSettingsDto] as Record<string, unknown> | undefined;
      mergeFeatureBucket(nextFeatures, bucket, patch);
    }
    if (dto.moduleFlags) {
      nextFeatures.moduleFlags = {
        ...((currentFeatures.moduleFlags as Record<string, boolean>) ?? {}),
        ...dto.moduleFlags,
      };
    }
    if (dto.features) {
      nextFeatures = deepMerge(nextFeatures, dto.features);
    }

    const changedSections = [
      dto.name ? 'name' : null,
      dto.timezone ? 'timezone' : null,
      dto.locale ? 'locale' : null,
      dto.dataRetentionDays ? 'dataRetentionDays' : null,
      dto.customDomain !== undefined ? 'customDomain' : null,
      ...FEATURE_BUCKETS.filter((b) => dto[b as keyof UpdateTenantSettingsDto]),
      dto.moduleFlags ? 'moduleFlags' : null,
    ].filter(Boolean) as string[];

    const settingsHistory = Array.isArray(nextFeatures.settingsHistory)
      ? [...(nextFeatures.settingsHistory as unknown[])]
      : [];
    settingsHistory.unshift({
      actorId,
      at: new Date().toISOString(),
      sections: changedSections,
    });
    nextFeatures.settingsHistory = settingsHistory.slice(0, 50);

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.timezone ? { timezone: dto.timezone } : {}),
        ...(dto.locale ? { locale: dto.locale } : {}),
        ...(dto.dataRetentionDays ? { dataRetentionDays: dto.dataRetentionDays } : {}),
        ...(dto.customDomain !== undefined ? { customDomain: dto.customDomain || null } : {}),
        features: nextFeatures as Prisma.InputJsonValue,
      },
    });

    return this.getTenantSettings(tenantId);
  }

  async listBranches(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        nameAr: true,
        city: true,
        isActive: true,
        phone: true,
        address: true,
        regionId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getBranch(tenantId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId, deletedAt: null },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async createBranch(tenantId: string, dto: CreateBranchDto) {
    await this.subscriptionEnforcement.enforceBranchLimit(tenantId);
    return this.prisma.branch.create({
      data: {
        id: randomUUID(),
        tenantId,
        name: dto.name.trim(),
        nameAr: dto.nameAr?.trim() || null,
        address: dto.address?.trim() || null,
        city: dto.city?.trim() || null,
        phone: dto.phone?.trim() || null,
        regionId: dto.regionId ?? null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateBranch(tenantId: string, branchId: string, dto: UpdateBranchDto) {
    await this.getBranch(tenantId, branchId);
    return this.prisma.branch.update({
      where: { id: branchId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr?.trim() || null } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...(dto.city !== undefined ? { city: dto.city?.trim() || null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.regionId !== undefined ? { regionId: dto.regionId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async archiveBranch(tenantId: string, branchId: string) {
    await this.getBranch(tenantId, branchId);
    return this.prisma.branch.update({
      where: { id: branchId },
      data: { isActive: false, deletedAt: new Date() },
    });
  }

  async getBillingSequences(tenantId: string) {
    return this.prisma.tenantBillingSequence.findMany({
      where: { tenantId },
      orderBy: { prefix: 'asc' },
    });
  }

  async updateBillingSequences(tenantId: string, dto: UpdateBillingSequencesDto) {
    const results = [];
    for (const seq of dto.sequences) {
      const prefix = seq.prefix.trim().toUpperCase();
      if (!prefix) throw new BadRequestException('Prefix is required');
      const row = await this.prisma.tenantBillingSequence.upsert({
        where: { tenantId_prefix: { tenantId, prefix } },
        create: {
          id: randomUUID(),
          tenantId,
          prefix,
          lastNumber: seq.lastNumber ?? 0,
        },
        update: {
          ...(seq.lastNumber !== undefined ? { lastNumber: seq.lastNumber } : {}),
        },
      });
      results.push(row);
    }
    return results;
  }

  async listApiKeys(tenantId: string) {
    const features = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { features: true },
    });
    const dev = ((features?.features ?? {}) as Record<string, unknown>).developerSettings as Record<string, unknown> | undefined;
    const keys = Array.isArray(dev?.apiKeys) ? dev!.apiKeys as Array<Record<string, unknown>> : [];
    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt ?? null,
      scopes: k.scopes ?? [],
    }));
  }

  async createApiKey(tenantId: string, name: string, actorId: string) {
    const raw = `bk_${randomBytes(24).toString('hex')}`;
    const prefix = raw.slice(0, 12);
    const hash = createHash('sha256').update(raw).digest('hex');
    const entry = {
      id: randomUUID(),
      name: name.trim(),
      prefix,
      hash,
      createdAt: new Date().toISOString(),
      createdBy: actorId,
      lastUsedAt: null,
      scopes: ['read', 'write'],
    };

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { features: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const features = (tenant.features ?? {}) as Record<string, unknown>;
    const dev = (features.developerSettings as Record<string, unknown>) ?? {};
    const apiKeys = Array.isArray(dev.apiKeys) ? [...(dev.apiKeys as unknown[])] : [];
    apiKeys.push(entry);
    features.developerSettings = { ...dev, apiKeys };
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { features: features as Prisma.InputJsonValue },
    });
    return { id: entry.id, name: entry.name, prefix: entry.prefix, key: raw, createdAt: entry.createdAt };
  }

  async revokeApiKey(tenantId: string, keyId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { features: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const features = (tenant.features ?? {}) as Record<string, unknown>;
    const dev = (features.developerSettings as Record<string, unknown>) ?? {};
    const apiKeys = Array.isArray(dev.apiKeys) ? (dev.apiKeys as Array<Record<string, unknown>>) : [];
    const next = apiKeys.filter((k) => k.id !== keyId);
    if (next.length === apiKeys.length) throw new NotFoundException('API key not found');
    features.developerSettings = { ...dev, apiKeys: next };
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { features: features as Prisma.InputJsonValue },
    });
    return { revoked: true };
  }
}

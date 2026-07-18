import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { PasswordPolicyVO } from '../../../auth/domain/value-objects/password-policy.vo';

export interface TenantSecurityPolicyConfig {
  minPasswordLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  mfaRequired: boolean;
  sessionTimeoutMinutes: number;
  maxFailedLogins: number;
  lockoutMinutes: number;
  ipRestrictionsEnabled: boolean;
  sensitiveActionConfirmation: boolean;
}

export interface TenantAdvancedPolicyConfig {
  maintenanceMode: boolean;
  allowDataExport: boolean;
  allowDataImport: boolean;
}

const DEFAULT_SECURITY: TenantSecurityPolicyConfig = {
  minPasswordLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: true,
  mfaRequired: false,
  sessionTimeoutMinutes: 60,
  maxFailedLogins: 5,
  lockoutMinutes: 15,
  ipRestrictionsEnabled: false,
  sensitiveActionConfirmation: true,
};

@Injectable()
export class TenantPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getSecurityPolicy(tenantId: string): Promise<TenantSecurityPolicyConfig> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { features: true },
    });
    const raw = ((tenant?.features ?? {}) as Record<string, unknown>).securityPolicy as Record<string, unknown> | undefined;
    return {
      minPasswordLength: Number(raw?.minPasswordLength ?? DEFAULT_SECURITY.minPasswordLength),
      requireUppercase: Boolean(raw?.requireUppercase ?? DEFAULT_SECURITY.requireUppercase),
      requireLowercase: Boolean(raw?.requireLowercase ?? DEFAULT_SECURITY.requireLowercase),
      requireNumbers: Boolean(raw?.requireNumbers ?? DEFAULT_SECURITY.requireNumbers),
      requireSymbols: Boolean(raw?.requireSymbols ?? DEFAULT_SECURITY.requireSymbols),
      mfaRequired: Boolean(raw?.mfaRequired ?? DEFAULT_SECURITY.mfaRequired),
      sessionTimeoutMinutes: Number(raw?.sessionTimeoutMinutes ?? DEFAULT_SECURITY.sessionTimeoutMinutes),
      maxFailedLogins: Number(raw?.maxFailedLogins ?? DEFAULT_SECURITY.maxFailedLogins),
      lockoutMinutes: Number(raw?.lockoutMinutes ?? DEFAULT_SECURITY.lockoutMinutes),
      ipRestrictionsEnabled: Boolean(raw?.ipRestrictionsEnabled ?? DEFAULT_SECURITY.ipRestrictionsEnabled),
      sensitiveActionConfirmation: Boolean(raw?.sensitiveActionConfirmation ?? DEFAULT_SECURITY.sensitiveActionConfirmation),
    };
  }

  async getAdvancedPolicy(tenantId: string): Promise<TenantAdvancedPolicyConfig> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { features: true },
    });
    const raw = ((tenant?.features ?? {}) as Record<string, unknown>).advancedSettings as Record<string, unknown> | undefined;
    return {
      maintenanceMode: Boolean(raw?.maintenanceMode ?? false),
      allowDataExport: Boolean(raw?.allowDataExport ?? true),
      allowDataImport: Boolean(raw?.allowDataImport ?? true),
    };
  }

  async isMaintenanceMode(tenantId: string): Promise<boolean> {
    const policy = await this.getAdvancedPolicy(tenantId);
    return policy.maintenanceMode;
  }

  async getPasswordPolicy(tenantId: string): Promise<PasswordPolicyVO> {
    const policy = await this.getSecurityPolicy(tenantId);
    return PasswordPolicyVO.fromTenantPolicy(policy);
  }

  async getIntegrationWebhook(tenantId: string): Promise<{ enabled: boolean; url: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { features: true },
    });
    const raw = ((tenant?.features ?? {}) as Record<string, unknown>).integrationSettings as Record<string, unknown> | undefined;
    return {
      enabled: Boolean(raw?.webhooksEnabled ?? false),
      url: String(raw?.webhookUrl ?? '').trim(),
    };
  }
}

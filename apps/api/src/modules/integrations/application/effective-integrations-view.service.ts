import { Injectable } from '@nestjs/common';
import { TenantPolicyService } from '../../settings/application/services/tenant-policy.service';
import { IntegrationsExtensionRegistry } from './integrations-extension.registry';
import {
  isApiKeysIntegrationsCenterEnabled,
  loadIntegrationsFoundationConfig,
} from '../config/integrations-config';
import { STATIC_INTEGRATIONS_CATALOG } from '../catalog/static-integrations.catalog';
import { STATIC_SCOPE_CATALOG } from '../catalog/static-scope.catalog';
import type {
  EffectiveIntegrationsType,
  IntegrationsMigrationStatus,
  ScopeCatalogEntry,
} from '../domain/integrations-registration.contracts';
import { INTEGRATIONS_EXTENSION_KIND } from '../integrations.constants';

export interface EffectiveIntegrationsViewInput {
  tenantId?: string;
  branchId?: string | null;
  roles?: readonly string[];
  hasReadPermission?: boolean;
}

export interface CredentialCountsByStatus {
  pending: number;
  active: number;
  grace: number;
  expired: number;
  revoked: number;
}

export interface EffectiveIntegrationsView {
  tenantId: string | null;
  branchId: string | null;
  extensionKind: typeof INTEGRATIONS_EXTENSION_KIND;
  featureEnabled: boolean;
  allowIntegrations: boolean;
  visible: boolean;
  types: readonly EffectiveIntegrationsType[];
  credentialCounts: CredentialCountsByStatus;
  scopeCatalog: readonly ScopeCatalogEntry[];
  webhookSubscriptionCounts: { active: number; disabled: number; paused: number };
  queueWired: boolean;
  secretStoreReady: boolean;
  pepperReady: boolean;
  migrationStatus: IntegrationsMigrationStatus;
  meta: {
    catalogCount: number;
    executableCount: number;
    staticCatalogIsRuntimeAuthority: false;
  };
}

const EMPTY_CREDENTIAL_COUNTS: CredentialCountsByStatus = {
  pending: 0,
  active: 0,
  grace: 0,
  expired: 0,
  revoked: 0,
};

/**
 * Phase 44a — dormant effective view.
 * Returns empty visible types; static catalog is never authority.
 */
@Injectable()
export class EffectiveIntegrationsViewService {
  constructor(
    private readonly extensions: IntegrationsExtensionRegistry,
    private readonly tenantPolicy: TenantPolicyService,
  ) {}

  async resolve(
    input: EffectiveIntegrationsViewInput = {},
  ): Promise<EffectiveIntegrationsView> {
    const featureEnabled = isApiKeysIntegrationsCenterEnabled();
    const config = loadIntegrationsFoundationConfig();
    const tenantId = input.tenantId ?? null;
    let allowIntegrations = false;
    if (tenantId) {
      const policy = await this.tenantPolicy.getAdvancedPolicy(tenantId);
      allowIntegrations = policy.allowIntegrations;
    }

    const hasRead = input.hasReadPermission === true;
    const visible = featureEnabled && allowIntegrations && hasRead;

    return {
      tenantId,
      branchId: input.branchId ?? null,
      extensionKind: this.extensions.getExtensionKind(),
      featureEnabled,
      allowIntegrations,
      visible,
      types: [],
      credentialCounts: EMPTY_CREDENTIAL_COUNTS,
      scopeCatalog: visible ? STATIC_SCOPE_CATALOG : [],
      webhookSubscriptionCounts: { active: 0, disabled: 0, paused: 0 },
      queueWired: false,
      secretStoreReady: config.secretStoreReady,
      pepperReady: config.pepperReady,
      migrationStatus: config.featureEnabled ? 'dual_read' : 'not_started',
      meta: {
        catalogCount: STATIC_INTEGRATIONS_CATALOG.length,
        executableCount: 0,
        staticCatalogIsRuntimeAuthority: false,
      },
    };
  }
}

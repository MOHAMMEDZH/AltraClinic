/**
 * Phase 44e — read-model / dashboard aggregation only (no new engines).
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { CredentialEngineService } from '../application/credential-engine.service';
import { WebhookEngineService } from '../application/webhook/webhook-engine.service';
import { IntegrationsGatewayService } from '../application/gateway/integrations-gateway.service';
import { EffectiveIntegrationsViewService } from '../application/effective-integrations-view.service';
import {
  loadIntegrationsFoundationConfig,
  validateIntegrationsFoundationConfig,
} from '../config/integrations-config';
import { STATIC_SCOPE_CATALOG } from '../catalog/static-scope.catalog';
import { STATIC_INTEGRATIONS_CATALOG } from '../catalog/static-integrations.catalog';
import {
  INTEGRATIONS_ACTIVITY_EVENTS,
  INTEGRATIONS_AUDIT_ACTIONS,
  INTEGRATIONS_LICENSE_CAPABILITIES,
  INTEGRATIONS_METRIC_NAMES,
  INTEGRATIONS_PERMISSION_ACTIONS,
  INTEGRATIONS_PERMISSION_RESOURCE,
  INTEGRATIONS_SCOPE_CATALOG_IDS,
} from '../integrations.constants';

@Controller('integrations/ops')
@UseGuards(TenantScopedAccessGuard)
export class IntegrationsOpsDashboardController {
  constructor(
    private readonly credentials: CredentialEngineService,
    private readonly webhooks: WebhookEngineService,
    private readonly gateway: IntegrationsGatewayService,
    private readonly effectiveView: EffectiveIntegrationsViewService,
  ) {}

  @Get('dashboard')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'view')
  async dashboard(@CurrentUser() user: JwtClaimsVO) {
    const roles = user.roles.map(String);
    const config = loadIntegrationsFoundationConfig();
    const validation = validateIntegrationsFoundationConfig(config);
    const view = await this.effectiveView.resolve({
      tenantId: user.tenantId,
      hasReadPermission: true,
    });

    let credentialItems: Awaited<
      ReturnType<CredentialEngineService['listCredentialMetadata']>
    > = [];
    let serviceAccounts: Awaited<
      ReturnType<CredentialEngineService['listServiceAccounts']>
    > = [];
    let subscriptions: ReturnType<WebhookEngineService['listSubscriptions']> =
      [];
    let deliveries: ReturnType<WebhookEngineService['listDeliveries']> = [];

    try {
      credentialItems = await this.credentials.listCredentialMetadata({
        tenantId: user.tenantId,
        actorRoles: roles,
      });
    } catch {
      credentialItems = [];
    }
    try {
      serviceAccounts = await this.credentials.listServiceAccounts({
        tenantId: user.tenantId,
        actorRoles: roles,
      });
    } catch {
      serviceAccounts = [];
    }
    try {
      subscriptions = this.webhooks.listSubscriptions(user.tenantId, roles);
    } catch {
      subscriptions = [];
    }
    try {
      deliveries = this.webhooks.listDeliveries(user.tenantId, roles);
    } catch {
      deliveries = [];
    }

    const credentialCounts = {
      active: credentialItems.filter((c) => c.status === 'active').length,
      expiring: credentialItems.filter((c) => c.status === 'expiring').length,
      rotated: credentialItems.filter((c) => c.status === 'rotated').length,
      revoked: credentialItems.filter((c) => c.status === 'revoked').length,
      expired: credentialItems.filter((c) => c.status === 'expired').length,
      total: credentialItems.length,
    };

    const webhookCounts = {
      subscriptionsActive: subscriptions.filter((s) => s.status === 'active')
        .length,
      subscriptionsDisabled: subscriptions.filter(
        (s) => s.status === 'disabled' || s.status === 'paused',
      ).length,
      deliveriesTotal: deliveries.length,
      deliveriesFailed: deliveries.filter(
        (d) =>
          d.status === 'failed' ||
          d.status === 'dead_lettered' ||
          String(d.status).includes('fail'),
      ).length,
      deliveriesDeadLetter: deliveries.filter(
        (d) => d.status === 'dead_lettered',
      ).length,
    };

    const queue = this.webhooks.getQueueDiagnostics();
    let gatewayDiagnostics: ReturnType<
      IntegrationsGatewayService['getDiagnostics']
    > | null = null;
    let usage: ReturnType<
      IntegrationsGatewayService['getUsageSnapshot']
    > | null = null;
    try {
      gatewayDiagnostics = this.gateway.getDiagnostics(user.tenantId);
      usage = this.gateway.getUsageSnapshot(user.tenantId);
    } catch {
      gatewayDiagnostics = null;
      usage = null;
    }

    return {
      phase: '44e',
      generatedAt: new Date().toISOString(),
      featureFlag: {
        name: config.featureFlagEnv,
        enabled: config.featureEnabled,
        flags: config.flags,
      },
      license: {
        allowIntegrations: view.allowIntegrations,
        capabilities: [...INTEGRATIONS_LICENSE_CAPABILITIES],
      },
      readiness: {
        pepperReady: config.pepperReady,
        secretStoreReady: config.secretStoreReady,
        configValid: validation.valid,
        visible: view.visible,
        dormant: !config.featureEnabled,
      },
      credentialCounts,
      serviceAccountCounts: {
        total: serviceAccounts.length,
        active: serviceAccounts.filter((s) => s.status === 'active').length,
        disabled: serviceAccounts.filter((s) => s.status === 'disabled')
          .length,
      },
      webhookCounts,
      queue,
      gateway: gatewayDiagnostics,
      usage,
      providers: this.webhooks.listProviders().map((p) => ({
        key: p.key,
        displayName: p.displayName,
        direction: p.direction,
        adapterKind: p.adapterKind,
      })),
      catalog: {
        staticCount: STATIC_INTEGRATIONS_CATALOG.length,
        scopeCount: STATIC_SCOPE_CATALOG.length,
      },
      migrationStatus: view.migrationStatus,
    };
  }

  @Get('scopes')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'view')
  scopes() {
    return {
      scopes: STATIC_SCOPE_CATALOG.map((s) => ({
        id: s.scopeId,
        description: s.description,
        highRisk: s.highRisk,
      })),
      ids: [...INTEGRATIONS_SCOPE_CATALOG_IDS],
    };
  }

  @Get('providers')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'view')
  providers() {
    return {
      runtime: this.webhooks.listProviders(),
      staticCatalog: STATIC_INTEGRATIONS_CATALOG,
      staticIsRuntimeAuthority: false,
    };
  }

  @Get('permissions')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'view')
  permissions() {
    return {
      resource: INTEGRATIONS_PERMISSION_RESOURCE,
      actions: INTEGRATIONS_PERMISSION_ACTIONS,
    };
  }

  @Get('configuration')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'view')
  configuration() {
    const config = loadIntegrationsFoundationConfig();
    return {
      featureFlagEnv: config.featureFlagEnv,
      featureEnabled: config.featureEnabled,
      flags: config.flags,
      queueName: config.queueName,
      pepperReady: config.pepperReady,
      secretStoreReady: config.secretStoreReady,
      defaults: config.defaults,
      // Never expose pepper/secret material — readiness only
    };
  }

  @Get('metrics-catalog')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'view')
  metricsCatalog() {
    return {
      metrics: [...INTEGRATIONS_METRIC_NAMES],
      activityEvents: [...INTEGRATIONS_ACTIVITY_EVENTS],
      auditActions: [...INTEGRATIONS_AUDIT_ACTIONS],
    };
  }
}

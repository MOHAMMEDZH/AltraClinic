import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { Public } from '../../auth/api/decorators/public.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { INTEGRATIONS_PERMISSION_RESOURCE } from '../integrations.constants';
import { WebhookEngineService } from '../application/webhook/webhook-engine.service';
import { loadIntegrationsFoundationConfig } from '../config/integrations-config';

@Controller('integrations/webhooks/subscriptions')
@UseGuards(TenantScopedAccessGuard)
export class IntegrationsWebhookSubscriptionsController {
  constructor(private readonly engine: WebhookEngineService) {}

  @Get()
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'view')
  list(@CurrentUser() user: JwtClaimsVO) {
    return {
      subscriptions: this.engine.listSubscriptions(
        user.tenantId,
        user.roles.map(String),
      ),
    };
  }

  @Post()
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'create')
  async create(
    @CurrentUser() user: JwtClaimsVO,
    @Body()
    body: {
      name: string;
      targetUrl: string;
      eventFilters: string[];
      providerKey?: string;
    },
  ) {
    const result = await this.engine.createSubscription({
      tenantId: user.tenantId,
      actorId: user.sub,
      actorRoles: user.roles.map(String),
      name: body.name,
      targetUrl: body.targetUrl,
      eventFilters: body.eventFilters ?? [],
      providerKey: body.providerKey,
    });
    return {
      subscription: result.subscription,
      secret: result.secretOnce,
    };
  }

  @Put(':id')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'update')
  async update(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body()
    body: { name?: string; targetUrl?: string; eventFilters?: string[] },
  ) {
    const subscription = await this.engine.updateSubscription({
      tenantId: user.tenantId,
      subscriptionId: id,
      actorId: user.sub,
      actorRoles: user.roles.map(String),
      ...body,
    });
    return { subscription };
  }

  @Post(':id/enable')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'update')
  async enable(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const subscription = await this.engine.setSubscriptionEnabled({
      tenantId: user.tenantId,
      subscriptionId: id,
      actorId: user.sub,
      actorRoles: user.roles.map(String),
      enabled: true,
    });
    return { subscription };
  }

  @Post(':id/disable')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'update')
  async disable(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const subscription = await this.engine.setSubscriptionEnabled({
      tenantId: user.tenantId,
      subscriptionId: id,
      actorId: user.sub,
      actorRoles: user.roles.map(String),
      enabled: false,
    });
    return { subscription };
  }

  @Post(':id/rotate-secret')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'update')
  async rotateSecret(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
  ) {
    const result = await this.engine.rotateSecret({
      tenantId: user.tenantId,
      subscriptionId: id,
      actorId: user.sub,
      actorRoles: user.roles.map(String),
    });
    return { secret: result.secretOnce, version: result.version };
  }

  @Delete(':id')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'delete')
  async remove(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    await this.engine.deleteSubscription({
      tenantId: user.tenantId,
      subscriptionId: id,
      actorId: user.sub,
      actorRoles: user.roles.map(String),
    });
    return { deleted: true };
  }
}

@Controller('integrations/webhooks/deliveries')
@UseGuards(TenantScopedAccessGuard)
export class IntegrationsWebhookDeliveriesController {
  constructor(private readonly engine: WebhookEngineService) {}

  @Get()
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'view')
  list(
    @CurrentUser() user: JwtClaimsVO,
    @Query('subscriptionId') subscriptionId?: string,
  ) {
    return {
      deliveries: this.engine.listDeliveries(
        user.tenantId,
        user.roles.map(String),
        subscriptionId,
      ),
    };
  }

  @Get(':id/attempts')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'view')
  attempts(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    return {
      attempts: this.engine.listAttempts(
        user.tenantId,
        id,
        user.roles.map(String),
      ),
    };
  }

  @Post(':id/retry')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'manage')
  async retry(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const delivery = await this.engine.retryDelivery({
      tenantId: user.tenantId,
      deliveryId: id,
      actorId: user.sub,
      actorRoles: user.roles.map(String),
    });
    return { delivery };
  }

  @Post(':id/replay')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'manage')
  async replay(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const delivery = await this.engine.replayDelivery({
      tenantId: user.tenantId,
      deliveryId: id,
      actorId: user.sub,
      actorRoles: user.roles.map(String),
    });
    return { delivery };
  }
}

@Controller('integrations/webhooks')
@UseGuards(TenantScopedAccessGuard)
export class IntegrationsWebhookDiagnosticsController {
  constructor(private readonly engine: WebhookEngineService) {}

  @Get('providers')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'view')
  providers() {
    return { providers: this.engine.listProviders() };
  }

  @Get('diagnostics')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'view')
  diagnostics() {
    const config = loadIntegrationsFoundationConfig();
    return {
      queue: this.engine.getQueueDiagnostics(),
      flags: config.flags,
      secretStoreReady: config.secretStoreReady,
    };
  }
}

/**
 * Inbound hook receiver — public path but signature-verified.
 * Not API-key gateway auth (44d). Tenant resolved from path claim.
 */
@Controller('integrations/hooks')
export class IntegrationsInboundHooksController {
  constructor(private readonly engine: WebhookEngineService) {}

  @Public()
  @Post(':tenantId/:providerKey')
  async receive(
    @Param('tenantId') tenantId: string,
    @Param('providerKey') providerKey: string,
    @Body() body: unknown,
    @Headers() headers: Record<string, string>,
  ) {
    const config = loadIntegrationsFoundationConfig();
    if (!config.featureEnabled || !config.flags.inboundEnabled) {
      return { accepted: false, reason: 'disabled' };
    }

    const rawBody = typeof body === 'string' ? body : JSON.stringify(body ?? {});
    // Resolve active inbound secret via first matching subscription of provider (generic adapter)
    const subs = this.engine.listSubscriptions(tenantId, ['owner']);
    const match = subs.find(
      (s) => s.providerKey === providerKey && s.status === 'active',
    );
    if (!match) {
      return { accepted: false, reason: 'endpoint_not_found' };
    }
    const secret = this.engine.decryptSecretForTests(match.secretId);
    const verified = await this.engine.verifyInbound({
      tenantId,
      providerKey,
      rawBody,
      headers,
      secretPlaintext: secret,
    });
    if (!verified.ok) {
      return { accepted: false, reason: verified.reason };
    }
    return { accepted: true, eventType: verified.eventType ?? null };
  }
}

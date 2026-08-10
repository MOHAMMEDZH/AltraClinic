/**
 * Phase 44d — Administrative gateway / quota / usage diagnostics.
 */

import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { isApiKeysIntegrationsCenterEnabled } from '../config/integrations-config';
import { IntegrationsGatewayService } from '../application/gateway/integrations-gateway.service';
import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';
import { INTEGRATIONS_PERMISSION_RESOURCE } from '../integrations.constants';
import {
  INTEGRATIONS_AUTHENTICATED_REQUEST_KEY,
  INTEGRATIONS_PRINCIPAL_REQUEST_KEY,
  type IntegrationsGatewayPrincipal,
} from '../domain/gateway/gateway.types';
import type { QuotaScopeKind, RateLimitWindow } from '../domain/gateway/quota.types';
import { RequireApiKeyScopes } from '../api/decorators/api-key-auth.decorator';

function actorFromRequest(req: Request & { user?: { id?: string; roles?: string[]; tenantId?: string } }) {
  const principal = (req as Record<string, unknown>)[
    INTEGRATIONS_PRINCIPAL_REQUEST_KEY
  ] as IntegrationsGatewayPrincipal | undefined;
  if (principal) {
    return {
      tenantId: principal.tenantId,
      actorId: principal.ownerId,
      actorRoles: ['owner', 'integrations_api_key'] as string[],
    };
  }
  return {
    tenantId: String(req.headers['x-tenant-id'] ?? req.user?.tenantId ?? ''),
    actorId: String(req.user?.id ?? 'system'),
    actorRoles: (req.user?.roles ?? ['owner']) as string[],
  };
}

@Controller('integrations/gateway')
export class IntegrationsGatewayController {
  constructor(private readonly gateway: IntegrationsGatewayService) {}

  @Get('diagnostics')
  diagnostics(
    @Req() req: Request,
    @Query('tenantId') tenantIdQuery?: string,
  ) {
    const actor = actorFromRequest(req as never);
    this.requireManage(actor.actorRoles);
    this.requireFeature();
    const tenantId = tenantIdQuery || actor.tenantId || undefined;
    return this.gateway.getDiagnostics(tenantId);
  }

  @Get('quotas')
  quotas(@Req() req: Request) {
    const actor = actorFromRequest(req as never);
    this.requireManage(actor.actorRoles);
    this.requireFeature();
    return {
      policies: this.gateway.listQuotaPolicies(),
      diagnostics: this.gateway.getDiagnostics(actor.tenantId || undefined),
      backend: 'in_process',
      redisDeferred: true,
    };
  }

  @Post('quotas/reset')
  resetQuotas(
    @Req() req: Request,
    @Body() body: { keyPrefix?: string },
  ) {
    const actor = actorFromRequest(req as never);
    this.requireManage(actor.actorRoles);
    this.requireFeature();
    this.gateway.resetQuota(body?.keyPrefix);
    return { ok: true };
  }

  @Post('quotas/override')
  overrideQuota(
    @Req() req: Request,
    @Body()
    body: {
      tenantId: string;
      scopeKind: QuotaScopeKind;
      window: RateLimitWindow;
    },
  ) {
    const actor = actorFromRequest(req as never);
    this.requireManage(actor.actorRoles);
    this.requireFeature();
    this.gateway.setTenantQuotaWindow(
      body.tenantId,
      body.scopeKind,
      body.window,
    );
    return { ok: true };
  }

  @Get('usage')
  usage(@Req() req: Request, @Query('tenantId') tenantIdQuery?: string) {
    const actor = actorFromRequest(req as never);
    this.requireManage(actor.actorRoles);
    this.requireFeature();
    const tenantId = tenantIdQuery || actor.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('tenantId required');
    }
    return this.gateway.getUsageSnapshot(tenantId);
  }

  /**
   * Probe endpoint — authenticates via API key (Bearer / X-Api-Key) and returns principal metadata.
   * Requires ops.read scope when API-key authenticated.
   */
  @Get('whoami')
  @RequireApiKeyScopes('ops.read')
  whoami(@Req() req: Request & Record<string, unknown>) {
    this.requireFeature();
    const principal = req[INTEGRATIONS_PRINCIPAL_REQUEST_KEY] as
      | IntegrationsGatewayPrincipal
      | undefined;
    if (!principal || req[INTEGRATIONS_AUTHENTICATED_REQUEST_KEY] !== true) {
      throw new UnauthorizedException(
        'API key authentication required (Authorization: Bearer bk_… or X-Api-Key)',
      );
    }
    return {
      tenantId: principal.tenantId,
      credentialId: principal.credentialId,
      prefix: principal.credentialPrefix,
      ownerType: principal.ownerType,
      scopes: principal.scopes,
      authSource: principal.authSource,
      correlationId: principal.correlationId,
    };
  }

  @Post('authenticate')
  async authenticateProbe(
    @Req() req: Request,
    @Headers('authorization') authorization?: string,
    @Headers('x-api-key') apiKey?: string,
    @Headers('x-tenant-id') tenantId?: string,
    @Body()
    body?: { requiredScopes?: string[]; endpoint?: string; operation?: string },
  ) {
    const actor = actorFromRequest(req as never);
    this.requireManage(actor.actorRoles);
    this.requireFeature();
    const result = await this.gateway.authenticate({
      authorization,
      apiKey,
      tenantIdHint: tenantId ?? actor.tenantId,
      requiredScopes: body?.requiredScopes ?? [],
      endpoint: body?.endpoint ?? 'admin.authenticate',
      operation: body?.operation ?? 'probe',
    });
    if (!result.ok) {
      return {
        ok: false,
        reason: result.reason,
        statusCode: result.statusCode,
        // Never echo raw key material
        message: result.message,
      };
    }
    return {
      ok: true,
      principal: {
        tenantId: result.principal.tenantId,
        credentialId: result.principal.credentialId,
        prefix: result.principal.credentialPrefix,
        ownerType: result.principal.ownerType,
        scopes: result.principal.scopes,
        authSource: result.principal.authSource,
      },
      remainingQuota: result.remainingQuota,
      latencies: {
        authMs: result.authLatencyMs,
        authorizationMs: result.authorizationLatencyMs,
        quotaMs: result.quotaLatencyMs,
      },
    };
  }

  private requireFeature(): void {
    if (!isApiKeysIntegrationsCenterEnabled()) {
      throw new UnauthorizedException(
        'API_KEYS_INTEGRATIONS_CENTER_ENABLED=false — Integrations Center dormant',
      );
    }
  }

  private requireManage(roles: readonly string[]): void {
    if (
      !rolesCanAccessResource(
        [...roles],
        INTEGRATIONS_PERMISSION_RESOURCE,
        'manage',
      )
    ) {
      throw new UnauthorizedException('api.integrations:manage required');
    }
  }
}

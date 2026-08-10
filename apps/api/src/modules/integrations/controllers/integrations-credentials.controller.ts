import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { CredentialEngineService } from '../application/credential-engine.service';
import { INTEGRATIONS_PERMISSION_RESOURCE } from '../integrations.constants';

/**
 * Phase 44b — thin admin APIs for Credential Engine exercise/tests.
 * Hidden behind feature flag + license + RBAC inside the engine.
 * Does NOT implement API-key authentication middleware.
 */
@Controller('integrations/credentials')
@UseGuards(TenantScopedAccessGuard)
export class IntegrationsCredentialsController {
  constructor(private readonly engine: CredentialEngineService) {}

  @Get()
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'view')
  async list(@CurrentUser() user: JwtClaimsVO) {
    const items = await this.engine.listCredentialMetadata({
      tenantId: user.tenantId,
      actorRoles: user.roles.map(String),
    });
    return { credentials: items };
  }

  @Post('ops/expire')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'manage')
  async expire(@CurrentUser() user: JwtClaimsVO) {
    return this.engine.expireApiCredentials({
      tenantId: user.tenantId,
      actorId: user.sub,
      actorRoles: user.roles.map(String),
    });
  }

  @Get(':id')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'view')
  async get(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const credential = await this.engine.getCredentialMetadata({
      tenantId: user.tenantId,
      credentialId: id,
      actorRoles: user.roles.map(String),
    });
    return { credential };
  }

  @Post()
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'create')
  async issue(
    @CurrentUser() user: JwtClaimsVO,
    @Body()
    body: {
      name: string;
      scopes: string[];
      ownerType?: 'user' | 'service_account';
      ownerId?: string;
      expiresAt?: string | null;
      integrationBound?: boolean;
    },
  ) {
    const result = await this.engine.issueApiCredential({
      tenantId: user.tenantId,
      actorId: user.sub,
      actorRoles: user.roles.map(String),
      name: body.name,
      scopes: body.scopes ?? [],
      ownerType: body.ownerType ?? 'user',
      ownerId: body.ownerId ?? user.sub,
      expiresAt: body.expiresAt ?? null,
      integrationBound: body.integrationBound === true,
    });
    return {
      credential: result.metadata,
      key: result.rawCredential,
    };
  }

  @Post(':id/rotate')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'update')
  async rotate(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const result = await this.engine.rotateApiCredential({
      tenantId: user.tenantId,
      credentialId: id,
      actorId: user.sub,
      actorRoles: user.roles.map(String),
    });
    return {
      credential: result.metadata,
      key: result.rawCredential,
    };
  }

  @Delete(':id')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'delete')
  async revoke(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    const credential = await this.engine.revokeApiCredential({
      tenantId: user.tenantId,
      credentialId: id,
      actorId: user.sub,
      actorRoles: user.roles.map(String),
      reason: body?.reason,
    });
    return { credential };
  }
}

@Controller('integrations/service-accounts')
@UseGuards(TenantScopedAccessGuard)
export class IntegrationsServiceAccountsController {
  constructor(private readonly engine: CredentialEngineService) {}

  @Get()
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'view')
  async list(@CurrentUser() user: JwtClaimsVO) {
    const accounts = await this.engine.listServiceAccounts({
      tenantId: user.tenantId,
      actorRoles: user.roles.map(String),
    });
    return { serviceAccounts: accounts };
  }

  @Post()
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'create')
  async create(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: { displayName: string; roleBindings?: string[] },
  ) {
    const account = await this.engine.createServiceAccount({
      tenantId: user.tenantId,
      actorId: user.sub,
      actorRoles: user.roles.map(String),
      displayName: body.displayName,
      roleBindings: body.roleBindings,
    });
    return { serviceAccount: account };
  }

  @Post(':id/disable')
  @RequirePermission(INTEGRATIONS_PERMISSION_RESOURCE, 'manage')
  async disable(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const account = await this.engine.disableServiceAccount({
      tenantId: user.tenantId,
      serviceAccountId: id,
      actorId: user.sub,
      actorRoles: user.roles.map(String),
    });
    return { serviceAccount: account };
  }
}

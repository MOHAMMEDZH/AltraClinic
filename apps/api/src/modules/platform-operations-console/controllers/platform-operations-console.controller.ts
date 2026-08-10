import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformAuthRoute } from '../../auth/api/decorators/platform-auth-route.decorator';
import { PlatformPermissionGuard } from '../../auth/api/guards/platform-permission.guard';
import { RequirePlatformPermission } from '../../auth/api/decorators/require-platform-permission.decorator';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { OPERATIONS_CONSOLE_PERMISSIONS } from '../platform-operations-console.constants';
import {
  OPERATIONS_CONSOLE_DISABLED_CODE,
  OPERATIONS_CONSOLE_DISABLED_MESSAGE,
  isOperationsConsoleEnabled,
} from '../config/operations-console-flags';
import { OpsConsoleError } from '../domain/operations-console.types';
import { OpsQueryService } from '../application/ops-query.service';
import { OpsActionService } from '../application/ops-action.service';

@Controller()
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class PlatformOperationsConsoleController {
  constructor(
    private readonly query: OpsQueryService,
    private readonly actions: OpsActionService,
    private readonly authz: PlatformAuthorizationService,
  ) {}

  private assertEnabled(): void {
    if (!isOperationsConsoleEnabled()) {
      throw new HttpException(
        {
          statusCode: 503,
          code: OPERATIONS_CONSOLE_DISABLED_CODE,
          message: OPERATIONS_CONSOLE_DISABLED_MESSAGE,
        },
        503,
      );
    }
  }

  private wrap<T>(fn: () => Promise<T>): Promise<T> {
    return fn().catch((err) => {
      if (err instanceof OpsConsoleError) {
        throw new HttpException(
          { statusCode: err.httpStatus, code: err.code, message: err.message },
          err.httpStatus,
        );
      }
      throw err;
    });
  }

  private async perms(user: JwtClaimsVO): Promise<Set<string>> {
    return new Set(await this.authz.resolveEffectivePermissions(user.sub));
  }

  @Get('platform/operations/overview')
  @RequirePlatformPermission(OPERATIONS_CONSOLE_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  overview(@CurrentUser() _user: JwtClaimsVO) {
    this.assertEnabled();
    return this.wrap(() => this.query.overview());
  }

  @Get('platform/operations/health')
  @RequirePlatformPermission(OPERATIONS_CONSOLE_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  health(@CurrentUser() _user: JwtClaimsVO) {
    this.assertEnabled();
    return this.wrap(() => this.query.health());
  }

  @Get('platform/operations/jobs')
  @RequirePlatformPermission(OPERATIONS_CONSOLE_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  jobs(@CurrentUser() _user: JwtClaimsVO, @Query() query: Record<string, string>) {
    this.assertEnabled();
    return this.wrap(() =>
      this.query.listJobs({
        cursor: query.cursor,
        limit: query.limit ? Number(query.limit) : undefined,
      }),
    );
  }

  @Get('platform/operations/jobs/:ref')
  @RequirePlatformPermission(OPERATIONS_CONSOLE_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  job(@CurrentUser() _user: JwtClaimsVO, @Param('ref') ref: string) {
    this.assertEnabled();
    return this.wrap(() => this.query.getJob(ref));
  }

  @Get('platform/operations/provisioning')
  @RequirePlatformPermission(OPERATIONS_CONSOLE_PERMISSIONS.provisionView)
  @Header('Cache-Control', 'private, no-store')
  provisioning(@CurrentUser() _user: JwtClaimsVO, @Query() query: Record<string, string>) {
    this.assertEnabled();
    return this.wrap(() =>
      this.query.listProvisioning({ limit: query.limit ? Number(query.limit) : undefined }),
    );
  }

  @Post('platform/operations/provisioning/:id/retry')
  @RequirePlatformPermission(OPERATIONS_CONSOLE_PERMISSIONS.provisionRetry)
  @Header('Cache-Control', 'private, no-store')
  retryProvisioning(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: { expectedRowVersion?: number; reason?: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertEnabled();
    return this.wrap(async () =>
      this.actions.retryProvisioning(user, await this.perms(user), {
        requestId: id,
        expectedRowVersion: Number(body?.expectedRowVersion),
        reason: body?.reason ?? '',
        idempotencyKey: idempotencyKey ?? '',
      }),
    );
  }

  @Get('platform/operations/subscription-expiry')
  @RequirePlatformPermission(OPERATIONS_CONSOLE_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  subscriptionExpiry(@CurrentUser() _user: JwtClaimsVO, @Query() query: Record<string, string>) {
    this.assertEnabled();
    return this.wrap(() =>
      this.query.listSubscriptionExpiry({ limit: query.limit ? Number(query.limit) : undefined }),
    );
  }

  @Get('platform/operations/override-expiry')
  @RequirePlatformPermission(OPERATIONS_CONSOLE_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  overrideExpiry(@CurrentUser() _user: JwtClaimsVO, @Query() query: Record<string, string>) {
    this.assertEnabled();
    return this.wrap(() =>
      this.query.listOverrideExpiry({ limit: query.limit ? Number(query.limit) : undefined }),
    );
  }

  @Get('platform/operations/entitlement-health')
  @RequirePlatformPermission(OPERATIONS_CONSOLE_PERMISSIONS.entitlementHealthView)
  @Header('Cache-Control', 'private, no-store')
  entitlementHealth(@CurrentUser() _user: JwtClaimsVO) {
    this.assertEnabled();
    return this.wrap(() => this.query.entitlementHealth());
  }

  @Post('platform/operations/entitlement-cache/invalidate')
  @RequirePlatformPermission(OPERATIONS_CONSOLE_PERMISSIONS.cacheInvalidate)
  @Header('Cache-Control', 'private, no-store')
  invalidateCache(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: { tenantId?: string; reason?: string; confirmation?: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertEnabled();
    return this.wrap(async () =>
      this.actions.invalidateEntitlementCache(user, await this.perms(user), {
        tenantId: body?.tenantId ?? '',
        reason: body?.reason ?? '',
        idempotencyKey: idempotencyKey ?? '',
        confirmation: body?.confirmation ?? '',
      }),
    );
  }

  @Get('platform/operations/compatibility')
  @RequirePlatformPermission(OPERATIONS_CONSOLE_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  compatibility(@CurrentUser() _user: JwtClaimsVO) {
    this.assertEnabled();
    return this.wrap(() => this.query.compatibility());
  }

  @Get('platform/operations/integrations')
  @RequirePlatformPermission(OPERATIONS_CONSOLE_PERMISSIONS.integrationsView)
  @Header('Cache-Control', 'private, no-store')
  integrations(@CurrentUser() _user: JwtClaimsVO) {
    this.assertEnabled();
    return this.wrap(() => this.query.listIntegrations());
  }

  @Get('platform/operations/backups')
  @RequirePlatformPermission(OPERATIONS_CONSOLE_PERMISSIONS.backupsView)
  @Header('Cache-Control', 'private, no-store')
  backups(@CurrentUser() _user: JwtClaimsVO, @Query() query: Record<string, string>) {
    this.assertEnabled();
    return this.wrap(() =>
      this.query.listBackups({ limit: query.limit ? Number(query.limit) : undefined }),
    );
  }
}

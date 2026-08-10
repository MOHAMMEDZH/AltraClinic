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
import { TenantLifecycleService } from '../application/tenant-lifecycle.service';
import { TenantLifecycleError, type LifecycleAction } from '../domain/tenant-lifecycle.types';
import { LIFECYCLE_PERMISSIONS } from '../tenant-lifecycle.constants';
import {
  isTenantLifecycleEnabled,
  TENANT_LIFECYCLE_DISABLED_CODE,
  TENANT_LIFECYCLE_DISABLED_MESSAGE,
} from '../config/tenant-lifecycle-flags';

@Controller()
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class TenantLifecycleController {
  constructor(private readonly service: TenantLifecycleService) {}

  private assertMutationsEnabled(): void {
    if (!isTenantLifecycleEnabled()) {
      throw new HttpException(
        {
          statusCode: 503,
          code: TENANT_LIFECYCLE_DISABLED_CODE,
          message: TENANT_LIFECYCLE_DISABLED_MESSAGE,
        },
        503,
      );
    }
  }

  @Get('platform/tenants/:tenantId/lifecycle')
  @RequirePlatformPermission(LIFECYCLE_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  async getLifecycle(@CurrentUser() user: JwtClaimsVO, @Param('tenantId') tenantId: string) {
    return this.wrap(() => this.service.getLifecycle(user, tenantId));
  }

  @Post('platform/tenants/:tenantId/lifecycle/preview')
  @RequirePlatformPermission(LIFECYCLE_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  async preview(
    @CurrentUser() user: JwtClaimsVO,
    @Param('tenantId') tenantId: string,
    @Body() body: { action?: LifecycleAction },
  ) {
    if (!body?.action) {
      throw new HttpException({ code: 'action_required', message: 'action is required' }, 400);
    }
    return this.wrap(() => this.service.preview(user, tenantId, body.action!));
  }

  @Post('platform/tenants/:tenantId/lifecycle/activate')
  @RequirePlatformPermission(LIFECYCLE_PERMISSIONS.activate)
  @Header('Cache-Control', 'private, no-store')
  async activate(
    @CurrentUser() user: JwtClaimsVO,
    @Param('tenantId') tenantId: string,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertMutationsEnabled();
    return this.wrap(() =>
      this.service.activate(user, tenantId, body as never, idempotencyKey),
    );
  }

  @Post('platform/tenants/:tenantId/lifecycle/suspend')
  @RequirePlatformPermission(LIFECYCLE_PERMISSIONS.suspend)
  @Header('Cache-Control', 'private, no-store')
  async suspend(
    @CurrentUser() user: JwtClaimsVO,
    @Param('tenantId') tenantId: string,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertMutationsEnabled();
    return this.wrap(() =>
      this.service.suspend(user, tenantId, body as never, idempotencyKey),
    );
  }

  @Post('platform/tenants/:tenantId/lifecycle/reactivate')
  @RequirePlatformPermission(LIFECYCLE_PERMISSIONS.resume)
  @Header('Cache-Control', 'private, no-store')
  async reactivate(
    @CurrentUser() user: JwtClaimsVO,
    @Param('tenantId') tenantId: string,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertMutationsEnabled();
    return this.wrap(() =>
      this.service.reactivate(user, tenantId, body as never, idempotencyKey),
    );
  }

  @Post('platform/tenants/:tenantId/lifecycle/archive-requests')
  @RequirePlatformPermission(LIFECYCLE_PERMISSIONS.archiveRequest)
  @Header('Cache-Control', 'private, no-store')
  async archiveRequest(
    @CurrentUser() user: JwtClaimsVO,
    @Param('tenantId') tenantId: string,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertMutationsEnabled();
    return this.wrap(() =>
      this.service.createArchiveRequest(user, tenantId, body as never, idempotencyKey),
    );
  }

  @Post('platform/tenants/:tenantId/lifecycle/deletion-requests')
  @RequirePlatformPermission(LIFECYCLE_PERMISSIONS.deleteRequest)
  @Header('Cache-Control', 'private, no-store')
  async deletionRequest(
    @CurrentUser() user: JwtClaimsVO,
    @Param('tenantId') tenantId: string,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertMutationsEnabled();
    return this.wrap(() =>
      this.service.createDeletionRequest(user, tenantId, body as never, idempotencyKey),
    );
  }

  private async wrap<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof TenantLifecycleError) {
        throw new HttpException(
          { statusCode: err.httpStatus, code: err.code, message: err.message },
          err.httpStatus,
        );
      }
      throw err;
    }
  }
}

@Controller()
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class TenantLifecycleRequestsController {
  constructor(private readonly service: TenantLifecycleService) {}

  private assertMutationsEnabled(): void {
    if (!isTenantLifecycleEnabled()) {
      throw new HttpException(
        {
          statusCode: 503,
          code: TENANT_LIFECYCLE_DISABLED_CODE,
          message: TENANT_LIFECYCLE_DISABLED_MESSAGE,
        },
        503,
      );
    }
  }

  @Get('platform/tenant-lifecycle-requests')
  @RequirePlatformPermission(LIFECYCLE_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  async list(
    @CurrentUser() user: JwtClaimsVO,
    @Query('status') status?: string,
    @Query('take') take?: string,
  ) {
    return this.wrap(() =>
      this.service.listRequests(user, {
        status,
        take: take ? Number(take) : undefined,
      }),
    );
  }

  @Get('platform/tenant-lifecycle-requests/:requestId')
  @RequirePlatformPermission(LIFECYCLE_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  async get(@CurrentUser() user: JwtClaimsVO, @Param('requestId') requestId: string) {
    return this.wrap(() => this.service.getRequest(user, requestId));
  }

  @Post('platform/tenant-lifecycle-requests/:requestId/approve')
  @RequirePlatformPermission(LIFECYCLE_PERMISSIONS.approve)
  @Header('Cache-Control', 'private, no-store')
  async approve(
    @CurrentUser() user: JwtClaimsVO,
    @Param('requestId') requestId: string,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertMutationsEnabled();
    return this.wrap(() =>
      this.service.approveRequest(user, requestId, body as never, idempotencyKey),
    );
  }

  @Post('platform/tenant-lifecycle-requests/:requestId/reject')
  @RequirePlatformPermission(LIFECYCLE_PERMISSIONS.approve)
  @Header('Cache-Control', 'private, no-store')
  async reject(
    @CurrentUser() user: JwtClaimsVO,
    @Param('requestId') requestId: string,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertMutationsEnabled();
    return this.wrap(() =>
      this.service.rejectRequest(user, requestId, body as never, idempotencyKey),
    );
  }

  @Post('platform/tenant-lifecycle-requests/:requestId/cancel')
  @RequirePlatformPermission(LIFECYCLE_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  async cancel(
    @CurrentUser() user: JwtClaimsVO,
    @Param('requestId') requestId: string,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertMutationsEnabled();
    return this.wrap(() =>
      this.service.cancelRequest(user, requestId, body as never, idempotencyKey),
    );
  }

  private async wrap<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof TenantLifecycleError) {
        throw new HttpException(
          { statusCode: err.httpStatus, code: err.code, message: err.message },
          err.httpStatus,
        );
      }
      throw err;
    }
  }
}

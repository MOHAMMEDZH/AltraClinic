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
import { TenantProvisioningService } from '../application/tenant-provisioning.service';
import {
  TenantProvisioningError,
  type TenantProvisioningRequestInput,
} from '../domain/tenant-provisioning.types';
import { PROVISION_PERMISSIONS } from '../tenant-provisioning.constants';
import {
  isTenantProvisioningEnabled,
  TENANT_PROVISIONING_DISABLED_CODE,
  TENANT_PROVISIONING_DISABLED_MESSAGE,
} from '../config/tenant-provisioning-flags';

@Controller()
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class TenantProvisioningController {
  constructor(private readonly service: TenantProvisioningService) {}

  private assertEnabled(): void {
    if (!isTenantProvisioningEnabled()) {
      throw new HttpException(
        {
          statusCode: 503,
          code: TENANT_PROVISIONING_DISABLED_CODE,
          message: TENANT_PROVISIONING_DISABLED_MESSAGE,
        },
        503,
      );
    }
  }

  @Post('platform/tenant-provisioning/validate')
  @RequirePlatformPermission(PROVISION_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  async validate(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: TenantProvisioningRequestInput,
  ) {
    this.assertEnabled();
    return this.wrap(() => this.service.validate(user, body));
  }

  @Post('platform/tenant-provisioning/requests')
  @RequirePlatformPermission(PROVISION_PERMISSIONS.create)
  @Header('Cache-Control', 'private, no-store')
  async create(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: TenantProvisioningRequestInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertEnabled();
    return this.wrap(() => this.service.createRequest(user, body, idempotencyKey));
  }

  @Post('platform/tenant-provisioning/trial-requests')
  @RequirePlatformPermission('sales-trial.create')
  @Header('Cache-Control', 'private, no-store')
  async createTrial(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: TenantProvisioningRequestInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertEnabled();
    return this.wrap(() =>
      this.service.createRequest(
        user,
        { ...body, onboardingType: 'TRIAL_REQUEST' },
        idempotencyKey,
      ),
    );
  }

  @Get('platform/tenant-provisioning/requests')
  @RequirePlatformPermission(PROVISION_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  async list(
    @CurrentUser() user: JwtClaimsVO,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    this.assertEnabled();
    return this.wrap(() =>
      this.service.listRequests(user, {
        limit: limit ? Number(limit) : undefined,
        cursor,
      }),
    );
  }

  @Get('platform/tenant-provisioning/requests/:requestId')
  @RequirePlatformPermission(PROVISION_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  async get(@CurrentUser() user: JwtClaimsVO, @Param('requestId') requestId: string) {
    this.assertEnabled();
    return this.wrap(() => this.service.getProgress(user, requestId));
  }

  @Post('platform/tenant-provisioning/requests/:requestId/start')
  @RequirePlatformPermission(PROVISION_PERMISSIONS.execute)
  @Header('Cache-Control', 'private, no-store')
  async start(
    @CurrentUser() user: JwtClaimsVO,
    @Param('requestId') requestId: string,
    @Body() body: { expectedRowVersion: number },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertEnabled();
    return this.wrap(() => this.service.start(user, requestId, body, idempotencyKey));
  }

  @Post('platform/tenant-provisioning/requests/:requestId/retry')
  @RequirePlatformPermission(PROVISION_PERMISSIONS.retry)
  @Header('Cache-Control', 'private, no-store')
  async retry(
    @CurrentUser() user: JwtClaimsVO,
    @Param('requestId') requestId: string,
    @Body() body: { expectedRowVersion: number },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertEnabled();
    return this.wrap(() => this.service.retry(user, requestId, body, idempotencyKey));
  }

  @Post('platform/tenant-provisioning/requests/:requestId/compensate')
  @RequirePlatformPermission(PROVISION_PERMISSIONS.compensate)
  @Header('Cache-Control', 'private, no-store')
  async compensate(
    @CurrentUser() user: JwtClaimsVO,
    @Param('requestId') requestId: string,
    @Body() body: { expectedRowVersion: number; reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertEnabled();
    return this.wrap(() => this.service.compensate(user, requestId, body, idempotencyKey));
  }

  @Post('platform/tenant-provisioning/requests/:requestId/activate')
  @RequirePlatformPermission(PROVISION_PERMISSIONS.activate)
  @Header('Cache-Control', 'private, no-store')
  async activate(
    @CurrentUser() user: JwtClaimsVO,
    @Param('requestId') requestId: string,
    @Body() body: { expectedRowVersion: number; reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertEnabled();
    return this.wrap(() => this.service.activate(user, requestId, body, idempotencyKey));
  }

  private async wrap<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof TenantProvisioningError) {
        throw new HttpException(
          { statusCode: err.httpStatus, code: err.code, message: err.message },
          err.httpStatus,
        );
      }
      throw err;
    }
  }
}

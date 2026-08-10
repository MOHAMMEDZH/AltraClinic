/**
 * Supplemental Capability U01 — Platform usage metering inspection / reconcile HTTP API.
 * Reads counter projections only (no clinical row scans). No PHI.
 */
import {
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Post,
  UseGuards,
  HttpException,
} from '@nestjs/common';
import { PlatformAuthRoute } from '../../auth/api/decorators/platform-auth-route.decorator';
import { PlatformPermissionGuard } from '../../auth/api/guards/platform-permission.guard';
import { RequirePlatformPermission } from '../../auth/api/decorators/require-platform-permission.decorator';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { UsageInspectionService } from '../application/usage-inspection.service';
import { UsageMeteringError } from '../domain/usage-metering.types';

@Controller()
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class UsageMeteringPlatformController {
  constructor(private readonly inspection: UsageInspectionService) {}

  @Get('platform/tenants/:tenantId/usage')
  @RequirePlatformPermission('usage.view')
  @Header('Cache-Control', 'private, no-store')
  async list(@CurrentUser() user: JwtClaimsVO, @Param('tenantId') tenantId: string) {
    return this.wrap(() => this.inspection.listMeters(user, tenantId));
  }

  @Get('platform/tenants/:tenantId/usage/:meterKey')
  @RequirePlatformPermission('usage.view')
  @Header('Cache-Control', 'private, no-store')
  async get(
    @CurrentUser() user: JwtClaimsVO,
    @Param('tenantId') tenantId: string,
    @Param('meterKey') meterKey: string,
  ) {
    return this.wrap(() => this.inspection.getMeter(user, tenantId, meterKey));
  }

  @Get('platform/tenants/:tenantId/usage/:meterKey/explain')
  @RequirePlatformPermission('usage.view')
  @Header('Cache-Control', 'private, no-store')
  async explain(
    @CurrentUser() user: JwtClaimsVO,
    @Param('tenantId') tenantId: string,
    @Param('meterKey') meterKey: string,
  ) {
    return this.wrap(() => this.inspection.explain(user, tenantId, meterKey));
  }

  @Post('platform/tenants/:tenantId/usage/:meterKey/reconcile')
  @RequirePlatformPermission('usage.reconcile')
  @Header('Cache-Control', 'private, no-store')
  async reconcile(
    @CurrentUser() user: JwtClaimsVO,
    @Param('tenantId') tenantId: string,
    @Param('meterKey') meterKey: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.wrap(() => this.inspection.reconcile(user, tenantId, meterKey, idempotencyKey));
  }

  private async wrap<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof UsageMeteringError) {
        throw new HttpException({ statusCode: err.httpStatus, code: err.code, message: err.message }, err.httpStatus);
      }
      throw err;
    }
  }
}

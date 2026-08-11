import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformAuthRoute } from '../../auth/api/decorators/platform-auth-route.decorator';
import { RequirePlatformPermission } from '../../auth/api/decorators/require-platform-permission.decorator';
import { PlatformPermissionGuard } from '../../auth/api/guards/platform-permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { TrialAdminService } from '../application/trial-admin.service';
import { TrialConversionService } from '../application/trial-conversion.service';
import { TrialEntitlementPreviewService } from '../application/trial-entitlement-preview.service';
import { SALES_TRIAL_PERMISSIONS } from '../platform-sales-trials.constants';
import { SalesTrialError, SalesTrialValidationError } from '../domain/sales-trial.errors';
import {
  CancelSalesTrialDto,
  ConvertSalesTrialDto,
  CreateSalesTrialDto,
  ExtendSalesTrialDto,
  UpdateSalesTrialDto,
} from './dto/sales-trial.dto';

/**
 * Flexible Step 25 — Trial governance API.
 * Every method is `Cache-Control: private, no-store`: Trial governance state is
 * per-actor scoped and must never be cached by intermediaries.
 */
@Controller('platform/sales/trials')
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class PlatformSalesTrialsController {
  constructor(
    private readonly trials: TrialAdminService,
    private readonly conversion: TrialConversionService,
    private readonly preview: TrialEntitlementPreviewService,
    private readonly authz: PlatformAuthorizationService,
  ) {}

  private async perms(user: JwtClaimsVO): Promise<Set<string>> {
    return new Set(await this.authz.resolveEffectivePermissions(user.sub));
  }

  private wrap<T>(fn: () => Promise<T>): Promise<T> {
    return fn().catch((err) => {
      if (err instanceof SalesTrialError) {
        throw new HttpException(
          { statusCode: err.httpStatus, code: err.code, message: err.message },
          err.httpStatus,
        );
      }
      throw err;
    });
  }

  private requireIdempotencyKey(key: string | undefined): string {
    if (!key?.trim()) {
      throw new SalesTrialValidationError(
        'Idempotency-Key header is required.',
        'idempotency_required',
      );
    }
    return key.trim();
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_TRIAL_PERMISSIONS.view)
  list(
    @CurrentUser() user: JwtClaimsVO,
    @Query() q: { page?: string; pageSize?: string; status?: string; search?: string },
  ) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 25));
    return this.wrap(async () =>
      this.trials.list(user, await this.perms(user), {
        page,
        pageSize,
        status: q.status,
        search: q.search,
      }),
    );
  }

  @Post()
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_TRIAL_PERMISSIONS.create)
  create(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: CreateSalesTrialDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.wrap(async () =>
      this.trials.create(
        user,
        await this.perms(user),
        body,
        this.requireIdempotencyKey(idempotencyKey),
      ),
    );
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_TRIAL_PERMISSIONS.view)
  detail(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    return this.wrap(async () => this.trials.getById(user, await this.perms(user), id));
  }

  @Patch(':id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_TRIAL_PERMISSIONS.update)
  update(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: UpdateSalesTrialDto,
  ) {
    return this.wrap(async () => this.trials.update(user, await this.perms(user), id, body));
  }

  @Post(':id/extend')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_TRIAL_PERMISSIONS.extend)
  extend(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: ExtendSalesTrialDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.wrap(async () =>
      this.trials.extend(
        user,
        await this.perms(user),
        id,
        body,
        this.requireIdempotencyKey(idempotencyKey),
      ),
    );
  }

  @Post(':id/cancel')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_TRIAL_PERMISSIONS.update)
  cancel(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: CancelSalesTrialDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.wrap(async () =>
      this.trials.cancel(
        user,
        await this.perms(user),
        id,
        body,
        this.requireIdempotencyKey(idempotencyKey),
      ),
    );
  }

  @Get(':id/entitlement-preview')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_TRIAL_PERMISSIONS.previewEntitlements)
  entitlementPreview(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Query('targetPaidPlanVersionId') targetPaidPlanVersionId: string,
  ) {
    return this.wrap(async () => {
      if (!targetPaidPlanVersionId?.trim()) {
        throw new SalesTrialValidationError(
          'targetPaidPlanVersionId query parameter is required.',
          'plan_version_required',
        );
      }
      return this.preview.preview(
        user,
        await this.perms(user),
        id,
        targetPaidPlanVersionId.trim(),
      );
    });
  }

  @Post(':id/convert')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_TRIAL_PERMISSIONS.convert)
  convert(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: ConvertSalesTrialDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.wrap(async () =>
      this.conversion.convert(
        user,
        await this.perms(user),
        id,
        body,
        this.requireIdempotencyKey(idempotencyKey),
      ),
    );
  }

  @Get(':id/extensions')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_TRIAL_PERMISSIONS.view)
  extensions(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    return this.wrap(async () => this.trials.listExtensions(user, await this.perms(user), id));
  }

  @Get(':id/history')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_TRIAL_PERMISSIONS.view)
  history(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    return this.wrap(async () => this.trials.listHistory(user, await this.perms(user), id));
  }
}

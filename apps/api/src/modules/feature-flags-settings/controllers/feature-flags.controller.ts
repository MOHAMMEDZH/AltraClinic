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
  UseGuards,
} from '@nestjs/common';
import { PlatformAuthRoute } from '../../auth/api/decorators/platform-auth-route.decorator';
import { PlatformPermissionGuard } from '../../auth/api/guards/platform-permission.guard';
import { RequirePlatformPermission } from '../../auth/api/decorators/require-platform-permission.decorator';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { FeatureFlagsSettingsService } from '../application/feature-flags-settings.service';
import { OperationalDecisionService } from '../application/operational-decision.service';
import { FeatureFlagsSettingsError } from '../domain/feature-flags-settings.types';
import {
  FEATURE_FLAG_PERMISSIONS,
  GLOBAL_SETTING_PERMISSIONS,
} from '../feature-flags-settings.constants';
import {
  FEATURE_FLAGS_SETTINGS_DISABLED_CODE,
  FEATURE_FLAGS_SETTINGS_DISABLED_MESSAGE,
  isFeatureFlagsSettingsEnabled,
} from '../config/feature-flags-settings-flags';

@Controller()
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class FeatureFlagsController {
  constructor(
    private readonly service: FeatureFlagsSettingsService,
    private readonly operational: OperationalDecisionService,
  ) {}

  private assertMutationsEnabled(): void {
    if (!isFeatureFlagsSettingsEnabled()) {
      throw new HttpException(
        {
          statusCode: 503,
          code: FEATURE_FLAGS_SETTINGS_DISABLED_CODE,
          message: FEATURE_FLAGS_SETTINGS_DISABLED_MESSAGE,
        },
        503,
      );
    }
  }

  private wrap<T>(fn: () => Promise<T>): Promise<T> {
    return fn().catch((err) => {
      if (err instanceof FeatureFlagsSettingsError) {
        throw new HttpException(
          { statusCode: err.httpStatus, code: err.code, message: err.message },
          err.httpStatus,
        );
      }
      throw err;
    });
  }

  @Get('platform/feature-flags')
  @RequirePlatformPermission(FEATURE_FLAG_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentUser() _user: JwtClaimsVO) {
    return this.wrap(() => this.service.listFlags());
  }

  @Get('platform/feature-flags/:flagId')
  @RequirePlatformPermission(FEATURE_FLAG_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  get(@Param('flagId') flagId: string) {
    return this.wrap(() => this.service.getFlag(flagId));
  }

  @Post('platform/feature-flags/preview')
  @RequirePlatformPermission(FEATURE_FLAG_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  preview(@Body() body: Record<string, unknown>) {
    return this.service.previewFlagChange(body as never);
  }

  @Post('platform/feature-flags/evaluate')
  @RequirePlatformPermission(FEATURE_FLAG_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  evaluate(
    @Body()
    body: {
      tenantId?: string;
      flagKey?: string;
      entitlementAllows?: boolean;
      lifecycleDenied?: boolean;
    },
  ) {
    if (!body?.tenantId || !body?.flagKey) {
      throw new HttpException(
        { code: 'invalid_body', message: 'tenantId and flagKey required' },
        400,
      );
    }
    return this.wrap(() =>
      this.operational.evaluate({
        tenantId: body.tenantId!,
        flagKey: body.flagKey!,
        entitlementAllows: Boolean(body.entitlementAllows),
        lifecycleDenied: Boolean(body.lifecycleDenied),
      }),
    );
  }

  @Post('platform/feature-flags')
  @RequirePlatformPermission(FEATURE_FLAG_PERMISSIONS.manage)
  @Header('Cache-Control', 'private, no-store')
  create(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertMutationsEnabled();
    return this.wrap(() => this.service.createFlag(user, body as never, idempotencyKey));
  }

  @Patch('platform/feature-flags/:flagId')
  @RequirePlatformPermission(FEATURE_FLAG_PERMISSIONS.manage)
  @Header('Cache-Control', 'private, no-store')
  update(
    @CurrentUser() user: JwtClaimsVO,
    @Param('flagId') flagId: string,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertMutationsEnabled();
    return this.wrap(() => this.service.updateFlag(user, flagId, body as never, idempotencyKey));
  }

  @Post('platform/feature-flags/:flagId/targets')
  @RequirePlatformPermission(FEATURE_FLAG_PERMISSIONS.manage)
  @Header('Cache-Control', 'private, no-store')
  targets(
    @CurrentUser() user: JwtClaimsVO,
    @Param('flagId') flagId: string,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertMutationsEnabled();
    return this.wrap(() =>
      this.service.updateTargets(user, flagId, body as never, idempotencyKey),
    );
  }

  @Post('platform/feature-flags/:flagId/kill-switch/activate')
  @RequirePlatformPermission(FEATURE_FLAG_PERMISSIONS.killSwitch)
  @Header('Cache-Control', 'private, no-store')
  activateKill(
    @CurrentUser() user: JwtClaimsVO,
    @Param('flagId') flagId: string,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertMutationsEnabled();
    return this.wrap(() =>
      this.service.setKillSwitch(user, flagId, true, body as never, idempotencyKey),
    );
  }

  @Post('platform/feature-flags/:flagId/kill-switch/deactivate')
  @RequirePlatformPermission(FEATURE_FLAG_PERMISSIONS.killSwitch)
  @Header('Cache-Control', 'private, no-store')
  deactivateKill(
    @CurrentUser() user: JwtClaimsVO,
    @Param('flagId') flagId: string,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertMutationsEnabled();
    return this.wrap(() =>
      this.service.setKillSwitch(user, flagId, false, body as never, idempotencyKey),
    );
  }

  @Get('platform/feature-flags/:flagId/history')
  @RequirePlatformPermission(FEATURE_FLAG_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  async history(@Param('flagId') flagId: string) {
    const flag = await this.wrap(() => this.service.getFlag(flagId));
    return { items: flag.history ?? [] };
  }
}

@Controller()
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class GlobalSettingsController {
  constructor(private readonly service: FeatureFlagsSettingsService) {}

  private assertMutationsEnabled(): void {
    if (!isFeatureFlagsSettingsEnabled()) {
      throw new HttpException(
        {
          statusCode: 503,
          code: FEATURE_FLAGS_SETTINGS_DISABLED_CODE,
          message: FEATURE_FLAGS_SETTINGS_DISABLED_MESSAGE,
        },
        503,
      );
    }
  }

  private wrap<T>(fn: () => Promise<T>): Promise<T> {
    return fn().catch((err) => {
      if (err instanceof FeatureFlagsSettingsError) {
        throw new HttpException(
          { statusCode: err.httpStatus, code: err.code, message: err.message },
          err.httpStatus,
        );
      }
      throw err;
    });
  }

  @Get('platform/global-settings')
  @RequirePlatformPermission(GLOBAL_SETTING_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  list() {
    return this.wrap(() => this.service.listSettings());
  }

  @Post('platform/global-settings')
  @RequirePlatformPermission(GLOBAL_SETTING_PERMISSIONS.manage)
  @Header('Cache-Control', 'private, no-store')
  create(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertMutationsEnabled();
    return this.wrap(() => this.service.createSetting(user, body as never, idempotencyKey));
  }

  @Get('platform/global-settings/:key')
  @RequirePlatformPermission(GLOBAL_SETTING_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  get(@Param('key') key: string) {
    return this.wrap(() => this.service.getSetting(key));
  }

  @Patch('platform/global-settings/:settingId')
  @RequirePlatformPermission(GLOBAL_SETTING_PERMISSIONS.manage)
  @Header('Cache-Control', 'private, no-store')
  update(
    @CurrentUser() user: JwtClaimsVO,
    @Param('settingId') settingId: string,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertMutationsEnabled();
    return this.wrap(() =>
      this.service.updateSetting(user, settingId, body as never, idempotencyKey),
    );
  }

  @Patch('platform/global-settings/:settingId/reference')
  @RequirePlatformPermission(GLOBAL_SETTING_PERMISSIONS.referenceManage)
  @Header('Cache-Control', 'private, no-store')
  updateReference(
    @CurrentUser() user: JwtClaimsVO,
    @Param('settingId') settingId: string,
    @Body() body: Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertMutationsEnabled();
    return this.wrap(() =>
      this.service.updateSettingReference(user, settingId, body as never, idempotencyKey),
    );
  }
}

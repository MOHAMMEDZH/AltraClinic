import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
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
import { PLATFORM_NOTIFICATION_PERMISSIONS } from '../platform-notifications.constants';
import { PlatformNotificationError, PlatformNotificationValidationError } from '../domain/platform-notifications.errors';
import { PlatformNotificationQueryService } from '../application/platform-notification-query.service';
import { PlatformNotificationPreferenceService } from '../application/preferences/platform-notification-preference.service';
import type { PlatformNotificationCategory, PlatformNotificationLocale } from '../domain/platform-notifications.types';

@Controller('platform/notifications')
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class PlatformNotificationsController {
  constructor(
    private readonly query: PlatformNotificationQueryService,
    private readonly prefs: PlatformNotificationPreferenceService,
    private readonly authz: PlatformAuthorizationService,
  ) {}

  private async perms(user: JwtClaimsVO): Promise<Set<string>> {
    return new Set(await this.authz.resolveEffectivePermissions(user.sub));
  }

  private wrap<T>(fn: () => Promise<T>): Promise<T> {
    return fn().catch((err) => {
      if (err instanceof PlatformNotificationError) {
        throw new HttpException(
          { statusCode: err.httpStatus, code: err.code, message: err.message },
          err.httpStatus,
        );
      }
      throw err;
    });
  }

  @Get('templates')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(PLATFORM_NOTIFICATION_PERMISSIONS.templatesView)
  templates(@CurrentUser() user: JwtClaimsVO) {
    return this.wrap(async () => this.query.listTemplates(await this.perms(user)));
  }

  @Get('templates/:key')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(PLATFORM_NOTIFICATION_PERMISSIONS.templatesView)
  templateDetail(@CurrentUser() user: JwtClaimsVO, @Param('key') key: string) {
    return this.wrap(async () => this.query.getTemplate(await this.perms(user), key));
  }

  @Post('templates/:key/preview')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(PLATFORM_NOTIFICATION_PERMISSIONS.templatesView)
  preview(
    @CurrentUser() user: JwtClaimsVO,
    @Param('key') key: string,
    @Body() body: { locale?: PlatformNotificationLocale },
  ) {
    return this.wrap(async () =>
      this.query.preview(user, await this.perms(user), key, body.locale ?? 'en-US'),
    );
  }

  @Get('preferences')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(PLATFORM_NOTIFICATION_PERMISSIONS.preferencesView)
  preferences(@CurrentUser() user: JwtClaimsVO) {
    return this.wrap(async () => this.prefs.list(user, await this.perms(user)));
  }

  @Patch('preferences')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(PLATFORM_NOTIFICATION_PERMISSIONS.preferencesManage)
  patchPreferences(
    @CurrentUser() user: JwtClaimsVO,
    @Body()
    body: {
      category: PlatformNotificationCategory;
      channel: string;
      enabled: boolean;
      locale?: string;
      expectedRowVersion?: number;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.wrap(async () => {
      if (!idempotencyKey?.trim()) {
        throw new PlatformNotificationValidationError(
          'Idempotency-Key header is required.',
          'idempotency_required',
        );
      }
      return this.prefs.upsert(user, await this.perms(user), body, idempotencyKey.trim());
    });
  }

  @Get('deliveries')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(PLATFORM_NOTIFICATION_PERMISSIONS.deliveriesView)
  deliveries(
    @CurrentUser() user: JwtClaimsVO,
    @Query() q: { page?: string; pageSize?: string; status?: string },
  ) {
    return this.wrap(async () =>
      this.query.listDeliveries(await this.perms(user), {
        page: Number(q.page) || 1,
        pageSize: Number(q.pageSize) || 25,
        status: q.status,
      }),
    );
  }

  @Get('deliveries/:id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(PLATFORM_NOTIFICATION_PERMISSIONS.deliveriesView)
  deliveryDetail(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    return this.wrap(async () => this.query.getDelivery(await this.perms(user), id));
  }

  @Post('deliveries/:id/retry')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(PLATFORM_NOTIFICATION_PERMISSIONS.deliveriesRetry)
  retry(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: { reason: string; jobId?: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.wrap(async () => {
      if (!idempotencyKey?.trim()) {
        throw new PlatformNotificationValidationError(
          'Idempotency-Key header is required.',
          'idempotency_required',
        );
      }
      return this.query.retryDelivery(
        user,
        await this.perms(user),
        id,
        body,
        idempotencyKey.trim(),
      );
    });
  }
}

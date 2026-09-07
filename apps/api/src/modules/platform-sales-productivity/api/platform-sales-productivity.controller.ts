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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PlatformAuthRoute } from '../../auth/api/decorators/platform-auth-route.decorator';
import { RequirePlatformPermission } from '../../auth/api/decorators/require-platform-permission.decorator';
import { PlatformPermissionGuard } from '../../auth/api/guards/platform-permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { CommissionSnapshotService } from '../application/commission-snapshot.service';
import { ProductivityExportService } from '../application/productivity-export.service';
import { ProductivityQueryService } from '../application/productivity-query.service';
import { SALES_PRODUCTIVITY_PERMISSIONS } from '../platform-sales-productivity.constants';
import {
  SalesProductivityError,
  SalesProductivityValidationError,
} from '../domain/sales-productivity.errors';
import {
  GenerateCommissionSnapshotDto,
  MarkPaidCommissionSnapshotDto,
  ReviewCommissionSnapshotDto,
} from './dto/sales-productivity.dto';

/**
 * Flexible Step 26 — productivity metrics + commission snapshot review API.
 * Every method is `Cache-Control: private, no-store`.
 */
@Controller('platform/sales')
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class PlatformSalesProductivityController {
  constructor(
    private readonly productivity: ProductivityQueryService,
    private readonly snapshots: CommissionSnapshotService,
    private readonly exportService: ProductivityExportService,
    private readonly authz: PlatformAuthorizationService,
  ) {}

  private async perms(user: JwtClaimsVO): Promise<Set<string>> {
    return new Set(await this.authz.resolveEffectivePermissions(user.sub));
  }

  private wrap<T>(fn: () => Promise<T>): Promise<T> {
    return fn().catch((err) => {
      if (err instanceof SalesProductivityError) {
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
      throw new SalesProductivityValidationError(
        'Idempotency-Key header is required.',
        'idempotency_required',
      );
    }
    return key.trim();
  }

  @Get('productivity/self')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_PRODUCTIVITY_PERMISSIONS.reportView)
  self(
    @CurrentUser() user: JwtClaimsVO,
    @Query('periodKey') periodKey?: string,
  ) {
    return this.wrap(async () =>
      this.productivity.self(user, await this.perms(user), periodKey),
    );
  }

  @Get('productivity/team')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_PRODUCTIVITY_PERMISSIONS.reportView)
  team(
    @CurrentUser() user: JwtClaimsVO,
    @Query() q: { periodKey?: string; representativeId?: string },
  ) {
    return this.wrap(async () =>
      this.productivity.team(user, await this.perms(user), q),
    );
  }

  @Get('productivity/export')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_PRODUCTIVITY_PERMISSIONS.reportExport)
  export(
    @CurrentUser() user: JwtClaimsVO,
    @Query() q: { periodKey?: string; representativeId?: string },
    @Res() res: Response,
  ) {
    return this.wrap(async () => {
      if (!q.periodKey?.trim()) {
        throw new SalesProductivityValidationError('periodKey query parameter is required.');
      }
      const file = await this.exportService.exportCsv(user, await this.perms(user), {
        periodKey: q.periodKey,
        representativeId: q.representativeId,
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      res.send(file.body);
    });
  }

  @Get('commission-snapshots')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_PRODUCTIVITY_PERMISSIONS.snapshotView)
  listSnapshots(
    @CurrentUser() user: JwtClaimsVO,
    @Query()
    q: {
      page?: string;
      pageSize?: string;
      periodKey?: string;
      representativeId?: string;
      status?: string;
    },
  ) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 25));
    return this.wrap(async () =>
      this.snapshots.list(user, await this.perms(user), {
        page,
        pageSize,
        periodKey: q.periodKey,
        representativeId: q.representativeId,
        status: q.status,
      }),
    );
  }

  @Post('commission-snapshots/generate')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_PRODUCTIVITY_PERMISSIONS.snapshotGenerate)
  generate(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: GenerateCommissionSnapshotDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.wrap(async () =>
      this.snapshots.generate(
        user,
        await this.perms(user),
        body,
        this.requireIdempotencyKey(idempotencyKey),
      ),
    );
  }

  @Get('commission-snapshots/:id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_PRODUCTIVITY_PERMISSIONS.snapshotView)
  snapshotDetail(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    return this.wrap(async () => this.snapshots.getById(user, await this.perms(user), id));
  }

  @Post('commission-snapshots/:id/review')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_PRODUCTIVITY_PERMISSIONS.snapshotReview)
  review(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: ReviewCommissionSnapshotDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.wrap(async () =>
      this.snapshots.review(
        user,
        await this.perms(user),
        id,
        body,
        this.requireIdempotencyKey(idempotencyKey),
      ),
    );
  }

  @Post('commission-snapshots/:id/mark-paid')
  @Header('Cache-Control', 'private, no-store')
  @RequirePlatformPermission(SALES_PRODUCTIVITY_PERMISSIONS.snapshotMarkPaid)
  markPaid(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: MarkPaidCommissionSnapshotDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.wrap(async () =>
      this.snapshots.markPaid(
        user,
        await this.perms(user),
        id,
        body,
        this.requireIdempotencyKey(idempotencyKey),
      ),
    );
  }
}

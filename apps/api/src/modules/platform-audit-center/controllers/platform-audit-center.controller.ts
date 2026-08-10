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
import { PlatformPermissionGuard } from '../../auth/api/guards/platform-permission.guard';
import { RequirePlatformPermission } from '../../auth/api/decorators/require-platform-permission.decorator';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { AUDIT_CENTER_PERMISSIONS } from '../platform-audit-center.constants';
import {
  AUDIT_CENTER_DISABLED_CODE,
  AUDIT_CENTER_DISABLED_MESSAGE,
  isAuditCenterEnabled,
} from '../config/audit-center-flags';
import { AuditCenterError, type AuditCenterExportInput } from '../domain/audit-center.types';
import { AuditCenterQueryService } from '../application/audit-center-query.service';
import { AuditCenterEvidenceService } from '../application/audit-center-evidence.service';
import { AuditCenterExportService } from '../application/audit-center-export.service';

@Controller()
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class PlatformAuditCenterController {
  constructor(
    private readonly query: AuditCenterQueryService,
    private readonly evidence: AuditCenterEvidenceService,
    private readonly exports: AuditCenterExportService,
    private readonly authz: PlatformAuthorizationService,
  ) {}

  private assertEnabled(): void {
    if (!isAuditCenterEnabled()) {
      throw new HttpException(
        {
          statusCode: 503,
          code: AUDIT_CENTER_DISABLED_CODE,
          message: AUDIT_CENTER_DISABLED_MESSAGE,
        },
        503,
      );
    }
  }

  private wrap<T>(fn: () => Promise<T>): Promise<T> {
    return fn().catch((err) => {
      if (err instanceof AuditCenterError) {
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

  @Get('platform/audit/entries')
  @RequirePlatformPermission(AUDIT_CENTER_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  search(@CurrentUser() user: JwtClaimsVO, @Query() query: Record<string, string>) {
    this.assertEnabled();
    return this.wrap(async () =>
      this.query.search(
        {
          from: query.from,
          to: query.to,
          actorId: query.actorId,
          action: query.action,
          category: query.category,
          resourceType: query.resourceType,
          resourceId: query.resourceId,
          tenantId: query.tenantId,
          correlationId: query.correlationId,
          cursor: query.cursor,
          limit: query.limit ? Number(query.limit) : undefined,
        },
        await this.perms(user),
      ),
    );
  }

  @Get('platform/audit/entries/:id')
  @RequirePlatformPermission(AUDIT_CENTER_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  get(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    this.assertEnabled();
    return this.wrap(async () => this.query.getById(id, await this.perms(user)));
  }

  @Get('platform/audit/correlation/:correlationId')
  @RequirePlatformPermission(AUDIT_CENTER_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  correlation(@CurrentUser() user: JwtClaimsVO, @Param('correlationId') correlationId: string) {
    this.assertEnabled();
    return this.wrap(async () =>
      this.query.correlationTimeline(correlationId, await this.perms(user)),
    );
  }

  @Get('platform/audit/plan-versions/:planVersionId/evidence')
  @RequirePlatformPermission(AUDIT_CENTER_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  planEvidence(@CurrentUser() user: JwtClaimsVO, @Param('planVersionId') planVersionId: string) {
    this.assertEnabled();
    return this.wrap(async () =>
      this.evidence.planVersionEvidence(planVersionId, await this.perms(user)),
    );
  }

  @Get('platform/audit/overrides/:overrideId/evidence')
  @RequirePlatformPermission(AUDIT_CENTER_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  overrideEvidence(@CurrentUser() user: JwtClaimsVO, @Param('overrideId') overrideId: string) {
    this.assertEnabled();
    return this.wrap(async () =>
      this.evidence.overrideEvidence(overrideId, await this.perms(user)),
    );
  }

  @Get('platform/audit/feature-flags/:flagId/evidence')
  @RequirePlatformPermission(AUDIT_CENTER_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  flagEvidence(@CurrentUser() user: JwtClaimsVO, @Param('flagId') flagId: string) {
    this.assertEnabled();
    return this.wrap(async () =>
      this.evidence.flagHistoryEvidence(flagId, await this.perms(user)),
    );
  }

  @Get('platform/audit/eer-decisions')
  @RequirePlatformPermission(AUDIT_CENTER_PERMISSIONS.view)
  @Header('Cache-Control', 'private, no-store')
  eer(
    @CurrentUser() user: JwtClaimsVO,
    @Query('tenantId') tenantId: string,
    @Query('capabilityKey') capabilityKey?: string,
  ) {
    this.assertEnabled();
    return this.wrap(async () =>
      this.evidence.eerDecisionEvidence({ tenantId, capabilityKey }, await this.perms(user)),
    );
  }

  @Post('platform/audit/exports/preview')
  @RequirePlatformPermission(AUDIT_CENTER_PERMISSIONS.export)
  @Header('Cache-Control', 'private, no-store')
  preview(@CurrentUser() user: JwtClaimsVO, @Body() body: AuditCenterExportInput) {
    this.assertEnabled();
    return this.wrap(async () => this.exports.preview(body, await this.perms(user)));
  }

  @Post('platform/audit/exports')
  @RequirePlatformPermission(AUDIT_CENTER_PERMISSIONS.export)
  create(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: AuditCenterExportInput,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    this.assertEnabled();
    return this.wrap(async () =>
      this.exports.execute(
        user,
        body,
        await this.perms(user),
        idempotencyKey?.trim() || cryptoRandom(),
      ),
    );
  }

  @Get('platform/audit/exports/:exportId')
  @RequirePlatformPermission(AUDIT_CENTER_PERMISSIONS.export)
  @Header('Cache-Control', 'private, no-store')
  getExport(@CurrentUser() user: JwtClaimsVO, @Param('exportId') exportId: string) {
    this.assertEnabled();
    return this.wrap(async () =>
      this.exports.getExport(exportId, user.sub, await this.perms(user)),
    );
  }

  @Get('platform/audit/exports/:exportId/download')
  @RequirePlatformPermission(AUDIT_CENTER_PERMISSIONS.export)
  @Header('Cache-Control', 'private, no-store')
  async download(
    @CurrentUser() user: JwtClaimsVO,
    @Param('exportId') exportId: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    this.assertEnabled();
    try {
      const file = await this.exports.download(
        exportId,
        user.sub,
        token,
        await this.perms(user),
      );
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
      res.send(file.csv);
    } catch (err) {
      if (err instanceof AuditCenterError) {
        throw new HttpException(
          { statusCode: err.httpStatus, code: err.code, message: err.message },
          err.httpStatus,
        );
      }
      throw err;
    }
  }
}

function cryptoRandom(): string {
  return `ac-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

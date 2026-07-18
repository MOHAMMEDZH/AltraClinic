import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
  Body,
} from '@nestjs/common';
import type { Response } from 'express';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { ExportRuntimeService } from '../application/export-runtime.service';
import { ImportExportJobService } from '../application/import-export-job.service';
import { IMPORT_EXPORT_PERMISSION_RESOURCE } from '../import-export.constants';
import { ExportAdapterResolutionError } from '../domain/export/export-adapter.contracts';
import type { ExportFileFormat } from '../domain/export/export-adapter.contracts';
import { toPublicImportExportJob } from '../application/public-job.mapper';

class CreateExportBody {
  typeId!: string;
  format!: ExportFileFormat;
  branchId?: string | null;
  filters?: Record<string, unknown>;
  idempotencyKey?: string;
  correlationId?: string;
  queueImmediately?: boolean;
}

/**
 * Phase 42e — Export Runtime APIs only (no import endpoint changes).
 */
@Controller('import-export/exports')
@UseGuards(TenantScopedAccessGuard)
export class ImportExportExportsController {
  constructor(
    private readonly exports: ExportRuntimeService,
    private readonly jobs: ImportExportJobService,
  ) {}

  @Post()
  @RequirePermission(IMPORT_EXPORT_PERMISSION_RESOURCE, 'export')
  async create(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: CreateExportBody,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    if (!body.typeId?.trim()) throw new BadRequestException('typeId is required');
    if (!body.format?.trim()) throw new BadRequestException('format is required');
    const idempotencyKey =
      body.idempotencyKey?.trim() ||
      idempotencyHeader?.trim() ||
      `ie-export:${user.sub}:${body.typeId}:${Date.now()}`;

    try {
      const job = await this.exports.createExport({
        tenantId: user.tenantId,
        branchId: body.branchId ?? user.branchId,
        typeId: body.typeId.trim(),
        format: body.format,
        initiatedByUserId: user.sub,
        actorRoles: user.roles.map(String),
        idempotencyKey,
        correlationId: body.correlationId,
        filters: body.filters,
        queueImmediately: body.queueImmediately,
      });
      return { job: toPublicImportExportJob(job) };
    } catch (error) {
      if (error instanceof ExportAdapterResolutionError) {
        throw new BadRequestException({ code: error.code, message: error.message });
      }
      throw error;
    }
  }

  @Get(':id')
  @RequirePermission(IMPORT_EXPORT_PERMISSION_RESOURCE, 'view')
  async get(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const job = await this.jobs.getJob(user.tenantId, id, {
      userId: user.sub,
      roles: user.roles.map(String),
      branchId: user.branchId,
    });
    if (job.direction !== 'export') throw new BadRequestException('Not an export job');
    return { job: toPublicImportExportJob(job), progress: this.exports.getProgress(job) };
  }

  @Get(':id/progress')
  @RequirePermission(IMPORT_EXPORT_PERMISSION_RESOURCE, 'view')
  async progress(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const job = await this.jobs.getJob(user.tenantId, id, {
      userId: user.sub,
      roles: user.roles.map(String),
      branchId: user.branchId,
    });
    if (job.direction !== 'export') throw new BadRequestException('Not an export job');
    return { jobId: job.id, progress: this.exports.getProgress(job), status: job.status };
  }

  @Get(':id/artifact')
  @RequirePermission(IMPORT_EXPORT_PERMISSION_RESOURCE, 'export')
  async artifact(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const actor = {
      userId: user.sub,
      roles: user.roles.map(String),
      branchId: user.branchId,
    };

    if (token?.trim()) {
      const file = await this.exports.downloadArtifact({
        tenantId: user.tenantId,
        jobId: id,
        actor,
        token: token.trim(),
      });
      res.setHeader('Content-Type', file.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${file.filename.replace(/"/g, '')}"`,
      );
      res.setHeader('X-Content-Path-Hidden', 'true');
      return file.buffer;
    }

    return this.exports.getArtifactMetadata(user.tenantId, id, actor);
  }

  @Post(':id/cancel')
  @RequirePermission(IMPORT_EXPORT_PERMISSION_RESOURCE, 'manage')
  async cancel(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const job = await this.jobs.cancelJob(user.tenantId, id, {
      userId: user.sub,
      roles: user.roles.map(String),
      branchId: user.branchId,
    });
    return { job: toPublicImportExportJob(job) };
  }
}

import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { ImportExportJobService } from '../application/import-export-job.service';
import type { JobDirection, JobPriority, JobStatus } from '../domain/job/import-export-job.types';
import { IMPORT_EXPORT_PERMISSION_RESOURCE } from '../import-export.constants';
import {
  toPublicImportExportJob,
  toPublicImportExportJobs,
} from '../application/public-job.mapper';

class CreateJobBody {
  typeId!: string;
  direction!: JobDirection;
  branchId?: string | null;
  priority?: JobPriority;
  queueImmediately?: boolean;
  idempotencyKey?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Phase 42c — infrastructure job APIs only.
 * No upload/download/execution endpoints.
 */
@Controller('import-export/jobs')
@UseGuards(TenantScopedAccessGuard)
export class ImportExportJobsController {
  constructor(private readonly jobs: ImportExportJobService) {}

  @Post()
  @RequirePermission(IMPORT_EXPORT_PERMISSION_RESOURCE, 'create')
  async create(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: CreateJobBody,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    const idempotencyKey =
      body.idempotencyKey?.trim() ||
      idempotencyHeader?.trim() ||
      `ie-create:${user.sub}:${body.typeId}:${body.direction}:${Date.now()}`;

    const job = await this.jobs.createJob({
      tenantId: user.tenantId,
      branchId: body.branchId ?? user.branchId,
      typeId: body.typeId,
      direction: body.direction,
      initiatedByUserId: user.sub,
      actorRoles: user.roles.map(String),
      idempotencyKey,
      correlationId: body.correlationId,
      priority: body.priority,
      queueImmediately: body.queueImmediately,
      metadata: {
        source: 'api',
        ...(body.metadata ?? {}),
      },
    });

    return { job: toPublicImportExportJob(job) };
  }

  @Get()
  @RequirePermission(IMPORT_EXPORT_PERMISSION_RESOURCE, 'view')
  async list(
    @CurrentUser() user: JwtClaimsVO,
    @Query('status') status?: JobStatus,
    @Query('typeId') typeId?: string,
    @Query('direction') direction?: JobDirection,
    @Query('branchId') branchId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const jobs = await this.jobs.listJobs(
      user.tenantId,
      { userId: user.sub, roles: user.roles.map(String), branchId: user.branchId },
      {
        status,
        typeId,
        direction,
        branchId: branchId ?? undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      },
    );
    return { jobs: toPublicImportExportJobs(jobs) };
  }

  @Get(':id')
  @RequirePermission(IMPORT_EXPORT_PERMISSION_RESOURCE, 'view')
  async get(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const job = await this.jobs.getJob(user.tenantId, id, {
      userId: user.sub,
      roles: user.roles.map(String),
      branchId: user.branchId,
    });
    return { job: toPublicImportExportJob(job) };
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

  @Post(':id/retry')
  @RequirePermission(IMPORT_EXPORT_PERMISSION_RESOURCE, 'manage')
  async retry(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const job = await this.jobs.retryJob(user.tenantId, id, {
      userId: user.sub,
      roles: user.roles.map(String),
      branchId: user.branchId,
    });
    return { job: toPublicImportExportJob(job) };
  }
}

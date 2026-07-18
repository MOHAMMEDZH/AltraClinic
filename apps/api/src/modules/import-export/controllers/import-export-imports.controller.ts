import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { ImportRuntimeService } from '../application/import-runtime.service';
import { ImportExportJobService } from '../application/import-export-job.service';
import { IMPORT_EXPORT_PERMISSION_RESOURCE } from '../import-export.constants';
import { MalwareDetectedError } from '../application/import-file-intake.service';
import { toPublicImportExportJob } from '../application/public-job.mapper';

class CreateImportBody {
  typeId!: string;
  branchId?: string | null;
  dryRun?: boolean;
  idempotencyKey?: string;
  correlationId?: string;
}

/**
 * Phase 42d — Import Runtime APIs only (no export endpoints).
 */
@Controller('import-export/imports')
@UseGuards(TenantScopedAccessGuard)
export class ImportExportImportsController {
  constructor(
    private readonly imports: ImportRuntimeService,
    private readonly jobs: ImportExportJobService,
  ) {}

  @Post()
  @RequirePermission(IMPORT_EXPORT_PERMISSION_RESOURCE, 'create')
  async create(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: CreateImportBody,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    if (!body.typeId?.trim()) throw new BadRequestException('typeId is required');
    const idempotencyKey =
      body.idempotencyKey?.trim() ||
      idempotencyHeader?.trim() ||
      `ie-import:${user.sub}:${body.typeId}:${Date.now()}`;

    const job = await this.imports.createImport({
      tenantId: user.tenantId,
      branchId: body.branchId ?? user.branchId,
      typeId: body.typeId.trim(),
      initiatedByUserId: user.sub,
      actorRoles: user.roles.map(String),
      idempotencyKey,
      correlationId: body.correlationId,
      dryRun: body.dryRun,
    });
    return { job: toPublicImportExportJob(job) };
  }

  @Post(':id/upload')
  @RequirePermission(IMPORT_EXPORT_PERMISSION_RESOURCE, 'create')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('file is required');
    try {
      const job = await this.imports.uploadFile({
        tenantId: user.tenantId,
        jobId: id,
        actor: {
          userId: user.sub,
          roles: user.roles.map(String),
          branchId: user.branchId,
        },
        file: {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
        },
      });
      return { job: toPublicImportExportJob(job) };
    } catch (error) {
      if (error instanceof MalwareDetectedError) {
        throw new BadRequestException(error.message);
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
    if (job.direction !== 'import') throw new BadRequestException('Not an import job');
    return { job: toPublicImportExportJob(job), progress: this.imports.getProgress(job) };
  }

  @Get(':id/progress')
  @RequirePermission(IMPORT_EXPORT_PERMISSION_RESOURCE, 'view')
  async progress(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const job = await this.jobs.getJob(user.tenantId, id, {
      userId: user.sub,
      roles: user.roles.map(String),
      branchId: user.branchId,
    });
    return { jobId: job.id, progress: this.imports.getProgress(job), status: job.status };
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

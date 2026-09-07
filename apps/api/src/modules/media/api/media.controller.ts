import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { UploadMediaHandler } from '../application/handlers/upload-media.handler';
import { GetMediaHandler } from '../application/handlers/get-media.handler';
import { DownloadMediaHandler } from '../application/handlers/download-media.handler';
import { DeleteMediaHandler } from '../application/handlers/delete-media.handler';
import { ListMediaHandler, UpdateMediaHandler, parseClinicalFromUpload } from '../application/handlers/list-media.handler';
import { UploadMediaDTO } from '../application/dto/upload-media.dto';
import { UpdateMediaDTO } from '../application/dto/update-media.dto';
import { MediaVariantType } from '../domain/value-objects/media-variant.vo';

@Controller('media')
@UseGuards(TenantScopedAccessGuard)
@RequireLicensedModule('media')
export class MediaController {
  constructor(
    private readonly uploadHandler: UploadMediaHandler,
    private readonly getHandler: GetMediaHandler,
    private readonly downloadHandler: DownloadMediaHandler,
    private readonly deleteHandler: DeleteMediaHandler,
    private readonly listHandler: ListMediaHandler,
    private readonly updateHandler: UpdateMediaHandler,
  ) {}

  @Get()
  @RequirePermission('api.media', 'view')
  async list(
    @Query('patientId') patientId?: string,
    @Query('category') category?: string,
    @Query('ownerType') ownerType?: string,
    @Query('ownerId') ownerId?: string,
    @Query('encounterId') encounterId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.listHandler.execute({
      patientId,
      category,
      ownerType,
      ownerId,
      encounterId,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('upload')
  @RequirePermission('api.media', 'create')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadMediaDTO,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('file is required (multipart field: file)');
    }

    const clinical = parseClinicalFromUpload(body);

    return this.uploadHandler.execute({
      category: body.category,
      ownerType: body.ownerType,
      ownerId: body.ownerId,
      patientId: body.patientId ?? null,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
      uploadedBy: user.sub,
      comparisonGroupId: body.comparisonGroupId ?? null,
      comparisonRole: body.comparisonRole ?? null,
      clinical,
    });
  }

  @Get(':id/download')
  @RequirePermission('api.media', 'view')
  async download(
    @Param('id') id: string,
    @Query('variant') variant: string | undefined,
    @CurrentUser() user: JwtClaimsVO,
    @Res() res: Response,
  ) {
    const result = await this.downloadHandler.execute({
      id,
      variant: variant as MediaVariantType | undefined,
      actorUserId: user.sub,
    });

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Length', result.sizeBytes);
    res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
    res.send(result.buffer);
  }

  @Get(':id')
  @RequirePermission('api.media', 'view')
  async get(@Param('id') id: string, @CurrentUser() user: JwtClaimsVO) {
    return this.getHandler.execute({ id, actorUserId: user.sub });
  }

  @Patch(':id')
  @RequirePermission('api.media', 'update')
  async update(@Param('id') id: string, @Body() body: UpdateMediaDTO) {
    return this.updateHandler.execute(id, body.clinical ?? {});
  }

  @Delete(':id')
  @RequirePermission('api.media', 'delete')
  async delete(@Param('id') id: string, @CurrentUser() user: JwtClaimsVO) {
    return this.deleteHandler.execute({ id, deletedBy: user.sub });
  }
}

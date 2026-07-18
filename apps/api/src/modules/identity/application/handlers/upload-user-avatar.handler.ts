import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { USER_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { UserRepository } from '../../domain/user.repository.interface';
import { UploadMediaHandler } from '../../../media/application/handlers/upload-media.handler';

@Injectable()
export class UploadUserAvatarHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly tenantContext: TenantContextService,
    private readonly uploadMedia: UploadMediaHandler,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    userId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
    uploadedBy: string,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('File is required');
    const tenant = await this.tenantContext.resolve();
    const user = await this.userRepo.findById(userId, tenant.tenantId);
    if (!user) throw new NotFoundException('User not found');

    const result = await this.uploadMedia.execute({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalFilename: file.originalname,
      category: 'medical_document',
      ownerType: 'user',
      ownerId: userId,
      uploadedBy,
    });

    const avatarUrl = `/media/${result.mediaId}`;
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    return { avatarUrl, mediaId: result.mediaId };
  }
}

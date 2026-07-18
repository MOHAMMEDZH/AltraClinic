import { Module } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../common/tenant-scoped-access.guard';
import { MediaController } from './api/media.controller';
import { PrismaMediaAssetRepository } from './infrastructure/repositories/prisma-media-asset.repository';
import { LocalMediaStorageService } from './infrastructure/storage/local-media-storage.service';
import { MEDIA_STORAGE } from './infrastructure/storage/media-storage.port';
import { NoOpVirusScannerService } from './infrastructure/virus-scan/noop-virus-scanner.service';
import { VIRUS_SCANNER } from './infrastructure/virus-scan/virus-scanner.port';
import { SharpMediaProcessorService } from './infrastructure/processing/sharp-media-processor.service';
import { MediaProcessingPipeline } from './application/services/media-processing-pipeline.service';
import { UploadMediaHandler } from './application/handlers/upload-media.handler';
import { GetMediaHandler } from './application/handlers/get-media.handler';
import { DownloadMediaHandler } from './application/handlers/download-media.handler';
import { DeleteMediaHandler } from './application/handlers/delete-media.handler';
import { ListMediaHandler, UpdateMediaHandler } from './application/handlers/list-media.handler';
import { MediaListService } from './application/services/media-list.service';
import { MEDIA_ASSET_REPOSITORY } from '../../infrastructure/provider.tokens';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [SubscriptionModule],
  controllers: [MediaController],
  providers: [
    { provide: MEDIA_ASSET_REPOSITORY, useClass: PrismaMediaAssetRepository },
    { provide: MEDIA_STORAGE, useClass: LocalMediaStorageService },
    { provide: VIRUS_SCANNER, useClass: NoOpVirusScannerService },
    SharpMediaProcessorService,
    MediaProcessingPipeline,
    UploadMediaHandler,
    GetMediaHandler,
    DownloadMediaHandler,
    DeleteMediaHandler,
    ListMediaHandler,
    UpdateMediaHandler,
    MediaListService,
    TenantScopedAccessGuard,
  ],
  exports: [MEDIA_ASSET_REPOSITORY, MEDIA_STORAGE, MediaProcessingPipeline, UploadMediaHandler],
})
export class MediaModule {}

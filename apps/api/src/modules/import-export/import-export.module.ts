import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { AuditModule } from '../audit/audit.module';
import { DeliveryModule } from '../notifications/delivery/delivery.module';
import { IdentityModule } from '../identity/identity.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { BullMqConnectionService } from '../background/infrastructure/bullmq-connection.service';
import { VIRUS_SCANNER } from '../media/infrastructure/virus-scan/virus-scanner.port';
import { NoOpVirusScannerService } from '../media/infrastructure/virus-scan/noop-virus-scanner.service';
import { ImportExportHealthController } from './controllers/import-export-health.controller';
import { ImportExportCatalogController } from './controllers/import-export-catalog.controller';
import { ImportExportJobsController } from './controllers/import-export-jobs.controller';
import { ImportExportImportsController } from './controllers/import-export-imports.controller';
import { ImportExportExportsController } from './controllers/import-export-exports.controller';
import { EffectiveImportExportViewService } from './application/effective-import-export-view.service';
import { ImportExportExtensionRegistry } from './application/import-export-extension.registry';
import { ImportExportRuntimeRegistry } from './application/import-export-runtime.registry';
import { ImportExportActivityContracts } from './application/import-export-activity.contracts';
import { ImportExportAuditContracts } from './application/import-export-audit.contracts';
import { ImportExportActivityEmitterService } from './application/import-export-activity.emitter';
import { ImportExportJobService } from './application/import-export-job.service';
import { ImportExportNotificationIntentService } from './application/import-export-notification-intent.service';
import { NullImportExportExecutor } from './application/null-import-export.executor';
import { ImportAdapterResolver } from './application/import-adapter.resolver';
import { ExportAdapterResolver } from './application/export-adapter.resolver';
import { ImportFileIntakeService } from './application/import-file-intake.service';
import { ImportRuntimeService } from './application/import-runtime.service';
import { ExportRuntimeService } from './application/export-runtime.service';
import { ImportExportQueueService } from './infrastructure/import-export-queue.service';
import { ImportExportWorkerService } from './infrastructure/import-export-worker.service';
import { ImportExportAuditLog } from './infrastructure/import-export-audit.log';
import { ImportTempStorageService } from './infrastructure/import-temp-storage.service';
import { ImportExportExpirationScheduler } from './infrastructure/import-export-expiration.scheduler';
import { ExportArtifactCleanupScheduler } from './infrastructure/export-artifact-cleanup.scheduler';
import { PrismaImportExportJobRepository } from './infrastructure/prisma-import-export-job.repository';
import { PrismaExportArtifactRepository } from './infrastructure/prisma-export-artifact.repository';
import { LocalArtifactStorageProvider } from './infrastructure/local-artifact-storage.provider';
import { IMPORT_EXPORT_JOB_REPOSITORY } from './application/ports/import-export-job.repository';
import { EXPORT_ARTIFACT_REPOSITORY } from './application/ports/export-artifact.repository';
import { ARTIFACT_STORAGE } from './application/ports/artifact-storage.port';
import { UsersImportAdapter } from './adapters/users-import.adapter';
import { UsersExportAdapter } from './adapters/users-export.adapter';
import { TenantScopedAccessGuard } from '../../common/tenant-scoped-access.guard';

/**
 * Phase 42a–42e: Foundation, Catalog, Job Engine, Import Runtime, Export Runtime.
 */
@Module({
  imports: [
    SettingsModule,
    RedisModule,
    AuditModule,
    DeliveryModule,
    IdentityModule,
    SubscriptionModule,
  ],
  controllers: [
    ImportExportHealthController,
    ImportExportCatalogController,
    ImportExportJobsController,
    ImportExportImportsController,
    ImportExportExportsController,
  ],
  providers: [
    BullMqConnectionService,
    TenantScopedAccessGuard,
    ImportExportExtensionRegistry,
    ImportExportRuntimeRegistry,
    ImportExportActivityContracts,
    ImportExportAuditContracts,
    ImportExportActivityEmitterService,
    ImportExportAuditLog,
    ImportExportNotificationIntentService,
    NullImportExportExecutor,
    EffectiveImportExportViewService,
    ImportExportQueueService,
    {
      provide: IMPORT_EXPORT_JOB_REPOSITORY,
      useClass: PrismaImportExportJobRepository,
    },
    {
      provide: EXPORT_ARTIFACT_REPOSITORY,
      useClass: PrismaExportArtifactRepository,
    },
    {
      provide: ARTIFACT_STORAGE,
      useClass: LocalArtifactStorageProvider,
    },
    { provide: VIRUS_SCANNER, useClass: NoOpVirusScannerService },
    ImportTempStorageService,
    ImportFileIntakeService,
    ImportAdapterResolver,
    ExportAdapterResolver,
    UsersImportAdapter,
    UsersExportAdapter,
    ImportExportJobService,
    ImportRuntimeService,
    ExportRuntimeService,
    ImportExportWorkerService,
    ImportExportExpirationScheduler,
    ExportArtifactCleanupScheduler,
  ],
  exports: [
    EffectiveImportExportViewService,
    ImportExportExtensionRegistry,
    ImportExportRuntimeRegistry,
    ImportExportQueueService,
    ImportExportWorkerService,
    ImportExportJobService,
    ImportRuntimeService,
    ExportRuntimeService,
  ],
})
export class ImportExportModule {}

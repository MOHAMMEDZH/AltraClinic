import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { AuditModule } from '../audit/audit.module';
import { BackupRestoreHealthController } from './controllers/backup-restore-health.controller';
import { BackupRestoreCatalogController } from './controllers/backup-restore-catalog.controller';
import { BackupRestoreJobsController } from './controllers/backup-restore-jobs.controller';
import { BackupRestoreBackupsController } from './controllers/backup-restore-backups.controller';
import { BackupRestoreRestoresController } from './controllers/backup-restore-restores.controller';
import { BackupRestoreSnapshotsController } from './controllers/backup-restore-snapshots.controller';
import { BackupRestoreOpsReadController } from './controllers/backup-restore-ops-read.controller';
import { BackupRestoreExtensionRegistry } from './application/backup-restore-extension.registry';
import { BackupRestoreActivityContracts } from './application/backup-restore-activity.contracts';
import { BackupRestoreAuditContracts } from './application/backup-restore-audit.contracts';
import { BackupRestoreNotificationContracts } from './application/backup-restore-notification.contracts';
import { BackupRestoreLicensingContracts } from './application/backup-restore-licensing.contracts';
import { BackupRestoreObservabilityContracts } from './application/backup-restore-observability.contracts';
import { BackupRestoreHealthContributors } from './application/backup-restore-health.contributors';
import { EffectiveBackupRestoreViewService } from './application/effective-backup-restore-view.service';
import { BackupRestoreActivityEmitterService } from './application/backup-restore-activity.emitter';
import { BackupRestoreNotificationIntentRegistrar } from './application/backup-restore-notification-intent.registrar';
import { BackupRestoreJobObservabilityHooks } from './application/backup-restore-job-observability.hooks';
import { BackupRestoreJobManager } from './application/backup-restore-job.manager';
import { BackupRestoreAuditLog } from './infrastructure/backup-restore-audit.log';
import { InMemoryBackupRestoreJobRepository } from './infrastructure/in-memory-backup-restore-job.repository';
import { BACKUP_RESTORE_JOB_REPOSITORY } from './application/ports/backup-restore-job.repository';
import { BACKUP_STORAGE } from './application/ports/backup-storage.port';
import { MemoryBackupStorageProvider } from './infrastructure/memory-backup-storage.provider';
import {
  BACKUP_SNAPSHOT_STORE,
  BACKUP_VERIFICATION_REQUEST_STORE,
  InMemoryBackupSnapshotStore,
  InMemoryBackupVerificationRequestStore,
} from './infrastructure/in-memory-backup-snapshot.store';
import {
  CLEANUP_PLAN_STORE,
  RETENTION_EVALUATION_STORE,
  VERIFICATION_RESULT_STORE,
  InMemoryCleanupPlanStore,
  InMemoryRetentionEvaluationStore,
  InMemoryVerificationResultStore,
} from './infrastructure/verification-retention.stores';
import {
  RESTORE_RESULT_STORE,
  RESTORE_SCRATCH_STORE,
  InMemoryRestoreResultStore,
  InMemoryRestoreScratchStore,
} from './infrastructure/in-memory-restore-result.store';
import {
  EnvelopeEncryptionOrchestrator,
  GzipCompressionOrchestrator,
} from './application/backup-compression-encryption.orchestrators';
import {
  BackupPolicyLoader,
  CatalogBackupTargetResolver,
} from './application/backup-target-policy.resolvers';
import { BackupDataCollector } from './application/backup-data.collector';
import { BackupSnapshotBuilder } from './application/backup-snapshot.builder';
import { BackupExecutor } from './application/backup.executor';
import { BackupEngineObservabilityHooks } from './application/backup-engine-observability.hooks';
import { BackupManifestValidator } from './application/backup-manifest.validator';
import { VerificationEngine } from './application/verification.engine';
import { RetentionEngine } from './application/retention.engine';
import { VerificationRetentionObservabilityHooks } from './application/verification-retention-observability.hooks';
import { RestoreExecutor } from './application/restore.executor';
import { RestoreTargetResolver } from './application/restore-target.resolver';
import { RestoreRecoveryPointResolver } from './application/restore-recovery-point.resolver';
import { RestoreValidator } from './application/restore-validator';
import { RestoreEngineObservabilityHooks } from './application/restore-engine-observability.hooks';
import {
  BACKUP_SERVICE,
  COMPRESSION_SERVICE,
  ENCRYPTION_SERVICE,
  RESTORE_SERVICE,
  RETENTION_SERVICE,
  TARGET_RESOLVER,
  VERIFICATION_SERVICE,
} from './application/ports/services';

/**
 * Phase 43a–43f: Foundation → … → Restore → Operations UI APIs.
 * No schedulers, workers, queue consumers, cleanup execution, or snapshot deletion.
 */
@Module({
  imports: [SettingsModule, AuditModule],
  controllers: [
    BackupRestoreHealthController,
    BackupRestoreCatalogController,
    BackupRestoreJobsController,
    BackupRestoreBackupsController,
    BackupRestoreRestoresController,
    BackupRestoreSnapshotsController,
    BackupRestoreOpsReadController,
  ],
  providers: [
    BackupRestoreExtensionRegistry,
    BackupRestoreActivityContracts,
    BackupRestoreAuditContracts,
    BackupRestoreNotificationContracts,
    BackupRestoreLicensingContracts,
    BackupRestoreObservabilityContracts,
    BackupRestoreHealthContributors,
    EffectiveBackupRestoreViewService,
    BackupRestoreActivityEmitterService,
    BackupRestoreNotificationIntentRegistrar,
    BackupRestoreJobObservabilityHooks,
    BackupEngineObservabilityHooks,
    VerificationRetentionObservabilityHooks,
    RestoreEngineObservabilityHooks,
    BackupRestoreAuditLog,
    {
      provide: BACKUP_RESTORE_JOB_REPOSITORY,
      useClass: InMemoryBackupRestoreJobRepository,
    },
    { provide: BACKUP_STORAGE, useClass: MemoryBackupStorageProvider },
    { provide: BACKUP_SNAPSHOT_STORE, useClass: InMemoryBackupSnapshotStore },
    {
      provide: BACKUP_VERIFICATION_REQUEST_STORE,
      useClass: InMemoryBackupVerificationRequestStore,
    },
    { provide: VERIFICATION_RESULT_STORE, useClass: InMemoryVerificationResultStore },
    { provide: RETENTION_EVALUATION_STORE, useClass: InMemoryRetentionEvaluationStore },
    { provide: CLEANUP_PLAN_STORE, useClass: InMemoryCleanupPlanStore },
    { provide: RESTORE_RESULT_STORE, useClass: InMemoryRestoreResultStore },
    { provide: RESTORE_SCRATCH_STORE, useClass: InMemoryRestoreScratchStore },
    BackupRestoreJobManager,
    GzipCompressionOrchestrator,
    EnvelopeEncryptionOrchestrator,
    CatalogBackupTargetResolver,
    BackupPolicyLoader,
    BackupDataCollector,
    BackupSnapshotBuilder,
    BackupExecutor,
    BackupManifestValidator,
    VerificationEngine,
    RetentionEngine,
    RestoreTargetResolver,
    RestoreRecoveryPointResolver,
    RestoreValidator,
    RestoreExecutor,
    { provide: BACKUP_SERVICE, useExisting: BackupExecutor },
    { provide: COMPRESSION_SERVICE, useExisting: GzipCompressionOrchestrator },
    { provide: ENCRYPTION_SERVICE, useExisting: EnvelopeEncryptionOrchestrator },
    { provide: TARGET_RESOLVER, useExisting: CatalogBackupTargetResolver },
    { provide: VERIFICATION_SERVICE, useExisting: VerificationEngine },
    { provide: RETENTION_SERVICE, useExisting: RetentionEngine },
    { provide: RESTORE_SERVICE, useExisting: RestoreExecutor },
  ],
  exports: [
    BackupRestoreExtensionRegistry,
    EffectiveBackupRestoreViewService,
    BackupRestoreLicensingContracts,
    BackupRestoreJobManager,
    BACKUP_RESTORE_JOB_REPOSITORY,
    BackupExecutor,
    VerificationEngine,
    RetentionEngine,
    RestoreExecutor,
    BACKUP_SERVICE,
    VERIFICATION_SERVICE,
    RETENTION_SERVICE,
    RESTORE_SERVICE,
    BACKUP_STORAGE,
    BACKUP_SNAPSHOT_STORE,
  ],
})
export class BackupRestoreModule {}

import { BackupRestoreExtensionRegistry } from '../application/backup-restore-extension.registry';
import { EffectiveBackupRestoreViewService } from '../application/effective-backup-restore-view.service';
import { BackupRestoreHealthContributors } from '../application/backup-restore-health.contributors';
import { BackupRestoreObservabilityContracts } from '../application/backup-restore-observability.contracts';
import { BackupRestoreLicensingContracts } from '../application/backup-restore-licensing.contracts';
import { BackupRestoreActivityEmitterService } from '../application/backup-restore-activity.emitter';
import { BackupRestoreNotificationIntentRegistrar } from '../application/backup-restore-notification-intent.registrar';
import { BackupRestoreJobObservabilityHooks } from '../application/backup-restore-job-observability.hooks';
import { BackupRestoreJobManager } from '../application/backup-restore-job.manager';
import { BackupRestoreHealthController } from '../controllers/backup-restore-health.controller';
import { InMemoryBackupRestoreJobRepository } from '../infrastructure/in-memory-backup-restore-job.repository';
import { BackupRestoreAuditLog } from '../infrastructure/backup-restore-audit.log';
import { MemoryBackupStorageProvider } from '../infrastructure/memory-backup-storage.provider';
import type { BackupExecutor } from '../application/backup.executor';
import type { VerificationEngine } from '../application/verification.engine';
import type { RetentionEngine } from '../application/retention.engine';
import type { RestoreExecutor } from '../application/restore.executor';
import { BackupManifestValidator } from '../application/backup-manifest.validator';
import { RestoreTargetResolver } from '../application/restore-target.resolver';
import { RestoreRecoveryPointResolver } from '../application/restore-recovery-point.resolver';
import { RestoreValidator } from '../application/restore-validator';
import { InMemoryBackupSnapshotStore } from '../infrastructure/in-memory-backup-snapshot.store';

export function createFoundationHealthController() {
  const repo = new InMemoryBackupRestoreJobRepository();
  const activity = new BackupRestoreActivityEmitterService();
  const audit = {
    record: jest.fn().mockResolvedValue(undefined),
    drainRecorded: () => [],
  } as unknown as BackupRestoreAuditLog;
  const notifications = new BackupRestoreNotificationIntentRegistrar();
  const observability = new BackupRestoreJobObservabilityHooks();
  const tenantPolicy = {
    getAdvancedPolicy: async () => ({
      allowBackupRestore: false,
      allowDataImport: true,
      allowDataExport: true,
      maintenanceMode: false,
    }),
  };
  const jobManager = new BackupRestoreJobManager(
    repo,
    activity,
    audit,
    notifications,
    observability,
    tenantPolicy as never,
  );
  const backupExecutor = { contractVersion: '43c' } as BackupExecutor;
  const verificationEngine = { contractVersion: '43d' } as VerificationEngine;
  const retentionEngine = { contractVersion: '43d' } as RetentionEngine;
  const restoreExecutor = { contractVersion: '43e' } as RestoreExecutor;
  const storage = new MemoryBackupStorageProvider();
  const snapshots = new InMemoryBackupSnapshotStore();
  return new BackupRestoreHealthController(
    new BackupRestoreExtensionRegistry(),
    new EffectiveBackupRestoreViewService(new BackupRestoreExtensionRegistry(), tenantPolicy as never),
    new BackupRestoreHealthContributors(),
    new BackupRestoreObservabilityContracts(),
    new BackupRestoreLicensingContracts(),
    jobManager,
    notifications,
    backupExecutor,
    verificationEngine,
    retentionEngine,
    restoreExecutor,
    new BackupManifestValidator(),
    new RestoreTargetResolver(),
    new RestoreRecoveryPointResolver(snapshots),
    new RestoreValidator(new BackupManifestValidator()),
    storage,
  );
}

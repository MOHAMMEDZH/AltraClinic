import { Controller, Get, Inject } from '@nestjs/common';
import { Public } from '../../auth/api/decorators/public.decorator';
import { loadBackupRestoreFoundationConfig } from '../config/backup-restore-config';
import { BackupRestoreExtensionRegistry } from '../application/backup-restore-extension.registry';
import { EffectiveBackupRestoreViewService } from '../application/effective-backup-restore-view.service';
import { BackupRestoreHealthContributors } from '../application/backup-restore-health.contributors';
import { BackupRestoreObservabilityContracts } from '../application/backup-restore-observability.contracts';
import { BackupRestoreLicensingContracts } from '../application/backup-restore-licensing.contracts';
import { BackupRestoreJobManager } from '../application/backup-restore-job.manager';
import { BackupRestoreNotificationIntentRegistrar } from '../application/backup-restore-notification-intent.registrar';
import { BackupExecutor } from '../application/backup.executor';
import { VerificationEngine } from '../application/verification.engine';
import { RetentionEngine } from '../application/retention.engine';
import { RestoreExecutor } from '../application/restore.executor';
import { BackupManifestValidator } from '../application/backup-manifest.validator';
import { RestoreTargetResolver } from '../application/restore-target.resolver';
import { RestoreRecoveryPointResolver } from '../application/restore-recovery-point.resolver';
import { RestoreValidator } from '../application/restore-validator';
import { BACKUP_STORAGE } from '../application/ports/backup-storage.port';
import type { BackupStoragePort } from '../application/ports/backup-storage.port';
import {
  BACKUP_RESTORE_METRICS_NAMESPACE,
  BACKUP_RESTORE_TRACE_NAMESPACE,
} from '../backup-restore.constants';
import {
  STATIC_BACKUP_RESTORE_CATALOG,
  STATIC_BACKUP_RESTORE_CATALOG_IS_RUNTIME_AUTHORITY,
} from '../catalog/static-backup-restore.catalog';

/**
 * Phase 43a–43f readiness probe (no PHI).
 */
@Controller('backup-restore')
export class BackupRestoreHealthController {
  constructor(
    private readonly extensions: BackupRestoreExtensionRegistry,
    private readonly effectiveView: EffectiveBackupRestoreViewService,
    private readonly healthContributors: BackupRestoreHealthContributors,
    private readonly observability: BackupRestoreObservabilityContracts,
    private readonly licensing: BackupRestoreLicensingContracts,
    private readonly jobManager: BackupRestoreJobManager,
    private readonly notificationIntents: BackupRestoreNotificationIntentRegistrar,
    private readonly backupExecutor: BackupExecutor,
    private readonly verificationEngine: VerificationEngine,
    private readonly retentionEngine: RetentionEngine,
    private readonly restoreExecutor: RestoreExecutor,
    private readonly manifestValidator: BackupManifestValidator,
    private readonly restoreTargetResolver: RestoreTargetResolver,
    private readonly restoreRecoveryPointResolver: RestoreRecoveryPointResolver,
    private readonly restoreValidator: RestoreValidator,
    @Inject(BACKUP_STORAGE) private readonly storage: BackupStoragePort,
  ) {}

  @Public()
  @Get('health')
  async health() {
    const config = loadBackupRestoreFoundationConfig();
    const view = await this.effectiveView.resolve({ hasReadPermission: true });
    const engine = await this.jobManager.getEngineHealth();

    return {
      ready: true,
      dormant: !config.featureEnabled,
      featureFlag: {
        name: config.featureFlagEnv,
        enabled: config.featureEnabled,
      },
      flags: config.flags,
      jobEngine: {
        ready: engine.jobEngineReady,
        repositoryReady: engine.repositoryReady,
        configurationReady: engine.configurationReady,
        featureFlagsReady: engine.featureFlagsReady,
        jobsByStatus: engine.jobsByStatus,
      },
      backupEngine: {
        ready: this.backupExecutor.contractVersion === '43c',
        contractVersion: this.backupExecutor.contractVersion,
        storageProvider: this.storage.providerKind,
        compressionReady: true,
        encryptionReady: true,
        manifestGeneratorReady: true,
        restoreWired: this.restoreExecutor.contractVersion === '43e',
        verificationExecutionWired: true,
        cleanupExecutionWired: false,
      },
      verificationEngine: {
        ready: this.verificationEngine.contractVersion === '43d',
        contractVersion: this.verificationEngine.contractVersion,
        manifestValidatorReady: this.manifestValidator.ready,
        checksumValidatorReady: true,
      },
      retentionEngine: {
        ready: this.retentionEngine.contractVersion === '43d',
        contractVersion: this.retentionEngine.contractVersion,
        cleanupPlanningReady: true,
        cleanupExecutionWired: false,
        deletionWired: false,
      },
      restoreEngine: {
        ready: this.restoreExecutor.contractVersion === '43e',
        contractVersion: this.restoreExecutor.contractVersion,
        recoveryPointResolverReady: this.restoreRecoveryPointResolver.ready,
        restoreValidatorReady: this.restoreValidator.ready,
        restoreTargetResolverReady: this.restoreTargetResolver.ready,
        onlyVerifiedSnapshots: true,
      },
      queue: {
        name: config.queueName,
        wired: false,
      },
      worker: {
        wired: false,
        status: 'not_implemented' as const,
      },
      scheduler: {
        wired: false,
        status: 'not_implemented' as const,
      },
      extensionKind: {
        name: this.extensions.getExtensionKind(),
        mode: 'local' as const,
        registered: this.extensions.isRegistered(),
        adapters: this.extensions.listAdapterRegistrations().length,
      },
      catalog: {
        staticCount: STATIC_BACKUP_RESTORE_CATALOG.length,
        staticIsRuntimeAuthority: STATIC_BACKUP_RESTORE_CATALOG_IS_RUNTIME_AUTHORITY,
        executableCount: 0,
      },
      effectiveView: {
        visible: view.visible,
        types: view.types.length,
        allowBackupRestore: view.allowBackupRestore,
        featureEnabled: view.featureEnabled,
      },
      licensing: {
        tenantGate: this.licensing.getTenantLicenseGate(),
        capabilities: this.licensing.listCapabilities(),
      },
      notificationIntents: {
        registeredKinds: this.notificationIntents.listRegisteredKinds().length,
        deliveryWired: false,
      },
      healthContributors: this.healthContributors.listDefinitions(),
      observability: {
        logKind: this.observability.logKind,
        metricsNamespace: BACKUP_RESTORE_METRICS_NAMESPACE,
        traceNamespace: BACKUP_RESTORE_TRACE_NAMESPACE,
        metricNamesRegistered: this.observability.listMetricNames().length,
        correlationIdField: this.observability.correlationIdField(),
      },
      defaults: config.defaults,
      phase: '43f',
    };
  }
}

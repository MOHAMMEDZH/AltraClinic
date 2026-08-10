import {
  BACKUP_RESTORE_ACTIVITY_EVENTS,
  BACKUP_RESTORE_AUDIT_ACTIONS,
  BACKUP_RESTORE_CENTER_ENABLED_ENV,
  BACKUP_RESTORE_EXTENSION_KIND,
  BACKUP_RESTORE_LICENSE_CAPABILITIES,
  BACKUP_RESTORE_NOTIFICATION_INTENTS,
  BACKUP_RESTORE_PERMISSION_ACTIONS,
  BACKUP_RESTORE_PERMISSION_RESOURCE,
  BACKUP_RESTORE_QUEUE_NAME,
  BACKUP_RESTORE_TENANT_LICENSE_GATE,
} from '../backup-restore.constants';
import {
  isBackupRestoreCenterEnabled,
  loadBackupRestoreFoundationConfig,
} from '../config/backup-restore-config';
import { BackupRestoreExtensionRegistry } from '../application/backup-restore-extension.registry';
import { EffectiveBackupRestoreViewService } from '../application/effective-backup-restore-view.service';
import { BackupRestoreActivityContracts } from '../application/backup-restore-activity.contracts';
import { BackupRestoreAuditContracts } from '../application/backup-restore-audit.contracts';
import { BackupRestoreNotificationContracts } from '../application/backup-restore-notification.contracts';
import { BackupRestoreLicensingContracts } from '../application/backup-restore-licensing.contracts';
import { BackupRestoreObservabilityContracts } from '../application/backup-restore-observability.contracts';
import {
  STATIC_BACKUP_RESTORE_CATALOG,
  STATIC_BACKUP_RESTORE_CATALOG_IS_RUNTIME_AUTHORITY,
} from '../catalog/static-backup-restore.catalog';
import { NullBackupService } from '../application/null-backup-restore.services';
import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';
import { createFoundationHealthController } from './backup-restore-foundation.helpers';

describe('Phase 43a — Backup & Restore Center foundation', () => {
  const previousFlags: Record<string, string | undefined> = {};
  const flagKeys = [
    'BACKUP_RESTORE_CENTER_ENABLED',
    'BACKUP_CENTER_ENABLED',
    'BACKUP_RESTORE_ENABLED',
    'BACKUP_VERIFY_ENABLED',
    'BACKUP_SCHEDULER_ENABLED',
  ];

  beforeEach(() => {
    for (const key of flagKeys) {
      previousFlags[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of flagKeys) {
      const prev = previousFlags[key];
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
    }
  });

  it('defaults all feature flags OFF and loads dormant config', () => {
    expect(isBackupRestoreCenterEnabled()).toBe(false);
    const config = loadBackupRestoreFoundationConfig();
    expect(config.featureEnabled).toBe(false);
    expect(config.featureFlagEnv).toBe(BACKUP_RESTORE_CENTER_ENABLED_ENV);
    expect(config.queueName).toBe(BACKUP_RESTORE_QUEUE_NAME);
    expect(config.extensionKind).toBe(BACKUP_RESTORE_EXTENSION_KIND);
    expect(config.flags).toEqual({
      centerEnabled: false,
      backupCenterEnabled: false,
      restoreEnabled: false,
      verifyEnabled: false,
      schedulerEnabled: false,
    });
    expect(config.defaults.storageProvider).toBe('unconfigured');
    expect(config.defaults.retentionDays).toBe(30);
  });

  it('registers backupRestore extension kind locally (no adapters)', () => {
    const registry = new BackupRestoreExtensionRegistry();
    expect(registry.getExtensionKind()).toBe('backupRestore');
    expect(registry.isRegistered()).toBe(true);
    expect(registry.listAdapterRegistrations()).toEqual([]);
  });

  it('static catalog is disabled / non-executable and not runtime authority', () => {
    expect(STATIC_BACKUP_RESTORE_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
    expect(STATIC_BACKUP_RESTORE_CATALOG.length).toBeGreaterThan(0);
    for (const entry of STATIC_BACKUP_RESTORE_CATALOG) {
      expect(entry.executable).toBe(false);
      expect(entry.adapterAttached).toBe(false);
      expect(['disabled', 'inactive']).toContain(entry.status);
    }
  });

  it('EffectiveBackupRestoreView returns empty visible catalog when dormant', async () => {
    const tenantPolicy = {
      getAdvancedPolicy: jest.fn().mockResolvedValue({
        allowBackupRestore: true,
        allowDataImport: true,
        allowDataExport: true,
        maintenanceMode: false,
      }),
    };
    const view = new EffectiveBackupRestoreViewService(
      new BackupRestoreExtensionRegistry(),
      tenantPolicy as never,
    );
    const result = await view.resolve({
      tenantId: 'tenant-a',
      branchId: 'branch-a',
      roles: ['owner'],
      hasReadPermission: true,
    });
    expect(result.types).toEqual([]);
    expect(result.extensionKind).toBe('backupRestore');
    expect(result.allowBackupRestore).toBe(true);
    expect(result.featureEnabled).toBe(false);
    expect(result.visible).toBe(false);
    expect(result.meta.executableCount).toBe(0);
    expect(result.meta.staticCatalogIsRuntimeAuthority).toBe(false);
    expect(tenantPolicy.getAdvancedPolicy).toHaveBeenCalledWith('tenant-a');
  });

  it('registers permission definitions against runtime matrix', () => {
    expect(BACKUP_RESTORE_PERMISSION_RESOURCE).toBe('api.backupRestore');
    expect(BACKUP_RESTORE_PERMISSION_ACTIONS.view).toBe('view');
    expect(BACKUP_RESTORE_PERMISSION_ACTIONS.manage).toBe('manage');
    expect(BACKUP_RESTORE_PERMISSION_ACTIONS.download).toBe('export');
    expect(BACKUP_RESTORE_PERMISSION_ACTIONS.approve).toBe('approve');
    expect(rolesCanAccessResource(['owner'], 'api.backupRestore', 'view')).toBe(true);
    expect(rolesCanAccessResource(['owner'], 'api.backupRestore', 'create')).toBe(true);
    expect(rolesCanAccessResource(['owner'], 'api.backupRestore', 'manage')).toBe(true);
    expect(rolesCanAccessResource(['owner'], 'api.backupRestore', 'approve')).toBe(true);
    expect(rolesCanAccessResource(['patient'], 'api.backupRestore', 'manage')).toBe(false);
  });

  it('registers licensing capabilities and tenant gate (no execution)', () => {
    const licensing = new BackupRestoreLicensingContracts();
    expect(licensing.getTenantLicenseGate()).toBe(BACKUP_RESTORE_TENANT_LICENSE_GATE);
    expect(licensing.listCapabilities()).toEqual([...BACKUP_RESTORE_LICENSE_CAPABILITIES]);
    expect(licensing.listCapabilities()).toContain('backupCenter');
    expect(licensing.listCapabilities()).toContain('pointInTimeRestore');
  });

  it('reserves queue name but does not wire queue/worker/scheduler', async () => {
    expect(BACKUP_RESTORE_QUEUE_NAME).toBe('backup-restore');
    const controller = createFoundationHealthController();
    const health = await controller.health();
    expect(health.queue.name).toBe('backup-restore');
    expect(health.queue.wired).toBe(false);
    expect(health.worker.wired).toBe(false);
    expect(health.scheduler.wired).toBe(false);
    expect(health.phase).toBe('43f');
  });

  it('health endpoint reports ready / dormant foundation state', async () => {
    const controller = createFoundationHealthController();
    const health = await controller.health();
    expect(health.ready).toBe(true);
    expect(health.dormant).toBe(true);
    expect(health.featureFlag.enabled).toBe(false);
    expect(health.extensionKind.adapters).toBe(0);
    expect(health.catalog.executableCount).toBe(0);
    expect(health.healthContributors.length).toBeGreaterThan(0);
    expect(health.jobEngine.ready).toBe(true);
    expect(health.backupEngine.ready).toBe(true);
    expect(health.backupEngine.restoreWired).toBe(true);
    expect(health.verificationEngine.ready).toBe(true);
    expect(health.retentionEngine.ready).toBe(true);
    expect(health.retentionEngine.deletionWired).toBe(false);
    expect(health.restoreEngine.ready).toBe(true);
    expect(health.restoreEngine.onlyVerifiedSnapshots).toBe(true);
  });

  it('registers activity, audit, and notification contracts only (no emit/send)', () => {
    const activity = new BackupRestoreActivityContracts();
    const audit = new BackupRestoreAuditContracts();
    const notifications = new BackupRestoreNotificationContracts();
    expect(activity.listEventNames()).toEqual([...BACKUP_RESTORE_ACTIVITY_EVENTS]);
    expect(audit.listActionNames()).toEqual([...BACKUP_RESTORE_AUDIT_ACTIONS]);
    expect(notifications.listIntentKinds()).toEqual([
      ...BACKUP_RESTORE_NOTIFICATION_INTENTS,
    ]);
    expect(typeof (activity as { emit?: unknown }).emit).toBe('undefined');
    expect(typeof (audit as { emit?: unknown }).emit).toBe('undefined');
    expect(typeof (notifications as { send?: unknown }).send).toBe('undefined');
  });

  it('registers observability metric names without recording', () => {
    const obs = new BackupRestoreObservabilityContracts();
    expect(obs.listMetricNames().length).toBeGreaterThan(0);
    expect(obs.correlationIdField()).toBe('correlationId');
    expect(typeof (obs as { record?: unknown }).record).toBe('undefined');
  });

  it('null backup service exposes contract version only (no execute)', () => {
    const service = new NullBackupService();
    expect(service.contractVersion).toBe('43a');
    expect(typeof (service as { execute?: unknown }).execute).toBe('undefined');
    expect(typeof (service as { runBackup?: unknown }).runBackup).toBe('undefined');
  });
});

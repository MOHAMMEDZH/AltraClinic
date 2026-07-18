import { Controller, Get } from '@nestjs/common';
import { Public } from '../../auth/api/decorators/public.decorator';
import { loadImportExportFoundationConfig } from '../config/import-export-config';
import { EffectiveImportExportViewService } from '../application/effective-import-export-view.service';
import { ImportExportExtensionRegistry } from '../application/import-export-extension.registry';
import { ImportExportRuntimeRegistry } from '../application/import-export-runtime.registry';
import { ImportExportJobService } from '../application/import-export-job.service';
import { NullImportExportExecutor } from '../application/null-import-export.executor';
import { ImportExportExpirationScheduler } from '../infrastructure/import-export-expiration.scheduler';
import { ExportArtifactCleanupScheduler } from '../infrastructure/export-artifact-cleanup.scheduler';
import { ImportExportQueueService } from '../infrastructure/import-export-queue.service';
import { ImportExportWorkerService } from '../infrastructure/import-export-worker.service';
import {
  IMPORT_EXPORT_METRICS_NAMESPACE,
  IMPORT_EXPORT_TRACE_NAMESPACE,
} from '../import-export.constants';

/**
 * Phase 42a–42e readiness (Import + Export Runtime).
 */
@Controller('import-export')
export class ImportExportHealthController {
  constructor(
    private readonly queue: ImportExportQueueService,
    private readonly worker: ImportExportWorkerService,
    private readonly extensions: ImportExportExtensionRegistry,
    private readonly runtimeRegistry: ImportExportRuntimeRegistry,
    private readonly effectiveView: EffectiveImportExportViewService,
    private readonly jobService: ImportExportJobService,
    private readonly nullExecutor: NullImportExportExecutor,
    private readonly expirationScheduler: ImportExportExpirationScheduler,
    private readonly artifactCleanup: ExportArtifactCleanupScheduler,
  ) {}

  @Public()
  @Get('health')
  async health() {
    const config = loadImportExportFoundationConfig();
    const worker = this.worker.getHealth();
    const registry = this.runtimeRegistry.getHealth();
    const view = await this.effectiveView.resolve({ hasReadPermission: true });
    const engine = await this.jobService.getEngineHealth();
    const cleanup = this.artifactCleanup.getLastMetrics();

    return {
      ready: true,
      dormant: !config.featureEnabled,
      featureFlag: {
        name: config.featureFlagEnv,
        enabled: config.featureEnabled,
      },
      queue: {
        name: this.queue.queueName,
        connected: this.queue.isConnected(),
        enqueuedCount: this.queue.getEnqueuedCount(),
      },
      worker,
      executor: {
        name: 'NullImportExportExecutor',
        executions: this.nullExecutor.getExecutionCount(),
        businessWork: false,
      },
      importRuntime: {
        enabled: true,
        attachedAdapters: this.runtimeRegistry.listExecutableAdapters().map((a) => a.typeId),
      },
      exportRuntime: {
        enabled: true,
        attachedAdapters: this.runtimeRegistry
          .listExecutableExportAdapters()
          .map((a) => a.typeId),
        artifactCleanup: {
          enabled: true,
          runs: this.artifactCleanup.getRunCount(),
          lastExpired: cleanup.expired,
          lastDeleted: cleanup.deleted,
        },
      },
      virusScanner: (() => {
        const configured = (process.env.MEDIA_VIRUS_SCANNER ?? 'noop').trim().toLowerCase();
        const productionReady = configured !== 'noop' && configured !== '' && configured !== 'none';
        return {
          configured,
          productionReady,
          gate:
            productionReady
              ? 'ok'
              : 'Configure MEDIA_VIRUS_SCANNER to a non-noop provider before production enablement',
        };
      })(),
      productionEnablement: {
        featureFlagDefaultOff: !config.featureEnabled,
        virusScannerReady: (() => {
          const configured = (process.env.MEDIA_VIRUS_SCANNER ?? 'noop').trim().toLowerCase();
          return configured !== 'noop' && configured !== '' && configured !== 'none';
        })(),
        durableStorageConfigured: Boolean(
          process.env.IMPORT_EXPORT_ARTIFACT_PATH?.trim() ||
            process.env.IMPORT_EXPORT_TEMP_PATH?.trim(),
        ),
      },
      retryEngine: {
        enabled: true,
        ownedBy: 'ImportExportJobService',
      },
      deadLetter: {
        enabled: true,
      },
      expirationScheduler: {
        enabled: true,
        runs: this.expirationScheduler.getRunCount(),
      },
      jobs: engine.jobsByStatus,
      extensionKind: {
        kind: this.extensions.getExtensionKind(),
        registered: this.extensions.isRegistered(),
        mode: 'local',
        adapters: this.extensions.listAdapterRegistrations().length,
      },
      registry: {
        healthy: registry.healthy,
        registeredTypes: registry.registeredCount,
        visibleTypes: view.meta.visibleCount,
        disabledTypes: registry.disabledCount,
        inactiveTypes: registry.inactiveCount,
        activeTypes: registry.activeCount,
        invalidRegistrations: registry.invalidCount,
        byKind: registry.byKind,
        executableCount: registry.executableCount,
        adapterAttachedCount: registry.adapterAttachedCount,
      },
      effectiveView: {
        types: view.types.length,
        visible: view.visible,
        allowDataImport: view.allowDataImport,
        allowDataExport: view.allowDataExport,
        meta: view.meta,
      },
      observability: {
        metricsNamespace: IMPORT_EXPORT_METRICS_NAMESPACE,
        traceNamespace: IMPORT_EXPORT_TRACE_NAMESPACE,
        logger: 'ImportExport*',
      },
    };
  }
}

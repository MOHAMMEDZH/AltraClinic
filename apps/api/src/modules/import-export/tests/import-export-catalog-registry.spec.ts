import { STATIC_IMPORT_EXPORT_CATALOG } from '../catalog/static-import-export.catalog';
import type { ImportExportRegistrationInput } from '../domain/import-export-registration.contracts';
import { ImportExportExtensionRegistry } from '../application/import-export-extension.registry';
import {
  ImportExportRegistrationRejectedError,
  ImportExportRuntimeRegistry,
} from '../application/import-export-runtime.registry';
import { EffectiveImportExportViewService } from '../application/effective-import-export-view.service';
import { ImportExportHealthController } from '../controllers/import-export-health.controller';
import { IMPORT_EXPORT_PERMISSION_RESOURCE, IMPORT_EXPORT_QUEUE_NAME } from '../import-export.constants';
import { evaluateImportExportVisibility } from '../application/import-export-visibility';
import { toRegistrationMetadata } from '../application/import-export-registration.validator';

function activeExporter(
  overrides: Partial<ImportExportRegistrationInput> = {},
): ImportExportRegistrationInput {
  return {
    typeId: 'test-active-export',
    displayName: 'Test Active Export',
    category: 'test',
    direction: 'export',
    ownerModule: 'reporting',
    requiredPermission: { resource: IMPORT_EXPORT_PERMISSION_RESOURCE, action: 'export' },
    requiredLicense: 'allowDataExport',
    tenantScope: 'tenant',
    branchScope: 'any',
    supportsDryRun: false,
    supportsPreview: true,
    supportedFormats: ['csv'],
    version: '1.0.0',
    featureFlag: null,
    status: 'active',
    registrationKind: 'exporter',
    ...overrides,
  };
}

describe('Phase 42b — Import/Export Catalog & Registry', () => {
  const previousFlag = process.env.IMPORT_EXPORT_CENTER_ENABLED;

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.IMPORT_EXPORT_CENTER_ENABLED;
    else process.env.IMPORT_EXPORT_CENTER_ENABLED = previousFlag;
  });

  it('loads static catalog with all entries non-executable and disabled/inactive', () => {
    const registry = new ImportExportRuntimeRegistry();
    registry.loadStaticCatalog();
    const all = registry.listRegistrations();
    expect(all.length).toBe(STATIC_IMPORT_EXPORT_CATALOG.length);
    expect(all.map((e) => e.typeId).sort()).toEqual(
      [
        'users-import',
        'users-export',
        'inventory-import',
        'inventory-export',
        'invoice-export',
        'patient-demographics-export',
        'reporting-export',
      ].sort(),
    );
    for (const entry of all) {
      expect(entry.adapterAttached).toBe(false);
      expect(entry.executable).toBe(false);
      expect(['disabled', 'inactive']).toContain(entry.status);
    }
    expect(registry.listExecutableAdapters()).toEqual([]);
    expect(registry.getHealth().executableCount).toBe(0);
  });

  it('registers metadata successfully for each provider kind', () => {
    const registry = new ImportExportRuntimeRegistry();
    const kinds = [
      'importer',
      'exporter',
      'templateProvider',
      'validatorProvider',
      'artifactProvider',
    ] as const;
    for (const [index, kind] of kinds.entries()) {
      const registered = registry.register(
        activeExporter({
          typeId: `kind-${kind.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`,
          registrationKind: kind,
          direction: kind === 'importer' ? 'import' : 'export',
          requiredLicense: kind === 'importer' ? 'allowDataImport' : 'allowDataExport',
          requiredPermission: {
            resource: IMPORT_EXPORT_PERMISSION_RESOURCE,
            action: kind === 'importer' ? 'create' : 'export',
          },
          status: 'active',
          version: `1.0.${index}`,
        }),
      );
      expect(registered.registrationKind).toBe(kind);
      expect(registered.executable).toBe(false);
    }
    expect(registry.getHealth().registeredCount).toBe(5);
  });

  it('rejects duplicate typeId registrations', () => {
    const registry = new ImportExportRuntimeRegistry();
    registry.register(activeExporter({ typeId: 'dup-export' }));
    expect(() =>
      registry.register(activeExporter({ typeId: 'dup-export', version: '1.0.1' })),
    ).toThrow(ImportExportRegistrationRejectedError);
    expect(registry.listInvalidRegistrations().length).toBe(1);
    expect(registry.listInvalidRegistrations()[0].issues.some((i) => i.code === 'duplicate_type_id')).toBe(
      true,
    );
  });

  it('rejects invalid owner, missing permission, missing license, invalid direction, unsupported formats', () => {
    const registry = new ImportExportRuntimeRegistry();

    expect(() =>
      registry.register(activeExporter({ typeId: 'bad-owner', ownerModule: 'unknownModule' })),
    ).toThrow(/invalid_owner|rejected/);

    expect(() =>
      registry.register(
        activeExporter({
          typeId: 'bad-perm',
          requiredPermission: { resource: '', action: 'export' },
        }),
      ),
    ).toThrow(/missing_permission|rejected/);

    expect(() =>
      registry.register(
        activeExporter({
          typeId: 'bad-license',
          // @ts-expect-error intentional invalid license
          requiredLicense: 'commercialSku',
        }),
      ),
    ).toThrow(/missing_license|rejected/);

    expect(() =>
      registry.register(
        activeExporter({
          typeId: 'bad-direction',
          // @ts-expect-error intentional invalid direction
          direction: 'sideways',
        }),
      ),
    ).toThrow(/invalid_direction|rejected/);

    expect(() =>
      registry.register(
        activeExporter({
          typeId: 'bad-format',
          // @ts-expect-error intentional unsupported format
          supportedFormats: ['parquet'],
        }),
      ),
    ).toThrow(/unsupported_format|rejected/);

    expect(registry.listInvalidRegistrations().length).toBeGreaterThanOrEqual(5);
  });

  it('filters catalog by feature flag, license, RBAC, tenant, and branch', async () => {
    process.env.IMPORT_EXPORT_CENTER_ENABLED = 'true';
    const runtime = new ImportExportRuntimeRegistry();
    runtime.register(
      activeExporter({
        typeId: 'scoped-export',
        tenantScope: 'tenant',
        branchScope: 'branch',
        restrictedToTenantIds: ['tenant-a'],
        restrictedToBranchIds: ['branch-a'],
        featureFlag: 'IE_SCOPED_EXPORT_ENABLED',
        status: 'active',
      }),
    );

    const tenantPolicy = {
      getAdvancedPolicy: jest.fn().mockResolvedValue({
        allowDataImport: false,
        allowDataExport: true,
      }),
    };
    const view = new EffectiveImportExportViewService(
      new ImportExportExtensionRegistry(),
      runtime,
      tenantPolicy as never,
    );

    // Feature flag off → hidden
    let result = await view.resolve({
      tenantId: 'tenant-a',
      branchId: 'branch-a',
      roles: ['owner'],
      isFeatureEnabled: () => false,
    });
    expect(result.types.map((t) => t.typeId)).toEqual([]);

    // Wrong tenant → hidden
    result = await view.resolve({
      tenantId: 'tenant-b',
      branchId: 'branch-a',
      roles: ['owner'],
      isFeatureEnabled: () => true,
    });
    expect(result.types.map((t) => t.typeId)).toEqual([]);

    // Wrong branch → hidden
    result = await view.resolve({
      tenantId: 'tenant-a',
      branchId: 'branch-b',
      roles: ['owner'],
      isFeatureEnabled: () => true,
    });
    expect(result.types.map((t) => t.typeId)).toEqual([]);

    // Patient role → RBAC deny
    result = await view.resolve({
      tenantId: 'tenant-a',
      branchId: 'branch-a',
      roles: ['patient'],
      isFeatureEnabled: () => true,
    });
    expect(result.types.map((t) => t.typeId)).toEqual([]);

    // License deny export
    tenantPolicy.getAdvancedPolicy.mockResolvedValue({
      allowDataImport: true,
      allowDataExport: false,
    });
    result = await view.resolve({
      tenantId: 'tenant-a',
      branchId: 'branch-a',
      roles: ['owner'],
      isFeatureEnabled: () => true,
    });
    expect(result.types.map((t) => t.typeId)).toEqual([]);

    // All gates pass → visible but still non-executable
    tenantPolicy.getAdvancedPolicy.mockResolvedValue({
      allowDataImport: true,
      allowDataExport: true,
    });
    result = await view.resolve({
      tenantId: 'tenant-a',
      branchId: 'branch-a',
      roles: ['owner'],
      isFeatureEnabled: () => true,
    });
    expect(result.types).toHaveLength(1);
    expect(result.types[0].typeId).toBe('scoped-export');
    expect(result.types[0].executable).toBe(false);
    expect(result.types[0].adapterAttached).toBe(false);
    expect(result.meta.visibleCount).toBe(1);
  });

  it('EffectiveImportExportView keeps static catalog non-visible and non-executable', async () => {
    process.env.IMPORT_EXPORT_CENTER_ENABLED = 'true';
    const runtime = new ImportExportRuntimeRegistry();
    runtime.loadStaticCatalog();
    const view = new EffectiveImportExportViewService(
      new ImportExportExtensionRegistry(),
      runtime,
      {
        getAdvancedPolicy: async () => ({ allowDataImport: true, allowDataExport: true }),
      } as never,
    );
    const result = await view.resolve({
      tenantId: 'tenant-a',
      branchId: 'branch-a',
      roles: ['owner'],
    });
    expect(result.meta.registeredCount).toBe(STATIC_IMPORT_EXPORT_CATALOG.length);
    expect(result.types).toEqual([]);
    expect(result.meta.visibleCount).toBe(0);
    expect(result.meta.executableCount).toBe(0);
    expect(result.meta.disabledCount + result.meta.inactiveCount).toBe(
      STATIC_IMPORT_EXPORT_CATALOG.length,
    );
  });

  it('visibility helper hides disabled registrations', () => {
    const entry = toRegistrationMetadata(
      activeExporter({ typeId: 'disabled-one', status: 'disabled' }),
    );
    const result = evaluateImportExportVisibility(entry, {
      tenantId: 't1',
      branchId: 'b1',
      roles: ['owner'],
      allowDataImport: true,
      allowDataExport: true,
      centerEnabled: true,
    });
    expect(result.visible).toBe(false);
    expect(result.reasons).toContain('status_disabled');
  });

  it('health endpoint reports registry catalog stats without execution metrics', async () => {
    process.env.IMPORT_EXPORT_CENTER_ENABLED = 'true';
    const extensions = new ImportExportExtensionRegistry();
    const runtime = new ImportExportRuntimeRegistry();
    runtime.loadStaticCatalog();
    const view = new EffectiveImportExportViewService(extensions, runtime, {
      getAdvancedPolicy: async () => ({ allowDataImport: true, allowDataExport: true }),
    } as never);
    const controller = new ImportExportHealthController(
      { queueName: IMPORT_EXPORT_QUEUE_NAME, isConnected: () => true, getEnqueuedCount: () => 0 } as never,
      {
        getHealth: () => ({
          status: 'disabled' as const,
          ready: false,
          queue: IMPORT_EXPORT_QUEUE_NAME,
          jobsProcessed: 0,
          featureEnabled: true,
          disableReason: null,
          workerId: 'test',
          processor: 'process-import-export-job',
        }),
      } as never,
      extensions,
      runtime,
      view,
      {
        getEngineHealth: async () => ({
          jobsByStatus: {},
          nullExecutorExecutions: 0,
          queueJobName: 'process-import-export-job',
        }),
      } as never,
      { getExecutionCount: () => 0 } as never,
      { getRunCount: () => 0 } as never,
      {
        getRunCount: () => 0,
        getLastMetrics: () => ({ expired: 0, deleted: 0 }),
      } as never,
    );
    const health = await controller.health();
    expect(health.ready).toBe(true);
    expect(health.registry.registeredTypes).toBe(STATIC_IMPORT_EXPORT_CATALOG.length);
    expect(health.registry.visibleTypes).toBe(0);
    expect(health.registry.disabledTypes + health.registry.inactiveTypes).toBe(
      STATIC_IMPORT_EXPORT_CATALOG.length,
    );
    expect(health.registry.invalidRegistrations).toBe(0);
    expect(health.registry.executableCount).toBe(0);
    expect(health.registry.adapterAttachedCount).toBe(0);
    expect(health.extensionKind.mode).toBe('local');
  });

  it('center feature flag off yields zero visible types even with active registration', async () => {
    process.env.IMPORT_EXPORT_CENTER_ENABLED = 'false';
    const runtime = new ImportExportRuntimeRegistry();
    runtime.register(activeExporter({ typeId: 'flag-off-export' }));
    const view = new EffectiveImportExportViewService(
      new ImportExportExtensionRegistry(),
      runtime,
      {
        getAdvancedPolicy: async () => ({ allowDataImport: true, allowDataExport: true }),
      } as never,
    );
    const result = await view.resolve({
      tenantId: 'tenant-a',
      roles: ['owner'],
    });
    expect(result.featureEnabled).toBe(false);
    expect(result.types).toEqual([]);
  });
});

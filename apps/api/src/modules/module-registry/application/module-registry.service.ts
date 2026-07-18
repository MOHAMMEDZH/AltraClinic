import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  BUILTIN_MODULE_MANIFESTS,
  bootstrapRegistry,
  evaluateModuleHealth,
  findEffectiveModuleView,
  resolveDependencyGraph,
  applyLicenseToDependencyHealth,
  resolveEffectiveModuleViews,
  type EffectiveModuleView,
  type ModuleManifest,
  type ModuleRegistryEvent,
  type RegistrySnapshot,
  type PermissionEvaluator,
  type PermissionAction,
} from '@booking/module-registry';
import { LicensingEngineService } from '../../subscription/application/services/licensing-engine.service';
import { SettingsService } from '../../settings/application/services/settings.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';

function expandRoles(roles: string[], matrix: { roles?: Array<{ key: string; inherits?: string[] }> }): string[] {
  const result = new Set(roles);
  let changed = true;
  while (changed) {
    changed = false;
    for (const role of [...result]) {
      const def = matrix.roles?.find((r) => r.key === role);
      for (const inherited of def?.inherits ?? []) {
        if (!result.has(inherited)) {
          result.add(inherited);
          changed = true;
        }
      }
    }
  }
  return [...result];
}

function loadPermissionMatrix(): {
  resources: Array<{ id: string; permissions: Record<string, string[]> }>;
  roles?: Array<{ key: string; inherits?: string[] }>;
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../../../../config/permission-matrix.json');
  } catch {
    return null;
  }
}

function buildPermissionEvaluator(roles: string[]): PermissionEvaluator | undefined {
  const matrix = loadPermissionMatrix();
  if (!matrix) return undefined;
  const effectiveRoles = expandRoles(roles, matrix);
  return {
    hasPermission: (resourceId: string, action: PermissionAction = 'view') => {
      const resource = matrix.resources.find((r) => r.id === resourceId);
      if (!resource) return false;
      const allowed: string[] = resource.permissions[action] ?? [];
      return effectiveRoles.some((role) => allowed.includes(role));
    },
  };
}

export function buildEntitlementVersion(input: {
  licenseStatus: string;
  canWrite: boolean;
  canMutate: boolean;
  licenseModules: Record<string, string>;
  moduleFlags: Record<string, boolean | undefined>;
}): string {
  const moduleParts = Object.keys(input.licenseModules)
    .sort()
    .map((key) => `${key}:${input.licenseModules[key]}`);
  const flagParts = Object.keys(input.moduleFlags)
    .sort()
    .map((key) => `${key}:${String(input.moduleFlags[key])}`);
  return `${input.licenseStatus}|w:${input.canWrite}|m:${input.canMutate}|lm:${moduleParts.join(',')}|mf:${flagParts.join(',')}`;
}

@Injectable()
export class ModuleRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ModuleRegistryService.name);
  private snapshot!: RegistrySnapshot;
  private bootstrapEvents: ModuleRegistryEvent[] = [];

  constructor(
    private readonly licensingEngine: LicensingEngineService,
    private readonly settingsService: SettingsService,
    private readonly tenantContext: TenantContextService,
  ) {
    this.initializeRegistry();
  }

  onModuleInit(): void {
    this.initializeRegistry();
  }

  private initializeRegistry(): void {
    if (this.snapshot) return;

    const result = bootstrapRegistry(BUILTIN_MODULE_MANIFESTS);
    if (result.validationErrors.length > 0 || !result.snapshot) {
      this.logger.error(`Module registry bootstrap validation failed: ${result.validationErrors.join('; ')}`);
      throw new Error('Module registry bootstrap failed validation');
    }
    this.snapshot = result.snapshot;
    this.bootstrapEvents = result.events;
    this.logger.log(`Module registry initialized with ${this.snapshot.moduleCount} built-in manifests`);
  }

  private ensureRegistryReady(): void {
    if (!this.snapshot) {
      this.initializeRegistry();
    }
  }

  getSnapshot(): RegistrySnapshot {
    this.ensureRegistryReady();
    return this.snapshot;
  }

  getBootstrapEvents(): ModuleRegistryEvent[] {
    return this.bootstrapEvents;
  }

  getManifest(moduleId: string): ModuleManifest | undefined {
    return this.snapshot.manifests.find((m) => m.moduleId === moduleId);
  }

  listManifests(): ModuleManifest[] {
    return this.snapshot.manifests;
  }

  getDependencyGraph() {
    return resolveDependencyGraph(this.snapshot.manifests);
  }

  async getBootstrapPayload(userRoles: string[] = []) {
    this.ensureRegistryReady();
    const { tenantId } = await this.tenantContext.resolve();
    const entitlements = await this.licensingEngine.getEntitlements(tenantId);
    const settings = await this.settingsService.getTenantSettings(tenantId);
    const moduleFlags = settings.moduleFlags ?? {};
    const modules = await this.getEffectiveModuleViews(userRoles);
    const entitlementVersion = buildEntitlementVersion({
      licenseStatus: entitlements.license.status,
      canWrite: entitlements.canWrite,
      canMutate: entitlements.canMutate,
      licenseModules: entitlements.license.modules,
      moduleFlags,
    });

    return {
      snapshot: {
        schemaVersion: this.snapshot.schemaVersion,
        platformVersion: this.snapshot.platformVersion,
        generatedAt: this.snapshot.generatedAt,
        catalogGeneration: this.snapshot.catalogGeneration,
        moduleCount: this.snapshot.moduleCount,
        dependencyOrder: this.snapshot.dependencyOrder,
        entitlementVersion,
      },
      modules,
    };
  }

  async getEffectiveModuleViews(userRoles: string[] = []): Promise<EffectiveModuleView[]> {
    this.ensureRegistryReady();
    const { tenantId } = await this.tenantContext.resolve();
    const entitlements = await this.licensingEngine.getEntitlements(tenantId);
    const settings = await this.settingsService.getTenantSettings(tenantId);
    const graph = resolveDependencyGraph(this.snapshot.manifests);
    const licenseAwareHealth = applyLicenseToDependencyHealth(
      graph.healthByModule,
      this.snapshot.manifests,
      entitlements.license.modules,
    );

    return resolveEffectiveModuleViews({
      manifests: this.snapshot.manifests,
      licenseModules: entitlements.license.modules,
      moduleFlags: settings.moduleFlags ?? {},
      canWrite: entitlements.canWrite,
      canMutate: entitlements.canMutate,
      licenseStatus: entitlements.license.status,
      permissionEvaluator: buildPermissionEvaluator(userRoles),
      dependencyOrder: graph.order,
      dependencyHealthByModule: licenseAwareHealth,
    });
  }

  async getEffectiveModuleView(moduleId: string, userRoles: string[] = []): Promise<EffectiveModuleView | undefined> {
    const views = await this.getEffectiveModuleViews(userRoles);
    return findEffectiveModuleView(views, moduleId);
  }

  getModuleHealth(moduleId: string) {
    const manifest = this.getManifest(moduleId);
    if (!manifest) return null;
    return evaluateModuleHealth(manifest, 'healthy', {});
  }
}

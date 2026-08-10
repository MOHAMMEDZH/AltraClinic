import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  loadObservabilityFoundationConfig,
  validateObservabilityFoundationConfig,
} from '../config/observability-config';
import { ObservabilityExtensionRegistry } from './observability-extension.registry';
import { ObservabilityLicensingContracts } from './observability-licensing.contracts';
import {
  OBSERVABILITY_PERMISSION_RESOURCE,
  SYSTEM_MONITORING_OBSERVABILITY_ENABLED_ENV,
} from '../observability.constants';

export interface ObservabilityStartupDiagnostics {
  valid: boolean;
  issues: readonly string[];
  featureFlag: {
    name: string;
    enabled: boolean;
  };
  extensionRegistered: boolean;
  permissionResource: string;
  tenantLicenseGate: string;
  phase: '45a';
}

/**
 * Phase 45a — startup / dependency validation and basic diagnostics.
 * Does not start metrics, tracing, or alert pipelines.
 */
@Injectable()
export class ObservabilityLifecycleService implements OnModuleInit {
  private readonly logger = new Logger(ObservabilityLifecycleService.name);
  private lastDiagnostics: ObservabilityStartupDiagnostics | null = null;

  constructor(
    private readonly extensions: ObservabilityExtensionRegistry,
    private readonly licensing: ObservabilityLicensingContracts,
  ) {}

  onModuleInit(): void {
    this.lastDiagnostics = this.runStartupValidation();
    if (!this.lastDiagnostics.valid) {
      this.logger.warn(
        `Observability foundation config issues: ${this.lastDiagnostics.issues.join('; ')}`,
      );
    } else {
      this.logger.log(
        `Observability Center foundation ready (phase 45a, flag=${SYSTEM_MONITORING_OBSERVABILITY_ENABLED_ENV}=${this.lastDiagnostics.featureFlag.enabled})`,
      );
    }
  }

  runStartupValidation(): ObservabilityStartupDiagnostics {
    const config = loadObservabilityFoundationConfig();
    const validation = validateObservabilityFoundationConfig(config);
    const issues = [...validation.issues];

    if (!this.extensions.isRegistered()) {
      issues.push('extension kind not registered');
    }

    return {
      valid: issues.length === 0,
      issues,
      featureFlag: {
        name: config.featureFlagEnv,
        enabled: config.featureEnabled,
      },
      extensionRegistered: this.extensions.isRegistered(),
      permissionResource: OBSERVABILITY_PERMISSION_RESOURCE,
      tenantLicenseGate: this.licensing.getTenantLicenseGate(),
      phase: '45a',
    };
  }

  getLastDiagnostics(): ObservabilityStartupDiagnostics | null {
    return this.lastDiagnostics;
  }
}

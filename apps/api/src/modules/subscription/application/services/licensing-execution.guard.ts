import { Injectable, Logger } from '@nestjs/common';
import {
  LicensedFeatureId,
  LicensedModuleId,
  isFeatureAllowed,
} from '../../domain/config/licensing.config';
import { LicensingEngineService } from './licensing-engine.service';
import { LicensingAuditService } from './licensing-audit.service';

export interface WorkerLicensingContext {
  tenantId: string;
  workerName: string;
  moduleId: LicensedModuleId;
  featureId?: LicensedFeatureId;
  source?: string;
  /** Platform operational jobs (e.g. subscription renewal reminders) may run during read-only grace. */
  allowReadOnly?: boolean;
}

/**
 * Shared fail-closed licensing checks for background workers with audit trail.
 */
@Injectable()
export class LicensingExecutionGuard {
  private readonly logger = new Logger(LicensingExecutionGuard.name);

  constructor(
    private readonly licensing: LicensingEngineService,
    private readonly audit: LicensingAuditService,
  ) {}

  async isModuleActive(tenantId: string, moduleId: LicensedModuleId, allowReadOnly = false): Promise<boolean> {
    const license = await this.licensing.resolveLicense(tenantId);
    if (!allowReadOnly && license.readOnly) return false;
    if (license.status === 'suspended' || license.status === 'expired') {
      return false;
    }
    const access = license.modules[moduleId] ?? 'disabled';
    return access === 'enabled' || access === 'preview';
  }

  async isFeatureActive(tenantId: string, featureId: LicensedFeatureId): Promise<boolean> {
    const license = await this.licensing.resolveLicense(tenantId);
    if (license.readOnly || license.status === 'suspended' || license.status === 'expired') {
      return false;
    }
    return isFeatureAllowed(license.features[featureId] ?? 'disabled');
  }

  async assertModuleActive(tenantId: string, moduleId: LicensedModuleId): Promise<void> {
    if (!(await this.isModuleActive(tenantId, moduleId))) {
      throw new Error(`Module "${moduleId}" is not licensed for tenant ${tenantId}`);
    }
  }

  /** Fail-closed worker gate with immutable audit on denial. */
  async allowWorkerExecution(ctx: WorkerLicensingContext): Promise<boolean> {
    const license = await this.licensing.resolveLicense(ctx.tenantId);

    if (license.status === 'suspended' || license.status === 'expired' || license.status === 'cancelled') {
      await this.auditDenial(ctx, `Tenant license status is ${license.status}`);
      return false;
    }

    if (!(await this.isModuleActive(ctx.tenantId, ctx.moduleId, ctx.allowReadOnly))) {
      await this.auditDenial(ctx, `Module "${ctx.moduleId}" not licensed`);
      return false;
    }

    if (ctx.featureId && !(await this.isFeatureActive(ctx.tenantId, ctx.featureId))) {
      await this.auditDenial(ctx, `Feature "${ctx.featureId}" not licensed`);
      return false;
    }

    return true;
  }

  private async auditDenial(ctx: WorkerLicensingContext, reason: string): Promise<void> {
    this.logger.debug(`Worker ${ctx.workerName} skipped tenant=${ctx.tenantId}: ${reason}`);
    await this.audit.recordLicenseEvent({
      tenantId: ctx.tenantId,
      eventType: 'worker.denied',
      moduleId: ctx.moduleId,
      featureId: ctx.featureId,
      decision: 'denied',
      reason,
      source: ctx.source ?? `worker.${ctx.workerName}`,
      metadata: { workerName: ctx.workerName },
    });
  }
}

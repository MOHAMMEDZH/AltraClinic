import { Injectable } from '@nestjs/common';

import { PlanLimits } from '../../domain/config/plan-limits.config';

import { LicensedFeatureId, LicensedModuleId } from '../../domain/config/licensing.config';

import { FeatureName, LimitedResource } from '../../domain/exceptions/plan-limit-exceeded.exception';

import { LicensingEngineService } from './licensing-engine.service';



/**

 * Backward-compatible enforcement facade.

 * All plan/limit/feature checks delegate to LicensingEngineService.

 */

@Injectable()

export class SubscriptionEnforcementService {

  constructor(private readonly licensing: LicensingEngineService) {}



  async getActivePlanLimits(tenantId: string): Promise<PlanLimits> {

    return this.licensing.getActivePlanLimits(tenantId);

  }



  async resolveLicense(tenantId: string) {

    return this.licensing.resolveLicense(tenantId);

  }



  async getEntitlements(tenantId: string) {

    return this.licensing.getEntitlements(tenantId);

  }



  async enforceUserLimit(tenantId: string): Promise<void> {

    await this.licensing.enforceUserLimit(tenantId);

  }



  async enforceDoctorLimit(tenantId: string): Promise<void> {

    await this.licensing.enforceDoctorLimit(tenantId);

  }



  async enforcePatientLimit(tenantId: string): Promise<void> {

    await this.licensing.enforcePatientLimit(tenantId);

  }



  async enforceAppointmentLimit(tenantId: string): Promise<void> {

    await this.licensing.enforceAppointmentLimit(tenantId);

  }



  async enforceBranchLimit(tenantId: string): Promise<void> {

    await this.licensing.enforceBranchLimit(tenantId);

  }



  async enforceStorageLimit(tenantId: string, additionalBytes: number): Promise<void> {

    await this.licensing.enforceStorageLimit(tenantId, additionalBytes);

  }



  async enforceReportLimit(tenantId: string): Promise<void> {

    await this.licensing.enforceReportLimit(tenantId);

  }



  async enforceFeature(tenantId: string, feature: FeatureName): Promise<void> {

    await this.licensing.enforceFeature(tenantId, feature);

  }



  async enforceLicensedFeature(tenantId: string, featureId: LicensedFeatureId): Promise<void> {

    await this.licensing.enforceLicensedFeature(tenantId, featureId);

  }



  async enforceModuleAccess(tenantId: string, moduleId: LicensedModuleId): Promise<void> {

    await this.licensing.enforceModuleAccess(tenantId, moduleId);

  }



  async enforceLicenseWritable(tenantId: string): Promise<void> {

    await this.licensing.enforceLicenseWritable(tenantId);

  }



  invalidateCache(tenantId: string): void {

    this.licensing.invalidateCache(tenantId);

  }

}


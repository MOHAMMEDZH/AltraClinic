import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BeautyRecordService } from '../services/beauty-record.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class ApproveBeautyPlanHandler {
  constructor(
    private readonly records: BeautyRecordService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(patientId: string, planId: string, approvedBy: string) {
    const ctx = (await this.tenant.resolve()) as TenantContextContract;
    return this.records.approvePlan(ctx.tenantId, patientId, planId, approvedBy);
  }
}

@Injectable()
export class ExportBeautyRecordHandler {
  constructor(
    private readonly records: BeautyRecordService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(patientId: string) {
    const ctx = (await this.tenant.resolve()) as TenantContextContract;
    const payload = await this.records.exportRecord(ctx.tenantId, patientId);
    if (!payload) throw new NotFoundException('Beauty record not found');
    return payload;
  }
}

@Injectable()
export class AssertBeautyConsentHandler {
  constructor(
    private readonly records: BeautyRecordService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(patientId: string, consentType: 'photo' | 'treatment') {
    const ctx = (await this.tenant.resolve()) as TenantContextContract;
    const granted = await this.records.hasConsent(ctx.tenantId, patientId, consentType);
    return { granted, type: consentType };
  }

  async assert(patientId: string, consentType: 'photo' | 'treatment') {
    const result = await this.execute(patientId, consentType);
    if (!result.granted) {
      throw new BadRequestException(`Missing ${consentType} consent for patient`);
    }
    return result;
  }
}

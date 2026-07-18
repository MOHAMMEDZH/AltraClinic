import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePatientCommand } from '../commands/create-patient.command';
import { CreatePatientHandler } from './create-patient.handler';
import { PatientRepository } from '../../domain/patient.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { PATIENT_REPOSITORY } from '../../../../infrastructure/provider.tokens';

@Injectable()
export class QuickRegisterPatientHandler {
  constructor(private readonly createHandler: CreatePatientHandler) {}

  async execute(cmd: { firstName: string; lastName: string; phone?: string; gender?: 'male' | 'female' | 'other' }) {
    return this.createHandler.execute(
      new CreatePatientCommand(cmd.firstName, cmd.lastName, undefined, cmd.gender, undefined, undefined, undefined, undefined, undefined, undefined, undefined, cmd.phone),
    );
  }
}

@Injectable()
export class ListPatientsHandler {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repo: PatientRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: {
    q?: string;
    status?: 'active' | 'archived' | 'all';
    gender?: 'male' | 'female' | 'other';
    branchId?: string;
    limit?: number;
    offset?: number;
  }) {
    const tenant = await this.tenantContext.resolve();
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);

    return this.repo.list({
      tenantId: tenant.tenantId,
      branchId: query.branchId ?? tenant.branchId,
      q: query.q,
      status: query.status ?? 'active',
      gender: query.gender,
      limit,
      offset,
    });
  }
}

@Injectable()
export class UpdatePatientHandler {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repo: PatientRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(id: string, input: Parameters<PatientRepository['update']>[2]) {
    const tenant = await this.tenantContext.resolve();
    const updated = await this.repo.update(id, tenant.tenantId, input);
    if (!updated) throw new NotFoundException('Patient not found');
    return updated;
  }
}

@Injectable()
export class ArchivePatientHandler {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repo: PatientRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(id: string) {
    const tenant = await this.tenantContext.resolve();
    const ok = await this.repo.archive(id, tenant.tenantId);
    if (!ok) throw new NotFoundException('Patient not found');
    return { id, archived: true };
  }
}

@Injectable()
export class ReactivatePatientHandler {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repo: PatientRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(id: string) {
    const tenant = await this.tenantContext.resolve();
    const ok = await this.repo.reactivate(id, tenant.tenantId);
    if (!ok) throw new NotFoundException('Patient not found');
    return { id, archived: false };
  }
}

@Injectable()
export class MergePatientsHandler {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repo: PatientRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(targetId: string, sourceId: string) {
    const tenant = await this.tenantContext.resolve();
    if (targetId === sourceId) throw new BadRequestException('Cannot merge patient with itself');
    try {
      return await this.repo.merge(tenant.tenantId, targetId, sourceId);
    } catch {
      throw new NotFoundException('Patient not found for merge');
    }
  }
}

@Injectable()
export class GetPatientTimelineHandler {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repo: PatientRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(id: string, limit?: number) {
    const tenant = await this.tenantContext.resolve();
    const detail = await this.repo.findDetailById(id, tenant.tenantId);
    if (!detail) throw new NotFoundException('Patient not found');
    const items = await this.repo.getTimeline(id, tenant.tenantId, limit);
    return { patientId: id, items };
  }
}

@Injectable()
export class GetPatientDuplicatesHandler {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repo: PatientRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(id: string) {
    const tenant = await this.tenantContext.resolve();
    const detail = await this.repo.findDetailById(id, tenant.tenantId);
    if (!detail) throw new NotFoundException('Patient not found');
    const candidates = await this.repo.findDuplicates(id, tenant.tenantId);
    return { patientId: id, candidates };
  }
}

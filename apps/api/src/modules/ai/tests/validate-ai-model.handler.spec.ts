import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ValidateAiModelHandler } from '../application/handlers/validate-ai-model.handler';
import { InMemoryAiModelRepository } from '../infrastructure/in-memory-ai-model.repository';
import { AiModel } from '../domain/entities/ai-model.entity';
import { AiPolicy } from '../policies/ai-policy.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { AI_MODEL_REPOSITORY, EVENT_PUBLISHER } from '../../../infrastructure/provider.tokens';

import { SubscriptionEnforcementService } from '../../subscription/application/services/subscription-enforcement.service';

describe('ValidateAiModelHandler', () => {
  let handler: ValidateAiModelHandler;
  let repository: InMemoryAiModelRepository;
  const publish = jest.fn();
  const GOVERNANCE_ROLES = ['ai_admin'];

  const seedModel = async (tenantId: string, createdBy = 'user-1') => {
    const model = AiModel.create({
      tenantId,
      branchId: 'branch-1',
      nameEn: 'Patient Summary',
      nameAr: 'ملخص المريض',
      descriptionEn: 'desc',
      descriptionAr: 'وصف',
      modelType: 'summary',
      version: '1.0.0',
      createdBy,
    });
    await repository.save(model);
    return model;
  };

  beforeEach(async () => {
    publish.mockClear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidateAiModelHandler,
        AiPolicy,
        { provide: AI_MODEL_REPOSITORY, useClass: InMemoryAiModelRepository },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'tenant-1', branchId: 'branch-1', environment: 'sandbox' }) },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish } },
        {
          provide: SubscriptionEnforcementService,
          useValue: { enforceFeature: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    handler = module.get<ValidateAiModelHandler>(ValidateAiModelHandler);
    repository = module.get<InMemoryAiModelRepository>(AI_MODEL_REPOSITORY as any);
  });

  it('validates a model and publishes an event', async () => {
    const model = await seedModel('tenant-1');
    await handler.execute({
      modelId: model.id,
      validatedBy: 'reviewer-1',
      validatedByRoles: GOVERNANCE_ROLES,
      notes: 'approved',
    });

    const stored = await repository.findById(model.id, 'tenant-1');
    expect(stored?.status.value).toBe('validated');
    expect(stored?.validatedBy).toBe('reviewer-1');
    expect(stored?.validationNotes).toBe('approved');
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('throws when the actor lacks governance review permission', async () => {
    const model = await seedModel('tenant-1');
    await expect(
      handler.execute({ modelId: model.id, validatedBy: 'reviewer-1', validatedByRoles: ['ai_manager'], notes: null }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('enforces separation of duties (creator cannot validate)', async () => {
    const model = await seedModel('tenant-1', 'reviewer-1');
    await expect(
      handler.execute({ modelId: model.id, validatedBy: 'reviewer-1', validatedByRoles: GOVERNANCE_ROLES, notes: null }),
    ).rejects.toThrow('A model cannot be validated by the same user who created it');
  });

  it('throws when model ID is missing', async () => {
    await expect(
      handler.execute({ modelId: '  ', validatedBy: 'reviewer-1', validatedByRoles: GOVERNANCE_ROLES, notes: null }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when model is not found', async () => {
    await expect(
      handler.execute({ modelId: 'missing', validatedBy: 'reviewer-1', validatedByRoles: GOVERNANCE_ROLES, notes: null }),
    ).rejects.toThrow(NotFoundException);
  });

  it('does not validate a model belonging to another tenant', async () => {
    const model = await seedModel('tenant-2');
    await expect(
      handler.execute({ modelId: model.id, validatedBy: 'reviewer-1', validatedByRoles: GOVERNANCE_ROLES, notes: null }),
    ).rejects.toThrow(NotFoundException);
  });
});

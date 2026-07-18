import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { RetireAiModelHandler } from '../application/handlers/retire-ai-model.handler';
import { InMemoryAiModelRepository } from '../infrastructure/in-memory-ai-model.repository';
import { AiModel } from '../domain/entities/ai-model.entity';
import { AiPolicy } from '../policies/ai-policy.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { AI_MODEL_REPOSITORY, EVENT_PUBLISHER } from '../../../infrastructure/provider.tokens';
import { SubscriptionEnforcementService } from '../../subscription/application/services/subscription-enforcement.service';

const mockEnforcement = {
  enforceFeature: jest.fn().mockResolvedValue(undefined),
};

describe('RetireAiModelHandler', () => {
  let handler: RetireAiModelHandler;
  let repository: InMemoryAiModelRepository;
  const publish = jest.fn();
  const GOVERNANCE_ROLES = ['ai_admin'];

  const seedModel = async (tenantId: string) => {
    const model = AiModel.create({
      tenantId,
      branchId: 'branch-1',
      nameEn: 'Patient Summary',
      nameAr: 'ملخص المريض',
      descriptionEn: 'desc',
      descriptionAr: 'وصف',
      modelType: 'summary',
      version: '1.0.0',
      createdBy: 'user-1',
    });
    await repository.save(model);
    return model;
  };

  beforeEach(async () => {
    publish.mockClear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetireAiModelHandler,
        AiPolicy,
        { provide: AI_MODEL_REPOSITORY, useClass: InMemoryAiModelRepository },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'tenant-1', branchId: 'branch-1', environment: 'sandbox' }) },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish } },
        { provide: SubscriptionEnforcementService, useValue: mockEnforcement },
      ],
    }).compile();

    handler = module.get<RetireAiModelHandler>(RetireAiModelHandler);
    repository = module.get<InMemoryAiModelRepository>(AI_MODEL_REPOSITORY as any);
  });

  it('retires a model and publishes an event', async () => {
    const model = await seedModel('tenant-1');
    await handler.execute({ modelId: model.id, retiredBy: 'retirer-1', retiredByRoles: GOVERNANCE_ROLES });

    const stored = await repository.findById(model.id, 'tenant-1');
    expect(stored?.status.value).toBe('retired');
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('throws when the actor lacks governance operation permission', async () => {
    const model = await seedModel('tenant-1');
    await expect(
      handler.execute({ modelId: model.id, retiredBy: 'retirer-1', retiredByRoles: ['ai_manager'] }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when retiredBy is missing', async () => {
    const model = await seedModel('tenant-1');
    await expect(
      handler.execute({ modelId: model.id, retiredBy: '  ', retiredByRoles: GOVERNANCE_ROLES }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when model is not found', async () => {
    await expect(
      handler.execute({ modelId: 'missing', retiredBy: 'retirer-1', retiredByRoles: GOVERNANCE_ROLES }),
    ).rejects.toThrow(NotFoundException);
  });

  it('does not retire a model belonging to another tenant', async () => {
    const model = await seedModel('tenant-2');
    await expect(
      handler.execute({ modelId: model.id, retiredBy: 'retirer-1', retiredByRoles: GOVERNANCE_ROLES }),
    ).rejects.toThrow(NotFoundException);
  });
});

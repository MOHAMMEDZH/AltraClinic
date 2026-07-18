import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DeployAiModelHandler } from '../application/handlers/deploy-ai-model.handler';
import { InMemoryAiModelRepository } from '../infrastructure/in-memory-ai-model.repository';
import { AiModel } from '../domain/entities/ai-model.entity';
import { AiPolicy } from '../policies/ai-policy.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { AI_MODEL_REPOSITORY, EVENT_PUBLISHER } from '../../../infrastructure/provider.tokens';
import { SubscriptionEnforcementService } from '../../subscription/application/services/subscription-enforcement.service';

const mockEnforcement = {
  enforceFeature: jest.fn().mockResolvedValue(undefined),
};

describe('DeployAiModelHandler', () => {
  let handler: DeployAiModelHandler;
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
    model.validate('reviewer-1');
    await repository.save(model);
    return model;
  };

  beforeEach(async () => {
    publish.mockClear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeployAiModelHandler,
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

    handler = module.get<DeployAiModelHandler>(DeployAiModelHandler);
    repository = module.get<InMemoryAiModelRepository>(AI_MODEL_REPOSITORY as any);
  });

  it('deploys a validated model and publishes an event', async () => {
    const model = await seedModel('tenant-1');
    await handler.execute({ modelId: model.id, deployedBy: 'deployer-1', deployedByRoles: GOVERNANCE_ROLES });

    const stored = await repository.findById(model.id, 'tenant-1');
    expect(stored?.status.value).toBe('deployed');
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('throws when the actor lacks governance operation permission', async () => {
    const model = await seedModel('tenant-1');
    await expect(
      handler.execute({ modelId: model.id, deployedBy: 'deployer-1', deployedByRoles: ['ai_manager'] }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when model ID is missing', async () => {
    await expect(
      handler.execute({ modelId: '  ', deployedBy: 'deployer-1', deployedByRoles: GOVERNANCE_ROLES }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when model is not found', async () => {
    await expect(
      handler.execute({ modelId: 'missing', deployedBy: 'deployer-1', deployedByRoles: GOVERNANCE_ROLES }),
    ).rejects.toThrow(NotFoundException);
  });

  it('does not deploy a model belonging to another tenant', async () => {
    const model = await seedModel('tenant-2');
    await expect(
      handler.execute({ modelId: model.id, deployedBy: 'deployer-1', deployedByRoles: GOVERNANCE_ROLES }),
    ).rejects.toThrow(NotFoundException);
  });
});

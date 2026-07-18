import { Test, TestingModule } from '@nestjs/testing';
import { ListAiModelsHandler } from '../application/handlers/list-ai-models.handler';
import { InMemoryAiModelRepository } from '../infrastructure/in-memory-ai-model.repository';
import { AiModel } from '../domain/entities/ai-model.entity';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { AI_MODEL_REPOSITORY } from '../../../infrastructure/provider.tokens';

describe('ListAiModelsHandler', () => {
  let handler: ListAiModelsHandler;
  let repository: InMemoryAiModelRepository;

  const makeModel = (overrides: Partial<Parameters<typeof AiModel.create>[0]> = {}) =>
    AiModel.create({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      nameEn: 'Model',
      nameAr: 'نموذج',
      descriptionEn: 'desc',
      descriptionAr: 'وصف',
      modelType: 'summary',
      version: '1.0.0',
      createdBy: 'user-1',
      ...overrides,
    });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListAiModelsHandler,
        { provide: AI_MODEL_REPOSITORY, useClass: InMemoryAiModelRepository },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'tenant-1', branchId: 'branch-1', environment: 'sandbox' }) },
        },
      ],
    }).compile();

    handler = module.get<ListAiModelsHandler>(ListAiModelsHandler);
    repository = module.get<InMemoryAiModelRepository>(AI_MODEL_REPOSITORY as any);
  });

  it('lists models for the resolved tenant only', async () => {
    await repository.save(makeModel());
    await repository.save(makeModel({ tenantId: 'tenant-2' }));

    const result = await handler.execute({ branchId: null, modelType: null, status: null, limit: 50, offset: 0 });
    expect(result).toHaveLength(1);
    expect(result[0].tenantId).toBe('tenant-1');
  });

  it('filters by model type', async () => {
    await repository.save(makeModel({ modelType: 'summary' }));
    await repository.save(makeModel({ modelType: 'prediction' }));

    const result = await handler.execute({ branchId: null, modelType: 'prediction', status: null, limit: 50, offset: 0 });
    expect(result).toHaveLength(1);
    expect(result[0].modelType).toBe('prediction');
  });

  it('filters by status', async () => {
    const deployed = makeModel();
    deployed.validate('reviewer-1');
    deployed.deploy('deployer-1');
    await repository.save(deployed);
    await repository.save(makeModel());

    const result = await handler.execute({ branchId: null, modelType: null, status: 'deployed', limit: 50, offset: 0 });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('deployed');
  });

  it('applies pagination', async () => {
    for (let i = 0; i < 5; i += 1) {
      await repository.save(makeModel({ version: `1.0.${i}` }));
    }

    const page = await handler.execute({ branchId: null, modelType: null, status: null, limit: 2, offset: 2 });
    expect(page).toHaveLength(2);
  });
});

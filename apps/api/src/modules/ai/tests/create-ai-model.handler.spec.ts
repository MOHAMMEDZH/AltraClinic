import { Test, TestingModule } from '@nestjs/testing';
import { CreateAiModelHandler } from '../application/handlers/create-ai-model.handler';
import { InMemoryAiModelRepository } from '../infrastructure/in-memory-ai-model.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { AI_MODEL_REPOSITORY, EVENT_PUBLISHER } from '../../../infrastructure/provider.tokens';
import { SubscriptionEnforcementService } from '../../subscription/application/services/subscription-enforcement.service';

const mockEnforcement = {
  enforceFeature: jest.fn().mockResolvedValue(undefined),
  enforceUserLimit: jest.fn().mockResolvedValue(undefined),
  enforceDoctorLimit: jest.fn().mockResolvedValue(undefined),
  enforcePatientLimit: jest.fn().mockResolvedValue(undefined),
  enforceAppointmentLimit: jest.fn().mockResolvedValue(undefined),
  enforceBranchLimit: jest.fn().mockResolvedValue(undefined),
};

describe('CreateAiModelHandler', () => {
  let handler: CreateAiModelHandler;
  let repository: InMemoryAiModelRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateAiModelHandler,
        { provide: AI_MODEL_REPOSITORY, useClass: InMemoryAiModelRepository },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'tenant-1', branchId: 'branch-1', environment: 'sandbox' }) },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: async () => {} } },
        { provide: SubscriptionEnforcementService, useValue: mockEnforcement },
      ],
    }).compile();

    handler = module.get<CreateAiModelHandler>(CreateAiModelHandler);
    repository = module.get<InMemoryAiModelRepository>(AI_MODEL_REPOSITORY as any);
  });

  it('creates an AI model and persists it', async () => {
    const result = await handler.execute({
      nameEn: 'Patient Summary',
      nameAr: 'ملخص المريض',
      descriptionEn: 'AI-generated patient summaries',
      descriptionAr: 'ملخصات المرضى المولدة بالذكاء الاصطناعي',
      modelType: 'summary',
      version: '1.0.0',
      branchId: 'branch-1',
      createdBy: 'user-1',
    });

    expect(result).toHaveProperty('modelId');
    const stored = await repository.findById(result.modelId, 'tenant-1');
    expect(stored).not.toBeNull();
    expect(stored?.nameEn).toBe('Patient Summary');
    expect(stored?.nameAr).toBe('ملخص المريض');
    expect(stored?.modelType).toBe('summary');
    expect(stored?.version).toBe('1.0.0');
    expect(stored?.status.value).toBe('draft');
  });

  it('creates models with different types', async () => {
    const types: Array<'summary' | 'search' | 'insight' | 'recommendation' | 'prediction' | 'assistant'> = [
      'summary',
      'search',
      'insight',
      'recommendation',
      'prediction',
      'assistant',
    ];

    for (const modelType of types) {
      const result = await handler.execute({
        nameEn: `Test ${modelType}`,
        nameAr: `اختبار ${modelType}`,
        descriptionEn: `Test ${modelType} model`,
        descriptionAr: `نموذج اختبار ${modelType}`,
        modelType,
        version: '1.0.0',
        branchId: null,
        createdBy: 'user-1',
      });

      const stored = await repository.findById(result.modelId, 'tenant-1');
      expect(stored?.modelType).toBe(modelType);
    }
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { CreateWorkflowHandler } from '../application/handlers/create-workflow.handler';
import { InMemoryWorkflowRepository } from '../infrastructure/in-memory-workflow.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { WORKFLOW_REPOSITORY, EVENT_PUBLISHER } from '../../../infrastructure/provider.tokens';
import { SubscriptionEnforcementService } from '../../subscription/application/services/subscription-enforcement.service';

const mockEnforcement = {
  enforceFeature: jest.fn().mockResolvedValue(undefined),
  enforceUserLimit: jest.fn().mockResolvedValue(undefined),
  enforceDoctorLimit: jest.fn().mockResolvedValue(undefined),
  enforcePatientLimit: jest.fn().mockResolvedValue(undefined),
  enforceAppointmentLimit: jest.fn().mockResolvedValue(undefined),
  enforceBranchLimit: jest.fn().mockResolvedValue(undefined),
};

describe('CreateWorkflowHandler', () => {
  let handler: CreateWorkflowHandler;
  let repository: InMemoryWorkflowRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateWorkflowHandler,
        { provide: WORKFLOW_REPOSITORY, useClass: InMemoryWorkflowRepository },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'tenant-1', branchId: 'branch-1', environment: 'sandbox' }) },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: async () => {} } },
        { provide: SubscriptionEnforcementService, useValue: mockEnforcement },
      ],
    }).compile();

    handler = module.get<CreateWorkflowHandler>(CreateWorkflowHandler);
    repository = module.get<InMemoryWorkflowRepository>(WORKFLOW_REPOSITORY as any);
  });

  it('creates a workflow and persists it', async () => {
    const result = await handler.execute({
      nameEn: 'New Workflow',
      nameAr: 'سير عمل جديد',
      descriptionEn: 'A test workflow',
      descriptionAr: 'وصف اختبار',
      steps: ['step1', 'step2'],
      branchId: 'branch-1',
      createdBy: 'user-1',
    });

    expect(result).toHaveProperty('workflowId');
    const stored = await repository.findById(result.workflowId, 'tenant-1');
    expect(stored).not.toBeNull();
    expect(stored?.nameEn).toBe('New Workflow');
    expect(stored?.nameAr).toBe('سير عمل جديد');
    expect(stored?.steps).toEqual(['step1', 'step2']);
    expect(stored?.status.value).toBe('active');
  });
});

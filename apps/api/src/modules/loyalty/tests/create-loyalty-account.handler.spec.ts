import { Test, TestingModule } from '@nestjs/testing';
import { CreateLoyaltyAccountHandler } from '../application/handlers/create-loyalty-account.handler';
import { InMemoryLoyaltyAccountRepository } from '../infrastructure/in-memory-loyalty-account.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { LOYALTY_ACCOUNT_REPOSITORY, EVENT_PUBLISHER } from '../../../infrastructure/provider.tokens';
import { SubscriptionEnforcementService } from '../../subscription/application/services/subscription-enforcement.service';

const mockEnforcement = {
  enforceFeature: jest.fn().mockResolvedValue(undefined),
  enforceUserLimit: jest.fn().mockResolvedValue(undefined),
  enforceDoctorLimit: jest.fn().mockResolvedValue(undefined),
  enforcePatientLimit: jest.fn().mockResolvedValue(undefined),
  enforceAppointmentLimit: jest.fn().mockResolvedValue(undefined),
  enforceBranchLimit: jest.fn().mockResolvedValue(undefined),
};

describe('CreateLoyaltyAccountHandler', () => {
  let handler: CreateLoyaltyAccountHandler;
  let repo: InMemoryLoyaltyAccountRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateLoyaltyAccountHandler,
        { provide: LOYALTY_ACCOUNT_REPOSITORY, useClass: InMemoryLoyaltyAccountRepository },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'tenant-1', branchId: 'branch-1', environment: 'sandbox' }) },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: async () => {} } },
        { provide: SubscriptionEnforcementService, useValue: mockEnforcement },
      ],
    }).compile();

    handler = module.get(CreateLoyaltyAccountHandler);
    repo = module.get(LOYALTY_ACCOUNT_REPOSITORY);
  });

  it('creates and persists a loyalty account', async () => {
    const result = await handler.execute({
      patientId: 'patient-1',
      clinicId: 'clinic-1',
      initialPoints: 0,
    });

    expect(result).toHaveProperty('accountId');
    const stored = await repo.findById(result.accountId, 'tenant-1');
    expect(stored).not.toBeNull();
    expect(stored?.patientId).toBe('patient-1');
    expect(stored?.points.balance).toBe(0);
    expect(stored?.tier.name).toBe('Bronze');
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { CalculateCommissionHandler } from '../application/handlers/calculate-commission.handler';
import { InMemoryCommissionRepository } from '../infrastructure/in-memory-commission.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { EVENT_PUBLISHER, COMMISSION_REPOSITORY } from '../../../infrastructure/provider.tokens';
import { CommissionRuleService } from '../domain/services/commission-rule.service';

describe('CalculateCommissionHandler', () => {
  let handler: CalculateCommissionHandler;
  let repo: InMemoryCommissionRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalculateCommissionHandler,
        { provide: COMMISSION_REPOSITORY, useClass: InMemoryCommissionRepository },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'tenant-1', branchId: 'branch-1', environment: 'sandbox' }) },
        },
        {
          provide: CommissionRuleService,
          useValue: { findBestApplicableRule: async () => null },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: async () => {} } },
      ],
    }).compile();

    handler = module.get(CalculateCommissionHandler);
    repo = module.get(COMMISSION_REPOSITORY);
  });

  it('calculates and persists a commission', async () => {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    const result = await handler.execute({
      providerId: 'provider-1',
      branchId: 'branch-1',
      periodStart,
      periodEnd,
      currency: 'SYP',
      basisDocumentIds: ['invoice-1', 'invoice-2'],
      lineItems: [{ appointmentId: 'apt-1', serviceDescription: 'Consultation', amount: 500, commissionRateType: 'percentage', commissionRateValue: 10, date: now.toISOString() }],
    });

    expect(result).toHaveProperty('commissionId');
    const stored = await repo.findById(result.commissionId, 'tenant-1');
    expect(stored).not.toBeNull();
    expect(stored?.providerId).toBe('provider-1');
    expect(stored?.totalRevenue).toBe(500);
    expect(stored?.commissionAmount).toBeCloseTo(50);
    expect(stored?.status.status).toBe('calculated');
  });
});


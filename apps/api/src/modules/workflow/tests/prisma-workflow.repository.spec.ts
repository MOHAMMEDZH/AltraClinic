import { Test, TestingModule } from '@nestjs/testing';
import { PrismaWorkflowRepository } from '../infrastructure/prisma-workflow.repository';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Workflow } from '../domain/entities/workflow.entity';

const mockPrismaService = {
  workflow: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

const TENANT_ID = 'tenant-001';

function makeWorkflow(): Workflow {
  return Workflow.create({
    tenantId: TENANT_ID,
    branchId: null,
    nameEn: 'Patient Intake',
    nameAr: 'استقبال المريض',
    descriptionEn: 'Standard intake flow',
    descriptionAr: 'تدفق الاستقبال القياسي',
    steps: ['step-1', 'step-2', 'step-3'],
    createdBy: 'admin-001',
  });
}

const prismaRow = (w: Workflow) => ({
  id: w.id,
  tenantId: w.tenantId,
  branchId: w.branchId,
  nameEn: w.nameEn,
  nameAr: w.nameAr,
  descriptionEn: w.descriptionEn,
  descriptionAr: w.descriptionAr,
  steps: w.steps,
  currentStepIndex: w.currentStepIndex,
  status: 'ACTIVE' as const,
  createdBy: w.createdBy,
  createdAt: w.createdAt,
  updatedAt: w.updatedAt,
});

describe('PrismaWorkflowRepository', () => {
  let repo: PrismaWorkflowRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaWorkflowRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repo = module.get<PrismaWorkflowRepository>(PrismaWorkflowRepository);
  });

  describe('save()', () => {
    it('persists workflow with ACTIVE status', async () => {
      const w = makeWorkflow();
      await repo.save(w);

      expect(mockPrismaService.workflow.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            tenantId: TENANT_ID,
            nameEn: 'Patient Intake',
            status: 'ACTIVE',
          }),
        }),
      );
    });

    it('maps canceled status to CANCELLED', async () => {
      const w = makeWorkflow();
      w.cancel('user-test');
      await repo.save(w);

      expect(mockPrismaService.workflow.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('persists steps array', async () => {
      const w = makeWorkflow();
      await repo.save(w);

      const createArg = mockPrismaService.workflow.upsert.mock.calls[0][0].create;
      expect(createArg.steps).toEqual(['step-1', 'step-2', 'step-3']);
    });
  });

  describe('findById()', () => {
    it('returns null when not found', async () => {
      mockPrismaService.workflow.findFirst.mockResolvedValueOnce(null);
      const result = await repo.findById('w-999', TENANT_ID);
      expect(result).toBeNull();
    });

    it('reconstructs Workflow with WorkflowStatusVO', async () => {
      const w = makeWorkflow();
      mockPrismaService.workflow.findFirst.mockResolvedValueOnce(prismaRow(w));

      const result = await repo.findById(w.id, TENANT_ID);

      expect(result).not.toBeNull();
      expect(result!.status.value).toBe('active');
      expect(result!.steps).toEqual(['step-1', 'step-2', 'step-3']);
    });

    it('maps CANCELLED back to canceled', async () => {
      const w = makeWorkflow();
      mockPrismaService.workflow.findFirst.mockResolvedValueOnce({
        ...prismaRow(w),
        status: 'CANCELLED',
      });

      const result = await repo.findById(w.id, TENANT_ID);
      expect(result!.status.value).toBe('canceled');
    });
  });

  describe('list()', () => {
    it('applies tenantId and status filters', async () => {
      mockPrismaService.workflow.findMany.mockResolvedValueOnce([]);

      await repo.list({ tenantId: TENANT_ID, status: 'active' });

      expect(mockPrismaService.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID, status: 'ACTIVE' }),
        }),
      );
    });

    it('respects pagination', async () => {
      mockPrismaService.workflow.findMany.mockResolvedValueOnce([]);

      await repo.list({ tenantId: TENANT_ID, limit: 10, offset: 5 });

      expect(mockPrismaService.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 10 }),
      );
    });
  });
});

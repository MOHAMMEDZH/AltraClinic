import { Test, TestingModule } from '@nestjs/testing';
import { PrismaAiModelRepository } from '../infrastructure/prisma-ai-model.repository';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AiModel } from '../domain/entities/ai-model.entity';

const mockPrismaService = {
  aiModel: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

const TENANT_ID = 'tenant-001';

function makeModel(): AiModel {
  return AiModel.create({
    tenantId: TENANT_ID,
    branchId: null,
    nameEn: 'Diagnosis Assistant',
    nameAr: 'مساعد التشخيص',
    descriptionEn: 'AI model for diagnosis suggestions',
    descriptionAr: 'نموذج الذكاء الاصطناعي لاقتراحات التشخيص',
    modelType: 'assistant',
    version: '1.0.0',
    createdBy: 'admin-001',
  });
}

const prismaRow = (m: AiModel) => ({
  id: m.id,
  tenantId: m.tenantId,
  branchId: m.branchId,
  nameEn: m.nameEn,
  nameAr: m.nameAr,
  descriptionEn: m.descriptionEn,
  descriptionAr: m.descriptionAr,
  modelType: 'ASSISTANT' as const,
  version: m.version,
  status: 'DRAFT' as const,
  createdBy: m.createdBy,
  validatedBy: null,
  validatedAt: null,
  validationNotes: null,
  deployedBy: null,
  deployedAt: null,
  retiredBy: null,
  retiredAt: null,
  createdAt: m.createdAt,
  updatedAt: m.updatedAt,
});

describe('PrismaAiModelRepository', () => {
  let repo: PrismaAiModelRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaAiModelRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repo = module.get<PrismaAiModelRepository>(PrismaAiModelRepository);
  });

  describe('save()', () => {
    it('persists model with DRAFT status and ASSISTANT type', async () => {
      const m = makeModel();
      await repo.save(m);

      expect(mockPrismaService.aiModel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            tenantId: TENANT_ID,
            modelType: 'assistant',
            status: 'DRAFT',
            version: '1.0.0',
          }),
        }),
      );
    });

    it('persists validation metadata when model is validated', async () => {
      const m = makeModel();
      const validatorId = 'validator-001';
      m.validate(validatorId, 'Passed all checks');

      await repo.save(m);

      expect(mockPrismaService.aiModel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            status: 'VALIDATED',
            validatedBy: validatorId,
            validationNotes: 'Passed all checks',
          }),
        }),
      );
    });
  });

  describe('findById()', () => {
    it('returns null when not found', async () => {
      mockPrismaService.aiModel.findFirst.mockResolvedValueOnce(null);
      const result = await repo.findById('model-999', TENANT_ID);
      expect(result).toBeNull();
    });

    it('reconstructs AiModel with correct type and status', async () => {
      const m = makeModel();
      mockPrismaService.aiModel.findFirst.mockResolvedValueOnce(prismaRow(m));

      const result = await repo.findById(m.id, TENANT_ID);

      expect(result).not.toBeNull();
      expect(result!.modelType).toBe('assistant');
      expect(result!.status.value).toBe('draft');
    });

    it('maps DEPLOYED status back to domain', async () => {
      const m = makeModel();
      mockPrismaService.aiModel.findFirst.mockResolvedValueOnce({
        ...prismaRow(m),
        status: 'DEPLOYED',
        deployedBy: 'deployer-001',
        deployedAt: new Date(),
      });

      const result = await repo.findById(m.id, TENANT_ID);
      expect(result!.status.value).toBe('deployed');
    });
  });

  describe('list()', () => {
    it('applies modelType filter', async () => {
      mockPrismaService.aiModel.findMany.mockResolvedValueOnce([]);

      await repo.list({ tenantId: TENANT_ID, modelType: 'summary' });

      expect(mockPrismaService.aiModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID, modelType: 'summary' }),
        }),
      );
    });

    it('applies status filter', async () => {
      mockPrismaService.aiModel.findMany.mockResolvedValueOnce([]);

      await repo.list({ tenantId: TENANT_ID, status: 'deployed' });

      expect(mockPrismaService.aiModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'DEPLOYED' }),
        }),
      );
    });
  });
});

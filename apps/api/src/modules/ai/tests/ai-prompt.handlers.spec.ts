import {
  DeleteAiPromptHandler,
  DuplicateAiPromptHandler,
  ListAiPromptsHandler,
  RestoreAiPromptVersionHandler,
  ToggleAiPromptFavoriteHandler,
  UpsertAiPromptHandler,
} from '../application/handlers/ai-assistant.handlers';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { AiSubscriptionService } from '../application/services/ai-subscription.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const TENANT_ID = 'a1000000-0000-4000-8000-000000000001';
const USER_ID = 'c1000000-0000-4000-8000-000000000001';
const PROMPT_ID = 'p1000000-0000-4000-8000-000000000001';

const basePrompt = {
  id: PROMPT_ID,
  tenantId: TENANT_ID,
  userId: USER_ID,
  category: 'medical',
  titleEn: 'Chart summary',
  titleAr: null,
  bodyEn: 'Summarize chart',
  bodyAr: null,
  favorite: false,
  roles: ['doctor'],
  version: 1,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPrisma = {
  aiPrompt: {
    count: jest.fn().mockResolvedValue(1),
    findMany: jest.fn().mockResolvedValue([basePrompt]),
    findFirst: jest.fn().mockResolvedValue(basePrompt),
    create: jest.fn().mockResolvedValue({ ...basePrompt, id: 'new-id', version: 1 }),
    update: jest.fn().mockResolvedValue({ ...basePrompt, favorite: true, version: 2 }),
    delete: jest.fn().mockResolvedValue(basePrompt),
    createMany: jest.fn(),
  },
  aiPromptVersion: {
    create: jest.fn().mockResolvedValue({ id: 'v1' }),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue({
      id: 'v1',
      promptId: PROMPT_ID,
      version: 1,
      category: 'medical',
      titleEn: 'Old title',
      titleAr: null,
      bodyEn: 'Old body',
      bodyAr: null,
      favorite: false,
      roles: [],
      createdAt: new Date('2026-01-01'),
      createdBy: USER_ID,
    }),
  },
};

const mockTenantContext = {
  resolve: jest.fn().mockResolvedValue({ tenantId: TENANT_ID }),
};

const mockSubscription = {
  enforceCustomPrompts: jest.fn().mockResolvedValue(undefined),
};

describe('AI prompt handlers', () => {
  let listHandler: ListAiPromptsHandler;
  let upsertHandler: UpsertAiPromptHandler;
  let toggleHandler: ToggleAiPromptFavoriteHandler;
  let deleteHandler: DeleteAiPromptHandler;
  let duplicateHandler: DuplicateAiPromptHandler;
  let restoreHandler: RestoreAiPromptVersionHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    listHandler = new ListAiPromptsHandler(
      mockPrisma as unknown as PrismaService,
      mockTenantContext as unknown as TenantContextService,
    );
    upsertHandler = new UpsertAiPromptHandler(
      mockPrisma as unknown as PrismaService,
      mockTenantContext as unknown as TenantContextService,
      mockSubscription as unknown as AiSubscriptionService,
    );
    toggleHandler = new ToggleAiPromptFavoriteHandler(
      mockPrisma as unknown as PrismaService,
      mockTenantContext as unknown as TenantContextService,
    );
    deleteHandler = new DeleteAiPromptHandler(
      mockPrisma as unknown as PrismaService,
      mockTenantContext as unknown as TenantContextService,
    );
    duplicateHandler = new DuplicateAiPromptHandler(
      mockPrisma as unknown as PrismaService,
      mockTenantContext as unknown as TenantContextService,
      upsertHandler,
    );
    restoreHandler = new RestoreAiPromptVersionHandler(
      mockPrisma as unknown as PrismaService,
      mockTenantContext as unknown as TenantContextService,
    );
  });

  it('lists prompts filtered by role', async () => {
    const rows = await listHandler.execute(USER_ID, ['doctor']);
    expect(rows).toHaveLength(1);
    expect(rows[0].promptId).toBe(PROMPT_ID);
  });

  it('hides prompts when role does not match', async () => {
    const rows = await listHandler.execute(USER_ID, ['cashier']);
    expect(rows).toHaveLength(0);
  });

  it('creates prompt after subscription check', async () => {
    const result = await upsertHandler.execute(USER_ID, ['doctor'], {
      category: 'medical',
      titleEn: 'New',
      bodyEn: 'Body',
    });
    expect(mockSubscription.enforceCustomPrompts).toHaveBeenCalledWith(TENANT_ID);
    expect(result.promptId).toBe('new-id');
  });

  it('snapshots version on update', async () => {
    await upsertHandler.execute(USER_ID, ['doctor'], {
      promptId: PROMPT_ID,
      category: 'medical',
      titleEn: 'Updated',
      bodyEn: 'Updated body',
    });
    expect(mockPrisma.aiPromptVersion.create).toHaveBeenCalled();
    expect(mockPrisma.aiPrompt.update).toHaveBeenCalled();
  });

  it('rejects update without permission', async () => {
    mockPrisma.aiPrompt.findFirst.mockResolvedValueOnce({ ...basePrompt, userId: 'other-user' });
    await expect(
      upsertHandler.execute(USER_ID, ['doctor'], {
        promptId: PROMPT_ID,
        category: 'medical',
        titleEn: 'Updated',
        bodyEn: 'Updated body',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('toggles favorite', async () => {
    const result = await toggleHandler.execute(USER_ID, ['doctor'], PROMPT_ID, true);
    expect(result.favorite).toBe(true);
  });

  it('deletes owned prompt', async () => {
    const result = await deleteHandler.execute(USER_ID, ['doctor'], PROMPT_ID);
    expect(result.ok).toBe(true);
  });

  it('rejects delete for tenant default by non-admin', async () => {
    mockPrisma.aiPrompt.findFirst.mockResolvedValueOnce({ ...basePrompt, userId: null });
    await expect(deleteHandler.execute(USER_ID, ['doctor'], PROMPT_ID)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('duplicates prompt', async () => {
    const result = await duplicateHandler.execute(USER_ID, ['doctor'], PROMPT_ID);
    expect(result.promptId).toBe('new-id');
  });

  it('restores a version snapshot', async () => {
    const result = await restoreHandler.execute(USER_ID, ['doctor'], PROMPT_ID, 'v1');
    expect(result.version).toBe(2);
    expect(mockPrisma.aiPromptVersion.create).toHaveBeenCalled();
  });

  it('throws when prompt missing', async () => {
    mockPrisma.aiPrompt.findFirst.mockResolvedValueOnce(null);
    await expect(toggleHandler.execute(USER_ID, ['doctor'], PROMPT_ID, true)).rejects.toThrow(
      NotFoundException,
    );
  });
});

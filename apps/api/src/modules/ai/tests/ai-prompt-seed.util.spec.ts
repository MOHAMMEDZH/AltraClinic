import { ensureTenantDefaultPrompts } from '../domain/utils/ai-prompt-seed.util';
import { AI_PROMPT_DEFAULTS } from '../domain/config/ai-prompt-defaults.config';

describe('ai-prompt-seed.util', () => {
  it('creates only missing tenant default prompts', async () => {
    const prisma = {
      aiPrompt: {
        findFirst: jest.fn().mockResolvedValueOnce({ id: 'existing' }).mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'new' }),
      },
    };

    const created = await ensureTenantDefaultPrompts(prisma as never, 'tenant-1');
    expect(created).toBe(AI_PROMPT_DEFAULTS.length - 1);
    expect(prisma.aiPrompt.create).toHaveBeenCalledTimes(AI_PROMPT_DEFAULTS.length - 1);
  });
});

import type { PrismaService } from '../../../../infrastructure/prisma.service';
import { AI_PROMPT_DEFAULTS } from '../config/ai-prompt-defaults.config';

export async function ensureTenantDefaultPrompts(
  prisma: Pick<PrismaService, 'aiPrompt'>,
  tenantId: string,
): Promise<number> {
  let created = 0;
  for (const seed of AI_PROMPT_DEFAULTS) {
    const exists = await prisma.aiPrompt.findFirst({
      where: {
        tenantId,
        userId: null,
        category: seed.category,
        titleEn: seed.titleEn,
      },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.aiPrompt.create({
      data: {
        tenantId,
        userId: null,
        category: seed.category,
        titleEn: seed.titleEn,
        titleAr: seed.titleAr,
        bodyEn: seed.bodyEn,
        bodyAr: seed.bodyAr,
        favorite: seed.favorite ?? false,
        roles: seed.roles ?? [],
      },
    });
    created += 1;
  }
  return created;
}

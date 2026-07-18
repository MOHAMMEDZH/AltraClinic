import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import {
  AI_INFERENCE_AUDIT_ACTION,
  AI_INFERENCE_AUDIT_RESOURCE,
} from '../../domain/config/ai-admin.config';
import type { AiInferenceResult } from './ai-inference.types';

@Injectable()
export class AiInferenceAuditService {
  private readonly logger = new Logger(AiInferenceAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logSuccess(
    tenantId: string,
    userId: string,
    conversationId: string,
    result: Pick<AiInferenceResult, 'provider' | 'model' | 'skillId' | 'tokenCount' | 'latencyMs'>,
  ): Promise<void> {
    const roles = await this.loadUserRoles(userId);
    try {
      await this.prisma.auditEntry.create({
        data: {
          tenantId,
          action: AI_INFERENCE_AUDIT_ACTION,
          resourceType: AI_INFERENCE_AUDIT_RESOURCE,
          resourceId: conversationId,
          actorId: userId,
          actorRoles: roles,
          category: 'ai',
          descriptionEn: `AI assistant response (${result.provider}${result.skillId ? `:${result.skillId}` : ''})`,
          descriptionAr: `استجابة المساعد الذكي (${result.provider}${result.skillId ? `:${result.skillId}` : ''})`,
          details: {
            provider: result.provider,
            model: result.model,
            skillId: result.skillId ?? '',
            tokenCount: String(result.tokenCount),
            latencyMs: String(result.latencyMs),
          } as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to write AI inference audit: ${String(err)}`);
    }
  }

  private async loadUserRoles(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRoleAssignment.findMany({
      where: { userId },
      select: { role: true },
    });
    return rows.map((r) => r.role);
  }
}

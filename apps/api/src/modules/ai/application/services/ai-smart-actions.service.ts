import { Injectable } from '@nestjs/common';
import {
  resolveSmartActions,
  workspaceFeatureToId,
  type AiSmartActionContext,
} from '../../domain/config/ai-smart-actions.config';
import { AiSubscriptionService } from './ai-subscription.service';

export interface AiSmartActionDto {
  id: string;
  labelKey: string;
  prompt: string;
  workspaceId: string | null;
}

@Injectable()
export class AiSmartActionsService {
  constructor(private readonly subscription: AiSubscriptionService) {}

  async listForContext(
    tenantId: string,
    userId: string,
    ctx: AiSmartActionContext,
    locale?: string,
  ): Promise<{ actions: AiSmartActionDto[] }> {
    const snapshot = await this.subscription.getLimits(tenantId, userId);
    const useAr = locale?.toLowerCase().startsWith('ar') ?? false;
    const allowedWorkspaces = snapshot.limits.workspaces;

    const actions = resolveSmartActions(ctx)
      .filter((action) => {
        if (allowedWorkspaces === 'all') return true;
        return allowedWorkspaces.includes(action.workspace);
      })
      .map((action) => ({
        id: action.id,
        labelKey: action.labelKey,
        prompt: useAr ? action.promptAr : action.promptEn,
        workspaceId: workspaceFeatureToId(action.workspace),
      }));

    return { actions };
  }
}

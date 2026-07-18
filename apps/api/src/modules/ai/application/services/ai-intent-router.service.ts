import { Injectable } from '@nestjs/common';
import type { AiPlanLimits } from '../../domain/config/ai-plan-limits.config';
import type { AiSmartActionContext } from '../../domain/config/ai-smart-actions.config';
import {
  resolveSkillRoute,
  type AiSkillId,
} from '../../domain/config/ai-skill-registry.config';

export interface AiIntentRouteResult {
  skillId: AiSkillId;
  score: number;
}

@Injectable()
export class AiIntentRouterService {
  route(
    query: string,
    context?: Record<string, unknown> | null,
    locale?: string,
    allowedWorkspaces: AiPlanLimits['workspaces'] = 'all',
  ): AiIntentRouteResult | null {
    const ctx = this.toActionContext(context);
    const forcedSkillId =
      typeof context?.forceSkillId === 'string' ? context.forceSkillId : null;
    return resolveSkillRoute(query, ctx, locale, allowedWorkspaces, forcedSkillId);
  }

  private toActionContext(context?: Record<string, unknown> | null): AiSmartActionContext {
    const ctx = context ?? {};
    const pick = (key: keyof AiSmartActionContext) => {
      const value = ctx[key];
      return typeof value === 'string' && value.trim() ? value : undefined;
    };

    return {
      path: pick('path'),
      patientId: pick('patientId'),
      encounterId: pick('encounterId'),
      invoiceId: pick('invoiceId'),
      workflowId: pick('workflowId'),
      appointmentId: pick('appointmentId'),
      inventoryItemId: pick('inventoryItemId'),
      reportId: pick('reportId'),
      analyticsDomain: pick('analyticsDomain'),
      module: pick('module'),
    };
  }
}

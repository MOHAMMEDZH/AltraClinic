import { Injectable } from '@nestjs/common';
import {
  AI_COMMAND_REGISTRY,
  contextSatisfied,
  scoreCommandDef,
  scoreCommandPhrase,
  type AiCommandKind,
} from '../../domain/config/ai-command-registry.config';
import {
  AI_SMART_ACTION_CATALOG,
  workspaceFeatureToId,
  type AiSmartActionContext,
} from '../../domain/config/ai-smart-actions.config';
import { AiSubscriptionService } from './ai-subscription.service';
import { AiSmartActionsService, type AiSmartActionDto } from './ai-smart-actions.service';
import {
  skillPrimaryPhrase,
} from '../../domain/config/ai-skill-registry.config';

export interface AiCommandResolveItemDto {
  id: string;
  kind: AiCommandKind;
  labelKey: string;
  score: number;
  disabled: boolean;
  disabledReasonKey?: string;
  path?: string;
  prompt?: string;
  workspaceId: string | null;
  skillId?: string;
}

@Injectable()
export class AiCommandResolverService {
  constructor(
    private readonly subscription: AiSubscriptionService,
    private readonly smartActions: AiSmartActionsService,
  ) {}

  async resolve(
    tenantId: string,
    userId: string,
    query: string,
    ctx: AiSmartActionContext,
    locale?: string,
  ): Promise<{ items: AiCommandResolveItemDto[] }> {
    const snapshot = await this.subscription.getLimits(tenantId, userId);
    const useAr = locale?.toLowerCase().startsWith('ar') ?? false;
    const allowedWorkspaces = snapshot.limits.workspaces;
    const trimmed = query.trim();

    const { actions: contextualActions } = await this.smartActions.listForContext(
      tenantId,
      userId,
      ctx,
      locale,
    );

    const catalogById = new Map(AI_SMART_ACTION_CATALOG.map((action) => [action.id, action]));

    const workspaceAllowed = (workspace?: string) => {
      if (!workspace) return true;
      if (allowedWorkspaces === 'all') return true;
      return allowedWorkspaces.includes(workspace as never);
    };

    const resolvePrompt = (
      smartActionId?: string,
      askEn?: string,
      askAr?: string,
      skillId?: string,
    ) => {
      if (skillId) {
        return skillPrimaryPhrase(skillId as never, useAr);
      }
      if (smartActionId) {
        const action = catalogById.get(smartActionId);
        if (action) return useAr ? action.promptAr : action.promptEn;
      }
      if (askEn || askAr) return useAr ? (askAr ?? askEn ?? '') : (askEn ?? askAr ?? '');
      return undefined;
    };

    const resolveWorkspaceId = (smartActionId?: string, workspace?: string) => {
      if (smartActionId) {
        const action = catalogById.get(smartActionId);
        if (action) return workspaceFeatureToId(action.workspace);
      }
      if (workspace) return workspaceFeatureToId(workspace as never);
      return null;
    };

    const buildRegistryItem = (
      def: (typeof AI_COMMAND_REGISTRY)[number],
      score: number,
    ): AiCommandResolveItemDto => {
      const hasContext = contextSatisfied(ctx, def.requiresContext);
      const wsAllowed = workspaceAllowed(def.workspace);
      const disabled = !hasContext || !wsAllowed;

      let disabledReasonKey: string | undefined;
      if (!hasContext) disabledReasonKey = 'ai.command.needsContext';
      else if (!wsAllowed) disabledReasonKey = 'ai.command.planLocked';

      return {
        id: def.id,
        kind: def.kind,
        labelKey: def.labelKey,
        score,
        disabled,
        disabledReasonKey,
        path: def.path,
        prompt: resolvePrompt(def.smartActionId, def.askPromptEn, def.askPromptAr, def.skillId),
        workspaceId: resolveWorkspaceId(def.smartActionId, def.workspace),
        skillId: def.skillId,
      };
    };

    const buildSmartActionItem = (action: AiSmartActionDto, score: number): AiCommandResolveItemDto => ({
      id: `smart-${action.id}`,
      kind: 'action',
      labelKey: action.labelKey,
      score,
      disabled: false,
      prompt: action.prompt,
      workspaceId: action.workspaceId,
    });

    const scoreSmartAction = (action: AiSmartActionDto): number => {
      if (!trimmed) return 180;
      const q = trimmed.toLowerCase();
      const prompt = action.prompt.toLowerCase();
      const idPhrase = action.id.replace(/-/g, ' ');
      if (prompt.includes(q)) return 90;
      return Math.max(scoreCommandPhrase(q, idPhrase), scoreCommandPhrase(q, action.labelKey.split('.').pop() ?? ''));
    };

    const contextualItems = contextualActions
      .map((action, index) => {
        const matchScore = scoreSmartAction(action) + (trimmed ? 0 : index * -1);
        return { action, matchScore };
      })
      .filter((entry) => !trimmed || entry.matchScore >= 40)
      .map((entry, index) => buildSmartActionItem(entry.action, entry.matchScore - index * 0.01));

    let registryItems: AiCommandResolveItemDto[];

    if (!trimmed) {
      registryItems = AI_COMMAND_REGISTRY.map((def) => buildRegistryItem(def, def.priority))
        .filter((item) => !item.disabled)
        .sort((a, b) => b.score - a.score);
    } else {
      registryItems = AI_COMMAND_REGISTRY.map((def) => ({
        def,
        score: scoreCommandDef(trimmed, def, useAr),
      }))
        .filter((entry) => entry.score >= 40)
        .sort((a, b) => b.score - a.score)
        .map((entry) => buildRegistryItem(entry.def, entry.score));
    }

    const contextualIds = new Set(contextualActions.map((a) => a.id));
    registryItems = registryItems.filter((item) => {
      const def = AI_COMMAND_REGISTRY.find((d) => d.id === item.id);
      if (!def?.smartActionId) return true;
      return !contextualIds.has(def.smartActionId);
    });

    const merged = [...contextualItems, ...registryItems]
      .sort((a, b) => b.score - a.score)
      .slice(0, trimmed ? 12 : 14);

    return { items: merged };
  }
}

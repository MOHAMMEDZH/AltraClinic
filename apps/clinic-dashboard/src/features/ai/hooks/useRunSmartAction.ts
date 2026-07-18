import { useCallback } from 'react';

import { useNavigate } from 'react-router-dom';

import { useI18n } from '@booking/i18n/react';

import type { AiSmartActionDto } from '../api/ai-api';

import { AI_CHAT_AUTO_INFER_STATE } from '../lib/ai-navigation';

import { serializeAiRouteContext } from '../lib/ai-context-params';

import { useCreateAiConversation } from './useAiChat';

import { useAiRouteContext } from './useAiContext';



export type RunAiPromptOptions = {

  title?: string;

  workspaceId?: string | null;

  skillId?: string;

};



export function useRunSmartAction() {

  const { t } = useI18n();

  const navigate = useNavigate();

  const context = useAiRouteContext();

  const createMutation = useCreateAiConversation();



  const runAction = useCallback(

    async (

      action: Pick<AiSmartActionDto, 'labelKey' | 'prompt' | 'workspaceId'> & { skillId?: string },

    ) => {

      try {

        const conv = await createMutation.mutateAsync({

          context: {

            ...serializeAiRouteContext(context),

            ...(action.skillId ? { forceSkillId: action.skillId } : {}),

          },

          workspaceId: action.workspaceId ?? undefined,

          title: t(action.labelKey),

          initialMessage: action.prompt,

        });

        navigate(`/ai/chat/${conv.conversationId}`, { state: AI_CHAT_AUTO_INFER_STATE });

        return conv;

      } catch (err) {

        console.error('[AI] Failed to start smart action', err);

        throw err;

      }

    },

    [context, createMutation, navigate, t],

  );



  const runPrompt = useCallback(

    async (prompt: string, options?: RunAiPromptOptions) => {

      try {

        const conv = await createMutation.mutateAsync({

          context: {

            ...serializeAiRouteContext(context),

            ...(options?.skillId ? { forceSkillId: options.skillId } : {}),

          },

          workspaceId: options?.workspaceId ?? undefined,

          title: options?.title ?? prompt.slice(0, 60),

          initialMessage: prompt,

        });

        navigate(`/ai/chat/${conv.conversationId}`, { state: AI_CHAT_AUTO_INFER_STATE });

        return conv;

      } catch (err) {

        console.error('[AI] Failed to start prompt chat', err);

        throw err;

      }

    },

    [context, createMutation, navigate],

  );



  return {

    runAction,

    runPrompt,

    isPending: createMutation.isPending,

    error: createMutation.error,

  };

}


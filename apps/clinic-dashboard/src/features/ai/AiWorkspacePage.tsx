import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AI_WORKSPACES } from './config/ai-workspaces';
import { aiWorkspaceFeature } from './config/ai-subscription';
import { useAiRouteContext } from './hooks/useAiContext';
import { useAiSubscription } from './hooks/useAiSubscription';
import { useCreateAiConversation } from './hooks/useAiChat';
import { useAiPrompts } from './hooks/useAiPrompts';
import { AI_CHAT_AUTO_INFER_STATE } from './lib/ai-navigation';
import { mapWorkspaceToPromptCategory, pickLibraryPrompts, resolvePromptText } from './lib/ai-prompt-library';
import { AiSection } from './components/enterprise/AiSection';
import { AiChatThread } from './components/chat/AiChatThread';
import { AiPromptChipBar } from './components/prompts/AiPromptChipBar';
import e from './ai-enterprise.module.css';

export function AiWorkspacePage() {
  const { workspaceId } = useParams();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const context = useAiRouteContext();
  const { canUse, attachmentsEnabled } = useAiSubscription();
  const createMutation = useCreateAiConversation();
  const promptCategory = workspaceId ? mapWorkspaceToPromptCategory(workspaceId) : undefined;
  const promptsQuery = useAiPrompts(promptCategory);

  const workspace = useMemo(() => AI_WORKSPACES.find((w) => w.id === workspaceId), [workspaceId]);
  const feature = workspace ? aiWorkspaceFeature(workspace.id) : 'chat';
  const locked = !canUse(feature);

  if (!workspace) {
    return <AuthAlert variant="error">{t('ai.workspaces.notFound')}</AuthAlert>;
  }

  if (locked) {
    return <AuthAlert variant="warning">{t('ai.subscription.upgrade')}</AuthAlert>;
  }

  const librarySuggestions = pickLibraryPrompts(promptsQuery.data ?? [], {
    category: promptCategory,
    limit: 6,
  }).map((prompt) => resolvePromptText(prompt, locale).body);

  const fallbackSuggestions = workspace.promptKeys.map((key) => t(key));
  const suggestions = librarySuggestions.length > 0 ? librarySuggestions : fallbackSuggestions;

  const startWithPrompt = (prompt: string) => {
    void createMutation
      .mutateAsync({ workspaceId: workspace.id, context, title: t(workspace.labelKey), initialMessage: prompt })
      .then((conv) => {
        navigate(`/ai/chat/${conv.conversationId}`, { state: AI_CHAT_AUTO_INFER_STATE });
      });
  };

  return (
    <>
      <header className={e.pageHeader}>
        <div>
          <h2 className={e.pageTitle}>{t(workspace.labelKey)}</h2>
          <p className={e.pageSubtitle}>{t(workspace.subtitleKey)}</p>
        </div>
      </header>

      <AiSection title={t('ai.workspaces.prompts')} hint={t('ai.workspaces.promptsHint')}>
        <AiPromptChipBar
          category={promptCategory}
          limit={6}
          fallbackKeys={workspace.promptKeys}
          onRun={(body) => startWithPrompt(body)}
        />
      </AiSection>

      <AiSection title={t('ai.nav.chat')} flush>
        <div className={e.sectionBody}>
          <AiChatThread
            conversation={null}
            suggestions={suggestions}
            attachmentsEnabled={attachmentsEnabled}
            onSend={(text) => startWithPrompt(text)}
          />
        </div>
      </AiSection>
    </>
  );
}

import { useI18n } from '@booking/i18n/react';
import type { AiConversationDto } from '../../api/ai-api';
import { AiChatMessage } from './AiChatMessage';
import { AiChatComposer } from './AiChatComposer';
import e from '../../ai-enterprise.module.css';

interface AiChatThreadProps {
  conversation: AiConversationDto | null | undefined;
  loading?: boolean;
  streaming?: boolean;
  suggestions?: string[];
  voiceEnabled?: boolean;
  attachmentsEnabled?: boolean;
  quotaMessage?: string | null;
  disabled?: boolean;
  onSend: (text: string, attachments?: Array<{ name: string; mimeType: string; dataUrl?: string }>) => void;
  onStop?: () => void;
  header?: React.ReactNode;
}

export function AiChatThread({
  conversation,
  loading,
  streaming,
  suggestions,
  voiceEnabled,
  attachmentsEnabled = true,
  quotaMessage,
  disabled = false,
  onSend,
  onStop,
  header,
}: AiChatThreadProps) {
  const { t } = useI18n();
  const messages = conversation?.messages ?? [];
  const isStreaming = Boolean(streaming || messages.some((m) => (m as { streaming?: boolean }).streaming));

  return (
    <div className={e.chatPanel} aria-busy={loading || isStreaming}>
      <div className={e.chatHeader}>
        <div>
          <p className={e.sectionTitle}>{conversation?.title ?? (loading ? t('ai.a11y.loading') : '…')}</p>
          {conversation?.workspaceId && <p className={e.sectionHint}>{conversation.workspaceId}</p>}
        </div>
        {header}
      </div>
      <div className={e.chatThread} role="log" aria-live="polite" aria-relevant="additions text" aria-busy={isStreaming}>
        {quotaMessage && (
          <p className={e.sectionHint} role="alert">
            {quotaMessage}
          </p>
        )}
        {loading && messages.length === 0 ? (
          <p className={e.pageSubtitle} role="status" aria-busy="true">
            {t('ai.a11y.loading')}
          </p>
        ) : messages.length === 0 ? (
          <p className={e.pageSubtitle}>{t('ai.chat.emptyThread')}</p>
        ) : (
          messages.map((m) => <AiChatMessage key={m.messageId} message={m} />)
        )}
      </div>
      <AiChatComposer
        disabled={disabled || loading}
        loading={loading && !isStreaming}
        streaming={isStreaming}
        suggestions={suggestions}
        voiceEnabled={voiceEnabled}
        attachmentsEnabled={attachmentsEnabled}
        onSend={onSend}
        onStop={onStop}
      />
    </div>
  );
}

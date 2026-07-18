import { Bot, User } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import type { AiMessageDto } from '../../api/ai-api';
import { AiMarkdown } from './AiMarkdown';
import e from '../../ai-enterprise.module.css';

type Citation = { label: string; resourceType?: string; resourceId?: string };

export function AiChatMessage({ message }: { message: AiMessageDto & { streaming?: boolean } }) {
  const { t } = useI18n();
  const isUser = message.role === 'user';
  const citations = Array.isArray(message.citations) ? (message.citations as Citation[]) : [];
  const label = isUser ? t('ai.a11y.messageUser') : t('ai.a11y.messageAssistant');

  return (
    <article
      className={[e.messageRow, isUser ? e.messageRowUser : e.messageRowAssistant].filter(Boolean).join(' ')}
      aria-label={label}
      aria-busy={message.streaming || undefined}
    >
      {!isUser && (
        <div className={e.messageAvatar} aria-hidden>
          <Bot size={16} />
        </div>
      )}
      <div
        className={[
          e.messageBubble,
          isUser ? e.messageUser : e.messageAssistant,
          message.streaming ? e.messageStreaming : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {isUser ? (
          <p className={e.messageUserText}>{message.content}</p>
        ) : (
          <AiMarkdown content={message.content || '…'} />
        )}
        {!isUser && citations.length > 0 && (
          <div className={e.mdCitations} role="list" aria-label={t('ai.chat.citations')}>
            {citations.map((c, i) => (
              <span key={`${c.resourceId ?? c.label}-${i}`} className={e.mdCitation} role="listitem">
                {c.label}
              </span>
            ))}
          </div>
        )}
        {message.streaming ? <span className={e.srOnly}>{t('ai.a11y.streaming')}</span> : null}
      </div>
      {isUser && (
        <div className={[e.messageAvatar, e.messageAvatarUser].join(' ')} aria-hidden>
          <User size={16} />
        </div>
      )}
    </article>
  );
}

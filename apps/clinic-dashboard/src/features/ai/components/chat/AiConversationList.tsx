import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FixedSizeList as VirtualList, type ListChildComponentProps } from 'react-window';
import { Pin, Trash2 } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import {
  useAiConversations,
  useDeleteAiConversation,
  useTogglePinAiConversation,
} from '../../hooks/useAiChat';
import type { AiConversationDto } from '../../api/ai-api';
import { AI_CONVERSATION_VIRTUAL_THRESHOLD } from '../../lib/ai-types';
import e from '../../ai-enterprise.module.css';

const ITEM_HEIGHT = 76;

function ConversationRow({
  conv,
  activeId,
  locale,
  t,
  conversationIndex,
  tabIndex,
  onOpen,
  onPin,
  onDelete,
}: {
  conv: AiConversationDto;
  activeId?: string;
  locale: string;
  t: (key: string) => string;
  conversationIndex: number;
  tabIndex: number;
  onOpen: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  return (
    <div role="listitem" style={{ display: 'grid', gap: 4, padding: '0 4px 8px' }}>
      <button
        type="button"
        className={[e.conversationItem, activeId === conv.conversationId ? e.conversationItemActive : '']
          .filter(Boolean)
          .join(' ')}
        data-conversation-index={conversationIndex}
        tabIndex={tabIndex}
        onClick={onOpen}
        aria-current={activeId === conv.conversationId ? 'true' : undefined}
      >
        <p className={e.conversationTitle}>
          {conv.pinned ? <span className={e.srOnly}>{t('ai.chat.pin')}</span> : null}
          {conv.pinned ? '📌 ' : ''}
          {conv.title}
        </p>
        <p className={e.conversationMeta}>
          {new Date(conv.updatedAt).toLocaleString(locale)} · {conv.messages.length} {t('ai.chat.messages')}
        </p>
      </button>
      <div className={e.pageActions}>
        <button type="button" className={e.promptChip} onClick={onPin} aria-label={t('ai.chat.pin')}>
          <Pin size={12} aria-hidden />
        </button>
        <button type="button" className={e.promptChip} onClick={onDelete} aria-label={t('ai.chat.delete')}>
          <Trash2 size={12} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function useConversationListKeyboard(items: AiConversationDto[], activeId?: string) {
  const listRef = useRef<HTMLDivElement>(null);
  const virtualListRef = useRef<VirtualList>(null);
  const [focusIndex, setFocusIndex] = useState(0);

  useEffect(() => {
    if (items.length === 0) return;
    const activeIndex = activeId ? items.findIndex((c) => c.conversationId === activeId) : -1;
    setFocusIndex(activeIndex >= 0 ? activeIndex : 0);
  }, [activeId, items]);

  useEffect(() => {
    if (items.length >= AI_CONVERSATION_VIRTUAL_THRESHOLD) {
      virtualListRef.current?.scrollToItem(focusIndex, 'smart');
    }
  }, [focusIndex, items.length]);

  const onListKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (items.length === 0) return;
      let nextIndex: number | null = null;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        nextIndex = Math.min(focusIndex + 1, items.length - 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        nextIndex = Math.max(focusIndex - 1, 0);
      } else if (event.key === 'Home') {
        event.preventDefault();
        nextIndex = 0;
      } else if (event.key === 'End') {
        event.preventDefault();
        nextIndex = items.length - 1;
      }
      if (nextIndex === null || nextIndex === focusIndex) return;
      setFocusIndex(nextIndex);
      requestAnimationFrame(() => {
        listRef.current
          ?.querySelector<HTMLButtonElement>(`button[data-conversation-index="${nextIndex}"]`)
          ?.focus();
      });
    },
    [focusIndex, items.length],
  );

  return { listRef, virtualListRef, focusIndex, onListKeyDown };
}

export function AiConversationList({ activeId, search }: { activeId?: string; search?: string }) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const listQuery = useAiConversations(search);
  const deleteMutation = useDeleteAiConversation();
  const pinMutation = useTogglePinAiConversation();
  const items = listQuery.data ?? [];
  const { listRef, virtualListRef, focusIndex, onListKeyDown } = useConversationListKeyboard(items, activeId);

  if (listQuery.isLoading) {
    return (
      <p className={e.pageSubtitle} role="status" aria-busy="true">
        {t('ai.a11y.loading')}
      </p>
    );
  }

  const renderRow = (conv: AiConversationDto, index: number) => (
    <ConversationRow
      conv={conv}
      activeId={activeId}
      locale={locale}
      t={t}
      conversationIndex={index}
      tabIndex={index === focusIndex ? 0 : -1}
      onOpen={() => navigate(`/ai/chat/${conv.conversationId}`)}
      onPin={() => void pinMutation.mutateAsync({ id: conv.conversationId, pinned: !conv.pinned })}
      onDelete={() => void deleteMutation.mutateAsync(conv.conversationId)}
    />
  );

  if (items.length >= AI_CONVERSATION_VIRTUAL_THRESHOLD) {
    const VirtualRow = ({ index, style }: ListChildComponentProps) => {
      const conv = items[index];
      return <div style={style}>{renderRow(conv, index)}</div>;
    };

    return (
      <div
        ref={listRef}
        className={e.conversationList}
        role="list"
        aria-label={t('ai.chat.history')}
        onKeyDown={onListKeyDown}
      >
        <VirtualList
          ref={virtualListRef}
          height={480}
          width="100%"
          itemCount={items.length}
          itemSize={ITEM_HEIGHT}
        >
          {VirtualRow}
        </VirtualList>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className={e.conversationList}
      role="list"
      aria-label={t('ai.chat.history')}
      onKeyDown={onListKeyDown}
    >
      {items.map((conv, index) => (
        <div key={conv.conversationId}>{renderRow(conv, index)}</div>
      ))}
    </div>
  );
}

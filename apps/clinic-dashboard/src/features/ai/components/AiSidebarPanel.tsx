import { useRef } from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { useSmartAiActions } from '../hooks/useSmartActions';
import { useRunSmartAction } from '../hooks/useRunSmartAction';
import { useAiConversations } from '../hooks/useAiChat';
import { useAiPromptFavorites } from '../hooks/useAiPrompts';
import { useEscapeKey, useFocusTrap, useRestoreFocus } from '../lib/ai-a11y';
import { AiSidebarContext } from './AiSidebarContext';
import e from '../ai-enterprise.module.css';

interface AiSidebarPanelProps {
  open: boolean;
  onClose: () => void;
  onOpenCommand: () => void;
}

export function AiSidebarPanel({ open, onClose, onOpenCommand }: AiSidebarPanelProps) {
  const { t, locale } = useI18n();
  const panelRef = useRef<HTMLElement>(null);
  const { actions } = useSmartAiActions(open);
  const { runAction, runPrompt } = useRunSmartAction();
  const conversations = useAiConversations();
  const favoritePrompts = useAiPromptFavorites(open);
  const recent = (conversations.data ?? []).slice(0, 5);
  const favorites = (favoritePrompts.data ?? []).slice(0, 6);

  useRestoreFocus(open);
  useFocusTrap(panelRef, open);
  useEscapeKey(open, onClose);

  const startContextChat = () => {
    void runPrompt(t('ai.sidebar.contextPrompt'), {
      title: t('ai.sidebar.contextChatTitle'),
    }).then(() => onClose());
  };

  return (
    <>
      {open && (
        <button
          type="button"
          className={e.commandOverlay}
          aria-label={t('ai.sidebar.close')}
          onClick={onClose}
          style={{ background: 'color-mix(in srgb, var(--color-text) 30%, transparent)' }}
        />
      )}
      <aside
        ref={panelRef}
        id="ai-sidebar-panel"
        className={[e.sidebarPanel, open ? e.sidebarPanelOpen : e.sidebarPanelClosed].filter(Boolean).join(' ')}
        aria-hidden={!open}
        aria-label={t('ai.sidebar.title')}
        {...(!open ? { inert: true } : {})}
      >
        <header className={e.sidebarHeader}>
          <strong>{t('ai.sidebar.title')}</strong>
          <button type="button" className={e.promptChip} onClick={onClose} aria-label={t('ai.sidebar.close')}>
            <X size={16} aria-hidden />
          </button>
        </header>
        <div className={e.sidebarBody}>
          <div>
            <p className={e.sectionHint}>{t('ai.sidebar.activeContext')}</p>
            {open ? <AiSidebarContext /> : null}
          </div>

          <AuthButton variant="primary" onClick={startContextChat}>
            {t('ai.sidebar.contextChat')}
          </AuthButton>

          <div>
            <p className={e.sectionHint} id="ai-sidebar-suggested-label">
              {t('ai.sidebar.suggested')}
            </p>
            <div className={e.promptChips} role="group" aria-labelledby="ai-sidebar-suggested-label">
              {actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={e.promptChip}
                  aria-label={t(action.labelKey as never)}
                  onClick={() => {
                    void runAction(action).then(() => onClose());
                  }}
                >
                  {t(action.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {favorites.length > 0 && (
            <div>
              <p className={e.sectionHint} id="ai-sidebar-favorites-label">
                {t('ai.sidebar.favoritePrompts')}
              </p>
              <div className={e.promptChips} role="group" aria-labelledby="ai-sidebar-favorites-label">
                {favorites.map((prompt) => {
                  const title =
                    locale.startsWith('ar') && prompt.titleAr ? prompt.titleAr : prompt.titleEn;
                  const body =
                    locale.startsWith('ar') && prompt.bodyAr ? prompt.bodyAr : prompt.bodyEn;
                  return (
                    <button
                      key={prompt.promptId}
                      type="button"
                      className={e.promptChip}
                      aria-label={title}
                      onClick={() => {
                        void runPrompt(body, { title }).then(() => onClose());
                      }}
                    >
                      {title}
                    </button>
                  );
                })}
              </div>
              <Link to="/ai/prompts" className={e.sectionHint} onClick={onClose}>
                {t('ai.nav.prompts')}
              </Link>
            </div>
          )}

          <AuthButton
            variant="secondary"
            onClick={() => {
              onOpenCommand();
              onClose();
            }}
          >
            {t('ai.command.title')}
          </AuthButton>

          <div>
            <p className={e.sectionHint}>{t('ai.sidebar.recent')}</p>
            {conversations.isLoading ? (
              <p className={e.sectionHint} role="status" aria-busy="true">
                {t('ai.a11y.loading')}
              </p>
            ) : null}
            {recent.map((c) => (
              <Link
                key={c.conversationId}
                to={`/ai/chat/${c.conversationId}`}
                className={e.conversationItem}
                onClick={onClose}
              >
                <p className={e.conversationTitle}>{c.title}</p>
              </Link>
            ))}
          </div>

          <Link to="/ai" className={e.workspaceCard} onClick={onClose}>
            {t('ai.sidebar.openDashboard')}
          </Link>
        </div>
      </aside>
    </>
  );
}

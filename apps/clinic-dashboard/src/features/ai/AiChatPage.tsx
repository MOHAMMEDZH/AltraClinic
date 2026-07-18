import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { Download, Pencil } from 'lucide-react';

import { useI18n } from '@booking/i18n/react';

import { AuthButton } from '@/features/auth/components/AuthButton';

import { AuthFormField } from '@/features/auth/components/AuthFormField';

import { ApiError } from '@/lib/api-client';

import { useAiRouteContext } from './hooks/useAiContext';

import { useAiSettingsQuery } from './hooks/useAiPrompts';

import { useAiSubscription } from './hooks/useAiSubscription';

import {

  useAiConversation,

  useCreateAiConversation,

  useExportAiConversation,

  useRenameAiConversation,

  useSendAiMessage,

} from './hooks/useAiChat';

import { serializeAiRouteContext } from './lib/ai-context-params';

import type { AiMessageDto } from './api/ai-api';

import type { AiChatLocationState } from './lib/ai-navigation';
import { AI_CHAT_AUTO_INFER_STATE } from './lib/ai-navigation';

import { AiConversationList } from './components/chat/AiConversationList';

import { AiChatThread } from './components/chat/AiChatThread';

import { AiSection } from './components/enterprise/AiSection';

import { AiModal } from './components/enterprise/AiModal';

import e from './ai-enterprise.module.css';



export function AiChatPage() {

  const { t, locale } = useI18n();

  const { conversationId } = useParams();

  const navigate = useNavigate();

  const location = useLocation();

  const context = useAiRouteContext();

  const [search, setSearch] = useState('');

  const [streamDraft, setStreamDraft] = useState<string | null>(null);

  const [sendError, setSendError] = useState<string | null>(null);

  const [renameOpen, setRenameOpen] = useState(false);

  const [renameTitle, setRenameTitle] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const autoInferDone = useRef(new Set<string>());

  const { attachmentsEnabled, limits, quotaExceeded } = useAiSubscription();

  const settingsQuery = useAiSettingsQuery();

  const streamingEnabled = (settingsQuery.data?.streaming as boolean | undefined) !== false;

  const voiceEnabled = Boolean(settingsQuery.data?.voiceReady);

  const createMutation = useCreateAiConversation();

  const sendMutation = useSendAiMessage();

  const renameMutation = useRenameAiConversation();

  const exportMutation = useExportAiConversation();

  const convQuery = useAiConversation(conversationId);



  const isStreaming = streamDraft !== null;



  const suggestions = useMemo(

    () => [t('ai.prompts.medical.summary'), t('ai.prompts.reporting.revenue'), t('ai.prompts.analytics.explainKpi')],

    [t],

  );



  const displayConversation = useMemo(() => {

    const base = convQuery.data;

    if (!base || !streamDraft) return base;

    const streamingMessage: AiMessageDto & { streaming?: boolean } = {

      messageId: 'streaming',

      role: 'assistant',

      content: streamDraft,

      createdAt: new Date().toISOString(),

      streaming: true,

    };

    return { ...base, messages: [...base.messages, streamingMessage] };

  }, [convQuery.data, streamDraft]);



  const quotaMessage = useMemo(() => {

    if (sendError) return sendError;

    if (createMutation.isError) {
      const err = createMutation.error;
      if (err instanceof ApiError) return err.message;
      if (err instanceof Error) return err.message;
    }

    if (convQuery.isError) return t('ai.a11y.loadError');

    if (quotaExceeded && limits) {

      return `${t('ai.subscription.quotaExceeded')} (${limits.messagesToday}/${limits.limits.maxMessagesPerUserPerDay})`;

    }

    return null;

  }, [sendError, createMutation.isError, createMutation.error, convQuery.isError, quotaExceeded, limits, t]);



  const startNewConversation = useCallback(
    async (text: string) => {
      const conv = await createMutation.mutateAsync({
        context: serializeAiRouteContext(context),
        title: text.slice(0, 48) || t('ai.chat.new'),
        initialMessage: text,
      });
      navigate(`/ai/chat/${conv.conversationId}`, { replace: true, state: AI_CHAT_AUTO_INFER_STATE });
      return conv.conversationId;
    },
    [context, createMutation, navigate, t],
  );



  const stopStreaming = useCallback(() => {

    abortRef.current?.abort();

    abortRef.current = null;

    setStreamDraft(null);

  }, []);



  const runInference = useCallback(

    async (id: string, content: string, attachments?: Array<{ name: string; mimeType: string; dataUrl?: string }>) => {

      if (quotaExceeded) return;

      abortRef.current?.abort();

      const controller = new AbortController();

      abortRef.current = controller;

      setSendError(null);

      setStreamDraft(streamingEnabled ? '' : null);

      const liveContext = { ...serializeAiRouteContext(context), locale };

      try {

        await sendMutation.mutateAsync({

          conversationId: id,

          content,

          attachments,

          context: liveContext,

          stream: streamingEnabled,

          onStreamChunk: streamingEnabled ? setStreamDraft : undefined,

          signal: controller.signal,

        });

      } catch (err) {

        if (err instanceof DOMException && err.name === 'AbortError') return;

        if (err instanceof ApiError) {

          const body = err.body as { upgradeRequired?: boolean; message?: string } | undefined;

          setSendError(body?.upgradeRequired ? t('ai.subscription.upgrade') : err.message);

        } else if (err instanceof Error) {

          setSendError(err.message);

        }

      } finally {

        if (abortRef.current === controller) abortRef.current = null;

        setStreamDraft(null);

      }

    },

    [context, locale, quotaExceeded, sendMutation, streamingEnabled, t],

  );



  useEffect(() => {

    return () => abortRef.current?.abort();

  }, []);



  useEffect(() => {
    const state = location.state as AiChatLocationState | null;
    if (!state?.autoInfer || !conversationId || !convQuery.data || quotaExceeded) {
      return;
    }
    if (autoInferDone.current.has(conversationId)) {
      return;
    }

    const messages = convQuery.data.messages;
    const pending = messages.length === 1 && messages[0]?.role === 'user' && messages[0].content.trim();
    if (!pending) return;

    autoInferDone.current.add(conversationId);
    navigate(location.pathname, { replace: true, state: null });
    void runInference(conversationId, messages[0].content);
  }, [conversationId, convQuery.data, location.pathname, location.state, navigate, quotaExceeded, runInference]);



  return (

    <>

      <AiSection title={t('ai.nav.chat')} hint={t('ai.chat.subtitle')} flush>

        <div className={e.chatLayout}>

          <div className={e.sectionBody}>

            <input

              className={e.input}

              value={search}

              onChange={(ev) => setSearch(ev.target.value)}

              placeholder={t('ai.chat.search')}

              aria-label={t('ai.chat.search')}

            />

            <AiConversationList activeId={conversationId} search={search} />

          </div>

          <AiChatThread

            conversation={displayConversation ?? undefined}

            loading={sendMutation.isPending && !isStreaming}

            streaming={isStreaming}

            suggestions={suggestions}

            voiceEnabled={voiceEnabled}

            attachmentsEnabled={attachmentsEnabled}

            quotaMessage={quotaMessage}

            disabled={quotaExceeded}

            onStop={stopStreaming}

            header={

              conversationId ? (

                <div className={e.pageActions}>

                  <AuthButton

                    variant="secondary"

                    aria-label={t('ai.chat.rename')}

                    onClick={() => {

                      setRenameTitle(convQuery.data?.title ?? '');

                      setRenameOpen(true);

                    }}

                  >

                    <Pencil size={14} aria-hidden />

                  </AuthButton>

                  <AuthButton

                    variant="secondary"

                    aria-label={t('ai.a11y.exportConversation')}

                    loading={exportMutation.isPending}

                    loadingLabel={t('ai.a11y.exporting')}

                    onClick={() => {

                      void exportMutation.mutateAsync(conversationId).then((res) => {

                        const blob = new Blob([res.export], { type: 'application/json' });

                        const url = URL.createObjectURL(blob);

                        const a = document.createElement('a');

                        a.href = url;

                        a.download = `conversation-${conversationId}.json`;

                        a.click();

                        URL.revokeObjectURL(url);

                      });

                    }}

                  >

                    <Download size={14} aria-hidden />

                  </AuthButton>

                </div>

              ) : null

            }

            onSend={(text, attachments) => {
              if (quotaExceeded) return;
              void (async () => {
                if (!conversationId) {
                  if (attachments?.length) {
                    const conv = await createMutation.mutateAsync({
                      context: serializeAiRouteContext(context),
                      title: text.slice(0, 48) || t('ai.chat.new'),
                    });
                    navigate(`/ai/chat/${conv.conversationId}`, { replace: true });
                    await runInference(conv.conversationId, text, attachments);
                    return;
                  }
                  await startNewConversation(text);
                  return;
                }
                await runInference(conversationId, text, attachments);
              })();
            }}

          />

        </div>

      </AiSection>



      <AiModal open={renameOpen} onClose={() => setRenameOpen(false)} label={t('ai.chat.rename')} maxWidth={420}>

        <form

          className={e.shell}

          onSubmit={(ev) => {

            ev.preventDefault();

            if (!conversationId || !renameTitle.trim()) return;

            void renameMutation.mutateAsync({ id: conversationId, title: renameTitle.trim() }).then(() => {

              setRenameOpen(false);

            });

          }}

        >

          <AuthFormField label={t('ai.chat.rename')} id="rename-title">

            <input

              id="rename-title"

              className={e.input}

              value={renameTitle}

              onChange={(ev) => setRenameTitle(ev.target.value)}

              required

              autoFocus

            />

          </AuthFormField>

          <div className={e.pageActions}>

            <AuthButton type="button" variant="secondary" onClick={() => setRenameOpen(false)}>

              {t('ai.prompts.cancel')}

            </AuthButton>

            <AuthButton type="submit" loading={renameMutation.isPending} loadingLabel={t('ai.a11y.saving')}>

              {t('ai.prompts.save')}

            </AuthButton>

          </div>

        </form>

      </AiModal>

    </>

  );

}



import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useI18n } from '@booking/i18n/react';

export type FeedbackTone = 'info' | 'success' | 'warning' | 'danger';

export interface FeedbackMessage {
  id: string;
  tone: FeedbackTone;
  text: string;
}

interface NotifyOptions {
  tone?: FeedbackTone;
  /** Milliseconds before auto-dismiss. Set 0 to require manual dismissal. */
  durationMs?: number;
}

interface FeedbackContextValue {
  messages: FeedbackMessage[];
  notify: (text: string, options?: NotifyOptions) => string;
  dismiss: (id: string) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const DEFAULT_DURATION_MS = 6000;

/**
 * Toast/notification feedback. Messages are plain text only — callers must
 * never pass PHI, tokens, or invitation URLs here.
 */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const notify = useCallback(
    (text: string, options?: NotifyOptions) => {
      counterRef.current += 1;
      const id = `feedback-${counterRef.current}`;
      const tone = options?.tone ?? 'info';
      setMessages((current) => [...current, { id, tone, text }]);
      const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS;
      if (durationMs > 0) {
        window.setTimeout(() => dismiss(id), durationMs);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo<FeedbackContextValue>(() => ({ messages, notify, dismiss }), [messages, notify, dismiss]);

  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider');
  return ctx;
}

/** Live region that renders current toasts. Mount once per page (inside the shell's main area). */
export function FeedbackRegion() {
  const { messages, dismiss } = useFeedback();
  const { t } = useI18n();

  return (
    <div
      className="sa-feedback-region"
      aria-live="polite"
      aria-label={t('feedback.regionLabel', 'Notifications')}
    >
      {messages.map((message) => (
        <div key={message.id} className={`sa-feedback-toast sa-feedback-toast-${message.tone}`}>
          <span>{message.text}</span>
          <button
            type="button"
            className="sa-icon-button sa-icon-button-quiet"
            aria-label={t('common.buttons.close', 'Close')}
            onClick={() => dismiss(message.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from './PlatformAuthProvider';
import { PlatformAuthApiError } from './platform-auth-api';

interface StepUpModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful verification; typically retries the action that was blocked. */
  onVerified: () => void | Promise<void>;
}

/**
 * Reusable step-up re-authentication modal. Sensitive platform actions
 * (recovery code regeneration, MFA factor replacement, revoke-others/all)
 * return 403 PLATFORM_STEP_UP_REQUIRED when the current session's step-up
 * verification has expired — this collects a fresh TOTP/recovery code.
 */
export function StepUpModal({ open, onClose, onVerified }: StepUpModalProps) {
  const { t } = useI18n();
  const { client, withAccessToken } = usePlatformAuth();
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCode('');
    setError(null);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        const focusable = containerRef.current?.querySelectorAll<HTMLElement>(
          'input, button',
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = code.trim();
    if (!trimmed) {
      setError(t('shell.stepUp.errorRequired', 'Enter a verification code.'));
      return;
    }
    setPending(true);
    try {
      await withAccessToken((accessToken) => client.stepUpVerify(accessToken, trimmed));
      setPending(false);
      await onVerified();
    } catch (err) {
      setPending(false);
      setError(err instanceof PlatformAuthApiError ? err.message : t('shell.stepUp.genericError', 'Unable to verify code.'));
    }
  }

  return (
    <div
      className="sa-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="sa-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="step-up-modal-title"
        ref={containerRef}
      >
        <h2 id="step-up-modal-title">{t('shell.stepUp.title', 'Confirm it\u2019s you')}</h2>
        <p className="sa-muted">
          {t('shell.stepUp.body', 'This action requires a fresh verification code from your authenticator app or a recovery code.')}
        </p>
        <form onSubmit={onSubmit} noValidate>
          <div className="sa-field">
            <label htmlFor="step-up-code">{t('shell.stepUp.codeLabel', 'Verification code')}</label>
            <input
              id="step-up-code"
              name="code"
              inputMode="text"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={pending}
              ref={inputRef}
              required
            />
          </div>
          {error ? (
            <p className="sa-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="sa-modal-actions">
            <button
              type="button"
              className="sa-button sa-button-quiet"
              onClick={onClose}
              disabled={pending}
            >
              {t('common.buttons.cancel', 'Cancel')}
            </button>
            <button type="submit" className="sa-button" disabled={pending}>
              {pending ? t('shell.stepUp.verifying', 'Verifying…') : t('shell.stepUp.verifyButton', 'Verify')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

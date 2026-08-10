import { useId, useRef, type FormEvent, type ReactNode } from 'react';
import { useI18n } from '@booking/i18n/react';
import { Button } from './Button';
import { FormField } from './FormField';
import { TextInput } from './TextInput';
import { useFocusTrap } from './useFocusTrap';

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  /** Short safe-copy explanation of impact, wired via aria-describedby. */
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  /** When true, confirm is disabled until `reasonValue` has non-whitespace content. */
  reasonRequired?: boolean;
  reasonLabel?: string;
  reasonValue?: string;
  onReasonChange?: (value: string) => void;
  reasonError?: string | null;
  /** Safe, plain-text error region (e.g. an API failure) rendered above the actions. */
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Focus-trapped confirmation modal. Escape and backdrop click both cancel
 * (unless `pending`, to avoid abandoning an in-flight request mid-air).
 * Initial focus goes to the Cancel button — never Confirm, even for
 * non-danger confirmations — so a stray Enter/Space keypress never
 * accidentally confirms a high-impact action.
 */
export function ConfirmationDialog({
  open,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  danger = false,
  pending = false,
  reasonRequired = false,
  reasonLabel,
  reasonValue,
  onReasonChange,
  reasonError,
  error,
  onConfirm,
  onClose,
}: ConfirmationDialogProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();

  useFocusTrap(containerRef, open, handleClose, cancelRef);

  if (!open) return null;

  const showReasonField = reasonRequired || onReasonChange !== undefined;
  const trimmedReason = (reasonValue ?? '').trim();
  const confirmDisabled = pending || (reasonRequired && !trimmedReason);

  function handleClose() {
    // Ignore Escape/backdrop while a request is in flight — the caller
    // still owns cancellation via the Cancel button (which stays enabled
    // only when not pending, matching the hook's inFlight guard).
    if (pending) return;
    onClose();
  }

  function submit() {
    if (pending) return; // prevent double-submit
    if (reasonRequired && !trimmedReason) return;
    onConfirm();
  }

  function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  const describedBy = [description ? descriptionId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div
      className="sa-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div
        className="sa-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        ref={containerRef}
      >
        <h2 id={titleId}>{title}</h2>
        {description ? (
          <p id={descriptionId} className="sa-muted">
            {description}
          </p>
        ) : null}
        {children ? <div className="sa-modal-body">{children}</div> : null}
        <form onSubmit={handleFormSubmit} noValidate>
          {showReasonField ? (
            <FormField
              label={reasonLabel ?? t('confirm.common.reasonLabel', 'Reason')}
              error={reasonError ?? undefined}
              required={reasonRequired}
            >
              <TextInput
                value={reasonValue ?? ''}
                onChange={(event) => onReasonChange?.(event.target.value)}
                disabled={pending}
              />
            </FormField>
          ) : null}
          {error ? (
            <p id={errorId} className="sa-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="sa-modal-actions">
            <Button ref={cancelRef} variant="quiet" onClick={onClose} disabled={pending}>
              {cancelLabel ?? t('common.buttons.cancel', 'Cancel')}
            </Button>
            <Button
              variant={danger ? 'danger' : 'primary'}
              onClick={submit}
              pending={pending}
              disabled={confirmDisabled}
            >
              {confirmLabel ?? t('common.buttons.confirm', 'Confirm')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

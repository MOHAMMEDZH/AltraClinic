import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { isStepUpRequiredError, PlatformAuthApiError } from '../auth/platform-auth-api';

export type HighImpactKind =
  | 'suspend-user'
  | 'reactivate-user'
  | 'remove-role'
  | 'revoke-own-session'
  | 'revoke-own-others'
  | 'revoke-own-all'
  | 'revoke-admin-session'
  | 'revoke-admin-all'
  | 'mfa-reset-approve'
  | 'mfa-reset-reject'
  | 'catalog-activate'
  | 'catalog-deprecate'
  | 'catalog-retire'
  | 'catalog-reactivate'
  | 'catalog-rule-activate'
  | 'catalog-rule-retire'
  | 'plan-publish'
  | 'plan-archive'
  | 'plan-activate'
  | 'plan-reactivate'
  | 'plan-retire-version'
  | 'addon-publish'
  | 'addon-retire'
  | 'addon-activate'
  | 'addon-archive'
  | 'override-approve'
  | 'override-reject'
  | 'override-revoke'
  | 'subscription-schedule'
  | 'subscription-activate'
  | 'subscription-suspend'
  | 'subscription-resume'
  | 'subscription-cancel'
  | 'subscription-supersede'
  | 'subscription-renew'
  | 'suspend-sales-rep'
  | 'reactivate-sales-rep'
  | 'revoke-sales-rep-sessions'
  | 'remove-sales-rep-role'
  | 'remove-sales-ownership';

export interface HighImpactOpenArgs {
  kind: HighImpactKind;
  /** Opaque id for scoping the action — not shown as the primary label. */
  targetId: string;
  /** Safe display label (email, device summary, role display name). */
  targetLabel: string;
  reasonRequired: boolean;
  /** Must be stable for the target; captures the reason at confirm time. */
  execute: (reason: string) => Promise<void>;
}

/** Kinds whose backing API accepts a reason at all (required or optional). */
const REASON_CAPABLE_KINDS: ReadonlySet<HighImpactKind> = new Set([
  'suspend-user',
  'reactivate-user',
  'revoke-admin-session',
  'revoke-admin-all',
  'mfa-reset-approve',
  'mfa-reset-reject',
  'catalog-activate',
  'catalog-deprecate',
  'catalog-retire',
  'catalog-reactivate',
  'catalog-rule-activate',
  'catalog-rule-retire',
  'plan-publish',
  'plan-archive',
  'plan-activate',
  'plan-reactivate',
  'plan-retire-version',
  'addon-publish',
  'addon-retire',
  'addon-activate',
  'addon-archive',
  'override-reject',
  'override-revoke',
  'subscription-schedule',
  'subscription-activate',
  'subscription-suspend',
  'subscription-resume',
  'subscription-cancel',
  'subscription-supersede',
  'subscription-renew',
  'suspend-sales-rep',
  'reactivate-sales-rep',
  'revoke-sales-rep-sessions',
]);

/** Kinds rendered with the danger (destructive) confirm button styling. */
const DANGER_KINDS: ReadonlySet<HighImpactKind> = new Set([
  'suspend-user',
  'remove-role',
  'revoke-own-others',
  'revoke-own-all',
  'revoke-admin-session',
  'revoke-admin-all',
  'mfa-reset-reject',
  'catalog-deprecate',
  'catalog-retire',
  'catalog-rule-retire',
  'plan-archive',
  'plan-retire-version',
  'addon-retire',
  'addon-archive',
  'override-reject',
  'override-revoke',
  'subscription-cancel',
  'subscription-supersede',
  'suspend-sales-rep',
  'remove-sales-rep-role',
  'revoke-sales-rep-sessions',
  'remove-sales-ownership',
]);

function toMessageKey(kind: HighImpactKind): string {
  return kind.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function interpolateTarget(template: string, targetLabel: string): string {
  return template.replace('{target}', targetLabel);
}

interface ActiveAction {
  kind: HighImpactKind;
  targetId: string;
  targetLabel: string;
  reasonRequired: boolean;
  execute: (reason: string) => Promise<void>;
}

export interface HighImpactDialogProps {
  open: boolean;
  title: string;
  description: string | undefined;
  reasonRequired: boolean;
  reasonLabel: string | undefined;
  reasonValue: string;
  onReasonChange: ((value: string) => void) | undefined;
  confirmLabel: string;
  danger: boolean;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export interface HighImpactStepUpProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void | Promise<void>;
}

export interface UseHighImpactActionResult {
  open: (args: HighImpactOpenArgs) => void;
  close: () => void;
  dialogProps: HighImpactDialogProps;
  stepUpProps: HighImpactStepUpProps;
}

/**
 * Typed governance state machine for "high-impact" platform actions
 * (suspend/reactivate/remove-role/session-revocation/MFA-reset decisions).
 *
 * Invariants:
 * - `open()` never makes an API call — it only opens the confirmation dialog.
 * - The business API is only ever called from `onConfirm`, and at most once
 *   per confirm (an `inFlight` ref guards double-submit, e.g. from a fast
 *   double-click).
 * - A `PLATFORM_STEP_UP_REQUIRED` failure keeps the confirmation dialog
 *   "pending" (not dismissed) and opens `StepUpModal`; the reason captured
 *   at confirm time is replayed exactly once after successful step-up.
 * - Cancelling step-up cancels the whole action — no business API is called.
 * - Nothing here is ever written to localStorage/sessionStorage.
 */
export function useHighImpactAction(): UseHighImpactActionResult {
  const { t, locale } = useI18n();
  const [active, setActive] = useState<ActiveAction | null>(null);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const inFlightRef = useRef(false);
  const stepUpReasonRef = useRef<string | null>(null);
  const localeRef = useRef(locale);

  const reset = useCallback(() => {
    inFlightRef.current = false;
    stepUpReasonRef.current = null;
    setStepUpOpen(false);
    setPending(false);
    setError(null);
    setReason('');
    setActive(null);
  }, []);

  const open = useCallback((args: HighImpactOpenArgs) => {
    if (inFlightRef.current) return; // an action is already in flight — ignore
    setActive({
      kind: args.kind,
      targetId: args.targetId,
      targetLabel: args.targetLabel,
      reasonRequired: args.reasonRequired,
      execute: args.execute,
    });
    setReason('');
    setError(null);
    setPending(false);
    setStepUpOpen(false);
  }, []);

  const close = useCallback(() => {
    if (inFlightRef.current) return; // disable close while a request is in flight
    reset();
  }, [reset]);

  // Closing a confirmation dialog across a locale change avoids leaving a
  // partially-translated (or now stale-language) dialog on screen. No
  // business API is called — this only clears local dialog state, and never
  // fires while a request is in flight (matching the normal close() guard).
  useEffect(() => {
    if (localeRef.current === locale) return;
    localeRef.current = locale;
    if (active && !inFlightRef.current) {
      reset();
    }
  }, [locale, active, reset]);

  const handleConfirm = useCallback(() => {
    if (!active) return;
    if (inFlightRef.current) return; // ignore if pending — prevents double-submit
    if (active.reasonRequired && !reason.trim()) return;

    const reasonAtConfirm = reason;
    inFlightRef.current = true;
    setError(null);
    setPending(true);

    active
      .execute(reasonAtConfirm)
      .then(() => {
        inFlightRef.current = false;
        reset();
      })
      .catch((err: unknown) => {
        if (isStepUpRequiredError(err)) {
          // Keep the dialog open/pending; stash the reason and hand off to
          // step-up. inFlightRef stays true until step-up resolves or is
          // cancelled, so a second confirm click can't sneak in meanwhile.
          stepUpReasonRef.current = reasonAtConfirm;
          setStepUpOpen(true);
          return;
        }
        inFlightRef.current = false;
        setPending(false);
        setError(err instanceof PlatformAuthApiError ? err.message : 'Action failed.');
      });
  }, [active, reason, reset]);

  const handleStepUpVerified = useCallback(() => {
    const stashedReason = stepUpReasonRef.current;
    stepUpReasonRef.current = null;
    setStepUpOpen(false);

    if (!active || stashedReason === null) {
      inFlightRef.current = false;
      setPending(false);
      return;
    }

    active
      .execute(stashedReason)
      .then(() => {
        inFlightRef.current = false;
        reset();
      })
      .catch((err: unknown) => {
        if (isStepUpRequiredError(err)) {
          stepUpReasonRef.current = stashedReason;
          setStepUpOpen(true);
          return;
        }
        inFlightRef.current = false;
        setPending(false);
        setError(err instanceof PlatformAuthApiError ? err.message : 'Action failed.');
      });
  }, [active, reset]);

  const handleStepUpCancel = useCallback(() => {
    // Cancelling step-up cancels the whole (unexecuted) action — no API call.
    stepUpReasonRef.current = null;
    reset();
  }, [reset]);

  const showReason = active ? REASON_CAPABLE_KINDS.has(active.kind) : false;
  const messageKey = active ? toMessageKey(active.kind) : null;

  const dialogProps = useMemo<HighImpactDialogProps>(() => {
    if (!active || !messageKey) {
      return {
        open: false,
        title: '',
        description: undefined,
        reasonRequired: false,
        reasonLabel: undefined,
        reasonValue: '',
        onReasonChange: undefined,
        confirmLabel: t('common.buttons.confirm', 'Confirm'),
        danger: false,
        pending: false,
        error: null,
        onConfirm: handleConfirm,
        onClose: close,
      };
    }

    const impactTemplate = t(`confirm.${messageKey}.impact`, '');

    return {
      open: true,
      title: t(`confirm.${messageKey}.title`, 'Confirm action'),
      description: impactTemplate ? interpolateTarget(impactTemplate, active.targetLabel) : undefined,
      reasonRequired: active.reasonRequired,
      reasonLabel: showReason ? t(`confirm.${messageKey}.reasonLabel`, 'Reason') : undefined,
      reasonValue: reason,
      onReasonChange: showReason ? setReason : undefined,
      confirmLabel: t(`confirm.${messageKey}.confirmLabel`, 'Confirm'),
      danger: DANGER_KINDS.has(active.kind),
      pending,
      error,
      onConfirm: handleConfirm,
      onClose: close,
    };
  }, [active, close, error, handleConfirm, messageKey, pending, reason, showReason, t]);

  const stepUpProps = useMemo<HighImpactStepUpProps>(
    () => ({
      open: stepUpOpen,
      onClose: handleStepUpCancel,
      onVerified: handleStepUpVerified,
    }),
    [stepUpOpen, handleStepUpCancel, handleStepUpVerified],
  );

  return { open, close, dialogProps, stepUpProps };
}

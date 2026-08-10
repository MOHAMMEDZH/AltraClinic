import { useI18n } from '@booking/i18n/react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

/** Generic recoverable-error state — never renders stack traces or raw error objects. */
export function ErrorState({ title, description, onRetry, retryLabel }: ErrorStateProps) {
  const { t } = useI18n();
  return (
    <div className="sa-error-state" role="alert">
      <h2>{title ?? t('common.states.errorTitle', 'Something went wrong')}</h2>
      <p className="sa-muted">{description ?? t('common.states.errorBody')}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          {retryLabel ?? t('common.buttons.retry', 'Try again')}
        </Button>
      ) : null}
    </div>
  );
}

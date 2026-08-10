import type { ReactNode } from 'react';
import { useI18n } from '@booking/i18n/react';

interface EmptyStateProps {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
}

/** Neutral "nothing here" state — used by placeholders and empty lists alike. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  const { t } = useI18n();
  return (
    <div className="sa-empty-state" role="status">
      <h2>{title ?? t('common.states.emptyTitle', 'Nothing here yet')}</h2>
      {description ? <p className="sa-muted">{description}</p> : null}
      {action ? <div className="sa-empty-state-action">{action}</div> : null}
    </div>
  );
}

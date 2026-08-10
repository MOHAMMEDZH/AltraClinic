import type { ReactNode } from 'react';
import { useI18n } from '@booking/i18n/react';
import type { SectionAvailability } from './types';

interface SectionExplanationProps {
  sectionId: string;
  availability: SectionAvailability;
  reasonCode?: string;
  children?: ReactNode;
}

/** Accessible progressive disclosure for section availability / provenance. */
export function SectionExplanation({ sectionId, availability, reasonCode, children }: SectionExplanationProps) {
  const { t } = useI18n();
  const statusLabel = t(`tenants.availability.${availability}`, availability);
  const reason = reasonCode
    ? t(`tenants.reason.${reasonCode}`, reasonCode)
    : t('tenants.reason.generic', 'See platform documentation for this limitation.');

  return (
    <details className="sa-definition-disclosure" data-testid={`section-explanation-${sectionId}`}>
      <summary>{t('tenants.sectionExplanation', 'Why is this shown this way?')}</summary>
      <dl className="sa-definition-list">
        <dt>{t('tenants.availabilityLabel', 'Availability')}</dt>
        <dd>{statusLabel}</dd>
        {reasonCode ? (
          <>
            <dt>{t('tenants.reasonLabel', 'Reason')}</dt>
            <dd>{reason}</dd>
          </>
        ) : null}
      </dl>
      {children}
    </details>
  );
}

export function availabilityTone(
  availability: SectionAvailability,
): 'success' | 'warning' | 'neutral' | 'danger' {
  if (availability === 'available' || availability === 'available_legacy') return 'success';
  if (availability === 'permission_limited') return 'warning';
  if (availability === 'degraded' || availability === 'stale') return 'warning';
  if (availability === 'unavailable') return 'neutral';
  return 'neutral';
}

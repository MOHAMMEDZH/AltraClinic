import { useI18n } from '@booking/i18n/react';
import { formatBeautyDateTime } from '../config/beauty-config';
import type { BeautyConsultation } from '../types/beauty.types';
import styles from './ConsultationPanel.module.css';

interface ConsultationPanelProps {
  consultations: BeautyConsultation[];
  onEdit?: (consultation: BeautyConsultation) => void;
}

export function ConsultationPanel({ consultations, onEdit }: ConsultationPanelProps) {
  const { t, locale } = useI18n();

  if (!consultations.length) {
    return <p className={styles.empty}>{t('beauty.consultation.empty')}</p>;
  }

  return (
    <div className={styles.list}>
      {consultations.map((c) => (
        <article key={c.id} className={styles.card}>
          <header className={styles.head}>
            <strong>
              {t(`beauty.consultation.${c.type === 'initial' ? 'initial' : 'followUp'}`)}
              {c.status === 'draft' && ` (${t('beauty.forms.draft')})`}
            </strong>
            <time dateTime={c.date}>{formatBeautyDateTime(c.date, locale)}</time>
          </header>
          {c.skinAssessment && (
            <section>
              <h5>{t('beauty.consultation.skinAssessment')}</h5>
              <dl className={styles.dl}>
                {Object.entries(c.skinAssessment).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {c.facialAssessment && (
            <section>
              <h5>{t('beauty.consultation.facialAssessment')}</h5>
              <dl className={styles.dl}>
                {Object.entries(c.facialAssessment).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {c.recommendations && c.recommendations.length > 0 && (
            <section>
              <h5>{t('beauty.consultation.recommendations')}</h5>
              <ul className={styles.recs}>
                {c.recommendations.map((r) => (
                  <li key={r}>{r.replace(/_/g, ' ')}</li>
                ))}
              </ul>
            </section>
          )}
          {c.consentPhoto && (
            <span className={styles.consent}>{t('beauty.consultation.consentPhoto')}</span>
          )}
          {c.notes && <p className={styles.notes}>{c.notes}</p>}
          {onEdit && (
            <button type="button" className={styles.editBtn} onClick={() => onEdit(c)}>
              {t('beauty.forms.edit')}
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

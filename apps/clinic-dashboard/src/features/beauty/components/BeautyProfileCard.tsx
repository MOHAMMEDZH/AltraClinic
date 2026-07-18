import { useI18n } from '@booking/i18n/react';

import { SKIN_CONCERNS, SKIN_TYPES } from '../config/beauty-config';

import type { BeautyBodyMapState, BeautyConsent } from '../types/beauty.types';

import styles from './BeautyProfileCard.module.css';



interface BeautyProfileCardProps {

  profile: BeautyBodyMapState['profile'];

  consents: BeautyBodyMapState['consents'];

  readOnly?: boolean;

  onChange?: (profile: BeautyBodyMapState['profile']) => void;

  onConsentChange?: (consents: BeautyConsent[]) => void;

}



function consentFor(consents: BeautyConsent[], type: BeautyConsent['type']) {

  return consents.find((c) => c.type === type);

}



export function BeautyProfileCard({ profile, consents, readOnly, onChange, onConsentChange }: BeautyProfileCardProps) {

  const { t } = useI18n();

  const photoConsent = consentFor(consents, 'photo');

  const treatmentConsent = consentFor(consents, 'treatment');



  function toggleConsent(type: BeautyConsent['type'], granted: boolean) {

    if (readOnly || !onConsentChange) return;

    onConsentChange([

      {

        id: `consent_${type}`,

        type,

        granted,

        grantedAt: granted ? new Date().toISOString() : undefined,

      },

    ]);

  }



  return (

    <section className={styles.card} aria-label={t('beauty.profile.title')}>

      <h3 className={styles.title}>{t('beauty.profile.title')}</h3>

      <div className={styles.grid}>

        <label className={styles.field}>

          <span>{t('beauty.profile.skinType')}</span>

          <select

            value={profile.skinType ?? ''}

            disabled={readOnly}

            onChange={(e) => onChange?.({ ...profile, skinType: e.target.value || null })}

          >

            <option value="">—</option>

            {SKIN_TYPES.map((st) => (

              <option key={st} value={st}>

                {t(`beauty.skinTypes.${st}`)}

              </option>

            ))}

          </select>

        </label>

      </div>



      <fieldset className={styles.concerns} disabled={readOnly}>

        <legend>{t('beauty.profile.concerns')}</legend>

        <div className={styles.chips}>

          {SKIN_CONCERNS.map((c) => {

            const active = profile.concerns.includes(c);

            return (

              <button

                key={c}

                type="button"

                className={active ? styles.chipActive : styles.chip}

                aria-pressed={active}

                onClick={() => {

                  if (readOnly) return;

                  const next = active ? profile.concerns.filter((x) => x !== c) : [...profile.concerns, c];

                  onChange?.({ ...profile, concerns: next });

                }}

              >

                {t(`beauty.concerns.${c}`)}

              </button>

            );

          })}

        </div>

      </fieldset>



      <label className={styles.field}>

        <span>{t('beauty.profile.allergies')}</span>

        <input

          type="text"

          disabled={readOnly}

          value={profile.allergies.join(', ')}

          placeholder={t('beauty.profile.allergiesPlaceholder')}

          onChange={(e) =>

            onChange?.({

              ...profile,

              allergies: e.target.value

                .split(',')

                .map((s) => s.trim())

                .filter(Boolean),

            })

          }

        />

      </label>



      <label className={styles.field}>

        <span>{t('beauty.profile.notes')}</span>

        <textarea

          rows={3}

          value={profile.notes}

          disabled={readOnly}

          onChange={(e) => onChange?.({ ...profile, notes: e.target.value })}

        />

      </label>



      <fieldset className={styles.consentFieldset} disabled={readOnly}>

        <legend>{t('beauty.consent.title')}</legend>

        <label className={styles.consentRow}>

          <input

            type="checkbox"

            checked={Boolean(photoConsent?.granted)}

            disabled={readOnly}

            onChange={(e) => toggleConsent('photo', e.target.checked)}

          />

          <span>{t('beauty.consent.photo')}</span>

          <span className={[styles.badge, photoConsent?.granted ? styles.granted : styles.pending].join(' ')}>

            {photoConsent?.granted ? t('beauty.consent.granted') : t('beauty.consent.pending')}

          </span>

        </label>

        <label className={styles.consentRow}>

          <input

            type="checkbox"

            checked={Boolean(treatmentConsent?.granted)}

            disabled={readOnly}

            onChange={(e) => toggleConsent('treatment', e.target.checked)}

          />

          <span>{t('beauty.consent.treatment')}</span>

          <span className={[styles.badge, treatmentConsent?.granted ? styles.granted : styles.pending].join(' ')}>

            {treatmentConsent?.granted ? t('beauty.consent.granted') : t('beauty.consent.pending')}

          </span>

        </label>

      </fieldset>

    </section>

  );

}



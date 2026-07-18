import { useMemo } from 'react';

import { useI18n } from '@booking/i18n/react';

import { AuthFormField } from '@/features/auth/components/AuthFormField';

import type { SoapNotes } from '../types/emr.types';

import { CLINICAL_NOTE_TEMPLATES } from '../config/emr-config';

import { useNoteTemplates } from '../hooks/useEmr';

import styles from './SoapNotesPanel.module.css';



interface SoapNotesPanelProps {

  soap: SoapNotes;

  readOnly?: boolean;

  onChange?: (soap: SoapNotes) => void;

  onApplyTemplate?: (soap: SoapNotes) => void;

}



const FIELDS: Array<{ key: keyof SoapNotes; labelKey: string }> = [

  { key: 'subjective', labelKey: 'emr.soap.subjective' },

  { key: 'objective', labelKey: 'emr.soap.objective' },

  { key: 'assessment', labelKey: 'emr.soap.assessment' },

  { key: 'plan', labelKey: 'emr.soap.plan' },

];



export function SoapNotesPanel({ soap, readOnly, onChange, onApplyTemplate }: SoapNotesPanelProps) {

  const { t } = useI18n();

  const tenantTemplates = useNoteTemplates();



  const templates = useMemo(() => {

    const builtIn = CLINICAL_NOTE_TEMPLATES.map((tpl) => ({

      id: tpl.id,

      label: t(tpl.labelKey as never),

      soap: tpl.soap,

    }));

    const tenant = (tenantTemplates.data ?? []).map((tpl) => ({

      id: tpl.id,

      label: tpl.name,

      soap: tpl.soapNotes,

    }));

    return [...builtIn, ...tenant];

  }, [t, tenantTemplates.data]);



  function handleChange(key: keyof SoapNotes, value: string) {

    if (readOnly || !onChange) return;

    onChange({ ...soap, [key]: value });

  }



  return (

    <section className={styles.panel} aria-label={t('emr.soap.title')}>

      {!readOnly && (

        <div className={styles.templates} role="group" aria-label={t('emr.templates.title')}>

          {templates.map((tpl) => (

            <button

              key={tpl.id}

              type="button"

              className={styles.templateChip}

              onClick={() => {

                const next = { ...soap, ...tpl.soap };

                onChange?.(next);

                onApplyTemplate?.(next);

              }}

            >

              {tpl.label}

            </button>

          ))}

        </div>

      )}

      {FIELDS.map(({ key, labelKey }) => (

        <div key={key} className={styles.field}>

          <label className={styles.label} htmlFor={`soap-${key}`}>

            {t(labelKey)}

          </label>

          {readOnly ? (

            <p className={styles.readOnly}>{soap[key]?.trim() || '—'}</p>

          ) : (

            <textarea

              id={`soap-${key}`}

              className={styles.textarea}

              rows={4}

              value={soap[key] ?? ''}

              onChange={(e) => handleChange(key, e.target.value)}

              placeholder={t(`emr.soap.${key}Placeholder`)}

            />

          )}

        </div>

      ))}

    </section>

  );

}


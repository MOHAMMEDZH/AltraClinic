import { useI18n } from '@booking/i18n/react';
import {
  FURCATION_OPTIONS,
  MOLAR_TEETH,
  MOBILITY_OPTIONS,
  PERIO_SITES,
  PLAQUE_OPTIONS,
  SITE_LABEL_KEYS,
  toothFdiLabel,
} from '../perio-config';
import type { PerioToothRecord } from '../perio.types';
import styles from './PerioSiteGrid.module.css';

interface PerioSiteGridProps {
  tooth: PerioToothRecord;
  readOnly?: boolean;
  onChange: (tooth: PerioToothRecord) => void;
}

export function PerioSiteGrid({ tooth, readOnly, onChange }: PerioSiteGridProps) {
  const { t } = useI18n();
  const isMolar = MOLAR_TEETH.has(tooth.toothNumber);

  function updateSite(siteId: (typeof PERIO_SITES)[number], field: 'pd' | 'recession', value: number) {
    onChange({
      ...tooth,
      sites: {
        ...tooth.sites,
        [siteId]: { ...tooth.sites[siteId], [field]: value },
      },
    });
  }

  function toggleBop(siteId: (typeof PERIO_SITES)[number]) {
    onChange({
      ...tooth,
      sites: {
        ...tooth.sites,
        [siteId]: { ...tooth.sites[siteId], bop: !tooth.sites[siteId].bop },
      },
    });
  }

  return (
    <div className={styles.panel}>
      <header className={styles.head}>
        <h3 className={styles.title}>
          {t('dental.odontogram.tooth')} {tooth.toothNumber}
          <span className={styles.fdi}>FDI {toothFdiLabel(tooth.toothNumber)}</span>
        </h3>
      </header>

      <div className={styles.metrics}>
        <label className={styles.field}>
          <span>{t('dental.perio.mobility')}</span>
          <select
            value={tooth.mobility}
            disabled={readOnly}
            onChange={(e) => onChange({ ...tooth, mobility: Number(e.target.value) })}
          >
            {MOBILITY_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v === 0 ? t('dental.perio.none') : `${v}`}
              </option>
            ))}
          </select>
        </label>
        {isMolar && (
          <label className={styles.field}>
            <span>{t('dental.perio.furcation')}</span>
            <select
              value={tooth.furcation ?? 0}
              disabled={readOnly}
              onChange={(e) => onChange({ ...tooth, furcation: Number(e.target.value) || null })}
            >
              {FURCATION_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v === 0 ? t('dental.perio.none') : t(`dental.perio.furcationClass.${v}`)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={styles.field}>
          <span>{t('dental.perio.plaqueIndex')}</span>
          <select
            value={tooth.plaqueIndex}
            disabled={readOnly}
            onChange={(e) => onChange({ ...tooth, plaqueIndex: Number(e.target.value) })}
          >
            {PLAQUE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.gridWrap}>
        <table className={styles.grid} aria-label={t('dental.perio.siteGrid')}>
        <thead>
          <tr>
            <th scope="col">{t('dental.perio.sites.label')}</th>
            <th scope="col">{t('dental.perio.pocketDepth')}</th>
            <th scope="col">{t('dental.perio.recession')}</th>
            <th scope="col">{t('dental.perio.bop')}</th>
          </tr>
        </thead>
        <tbody>
          {PERIO_SITES.map((siteId) => {
            const site = tooth.sites[siteId];
            return (
              <tr key={siteId}>
                <th scope="row">{t(SITE_LABEL_KEYS[siteId])}</th>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    step={1}
                    className={styles.numInput}
                    value={site.pd}
                    disabled={readOnly}
                    aria-label={`${t(SITE_LABEL_KEYS[siteId])} ${t('dental.perio.pocketDepth')}`}
                    onChange={(e) => updateSite(siteId, 'pd', Math.min(15, Math.max(0, Number(e.target.value) || 0)))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    step={1}
                    className={styles.numInput}
                    value={site.recession}
                    disabled={readOnly}
                    aria-label={`${t(SITE_LABEL_KEYS[siteId])} ${t('dental.perio.recession')}`}
                    onChange={(e) =>
                      updateSite(siteId, 'recession', Math.min(15, Math.max(0, Number(e.target.value) || 0)))
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className={[styles.bopBtn, site.bop ? styles.bopActive : ''].filter(Boolean).join(' ')}
                    disabled={readOnly}
                    aria-pressed={site.bop}
                    aria-label={`${t(SITE_LABEL_KEYS[siteId])} ${t('dental.perio.bop')}`}
                    onClick={() => toggleBop(siteId)}
                  >
                    {site.bop ? t('dental.perio.bopYes') : t('dental.perio.bopNo')}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

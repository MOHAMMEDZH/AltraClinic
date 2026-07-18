import { useI18n } from '@booking/i18n/react';
import { formatLimit, isUsageCritical, isUsageWarning, UNLIMITED, usagePercent } from '../config/subscription-config';
import styles from '../subscription-layout.module.css';

interface UsageMeterProps {
  label: string;
  current: number;
  max: number;
  unit?: string;
}

export function UsageMeter({ label, current, max, unit }: UsageMeterProps) {
  const { t } = useI18n();
  const percent = usagePercent(current, max);
  const warn = isUsageWarning(percent);
  const critical = isUsageCritical(percent);
  const fillClass = critical ? styles.meterFillCritical : warn ? styles.meterFillWarn : styles.meterFill;

  return (
    <div className={styles.meter}>
      <div className={styles.toolbar}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiValue} style={{ fontSize: 'var(--text-sm)' }}>
          {current}
          {unit ? ` ${unit}` : ''} / {formatLimit(max)}
        </span>
      </div>
      {max !== UNLIMITED && (
        <>
          <div
            className={styles.meterTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label={label}
          >
            <div className={fillClass} style={{ width: `${percent}%` }} />
          </div>
          {(warn || critical) && (
            <span className={critical ? styles.badgeUpgrade : styles.badgeLimited}>
              {critical ? t('subscription.usage.critical') : t('subscription.usage.warning')}
            </span>
          )}
        </>
      )}
    </div>
  );
}

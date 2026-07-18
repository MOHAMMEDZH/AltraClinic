import { useId } from 'react';
import { useI18n } from '@booking/i18n/react';
import {
  passwordStrengthScore,
  validatePassword,
  type PasswordRuleKey,
} from '@/lib/password-policy';
import styles from './PasswordStrengthMeter.module.css';

interface PasswordStrengthMeterProps {
  password: string;
  showRules?: boolean;
  id?: string;
}

const strengthLabels = [
  'auth.strengthWeak',
  'auth.strengthFair',
  'auth.strengthGood',
  'auth.strengthStrong',
] as const;

const ruleKeys: PasswordRuleKey[] = ['minLength', 'uppercase', 'lowercase', 'digit', 'special'];

export function PasswordStrengthMeter({ password, showRules = true, id }: PasswordStrengthMeterProps) {
  const { t } = useI18n();
  const autoId = useId();
  const meterId = id ?? autoId;
  const score = passwordStrengthScore(password);
  const failed = validatePassword(password);

  if (!password) return null;

  const barClass = (index: number) => {
    if (score === 0) return '';
    if (index >= score) return '';
    if (score === 1) return styles.barActive1;
    if (score === 2) return styles.barActive2;
    if (score === 3) return styles.barActive3;
    return styles.barActive4;
  };

  return (
    <div id={meterId} className={styles.meter} aria-live="polite">
      <div className={styles.bars} aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={[styles.bar, barClass(i)].filter(Boolean).join(' ')} />
        ))}
      </div>
      <p className={styles.label}>
        {t(strengthLabels[Math.max(0, score - 1)] ?? strengthLabels[0])}
      </p>
      {showRules && (
        <ul className={styles.rules}>
          {ruleKeys.map((key) => {
            const met = !failed.includes(key);
            return (
              <li key={key} className={[styles.rule, met ? styles.ruleMet : ''].join(' ')}>
                <span className={styles.dot} aria-hidden />
                {t(`auth.rule.${key}`)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

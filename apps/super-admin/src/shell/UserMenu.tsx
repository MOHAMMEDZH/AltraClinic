import { useNavigate } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { Menu } from '../ui/Menu';

/**
 * Account menu: identity summary (display name/email/role-key labels — no
 * PHI, tokens, or authorization decisions derived from role names), a link
 * to the personal security page, and sign-out.
 */
export function UserMenu() {
  const { principal, logout } = usePlatformAuth();
  const navigate = useNavigate();
  const { t, locale, setLocale } = useI18n();

  if (!principal) return null;

  const roleSummary = principal.roleKeys && principal.roleKeys.length > 0 ? principal.roleKeys.join(', ') : null;

  const englishLabel = t('shell.language.english', 'English');
  const arabicLabel = t('shell.language.arabic', 'العربية');
  const languageLabel = t('shell.language.label', 'Language');

  return (
    <Menu
      label={t('a11y.accountMenu', 'Account menu')}
      align="end"
      header={
        <span className="sa-user-menu-identity">
          <strong>{principal.displayName ?? principal.email}</strong>
          <span className="sa-muted">{principal.email}</span>
          {roleSummary ? (
            <span className="sa-muted">
              {t('shell.userMenu.rolesLabel', 'Roles')}: {roleSummary}
            </span>
          ) : null}
        </span>
      }
      renderTrigger={(triggerProps) => (
        <button type="button" className="sa-user-menu-trigger" {...triggerProps}>
          <span aria-hidden="true" className="sa-user-menu-avatar">
            {(principal.displayName ?? principal.email).slice(0, 1).toUpperCase()}
          </span>
          <span className="sa-user-menu-name">{principal.displayName ?? principal.email}</span>
        </button>
      )}
      items={[
        {
          key: 'security',
          label: t('shell.userMenu.mySecurity', 'My security'),
          onSelect: () => navigate('/security'),
        },
        {
          key: 'language-en',
          label: `${languageLabel}: ${englishLabel}${locale === 'en-US' ? ' \u2713' : ''}`,
          onSelect: () => setLocale('en-US'),
        },
        {
          key: 'language-ar',
          label: `${languageLabel}: ${arabicLabel}${locale === 'ar-SY' ? ' \u2713' : ''}`,
          onSelect: () => setLocale('ar-SY'),
        },
        {
          key: 'logout',
          label: t('shell.userMenu.logout', 'Log out'),
          danger: true,
          onSelect: () => void logout(),
        },
      ]}
    />
  );
}

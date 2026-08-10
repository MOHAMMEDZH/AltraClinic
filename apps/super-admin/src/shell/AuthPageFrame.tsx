import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSuperAdminConfig } from '../app/providers/ConfigProvider';
import { EnvironmentBadge } from './EnvironmentBadge';

/**
 * Minimal chrome for unauthenticated / transitional-auth pages (login,
 * activate, MFA enrollment/challenge, unauthorized). No nav, no tenant or
 * patient selectors — just brand, environment, and the page content.
 */
export function AuthPageFrame({ children }: { children: ReactNode }) {
  const config = useSuperAdminConfig();

  return (
    <div className="sa-auth-shell">
      <header className="sa-auth-header">
        <Link to="/" className="sa-brand-link">
          {config.appName}
        </Link>
        <EnvironmentBadge />
      </header>
      <main id="main-content" tabIndex={-1} className="sa-auth-main">
        {children}
      </main>
    </div>
  );
}

import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  Activity,
  ArrowLeftRight,
  Download,
  FileUp,
  FolderArchive,
  HeartPulse,
  LayoutDashboard,
  Library,
  ListTodo,
} from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useEffect } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canViewImportExport, IMPORT_EXPORT_BASE_PATH } from '../config/import-export-config';
import { logImportExportUiEvent } from '../lib/ui-events';
import styles from '../import-export-layout.module.css';

const navItems = [
  { to: IMPORT_EXPORT_BASE_PATH, end: true, icon: LayoutDashboard, label: 'Overview' },
  { to: `${IMPORT_EXPORT_BASE_PATH}/imports`, icon: FileUp, label: 'Imports' },
  { to: `${IMPORT_EXPORT_BASE_PATH}/exports`, icon: Download, label: 'Exports' },
  { to: `${IMPORT_EXPORT_BASE_PATH}/jobs`, icon: ListTodo, label: 'Jobs' },
  { to: `${IMPORT_EXPORT_BASE_PATH}/catalog`, icon: Library, label: 'Catalog' },
  { to: `${IMPORT_EXPORT_BASE_PATH}/artifacts`, icon: FolderArchive, label: 'Artifacts' },
  { to: `${IMPORT_EXPORT_BASE_PATH}/health`, icon: HeartPulse, label: 'System Health' },
] as const;

export function ImportExportLayout() {
  const { t } = useI18n();
  const { user } = useAuth();
  const canView = canViewImportExport(user?.roles?.map(String) ?? []);

  useEffect(() => {
    logImportExportUiEvent('page_opened', { page: 'center' });
  }, []);

  if (!canView) {
    return (
      <div className={styles.layout} id="import-export-region">
        <AuthAlert variant="error">
          You do not have permission to view Import / Export Center.
        </AuthAlert>
      </div>
    );
  }

  return (
    <div className={styles.layout} id="import-export-region">
      <header className={styles.header}>
        <Link to="/settings" className={styles.backLink}>
          ← {t('settings.title', 'Settings')}
        </Link>
        <h1 className={styles.title}>
          <ArrowLeftRight size={28} aria-hidden style={{ verticalAlign: 'middle', marginInlineEnd: 8 }} />
          {t('importExport.title', 'Import / Export Center')}
        </h1>
        <p className={styles.subtitle}>
          {t(
            'importExport.subtitle',
            'Monitor imports, exports, jobs, artifacts, and system health. Execution stays on the server.',
          )}
        </p>
      </header>

      <div className={styles.grid}>
        <nav className={styles.nav} aria-label={t('importExport.title', 'Import / Export Center')}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                [styles.navLink, isActive ? styles.navLinkActive : ''].filter(Boolean).join(' ')
              }
            >
              <item.icon size={18} aria-hidden />
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to={`${IMPORT_EXPORT_BASE_PATH}/jobs?filter=running`}
            className={({ isActive }) =>
              [styles.navLink, isActive ? styles.navLinkActive : ''].filter(Boolean).join(' ')
            }
          >
            <Activity size={18} aria-hidden />
            Running Jobs
          </NavLink>
        </nav>

        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

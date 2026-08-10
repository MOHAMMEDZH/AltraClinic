import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  Activity,
  Archive,
  Database,
  HeartPulse,
  LayoutDashboard,
  Library,
  ListTodo,
  RotateCcw,
  ShieldCheck,
  Timer,
  Undo2,
} from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useEffect } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canViewBackupRestore, BACKUP_RESTORE_BASE_PATH } from '../config/backup-restore-config';
import { logBackupRestoreUiEvent } from '../lib/ui-events';
import styles from '../backup-restore-layout.module.css';

const navItems = [
  { to: BACKUP_RESTORE_BASE_PATH, end: true, icon: LayoutDashboard, label: 'Overview' },
  { to: `${BACKUP_RESTORE_BASE_PATH}/jobs`, icon: ListTodo, label: 'Jobs' },
  { to: `${BACKUP_RESTORE_BASE_PATH}/backups`, icon: Database, label: 'Backups' },
  { to: `${BACKUP_RESTORE_BASE_PATH}/restores`, icon: Undo2, label: 'Restores' },
  { to: `${BACKUP_RESTORE_BASE_PATH}/snapshots`, icon: Archive, label: 'Snapshots' },
  { to: `${BACKUP_RESTORE_BASE_PATH}/verification`, icon: ShieldCheck, label: 'Verification' },
  { to: `${BACKUP_RESTORE_BASE_PATH}/retention`, icon: Timer, label: 'Retention' },
  { to: `${BACKUP_RESTORE_BASE_PATH}/recovery-points`, icon: RotateCcw, label: 'Recovery Points' },
  { to: `${BACKUP_RESTORE_BASE_PATH}/catalog`, icon: Library, label: 'Catalog' },
  { to: `${BACKUP_RESTORE_BASE_PATH}/health`, icon: HeartPulse, label: 'Health' },
] as const;

export function BackupRestoreLayout() {
  const { t } = useI18n();
  const { user } = useAuth();
  const canView = canViewBackupRestore(user?.roles?.map(String) ?? []);

  useEffect(() => {
    logBackupRestoreUiEvent('page_opened', { page: 'center' });
  }, []);

  if (!canView) {
    return (
      <div className={styles.layout} id="backup-restore-region">
        <AuthAlert variant="error">
          You do not have permission to view Backup & Restore Center.
        </AuthAlert>
      </div>
    );
  }

  return (
    <div className={styles.layout} id="backup-restore-region">
      <header className={styles.header}>
        <Link to="/settings" className={styles.backLink}>
          ← {t('settings.title', 'Settings')}
        </Link>
        <h1 className={styles.title}>
          <Database size={28} aria-hidden style={{ verticalAlign: 'middle', marginInlineEnd: 8 }} />
          {t('settings.nav.backupRestore', 'Backup & Restore')}
        </h1>
        <p className={styles.subtitle}>
          {t(
            'settings.nav.backupRestoreDesc',
            'Monitor backups, restores, snapshots, verification, and retention. Execution stays on the server.',
          )}
        </p>
      </header>

      <div className={styles.grid}>
        <nav className={styles.nav} aria-label={t('settings.nav.backupRestore', 'Backup & Restore')}>
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
            to={`${BACKUP_RESTORE_BASE_PATH}/jobs?filter=running`}
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

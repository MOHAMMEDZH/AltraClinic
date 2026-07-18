import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  CheckSquare,
  ClipboardList,
  FileStack,
  GitBranch,
  LayoutDashboard,
  ListTodo,
  PenTool,
  ScrollText,
  Shield,
  Zap,
} from 'lucide-react';
import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { buildWorkflowPermCheck, canViewWorkflows } from '../config/workflow-config';
import { useWorkflowsRealtime } from '../hooks/useWorkflowsRealtime';
import e from '../workflow-enterprise.module.css';

const navGroups = [
  {
    labelKey: 'workflow.enterprise.navOperations',
    items: [
      { to: '/workflows', end: true, icon: LayoutDashboard, labelKey: 'workflow.nav.overview' },
      { to: '/workflows/instances', icon: GitBranch, labelKey: 'workflow.nav.instances' },
      { to: '/workflows/tasks', icon: ListTodo, labelKey: 'workflow.nav.tasks' },
      { to: '/workflows/approvals', icon: CheckSquare, labelKey: 'workflow.nav.approvals' },
    ],
  },
  {
    labelKey: 'workflow.enterprise.navDesign',
    items: [
      { to: '/workflows/builder', icon: PenTool, labelKey: 'workflow.nav.builder' },
      { to: '/workflows/templates', icon: FileStack, labelKey: 'workflow.nav.templates' },
      { to: '/workflows/automation', icon: Zap, labelKey: 'workflow.nav.automation' },
    ],
  },
  {
    labelKey: 'workflow.enterprise.navObserve',
    items: [
      { to: '/workflows/monitoring', icon: Activity, labelKey: 'workflow.nav.monitoring' },
      { to: '/workflows/logs', icon: ScrollText, labelKey: 'workflow.nav.logs' },
      { to: '/workflows/audit', icon: Shield, labelKey: 'workflow.nav.audit' },
    ],
  },
] as const;

export function WorkflowLayout() {
  const { t } = useI18n();
  const { user } = useAuth();
  const perm = useMemo(() => buildWorkflowPermCheck(user?.roles ?? []), [user?.roles]);
  const { connectionState } = useWorkflowsRealtime(canViewWorkflows(perm));

  return (
    <div className={e.layoutShell} id="workflow-region">
      <header className={e.layoutHero}>
        <div>
          <h1 className={e.layoutHeroTitle}>
            <ClipboardList size={28} aria-hidden style={{ verticalAlign: 'middle', marginInlineEnd: 10 }} />
            {t('workflow.title')}
          </h1>
          <p className={e.layoutHeroSubtitle}>{t('workflow.enterprise.commandCenterHint')}</p>
        </div>
        <span
          className={[e.livePill, connectionState === 'connected' ? e.livePillOn : ''].filter(Boolean).join(' ')}
          aria-live="polite"
        >
          <span className={e.liveDot} aria-hidden />
          {connectionState === 'connected' ? t('workflow.realtime.live') : t('workflow.realtime.connecting')}
        </span>
      </header>

      <div className={e.layoutGrid}>
        <nav className={e.layoutNav} aria-label={t('workflow.title')}>
          {navGroups.map((group) => (
            <div key={group.labelKey} className={e.navGroup}>
              <p className={e.navGroupLabel}>{t(group.labelKey)}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={'end' in item ? item.end : false}
                  className={({ isActive }) =>
                    [e.layoutNavLink, isActive ? e.layoutNavLinkActive : ''].filter(Boolean).join(' ')
                  }
                >
                  <item.icon size={16} aria-hidden />
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <main className={e.shell}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

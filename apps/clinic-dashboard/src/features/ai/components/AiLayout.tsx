import { NavLink, Outlet } from 'react-router-dom';
import { Bot, History, LayoutDashboard, MessageSquare, Settings, Shield, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { buildAiPermCheck, canViewAi } from '../config/ai-config';
import { useAiOverview } from '../hooks/useAiChat';
import e from '../ai-enterprise.module.css';

const navGroups = [
  {
    labelKey: 'ai.nav.assistant',
    items: [
      { to: '/ai', end: true, icon: LayoutDashboard, labelKey: 'ai.nav.overview' },
      { to: '/ai/chat', icon: MessageSquare, labelKey: 'ai.nav.chat' },
      { to: '/ai/history', icon: History, labelKey: 'ai.nav.history' },
      { to: '/ai/prompts', icon: Sparkles, labelKey: 'ai.nav.prompts' },
    ],
  },
  {
    labelKey: 'ai.nav.manage',
    items: [
      { to: '/ai/settings', icon: Settings, labelKey: 'ai.nav.settings' },
      { to: '/ai/admin', icon: Shield, labelKey: 'ai.nav.admin' },
    ],
  },
] as const;

export function AiLayout() {
  const { t } = useI18n();
  const { user } = useAuth();
  const perm = useMemo(() => buildAiPermCheck(user?.roles ?? []), [user?.roles]);
  const overviewQuery = useAiOverview(canViewAi(perm));

  if (!canViewAi(perm)) {
    return <AuthAlert variant="error">{t('ai.accessDenied')}</AuthAlert>;
  }

  return (
    <div className={e.layoutShell} id="ai-region">
      <a href="#ai-main" className={e.skipLink}>
        {t('ai.a11y.skipToContent')}
      </a>
      <header className={e.layoutHero}>
        <div>
          <h1 className={e.layoutHeroTitle}>
            <Bot size={28} aria-hidden style={{ verticalAlign: 'middle', marginInlineEnd: 10 }} />
            {t('ai.title')}
          </h1>
          <p className={e.layoutHeroSubtitle}>{t('ai.subtitle')}</p>
        </div>
        <span className={[e.livePill, e.livePillOn].join(' ')} role="status">
          <span className={e.liveDot} aria-hidden />
          {overviewQuery.data?.messagesToday ?? 0} {t('ai.dashboard.todayActivity')}
        </span>
      </header>

      <div className={e.layoutGrid}>
        <nav className={e.layoutNav} aria-label={t('ai.title')}>
          {navGroups.map((group) => (
            <div key={group.labelKey}>
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
        <main id="ai-main" className={e.shell} tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

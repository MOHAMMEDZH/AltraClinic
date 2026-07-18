import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { GlobalSearchProvider } from '@/app/providers/GlobalSearchProvider';
import { DynamicSearchProvider } from '@/features/dynamic-search/context/DynamicSearchProvider';
import { AiAssistantProvider } from '@/features/ai/providers/AiAssistantProvider';
import { AiGlobalSmartActions } from '@/features/ai/components/AiGlobalSmartActions';
import { DynamicNavigationProvider } from '@/features/dynamic-navigation/context/DynamicNavigationProvider';
import { ShellRouteRenderer } from '@/features/dynamic-routing/components/ShellRouteRenderer';
import { isRegistryRoutingEnabled } from '@/features/dynamic-routing/lib/static-route-flags';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import styles from './AppShell.module.css';

function AppShellFrame() {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const useRegistryRoutes = isRegistryRoutingEnabled();

  return (
    <div className={styles.appShell}>
      <a href="#main-content" className="skip-link">
        {t('shell.skipToContent')}
      </a>

      <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((v) => !v)} />

      <Sidebar
        variant="drawer"
        collapsed={false}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        onToggleCollapse={() => undefined}
      />

      {mobileOpen && (
        <button
          type="button"
          className={styles.overlay}
          aria-label={t('shell.menu')}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className={styles.mainColumn}>
        <TopNav onOpenMobileNav={() => setMobileOpen(true)} />
        <div className={styles.smartActionsSlot}>
          <AiGlobalSmartActions />
        </div>
        <main id="main-content" className={styles.content}>
          {useRegistryRoutes ? <ShellRouteRenderer /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}

export function AppShell() {
  return (
    <DynamicSearchProvider>
      <GlobalSearchProvider>
        <AiAssistantProvider>
          <DynamicNavigationProvider>
            <AppShellFrame />
          </DynamicNavigationProvider>
        </AiAssistantProvider>
      </GlobalSearchProvider>
    </DynamicSearchProvider>
  );
}

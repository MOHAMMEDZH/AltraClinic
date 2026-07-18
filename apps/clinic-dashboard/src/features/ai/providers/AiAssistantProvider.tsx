import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AiCommandPalette } from '../components/command/AiCommandPalette';
import { AiSidebarPanel } from '../components/AiSidebarPanel';

interface AiAssistantContextValue {
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  openCommand: () => void;
  sidebarOpen: boolean;
}

const AiAssistantContext = createContext<AiAssistantContextValue>({
  openSidebar: () => {},
  closeSidebar: () => {},
  toggleSidebar: () => {},
  openCommand: () => {},
  sidebarOpen: false,
});

export function useAiAssistant() {
  return useContext(AiAssistantContext);
}

export function AiAssistantProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const openCommand = useCallback(() => setCommandOpen(true), []);
  const closeCommand = useCallback(() => setCommandOpen(false), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        setSidebarOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const value = useMemo(
    () => ({ openSidebar, closeSidebar, toggleSidebar, openCommand, sidebarOpen }),
    [openSidebar, closeSidebar, toggleSidebar, openCommand, sidebarOpen],
  );

  useEffect(() => {
    if (!sidebarOpen || commandOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSidebar();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen, commandOpen, closeSidebar]);

  return (
    <AiAssistantContext.Provider value={value}>
      {children}
      <AiSidebarPanel open={sidebarOpen} onClose={closeSidebar} onOpenCommand={openCommand} />
      <AiCommandPalette open={commandOpen} onClose={closeCommand} />
    </AiAssistantContext.Provider>
  );
}

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { GlobalSearchDialog } from '@/features/search/components/GlobalSearchDialog';

interface GlobalSearchContextValue {
  open: () => void;
}

const GlobalSearchContext = createContext<GlobalSearchContextValue>({ open: () => {} });

export function useGlobalSearch(): GlobalSearchContextValue {
  return useContext(GlobalSearchContext);
}

export function GlobalSearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openSearch = useCallback(() => setOpen(true), []);
  const closeSearch = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <GlobalSearchContext.Provider value={{ open: openSearch }}>
      {children}
      <GlobalSearchDialog open={open} onClose={closeSearch} />
    </GlobalSearchContext.Provider>
  );
}

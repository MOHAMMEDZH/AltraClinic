import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type ReportCrossFilterMetric = 'revenue' | 'appointments' | 'patients' | 'queue' | null;

interface ReportCrossFilterState {
  activeMetric: ReportCrossFilterMetric;
  setActiveMetric: (metric: ReportCrossFilterMetric) => void;
  toggleMetric: (metric: Exclude<ReportCrossFilterMetric, null>) => void;
}

const ReportCrossFilterContext = createContext<ReportCrossFilterState | null>(null);

export function ReportCrossFilterProvider({ children }: { children: ReactNode }) {
  const [activeMetric, setActiveMetric] = useState<ReportCrossFilterMetric>(null);

  const toggleMetric = useCallback((metric: Exclude<ReportCrossFilterMetric, null>) => {
    setActiveMetric((current) => (current === metric ? null : metric));
  }, []);

  const value = useMemo(
    () => ({ activeMetric, setActiveMetric, toggleMetric }),
    [activeMetric, toggleMetric],
  );

  return (
    <ReportCrossFilterContext.Provider value={value}>{children}</ReportCrossFilterContext.Provider>
  );
}

export function useReportCrossFilter(): ReportCrossFilterState {
  const ctx = useContext(ReportCrossFilterContext);
  if (!ctx) {
    return {
      activeMetric: null,
      setActiveMetric: () => undefined,
      toggleMetric: () => undefined,
    };
  }
  return ctx;
}

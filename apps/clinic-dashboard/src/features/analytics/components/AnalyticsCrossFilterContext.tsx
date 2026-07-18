import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface AnalyticsCrossFilterSelection {
  chartId: string;
  dimension: string;
  value: string;
}

interface AnalyticsCrossFilterState {
  selection: AnalyticsCrossFilterSelection | null;
  setSelection: (selection: AnalyticsCrossFilterSelection | null) => void;
  toggleSelection: (selection: AnalyticsCrossFilterSelection) => void;
  matches: (dimension: string, value: string) => boolean;
  isActive: boolean;
}

const AnalyticsCrossFilterContext = createContext<AnalyticsCrossFilterState | null>(null);

export function AnalyticsCrossFilterProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<AnalyticsCrossFilterSelection | null>(null);

  const toggleSelection = useCallback((next: AnalyticsCrossFilterSelection) => {
    setSelection((current) =>
      current?.chartId === next.chartId &&
      current.dimension === next.dimension &&
      current.value === next.value
        ? null
        : next,
    );
  }, []);

  const matches = useCallback(
    (dimension: string, value: string) =>
      !selection || (selection.dimension === dimension && selection.value === value),
    [selection],
  );

  const value = useMemo(
    () => ({
      selection,
      setSelection,
      toggleSelection,
      matches,
      isActive: selection !== null,
    }),
    [selection, toggleSelection, matches],
  );

  return (
    <AnalyticsCrossFilterContext.Provider value={value}>{children}</AnalyticsCrossFilterContext.Provider>
  );
}

export function useAnalyticsCrossFilter(): AnalyticsCrossFilterState {
  const ctx = useContext(AnalyticsCrossFilterContext);
  if (!ctx) {
    return {
      selection: null,
      setSelection: () => undefined,
      toggleSelection: () => undefined,
      matches: () => true,
      isActive: false,
    };
  }
  return ctx;
}

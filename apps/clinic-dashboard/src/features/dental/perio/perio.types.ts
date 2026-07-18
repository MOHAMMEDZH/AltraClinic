export const PERIO_SITES = ['mb', 'b', 'db', 'ml', 'l', 'dl'] as const;
export type PerioSiteId = (typeof PERIO_SITES)[number];

export interface PerioSiteMeasurement {
  pd: number;
  recession: number;
  bop: boolean;
}

export interface PerioToothRecord {
  toothNumber: number;
  mobility: number;
  furcation: number | null;
  plaqueIndex: number;
  sites: Record<PerioSiteId, PerioSiteMeasurement>;
  missing?: boolean;
}

export type PerioStage = 'healthy' | 'gingivitis' | 'mild' | 'moderate' | 'severe';

export interface PerioAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  code: string;
  toothNumber?: number;
  site?: string;
  params?: Record<string, string | number>;
}

export interface PerioSummary {
  teethCharted: number;
  sitesProbed: number;
  bopCount: number;
  bopPercent: number;
  sitesPd4Plus: number;
  sitesPd5Plus: number;
  sitesPd6Plus: number;
  maxPocketDepth: number;
  avgPocketDepth: number;
  teethWithMobility: number;
  teethWithFurcation: number;
  avgPlaqueIndex: number;
  stage: PerioStage;
  alerts: PerioAlert[];
}

export interface PerioExamSummary {
  id: string;
  patientId: string;
  recordedBy: string;
  examDate: string;
  notes: string | null;
  summary: PerioSummary;
  createdAt: string;
  updatedAt: string;
}

export interface PerioExamDetail extends PerioExamSummary {
  teeth: PerioToothRecord[];
}

export interface PerioProgressPoint {
  examId: string;
  examDate: string;
  bopPercent: number;
  avgPocketDepth: number;
  sitesPd4Plus: number;
  sitesPd5Plus: number;
  sitesPd6Plus: number;
  maxPocketDepth: number;
  stage: PerioStage;
}

export interface PerioProgress {
  points: PerioProgressPoint[];
  latest: PerioProgressPoint | null;
  baseline: PerioProgressPoint | null;
  delta: {
    bopPercent: number;
    avgPocketDepth: number;
    sitesPd4Plus: number;
    maxPocketDepth: number;
  } | null;
}

export interface PerioCompareResult {
  baseline: { id: string; examDate: string; summary: PerioSummary };
  compare: { id: string; examDate: string; summary: PerioSummary };
  toothDeltas: {
    toothNumber: number;
    maxPdDelta: number;
    bopDelta: number;
    baselineMaxPd: number;
    compareMaxPd: number;
  }[];
  summaryDelta: {
    bopPercent: number;
    avgPocketDepth: number;
    sitesPd4Plus: number;
    maxPocketDepth: number;
  };
}

export type PerioViewMode = 'chart' | 'history' | 'progress';

export interface UpdatePerioExamPayload {
  examDate?: string;
  notes?: string | null;
  teeth?: PerioToothRecord[];
}

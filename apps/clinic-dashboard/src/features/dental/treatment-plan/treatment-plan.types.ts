export type TreatmentPlanStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type TreatmentItemStatus =
  | 'planned'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'blocked';

export interface TreatmentPlanItem {
  id: string;
  phaseId: string;
  sortOrder: number;
  code: string;
  description: string;
  toothNumbers: number[];
  status: TreatmentItemStatus;
  estimatedMinutes: number;
  estimatedCost: number;
  dependsOnItemId: string | null;
  completedAt: string | null;
  insuranceEligible: boolean;
  insuranceEstimate: number | null;
  patientPortion: number | null;
  requiresPreAuth: boolean;
  preAuthStatus: string | null;
}

export interface TreatmentPhase {
  id: string;
  name: string;
  sortOrder: number;
  visitNumber: number | null;
  estimatedVisitDate: string | null;
  clinicalNotes: string | null;
  items: TreatmentPlanItem[];
}

export interface PlanAlternative {
  id: string;
  label: string;
  description: string;
  estimatedCost: number;
  notes: string;
}

export interface InsuranceSnapshot {
  provider?: string;
  memberId?: string;
  groupNumber?: string;
  planType?: string;
  coveragePercent?: number;
  annualMaximum?: number;
  deductibleRemaining?: number;
  alternatives?: PlanAlternative[];
}

export interface TreatmentPlanSummary {
  id: string;
  patientId: string;
  title: string;
  status: TreatmentPlanStatus;
  totalEstimatedCost: number;
  totalEstimatedMinutes: number;
  currency: string;
  consentSignedAt: string | null;
  approvedAt: string | null;
  progress: number;
  procedureCount: number;
  completedCount: number;
  phaseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TreatmentPlanDetail extends TreatmentPlanSummary {
  clinicalNotes: string | null;
  insuranceSnapshot: InsuranceSnapshot;
  submittedAt: string | null;
  approvedBy: string | null;
  consentMethod: string | null;
  phases: TreatmentPhase[];
  remainingProcedures: number;
}

export interface TreatmentPlanAnalytics {
  planCount: number;
  totalRevenue: number;
  completedRevenue: number;
  pendingRevenue: number;
  totalProcedures: number;
  completedProcedures: number;
  completionRate: number;
  plansByStatus: Record<string, number>;
  revenueByMonth: { month: string; forecast: number; completed: number }[];
  topPlans: {
    id: string;
    title: string;
    patientName: string;
    status: string;
    totalEstimatedCost: number;
    progress: number;
  }[];
}

export interface CreateTreatmentPlanPayload {
  patientId: string;
  title: string;
  clinicalNotes?: string | null;
  insuranceSnapshot?: InsuranceSnapshot;
  phases?: Omit<TreatmentPhase, 'id'>[];
}

export interface UpdateTreatmentPlanPayload {
  title?: string;
  clinicalNotes?: string | null;
  insuranceSnapshot?: InsuranceSnapshot;
  phases?: TreatmentPhase[];
}

export type TreatmentPlanViewMode = 'doctor' | 'patient' | 'management';

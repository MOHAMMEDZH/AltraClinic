export type BeautyViewMode = 'practitioner' | 'reception' | 'manager';

export type BeautyWorkspaceTab =
  | 'overview'
  | 'consultation'
  | 'face'
  | 'body'
  | 'plans'
  | 'sessions'
  | 'skincare'
  | 'materials'
  | 'gallery'
  | 'measurements'
  | 'timeline';

export type MapView = 'front' | 'left' | 'right' | 'back';

export interface BeautyProfile {
  skinType: string | null;
  concerns: string[];
  allergies: string[];
  notes: string;
}

export type ConsultationType = 'initial' | 'follow_up';
export type ConsultationStatus = 'draft' | 'completed';

export interface BeautyConsultation {
  id: string;
  type: ConsultationType;
  status: ConsultationStatus;
  date: string;
  clinicianId: string;
  skinAssessment?: Record<string, string>;
  facialAssessment?: Record<string, string>;
  bodyAssessment?: Record<string, string>;
  recommendations?: string[];
  notes?: string;
  consentPhoto?: boolean;
  consentTreatment?: boolean;
}

export interface PlanSessionStep {
  id: string;
  type: string;
  label: string;
  estimatedCost: number;
  scheduledAt?: string | null;
}

export interface BeautyTreatmentPlan {
  id: string;
  title: string;
  status: 'draft' | 'approved' | 'active' | 'completed' | 'cancelled';
  procedures: string[];
  sessionSequence: PlanSessionStep[];
  sessionsPlanned: number;
  sessionsCompleted: number;
  estimatedCost: number;
  approvedAt?: string;
  approvedBy?: string;
  notes?: string;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
}

export interface BeautySession {
  id: string;
  planId?: string;
  planStepId?: string;
  appointmentId?: string | null;
  type: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'follow_up_due';
  scheduledAt: string;
  completedAt?: string | null;
  clinicianId: string;
  outcome?: string | null;
  notes?: string;
  products?: { name: string; units?: number; volumeCc?: number; lot?: string }[];
  laserSettings?: { fluence?: number; joules?: number; device?: string };
  comparisonGroupId?: string | null;
  beforeMediaId?: string | null;
  afterMediaId?: string | null;
  followUpAt?: string | null;
  measurementIds?: string[];
}

export interface BeautyMeasurement {
  id: string;
  type: 'weight' | 'circumference' | 'custom';
  label: string;
  value: number;
  unit: string;
  recordedAt: string;
}

export interface BeautyConsent {
  id: string;
  type: string;
  granted: boolean;
  grantedAt?: string;
  grantedBy?: string;
}

export interface SkincareRegimenItem {
  id: string;
  productName: string;
  frequency: string;
  notes: string;
  startedAt: string;
}

export interface BeautyBodyMapState {
  version: number;
  profile: BeautyProfile;
  consultations: BeautyConsultation[];
  treatmentPlans: BeautyTreatmentPlan[];
  sessions: BeautySession[];
  measurements: BeautyMeasurement[];
  consents: BeautyConsent[];
  skincareRegimens: SkincareRegimenItem[];
  financialSummary?: BeautyFinancialSummary;
}

export interface BeautyFinancialSummary {
  totalEstimated: number;
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
  linkedInvoices: { planId: string; invoiceId: string; invoiceNumber: string; amount: number; paid: number }[];
}

export interface BeautyAnnotation {
  id: string;
  zone: string;
  treatment: string;
  coordinates: { x: number; y: number; view: string };
  parameters: Record<string, unknown>;
  recordedBy: string;
  recordedAt: string;
  notes: string | null;
}

export interface BeautyRecord {
  id: string;
  patientId: string;
  bodyMapState: BeautyBodyMapState;
  annotations: BeautyAnnotation[];
  createdAt: string;
  updatedAt: string;
}

export interface BeautyMetricsSummary {
  recordsTotal: number;
  activePlans: number;
  sessionsThisWeek: number;
  followUpDue: number;
  beforeAfterPairs: number;
  revenueEstimate: number;
}

export interface BeautyAnalyticsSummary {
  revenuePipeline: number;
  revenueCollected: number;
  conversionRate: number;
  retentionRate: number;
  avgSessionsPerPlan: number;
  topTreatments: { type: string; count: number }[];
  practitionerLoad: { clinicianId: string; sessions: number; practitionerName?: string }[];
}

export interface BeautyOverviewItem {
  patientId: string;
  patientName: string;
  recordId: string;
  activePlans: number;
  sessionCount: number;
  lastUpdated: string;
  nextSession?: string | null;
}

export interface CreateAnnotationPayload {
  zone: string;
  treatment: string;
  coordinates: { x: number; y: number; view: string };
  parameters?: Record<string, unknown>;
  notes?: string | null;
}

export interface BeautyClinicalInventoryItem {
  itemId: string;
  sku: string;
  nameEn: string;
  nameAr: string | null;
  unit: string;
  quantityOnHand: number;
}

export interface BeautyProcedureMaterialMapping {
  mappingId: string;
  itemId: string;
  sku: string;
  nameEn: string;
  nameAr: string | null;
  unit: string;
  defaultQuantity: number;
  quantityOnHand: number;
  notes: string | null;
}

export interface BeautyMaterialUsage {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  quantityUsed: number;
  unit: string;
  consumedBy: string;
  notes: string | null;
  encounterId: string | null;
  patientId: string | null;
  procedureCode: string | null;
  consumedAt: string;
}

export interface BeautyMaterialsResponse {
  consumptions: BeautyMaterialUsage[];
  total: number;
  limit: number;
  offset: number;
}

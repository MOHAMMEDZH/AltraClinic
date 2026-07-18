export type AiMessageRole = 'user' | 'assistant' | 'system';

export interface AiRouteContext {
  path: string;
  module?: string;
  patientId?: string;
  encounterId?: string;
  appointmentId?: string;
  invoiceId?: string;
  workflowId?: string;
  inventoryItemId?: string;
  reportId?: string;
  analyticsDomain?: string;
  dentalPatientId?: string;
  beautyPatientId?: string;
  [key: string]: unknown;
}

export interface AiSettings {
  preferredLanguage: 'en-US' | 'ar-SY';
  preferredModel: string;
  responseLength: 'concise' | 'balanced' | 'detailed';
  streaming: boolean;
  temperature: number;
  saveHistory: boolean;
  voiceReady: boolean;
}

export const AI_CONVERSATION_VIRTUAL_THRESHOLD = 20;

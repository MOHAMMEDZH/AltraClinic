export type AiProviderId = 'gemini' | 'openai' | 'template' | 'skill';

export type AiResponseLength = 'concise' | 'balanced' | 'detailed';

export interface AiInferenceAttachment {
  name: string;
  mimeType: string;
  dataUrl?: string;
}

export interface AiUserPreferences {
  preferredLanguage?: string;
  preferredModel?: string;
  preferredProvider?: AiProviderId;
  responseLength?: AiResponseLength;
  streaming?: boolean;
  temperature?: number;
  saveHistory?: boolean;
  voiceReady?: boolean;
}

export interface AiInferenceInput {
  tenantId: string;
  userId: string;
  userMessage: string;
  workspaceId?: string | null;
  context?: Record<string, unknown> | null;
  locale?: string;
  conversationId?: string;
  attachments?: AiInferenceAttachment[];
  preferences?: AiUserPreferences;
  tenantProviderSettings?: import('../../domain/config/ai-tenant-provider.config').AiTenantProviderSettings;
  /** When true, skip external LLM providers and use template fallback only. */
  forceTemplateOnly?: boolean;
}

export interface AiCitation {
  label: string;
  resourceType: string;
  resourceId: string;
}

export interface AiInferenceResult {
  content: string;
  citations: AiCitation[];
  tokenCount: number;
  latencyMs: number;
  provider: AiProviderId;
  model: string;
  /** Set when provider is `skill`. */
  skillId?: string;
}

export interface AiEnrichedContext {
  systemPrompt: string;
  /** Structured ERP facts gathered for inference (also used by template fallback). */
  contextBlocks: string[];
  citations: AiCitation[];
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  userParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
}

export interface AiProviderHealth {
  provider: AiProviderId;
  configured: boolean;
  status: 'healthy' | 'degraded' | 'unavailable';
  model: string;
  latencyMs?: number;
  message?: string;
}

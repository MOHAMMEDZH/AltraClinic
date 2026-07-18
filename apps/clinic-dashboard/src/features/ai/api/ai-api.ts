import { API_BASE, ApiError, apiRequest } from '@/lib/api-client';
import type { AiModelType } from '../config/ai-config';
import type { AiRouteContext } from '../lib/ai-types';

export interface AiProviderStatus {
  geminiConfigured: boolean;
  openaiConfigured: boolean;
  geminiModel: string;
  openaiModel: string;
  templateFallback: boolean;
}

export interface AiOverview {
  activeConversations: number;
  tokensConsumed: number;
  messagesToday: number;
  deployedModels: number;
  successRate: number;
  avgResponseMs: number;
  lastActivityAt: string | null;
  providerStatus?: AiProviderStatus;
  providerHealth?: AiProviderHealthResponse;
  subscription?: AiSubscriptionLimitsDto;
}

export interface AiProviderHealthDto {
  provider: string;
  configured: boolean;
  status: 'healthy' | 'degraded' | 'unavailable';
  model: string;
  latencyMs?: number;
  message?: string;
}

export interface AiProviderHealthResponse {
  activeProvider: string;
  providers: AiProviderHealthDto[];
  checkedAt: string;
}

export interface AiSubscriptionLimitsDto {
  plan: string;
  messagesToday: number;
  tokensTodayTenant: number;
  limits: {
    maxMessagesPerUserPerDay: number;
    maxTokensPerTenantPerDay: number;
    maxRequestsPerMinute: number;
    attachmentsEnabled: boolean;
    externalProvidersEnabled: boolean;
    workspaces: string[] | 'all';
    customPromptsEnabled: boolean;
  };
}

export interface AiMessageDto {
  messageId: string;
  role: string;
  content: string;
  citations?: unknown;
  attachments?: unknown;
  tokenCount?: number;
  createdAt: string;
}

export interface AiConversationDto {
  conversationId: string;
  title: string;
  workspaceId: string | null;
  pinned: boolean;
  context: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  messages: AiMessageDto[];
}

export interface AiPromptDto {
  promptId: string;
  category: string;
  titleEn: string;
  titleAr: string | null;
  bodyEn: string;
  bodyAr: string | null;
  favorite: boolean;
  userId: string | null;
  roles: string[];
  version: number;
  isTenantDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiPromptVersionDto {
  versionId: string;
  version: number;
  category: string;
  titleEn: string;
  titleAr: string | null;
  bodyEn: string;
  bodyAr: string | null;
  favorite: boolean;
  roles: string[];
  createdAt: string;
  createdBy: string | null;
}

export interface AiPromptCategoryDto {
  id: string;
  labelKey: string;
  roles: string[];
}

export interface PatientCopilotDto {
  patientId: string;
  summary: Record<string, unknown>;
  visitCount: number;
  recentEncounters: Array<Record<string, unknown>>;
  upcomingAppointments: Array<Record<string, unknown>>;
  allergies: unknown[];
  riskIndicators: string[];
  suggestedActions: string[];
}

export interface AiModelSummary {
  modelId: string;
  tenantId: string;
  branchId: string | null;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  modelType: AiModelType | string;
  version: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiAdminUsage {
  totalTokens: number;
  totalMessages: number;
  successCount: number;
  failureCount: number;
  activeUsers: number;
  daily: Array<{ date: string; tokens: number; messages: number }>;
  monthly?: Array<{ month: string; tokens: number; messages: number }>;
}

export interface AiTenantProviderSettings {
  preferredExternalProvider: 'gemini' | 'openai' | 'auto';
  geminiEnabled: boolean;
  openaiEnabled: boolean;
}

export interface AiTenantProviderManagement {
  settings: AiTenantProviderSettings;
  effectiveActiveProvider: string;
  canManage: boolean;
  lockedReasonKey?: string;
  providers: AiProviderHealthDto[];
}

export interface AiAdminOverview {
  usage: AiAdminUsage & { monthly: Array<{ month: string; tokens: number; messages: number }> };
  topUsers: Array<{ userId: string; email: string; messages: number; tokens: number }>;
  providerBreakdown: Array<{ provider: string; count: number }>;
  skillBreakdown: Array<{ skillId: string; count: number }>;
  limits: Awaited<ReturnType<typeof fetchAiSubscriptionLimits>>;
  featureFlags: {
    builtinOnlyMode: boolean;
    externalProvidersEnabled: boolean;
    attachmentsEnabled: boolean;
    customPromptsEnabled: boolean;
    workspaces: string[] | 'all';
  };
  providers: AiProviderHealthDto[];
  activeProvider: string;
  costEstimate: {
    currency: 'USD';
    periodTokens: number;
    estimatedExternalCost: number;
    noteKey: string;
  };
  skills: Array<{ id: string; workspace?: string }>;
  auditLog: Array<{
    id: string;
    actorId: string;
    createdAt: string;
    provider: string;
    skillId: string | null;
    tokenCount: number;
    latencyMs: number;
    conversationId: string;
  }>;
  providerManagement: AiTenantProviderManagement;
}

export async function fetchAiAdminUsage(token: string, tenantId: string) {
  return apiRequest<AiAdminUsage>('/ai/admin/usage', { token, tenantId });
}

export async function fetchAiAdminOverview(token: string, tenantId: string) {
  return apiRequest<AiAdminOverview>('/ai/admin/overview', { token, tenantId });
}

export async function fetchAiAdminProviders(token: string, tenantId: string) {
  return apiRequest<AiTenantProviderManagement>('/ai/admin/providers', { token, tenantId });
}

export async function updateAiAdminProviders(
  token: string,
  tenantId: string,
  body: Partial<AiTenantProviderSettings>,
) {
  return apiRequest<AiTenantProviderSettings>('/ai/admin/providers', {
    token,
    tenantId,
    method: 'PATCH',
    body,
  });
}

function parseSseChunk(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return typeof parsed === 'string' ? parsed : trimmed;
  } catch {
    return trimmed;
  }
}

export async function fetchAiProviderHealth(token: string, tenantId: string) {
  return apiRequest<AiProviderHealthResponse>('/ai/providers/health', { token, tenantId });
}

export async function fetchAiSubscriptionLimits(token: string, tenantId: string) {
  return apiRequest<AiSubscriptionLimitsDto>('/ai/subscription/limits', { token, tenantId });
}

export interface AiSmartActionDto {
  id: string;
  labelKey: string;
  prompt: string;
  workspaceId: string | null;
}

export interface AiCommandResolveItemDto {
  id: string;
  kind: 'navigate' | 'action' | 'ask';
  labelKey: string;
  score: number;
  disabled: boolean;
  disabledReasonKey?: string;
  path?: string;
  prompt?: string;
  workspaceId: string | null;
  skillId?: string;
}

export interface AiContextSummaryItemDto {
  key: string;
  labelKey: string;
  value: string;
  resourceType?: string;
  resourceId?: string;
}

export interface AiContextSummaryDto {
  module: string;
  moduleLabelKey: string;
  items: AiContextSummaryItemDto[];
}

type AiContextQuery = {
  path: string;
  module?: string;
  patientId?: string;
  encounterId?: string;
  invoiceId?: string;
  workflowId?: string;
  appointmentId?: string;
  inventoryItemId?: string;
  reportId?: string;
  analyticsDomain?: string;
  dentalPatientId?: string;
  beautyPatientId?: string;
  locale?: string;
};

function appendContextQuery(query: URLSearchParams, params: AiContextQuery) {
  query.set('path', params.path);
  if (params.module) query.set('module', params.module);
  if (params.patientId) query.set('patientId', params.patientId);
  if (params.encounterId) query.set('encounterId', params.encounterId);
  if (params.invoiceId) query.set('invoiceId', params.invoiceId);
  if (params.workflowId) query.set('workflowId', params.workflowId);
  if (params.appointmentId) query.set('appointmentId', params.appointmentId);
  if (params.inventoryItemId) query.set('inventoryItemId', params.inventoryItemId);
  if (params.reportId) query.set('reportId', params.reportId);
  if (params.analyticsDomain) query.set('analyticsDomain', params.analyticsDomain);
  if (params.dentalPatientId) query.set('dentalPatientId', params.dentalPatientId);
  if (params.beautyPatientId) query.set('beautyPatientId', params.beautyPatientId);
  if (params.locale) query.set('locale', params.locale);
}

export async function fetchAiContextSummary(token: string, tenantId: string, params: AiContextQuery) {
  const query = new URLSearchParams();
  appendContextQuery(query, params);
  return apiRequest<AiContextSummaryDto>(`/ai/context/summary?${query.toString()}`, { token, tenantId });
}

export async function fetchAiCommandResolve(
  token: string,
  tenantId: string,
  params: AiContextQuery & { q?: string },
) {
  const query = new URLSearchParams();
  appendContextQuery(query, params);
  if (params.q) query.set('q', params.q);
  return apiRequest<{ items: AiCommandResolveItemDto[] }>(`/ai/commands/resolve?${query.toString()}`, {
    token,
    tenantId,
  });
}

export async function fetchAiSmartActions(token: string, tenantId: string, params: AiContextQuery) {
  const query = new URLSearchParams();
  appendContextQuery(query, params);
  return apiRequest<{ actions: AiSmartActionDto[] }>(`/ai/smart-actions?${query.toString()}`, {
    token,
    tenantId,
  });
}

export async function* streamAiMessage(
  token: string,
  tenantId: string,
  conversationId: string,
  body: {
    content: string;
    attachments?: Array<{ name: string; mimeType: string; dataUrl?: string }>;
    context?: Record<string, unknown>;
  },
  options?: { signal?: AbortSignal },
): AsyncGenerator<string, void, void> {
  const response = await fetch(`${API_BASE}/ai/conversations/${conversationId}/messages/stream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': tenantId,
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!response.ok) {
    const text = await response.text();
    let message = response.statusText;
    let body: Record<string, unknown> | undefined;
    try {
      const data = JSON.parse(text) as { message?: string; upgradeRequired?: boolean };
      body = data;
      if (data.message) message = data.message;
    } catch {
      if (text) message = text;
    }
    throw new ApiError(message, response.status, body);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    if (options?.signal?.aborted) {
      await reader.cancel();
      throw new DOMException('Aborted', 'AbortError');
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const event of events) {
      if (event.startsWith('event: error')) {
        const dataLine = event.split('\n').find((line) => line.startsWith('data:'));
        const message = dataLine ? parseSseChunk(dataLine.slice(5).trim()) : 'Stream failed';
        throw new ApiError(message, 500);
      }
      if (event.startsWith('event: done')) continue;
      for (const line of event.split('\n')) {
        if (line.startsWith('data:')) {
          const chunk = parseSseChunk(line.slice(5).trim());
          if (chunk) yield chunk;
        }
      }
    }
  }
}

export async function fetchAiOverview(token: string, tenantId: string) {
  return apiRequest<AiOverview>('/ai/overview', { token, tenantId });
}

export async function fetchAiConversations(token: string, tenantId: string, search?: string) {
  const q = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  return apiRequest<AiConversationDto[]>(`/ai/conversations${q}`, { token, tenantId });
}

export async function fetchAiConversation(token: string, tenantId: string, conversationId: string) {
  return apiRequest<AiConversationDto>(`/ai/conversations/${conversationId}`, { token, tenantId });
}

export async function createAiConversation(
  token: string,
  tenantId: string,
  body: {
    title?: string;
    workspaceId?: string;
    context?: AiRouteContext;
    initialMessage?: string;
  },
) {
  return apiRequest<AiConversationDto>('/ai/conversations', { method: 'POST', token, tenantId, body });
}

export async function updateAiConversation(
  token: string,
  tenantId: string,
  conversationId: string,
  body: { title?: string; pinned?: boolean },
) {
  return apiRequest<AiConversationDto>(`/ai/conversations/${conversationId}`, {
    method: 'PATCH',
    token,
    tenantId,
    body,
  });
}

export async function deleteAiConversation(token: string, tenantId: string, conversationId: string) {
  return apiRequest<{ ok: boolean }>(`/ai/conversations/${conversationId}`, {
    method: 'DELETE',
    token,
    tenantId,
  });
}

export async function sendAiMessage(
  token: string,
  tenantId: string,
  conversationId: string,
  body: {
    content: string;
    attachments?: Array<{ name: string; mimeType: string; dataUrl?: string }>;
    context?: Record<string, unknown>;
  },
) {
  return apiRequest<{
    userMessage: { messageId: string; role: string; content: string };
    assistantMessage: {
      messageId: string;
      role: string;
      content: string;
      citations: unknown;
      tokenCount: number;
    };
  }>(`/ai/conversations/${conversationId}/messages`, { method: 'POST', token, tenantId, body });
}

export async function exportAiConversation(token: string, tenantId: string, conversationId: string) {
  return apiRequest<{ export: string }>(`/ai/conversations/${conversationId}/export`, { token, tenantId });
}

export async function fetchPatientCopilot(token: string, tenantId: string, patientId: string) {
  return apiRequest<PatientCopilotDto>(`/ai/copilot/patient/${patientId}`, { token, tenantId });
}

export async function fetchAiPromptCategories(token: string, tenantId: string) {
  return apiRequest<AiPromptCategoryDto[]>('/ai/prompts/categories', { token, tenantId });
}

export async function fetchAiPrompts(
  token: string,
  tenantId: string,
  category?: string,
  search?: string,
  favoritesOnly?: boolean,
) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (search) params.set('search', search);
  if (favoritesOnly) params.set('favoritesOnly', 'true');
  const q = params.toString() ? `?${params}` : '';
  return apiRequest<AiPromptDto[]>(`/ai/prompts${q}`, { token, tenantId });
}

export async function saveAiPrompt(token: string, tenantId: string, body: Record<string, unknown>) {
  return apiRequest<{ promptId: string }>('/ai/prompts', { method: 'POST', token, tenantId, body });
}

export async function updateAiPrompt(token: string, tenantId: string, promptId: string, body: Record<string, unknown>) {
  return apiRequest<{ promptId: string }>(`/ai/prompts/${promptId}`, { method: 'PATCH', token, tenantId, body });
}

export async function deleteAiPrompt(token: string, tenantId: string, promptId: string) {
  return apiRequest<{ ok: boolean }>(`/ai/prompts/${promptId}`, { method: 'DELETE', token, tenantId });
}

export async function duplicateAiPrompt(token: string, tenantId: string, promptId: string) {
  return apiRequest<{ promptId: string }>(`/ai/prompts/${promptId}/duplicate`, { method: 'POST', token, tenantId });
}

export async function toggleAiPromptFavorite(
  token: string,
  tenantId: string,
  promptId: string,
  favorite: boolean,
) {
  return apiRequest<{ promptId: string; favorite: boolean }>(`/ai/prompts/${promptId}/favorite`, {
    method: 'PATCH',
    token,
    tenantId,
    body: { favorite },
  });
}

export async function fetchAiPromptVersions(token: string, tenantId: string, promptId: string) {
  return apiRequest<AiPromptVersionDto[]>(`/ai/prompts/${promptId}/versions`, { token, tenantId });
}

export async function restoreAiPromptVersion(
  token: string,
  tenantId: string,
  promptId: string,
  versionId: string,
) {
  return apiRequest<{ promptId: string; version: number }>(
    `/ai/prompts/${promptId}/versions/${versionId}/restore`,
    { method: 'POST', token, tenantId },
  );
}

export async function fetchAiSettings(token: string, tenantId: string) {
  return apiRequest<Record<string, unknown>>('/ai/settings', { token, tenantId });
}

export async function saveAiSettingsApi(token: string, tenantId: string, body: Record<string, unknown>) {
  return apiRequest<Record<string, unknown>>('/ai/settings', { method: 'PATCH', token, tenantId, body });
}

export type ListAiModelsParams = Record<string, string | number>;

export type CreateAiModelBody = {
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  modelType: AiModelType;
  version: string;
};

export async function fetchAiModel(token: string, tenantId: string, modelId: string) {
  return apiRequest<AiModelSummary>(`/ai/models/${modelId}`, { token, tenantId });
}

export async function fetchAiModels(token: string, tenantId: string, params?: ListAiModelsParams) {
  const q = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => q.set(k, String(v)));
  }
  const suffix = q.toString() ? `?${q}` : '';
  return apiRequest<AiModelSummary[]>(`/ai/models${suffix}`, { token, tenantId });
}

export async function createAiModel(
  token: string,
  tenantId: string,
  body: CreateAiModelBody,
) {
  return apiRequest<AiModelSummary>('/ai/models', { method: 'POST', token, tenantId, body });
}

export async function validateAiModel(token: string, tenantId: string, modelId: string, notes?: string) {
  return apiRequest<AiModelSummary>(`/ai/models/${modelId}/validate`, {
    method: 'POST',
    token,
    tenantId,
    body: notes ? { notes } : {},
  });
}

export async function deployAiModel(token: string, tenantId: string, modelId: string) {
  return apiRequest<AiModelSummary>(`/ai/models/${modelId}/deploy`, { method: 'POST', token, tenantId });
}

export async function retireAiModel(token: string, tenantId: string, modelId: string) {
  return apiRequest<AiModelSummary>(`/ai/models/${modelId}/retire`, { method: 'POST', token, tenantId });
}

import { API_BASE, ApiError, apiRequest } from '@/lib/api-client';
import type { NotificationChannel, NotificationStatus } from '../config/notifications-config';

export interface NotificationSummary {
  notificationId: string;
  tenantId: string;
  branchId: string | null;
  recipientId: string;
  channel: NotificationChannel;
  category: string | null;
  eventType: string | null;
  templateId: string | null;
  title: string;
  body: string;
  priority: string;
  status: NotificationStatus;
  isStarred: boolean;
  isArchived: boolean;
  failureReason: string | null;
  retryCount: number;
  metadata: unknown;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationStatusDto {
  status: NotificationStatus;
  failureReason: string | null;
  retryCount: number;
}

export interface NotificationChannelDto {
  channel: NotificationChannel;
  failoverChannel: string | null;
}

export interface NotificationDetail {
  notificationId: string;
  tenantId: string;
  branchId: string | null;
  recipientId: string;
  channel: NotificationChannel | NotificationChannelDto;
  title: string;
  body: string;
  priority: string;
  status: NotificationStatus | NotificationStatusDto;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  updatedAt: string;
  isStarred?: boolean;
  isArchived?: boolean;
  failureReason?: string | null;
  retryCount?: number;
  category?: string | null;
  eventType?: string | null;
  templateId?: string | null;
  metadata?: unknown;
}

export interface NotificationsOverview {
  total: number;
  unread: number;
  failed: number;
  pending: number;
  delivered: number;
  deliveryRate: number;
  failureRate: number;
  channelPerformance: Record<string, number>;
  recentFailures: Array<{
    id: string;
    title: string;
    channel: string;
    failureReason: string | null;
    createdAt: string;
  }>;
}

export interface NotificationsListResponse {
  items: NotificationSummary[];
  nextCursor: string | null;
}

export interface ListNotificationsParams {
  paginated?: boolean;
  limit?: number;
  cursor?: string;
  unreadOnly?: boolean;
  starredOnly?: boolean;
  archivedOnly?: boolean;
  search?: string;
  category?: string;
  channel?: string;
  status?: string;
  recipientId?: string;
  branchId?: string;
}

export interface NotificationTemplate {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  nameAr: string | null;
  channel: string;
  category: string;
  subjectEn: string;
  subjectAr: string | null;
  bodyEn: string;
  bodyAr: string | null;
  variables: string[];
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  key: string;
  name: string;
  nameAr?: string;
  channel: string;
  category?: string;
  subjectEn: string;
  subjectAr?: string;
  bodyEn: string;
  bodyAr?: string;
  variables?: string[];
}

export interface UpdateTemplateInput {
  name?: string;
  nameAr?: string;
  subjectEn?: string;
  subjectAr?: string;
  bodyEn?: string;
  bodyAr?: string;
  variables?: string[];
  isActive?: boolean;
}

export interface NotificationPreferences {
  id: string;
  tenantId: string;
  userId: string | null;
  channelSettings: Record<string, boolean>;
  categorySettings: Record<string, boolean>;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string | null;
  language: string | null;
  frequencyLimit: number | null;
}

export interface UpdatePreferencesInput {
  channelSettings?: Record<string, boolean>;
  categorySettings?: Record<string, boolean>;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  timezone?: string | null;
  language?: string | null;
  frequencyLimit?: number | null;
}

export interface TenantChannelConfig {
  channel: string;
  isEnabled: boolean;
  provider: string | null;
  providerStatus: string;
  config?: Record<string, unknown>;
}

export interface AutomationRule {
  id: string;
  tenantId: string;
  name: string;
  nameAr: string | null;
  eventType: string;
  channel: string;
  templateId: string | null;
  isActive: boolean;
  schedule: string | null;
  recipientRoles: string[];
  createdAt: string;
  updatedAt: string;
  template?: { id: string; name: string; key: string } | null;
}

export interface CreateAutomationInput {
  name: string;
  nameAr?: string;
  eventType: string;
  channel: string;
  templateId?: string;
  schedule?: string;
  recipientRoles?: string[];
}

export interface UpdateAutomationInput {
  name?: string;
  isActive?: boolean;
  templateId?: string;
  schedule?: string;
  recipientRoles?: string[];
}

export interface ComposeNotificationInput {
  recipientIds: string[];
  channel: string;
  title: string;
  body: string;
  priority?: string;
  templateId?: string;
  scheduledAt?: string;
  branchId?: string;
}

export interface SavedNotificationFilter {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationDraft {
  id: string;
  tenantId: string;
  branchId: string | null;
  recipientId: string;
  channel: string;
  title: string;
  body: string;
  templateId: string | null;
  scheduledAt: string | null;
  metadata: { recipientIds?: string[] } | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveDraftInput {
  recipientIds: string[];
  channel: string;
  title: string;
  body: string;
  templateId?: string;
  scheduledAt?: string;
}

export interface RegisterDeviceTokenInput {
  platform: string;
  token: string;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function resolveNotificationStatus(
  status: NotificationStatus | NotificationStatusDto,
): NotificationStatus {
  return typeof status === 'string' ? status : status.status;
}

export function resolveNotificationChannel(
  channel: NotificationChannel | NotificationChannelDto,
): NotificationChannel {
  return typeof channel === 'string' ? channel : (channel.channel as NotificationChannel);
}

export function resolveFailureReason(detail: NotificationDetail): string | null {
  if (detail.failureReason) return detail.failureReason;
  if (typeof detail.status === 'object' && detail.status.failureReason) {
    return detail.status.failureReason;
  }
  return null;
}

export async function fetchNotificationsOverview(
  token: string,
  tenantId: string,
  recipientId?: string,
): Promise<NotificationsOverview> {
  return apiRequest<NotificationsOverview>(
    `/notifications/overview${buildQuery({ recipientId })}`,
    { token, tenantId },
  );
}

export async function fetchUnreadCount(
  token: string,
  tenantId: string,
): Promise<{ count: number }> {
  return apiRequest<{ count: number }>('/notifications/unread-count', { token, tenantId });
}

export async function fetchNotifications(
  token: string,
  tenantId: string,
  params: ListNotificationsParams = {},
): Promise<NotificationsListResponse> {
  return apiRequest<NotificationsListResponse>(
    `/notifications${buildQuery({
      paginated: params.paginated ?? true,
      limit: params.limit,
      cursor: params.cursor,
      unreadOnly: params.unreadOnly,
      starredOnly: params.starredOnly,
      archivedOnly: params.archivedOnly,
      search: params.search,
      category: params.category,
      channel: params.channel,
      status: params.status,
      recipientId: params.recipientId,
      branchId: params.branchId,
    })}`,
    { token, tenantId },
  );
}

export async function fetchNotification(
  token: string,
  tenantId: string,
  notificationId: string,
): Promise<NotificationDetail> {
  return apiRequest<NotificationDetail>(`/notifications/${notificationId}`, { token, tenantId });
}

export async function markNotificationRead(
  token: string,
  tenantId: string,
  notificationId: string,
): Promise<unknown> {
  return apiRequest(`/notifications/${notificationId}/read`, { method: 'POST', token, tenantId });
}

export async function markAllNotificationsRead(
  token: string,
  tenantId: string,
  recipientId?: string,
): Promise<{ updated: number }> {
  return apiRequest<{ updated: number }>('/notifications/read-all', {
    method: 'POST',
    body: { recipientId },
    token,
    tenantId,
  });
}

export async function updateNotificationFlags(
  token: string,
  tenantId: string,
  notificationId: string,
  flags: { isStarred?: boolean; isArchived?: boolean },
): Promise<NotificationSummary> {
  return apiRequest<NotificationSummary>(`/notifications/${notificationId}`, {
    method: 'PATCH',
    body: flags,
    token,
    tenantId,
  });
}

export async function retryNotification(
  token: string,
  tenantId: string,
  notificationId: string,
): Promise<{ notificationId: string; status: string }> {
  return apiRequest(`/notifications/${notificationId}/retry`, { method: 'POST', token, tenantId });
}

export async function deleteNotification(
  token: string,
  tenantId: string,
  notificationId: string,
): Promise<{ notificationId: string }> {
  return apiRequest(`/notifications/${notificationId}`, { method: 'DELETE', token, tenantId });
}

export async function fetchNotificationTemplates(
  token: string,
  tenantId: string,
  search?: string,
): Promise<NotificationTemplate[]> {
  return apiRequest<NotificationTemplate[]>(
    `/notifications/templates${buildQuery({ search })}`,
    { token, tenantId },
  );
}

export async function createNotificationTemplate(
  token: string,
  tenantId: string,
  input: CreateTemplateInput,
): Promise<NotificationTemplate> {
  return apiRequest<NotificationTemplate>('/notifications/templates', {
    method: 'POST',
    body: input,
    token,
    tenantId,
  });
}

export async function updateNotificationTemplate(
  token: string,
  tenantId: string,
  templateId: string,
  input: UpdateTemplateInput,
): Promise<NotificationTemplate> {
  return apiRequest<NotificationTemplate>(`/notifications/templates/${templateId}`, {
    method: 'PATCH',
    body: input,
    token,
    tenantId,
  });
}

export async function deleteNotificationTemplate(
  token: string,
  tenantId: string,
  templateId: string,
): Promise<{ templateId: string }> {
  return apiRequest(`/notifications/templates/${templateId}`, { method: 'DELETE', token, tenantId });
}

export async function testNotificationTemplate(
  token: string,
  tenantId: string,
  templateId: string,
  recipientId: string,
  variables?: Record<string, string>,
): Promise<unknown> {
  return apiRequest(`/notifications/templates/${templateId}/test`, {
    method: 'POST',
    body: { recipientId, variables },
    token,
    tenantId,
  });
}

export async function fetchMyNotificationPreferences(
  token: string,
  tenantId: string,
): Promise<NotificationPreferences> {
  return apiRequest<NotificationPreferences>('/notifications/preferences/me', { token, tenantId });
}

export async function updateMyNotificationPreferences(
  token: string,
  tenantId: string,
  input: UpdatePreferencesInput,
): Promise<NotificationPreferences> {
  return apiRequest<NotificationPreferences>('/notifications/preferences/me', {
    method: 'PATCH',
    body: input,
    token,
    tenantId,
  });
}

export async function fetchChannelSettings(
  token: string,
  tenantId: string,
): Promise<{ channels: TenantChannelConfig[] }> {
  return apiRequest<{ channels: TenantChannelConfig[] }>('/notifications/settings/channels', {
    token,
    tenantId,
  });
}

export async function updateChannelSetting(
  token: string,
  tenantId: string,
  channel: string,
  input: { isEnabled?: boolean; provider?: string; providerStatus?: string },
): Promise<TenantChannelConfig> {
  return apiRequest<TenantChannelConfig>(`/notifications/settings/channels/${channel}`, {
    method: 'PATCH',
    body: input,
    token,
    tenantId,
  });
}

export async function fetchAutomationRules(
  token: string,
  tenantId: string,
): Promise<AutomationRule[]> {
  return apiRequest<AutomationRule[]>('/notifications/automation', { token, tenantId });
}

export async function createAutomationRule(
  token: string,
  tenantId: string,
  input: CreateAutomationInput,
): Promise<AutomationRule> {
  return apiRequest<AutomationRule>('/notifications/automation', {
    method: 'POST',
    body: input,
    token,
    tenantId,
  });
}

export async function updateAutomationRule(
  token: string,
  tenantId: string,
  ruleId: string,
  input: UpdateAutomationInput,
): Promise<AutomationRule> {
  return apiRequest<AutomationRule>(`/notifications/automation/${ruleId}`, {
    method: 'PATCH',
    body: input,
    token,
    tenantId,
  });
}

export async function deleteAutomationRule(
  token: string,
  tenantId: string,
  ruleId: string,
): Promise<{ ruleId: string }> {
  return apiRequest(`/notifications/automation/${ruleId}`, { method: 'DELETE', token, tenantId });
}

export async function composeNotification(
  token: string,
  tenantId: string,
  input: ComposeNotificationInput,
): Promise<{ sent: number; notificationIds: string[] }> {
  return apiRequest('/notifications/compose', {
    method: 'POST',
    body: {
      recipientIds: input.recipientIds,
      channel: input.channel,
      title: input.title,
      body: input.body,
      priority: input.priority,
      templateId: input.templateId,
      scheduledAt: input.scheduledAt,
      branchId: input.branchId,
    },
    token,
    tenantId,
  });
}

export async function fetchDrafts(
  token: string,
  tenantId: string,
): Promise<NotificationDraft[]> {
  return apiRequest<NotificationDraft[]>('/notifications/drafts', { token, tenantId });
}

export async function saveDraft(
  token: string,
  tenantId: string,
  input: SaveDraftInput,
): Promise<{ draftId: string }> {
  return apiRequest('/notifications/drafts', { method: 'POST', body: input, token, tenantId });
}

export async function sendDraft(
  token: string,
  tenantId: string,
  draftId: string,
): Promise<{ sent: number; notificationIds: string[] }> {
  return apiRequest(`/notifications/drafts/${draftId}/send`, { method: 'POST', token, tenantId });
}

export async function registerDeviceToken(
  token: string,
  tenantId: string,
  input: RegisterDeviceTokenInput,
): Promise<unknown> {
  return apiRequest('/notifications/device-tokens', { method: 'POST', body: input, token, tenantId });
}

export async function fetchSavedNotificationFilters(
  token: string,
  tenantId: string,
): Promise<SavedNotificationFilter[]> {
  return apiRequest<SavedNotificationFilter[]>('/notifications/saved-filters', { token, tenantId });
}

export async function saveNotificationFilter(
  token: string,
  tenantId: string,
  name: string,
  filters: Record<string, unknown>,
): Promise<SavedNotificationFilter> {
  return apiRequest<SavedNotificationFilter>('/notifications/saved-filters', {
    method: 'POST',
    body: { name, filters },
    token,
    tenantId,
  });
}

export async function deleteSavedNotificationFilter(
  token: string,
  tenantId: string,
  filterId: string,
): Promise<{ id: string }> {
  return apiRequest(`/notifications/saved-filters/${filterId}`, {
    method: 'DELETE',
    token,
    tenantId,
  });
}

export async function exportNotificationsCsv(
  token: string,
  tenantId: string,
  params?: { status?: string; channel?: string; limit?: number },
): Promise<string> {
  const headers = new Headers({ Accept: 'text/csv' });
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('x-tenant-id', tenantId);
  const response = await fetch(
    `${API_BASE}/notifications/export${buildQuery({
      status: params?.status,
      channel: params?.channel,
      limit: params?.limit,
    })}`,
    { headers },
  );
  if (!response.ok) {
    throw new ApiError(response.statusText, response.status);
  }
  return response.text();
}

import { API_BASE, apiRequest } from '@/lib/api-client';

export type EmploymentStatus = 'active' | 'suspended' | 'on_leave' | 'archived' | 'terminated';

export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  fullName: string;
  phone: string | null;
  jobTitle: string | null;
  departmentId: string | null;
  employmentStatus: EmploymentStatus;
  roles: string[];
  tenantId: string;
  branchId: string | null;
  isActive: boolean;
  emailVerified: boolean;
  mfaEnabled: boolean;
  isLocked: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BranchAccessMode = 'single' | 'multi' | 'global';

export interface UserDetail extends UserSummary {
  managerId: string | null;
  startDate: string | null;
  timezone: string | null;
  languages: string[];
  avatarUrl: string | null;
  notes: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  suspendedAt: string | null;
  archivedAt: string | null;
  branchIds: string[];
  customRoleIds: string[];
  regionIds: string[];
  branchAccessMode: BranchAccessMode;
}

export interface ScheduleDay {
  dayOfWeek: number;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  isOff: boolean;
}

export interface StaffSchedule {
  items: ScheduleDay[];
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
}

export interface PermissionOverviewResource {
  id: string;
  actions: string[];
  roleCount: number;
}

export interface PermissionOverview {
  resourceCount: number;
  resources: PermissionOverviewResource[];
  actionTypes: string[];
}

export interface ActivityEntry {
  id: string;
  action: string;
  resourceId: string;
  actorId: string;
  description: string;
  createdAt: string;
}

export interface UserOverview {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  lockedUsers: number;
  mfaEnabledUsers: number;
  emailUnverifiedUsers: number;
  newUsers30d: number;
  recentlyActive7d: number;
  onlineSessions: number;
  pendingInvitations: number;
  roleDistribution: Record<string, number>;
  branchDistribution: Record<string, number>;
  recentActivity?: ActivityEntry[];
}

export interface UserListResponse {
  items: UserSummary[];
  total: number;
  page: number;
  limit: number;
  nextCursor?: string | null;
}

export interface Region {
  id: string;
  name: string;
  nameAr: string | null;
}

export interface ListUsersParams {
  search?: string;
  role?: string;
  branchId?: string;
  departmentId?: string;
  regionId?: string;
  employmentStatus?: EmploymentStatus;
  status?: 'active' | 'inactive' | 'locked' | 'all';
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface Department {
  id: string;
  name: string;
  nameAr: string | null;
  branchId: string | null;
}

export interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  permissions: Record<string, string[]>;
  createdAt: string;
}

export interface RegisterUserInput {
  email: string;
  password: string;
  roles?: string[];
  firstName?: string;
  lastName?: string;
  firstNameAr?: string;
  lastNameAr?: string;
  phone?: string;
  branchId?: string;
  departmentId?: string;
  jobTitle?: string;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  firstNameAr?: string | null;
  lastNameAr?: string | null;
  phone?: string | null;
  branchId?: string | null;
  branchIds?: string[];
  branchAccessMode?: BranchAccessMode;
  roles?: string[];
  customRoleIds?: string[];
  jobTitle?: string | null;
  departmentId?: string | null;
  managerId?: string | null;
  startDate?: string | null;
  employmentStatus?: EmploymentStatus;
  timezone?: string | null;
  languages?: string[];
  avatarUrl?: string | null;
  notes?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

export type BulkAction =
  | 'deactivate'
  | 'reactivate'
  | 'suspend'
  | 'archive'
  | 'restore'
  | 'assign_roles'
  | 'assign_branches'
  | 'assign_departments';

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export async function fetchUserOverview(token: string, tenantId: string): Promise<UserOverview> {
  return apiRequest<UserOverview>('/identity/overview', { token, tenantId });
}

export async function fetchIdentityFeatures(token: string, tenantId: string): Promise<Record<string, boolean>> {
  return apiRequest<Record<string, boolean>>('/identity/features', { token, tenantId });
}

export async function fetchUsers(
  token: string,
  tenantId: string,
  params: ListUsersParams = {},
): Promise<UserListResponse> {
  return apiRequest<UserListResponse>(
    `/identity/users${buildQuery({
      search: params.search,
      role: params.role,
      branchId: params.branchId,
      departmentId: params.departmentId,
      regionId: params.regionId,
      employmentStatus: params.employmentStatus,
      status: params.status === 'all' ? undefined : params.status,
      page: params.page,
      limit: params.limit,
      cursor: params.cursor,
    })}`,
    { token, tenantId },
  );
}

export async function fetchUser(token: string, tenantId: string, userId: string): Promise<UserDetail> {
  return apiRequest<UserDetail>(`/identity/users/${userId}`, { token, tenantId });
}

export async function registerUser(
  token: string,
  tenantId: string,
  input: RegisterUserInput,
): Promise<{ id: string }> {
  return apiRequest('/identity/register', { method: 'POST', body: input, token, tenantId });
}

export async function updateUser(
  token: string,
  tenantId: string,
  userId: string,
  input: UpdateUserInput,
): Promise<UserDetail> {
  return apiRequest(`/identity/users/${userId}`, { method: 'PATCH', body: input, token, tenantId });
}

export async function deactivateUser(token: string, tenantId: string, userId: string) {
  return apiRequest(`/identity/users/${userId}/deactivate`, { method: 'POST', token, tenantId });
}

export async function reactivateUser(token: string, tenantId: string, userId: string) {
  return apiRequest(`/identity/users/${userId}/reactivate`, { method: 'POST', token, tenantId });
}

export async function suspendUser(token: string, tenantId: string, userId: string) {
  return apiRequest(`/identity/users/${userId}/suspend`, { method: 'POST', token, tenantId });
}

export async function archiveUser(token: string, tenantId: string, userId: string) {
  return apiRequest(`/identity/users/${userId}/archive`, { method: 'POST', token, tenantId });
}

export async function restoreUser(token: string, tenantId: string, userId: string) {
  return apiRequest(`/identity/users/${userId}/restore`, { method: 'POST', token, tenantId });
}

export async function unlockUser(token: string, tenantId: string, userId: string) {
  return apiRequest(`/identity/users/${userId}/unlock`, { method: 'POST', token, tenantId });
}

export async function lockUser(token: string, tenantId: string, userId: string, reason?: string) {
  return apiRequest(`/identity/users/${userId}/lock`, { method: 'POST', body: { reason }, token, tenantId });
}

export interface LoginHistoryEntry {
  id: string;
  success: boolean;
  failReason: string | null;
  ipAddress: string;
  userAgent: string | null;
  attemptedAt: string;
}

export interface UserSessionEntry {
  sessionId: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface TrustedDeviceEntry {
  id: string;
  deviceName: string | null;
  lastUsedAt: string;
  createdAt: string;
}

export interface StaffInvitation {
  id: string;
  email: string;
  roles: string[];
  firstName: string | null;
  lastName: string | null;
  branchId: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface InviteStaffInput {
  email: string;
  roles?: string[];
  firstName?: string;
  lastName?: string;
  firstNameAr?: string;
  lastNameAr?: string;
  phone?: string;
  branchId?: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actorId: string;
  description: string;
  createdAt: string;
  ipAddress?: string | null;
  changes?: Record<string, unknown> | null;
}

export async function inviteStaffUser(token: string, tenantId: string, input: InviteStaffInput) {
  return apiRequest<{ invitationId: string; user: UserSummary }>('/identity/users/invite', {
    method: 'POST',
    body: input,
    token,
    tenantId,
  });
}

export async function fetchStaffInvitations(token: string, tenantId: string): Promise<StaffInvitation[]> {
  return apiRequest<StaffInvitation[]>('/identity/invitations', { token, tenantId });
}

export async function cancelStaffInvitation(token: string, tenantId: string, invitationId: string) {
  return apiRequest(`/identity/invitations/${invitationId}/cancel`, { method: 'POST', token, tenantId });
}

export async function fetchUserLoginHistory(token: string, tenantId: string, userId: string) {
  const body = await apiRequest<{ items: LoginHistoryEntry[] }>(`/identity/users/${userId}/login-history`, {
    token,
    tenantId,
  });
  return body.items;
}

export async function fetchUserSessions(token: string, tenantId: string, userId: string) {
  const body = await apiRequest<{ items: UserSessionEntry[] }>(`/identity/users/${userId}/sessions`, {
    token,
    tenantId,
  });
  return body.items;
}

export async function fetchUserTrustedDevices(token: string, tenantId: string, userId: string) {
  const body = await apiRequest<{ items: TrustedDeviceEntry[] }>(`/identity/users/${userId}/trusted-devices`, {
    token,
    tenantId,
  });
  return body.items;
}

export async function revokeUserSession(token: string, tenantId: string, userId: string, sessionId: string) {
  return apiRequest(`/identity/users/${userId}/sessions/${sessionId}/revoke`, { method: 'POST', token, tenantId });
}

export async function revokeAllUserSessions(token: string, tenantId: string, userId: string) {
  return apiRequest(`/identity/users/${userId}/sessions/revoke-all`, { method: 'POST', token, tenantId });
}

export async function forcePasswordReset(token: string, tenantId: string, userId: string) {
  return apiRequest(`/identity/users/${userId}/force-password-reset`, { method: 'POST', token, tenantId });
}

export async function resendVerification(token: string, tenantId: string, userId: string) {
  return apiRequest(`/identity/users/${userId}/resend-verification`, { method: 'POST', token, tenantId });
}

export async function deleteUser(token: string, tenantId: string, userId: string) {
  return apiRequest(`/identity/users/${userId}`, { method: 'DELETE', token, tenantId });
}

export async function bulkUserAction(
  token: string,
  tenantId: string,
  input: {
    userIds: string[];
    action: BulkAction;
    roles?: string[];
    branchIds?: string[];
    departmentId?: string;
  },
) {
  return apiRequest('/identity/users/bulk', { method: 'POST', body: input, token, tenantId });
}

export async function fetchDepartments(token: string, tenantId: string): Promise<Department[]> {
  return apiRequest<Department[]>('/identity/departments', { token, tenantId });
}

export async function createDepartment(
  token: string,
  tenantId: string,
  input: { name: string; nameAr?: string; branchId?: string },
) {
  return apiRequest<Department>('/identity/departments', { method: 'POST', body: input, token, tenantId });
}

export async function fetchCustomRoles(token: string, tenantId: string): Promise<CustomRole[]> {
  return apiRequest<CustomRole[]>('/identity/roles/custom', { token, tenantId });
}

export async function createCustomRole(
  token: string,
  tenantId: string,
  input: { name: string; description?: string; permissions: Record<string, string[]> },
) {
  return apiRequest<CustomRole>('/identity/roles/custom', { method: 'POST', body: input, token, tenantId });
}

export async function updateCustomRole(
  token: string,
  tenantId: string,
  roleId: string,
  input: { name?: string; description?: string; permissions?: Record<string, string[]> },
) {
  return apiRequest<CustomRole>(`/identity/roles/custom/${roleId}`, { method: 'PATCH', body: input, token, tenantId });
}

export async function duplicateCustomRole(token: string, tenantId: string, roleId: string) {
  return apiRequest<CustomRole>(`/identity/roles/custom/${roleId}/duplicate`, { method: 'POST', token, tenantId });
}

export async function archiveCustomRole(token: string, tenantId: string, roleId: string) {
  return apiRequest(`/identity/roles/custom/${roleId}/archive`, { method: 'POST', token, tenantId });
}

export async function deleteCustomRole(token: string, tenantId: string, roleId: string) {
  return apiRequest(`/identity/roles/custom/${roleId}`, { method: 'DELETE', token, tenantId });
}

export async function fetchPermissionOverview(token: string, tenantId: string): Promise<PermissionOverview> {
  return apiRequest<PermissionOverview>('/identity/permissions/overview', { token, tenantId });
}

export async function fetchSavedFilters(token: string, tenantId: string): Promise<SavedFilter[]> {
  return apiRequest<SavedFilter[]>('/identity/saved-filters', { token, tenantId });
}

export async function saveSavedFilter(
  token: string,
  tenantId: string,
  input: { name: string; filters: Record<string, unknown> },
) {
  return apiRequest<SavedFilter>('/identity/saved-filters', { method: 'POST', body: input, token, tenantId });
}

export async function deleteSavedFilter(token: string, tenantId: string, filterId: string) {
  return apiRequest(`/identity/saved-filters/${filterId}`, { method: 'DELETE', token, tenantId });
}

export async function fetchUserSchedule(token: string, tenantId: string, userId: string): Promise<ScheduleDay[]> {
  const body = await apiRequest<StaffSchedule>(`/identity/users/${userId}/schedule`, { token, tenantId });
  return body.items;
}

export async function updateUserSchedule(token: string, tenantId: string, userId: string, days: ScheduleDay[]) {
  const body = await apiRequest<StaffSchedule>(`/identity/users/${userId}/schedule`, {
    method: 'PATCH',
    body: { days },
    token,
    tenantId,
  });
  return body.items;
}

export async function assignUserCustomRoles(token: string, tenantId: string, userId: string, customRoleIds: string[]) {
  return apiRequest<{ customRoleIds: string[] }>(`/identity/users/${userId}/custom-roles`, {
    method: 'PATCH',
    body: { customRoleIds },
    token,
    tenantId,
  });
}

async function downloadIdentityExport(
  token: string,
  tenantId: string,
  path: string,
  accept: string,
  filename: string,
): Promise<Blob> {
  const headers = new Headers();
  headers.set('Accept', accept);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('x-tenant-id', tenantId);
  const response = await fetch(`${API_BASE}${path}`, { headers });
  if (!response.ok) {
    const text = await response.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message: unknown }).message)
        : response.statusText;
    throw new Error(message);
  }
  const blob = await response.blob();
  const { triggerBrowserDownload } = await import('@/lib/download-file');
  triggerBrowserDownload(blob, filename);
  return blob;
}

export async function exportUsersXlsx(token: string, tenantId: string, params: ListUsersParams = {}) {
  const qs = buildQuery({
    search: params.search,
    role: params.role,
    branchId: params.branchId,
    departmentId: params.departmentId,
    employmentStatus: params.employmentStatus,
    status: params.status === 'all' ? undefined : params.status,
  });
  return downloadIdentityExport(
    token,
    tenantId,
    `/identity/users/export/xlsx${qs}`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'users.xlsx',
  );
}

export async function exportUsersPdf(token: string, tenantId: string) {
  return downloadIdentityExport(
    token,
    tenantId,
    '/identity/users/export/pdf',
    'application/pdf',
    'users.pdf',
  );
}

export async function exportUsersApi(token: string, tenantId: string, params: ListUsersParams = {}) {
  const body = await apiRequest<{ items: Record<string, string | boolean>[] }>(
    `/identity/users/export${buildQuery({
      search: params.search,
      role: params.role,
      branchId: params.branchId,
      status: params.status === 'all' ? undefined : params.status,
    })}`,
    { token, tenantId },
  );
  return body.items;
}

export async function fetchUserAuditEntries(token: string, tenantId: string, userId: string, page = 1) {
  return apiRequest<AuditEntry[]>(
    `/audit/entries?resourceType=identity.user&resourceId=${encodeURIComponent(userId)}&page=${page}&limit=25`,
    { token, tenantId },
  );
}

export interface GlobalAuditParams {
  page?: number;
  limit?: number;
  action?: string;
  resourceType?: string;
  actorId?: string;
  from?: string;
  to?: string;
}

export async function fetchGlobalAuditEntries(
  token: string,
  tenantId: string,
  params: GlobalAuditParams = {},
) {
  const entries = await apiRequest<AuditEntry[]>(
    `/audit/entries${buildQuery({
      resourceType: params.resourceType ?? 'identity.user',
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      action: params.action,
      actorId: params.actorId,
    })}`,
    { token, tenantId },
  );
  if (!params.from && !params.to) return entries;
  const fromMs = params.from ? new Date(params.from).getTime() : 0;
  const toMs = params.to ? new Date(params.to).getTime() + 86_400_000 - 1 : Number.POSITIVE_INFINITY;
  return entries.filter((e) => {
    const t = new Date(e.createdAt).getTime();
    return t >= fromMs && t <= toMs;
  });
}

export async function importUsers(
  token: string,
  tenantId: string,
  rows: Array<{ email: string; firstName: string; lastName: string; roles?: string[]; password?: string }>,
) {
  return apiRequest<{ created: number; errors: Array<{ row: number; message: string }> }>('/identity/users/import', {
    method: 'POST',
    body: { rows },
    token,
    tenantId,
  });
}

export async function importUsersXlsx(token: string, tenantId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('x-tenant-id', tenantId);
  const response = await fetch(`${API_BASE}/identity/users/import/xlsx`, {
    method: 'POST',
    headers,
    body: form,
  });
  if (!response.ok) {
    const text = await response.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message: unknown }).message)
        : response.statusText;
    throw new Error(message);
  }
  return response.json() as Promise<{ created: number; errors: Array<{ row: number; message: string }> }>;
}

export async function inviteStaffSms(token: string, tenantId: string, input: InviteStaffInput) {
  return apiRequest<{ invitationId: string; user: UserSummary }>('/identity/users/invite/sms', {
    method: 'POST',
    body: input,
    token,
    tenantId,
  });
}

export async function fetchRegions(token: string, tenantId: string): Promise<Region[]> {
  return apiRequest<Region[]>('/identity/regions', { token, tenantId });
}

export async function createRegion(
  token: string,
  tenantId: string,
  input: { name: string; nameAr?: string },
): Promise<Region> {
  return apiRequest<Region>('/identity/regions', { method: 'POST', body: input, token, tenantId });
}

export async function syncUserRegions(token: string, tenantId: string, userId: string, regionIds: string[]) {
  return apiRequest<{ regionIds: string[] }>(`/identity/users/${userId}/regions`, {
    method: 'PATCH',
    body: { regionIds },
    token,
    tenantId,
  });
}

export async function uploadUserAvatar(token: string, tenantId: string, userId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('x-tenant-id', tenantId);
  const response = await fetch(`${API_BASE}/identity/users/${userId}/avatar`, {
    method: 'POST',
    headers,
    body: form,
  });
  if (!response.ok) {
    const text = await response.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message: unknown }).message)
        : response.statusText;
    throw new Error(message);
  }
  return response.json() as Promise<{ avatarUrl: string; mediaId: string }>;
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  deleteAiPrompt,
  duplicateAiPrompt,
  fetchAiPromptCategories,
  fetchAiPrompts,
  fetchAiPromptVersions,
  fetchAiSettings,
  fetchPatientCopilot,
  restoreAiPromptVersion,
  saveAiPrompt,
  saveAiSettingsApi,
  toggleAiPromptFavorite,
  updateAiPrompt,
} from '../api/ai-api';

const ROOT = ['ai'] as const;

export function usePatientCopilot(patientId?: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'copilot', 'patient', patientId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchPatientCopilot(token, user.tenantId, patientId!);
    },
    enabled: Boolean(user?.tenantId && patientId) && enabled,
  });
}

export function useAiPromptCategories() {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'prompts', 'categories', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAiPromptCategories(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId),
    staleTime: 300_000,
  });
}

export function useAiPrompts(category?: string, search?: string, favoritesOnly?: boolean) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'prompts', user?.tenantId, category, search, favoritesOnly],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAiPrompts(token, user.tenantId, category, search, favoritesOnly);
    },
    enabled: Boolean(user?.tenantId),
  });
}

export function useAiPromptFavorites(_enabled = true) {
  return useAiPrompts(undefined, undefined, true);
}

export function useSaveAiPrompt() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      if (body.promptId) return updateAiPrompt(token, user.tenantId, String(body.promptId), body);
      return saveAiPrompt(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...ROOT, 'prompts'] }),
  });
}

export function useToggleAiPromptFavorite() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ promptId, favorite }: { promptId: string; favorite: boolean }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return toggleAiPromptFavorite(token, user.tenantId, promptId, favorite);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...ROOT, 'prompts'] }),
  });
}

export function useDeleteAiPrompt() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (promptId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return deleteAiPrompt(token, user.tenantId, promptId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...ROOT, 'prompts'] }),
  });
}

export function useDuplicateAiPrompt() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (promptId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return duplicateAiPrompt(token, user.tenantId, promptId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...ROOT, 'prompts'] }),
  });
}

export function useAiPromptVersions(promptId?: string) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'prompts', 'versions', user?.tenantId, promptId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !promptId) throw new Error('Not authenticated');
      return fetchAiPromptVersions(token, user.tenantId, promptId);
    },
    enabled: Boolean(user?.tenantId && promptId),
  });
}

export function useRestoreAiPromptVersion() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ promptId, versionId }: { promptId: string; versionId: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return restoreAiPromptVersion(token, user.tenantId, promptId, versionId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...ROOT, 'prompts'] }),
  });
}

export function useAiSettingsQuery() {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'settings', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAiSettings(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId),
  });
}

export function useSaveAiSettingsMutation() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return saveAiSettingsApi(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...ROOT, 'settings'] }),
  });
}

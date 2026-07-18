import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import { checkDrugInteractions } from '../api/emr-api';

export function useDrugInteractionCheck(medications: string[], allergies: string[], enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  const medKey = medications.filter(Boolean).sort().join('|');
  const allergyKey = allergies.join('|');

  return useQuery({
    queryKey: ['emr', 'drug-check', user?.tenantId, medKey, allergyKey],
    enabled: enabled && Boolean(user?.tenantId) && medications.some((m) => m.trim()),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return checkDrugInteractions(token, user.tenantId, medications.filter(Boolean), allergies);
    },
    staleTime: 60_000,
  });
}

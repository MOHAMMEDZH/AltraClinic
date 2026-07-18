import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import { fetchEncounter, fetchEncounters } from '@/features/emr/api/emr-api';

export interface PatientVitalReading {
  type: string;
  value: string;
  unit?: string;
  recordedAt: string;
  encounterId: string;
}

const CLINICAL_NOTES_TYPE = 'clinical_notes';

export function usePatientVitalReadings(patientId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['patients', 'vitals', patientId, user?.tenantId],
    enabled: enabled && Boolean(patientId && user?.tenantId),
    queryFn: async (): Promise<PatientVitalReading[]> => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');

      const list = await fetchEncounters(token, user.tenantId, {
        patientId,
        limit: 20,
        offset: 0,
      });
      const withObs = list.items.filter((item) => item.observationsCount > 0).slice(0, 8);
      const details = await Promise.all(
        withObs.map((item) => fetchEncounter(token, user.tenantId, item.id)),
      );

      const readings: PatientVitalReading[] = [];
      for (const enc of details) {
        for (const obs of enc.observations) {
          if (obs.type === CLINICAL_NOTES_TYPE) continue;
          readings.push({
            type: obs.type,
            value: obs.value,
            unit: obs.unit,
            recordedAt: enc.createdAt,
            encounterId: enc.id,
          });
        }
      }

      readings.sort(
        (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      );
      return readings;
    },
    staleTime: 60_000,
  });
}

export function latestVitalsByType(readings: PatientVitalReading[]): PatientVitalReading[] {
  const map = new Map<string, PatientVitalReading>();
  for (const reading of readings) {
    if (!map.has(reading.type)) map.set(reading.type, reading);
  }
  return [...map.values()];
}

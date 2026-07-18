import { useEffect, useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/app/providers/AuthProvider';

import { useOptionalDynamicSearch } from '@/features/dynamic-search/context/DynamicSearchProvider';

import { resolveSingleEntityTypeParam } from '@/features/dynamic-search/lib/resolve-entity-types-param';

import { globalClinicalSearch, type GlobalSearchHit } from '@/features/search/api/search-api';

import { extractOpenPatientQuery } from '../lib/ai-command-patient';



const ROOT = ['ai', 'commands', 'patient-lookup'] as const;



export interface AiCommandPatientHit {

  id: string;

  label: string;

  subtitle: string | null;

  path: string;

}



export function useAiCommandPatientLookup(query: string, enabled = true) {

  const { getValidAccessToken, user } = useAuth();

  const dynamicSearch = useOptionalDynamicSearch();

  const patientTypesParam = useMemo(

    () => resolveSingleEntityTypeParam(dynamicSearch?.snapshot, 'patient'),

    [dynamicSearch?.snapshot],

  );

  const patientName = useMemo(() => extractOpenPatientQuery(query), [query]);

  const [debounced, setDebounced] = useState(patientName ?? '');



  useEffect(() => {

    const timer = setTimeout(() => setDebounced(patientName ?? ''), 250);

    return () => clearTimeout(timer);

  }, [patientName]);



  const result = useQuery({

    queryKey: [...ROOT, user?.tenantId, debounced, patientTypesParam],

    queryFn: async () => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId || !debounced || !patientTypesParam) {

        return [] as AiCommandPatientHit[];

      }

      const hits = await globalClinicalSearch(token, user.tenantId, debounced, patientTypesParam, 5);

      const deepLinkByEntityType = dynamicSearch?.snapshot.deepLinkByEntityType ?? {};

      return hits

        .filter((hit: GlobalSearchHit) => hit.type === 'patient')

        .map((hit) => ({

          id: `patient-${hit.id}`,

          label: hit.title,

          subtitle: hit.subtitle,

          path:

            hit.url ??

            deepLinkByEntityType.patient?.replace('{id}', hit.id) ??

            `/patients/${hit.id}`,

        }));

    },

    enabled: Boolean(user?.tenantId) && enabled && Boolean(debounced) && Boolean(patientTypesParam),

    staleTime: 30_000,

  });



  return {

    patientName,

    hits: result.data ?? [],

    isLoading: result.isLoading,

  };

}


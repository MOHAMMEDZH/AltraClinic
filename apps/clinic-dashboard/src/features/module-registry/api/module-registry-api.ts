import { apiRequest } from '@/lib/api-client';

import type { EffectiveModuleView, RegistrySnapshot } from '@booking/module-registry';



export interface ModuleRegistryBootstrapSnapshot

  extends Pick<

    RegistrySnapshot,

    | 'schemaVersion'

    | 'platformVersion'

    | 'generatedAt'

    | 'catalogGeneration'

    | 'moduleCount'

    | 'dependencyOrder'

  > {

  entitlementVersion: string;

}



export interface ModuleRegistryBootstrapResponse {

  snapshot: ModuleRegistryBootstrapSnapshot;

  modules: EffectiveModuleView[];

}



export async function fetchModuleRegistryBootstrap(options: {

  token: string | null;

  tenantId: string | null;

}): Promise<ModuleRegistryBootstrapResponse> {

  return apiRequest<ModuleRegistryBootstrapResponse>('/tenant/modules/registry/bootstrap', {

    token: options.token,

    tenantId: options.tenantId,

  });

}



export async function fetchEffectiveModules(options: {

  token: string | null;

  tenantId: string | null;

}): Promise<EffectiveModuleView[]> {

  return apiRequest<EffectiveModuleView[]>('/tenant/modules/registry', {

    token: options.token,

    tenantId: options.tenantId,

  });

}



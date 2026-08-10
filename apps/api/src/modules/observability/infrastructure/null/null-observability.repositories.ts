import { Injectable } from '@nestjs/common';
import type {
  HealthContributorRegistration,
  HealthContributorRegistryPort,
  ObservabilityConfigRecord,
  ObservabilityConfigRepository,
} from '../../application/ports/repositories';

/** Phase 45a null holders — empty reads; no persistence. */
@Injectable()
export class NullObservabilityConfigRepository
  implements ObservabilityConfigRepository
{
  async findByKey(): Promise<ObservabilityConfigRecord | null> {
    return null;
  }

  async listByTenant(): Promise<readonly ObservabilityConfigRecord[]> {
    return [];
  }
}

@Injectable()
export class NullHealthContributorRegistry
  implements HealthContributorRegistryPort
{
  async list(): Promise<readonly HealthContributorRegistration[]> {
    return [];
  }
}

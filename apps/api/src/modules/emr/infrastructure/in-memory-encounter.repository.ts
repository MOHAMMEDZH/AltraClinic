import { Injectable } from '@nestjs/common';
import { Encounter } from '../domain/encounter.entity';
import { EMRRepository } from '../domain/emr.repository.interface';

@Injectable()
export class InMemoryEncounterRepository implements EMRRepository {
  private store = new Map<string, Encounter>();

  async saveEncounter(encounter: Encounter): Promise<void> {
    this.store.set(encounter.id, encounter);
  }

  async findEncounterById(id: string, tenantId: string): Promise<Encounter | null> {
    const encounter = this.store.get(id);
    if (!encounter || encounter.tenantId !== tenantId) {
      return null;
    }
    return encounter;
  }

  async findEncountersByPatient(patientId: string, tenantId: string): Promise<Encounter[]> {
    const out: Encounter[] = [];
    for (const e of this.store.values()) {
      if (e.tenantId !== tenantId) continue;
      if (e.patientId === patientId) out.push(e);
    }
    return out;
  }
}

import { Encounter } from './encounter.entity';

export interface EMRRepository {
  saveEncounter(encounter: Encounter): Promise<void>;
  findEncounterById(id: string, tenantId: string): Promise<Encounter | null>;
  findEncountersByPatient(patientId: string, tenantId: string): Promise<Encounter[]>;
}

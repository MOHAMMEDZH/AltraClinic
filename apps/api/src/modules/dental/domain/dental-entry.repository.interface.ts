import { DentalChart } from './dental-chart.entity';

export interface DentalEntryRepository {
  save(chart: DentalChart): Promise<void>;
  findByPatient(tenantId: string, patientId: string): Promise<DentalChart | null>;
  search(tenantId: string, patientId?: string): Promise<DentalChart[]>;
}

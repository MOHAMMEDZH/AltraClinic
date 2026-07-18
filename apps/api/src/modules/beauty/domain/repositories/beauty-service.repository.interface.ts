import { BeautyService } from '../entities/beauty-service.entity';

export interface BeautyServiceRepository {
  save(tenantId: string, service: BeautyService): Promise<void>;
  findById(tenantId: string, id: string): Promise<BeautyService | null>;
  findByPatient(tenantId: string, patientId: string): Promise<BeautyService[] | null>;
}

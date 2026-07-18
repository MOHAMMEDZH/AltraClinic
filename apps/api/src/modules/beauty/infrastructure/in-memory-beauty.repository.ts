import { Injectable } from '@nestjs/common';
import { BeautyService } from '../domain/entities/beauty-service.entity';

@Injectable()
export class InMemoryBeautyServiceRepository {
  private readonly store = new Map<string, Map<string, BeautyService>>();

  private bucket(tenantId: string): Map<string, BeautyService> {
    const key = (tenantId ?? 'default').trim().toLowerCase();
    if (!this.store.has(key)) this.store.set(key, new Map());
    return this.store.get(key)!;
  }

  async save(tenantId: string, service: BeautyService): Promise<void> {
    const b = this.bucket(tenantId);
    b.set(service.serviceId, service);
  }

  async findById(tenantId: string, id: string): Promise<BeautyService | null> {
    const b = this.bucket(tenantId);
    return b.get(id) ?? null;
  }

  async findByPatient(tenantId: string, patientId: string): Promise<BeautyService[]> {
    const b = this.bucket(tenantId);
    const result: BeautyService[] = [];
    for (const svc of b.values()) {
      if (svc.patientId === patientId) result.push(svc);
    }
    return result;
  }
}

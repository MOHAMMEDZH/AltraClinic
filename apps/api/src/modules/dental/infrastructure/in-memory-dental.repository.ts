import { Injectable } from '@nestjs/common';
import { DentalEntryRepository } from '../domain/dental-entry.repository.interface';
import { DentalChart } from '../domain/dental-chart.entity';

@Injectable()
export class InMemoryDentalRepository implements DentalEntryRepository {
  private readonly store: Map<string, DentalChart> = new Map();

  private key(tenantId: string, patientId: string) {
    // normalize keys to avoid casing/whitespace differences
    const t = (tenantId ?? '').toString().trim().toLowerCase();
    const p = (patientId ?? '').toString().trim();
    return `${t}::${p}`;
  }

  async save(chart: DentalChart): Promise<void> {
    this.store.set(this.key(chart.tenantId, chart.patientId), chart);
  }

  async findByPatient(tenantId: string, patientId: string): Promise<DentalChart | null> {
    return this.store.get(this.key(tenantId, patientId)) ?? null;
  }

  async search(tenantId: string, patientId?: string): Promise<DentalChart[]> {
    const results: DentalChart[] = [];
    for (const [k, v] of this.store.entries()) {
      if (!k.startsWith(`${tenantId}::`)) continue;
      if (patientId && v.patientId !== patientId) continue;
      results.push(v);
    }
    return results;
  }
}

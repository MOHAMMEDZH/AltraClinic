import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Encounter } from '../domain/encounter.entity';
import { EMRRepository } from '../domain/emr.repository.interface';
import { DiagnosisVO } from '../domain/diagnosis.vo';
import { MedicationVO } from '../domain/medication.vo';
import { ObservationVO } from '../domain/observation.vo';

@Injectable()
export class PrismaEncounterRepository implements EMRRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveEncounter(encounter: Encounter): Promise<void> {
    await this.prisma.encounter.upsert({
      where: { id: encounter.id },
      create: {
        id: encounter.id,
        tenantId: encounter.tenantId,
        branchId: encounter.branchId,
        patientId: encounter.patientId,
        clinicianId: encounter.clinicianId,
        appointmentId: encounter.appointmentId,
        chiefComplaint: encounter.chiefComplaint,
        followUpDate: encounter.followUpDate,
        diagnoses: encounter.diagnoses.map((d) => JSON.parse(JSON.stringify(d))),
        medications: encounter.medications.map((m) => JSON.parse(JSON.stringify(m))),
        observations: encounter.observations.map((o) => JSON.parse(JSON.stringify(o))),
        status: 'IN_PROGRESS',
        createdAt: encounter.createdAt,
      },
      update: {
        chiefComplaint: encounter.chiefComplaint,
        followUpDate: encounter.followUpDate,
        appointmentId: encounter.appointmentId,
        diagnoses: encounter.diagnoses.map((d) => JSON.parse(JSON.stringify(d))),
        medications: encounter.medications.map((m) => JSON.parse(JSON.stringify(m))),
        observations: encounter.observations.map((o) => JSON.parse(JSON.stringify(o))),
        updatedAt: encounter.updatedAt ?? new Date(),
      },
    });
  }

  async findEncounterById(id: string, tenantId: string): Promise<Encounter | null> {
    const row = await this.prisma.encounter.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  async findEncountersByPatient(patientId: string, tenantId: string): Promise<Encounter[]> {
    const rows = await this.prisma.encounter.findMany({
      where: { patientId, tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    patientId: string;
    clinicianId: string;
    diagnoses: unknown;
    medications: unknown;
    observations: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): Encounter {
    return new Encounter(
      row.id,
      row.tenantId,
      row.branchId,
      row.patientId,
      row.clinicianId,
      this.parseJsonArray<DiagnosisVO>(row.diagnoses),
      this.parseJsonArray<MedicationVO>(row.medications),
      this.parseJsonArray<ObservationVO>(row.observations),
      row.createdAt,
    );
  }

  private parseJsonArray<T>(raw: unknown): T[] {
    if (!Array.isArray(raw)) return [];
    return raw as T[];
  }
}

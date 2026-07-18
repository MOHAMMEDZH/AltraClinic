import { Injectable } from '@nestjs/common';
import { Patient } from '../domain/patient.entity';
import {
  PatientRepository,
  PatientUpdateInput,
} from '../domain/patient.repository.interface';
import type {
  PatientDetailRecord,
  PatientDuplicateCandidate,
  PatientListFilter,
  PatientListItem,
  PatientTimelineEntry,
} from '../domain/patient.types';

@Injectable()
export class InMemoryPatientRepository implements PatientRepository {
  private readonly items: Map<string, Patient> = new Map();

  async save(patient: Patient): Promise<void> {
    this.items.set(patient.id, patient);
  }

  async findById(id: string, tenantId: string): Promise<Patient | null> {
    const user = this.items.get(id);
    if (!user || user.tenantId !== tenantId) return null;
    return user;
  }

  async findByIdentifier(identifier: string, tenantId: string): Promise<Patient | null> {
    for (const p of this.items.values()) {
      if (p.tenantId === tenantId && p.nationalId === identifier) return p;
    }
    return null;
  }

  async findDetailById(id: string, tenantId: string): Promise<PatientDetailRecord | null> {
    const p = await this.findById(id, tenantId);
    if (!p) return null;
    return {
      id: p.id,
      tenantId: p.tenantId,
      branchId: p.branchId,
      firstName: p.name.firstName,
      lastName: p.name.lastName,
      firstNameAr: p.firstNameAr,
      lastNameAr: p.lastNameAr,
      dateOfBirth: p.dateOfBirth,
      gender: p.gender,
      phone: p.phone,
      email: p.email,
      nationalId: p.nationalId,
      bloodGroup: p.bloodGroup,
      notes: p.notes,
      profileData: p.profileData,
      addresses: p.addresses.map((a, i) => ({
        id: `addr-${i}`,
        line1: a.line1,
        line2: null,
        city: a.city,
        state: a.state,
        postalCode: a.postalCode,
        country: a.country ?? 'SY',
        isPrimary: i === 0,
      })),
      archived: false,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt ?? p.createdAt,
    };
  }

  async list(filter: PatientListFilter): Promise<{ items: PatientListItem[]; total: number }> {
    let rows = Array.from(this.items.values()).filter((p) => p.tenantId === filter.tenantId);
    if (filter.q) {
      const q = filter.q.toLowerCase();
      rows = rows.filter((p) =>
        `${p.name.firstName} ${p.name.lastName}`.toLowerCase().includes(q),
      );
    }
    const total = rows.length;
    const slice = rows.slice(filter.offset, filter.offset + filter.limit);
    return {
      total,
      items: slice.map((p) => ({
        id: p.id,
        firstName: p.name.firstName,
        lastName: p.name.lastName,
        firstNameAr: p.firstNameAr,
        lastNameAr: p.lastNameAr,
        phone: p.phone,
        email: p.email,
        dateOfBirth: p.dateOfBirth,
        gender: p.gender,
        nationalId: p.nationalId,
        bloodGroup: p.bloodGroup,
        createdAt: p.createdAt,
        archived: false,
        lastVisitAt: null,
      })),
    };
  }

  async update(
    id: string,
    tenantId: string,
    input: PatientUpdateInput,
  ): Promise<PatientDetailRecord | null> {
    const p = await this.findById(id, tenantId);
    if (!p) return null;
    if (input.firstName || input.lastName) {
      p.updateName(
        new PatientNameVO(input.firstName ?? p.name.firstName, input.lastName ?? p.name.lastName),
      );
    }
    return this.findDetailById(id, tenantId);
  }

  async archive(): Promise<boolean> {
    return true;
  }

  async reactivate(): Promise<boolean> {
    return true;
  }

  async findDuplicates(): Promise<PatientDuplicateCandidate[]> {
    return [];
  }

  async merge(
    _tenantId: string,
    targetId: string,
    sourceId: string,
  ): Promise<{ targetId: string; archivedSourceId: string }> {
    return { targetId, archivedSourceId: sourceId };
  }

  async getTimeline(): Promise<PatientTimelineEntry[]> {
    return [];
  }
}

import { PatientNameVO } from './patient-name.vo';
import { AddressVO } from './address.vo';
import type { PatientProfileData } from './patient.types';

export class Patient {
  public readonly id: string;
  public readonly createdAt: Date;
  public updatedAt: Date | null = null;
  public firstNameAr: string | null = null;
  public lastNameAr: string | null = null;
  public phone: string | null = null;
  public email: string | null = null;
  public nationalId: string | null = null;
  public bloodGroup: string | null = null;
  public notes: string | null = null;
  public profileData: PatientProfileData = {};

  constructor(
    id: string,
    public readonly tenantId: string,
    public readonly branchId: string | null,
    public name: PatientNameVO,
    public dateOfBirth: string | null,
    public gender: 'male' | 'female' | 'other' | null,
    public addresses: AddressVO[] = [],
    createdAt?: Date,
  ) {
    this.id = id;
    this.createdAt = createdAt ?? new Date();
  }

  updateName(name: PatientNameVO) {
    this.name = name;
    this.updatedAt = new Date();
  }

  addAddress(addr: AddressVO) {
    this.addresses.push(addr);
    this.updatedAt = new Date();
  }
}

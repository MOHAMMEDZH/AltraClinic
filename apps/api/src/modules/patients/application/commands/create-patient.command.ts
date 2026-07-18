import type { PatientProfileData } from '../../domain/patient.types';

export class CreatePatientCommand {
  constructor(
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly dateOfBirth?: string,
    public readonly gender?: 'male' | 'female' | 'other',
    public readonly addressLine1?: string,
    public readonly city?: string,
    public readonly state?: string,
    public readonly postalCode?: string,
    public readonly country?: string,
    public readonly firstNameAr?: string,
    public readonly lastNameAr?: string,
    public readonly phone?: string,
    public readonly email?: string,
    public readonly nationalId?: string,
    public readonly bloodGroup?: string,
    public readonly notes?: string,
    public readonly profileData?: PatientProfileData,
  ) {}
}

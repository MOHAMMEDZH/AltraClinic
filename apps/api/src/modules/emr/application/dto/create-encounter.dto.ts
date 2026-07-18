import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DiagnosisInput { @IsString() code!: string; @IsString() description!: string }
class MedicationInput { @IsString() name!: string; @IsOptional() @IsString() dose?: string; @IsOptional() @IsString() route?: string; @IsOptional() @IsString() frequency?: string }
class ObservationInput { @IsString() type!: string; @IsString() value!: string; @IsOptional() @IsString() unit?: string }

export class CreateEncounterDTO {
  @IsString()
  patientId!: string;

  @IsString()
  clinicianId!: string;

  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @IsOptional()
  @IsString()
  clinicalNotes?: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;

  @IsOptional()
  @IsString()
  followUpDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiagnosisInput)
  diagnoses?: DiagnosisInput[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicationInput)
  medications?: MedicationInput[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ObservationInput)
  observations?: ObservationInput[];
}

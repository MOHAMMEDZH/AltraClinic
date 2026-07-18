import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DiagnosisInput {
  @IsString()
  code!: string;

  @IsString()
  description!: string;
}

class MedicationInput {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  dose?: string;

  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsString()
  frequency?: string;
}

class ObservationInput {
  @IsString()
  type!: string;

  @IsString()
  value!: string;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class UpdateEncounterDTO {
  @IsOptional()
  @IsString()
  chiefComplaint?: string | null;

  @IsOptional()
  @IsString()
  clinicalNotes?: string | null;

  @IsOptional()
  @IsString()
  followUpDate?: string | null;

  @IsOptional()
  @IsString()
  appointmentId?: string | null;

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

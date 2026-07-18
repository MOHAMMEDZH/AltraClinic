import { IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateOdontogramModeDTO {
  @IsIn(['adult', 'pediatric'])
  mode!: 'adult' | 'pediatric';
}

export class CreateOrthodonticCaseDTO {
  @IsNotEmpty()
  @IsString()
  patientId!: string;

  @IsNotEmpty()
  @IsString()
  applianceType!: string;

  @IsOptional()
  @IsString()
  startDate?: string | null;

  @IsOptional()
  @IsString()
  estimatedEndDate?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsObject()
  clinicalData?: Record<string, unknown>;
}

export class UpdateOrthodonticCaseDTO {
  @IsOptional()
  @IsIn(['active', 'retention', 'completed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsString()
  applianceType?: string;

  @IsOptional()
  @IsString()
  startDate?: string | null;

  @IsOptional()
  @IsString()
  estimatedEndDate?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsObject()
  clinicalData?: Record<string, unknown>;
}

export class CreateImplantRecordDTO {
  @IsNotEmpty()
  @IsString()
  patientId!: string;

  @IsNotEmpty()
  @IsString()
  toothId!: string;

  @IsOptional()
  @IsString()
  implantSystem?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  implantDiameter?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  implantLength?: number | null;

  @IsOptional()
  @IsString()
  abutmentType?: string | null;

  @IsOptional()
  @IsIn(['planned', 'placed', 'restored', 'failed'])
  status?: string;

  @IsOptional()
  @IsString()
  placedAt?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsObject()
  surgicalData?: Record<string, unknown>;
}

export class UpdateImplantRecordDTO {
  @IsOptional()
  @IsIn(['planned', 'placed', 'restored', 'failed'])
  status?: string;

  @IsOptional()
  @IsString()
  implantSystem?: string | null;

  @IsOptional()
  @IsNumber()
  implantDiameter?: number | null;

  @IsOptional()
  @IsNumber()
  implantLength?: number | null;

  @IsOptional()
  @IsString()
  abutmentType?: string | null;

  @IsOptional()
  @IsString()
  placedAt?: string | null;

  @IsOptional()
  @IsString()
  restoredAt?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsObject()
  surgicalData?: Record<string, unknown>;
}

export class CreateDentalClinicalNoteDTO {
  @IsNotEmpty()
  @IsString()
  patientId!: string;

  @IsOptional()
  @IsString()
  dentalRecordId?: string | null;

  @IsOptional()
  @IsString()
  encounterId?: string | null;

  @IsOptional()
  @IsIn(['progress', 'referral', 'consent', 'general'])
  noteType?: string;

  @IsNotEmpty()
  @IsString()
  content!: string;
}

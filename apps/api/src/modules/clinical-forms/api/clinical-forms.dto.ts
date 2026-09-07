import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import {
  CLINICAL_FORM_KINDS,
  CLINICAL_FORM_SIGN_METHODS,
} from '../services/clinical-form-reference.validation';

export class CreateClinicalFormTemplateDto {
  @IsDefined()
  @IsIn([...CLINICAL_FORM_KINDS])
  kind!: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  stableKey!: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  nameEn!: string;

  @IsOptional()
  @IsString()
  nameAr?: string;
}

export class CreateClinicalFormVersionDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  contentEn!: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  contentAr!: string;
}

export class CreatePatientFormInstanceDto {
  @IsDefined()
  @IsUUID()
  patientId!: string;

  @IsDefined()
  @IsUUID()
  versionId!: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsOptional()
  @IsUUID()
  clinicalServiceId?: string;
}

export class SignPatientFormInstanceDto {
  @IsOptional()
  @IsUUID()
  signerPatientId?: string;

  @IsOptional()
  @IsIn([...CLINICAL_FORM_SIGN_METHODS])
  method?: string;
}

export class VoidPatientFormInstanceDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  reason!: string;
}

export class UpsertClinicalServiceFormRequirementDto {
  @IsDefined()
  @IsUUID()
  clinicalServiceId!: string;

  @IsDefined()
  @IsIn([...CLINICAL_FORM_KINDS])
  formKind!: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  active?: boolean;
}

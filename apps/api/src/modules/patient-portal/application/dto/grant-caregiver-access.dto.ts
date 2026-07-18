import { ArrayNotEmpty, IsArray, IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CAREGIVER_ACCESS_SCOPES, CaregiverAccessScope } from '../../domain/value-objects/caregiver-access-scope';

export class GrantCaregiverAccessDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  caregiverContact!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  caregiverName!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(CAREGIVER_ACCESS_SCOPES, { each: true })
  scopes!: CaregiverAccessScope[];

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

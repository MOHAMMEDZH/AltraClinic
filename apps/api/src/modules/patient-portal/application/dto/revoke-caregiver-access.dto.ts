import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RevokeCaregiverAccessDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeactivatePortalAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

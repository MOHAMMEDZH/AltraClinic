import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ValidateAiModelDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}

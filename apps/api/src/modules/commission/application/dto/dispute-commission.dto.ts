import { IsNotEmpty, IsString } from 'class-validator';

export class DisputeCommissionDto {
  @IsNotEmpty()
  @IsString()
  reason!: string;
}

import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class EarnLoyaltyPointsDto {
  @IsNotEmpty()
  @IsString()
  accountId!: string;

  @IsNotEmpty()
  @IsNumber()
  pointsToEarn!: number;

  @IsOptional()
  @IsString()
  reference?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;
}

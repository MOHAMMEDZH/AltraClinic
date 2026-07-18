import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class RedeemLoyaltyPointsDto {
  @IsNotEmpty()
  @IsString()
  accountId!: string;

  @IsNotEmpty()
  @IsNumber()
  pointsToRedeem!: number;

  @IsOptional()
  @IsString()
  rewardId?: string | null;

  @IsOptional()
  @IsString()
  reference?: string | null;
}

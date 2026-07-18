import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { TENANT_SUBSCRIPTION_PLANS } from '../../domain/config/plan-name.mapper';

const PLAN_IDS = TENANT_SUBSCRIPTION_PLANS.map((p) => p.id);
const BACKEND_PLANS = ['lite', 'pro', 'enterprise', 'starter', 'growth', 'professional', 'business'] as const;

export class ChangeTenantSubscriptionPlanDto {
  @IsString()
  @MinLength(1)
  @IsIn([...PLAN_IDS, ...BACKEND_PLANS])
  plan!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class GrantTenantEntitlementsDto {
  @IsIn(['aiCredits', 'storage', 'users'])
  grantType!: 'aiCredits' | 'storage' | 'users';

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class GrantTenantTrialDto {
  @IsString()
  @MinLength(1)
  @IsIn([...PLAN_IDS, ...BACKEND_PLANS])
  plan!: string;

  @IsNumber()
  @Min(1)
  @Max(90)
  days!: number;
}

export class PreviewPlanChangeDto {
  @IsString()
  @MinLength(1)
  @IsIn([...PLAN_IDS, ...BACKEND_PLANS])
  plan!: string;
}

import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { EffectiveEntitlementRuntimeService } from './application/effective-entitlement-runtime.service';

/**
 * Step 17 Effective Entitlement Runtime.
 * Rollback: set EFFECTIVE_ENTITLEMENT_RUNTIME_ENABLED=false to skip snapshot projection in LicensingEngineService.
 */
@Module({
  imports: [InfrastructureModule],
  providers: [EffectiveEntitlementRuntimeService],
  exports: [EffectiveEntitlementRuntimeService],
})
export class EffectiveEntitlementRuntimeModule {}

export function isEffectiveEntitlementRuntimeEnabled(): boolean {
  const raw = (process.env.EFFECTIVE_ENTITLEMENT_RUNTIME_ENABLED ?? 'true').trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no';
}

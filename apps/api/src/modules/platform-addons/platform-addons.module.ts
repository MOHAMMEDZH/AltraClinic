import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { PlatformAddonsController } from './api/platform-addons.controller';
import { PlatformAddonsService } from './application/platform-addons.service';
import { PlatformOverridesService } from './application/platform-overrides.service';
import { CommercialCompositionService } from './application/commercial-composition.service';
import { AddonIdempotencyService } from './application/addon-idempotency.service';
import { AuditTrailPlatformAddonsAuditLog } from './infrastructure/audit-trail-platform-addons-audit-log';
import {
  loadPlatformAddonsConfig,
  type PlatformAddonsConfig,
} from './config/platform-addons.config';
import { PLATFORM_ADDONS_AUDIT_LOG, PLATFORM_ADDONS_CONFIG } from './platform-addons.tokens';

@Module({
  imports: [forwardRef(() => AuthModule), AuditModule],
  controllers: [PlatformAddonsController],
  providers: [
    AddonIdempotencyService,
    {
      provide: PLATFORM_ADDONS_CONFIG,
      useFactory: (): PlatformAddonsConfig => loadPlatformAddonsConfig(),
    },
    {
      provide: PLATFORM_ADDONS_AUDIT_LOG,
      useClass: AuditTrailPlatformAddonsAuditLog,
    },
    PlatformAddonsService,
    PlatformOverridesService,
    CommercialCompositionService,
  ],
  exports: [PlatformAddonsService, PlatformOverridesService, CommercialCompositionService],
})
export class PlatformAddonsModule {}

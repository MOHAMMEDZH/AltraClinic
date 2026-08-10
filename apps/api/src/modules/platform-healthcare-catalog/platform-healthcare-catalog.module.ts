import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { PlatformHealthcareCatalogController } from './api/platform-healthcare-catalog.controller';
import { HealthcareCatalogService } from './application/healthcare-catalog.service';
import { HealthcareCatalogSeedService } from './application/catalog-seed.service';
import { CatalogIdempotencyService } from './application/catalog-idempotency.service';
import { AuditTrailHealthcareCatalogAuditLog } from './infrastructure/audit-trail-healthcare-catalog-audit-log';
import {
  loadPlatformHealthcareCatalogConfig,
  type PlatformHealthcareCatalogConfig,
} from './config/platform-healthcare-catalog.config';
import {
  PLATFORM_HEALTHCARE_CATALOG_AUDIT_LOG,
  PLATFORM_HEALTHCARE_CATALOG_CONFIG,
} from './platform-healthcare-catalog.tokens';

@Module({
  imports: [forwardRef(() => AuthModule), AuditModule],
  controllers: [PlatformHealthcareCatalogController],
  providers: [
    HealthcareCatalogService,
    HealthcareCatalogSeedService,
    CatalogIdempotencyService,
    {
      provide: PLATFORM_HEALTHCARE_CATALOG_CONFIG,
      useFactory: (): PlatformHealthcareCatalogConfig => loadPlatformHealthcareCatalogConfig(),
    },
    {
      provide: PLATFORM_HEALTHCARE_CATALOG_AUDIT_LOG,
      useClass: AuditTrailHealthcareCatalogAuditLog,
    },
  ],
  exports: [HealthcareCatalogService, HealthcareCatalogSeedService],
})
export class PlatformHealthcareCatalogModule {}

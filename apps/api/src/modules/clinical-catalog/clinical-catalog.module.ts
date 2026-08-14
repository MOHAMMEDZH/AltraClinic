import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { PlatformClinicalCatalogController } from './api/platform-clinical-catalog.controller';
import { ClinicalCatalogController } from './api/clinical-catalog.controller';
import { ClinicalCatalogConfigsController } from './api/clinical-catalog-configs.controller';
import { ClinicalCatalogPricesController } from './api/clinical-catalog-prices.controller';
import { ClinicalCatalogService } from './application/clinical-catalog.service';
import { TenantServiceConfigService } from './application/tenant-service-config.service';
import { ClinicalPriceVersionService } from './application/clinical-price-version.service';
import { AuditTrailClinicalCatalogAuditLog } from './infrastructure/audit-trail-clinical-catalog-audit-log';
import { CLINICAL_CATALOG_AUDIT_LOG } from './application/ports/clinical-catalog-audit-log.port';
import { WaveABackfillService } from './migration/wave-a-backfill.service';

@Module({
  imports: [forwardRef(() => AuthModule), AuditModule],
  controllers: [
    PlatformClinicalCatalogController,
    ClinicalCatalogController,
    ClinicalCatalogConfigsController,
    ClinicalCatalogPricesController,
  ],
  providers: [
    ClinicalCatalogService,
    TenantServiceConfigService,
    ClinicalPriceVersionService,
    WaveABackfillService,
    {
      provide: CLINICAL_CATALOG_AUDIT_LOG,
      useClass: AuditTrailClinicalCatalogAuditLog,
    },
  ],
  exports: [ClinicalCatalogService, TenantServiceConfigService, ClinicalPriceVersionService, WaveABackfillService],
})
export class ClinicalCatalogModule {}

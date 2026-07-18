import { Module } from '@nestjs/common';
import { ReportingModule } from '../reporting/reporting.module';
import { SearchController } from './controllers/search.controller';
import { GlobalSearchHandler } from './application/handlers/global-search.handler';
import { PrismaGlobalSearchRepository } from './infrastructure/prisma-global-search.repository';
import { SearchRankerService } from './application/services/search-ranker.service';
import { SearchPermissionFilterService } from './application/services/search-permission-filter.service';

@Module({
  imports: [ReportingModule],
  controllers: [SearchController],
  providers: [
    GlobalSearchHandler,
    PrismaGlobalSearchRepository,
    SearchRankerService,
    SearchPermissionFilterService,
  ],
  exports: [GlobalSearchHandler],
})
export class SearchModule {}

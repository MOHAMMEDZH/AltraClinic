import { Global, Module } from '@nestjs/common';
import { HeaderTenantResolver } from './header-tenant-resolver.service';
import { TenantContextService } from './tenant-context.service';
import { EVENT_PUBLISHER, OUTBOX_REPOSITORY, TENANT_RESOLVER } from './provider.tokens';
import { PrismaOutboxRepository } from './prisma-outbox.repository';
import { DomainEventBus } from './domain-event-bus.service';
import { OutboxEventPublisher } from './outbox-event-publisher.service';
import { PrismaService } from './prisma.service';
import { TenantDbContextService } from './tenant-db-context.service';
import { TenantExecutionService } from './tenant-execution.service';
import { TransactionalEmailService } from './transactional-email.service';
import { RedisModule } from './redis/redis.module';

/**
 * Global infrastructure module.
 * TENANT_RESOLVER defaults to HeaderTenantResolver.
 * AuthModule overrides it with JwtTenantResolver which falls back to headers
 * for public routes, ensuring backward-compatibility during the migration.
 */
@Global()
@Module({
  imports: [RedisModule],
  providers: [
    PrismaService,
    TenantDbContextService,
    TenantExecutionService,
    HeaderTenantResolver,
    { provide: TENANT_RESOLVER, useClass: HeaderTenantResolver },
    DomainEventBus,
    { provide: OUTBOX_REPOSITORY, useClass: PrismaOutboxRepository },
    { provide: EVENT_PUBLISHER, useClass: OutboxEventPublisher },
    TenantContextService,
    TransactionalEmailService,
  ],
  exports: [
    RedisModule,
    PrismaService,
    TenantDbContextService,
    TenantExecutionService,
    HeaderTenantResolver,
    TENANT_RESOLVER,
    EVENT_PUBLISHER,
    OUTBOX_REPOSITORY,
    DomainEventBus,
    TenantContextService,
    TransactionalEmailService,
  ],
})
export class InfrastructureModule {}

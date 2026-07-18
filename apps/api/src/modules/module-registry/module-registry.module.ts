import { Module } from '@nestjs/common';
import { SubscriptionModule } from '../subscription/subscription.module';
import { SettingsModule } from '../settings/settings.module';
import { ModuleRegistryService } from './application/module-registry.service';
import { ModuleRegistryController } from './controllers/module-registry.controller';

@Module({
  imports: [SubscriptionModule, SettingsModule],
  controllers: [ModuleRegistryController],
  providers: [ModuleRegistryService],
  exports: [ModuleRegistryService],
})
export class ModuleRegistryModule {}

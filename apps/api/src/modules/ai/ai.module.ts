import { Module } from '@nestjs/common';
import { AiController } from './api/ai.controller';
import { AiAssistantController } from './api/ai-assistant.controller';
import { AiPolicy } from './policies/ai-policy.service';
import { AiAccessPolicy } from './policies/ai-access.policy';
import { AiPermissionGuard } from './api/ai-permission.guard';
import { AiAccessGuard } from './api/ai-access.guard';
import { CreateAiModelHandler } from './application/handlers/create-ai-model.handler';
import { ValidateAiModelHandler } from './application/handlers/validate-ai-model.handler';
import { DeployAiModelHandler } from './application/handlers/deploy-ai-model.handler';
import { RetireAiModelHandler } from './application/handlers/retire-ai-model.handler';
import { GetAiModelHandler } from './application/handlers/get-ai-model.handler';
import { ListAiModelsHandler } from './application/handlers/list-ai-models.handler';
import {
  CreateAiConversationHandler,
  DeleteAiConversationHandler,
  DeleteAiPromptHandler,
  DuplicateAiPromptHandler,
  GetAiConversationHandler,
  GetAiOverviewHandler,
  GetAiAdminUsageHandler,
  GetAiAdminOverviewHandler,
  GetAiAdminProvidersHandler,
  UpdateAiAdminProvidersHandler,
  GetAiPromptCategoriesHandler,
  GetAiProviderHealthHandler,
  GetAiSmartActionsHandler,
  GetAiCommandsResolveHandler,
  GetAiContextSummaryHandler,
  GetAiSubscriptionLimitsHandler,
  GetAiSettingsHandler,
  GetPatientCopilotHandler,
  ListAiConversationsHandler,
  ListAiPromptsHandler,
  ListAiPromptVersionsHandler,
  RestoreAiPromptVersionHandler,
  SaveAiSettingsHandler,
  SendAiMessageHandler,
  StreamAiMessageHandler,
  ToggleAiPromptFavoriteHandler,
  UpdateAiConversationHandler,
  UpsertAiPromptHandler,
} from './application/handlers/ai-assistant.handlers';
import { AiAdminService } from './application/services/ai-admin.service';
import { AiInferenceAuditService } from './application/services/ai-inference-audit.service';
import { AiTenantSettingsService } from './application/services/ai-tenant-settings.service';
import { AiInferenceService } from './application/services/ai-inference.service';
import { AiIntentRouterService } from './application/services/ai-intent-router.service';
import { AiSkillExecutorService } from './application/services/ai-skill-executor.service';
import { AiContextService } from './application/services/ai-context.service';
import { GeminiAiProvider } from './application/services/providers/gemini-ai.provider';
import { OpenAiProvider } from './application/services/providers/openai-ai.provider';
import { TemplateAiProvider } from './application/services/providers/template-ai.provider';
import { AiSubscriptionService } from './application/services/ai-subscription.service';
import { AiSmartActionsService } from './application/services/ai-smart-actions.service';
import { AiCommandResolverService } from './application/services/ai-command-resolver.service';
import { AiContextSummaryService } from './application/services/ai-context-summary.service';
import { PrismaAiModelRepository } from './infrastructure/prisma-ai-model.repository';
import { AI_MODEL_REPOSITORY } from '../../infrastructure/provider.tokens';
import { SubscriptionModule } from '../subscription/subscription.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [SubscriptionModule, SearchModule],
  controllers: [AiController, AiAssistantController],
  providers: [
    AiPolicy,
    AiAccessPolicy,
    AiPermissionGuard,
    AiAccessGuard,
    AiInferenceService,
    AiAdminService,
    AiInferenceAuditService,
    AiTenantSettingsService,
    AiIntentRouterService,
    AiSkillExecutorService,
    AiContextService,
    GeminiAiProvider,
    OpenAiProvider,
    TemplateAiProvider,
    AiSubscriptionService,
    AiSmartActionsService,
    AiCommandResolverService,
    AiContextSummaryService,
    CreateAiModelHandler,
    ValidateAiModelHandler,
    DeployAiModelHandler,
    RetireAiModelHandler,
    GetAiModelHandler,
    ListAiModelsHandler,
    GetAiOverviewHandler,
    GetAiAdminUsageHandler,
    GetAiAdminOverviewHandler,
    GetAiAdminProvidersHandler,
    UpdateAiAdminProvidersHandler,
    ListAiConversationsHandler,
    GetAiConversationHandler,
    CreateAiConversationHandler,
    UpdateAiConversationHandler,
    DeleteAiConversationHandler,
    SendAiMessageHandler,
    StreamAiMessageHandler,
    GetAiProviderHealthHandler,
    GetAiSmartActionsHandler,
    GetAiCommandsResolveHandler,
    GetAiContextSummaryHandler,
    GetAiSubscriptionLimitsHandler,
    GetPatientCopilotHandler,
    GetAiPromptCategoriesHandler,
    ListAiPromptsHandler,
    UpsertAiPromptHandler,
    ToggleAiPromptFavoriteHandler,
    DeleteAiPromptHandler,
    DuplicateAiPromptHandler,
    ListAiPromptVersionsHandler,
    RestoreAiPromptVersionHandler,
    GetAiSettingsHandler,
    SaveAiSettingsHandler,
    { provide: AI_MODEL_REPOSITORY, useClass: PrismaAiModelRepository },
  ],
})
export class AiModule {}

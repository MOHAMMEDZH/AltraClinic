import { Injectable, Logger } from '@nestjs/common';
import { isBuiltinOnlyAiMode } from '../../domain/config/ai-builtin.config';
import { AiContextService } from './ai-context.service';
import { AiIntentRouterService } from './ai-intent-router.service';
import type { AiInferenceInput, AiInferenceResult, AiProviderHealth } from './ai-inference.types';
import { AiSkillExecutorService } from './ai-skill-executor.service';
import { AiSubscriptionService } from './ai-subscription.service';
import { GeminiAiProvider } from './providers/gemini-ai.provider';
import { OpenAiProvider } from './providers/openai-ai.provider';
import { TemplateAiProvider } from './providers/template-ai.provider';

const SKILL_FOOTER_EN =
  '\n\n---\n*Built-in clinic assistant — answers from your ERP data. Verify before clinical or billing actions.*';
const SKILL_FOOTER_AR =
  '\n\n---\n*مساعد العيادة المدمج — إجابات من بيانات النظام. تحقق قبل قرارات سريرية أو مالية.*';

@Injectable()
export class AiInferenceService {
  private readonly logger = new Logger(AiInferenceService.name);

  constructor(
    private readonly contextService: AiContextService,
    private readonly intentRouter: AiIntentRouterService,
    private readonly skillExecutor: AiSkillExecutorService,
    private readonly aiSubscription: AiSubscriptionService,
    private readonly gemini: GeminiAiProvider,
    private readonly openai: OpenAiProvider,
    private readonly template: TemplateAiProvider,
  ) {}

  async generate(input: AiInferenceInput): Promise<AiInferenceResult> {
    const started = Date.now();
    const enriched = await this.contextService.enrich(input);

    const skillResult = await this.trySkillRoute(input, enriched, started);
    if (skillResult) return skillResult;

    const providers = this.resolveProviderOrder(input);

    for (const providerId of providers) {
      try {
        const result = await this.runGenerate(providerId, input, enriched, started);
        this.logger.log(
          `inference provider=${result.provider} model=${result.model} latency=${result.latencyMs}ms tokens~${result.tokenCount}`,
        );
        return result;
      } catch (err) {
        this.logger.warn(`Provider ${providerId} failed: ${String(err)}`);
      }
    }

    return this.template.generate(input, enriched, started);
  }

  async *stream(input: AiInferenceInput): AsyncGenerator<string, AiInferenceResult, void> {
    const started = Date.now();
    const enriched = await this.contextService.enrich(input);

    const skillResult = await this.trySkillRoute(input, enriched, started);
    if (skillResult) {
      const chunk = 48;
      for (let i = 0; i < skillResult.content.length; i += chunk) {
        yield skillResult.content.slice(i, i + chunk);
      }
      return skillResult;
    }

    const providers = this.resolveProviderOrder(input);

    for (const providerId of providers) {
      try {
        const gen = this.runStream(providerId, input, enriched, started);
        let next = await gen.next();
        while (!next.done) {
          yield next.value;
          next = await gen.next();
        }
        const result = next.value;
        this.logger.log(
          `stream provider=${result.provider} model=${result.model} latency=${result.latencyMs}ms`,
        );
        return result;
      } catch (err) {
        this.logger.warn(`Stream provider ${providerId} failed: ${String(err)}`);
      }
    }

    const fallback = this.template.stream(input, enriched, started);
    let next = await fallback.next();
    while (!next.done) {
      yield next.value;
      next = await fallback.next();
    }
    return next.value;
  }

  async getProviderHealth(): Promise<AiProviderHealth[]> {
    const builtinOnly = isBuiltinOnlyAiMode();
    const results: AiProviderHealth[] = [];

    results.push({
      provider: 'skill',
      configured: true,
      status: 'healthy',
      model: 'builtin-skills-v1',
      message: builtinOnly
        ? 'Primary built-in assistant (skills + ERP data)'
        : 'Built-in skills available before external providers',
    });

    if (!builtinOnly) {
      if (this.gemini.isConfigured()) {
        const check = await this.gemini.healthCheck();
        results.push({
          provider: 'gemini',
          configured: true,
          status: check.ok ? 'healthy' : 'degraded',
          model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
          latencyMs: check.latencyMs,
          message: check.message,
        });
      } else {
        results.push({
          provider: 'gemini',
          configured: false,
          status: 'unavailable',
          model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
          message: 'GEMINI_API_KEY not configured',
        });
      }

      if (this.openai.isConfigured()) {
        const check = await this.openai.healthCheck();
        results.push({
          provider: 'openai',
          configured: true,
          status: check.ok ? 'healthy' : 'degraded',
          model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
          latencyMs: check.latencyMs,
          message: check.message,
        });
      } else {
        results.push({
          provider: 'openai',
          configured: false,
          status: 'unavailable',
          model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
          message: 'OPENAI_API_KEY not configured',
        });
      }
    }

    results.push({
      provider: 'template',
      configured: true,
      status: 'healthy',
      model: 'template-v1',
      message: builtinOnly ? 'General fallback when no skill matches' : 'Local template fallback',
    });

    return results;
  }

  private async trySkillRoute(
    input: AiInferenceInput,
    enriched: Awaited<ReturnType<AiContextService['enrich']>>,
    started: number,
  ): Promise<AiInferenceResult | null> {
    const limits = await this.aiSubscription.getLimits(input.tenantId, input.userId);
    const route = this.intentRouter.route(
      input.userMessage,
      input.context,
      input.locale,
      limits.limits.workspaces,
    );
    if (!route) return null;

    const executed = await this.skillExecutor.execute(route.skillId, input, enriched);
    const ar = Boolean(input.locale?.startsWith('ar'));
    const content = executed.content + (ar ? SKILL_FOOTER_AR : SKILL_FOOTER_EN);

    const result: AiInferenceResult = {
      content,
      citations: executed.citations,
      tokenCount: Math.ceil(content.length / 4),
      latencyMs: Date.now() - started,
      provider: 'skill',
      model: executed.skillId,
      skillId: executed.skillId,
    };

    this.logger.log(
      `skill inference skill=${executed.skillId} score=${route.score.toFixed(1)} latency=${result.latencyMs}ms`,
    );
    return result;
  }

  private resolveProviderOrder(input: AiInferenceInput) {
    if (input.forceTemplateOnly || isBuiltinOnlyAiMode()) return [] as Array<'gemini' | 'openai'>;

    const tenant = input.tenantProviderSettings;
    const preferred = input.preferences?.preferredProvider;
    const order: Array<'gemini' | 'openai'> = [];

    const canUse = (id: 'gemini' | 'openai') => {
      if (id === 'gemini' && tenant && !tenant.geminiEnabled) return false;
      if (id === 'openai' && tenant && !tenant.openaiEnabled) return false;
      if (id === 'gemini' && this.gemini.isConfigured()) return true;
      if (id === 'openai' && this.openai.isConfigured()) return true;
      return false;
    };

    const push = (id: 'gemini' | 'openai') => {
      if (canUse(id) && !order.includes(id)) order.push(id);
    };

    if (preferred === 'gemini' || preferred === 'openai') {
      push(preferred);
      return order;
    }

    if (tenant?.preferredExternalProvider === 'gemini') {
      push('gemini');
      push('openai');
      return order;
    }
    if (tenant?.preferredExternalProvider === 'openai') {
      push('openai');
      push('gemini');
      return order;
    }

    push('gemini');
    push('openai');
    return order;
  }

  private runGenerate(
    providerId: 'gemini' | 'openai',
    input: AiInferenceInput,
    enriched: Awaited<ReturnType<AiContextService['enrich']>>,
    started: number,
  ) {
    if (providerId === 'gemini') return this.gemini.generate(input, enriched, started);
    return this.openai.generate(input, enriched, started);
  }

  private runStream(
    providerId: 'gemini' | 'openai',
    input: AiInferenceInput,
    enriched: Awaited<ReturnType<AiContextService['enrich']>>,
    started: number,
  ) {
    if (providerId === 'gemini') return this.gemini.stream(input, enriched, started);
    return this.openai.stream(input, enriched, started);
  }
}

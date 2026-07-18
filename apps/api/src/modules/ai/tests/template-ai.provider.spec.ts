import { TemplateAiProvider } from '../application/services/providers/template-ai.provider';

import type { AiEnrichedContext, AiInferenceInput } from '../application/services/ai-inference.types';



describe('TemplateAiProvider', () => {

  const provider = new TemplateAiProvider();



  const baseInput: AiInferenceInput = {

    userMessage: 'Summarize allergies',

    tenantId: 'tenant-1',

    userId: 'user-1',

    conversationId: 'conv-1',

  };



  it('generates workspace guidance without exposing system prompt', async () => {

    const enriched: AiEnrichedContext = {

      systemPrompt: 'Internal system instructions',

      contextBlocks: [],

      citations: [],

      history: [],

      userParts: [{ text: 'Summarize allergies' }],

    };

    const result = await provider.generate(

      { ...baseInput, workspaceId: 'medical' },

      enriched,

      Date.now(),

    );

    expect(result.provider).toBe('template');

    expect(result.content).not.toContain('Internal system instructions');

    expect(result.content.toLowerCase()).toContain('allerg');

  });



  it('formats AI usage facts in Arabic', async () => {

    const enriched: AiEnrichedContext = {

      systemPrompt: '',

      contextBlocks: [

        'AI usage snapshot: totalMessages=17 totalTokens=2246 successes=15 failures=2 activeUsers14d=3 messagesToday=5 tokensToday=400',

      ],

      citations: [],

      history: [],

      userParts: [],

    };

    const result = await provider.generate(

      {

        ...baseInput,

        locale: 'ar',

        userMessage: 'لخص استخدام الذكاء الاصطناعي واستهلاك الرموز',

      },

      enriched,

      Date.now(),

    );

    expect(result.content).toContain('ملخص استخدام الذكاء الاصطناعي');

    expect(result.content).toContain('**17**');

    expect(result.content).toContain('**2246**');

  });



  it('formats dashboard KPI facts in Arabic', async () => {

    const enriched: AiEnrichedContext = {

      systemPrompt: '',

      contextBlocks: [

        'Dashboard snapshot: patients=120 appointmentsToday=8 revenueMonth=45000 outstanding=3200',

      ],

      citations: [],

      history: [],

      userParts: [],

    };

    const result = await provider.generate(

      { ...baseInput, locale: 'ar', userMessage: 'اشرح مؤشرات اللوحة' },

      enriched,

      Date.now(),

    );

    expect(result.content).toContain('مؤشرات اللوحة');

    expect(result.content).toContain('**120**');

  });



  it('streams content in chunks', async () => {

    const enriched: AiEnrichedContext = {

      systemPrompt: '',

      contextBlocks: [],

      citations: [],

      history: [],

      userParts: [],

    };

    const started = Date.now();

    const gen = provider.stream({ ...baseInput, workspaceId: 'billing' }, enriched, started);

    const chunks: string[] = [];

    let final;

    while (true) {

      const next = await gen.next();

      if (next.done) {

        final = next.value;

        break;

      }

      chunks.push(next.value);

    }

    expect(chunks.length).toBeGreaterThan(1);

    expect(final?.provider).toBe('template');

    expect(chunks.join('')).toBe(final?.content);

  });

});



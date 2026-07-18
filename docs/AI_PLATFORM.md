# AI Platform Design — Enterprise Healthcare Saaas Platform

Last updated: 2026-06-14

## Purpose

This document defines the AI platform strategy and architecture for the healthcare SaaS platform, including patient summaries, clinical summaries, smart search, business insights, recommendation engines, predictive analytics, AI assistant capabilities, and future AI integrations. It applies a competing-team review to identify weaknesses and propose stronger alternatives.

## Principles

- AI should augment clinical and business decisions without replacing expert judgment.
- Patient privacy and regulatory compliance are mandatory for all AI use cases.
- Models must be explainable, auditable, and governed.
- AI functionality should be incremental, tested in real workflows, and validated by domain experts.
- AI must respect tenant boundaries and data sovereignty.
- Use AI to reduce cognitive load, not to increase complexity for users.

## AI Platform Architecture

- AI Inference Engine: scalable service for model execution, including text, search, and prediction.
- Data preparation layer: cleans, normalizes, and de-identifies clinical and operational data for AI.
- Feature store: reusable signal definitions for predictive and recommendation models.
- Model registry: versioned, audited model artifacts with governance metadata.
- Prompt & policy layer: controls AI behavior, content filtering, and contextual prompting.
- Monitoring and feedback loop: tracks model performance, drift, and user feedback.
- Security and privacy gateway: enforces access control, de-identification, and audit logging.

## Patient Summaries

### Description

AI-generated patient summaries synthesize longitudinal patient information into concise, contextually relevant narratives.

### Capabilities

- Summarize visit history, diagnoses, medications, allergies, and care plans.
- Highlight recent changes, risk factors, and outstanding actions.
- Support both Arabic and English summaries with culturally appropriate language.
- Provide structured summary outputs with sections for clinical context, history, and next steps.
- Enable quick review cards for telehealth and multi-branch handoffs.

### Weaknesses and alternatives

- Weakness: pure text summaries can omit critical details or hallucinate.
  - Alternative: generate structured summaries tied to source data, with explicit references.
- Weakness: reliance on generative models may surface inaccurate clinical statements.
  - Alternative: enforce factual grounding against source records and require clinician review.

### Best approach

- Combine retrieval-augmented generation (RAG) with structured clinical facts.
- Provide an audit trail of source records used in the summary.
- Expose an edit/verification flow for clinicians to correct and save the summary.

## Clinical Summaries

### Description

Clinical summaries provide domain-specific insights for episodes of care, treatment plans, and specialty workflows.

### Capabilities

- Summarize encounter notes, treatment recommendations, and procedure outcomes.
- Generate differential diagnoses suggestions based on documented symptoms and history.
- Provide specialty-specific summaries for dental, dermatology, aesthetics, and multi-specialty encounters.
- Surface guideline adherence and care gaps.
- Support clinical handover and referral summaries.

### Weaknesses and alternatives

- Weakness: generating clinical summaries at scale can encourage overreliance on AI.
  - Alternative: treat summaries as draft notes requiring clinician affirmation.
- Weakness: specialty nuance may be lost without domain-specific models.
  - Alternative: use model fine-tuning or prompt engineering with specialty-specific templates.

## Smart Search

### Description

Smart search helps users find patients, encounters, inventory, orders, and clinical content using natural language and semantic search.

### Capabilities

- Search by symptoms, diagnoses, treatments, and patient attributes.
- Provide semantic matching for misspellings, synonyms, and local clinical terminology.
- Support Arabic and English queries with bilingual relevance.
- Include domain-aware filtering, e.g., by specialty, branch, or date range.
- Return ranked results with summary snippets and confidence scores.

### Weaknesses and alternatives

- Weakness: naive semantic search can surface irrelevant or unsafe results.
  - Alternative: combine semantic ranking with strict tenant-scoped filters and result validation.
- Weakness: search over PHI requires strict privacy controls.
  - Alternative: enforce role-based search permissions and obfuscate sensitive context in previews.

## Business Insights

### Description

AI-driven business insights provide actionable recommendations for clinic operations, revenue, and patient engagement.

### Capabilities

- Identify underperforming service lines and revenue leakage.
- Recommend appointment capacity adjustments based on demand patterns.
- Suggest patient re-engagement outreach for follow-ups or recall programs.
- Detect unusual billing patterns or compliance risks.
- Produce natural language summaries of financial and operational health.

### Weaknesses and alternatives

- Weakness: business insights may be too generic without deep domain tuning.
  - Alternative: calibrate insights with local market patterns and tenant-specific baselines.
- Weakness: insight generation may create information overload.
  - Alternative: prioritize high-impact recommendations and allow users to tune insight frequency.

## Recommendation Engine

### Description

A recommendation engine suggests actions across clinical, operational, and financial workflows.

### Capabilities

- Treatment plan suggestions based on patient profile and specialty templates.
- Appointment slot recommendations to minimize no-shows and maximize utilization.
- Inventory order recommendations aligned with usage trends and shelf-life constraints.
- Billing and coding suggestions to improve accuracy and capture revenue.
- Personalized patient communications and retention offers.

### Weaknesses and alternatives

- Weakness: recommendations can be biased or misaligned with local practice.
  - Alternative: use hybrid rules + machine learning models and allow local overrides.
- Weakness: too many recommendations can distract users.
  - Alternative: limit to top-priority suggestions and tie them to documented ROI.

## Predictive Analytics

### Description

Predictive analytics forecasts future events and outcomes to support planning and risk mitigation.

### Capabilities

- No-show prediction and demand forecasting.
- Revenue forecasting and churn risk scoring.
- Clinical risk prediction such as complication probability or admission likelihood.
- Inventory depletion forecasting and reorder timing.
- Support model explainability and confidence scores.

### Weaknesses and alternatives

- Weakness: predictive models may erode trust if they are not interpretable.
  - Alternative: use explainable AI techniques and present decision factors transparently.
- Weakness: predictions can be wrong when input data is sparse or biased.
  - Alternative: surface prediction confidence and allow users to adjust thresholds.

## AI Assistant

### Description

An AI assistant supports users with contextual guidance, natural language interactions, and task automation.- Build assistant interactions with accessible conversation controls, clear labels, and support for screen readers.
- Ensure AI-generated recommendations are presented with a strong assistive-friendly structure and explicit confidence metadata.
### Capabilities

- Clinician assistant: suggest note templates, summarize encounters, and answer workflow questions.
- Admin assistant: help with billing queries, inventory lookup, and report generation.
- Patient assistant: support appointment booking, reminders, and FAQ resolution in Arabic and English.
- Inline guidance: provide suggestions within forms, approvals, and conversation threads.

### Weaknesses and alternatives

- Weakness: conversational assistants can hallucinate or produce unsafe advice.
  - Alternative: design the assistant as an augmented interface with restricted domain actions and clearly labeled AI-generated content.
- Weakness: assistants may collect sensitive data inadvertently.
  - Alternative: identify and filter sensitive queries, and avoid generating free-form advice for regulated clinical decisions.

## Future AI Integrations

### Potential integrations

- Clinical knowledge graph connecting treatments, diagnoses, allergies, and medications.
- Medical imaging analysis for dental radiographs, dermatology, and wound evaluation.
- Voice-to-text and conversation summarization for patient intake and telehealth.
- Federated learning for cross-tenant model improvement without moving PHI.
- Regional clinical language models tuned to Arabic dialects and local medical terminology.
- Integration with national health information exchanges and public health surveillance.

### Weaknesses and alternatives

- Weakness: chasing every AI trend can dilute focus and increase risk.
  - Alternative: prioritize a small number of high-value, safe AI use cases and validate them before expansion.
- Weakness: future integrations may create regulatory complexity.
  - Alternative: define a clear AI safety and compliance framework before adding new capabilities.

## AI Governance

- Establish an AI governance board with clinical, security, compliance, and product representation.
- Define model lifecycle management, validation, and deprecation policies.
- Maintain an AI use case catalog with risk ratings and required review processes.
- Track performance, fairness, and drift metrics.
- Ensure auditability of AI decisions and user overrides.

## Data and Privacy

- Use de-identified or pseudonymized data for model training where possible.
- Keep tenant data segregated and enforce strict access controls for AI services.
- Log all AI requests and outputs for audit and quality review.
- Comply with regional regulations for health data, including GDPR-equivalent requirements and any local Syrian rules.

## Model Registry & Governance Lifecycle (Implemented)

This section documents the implemented AI Model Registry bounded context (`apps/api/src/modules/ai`). It is the first concrete slice of the broader AI platform and establishes the governance, security, and lifecycle controls that every future AI capability (summaries, search, predictions, assistants) plugs into.

### Bounded context

- **Domain layer** owns the `AiModel` aggregate, its lifecycle invariants, value objects (`AiModelStatusVO`, the centralized `AiModelType` union), and domain events.
- **Application layer** exposes CQRS command/query handlers (`create`, `validate`, `deploy`, `retire`, `get`, `list`), each resolving the tenant from `TenantContextService` and enforcing authorization through `AiPolicy`.
- **API layer** is a thin NestJS controller guarded by `AiPermissionGuard`, with an `AiDomainExceptionFilter` translating domain invariant breaches into correct HTTP status codes.
- **Infrastructure layer** provides an `InMemoryAiModelRepository` (tenant/branch/type/status filtering + pagination) behind the `AI_MODEL_REPOSITORY` port for later replacement with a persistent adapter.

### Lifecycle: `draft → validated → deployed → retired`

A model **cannot be deployed straight from draft**. It must first pass an explicit governance review (`validate`). This satisfies the platform principle that "models must be explainable, auditable, and governed" and the AI Governance requirement for a validation gate before any model influences clinical or operational decisions.

| Transition | Guarding rule |
| --- | --- |
| `create` → `draft` | Bilingual name/description, type, version, and author required. |
| `draft` → `validated` | Reviewer must differ from the creator (separation of duties); retired/deployed/already-validated models are rejected. |
| `validated` → `deployed` | Deploy is rejected unless the model is in `validated` state. |
| any active → `retired` | Terminal; retired models cannot be validated or deployed. |

### Domain events

Each transition emits a uniquely-identified domain event (`AiModelCreated`, `AiModelValidated`, `AiModelDeployed`, `AiModelRetired`). Event IDs use `randomUUID()` so that two events produced within the same millisecond remain distinct — a prerequisite for reliable audit trails and idempotent downstream consumers.

### RBAC tiers and separation of duties

`AiPolicy` defines two tiers, directly implementing the SECURITY.md separation-of-duties requirement:

- **Authoring tier** (`admin`, `tenant_admin`, `ai_admin`, `ai_manager`) — create, read, and list models (`canManageModels`).
- **Governance tier** (`admin`, `tenant_admin`, `ai_admin`) — review/validate (`canReviewModels`) and operate, i.e. deploy/retire (`canOperateModels`).

The `ai_manager` role can author models but cannot, by itself, validate or deploy them. Combined with the aggregate rule that a creator cannot validate their own model, this guarantees at least two distinct actors are involved before any model reaches production.

### Competing-team critique and chosen alternatives

- **Weakness:** the original implementation allowed `draft → deployed` with no review, which for healthcare AI is a patient-safety violation.
  - **Chosen alternative:** introduce an explicit `validated` state and a hard deploy gate enforced in the aggregate (not just the handler), so the invariant cannot be bypassed by any caller.
- **Weakness:** a single role could both author and operate a model.
  - **Chosen alternative:** tiered `AiPolicy` plus an aggregate-level "creator ≠ validator" rule.
- **Weakness:** event IDs were derived from `modelId + timestamp`, risking collisions.
  - **Chosen alternative:** `randomUUID()` per event.
- **Weakness:** the `AiModelType` union was duplicated across DTO, command, and entity.
  - **Chosen alternative:** a single `AI_MODEL_TYPES` source of truth with a type guard.
- **Weakness:** domain invariant errors surfaced as HTTP 500.
  - **Chosen alternative:** `AiDomainExceptionFilter` maps state-transition violations to `409 Conflict` and other invariant breaches to `422 Unprocessable Entity`.

### Known follow-ups

- The permission guard still trusts roles from the authenticated request context; hardening identity/role provenance is a platform-wide concern tracked in SECURITY.md.
- Error messages are currently English-only; bilingual error messaging is a pending enhancement consistent with the platform's Arabic/English requirement.
- The in-memory repository is a development adapter; a persistent, tenant-isolated store is required for production.

## Built-in Clinic Assistant (Phase 7 — implemented)

The production chat assistant uses a **built-in skill layer** by default (`AI_BUILTIN_ONLY=true`). External LLM providers (Gemini/OpenAI) are optional and disabled unless explicitly enabled.

### Flow

```
User message / palette ask
  → AiIntentRouterService (phrase scoring + optional forceSkillId)
  → AiSkillExecutorService (Prisma + GlobalSearchHandler)
  → Formatted markdown answer with citations
```

If no skill matches, `TemplateAiProvider` supplies general workspace guidance.

### Skill catalog

| Skill ID | Data source |
|----------|----------------|
| `appointments.today` | Appointment schedule for current UTC day |
| `patient.summary` | Patient chart + encounters (or search-by-name fallback) |
| `search.patients` | `GlobalSearchHandler` (`GET /search?types=patient`) |
| `billing.outstanding` | Invoice aggregates and aging |
| `dashboard.snapshot` | Dashboard KPI counts |
| `ai.usage` | `ai_usage_daily` aggregates |
| `app.help` | Contextual smart-action suggestions |

### Command palette integration

Registry commands may set `skillId`. Palette `ask` and `action` selections pass `forceSkillId` in conversation context so inference routes deterministically. Workspace/plan gating mirrors the command resolver via `aiWorkspaceAllowed`.

## Admin AI Console (Phase 8 — implemented)

Tenant administrators with `api.ai` approve permission can open **AI Admin** (`/ai/admin`) for governance dashboards backed by `GET /ai/admin/overview`.

### Overview payload

| Section | Source |
|---------|--------|
| Usage (daily + monthly) | `ai_usage_daily` aggregates |
| Top users | `ai_usage_daily` grouped by user |
| Provider health | `AiInferenceService.getProviderHealth()` |
| Feature flags | `AI_BUILTIN_ONLY` + subscription limits |
| Tenant limits / RPM | `AiSubscriptionService.getLimits()` |
| Cost estimate | Token totals × configurable USD rate when external providers allowed |
| Provider / skill breakdown | Recent `audit_entry` rows (`ai.inference.completed`) |
| Audit log | Last 25 inference audit entries |
| Skill catalog | `AI_SKILL_REGISTRY` |

### Audit trail

Every successful inference (sync and stream finalize) writes an `audit_entry` via `AiInferenceAuditService` with provider, model, optional `skillId`, token count, and latency.

### Provider management & switching

Tenants store provider governance in `ai_tenant_settings` (`settingsJson.providers`):

| Field | Purpose |
|-------|---------|
| `preferredExternalProvider` | `auto`, `gemini`, or `openai` — tenant default when skills do not match |
| `geminiEnabled` / `openaiEnabled` | Per-tenant enablement flags |

- `GET /ai/admin/providers` — read management snapshot
- `PATCH /ai/admin/providers` — update tenant routing (requires approve; blocked when `AI_BUILTIN_ONLY=true` or plan disallows external providers)

Inference merges tenant settings with per-user `preferredProvider` (user wins when set). Changes are audit-logged (`ai.admin.provider.updated`).

## Accessibility (Phase 9 — implemented)

Enterprise AI surfaces follow WCAG-oriented patterns across chat, command palette, sidebar, and modals.

| Area | Implementation |
|------|----------------|
| Keyboard navigation | Command palette arrows/Home/End/Enter; conversation list arrows/Home/End; sidebar Escape; skip link to `#ai-main` |
| Focus management | `useFocusTrap` + `useRestoreFocus` on overlays (`AiModal`, command palette, sidebar) |
| Escape behavior | Command palette, sidebar, prompt modals, delete confirm |
| Screen readers | `role="log"` chat thread, `role="alert"` errors, `aria-live` streaming status, message `article` labels, chart sr-only data tables |
| ARIA labels | Icon buttons (rename/export/stop), command listbox `aria-activedescendant`, `aria-expanded` on sidebar trigger, `aria-pressed` on favorites |
| Loading states | `aria-busy` + `role="status"` on lists, admin, settings, copilot, lazy routes, streaming |
| Error states | Quota/load/stream errors as alerts; admin/settings load failures surfaced |
| Streaming interruption | `AbortController` on stream fetch + Stop button in composer |
| Responsive | Existing breakpoints preserved; touch-friendly chip padding (44px min-height) |

Shared helpers live in `features/ai/lib/ai-a11y.ts`. E2E axe coverage: `e2e/ai-a11y.spec.ts` (overview, chat, prompts, sidebar, mobile viewport, keyboard dismiss).

## Testing (Phase 10 — implemented)

Production-grade automated coverage across the AI module:

| Layer | Location | Status |
|-------|----------|--------|
| API unit + integration | `apps/api/src/modules/ai/tests/` | **180** Jest tests (handlers, inference, skills, prompts, admin, subscription, providers, guards) |
| Frontend unit | `apps/clinic-dashboard/src/features/ai/**/*.spec.ts` | **23** Vitest tests (route context, commands, prompts, a11y, subscription, smart actions) |
| E2E accessibility | `apps/clinic-dashboard/e2e/ai-a11y.spec.ts` | **7** Playwright tests (axe WCAG 2 AA on overview/chat/prompts/sidebar/mobile; keyboard dismiss) |

### Run commands

```bash
# API AI tests
cd apps/api && npm test -- src/modules/ai

# Frontend AI unit tests
cd apps/clinic-dashboard && npm test -- src/features/ai

# AI E2E (requires Playwright browsers: npx playwright install chromium)
cd apps/clinic-dashboard && npx playwright test e2e/ai-a11y.spec.ts
```

### API

- `GET /ai/admin/overview` — full dashboard (requires approve)
- `GET /ai/admin/usage` — usage slice (requires approve)

## Conclusion

The AI platform should focus on safe augmentation of clinical and business workflows, not on generative features for their own sake. The strongest approach is to combine structured data, explainable models, feedback loops, and clear governance. Start with grounded summarization, smart search, and business insights while preserving clinician control and tenant safety.

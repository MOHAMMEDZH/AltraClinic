/**
 * Phase 41e — Notification Delivery Operational Runbook
 *
 * Queue topology (validated): single BullMQ queue `notification-delivery` with channel field
 * partitioning. Physical per-channel queues are optional and not required for production scale
 * at current volume; JobQueueService + DeliveryWorkerService provide lease, retry, and DLQ.
 *
 * ## Worker environment matrix
 * DeliveryWorkerService / JobWorkerService start only when BOTH are true:
 * - `NODE_ENV` is **not** `test`
 * - `BACKGROUND_WORKERS_ENABLED` is **not** the string `false`
 *
 * | Environment | Workers |
 * |-------------|---------|
 * | `NODE_ENV=test` (Jest / default apps/api `.env` for local DB tests) | **Disabled** |
 * | `NODE_ENV=development` + `BACKGROUND_WORKERS_ENABLED` unset/true | **Enabled** |
 * | `NODE_ENV=production` + `BACKGROUND_WORKERS_ENABLED` unset/true | **Enabled** |
 * | Any env with `BACKGROUND_WORKERS_ENABLED=false` | **Disabled** |
 *
 * Playwright (`playwright.config.ts` apiServer) forces `NODE_ENV=development` and
 * `BACKGROUND_WORKERS_ENABLED=true` so delivery workers connect during E2E.
 *
 * Startup evidence (structured JSON logs from DeliveryWorkerService):
 * - `kind=notification.delivery.worker` `event=initialized` (queue + processor registered)
 * - `kind=notification.delivery.worker` `event=ready` (BullMQ worker ready; Redis connected)
 * - `kind=notification.delivery.worker` `event=disabled` when workers are off
 *
 * ## Deploy
 * 1. Stop API workers if Prisma engine DLL is locked (Windows EPERM on generate).
 * 2. `cd apps/api && npx prisma generate`
 * 3. `npx prisma migrate deploy` (applies `20260717180000_phase41d_notification_delivery_engine`)
 * 4. Start API with `NODE_ENV=development|production`, `BACKGROUND_WORKERS_ENABLED=true`, and `BACKGROUND_SCHEDULERS_ENABLED=true`
 * 5. Confirm Redis reachable; confirm queue `notification-delivery` accepts jobs
 * 6. Confirm worker ready log for queue `notification-delivery`
 *
 * ## Provider configuration
 * - EMAIL_ADAPTER=smtp|resend (never console in production)
 * - SMS: Twilio env vars via SMS_SENDER provider
 * - WHATSAPP_ADAPTER=twilio-content + TWILIO_* WhatsApp vars (fail-closed if missing)
 * - PUSH: FCM credentials via PUSH_SENDER
 * - Webhook: HTTPS endpoints only; HMAC `X-Booking-Signature`; SSRF blocked
 *
 * ## Rollback
 * - Feature: set workers off / stop enqueue to `notification-delivery`
 * - Config UI: `VITE_USE_STATIC_NOTIFICATION_ONLY=true` on port 5183 (config platform only)
 * - DB: reverse migration only with explicit DBA approval (drop 41d tables in reverse FK order)
 *
 * ## Monitoring
 * - QueueMetricsService Redis counters: depth / processed / failed for `notification-delivery*`
 * - Structured logs: `kind=notification.delivery.activity` (PHI-free)
 * - Communication history: GET /notifications/communication-history
 *
 * ## Runtime gate (local verification)
 * `node scripts/phase41e-runtime-gate.mjs` — creates an in-app delivery, processes if needed,
 * then exercises retry → dead_letter via non-prod `metadata.deliveryGateForceFail` (never production).
 *
 * ## Troubleshooting
 * - Dual path: legacy `notifications` queue only drains pre-41d QUEUED rows without deliveryEngine
 * - Consent/preference denials appear as activity events blocked_consent / blocked_preference
 * - WhatsApp never routes through SMS
 * - Playwright login: use GET `/auth/me` for `userId` — LoginResponseDto does not include user
 */

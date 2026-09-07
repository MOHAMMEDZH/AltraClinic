-- Flexible Step 27 — Platform notification preferences (additive).
-- Contract: docs/NOTIFICATIONS_AND_TEMPLATES.md
-- No auto-sent notifications. No duplicate delivery engine tables.
-- No Step 28 schema. No PHI/secrets columns.

CREATE TABLE IF NOT EXISTS "platform_notification_preferences" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "platformUserId" UUID NOT NULL,
  "category" VARCHAR(64) NOT NULL,
  "channel" VARCHAR(32) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "locale" VARCHAR(16) NOT NULL DEFAULT 'en-US',
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "platform_notification_preferences_platformUserId_fkey"
    FOREIGN KEY ("platformUserId") REFERENCES "platform_users"("id") ON DELETE CASCADE,
  CONSTRAINT "platform_notification_preferences_category_check"
    CHECK ("category" IN ('security','lifecycle','commercial','usage','operational','sales','sales_manager')),
  CONSTRAINT "platform_notification_preferences_channel_check"
    CHECK ("channel" IN ('email','in-app'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_notification_preferences_user_cat_ch_uidx"
  ON "platform_notification_preferences" ("platformUserId", "category", "channel");
CREATE INDEX IF NOT EXISTS "platform_notification_preferences_user_cat_idx"
  ON "platform_notification_preferences" ("platformUserId", "category");

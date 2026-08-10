-- Phase 47 Step 08 DB security gate — additive concurrency constraints
--
-- Compatibility: if legacy data has multiple pending invitations per Platform User,
-- keep the newest pending row (createdAt DESC, id DESC) and mark older pending rows
-- as superseded before creating the partial unique index. History is retained.

UPDATE "platform_user_invitations" AS inv
SET
  "status" = 'superseded',
  "updatedAt" = CURRENT_TIMESTAMP
FROM (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY "platformUserId"
        ORDER BY "createdAt" DESC, id DESC
      ) AS rn
    FROM "platform_user_invitations"
    WHERE "status" = 'pending'
  ) ranked
  WHERE rn > 1
) older
WHERE inv.id = older.id
  AND inv."status" = 'pending';

-- One pending invitation per Platform User (resend must supersede first).
CREATE UNIQUE INDEX IF NOT EXISTS "platform_user_invitations_one_pending_per_user"
  ON "platform_user_invitations" ("platformUserId")
  WHERE "status" = 'pending';

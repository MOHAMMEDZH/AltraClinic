-- =============================================================================
-- Database Triggers
-- Run after every `prisma migrate deploy` in all environments.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Audit entries immutability guard
--    Prevents any UPDATE or DELETE on audit_entries (append-only enforcement).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'audit_entries is append-only. Operation % is forbidden on this table.',
    TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS audit_entries_immutable ON audit_entries;
CREATE TRIGGER audit_entries_immutable
  BEFORE UPDATE OR DELETE ON audit_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

RAISE NOTICE 'Triggers applied successfully.';

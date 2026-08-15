-- Phase 48 Wave B — Appointment.snapshotWriteMode immutability (additive)
-- Historical provenance must not change via ordinary runtime updates.

CREATE OR REPLACE FUNCTION prevent_appointment_snapshot_write_mode_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."snapshotWriteMode" IS DISTINCT FROM NEW."snapshotWriteMode" THEN
    RAISE EXCEPTION 'appointments.snapshotWriteMode is immutable after insert'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_snapshot_write_mode_immutable ON "appointments";
CREATE TRIGGER appointments_snapshot_write_mode_immutable
  BEFORE UPDATE ON "appointments"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_appointment_snapshot_write_mode_mutation();

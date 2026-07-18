import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasPermission } from '@booking/permissions';
import { useAuth } from '@/app/providers/AuthProvider';
import { canViewDental } from '@/features/dental/config/dental-config';
import { useTreatmentPlans } from '@/features/dental/treatment-plan/useTreatmentPlan';
import { canCreateEmr, canViewEmr } from '@/features/emr/config/emr-config';
import { useCreateEncounter, useEncountersList } from '@/features/emr/hooks/useEmr';
import {
  appointmentsReturnUrl,
  beautyWorkspaceFromAppointment,
  clinicalNotesFromAppointment,
  dentalChartFromAppointment,
  patientProfileFromAppointment,
  treatmentPlanFromAppointment,
} from '@/lib/appointment-clinical-nav';
import { canViewBeauty } from '@/features/beauty/config/beauty-config';
import type { AppointmentListItem } from '../types/scheduling.types';

export function useAppointmentClinicalLinks(appointment: AppointmentListItem | null) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const roles = user?.roles ?? [];
  const clinicianId = user?.userId ?? '';

  const emrPerm = useCallback(
    (action: string) => hasPermission(roles, 'api.emr', action as never),
    [roles],
  );
  const dentalPerm = useCallback(
    (action: string) => hasPermission(roles, 'api.dental', action as never),
    [roles],
  );
  const beautyPerm = useCallback(
    (action: string) => hasPermission(roles, 'api.beauty', action as never),
    [roles],
  );
  const patientPerm = useCallback(
    (action: string) => hasPermission(roles, 'api.patients', action as never),
    [roles],
  );

  const canPatient = patientPerm('view');
  const canDental = canViewDental(dentalPerm);
  const canBeauty = canViewBeauty(beautyPerm);
  const canEmr = canViewEmr(emrPerm);
  const canCreateNotes = canCreateEmr(emrPerm);

  const encountersQuery = useEncountersList(
    {
      patientId: appointment?.patientId,
      appointmentId: appointment?.id,
      limit: 1,
      offset: 0,
    },
    Boolean(appointment?.id && appointment?.patientId && canEmr),
  );

  const plansQuery = useTreatmentPlans(
    appointment?.patientId,
    Boolean(appointment?.patientId && canDental),
  );

  const createEncounterMutation = useCreateEncounter();

  const encounter = encountersQuery.data?.items[0] ?? null;
  const activePlan = plansQuery.data?.items[0] ?? null;

  const links = useMemo(() => {
    if (!appointment) return null;
    const { patientId, id: appointmentId } = appointment;
    const planSegment = activePlan?.id ?? 'active';
    return {
      patient: canPatient ? patientProfileFromAppointment(patientId, appointmentId) : null,
      chart: canDental ? dentalChartFromAppointment(patientId, appointmentId) : null,
      treatmentPlan: canDental
        ? treatmentPlanFromAppointment(patientId, appointmentId, planSegment)
        : null,
      clinicalNotes: encounter && canEmr
        ? clinicalNotesFromAppointment(patientId, appointmentId, encounter.id)
        : null,
      beauty: canBeauty ? beautyWorkspaceFromAppointment(patientId, appointmentId) : null,
      returnTo: appointmentsReturnUrl(appointmentId),
    };
  }, [appointment, activePlan?.id, canPatient, canDental, canBeauty, canEmr, encounter]);

  const openClinicalNotes = useCallback(async () => {
    if (!appointment || !canEmr) return;
    if (encounter) {
      navigate(clinicalNotesFromAppointment(appointment.patientId, appointment.id, encounter.id));
      return;
    }
    if (!canCreateNotes || !clinicianId) return;
    const result = await createEncounterMutation.mutateAsync({
      patientId: appointment.patientId,
      clinicianId,
      appointmentId: appointment.id,
      chiefComplaint: appointment.notes?.trim() || undefined,
    });
    navigate(clinicalNotesFromAppointment(appointment.patientId, appointment.id, result.id));
  }, [
    appointment,
    canEmr,
    canCreateNotes,
    clinicianId,
    createEncounterMutation,
    encounter,
    navigate,
  ]);

  return {
    links,
    encounter,
    activePlan,
    openClinicalNotes,
    loadingEncounter: encountersQuery.isLoading,
    creatingNotes: createEncounterMutation.isPending,
    canPatient,
    canDental,
    canBeauty,
    canEmr,
    canCreateNotes,
  };
}

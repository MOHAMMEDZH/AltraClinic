import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';

/**
 * Fail-closed consent gate (AR-09): required active form kinds for a clinical service
 * must have a SIGNED PatientFormInstance for the patient.
 * Does not fabricate instances from legacy dental plan consent timestamps.
 */
@Injectable()
export class RequiredConsentGateService {
  constructor(private readonly prisma: PrismaService) {}

  async assertRequiredConsentsSatisfied(input: {
    tenantId: string;
    patientId: string;
    clinicalServiceId: string;
    appointmentId?: string | null;
  }): Promise<void> {
    if (!input.tenantId?.trim() || !input.patientId?.trim() || !input.clinicalServiceId?.trim()) {
      throw new BadRequestException('tenantId, patientId, and clinicalServiceId are required');
    }

    const requirements = await this.prisma.clinicalServiceFormRequirement.findMany({
      where: {
        tenantId: input.tenantId,
        clinicalServiceId: input.clinicalServiceId,
        active: true,
        required: true,
      },
    });

    if (requirements.length === 0) return;

    const missing: string[] = [];
    for (const req of requirements) {
      const signed = await this.prisma.patientFormInstance.findFirst({
        where: {
          tenantId: input.tenantId,
          patientId: input.patientId,
          status: 'SIGNED',
          version: {
            template: {
              kind: req.formKind,
              OR: [{ tenantId: input.tenantId }, { tenantId: null }],
            },
          },
          // Applicable consent: same clinical service, or general (null service).
          // Wrong-service signed instances must not satisfy the gate.
          AND: [
            {
              OR: [
                { clinicalServiceId: input.clinicalServiceId },
                { clinicalServiceId: null },
              ],
            },
            ...(input.appointmentId
              ? [
                  {
                    OR: [
                      { appointmentId: input.appointmentId },
                      { appointmentId: null },
                    ],
                  },
                ]
              : []),
          ],
        },
        select: { id: true },
      });
      if (!signed) missing.push(req.formKind);
    }

    if (missing.length > 0) {
      throw new ForbiddenException(
        `Required consent(s) not satisfied: ${missing.join(', ')}`,
      );
    }
  }
}

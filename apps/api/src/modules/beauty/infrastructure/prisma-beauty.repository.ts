import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { BeautyService } from '../domain/entities/beauty-service.entity';
import { BeautyServiceRepository } from '../domain/repositories/beauty-service.repository.interface';

/**
 * Maps the BeautyService domain entity to the BeautyRecord + BeautyAnnotation schema.
 *
 * COMPETING ARCHITECT NOTE:
 *   Challenger: "BeautyService (session-level entity) doesn't map to BeautyAnnotation
 *   (treatment-point entity). They have different semantics."
 *   Decision: Acknowledged. The impedance mismatch exists because the schema was
 *   designed for the interactive body-map use case (pin-precise annotations),
 *   while the domain entity is a simpler service session. Mapping:
 *     - BeautyRecord (find-or-create per patient) = aggregate root
 *     - BeautyAnnotation = BeautyService instance (zone = serviceType, parameters = metadata)
 *   TODO: Align domain entity with the full body-map schema in Phase 3 when the
 *   beauty module's UI requirements are finalised.
 */
/**
 * @deprecated Unused — legacy CQRS path uses {@link InMemoryBeautyServiceRepository} instead.
 * Retained for Phase 3 migration reference. Active write path: {@link BeautyRecordService} → Prisma `beauty_records`.
 */
@Injectable()
export class PrismaBeautyRepository implements BeautyServiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(tenantId: string, service: BeautyService): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Find-or-create the BeautyRecord aggregate root for this patient
      let record = await tx.beautyRecord.findFirst({
        where: { patientId: service.patientId, tenantId },
        select: { id: true },
      });

      if (!record) {
        record = await tx.beautyRecord.create({
          data: {
            tenantId,
            patientId: service.patientId,
            bodyMapState: {},
          },
          select: { id: true },
        });
      }

      await tx.beautyAnnotation.upsert({
        where: { id: service.serviceId },
        create: {
          id: service.serviceId,
          beautyRecordId: record.id,
          tenantId,
          zone: service.serviceType,
          treatment: service.serviceType,
          coordinates: {},
          parameters: { scheduledAt: service.scheduledAt.toISOString(), clinicianId: service.clinicianId },
          recordedBy: service.clinicianId,
          recordedAt: service.scheduledAt,
          notes: service.notes?.en ?? service.notes?.ar ?? null,
        },
        update: {
          parameters: { scheduledAt: service.scheduledAt.toISOString(), clinicianId: service.clinicianId },
          notes: service.notes?.en ?? service.notes?.ar ?? null,
        },
      });
    });
  }

  async findById(tenantId: string, id: string): Promise<BeautyService | null> {
    const annotation = await this.prisma.beautyAnnotation.findFirst({
      where: { id, tenantId },
    });
    return annotation ? this.annotationToService(annotation) : null;
  }

  async findByPatient(tenantId: string, patientId: string): Promise<BeautyService[] | null> {
    const record = await this.prisma.beautyRecord.findFirst({
      where: { patientId, tenantId },
      include: { annotations: { orderBy: { recordedAt: 'desc' } } },
    });

    if (!record) return null;
    return record.annotations.map((a) => this.annotationToService(a));
  }

  private annotationToService(annotation: {
    id: string;
    zone: string;
    treatment: string;
    parameters: unknown;
    recordedBy: string;
    recordedAt: Date;
    notes: string | null;
  }): BeautyService {
    const params = annotation.parameters as { scheduledAt?: string; clinicianId?: string } | null;

    return Object.assign(Object.create(BeautyService.prototype), {
      serviceId: annotation.id,
      patientId: '',
      clinicianId: params?.clinicianId ?? annotation.recordedBy,
      serviceType: annotation.treatment,
      scheduledAt: params?.scheduledAt ? new Date(params.scheduledAt) : annotation.recordedAt,
      notes: annotation.notes ? { en: annotation.notes, ar: null } : null,
      createdAt: annotation.recordedAt,
    }) as BeautyService;
  }
}

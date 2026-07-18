import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { RegisterUserCommand } from '../commands/register-user.command';
import { User, UserRole, ALL_ROLES } from '../../domain/user.entity';
import { UserRepository } from '../../domain/user.repository.interface';
import { USER_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { PasswordHasher } from '../../infrastructure/password-hasher';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { UserRegisteredEvent } from '../../domain/events/user-registered.event';
import { SubscriptionEnforcementService } from '../../../subscription/application/services/subscription-enforcement.service';

const DOCTOR_ROLES: UserRole[] = ['doctor', 'dentist', 'specialist'] as UserRole[];

@Injectable()
export class RegisterUserHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly repo: UserRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    private readonly enforcement: SubscriptionEnforcementService,
  ) {}

  async execute(command: RegisterUserCommand): Promise<{ userId: string }> {
    const tenant = await this.tenantContext.resolve();
    const email = command.email.toLowerCase().trim();

    const existing = await this.repo.findByEmail(email, tenant.tenantId);
    if (existing) throw new ConflictException('User with this email already exists');

    const roles = Array.isArray(command.roles)
      ? (command.roles.filter((r) => ALL_ROLES.includes(r as UserRole)) as UserRole[])
      : (['patient'] as UserRole[]);

    const isStaff = roles.some((r) => r !== ('patient' as UserRole));
    const isDoctor = roles.some((r) => DOCTOR_ROLES.includes(r));

    if (isStaff) {
      await this.enforcement.enforceUserLimit(tenant.tenantId);
    }
    if (isDoctor) {
      await this.enforcement.enforceDoctorLimit(tenant.tenantId);
    }

    const hash = await PasswordHasher.hash(command.password);

    const user = User.create({
      email,
      passwordHash: hash,
      roles,
      tenantId: tenant.tenantId,
      branchId: command.branchId ?? tenant.branchId ?? null,
      firstName: command.firstName ?? '',
      lastName: command.lastName ?? '',
      firstNameAr: command.firstNameAr ?? null,
      lastNameAr: command.lastNameAr ?? null,
      phone: command.phone ?? null,
    });

    await this.repo.save(user);
    await this.eventPublisher.publish(
      new UserRegisteredEvent(tenant.tenantId, tenant.branchId ?? null, user.id, email, user.roles),
    );

    return { userId: user.id };
  }
}

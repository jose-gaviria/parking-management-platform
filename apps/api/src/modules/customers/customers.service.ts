import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listCustomers(search?: string) {
    return this.prisma.customer.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { idNumber: { contains: search } },
            ],
          }
        : undefined,
      include: {
        subscriptions: { where: { status: 'ACTIVE' } },
        agreements: { where: { status: 'ACTIVE' } },
      },
      orderBy: { name: 'asc' },
      take: 100,
    });
  }

  async createCustomer(
    dto: { kind: 'PERSON' | 'COMPANY'; name: string; idNumber?: string; phone?: string; email?: string },
    userId: string,
  ) {
    const customer = await this.prisma.customer.create({ data: dto });
    await this.audit.log({
      userId,
      action: 'CUSTOMER_CREATE',
      module: 'customers',
      entityType: 'Customer',
      entityId: customer.id,
      newValue: dto,
    });
    return customer;
  }

  async createSubscription(
    dto: {
      customerId: string;
      plate: string;
      vehicleTypeId: string;
      startsAt: string;
      endsAt: string;
      price: number;
      notes?: string;
    },
    userId: string,
  ) {
    const plate = dto.plate.trim().toUpperCase().replace(/\s+/g, '');
    const overlapping = await this.prisma.subscription.findFirst({
      where: {
        plate,
        status: 'ACTIVE',
        startsAt: { lte: new Date(dto.endsAt) },
        endsAt: { gte: new Date(dto.startsAt) },
      },
    });
    if (overlapping) {
      throw new AppException(
        'SUBSCRIPTION_OVERLAP',
        `La placa ${plate} ya tiene una mensualidad activa en ese periodo.`,
        HttpStatus.CONFLICT,
      );
    }
    const subscription = await this.prisma.subscription.create({
      data: {
        customerId: dto.customerId,
        plate,
        vehicleTypeId: dto.vehicleTypeId,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        price: dto.price,
        notes: dto.notes,
      },
    });
    await this.audit.log({
      userId,
      action: 'SUBSCRIPTION_CREATE',
      module: 'customers',
      entityType: 'Subscription',
      entityId: subscription.id,
      newValue: { plate, price: dto.price, endsAt: dto.endsAt },
    });
    return subscription;
  }

  listSubscriptions(params: { status?: string; search?: string }) {
    return this.prisma.subscription.findMany({
      where: {
        status: params.status ? (params.status as never) : undefined,
        plate: params.search ? { contains: params.search.toUpperCase() } : undefined,
      },
      include: { customer: true, vehicleType: true },
      orderBy: { endsAt: 'asc' },
      take: 200,
    });
  }

  /** Mensualidades que vencen en los próximos días (alertas). */
  expiringSoon(days = 7) {
    const now = new Date();
    const limit = new Date(now.getTime() + days * 86_400_000);
    return this.prisma.subscription.findMany({
      where: { status: 'ACTIVE', endsAt: { gte: now, lte: limit } },
      include: { customer: true },
      orderBy: { endsAt: 'asc' },
    });
  }

  async updateSubscriptionStatus(
    id: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED',
    userId: string,
  ) {
    const before = await this.prisma.subscription.findUnique({ where: { id } });
    if (!before) {
      throw new AppException('NOT_FOUND', 'La mensualidad no existe.', HttpStatus.NOT_FOUND);
    }
    const updated = await this.prisma.subscription.update({ where: { id }, data: { status } });
    await this.audit.log({
      userId,
      action: 'SUBSCRIPTION_STATUS',
      module: 'customers',
      entityType: 'Subscription',
      entityId: id,
      oldValue: { status: before.status },
      newValue: { status },
    });
    return updated;
  }

  async createAgreement(
    dto: {
      customerId: string;
      name: string;
      discountPct?: number;
      flatDiscount?: number;
      startsAt: string;
      endsAt?: string;
      notes?: string;
    },
    userId: string,
  ) {
    const agreement = await this.prisma.agreement.create({
      data: {
        customerId: dto.customerId,
        name: dto.name,
        discountPct: dto.discountPct ?? 0,
        flatDiscount: dto.flatDiscount ?? 0,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        notes: dto.notes,
      },
    });
    await this.audit.log({
      userId,
      action: 'AGREEMENT_CREATE',
      module: 'customers',
      entityType: 'Agreement',
      entityId: agreement.id,
      newValue: dto,
    });
    return agreement;
  }

  listAgreements() {
    return this.prisma.agreement.findMany({
      include: { customer: true },
      orderBy: { name: 'asc' },
    });
  }
}

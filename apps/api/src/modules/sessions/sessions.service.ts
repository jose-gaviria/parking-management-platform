import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { buildTicketCode, normalizeTicketCode } from '../../common/ticket-code';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TariffsService } from '../tariffs/tariffs.service';
import {
  calculateCharge,
  CalculationOptions,
  TariffRules,
} from '../tariffs/tariff-engine';

export interface CreateEntryInput {
  plate?: string;
  vehicleTypeId: string;
  color?: string;
  brand?: string;
  spotNumber?: string;
  driverIdNumber?: string;
  notes?: string;
  operatorId: string;
  terminal?: string;
  /** Permite segunda estancia activa para la misma placa (requiere permiso especial) */
  allowDuplicate?: boolean;
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tariffs: TariffsService,
  ) {}

  private normalizePlate(plate: string): string {
    return plate.trim().toUpperCase().replace(/\s+/g, '');
  }

  // ── Entrada ────────────────────────────────────────────────

  async createEntry(input: CreateEntryInput) {
    const isTemp = !input.plate || input.plate.trim() === '';
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Placa temporal controlada para vehículos sin placa
      let plate: string;
      if (isTemp) {
        const counter = await tx.counter.upsert({
          where: { key: 'temp-plate' },
          create: { key: 'temp-plate', value: 1 },
          update: { value: { increment: 1 } },
        });
        plate = `TMP-${String(counter.value).padStart(4, '0')}`;
      } else {
        plate = this.normalizePlate(input.plate!);
        const existing = await tx.parkingSession.findFirst({
          where: { plate, status: 'ACTIVE' },
        });
        if (existing && !input.allowDuplicate) {
          throw new AppException(
            'DUPLICATE_ACTIVE',
            `La placa ${plate} ya tiene un ingreso activo desde las ${existing.entryAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}.`,
            HttpStatus.CONFLICT,
          );
        }
      }

      // Consecutivo diario del ticket
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const counterKey = `ticket-${y}${m}${d}`;
      const counter = await tx.counter.upsert({
        where: { key: counterKey },
        create: { key: counterKey, value: 1 },
        update: { value: { increment: 1 } },
      });
      const code = buildTicketCode(now, counter.value);

      const session = await tx.parkingSession.create({
        data: {
          plate,
          isTempPlate: isTemp,
          vehicleTypeId: input.vehicleTypeId,
          color: input.color,
          brand: input.brand,
          spotNumber: input.spotNumber,
          driverIdNumber: input.driverIdNumber,
          notes: input.notes,
          entryAt: now,
          entryOperatorId: input.operatorId,
          ticket: { create: { code } },
        },
        include: { ticket: true, vehicleType: true },
      });

      await this.audit.log(
        {
          userId: input.operatorId,
          action: 'SESSION_ENTRY',
          module: 'sessions',
          entityType: 'ParkingSession',
          entityId: session.id,
          newValue: { plate, vehicleTypeId: input.vehicleTypeId, ticket: code },
          terminal: input.terminal,
        },
        tx,
      );

      return session;
    });
  }

  // ── Consulta ───────────────────────────────────────────────

  async listInside(search?: string) {
    const where: Prisma.ParkingSessionWhereInput = { status: 'ACTIVE' };
    if (search) {
      where.plate = { contains: this.normalizePlate(search) };
    }
    const sessions = await this.prisma.parkingSession.findMany({
      where,
      include: { vehicleType: true, ticket: true },
      orderBy: { entryAt: 'desc' },
    });
    return sessions;
  }

  async getById(id: string) {
    const session = await this.prisma.parkingSession.findUnique({
      where: { id },
      include: {
        vehicleType: true,
        ticket: true,
        payments: { include: { allocations: { include: { paymentMethod: true } } } },
        entryOperator: { select: { fullName: true, username: true } },
        exitOperator: { select: { fullName: true, username: true } },
        subscription: true,
        agreement: true,
        incidents: true,
      },
    });
    if (!session) {
      throw new AppException('NOT_FOUND', 'No encontramos esa estancia.', HttpStatus.NOT_FOUND);
    }
    return session;
  }

  /** Búsqueda por placa: estancias activas primero, luego historial reciente. */
  async searchByPlate(plate: string) {
    const normalized = this.normalizePlate(plate);
    const [active, recent] = await Promise.all([
      this.prisma.parkingSession.findMany({
        where: { plate: { contains: normalized }, status: 'ACTIVE' },
        include: { vehicleType: true, ticket: true },
        orderBy: { entryAt: 'desc' },
      }),
      this.prisma.parkingSession.findMany({
        where: { plate: { contains: normalized }, status: { not: 'ACTIVE' } },
        include: { vehicleType: true, ticket: true },
        orderBy: { entryAt: 'desc' },
        take: 10,
      }),
    ]);
    return { active, recent };
  }

  // ── Escaneo y liquidación ─────────────────────────────────

  /**
   * Resuelve un código escaneado/digitado y devuelve la cotización de cobro.
   * Maneja todos los casos del lector: pagado, cerrado, inexistente, inválido.
   */
  async scan(rawCode: string, opts: CalculationOptions = {}) {
    const parsed = normalizeTicketCode(rawCode);
    if (!parsed) {
      throw new AppException(
        'INVALID_CODE',
        'El código no es válido. Reintenta la lectura, digítalo manualmente o busca por placa.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { code: parsed.code },
      include: { session: { include: { vehicleType: true } } },
    });
    if (!ticket) {
      throw new AppException(
        'CODE_NOT_FOUND',
        'No encontramos un ingreso con este ticket. Verifica el código o busca por placa.',
        HttpStatus.NOT_FOUND,
      );
    }

    return this.quoteForSession(ticket.session.id, opts);
  }

  /** Cotiza el cobro de una estancia (sin efectos secundarios). */
  async quoteForSession(sessionId: string, opts: CalculationOptions = {}) {
    const session = await this.getById(sessionId);

    if (session.status === 'PAID' || session.status === 'CLOSED') {
      const lastPayment = session.payments.find((p) => p.status === 'CONFIRMED');
      throw new AppException(
        'ALREADY_PAID',
        lastPayment
          ? `Este ticket ya fue pagado el ${lastPayment.createdAt.toLocaleString('es-CO')} (comprobante ${lastPayment.receiptNumber}).`
          : 'Este vehículo ya registró su salida.',
        HttpStatus.CONFLICT,
      );
    }
    if (session.status === 'CANCELLED') {
      throw new AppException(
        'CANCELLED',
        'Esta estancia fue anulada. Consulta con tu supervisor.',
        HttpStatus.CONFLICT,
      );
    }

    const now = new Date();
    const { tariff, version } = await this.tariffs.currentVersionForVehicleType(
      session.vehicleTypeId,
    );

    // Mensualidad activa por placa → cubre el cobro
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        plate: session.plate,
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      include: { customer: true },
    });

    const calcOpts: CalculationOptions = {
      ...opts,
      subscriptionActive: Boolean(subscription),
      lostTicket: opts.lostTicket || session.lostTicket,
    };

    const rules = version.rules as unknown as TariffRules;
    const calculation = calculateCharge(rules, session.entryAt, now, calcOpts);

    return {
      session: {
        id: session.id,
        plate: session.plate,
        vehicleType: session.vehicleType,
        entryAt: session.entryAt,
        status: session.status,
        ticketCode: session.ticket?.code,
        notes: session.notes,
      },
      serverTime: now,
      tariff: { id: tariff.id, name: tariff.name, versionId: version.id, version: version.version },
      subscription: subscription
        ? {
            id: subscription.id,
            customer: subscription.customer.name,
            endsAt: subscription.endsAt,
          }
        : null,
      calculation,
      appliedOptions: calcOpts,
    };
  }

  // ── Acciones especiales (requieren autorización) ──────────

  async markLostTicket(sessionId: string, userId: string, authorizerId: string, reason: string) {
    const session = await this.getById(sessionId);
    if (session.status !== 'ACTIVE') {
      throw new AppException(
        'NOT_ACTIVE',
        'Solo se puede aplicar ticket perdido a una estancia activa.',
        HttpStatus.CONFLICT,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.parkingSession.update({
        where: { id: sessionId },
        data: { lostTicket: true },
      });
      await tx.incident.create({
        data: {
          sessionId,
          kind: 'LOST_TICKET',
          description: reason,
          createdBy: userId,
        },
      });
      await this.audit.log(
        {
          userId,
          authorizerId,
          action: 'LOST_TICKET',
          module: 'sessions',
          entityType: 'ParkingSession',
          entityId: sessionId,
          reason,
        },
        tx,
      );
    });
    return this.quoteForSession(sessionId, { lostTicket: true });
  }

  async cancelSession(sessionId: string, userId: string, authorizerId: string, reason: string) {
    const session = await this.getById(sessionId);
    if (session.status !== 'ACTIVE') {
      throw new AppException(
        'NOT_ACTIVE',
        'Solo se puede anular una estancia activa.',
        HttpStatus.CONFLICT,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.parkingSession.update({
        where: { id: sessionId },
        data: { status: 'CANCELLED', exitAt: new Date(), notes: reason },
      });
      await this.audit.log(
        {
          userId,
          authorizerId,
          action: 'SESSION_CANCEL',
          module: 'sessions',
          entityType: 'ParkingSession',
          entityId: sessionId,
          oldValue: { status: session.status },
          newValue: { status: 'CANCELLED' },
          reason,
        },
        tx,
      );
      return updated;
    });
  }

  async fixPlate(sessionId: string, newPlate: string, userId: string, authorizerId: string) {
    const session = await this.getById(sessionId);
    const plate = this.normalizePlate(newPlate);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.parkingSession.update({
        where: { id: sessionId },
        data: { plate, isTempPlate: false },
      });
      await this.audit.log(
        {
          userId,
          authorizerId,
          action: 'PLATE_FIX',
          module: 'sessions',
          entityType: 'ParkingSession',
          entityId: sessionId,
          oldValue: { plate: session.plate },
          newValue: { plate },
        },
        tx,
      );
      return updated;
    });
  }

  async registerReprint(ticketId: string, userId: string, reason: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { session: { include: { vehicleType: true } } },
    });
    if (!ticket) {
      throw new AppException('NOT_FOUND', 'El ticket no existe.', HttpStatus.NOT_FOUND);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.ticketReprint.create({
        data: { ticketId, userId, reason },
      });
      await this.audit.log(
        {
          userId,
          action: 'TICKET_REPRINT',
          module: 'tickets',
          entityType: 'Ticket',
          entityId: ticketId,
          reason,
        },
        tx,
      );
    });
    return ticket;
  }
}

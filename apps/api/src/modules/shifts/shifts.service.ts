import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async openShift(userId: string, openingCash: number) {
    if (openingCash < 0) {
      throw new AppException('INVALID_AMOUNT', 'La base inicial no puede ser negativa.');
    }
    const existing = await this.prisma.shift.findFirst({
      where: { userId, status: 'OPEN' },
    });
    if (existing) {
      throw new AppException(
        'SHIFT_ALREADY_OPEN',
        'Ya tienes un turno abierto. Ciérralo antes de abrir otro.',
        HttpStatus.CONFLICT,
      );
    }
    const shift = await this.prisma.shift.create({
      data: { userId, openingCash },
    });
    await this.audit.log({
      userId,
      action: 'SHIFT_OPEN',
      module: 'shifts',
      entityType: 'Shift',
      entityId: shift.id,
      newValue: { openingCash },
    });
    return shift;
  }

  /** Turno abierto del operador; error claro si no existe. */
  async requireOpenShift(userId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { userId, status: 'OPEN' },
    });
    if (!shift) {
      throw new AppException(
        'NO_OPEN_SHIFT',
        'No tienes un turno abierto. Abre un turno para continuar.',
        HttpStatus.CONFLICT,
      );
    }
    return shift;
  }

  async currentShift(userId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { userId, status: 'OPEN' },
    });
    if (!shift) return null;
    return this.summary(shift.id);
  }

  /** Resumen de un turno: totales por medio de pago, movimientos, efectivo esperado. */
  async summary(shiftId: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        user: { select: { username: true, fullName: true } },
        cashMovements: { orderBy: { createdAt: 'asc' } },
        payments: {
          where: { status: 'CONFIRMED' },
          include: { allocations: { include: { paymentMethod: true } } },
        },
      },
    });
    if (!shift) {
      throw new AppException('NOT_FOUND', 'El turno no existe.', HttpStatus.NOT_FOUND);
    }

    const byMethod = new Map<string, { name: string; isCash: boolean; total: number; count: number }>();
    for (const payment of shift.payments) {
      for (const alloc of payment.allocations) {
        const key = alloc.paymentMethod.code;
        const entry = byMethod.get(key) ?? {
          name: alloc.paymentMethod.name,
          isCash: alloc.paymentMethod.isCash,
          total: 0,
          count: 0,
        };
        entry.total += alloc.amount;
        entry.count += 1;
        byMethod.set(key, entry);
      }
    }

    const cashSales = [...byMethod.values()].filter((m) => m.isCash).reduce((s, m) => s + m.total, 0);
    const movementsIn = shift.cashMovements
      .filter((m) => m.type === 'IN')
      .reduce((s, m) => s + m.amount, 0);
    const movementsOut = shift.cashMovements
      .filter((m) => m.type === 'OUT')
      .reduce((s, m) => s + m.amount, 0);

    const expectedCash = shift.openingCash + cashSales + movementsIn - movementsOut;
    const totalSales = shift.payments.reduce((s, p) => s + p.amount, 0);

    return {
      shift: {
        id: shift.id,
        status: shift.status,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        openingCash: shift.openingCash,
        countedCash: shift.countedCash,
        difference: shift.difference,
        closingNotes: shift.closingNotes,
        user: shift.user,
      },
      totals: {
        totalSales,
        paymentsCount: shift.payments.length,
        byMethod: Object.fromEntries(byMethod),
        cashSales,
        movementsIn,
        movementsOut,
        expectedCash,
      },
      cashMovements: shift.cashMovements,
    };
  }

  async addCashMovement(params: {
    userId: string;
    type: 'IN' | 'OUT';
    amount: number;
    reason: string;
  }) {
    if (params.amount <= 0) {
      throw new AppException('INVALID_AMOUNT', 'El valor debe ser mayor que cero.');
    }
    const shift = await this.requireOpenShift(params.userId);
    const movement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cashMovement.create({
        data: {
          shiftId: shift.id,
          type: params.type,
          amount: params.amount,
          reason: params.reason,
          createdBy: params.userId,
        },
      });
      await this.audit.log(
        {
          userId: params.userId,
          action: params.type === 'IN' ? 'CASH_IN' : 'CASH_OUT',
          module: 'shifts',
          entityType: 'CashMovement',
          entityId: created.id,
          newValue: { amount: params.amount, reason: params.reason },
        },
        tx,
      );
      return created;
    });
    return movement;
  }

  async closeShift(userId: string, countedCash: number, notes?: string) {
    if (countedCash < 0) {
      throw new AppException('INVALID_AMOUNT', 'El efectivo contado no puede ser negativo.');
    }
    const shift = await this.requireOpenShift(userId);
    const { totals } = await this.summary(shift.id);
    const difference = countedCash - totals.expectedCash;

    const closed = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.shift.update({
        where: { id: shift.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          expectedCash: totals.expectedCash,
          countedCash,
          difference,
          closingNotes: notes,
        },
      });
      await this.audit.log(
        {
          userId,
          action: 'SHIFT_CLOSE',
          module: 'shifts',
          entityType: 'Shift',
          entityId: shift.id,
          newValue: { expectedCash: totals.expectedCash, countedCash, difference },
          reason: notes,
        },
        tx,
      );
      return updated;
    });

    return { shift: closed, summary: await this.summary(shift.id) };
  }

  listShifts(params: { from?: Date; to?: Date; userId?: string }) {
    return this.prisma.shift.findMany({
      where: {
        openedAt: { gte: params.from, lte: params.to },
        userId: params.userId,
      },
      include: { user: { select: { username: true, fullName: true } } },
      orderBy: { openedAt: 'desc' },
      take: 200,
    });
  }
}

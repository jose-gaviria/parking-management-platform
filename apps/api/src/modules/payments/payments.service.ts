import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';
import { ShiftsService } from '../shifts/shifts.service';
import { TariffsService } from '../tariffs/tariffs.service';
import { calculateCharge, TariffRules } from '../tariffs/tariff-engine';

export interface AllocationInput {
  methodCode: string;
  amount: number;
  reference?: string;
}

export interface ConfirmPaymentInput {
  sessionId: string;
  idempotencyKey: string;
  allocations: AllocationInput[];
  receivedAmount?: number;
  discountPct?: number;
  flatDiscount?: number;
  courtesy?: boolean;
  operatorId: string;
  authorizerId?: string;
  terminal?: string;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly shifts: ShiftsService,
    private readonly tariffs: TariffsService,
    private readonly billing: BillingService,
  ) {}

  /**
   * Confirma el pago y registra la salida en UNA transacción:
   * pago + allocations + comprobante + cierre de estancia + auditoría.
   * Idempotente: la misma idempotencyKey nunca genera dos cobros.
   */
  async confirmPayment(input: ConfirmPaymentInput) {
    // Idempotencia: si ya existe, devolver el pago original sin efectos
    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { allocations: { include: { paymentMethod: true } }, session: true },
    });
    if (existing) return { payment: existing, duplicated: true };

    const shift = await this.shifts.requireOpenShift(input.operatorId);
    const now = new Date();

    const result = await this.prisma.$transaction(
      async (tx) => {
        const session = await tx.parkingSession.findUnique({
          where: { id: input.sessionId },
          include: { vehicleType: true, ticket: true },
        });
        if (!session) {
          throw new AppException('NOT_FOUND', 'No encontramos esa estancia.', HttpStatus.NOT_FOUND);
        }
        if (session.status !== 'ACTIVE' && session.status !== 'PENDING_PAYMENT') {
          throw new AppException(
            'ALREADY_PAID',
            'Esta estancia ya fue pagada o cerrada.',
            HttpStatus.CONFLICT,
          );
        }

        // Recalcular en servidor — nunca confiar en montos del cliente
        const { version } = await this.tariffs.currentVersionForVehicleType(
          session.vehicleTypeId,
        );
        const subscription = await tx.subscription.findFirst({
          where: {
            plate: session.plate,
            status: 'ACTIVE',
            startsAt: { lte: now },
            endsAt: { gte: now },
          },
        });
        const rules = version.rules as unknown as TariffRules;
        const calculation = calculateCharge(rules, session.entryAt, now, {
          lostTicket: session.lostTicket,
          subscriptionActive: Boolean(subscription),
          courtesy: input.courtesy,
          discountPct: input.discountPct,
          flatDiscount: input.flatDiscount,
        });

        // Validar medios de pago
        const methods = await tx.paymentMethod.findMany({ where: { active: true } });
        const methodByCode = new Map(methods.map((m) => [m.code, m]));
        let allocations = input.allocations;

        if (calculation.total === 0) {
          // Mensualidad / cortesía / gracia: registrar con medio informativo
          const zeroCode = subscription ? 'SUBSCRIPTION' : input.courtesy ? 'COURTESY' : 'CASH';
          allocations = [{ methodCode: zeroCode, amount: 0 }];
        } else {
          if (!allocations.length) {
            throw new AppException('NO_METHOD', 'Selecciona el medio de pago.');
          }
          for (const alloc of allocations) {
            if (!methodByCode.has(alloc.methodCode)) {
              throw new AppException('BAD_METHOD', 'Medio de pago no válido.');
            }
            if (!Number.isInteger(alloc.amount) || alloc.amount < 0) {
              throw new AppException('BAD_AMOUNT', 'Los valores del pago no son válidos.');
            }
          }
          const sum = allocations.reduce((s, a) => s + a.amount, 0);
          if (sum !== calculation.total) {
            throw new AppException(
              'AMOUNT_MISMATCH',
              'El valor pagado no coincide con el total a cobrar. Verifica e intenta de nuevo.',
              HttpStatus.CONFLICT,
            );
          }
        }

        // Cambio en efectivo
        const cashAllocated = allocations
          .filter((a) => methodByCode.get(a.methodCode)?.isCash)
          .reduce((s, a) => s + a.amount, 0);
        let changeAmount: number | null = null;
        if (input.receivedAmount !== undefined && cashAllocated > 0) {
          if (input.receivedAmount < cashAllocated) {
            throw new AppException(
              'INSUFFICIENT_CASH',
              'El efectivo recibido es menor que el valor a pagar en efectivo.',
            );
          }
          changeAmount = input.receivedAmount - cashAllocated;
        }

        // Consecutivo del comprobante — único, sin reutilización
        const counter = await tx.counter.upsert({
          where: { key: 'receipt' },
          create: { key: 'receipt', value: 1 },
          update: { value: { increment: 1 } },
        });
        const receiptNumber = `RC-${String(counter.value).padStart(6, '0')}`;

        const payment = await tx.payment.create({
          data: {
            receiptNumber,
            sessionId: session.id,
            shiftId: shift.id,
            operatorId: input.operatorId,
            amount: calculation.total,
            receivedAmount: input.receivedAmount,
            changeAmount,
            idempotencyKey: input.idempotencyKey,
            allocations: {
              create: allocations.map((a) => ({
                paymentMethodId: methodByCode.get(a.methodCode)!.id,
                amount: a.amount,
                reference: a.reference,
              })),
            },
          },
          include: { allocations: { include: { paymentMethod: true } } },
        });

        // Cierre de estancia con guardia de concurrencia:
        // si otro proceso la cerró entre la lectura y aquí, count = 0 y la tx revierte todo
        const updated = await tx.parkingSession.updateMany({
          where: { id: session.id, status: { in: ['ACTIVE', 'PENDING_PAYMENT'] } },
          data: {
            status: 'CLOSED',
            exitAt: now,
            exitOperatorId: input.operatorId,
            tariffVersionId: version.id,
            billedMinutes: calculation.billedMinutes,
            subtotal: calculation.subtotal,
            discount: calculation.discount,
            tax: calculation.tax,
            total: calculation.total,
            subscriptionId: subscription?.id,
            calculationSnapshot: {
              rules,
              tariffVersion: version.version,
              calculation,
              calculatedAt: now.toISOString(),
            } as unknown as Prisma.InputJsonValue,
          },
        });
        if (updated.count !== 1) {
          throw new AppException(
            'CONCURRENT_PAYMENT',
            'Esta estancia acaba de ser cobrada en otra terminal.',
            HttpStatus.CONFLICT,
          );
        }

        await this.audit.log(
          {
            userId: input.operatorId,
            authorizerId: input.authorizerId,
            action: 'PAYMENT_CONFIRM',
            module: 'payments',
            entityType: 'Payment',
            entityId: payment.id,
            newValue: {
              receiptNumber,
              total: calculation.total,
              sessionId: session.id,
              plate: session.plate,
              discount: calculation.discount,
            },
            terminal: input.terminal,
          },
          tx,
        );

        return { payment, session, calculation };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // Factura fuera de la transacción de cobro: si falla, el pago queda intacto
    // y la factura entra en cola de reintentos.
    await this.billing.createInvoiceForSession(result.session.id).catch(() => undefined);

    return { payment: result.payment, duplicated: false };
  }

  /** Datos completos del comprobante para impresión. */
  async receiptData(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        allocations: { include: { paymentMethod: true } },
        operator: { select: { fullName: true, username: true } },
        session: { include: { vehicleType: true, ticket: true } },
      },
    });
    if (!payment) {
      throw new AppException('NOT_FOUND', 'El pago no existe.', HttpStatus.NOT_FOUND);
    }
    return payment;
  }

  /**
   * Anula un pago. Nunca borra: marca VOIDED y conserva el histórico.
   * Si la estancia se queda sin ningún pago confirmado, vuelve a quedar
   * pendiente de cobro — de lo contrario el vehículo quedaría cerrado y
   * cobrado en los reportes con un pago que ya no existe.
   */
  async voidPayment(paymentId: string, userId: string, authorizerId: string, reason: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new AppException('NOT_FOUND', 'El pago no existe.', HttpStatus.NOT_FOUND);
    }
    if (payment.status === 'VOIDED') {
      throw new AppException('ALREADY_VOIDED', 'Este pago ya fue anulado.', HttpStatus.CONFLICT);
    }
    return this.prisma.$transaction(async (tx) => {
      const voided = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'VOIDED',
          voidReason: reason,
          voidedById: authorizerId,
          voidedAt: new Date(),
        },
      });

      const stillPaid = await tx.payment.count({
        where: { sessionId: payment.sessionId, status: 'CONFIRMED' },
      });
      let sessionReopened = false;
      if (stillPaid === 0) {
        const reopened = await tx.parkingSession.updateMany({
          where: { id: payment.sessionId, status: 'CLOSED' },
          data: {
            status: 'PENDING_PAYMENT',
            exitAt: null,
            exitOperatorId: null,
            tariffVersionId: null,
            billedMinutes: null,
            subtotal: null,
            discount: 0,
            tax: 0,
            total: null,
            calculationSnapshot: Prisma.DbNull,
          },
        });
        sessionReopened = reopened.count === 1;

        // La factura asociada pierde su respaldo: queda anulada localmente.
        // Con un proveedor real de facturación electrónica esto exige nota
        // crédito (ver docs/pendientes.md).
        await tx.invoice.updateMany({
          where: { sessionId: payment.sessionId, status: { notIn: ['CANCELLED'] } },
          data: { status: 'CANCELLED' },
        });
      }

      await this.audit.log(
        {
          userId,
          authorizerId,
          action: 'PAYMENT_VOID',
          module: 'payments',
          entityType: 'Payment',
          entityId: paymentId,
          oldValue: { status: 'CONFIRMED', amount: payment.amount },
          newValue: { status: 'VOIDED', sessionReopened, sessionId: payment.sessionId },
          reason,
        },
        tx,
      );
      return { ...voided, sessionReopened };
    });
  }

  listMethods() {
    return this.prisma.paymentMethod.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }
}

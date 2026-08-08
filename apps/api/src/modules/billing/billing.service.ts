import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingProvider } from './billing-provider.interface';

export const BILLING_PROVIDER = 'BILLING_PROVIDER';

@Injectable()
export class BillingService {
  private readonly logger = new Logger('Facturación');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(BILLING_PROVIDER) private readonly provider: BillingProvider,
  ) {}

  /**
   * Crea la factura de una estancia cobrada. Si el proveedor externo falla,
   * la factura queda PENDING y se reintenta después (cola de reintentos).
   */
  async createInvoiceForSession(sessionId: string) {
    const session = await this.prisma.parkingSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.total === null) return null;

    const existing = await this.prisma.invoice.findUnique({ where: { sessionId } });
    if (existing) return existing;

    const counter = await this.prisma.counter.upsert({
      where: { key: 'invoice' },
      create: { key: 'invoice', value: 1 },
      update: { value: { increment: 1 } },
    });
    const number = `FV-${String(counter.value).padStart(6, '0')}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        number,
        sessionId,
        provider: this.provider.name,
        payload: {
          plate: session.plate,
          total: session.total,
          subtotal: session.subtotal,
          tax: session.tax,
        },
      },
    });

    await this.trySend(invoice.id);
    return this.prisma.invoice.findUnique({ where: { id: invoice.id } });
  }

  /** Envía o reintenta el envío al proveedor. Nunca lanza: registra el error. */
  async trySend(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { session: true },
    });
    if (!invoice || invoice.status === 'ACCEPTED' || invoice.status === 'CANCELLED') return;

    try {
      const result = await this.provider.createInvoice({
        invoiceNumber: invoice.number,
        sessionId: invoice.sessionId,
        plate: invoice.session.plate,
        total: invoice.session.total ?? 0,
        subtotal: invoice.session.subtotal ?? 0,
        tax: invoice.session.tax ?? 0,
        issuedAt: invoice.createdAt,
      });
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: result.ok
          ? { status: 'ACCEPTED', providerRef: result.providerRef, attempts: { increment: 1 } }
          : { status: 'PENDING', lastError: result.error, attempts: { increment: 1 } },
      });
    } catch (error) {
      this.logger.warn(`Factura ${invoice.number} pendiente: ${String(error)}`);
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { lastError: String(error), attempts: { increment: 1 } },
      });
    }
  }

  /** Reintenta todas las facturas pendientes (llamable desde admin o tarea programada). */
  async retryPending() {
    const pending = await this.prisma.invoice.findMany({
      where: { status: 'PENDING' },
      take: 50,
    });
    for (const invoice of pending) {
      await this.trySend(invoice.id);
    }
    return { retried: pending.length };
  }

  list(params: { status?: string; page?: number }) {
    const page = params.page ?? 1;
    return this.prisma.invoice.findMany({
      where: params.status ? { status: params.status as never } : undefined,
      include: { session: { select: { plate: true, exitAt: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 50,
      take: 50,
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resumen general del periodo: ventas, entradas, salidas, promedios. */
  async summary(from: Date, to: Date) {
    const [payments, entries, exits, inside, voided, lostTickets] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: 'CONFIRMED', createdAt: { gte: from, lte: to } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.parkingSession.count({ where: { entryAt: { gte: from, lte: to } } }),
      this.prisma.parkingSession.count({
        where: { exitAt: { gte: from, lte: to }, status: 'CLOSED' },
      }),
      this.prisma.parkingSession.count({ where: { status: 'ACTIVE' } }),
      this.prisma.payment.count({
        where: { status: 'VOIDED', createdAt: { gte: from, lte: to } },
      }),
      this.prisma.parkingSession.count({
        where: { lostTicket: true, entryAt: { gte: from, lte: to } },
      }),
    ]);

    const closed = await this.prisma.parkingSession.findMany({
      where: { status: 'CLOSED', exitAt: { gte: from, lte: to } },
      select: { billedMinutes: true, discount: true },
    });
    const avgStayMinutes = closed.length
      ? Math.round(closed.reduce((s, c) => s + (c.billedMinutes ?? 0), 0) / closed.length)
      : 0;
    const totalDiscounts = closed.reduce((s, c) => s + c.discount, 0);

    return {
      totalSales: payments._sum.amount ?? 0,
      paymentsCount: payments._count,
      entries,
      exits,
      currentlyInside: inside,
      avgStayMinutes,
      totalDiscounts,
      voidedPayments: voided,
      lostTickets,
    };
  }

  /** Ventas agrupadas por día, operador o medio de pago. */
  async sales(from: Date, to: Date, groupBy: 'day' | 'operator' | 'method') {
    if (groupBy === 'method') {
      const allocations = await this.prisma.paymentAllocation.findMany({
        where: { payment: { status: 'CONFIRMED', createdAt: { gte: from, lte: to } } },
        include: { paymentMethod: true },
      });
      const map = new Map<string, { label: string; total: number; count: number }>();
      for (const a of allocations) {
        const entry = map.get(a.paymentMethod.code) ?? {
          label: a.paymentMethod.name,
          total: 0,
          count: 0,
        };
        entry.total += a.amount;
        entry.count += 1;
        map.set(a.paymentMethod.code, entry);
      }
      return [...map.values()];
    }

    const payments = await this.prisma.payment.findMany({
      where: { status: 'CONFIRMED', createdAt: { gte: from, lte: to } },
      include: { operator: { select: { fullName: true } } },
    });
    const map = new Map<string, { label: string; total: number; count: number }>();
    for (const p of payments) {
      const key =
        groupBy === 'day'
          ? p.createdAt.toISOString().slice(0, 10)
          : p.operator.fullName;
      const entry = map.get(key) ?? { label: key, total: 0, count: 0 };
      entry.total += p.amount;
      entry.count += 1;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  /** Ocupación por hora del día (histograma de entradas). */
  async occupancyByHour(from: Date, to: Date) {
    const sessions = await this.prisma.parkingSession.findMany({
      where: { entryAt: { gte: from, lte: to } },
      select: { entryAt: true },
    });
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, entries: 0 }));
    for (const s of sessions) {
      hours[s.entryAt.getHours()].entries += 1;
    }
    return hours;
  }

  /** Ingresos por tipo de vehículo. */
  async salesByVehicleType(from: Date, to: Date) {
    const sessions = await this.prisma.parkingSession.findMany({
      where: { status: 'CLOSED', exitAt: { gte: from, lte: to } },
      include: { vehicleType: true },
    });
    const map = new Map<string, { label: string; total: number; count: number }>();
    for (const s of sessions) {
      const entry = map.get(s.vehicleType.code) ?? {
        label: s.vehicleType.name,
        total: 0,
        count: 0,
      };
      entry.total += s.total ?? 0;
      entry.count += 1;
      map.set(s.vehicleType.code, entry);
    }
    return [...map.values()];
  }

  /** Historial de estancias por placa. */
  plateHistory(plate: string) {
    return this.prisma.parkingSession.findMany({
      where: { plate: { contains: plate.toUpperCase() } },
      include: { vehicleType: true, ticket: true },
      orderBy: { entryAt: 'desc' },
      take: 100,
    });
  }

  /** Exportación CSV de estancias cerradas del periodo. */
  async sessionsCsv(from: Date, to: Date): Promise<string> {
    const sessions = await this.prisma.parkingSession.findMany({
      where: { entryAt: { gte: from, lte: to } },
      include: { vehicleType: true, ticket: true },
      orderBy: { entryAt: 'asc' },
    });
    const header = [
      'ticket',
      'placa',
      'tipo',
      'estado',
      'entrada',
      'salida',
      'minutos',
      'subtotal',
      'descuento',
      'impuesto',
      'total',
    ];
    const rows = sessions.map((s) =>
      [
        s.ticket?.code ?? '',
        s.plate,
        s.vehicleType.name,
        s.status,
        s.entryAt.toISOString(),
        s.exitAt?.toISOString() ?? '',
        s.billedMinutes ?? '',
        s.subtotal ?? '',
        s.discount,
        s.tax,
        s.total ?? '',
      ].map(csvCell).join(','),
    );
    // BOM para que Excel en Windows abra los acentos correctamente.
    return '﻿' + [header.map(csvCell).join(','), ...rows].join('\r\n');
  }
}

/**
 * Escapa un valor para CSV. Además neutraliza la inyección de fórmulas:
 * un nombre de tipo de vehículo como `=HYPERLINK(...)` se ejecutaría al abrir
 * el archivo en Excel o Sheets.
 */
function csvCell(value: string | number): string {
  const text = String(value);
  const neutralized = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(neutralized) ? `"${neutralized.replace(/"/g, '""')}"` : neutralized;
}

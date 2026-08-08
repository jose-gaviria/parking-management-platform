import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  userId?: string;
  authorizerId?: string;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  terminal?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Registra en auditoría. Acepta un cliente transaccional para atomicidad. */
  async log(entry: AuditEntry, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        userId: entry.userId,
        authorizerId: entry.authorizerId,
        action: entry.action,
        module: entry.module,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValue: entry.oldValue === undefined ? undefined : (entry.oldValue as Prisma.InputJsonValue),
        newValue: entry.newValue === undefined ? undefined : (entry.newValue as Prisma.InputJsonValue),
        reason: entry.reason,
        terminal: entry.terminal,
      },
    });
  }

  async search(params: {
    from?: Date;
    to?: Date;
    action?: string;
    module?: string;
    userId?: string;
    entityId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 50, 200);
    const where: Prisma.AuditLogWhereInput = {
      createdAt: {
        gte: params.from,
        lte: params.to,
      },
      action: params.action || undefined,
      module: params.module || undefined,
      userId: params.userId || undefined,
      entityId: params.entityId || undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { username: true, fullName: true } },
          authorizer: { select: { username: true, fullName: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
}

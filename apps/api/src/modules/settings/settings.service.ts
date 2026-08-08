import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/** Claves visibles sin autenticación (aparecen en tickets impresos de todas formas). */
const PUBLIC_KEYS = ['parkingName', 'address', 'phone', 'ticketFooter', 'currency'];

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getPublic() {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: PUBLIC_KEYS } },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async getAll() {
    const rows = await this.prisma.systemSetting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async update(values: Record<string, unknown>, userId: string) {
    const before = await this.getAll();
    await this.prisma.$transaction(
      Object.entries(values).map(([key, value]) =>
        this.prisma.systemSetting.upsert({
          where: { key },
          create: { key, value: value as Prisma.InputJsonValue },
          update: { value: value as Prisma.InputJsonValue },
        }),
      ),
    );
    await this.audit.log({
      userId,
      action: 'SETTINGS_UPDATE',
      module: 'settings',
      oldValue: before,
      newValue: values,
    });
    return this.getAll();
  }
}

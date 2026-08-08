import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listVehicleTypes() {
    return this.prisma.vehicleType.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createVehicleType(
    dto: { code: string; name: string; icon?: string; sortOrder?: number },
    userId: string,
  ) {
    const created = await this.prisma.vehicleType.create({
      data: { ...dto, code: dto.code.toUpperCase() },
    });
    await this.audit.log({
      userId,
      action: 'VEHICLE_TYPE_CREATE',
      module: 'catalog',
      entityType: 'VehicleType',
      entityId: created.id,
      newValue: dto,
    });
    return created;
  }

  async updateVehicleType(
    id: string,
    dto: { name?: string; icon?: string; active?: boolean; sortOrder?: number },
    userId: string,
  ) {
    const before = await this.prisma.vehicleType.findUnique({ where: { id } });
    const updated = await this.prisma.vehicleType.update({ where: { id }, data: dto });
    await this.audit.log({
      userId,
      action: 'VEHICLE_TYPE_UPDATE',
      module: 'catalog',
      entityType: 'VehicleType',
      entityId: id,
      oldValue: before ?? undefined,
      newValue: dto,
    });
    return updated;
  }
}

import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TariffRules, validateRules } from './tariff-engine';

@Injectable()
export class TariffsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.tariff.findMany({
      include: {
        vehicleType: true,
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
      orderBy: { name: 'asc' },
    });
  }

  versions(tariffId: string) {
    return this.prisma.tariffVersion.findMany({
      where: { tariffId },
      orderBy: { version: 'desc' },
    });
  }

  /** Versión vigente de la tarifa activa para un tipo de vehículo. */
  async currentVersionForVehicleType(vehicleTypeId: string) {
    const tariff = await this.prisma.tariff.findFirst({
      where: { vehicleTypeId, active: true },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!tariff || tariff.versions.length === 0) {
      throw new AppException(
        'NO_TARIFF',
        'No hay tarifa configurada para este tipo de vehículo. Avisa al administrador.',
        HttpStatus.CONFLICT,
      );
    }
    return { tariff, version: tariff.versions[0] };
  }

  /** Crea tarifa nueva con su versión 1, o nueva versión de una existente. */
  async createTariff(params: {
    name: string;
    vehicleTypeId: string;
    rules: TariffRules;
    userId: string;
  }) {
    this.assertValidRules(params.rules);
    const tariff = await this.prisma.tariff.create({
      data: {
        name: params.name,
        vehicleTypeId: params.vehicleTypeId,
        versions: {
          create: {
            version: 1,
            rules: params.rules as unknown as Prisma.InputJsonValue,
            createdById: params.userId,
          },
        },
      },
      include: { versions: true },
    });
    await this.audit.log({
      userId: params.userId,
      action: 'TARIFF_CREATE',
      module: 'tariffs',
      entityType: 'Tariff',
      entityId: tariff.id,
      newValue: { name: params.name, rules: params.rules },
    });
    return tariff;
  }

  /** Nueva versión: nunca modifica versiones anteriores (histórico intacto). */
  async addVersion(tariffId: string, rules: TariffRules, userId: string) {
    this.assertValidRules(rules);
    const last = await this.prisma.tariffVersion.findFirst({
      where: { tariffId },
      orderBy: { version: 'desc' },
    });
    if (!last) {
      throw new AppException('NOT_FOUND', 'La tarifa no existe.', HttpStatus.NOT_FOUND);
    }
    const [, created] = await this.prisma.$transaction([
      this.prisma.tariffVersion.update({
        where: { id: last.id },
        data: { validTo: new Date() },
      }),
      this.prisma.tariffVersion.create({
        data: {
          tariffId,
          version: last.version + 1,
          rules: rules as unknown as Prisma.InputJsonValue,
          createdById: userId,
        },
      }),
    ]);
    await this.audit.log({
      userId,
      action: 'TARIFF_NEW_VERSION',
      module: 'tariffs',
      entityType: 'TariffVersion',
      entityId: created.id,
      oldValue: last.rules,
      newValue: rules,
    });
    return created;
  }

  async setActive(tariffId: string, active: boolean, userId: string) {
    const tariff = await this.prisma.tariff.update({
      where: { id: tariffId },
      data: { active },
    });
    await this.audit.log({
      userId,
      action: active ? 'TARIFF_ACTIVATE' : 'TARIFF_DEACTIVATE',
      module: 'tariffs',
      entityType: 'Tariff',
      entityId: tariffId,
    });
    return tariff;
  }

  private assertValidRules(rules: TariffRules) {
    const errors = validateRules(rules);
    if (errors.length > 0) {
      throw new AppException('INVALID_RULES', errors[0], HttpStatus.BAD_REQUEST);
    }
  }
}

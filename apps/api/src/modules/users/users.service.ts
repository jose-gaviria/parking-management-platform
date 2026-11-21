import { HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AppException } from '../../common/errors/app.exception';
import { demoAccess } from '../../common/demo';
import { BCRYPT_COST, MIN_PASSWORD_LENGTH, MIN_PIN_LENGTH } from '../../common/hashing';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const users = await this.prisma.user.findMany({
      include: { roles: { include: { role: true } } },
      orderBy: { username: 'asc' },
    });
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      active: u.active,
      roles: u.roles.map((r) => r.role.code),
      createdAt: u.createdAt,
    }));
  }

  listRoles() {
    return this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
    });
  }

  async create(params: {
    username: string;
    fullName: string;
    password: string;
    pin?: string;
    roleCodes: string[];
    actorId: string;
  }) {
    const username = params.username.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new AppException('DUPLICATE_USER', 'Ese usuario ya existe.', HttpStatus.CONFLICT);
    }
    this.assertStrongPassword(params.password);
    this.assertValidPin(params.pin);
    const roles = await this.prisma.role.findMany({
      where: { code: { in: params.roleCodes } },
    });
    if (roles.length === 0) {
      throw new AppException('NO_ROLE', 'Selecciona al menos un rol válido.');
    }
    const user = await this.prisma.user.create({
      data: {
        username,
        fullName: params.fullName,
        passwordHash: await bcrypt.hash(params.password, BCRYPT_COST),
        pinHash: params.pin ? await bcrypt.hash(params.pin, BCRYPT_COST) : undefined,
        roles: { create: roles.map((r) => ({ roleId: r.id })) },
      },
    });
    await this.audit.log({
      userId: params.actorId,
      action: 'USER_CREATE',
      module: 'users',
      entityType: 'User',
      entityId: user.id,
      newValue: { username, fullName: params.fullName, roles: params.roleCodes },
    });
    return { id: user.id, username: user.username };
  }

  async update(
    id: string,
    params: {
      fullName?: string;
      password?: string;
      pin?: string;
      active?: boolean;
      roleCodes?: string[];
      actorId: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppException('NOT_FOUND', 'El usuario no existe.', HttpStatus.NOT_FOUND);
    }
    // El acceso del demo es público y fijo: nadie puede cambiarlo ni desactivarlo desde la interfaz.
    if (user.username === demoAccess()?.username) {
      throw new AppException(
        'DEMO_USER_LOCKED',
        'El usuario de demostración no se puede modificar.',
        HttpStatus.FORBIDDEN,
      );
    }
    const data: Record<string, unknown> = {};
    if (params.fullName !== undefined) data.fullName = params.fullName;
    if (params.active !== undefined) data.active = params.active;
    if (params.password) {
      this.assertStrongPassword(params.password);
      data.passwordHash = await bcrypt.hash(params.password, BCRYPT_COST);
    }
    if (params.pin) {
      this.assertValidPin(params.pin);
      data.pinHash = await bcrypt.hash(params.pin, BCRYPT_COST);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data });
      if (params.roleCodes) {
        const roles = await tx.role.findMany({ where: { code: { in: params.roleCodes } } });
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: roles.map((r) => ({ userId: id, roleId: r.id })),
        });
      }
      await this.audit.log(
        {
          userId: params.actorId,
          action: 'USER_UPDATE',
          module: 'users',
          entityType: 'User',
          entityId: id,
          newValue: {
            fullName: params.fullName,
            active: params.active,
            roles: params.roleCodes,
            passwordChanged: Boolean(params.password),
          },
        },
        tx,
      );
    });
    return { ok: true };
  }

  private assertStrongPassword(password: string) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new AppException(
        'WEAK_PASSWORD',
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      );
    }
  }

  /** El PIN autoriza cobros y anulaciones: uno de 1-2 dígitos se adivina a ojo. */
  private assertValidPin(pin?: string) {
    if (pin === undefined) return;
    if (!/^\d+$/.test(pin) || pin.length < MIN_PIN_LENGTH) {
      throw new AppException(
        'WEAK_PIN',
        `El PIN debe ser numérico y de al menos ${MIN_PIN_LENGTH} dígitos.`,
      );
    }
  }
}

import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(username: string, password: string, terminal?: string) {
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase().trim() },
      include: {
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });

    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppException(
        'BAD_CREDENTIALS',
        'Usuario o contraseña incorrectos.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const roles = user.roles.map((ur) => ur.role.code);
    const permissions = [
      ...new Set(user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code))),
    ];

    const token = await this.jwtService.signAsync({
      sub: user.id,
      username: user.username,
      fullName: user.fullName,
      roles,
      permissions,
    });

    await this.audit.log({
      userId: user.id,
      action: 'LOGIN',
      module: 'auth',
      terminal,
    });

    const openShift = await this.prisma.shift.findFirst({
      where: { userId: user.id, status: 'OPEN' },
      select: { id: true, openedAt: true, openingCash: true },
    });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        roles,
        permissions,
      },
      openShift,
    };
  }

  /**
   * Valida credencial de supervisor (username + PIN) para acciones sensibles.
   * Devuelve el id del autorizador o lanza error claro.
   */
  async validateSupervisor(username: string, pin: string, requiredPermission: string) {
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase().trim() },
      include: {
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });
    if (!user || !user.active || !user.pinHash || !(await bcrypt.compare(pin, user.pinHash))) {
      throw new AppException(
        'BAD_AUTHORIZER',
        'Credencial de autorización inválida.',
        HttpStatus.FORBIDDEN,
      );
    }
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code),
    );
    if (!permissions.includes(requiredPermission)) {
      throw new AppException(
        'AUTHORIZER_NO_PERMISSION',
        'El usuario autorizador no tiene permiso para esta acción.',
        HttpStatus.FORBIDDEN,
      );
    }
    return user.id;
  }
}

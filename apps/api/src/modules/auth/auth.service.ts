import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthAttemptsService, LOGIN_POLICY, PIN_POLICY } from './auth-attempts.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
    private readonly attempts: AuthAttemptsService,
  ) {}

  async login(username: string, password: string, terminal?: string) {
    const key = username.toLowerCase().trim();
    // El límite del ThrottlerModule es por instancia y en Vercel hay varias:
    // este bloqueo, con el contador en la BD, es el que de verdad frena.
    await this.attempts.assertNotLocked(`login:${key}`);

    const user = await this.prisma.user.findUnique({
      where: { username: key },
      include: {
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });

    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      await this.attempts.registerFailure(`login:${key}`, LOGIN_POLICY);
      await this.audit.log({
        userId: user?.id,
        action: 'LOGIN_FAILED',
        module: 'auth',
        reason: user && !user.active ? 'Usuario desactivado' : 'Credenciales incorrectas',
        terminal,
      });
      throw new AppException(
        'BAD_CREDENTIALS',
        'Usuario o contraseña incorrectos.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    await this.attempts.clear(`login:${key}`);

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
   *
   * El PIN es corto por diseño (se digita frente al cliente), así que el
   * control real contra fuerza bruta es el bloqueo por intentos: sin él,
   * un operador podría probar todo el espacio de PIN desde la propia caja.
   */
  async validateSupervisor(username: string, pin: string, requiredPermission: string) {
    const key = username.toLowerCase().trim();
    await this.attempts.assertNotLocked(`pin:${key}`);

    const user = await this.prisma.user.findUnique({
      where: { username: key },
      include: {
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });
    if (!user || !user.active || !user.pinHash || !(await bcrypt.compare(pin, user.pinHash))) {
      await this.registerPinFailure(key, requiredPermission);
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
      await this.audit.log({
        userId: user.id,
        action: 'AUTHORIZATION_DENIED',
        module: 'auth',
        reason: `Sin permiso ${requiredPermission}`,
      });
      throw new AppException(
        'AUTHORIZER_NO_PERMISSION',
        'El usuario autorizador no tiene permiso para esta acción.',
        HttpStatus.FORBIDDEN,
      );
    }
    await this.attempts.clear(`pin:${key}`);
    return user.id;
  }

  private async registerPinFailure(key: string, requiredPermission: string) {
    await this.attempts.registerFailure(`pin:${key}`, PIN_POLICY);

    // Los intentos fallidos de autorización son señal de fraude interno:
    // quedan en auditoría aunque el usuario indicado no exista.
    await this.audit.log({
      action: 'AUTHORIZATION_FAILED',
      module: 'auth',
      reason: `Autorizador "${key}" — permiso ${requiredPermission}`,
    });
  }
}

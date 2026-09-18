import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Ventana de caché del estado del usuario. Sin ella habría una consulta por
 * petición; con ella, desactivar un usuario o cambiarle el rol surte efecto
 * en segundos en lugar de esperar a que expire el token (8 h).
 */
const USER_CACHE_TTL_MS = 15_000;

interface CachedUser {
  user: AuthUser;
  expiresAt: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly cache = new Map<string, CachedUser>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException();

    let payload: { sub?: string };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (!payload.sub) throw new UnauthorizedException();

    // Estado y permisos se leen de la BD, no del token: un usuario desactivado
    // o con permisos revocados deja de tener acceso sin esperar la expiración.
    const user = await this.resolveUser(payload.sub);
    if (!user) throw new UnauthorizedException();

    (request as unknown as Record<string, unknown>).user = user;
    return true;
  }

  /** Invalida la caché de un usuario (llamar tras cambiar roles o desactivarlo). */
  invalidate(userId: string) {
    this.cache.delete(userId);
  }

  private async resolveUser(userId: string): Promise<AuthUser | null> {
    const now = Date.now();
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > now) return cached.user;

    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });
    if (!dbUser || !dbUser.active) {
      this.cache.delete(userId);
      return null;
    }

    const user: AuthUser = {
      id: dbUser.id,
      username: dbUser.username,
      fullName: dbUser.fullName,
      roles: dbUser.roles.map((ur) => ur.role.code),
      permissions: [
        ...new Set(
          dbUser.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code)),
        ),
      ],
    };

    // Poda simple: evita que la caché crezca sin límite en procesos largos.
    if (this.cache.size > 500) this.cache.clear();
    this.cache.set(userId, { user, expiresAt: now + USER_CACHE_TTL_MS });
    return user;
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

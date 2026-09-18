import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';

export interface AttemptPolicy {
  /** Intentos fallidos antes de bloquear. */
  maxFails: number;
  /** Duración del bloqueo, en segundos. */
  lockSeconds: number;
}

export const LOGIN_POLICY: AttemptPolicy = { maxFails: 8, lockSeconds: 300 };
export const PIN_POLICY: AttemptPolicy = { maxFails: 5, lockSeconds: 300 };

/**
 * Bloqueo por intentos fallidos, con el contador en la base de datos.
 *
 * Deliberadamente NO vive en memoria del proceso: la API corre en Vercel, donde
 * cada instancia tendría su propio contador y bastaría repartir los intentos
 * entre instancias para no llegar nunca al límite. El estado compartido es lo
 * único que hace que el bloqueo signifique algo.
 */
@Injectable()
export class AuthAttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lanza si la clave está bloqueada ahora mismo. */
  async assertNotLocked(key: string) {
    const row = await this.prisma.authAttempt.findUnique({ where: { key } });
    if (!row?.lockedUntil) return;
    const remainingMs = row.lockedUntil.getTime() - Date.now();
    if (remainingMs <= 0) return;
    throw new AppException(
      'TOO_MANY_ATTEMPTS',
      `Demasiados intentos fallidos. Vuelve a intentar en ${Math.ceil(remainingMs / 60_000)} minuto(s).`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /**
   * Registra un fallo y bloquea si se alcanzó el límite.
   * Se hace en una sola sentencia para que dos intentos simultáneos no puedan
   * leer el mismo contador y pisarse al escribirlo.
   */
  async registerFailure(key: string, policy: AttemptPolicy) {
    await this.prisma.$executeRaw`
      INSERT INTO auth_attempts (key, fails, locked_until, updated_at)
      VALUES (${key}, 1, NULL, NOW())
      ON CONFLICT (key) DO UPDATE SET
        fails = CASE
          WHEN auth_attempts.fails + 1 >= ${policy.maxFails} THEN 0
          ELSE auth_attempts.fails + 1
        END,
        locked_until = CASE
          WHEN auth_attempts.fails + 1 >= ${policy.maxFails}
            THEN NOW() + MAKE_INTERVAL(secs => ${policy.lockSeconds})
          ELSE auth_attempts.locked_until
        END,
        updated_at = NOW()
    `;
  }

  /** Borra el historial de fallos tras un intento correcto. */
  async clear(key: string) {
    await this.prisma.authAttempt.deleteMany({ where: { key } });
  }
}

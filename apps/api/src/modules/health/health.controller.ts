import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AppException } from '../../common/errors/app.exception';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Comprobación de vida para monitoreo externo: confirma que la función
   * arrancó **y** que alcanza la base de datos, que es el fallo más probable
   * en serverless. No expone detalles del error.
   */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get()
  async check() {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new AppException(
        'DB_UNAVAILABLE',
        'La base de datos no responde.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return {
      status: 'ok',
      database: 'ok',
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    };
  }
}

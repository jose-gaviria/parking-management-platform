import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Filtro global: nunca expone detalles técnicos al operador.
 * Los errores inesperados se registran en el log y se responde un mensaje genérico claro.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errores');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'code' in body) {
        return response.status(status).json(body);
      }
      // Errores de validación de class-validator → mensaje entendible
      if (status === HttpStatus.BAD_REQUEST) {
        const messages =
          typeof body === 'object' && body !== null && 'message' in body
            ? (body as { message: string | string[] }).message
            : 'Datos inválidos';
        return response.status(status).json({
          code: 'VALIDATION',
          message: Array.isArray(messages) ? messages[0] : messages,
        });
      }
      if (status === HttpStatus.UNAUTHORIZED) {
        return response.status(status).json({
          code: 'UNAUTHORIZED',
          message: 'Tu sesión expiró o no has iniciado sesión.',
        });
      }
      if (status === HttpStatus.FORBIDDEN) {
        return response.status(status).json({
          code: 'FORBIDDEN',
          message: 'No tienes permiso para realizar esta acción.',
        });
      }
      return response.status(status).json({
        code: 'HTTP_ERROR',
        message: 'No se pudo completar la operación. Intenta de nuevo.',
      });
    }

    this.logger.error(
      exception instanceof Error ? exception.stack ?? exception.message : String(exception),
    );
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL',
      message: 'Ocurrió un problema inesperado. Si persiste, avisa al administrador.',
    });
  }
}

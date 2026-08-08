import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Excepción de negocio: `message` es apto para mostrarse al operador tal cual.
 * `code` permite al frontend reaccionar (ej. ALREADY_PAID → mostrar comprobante).
 */
export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ code, message }, status);
  }
}

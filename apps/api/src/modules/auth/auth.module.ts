import { Global, Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';
import { AuthAttemptsService } from './auth-attempts.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const jwtExpiresIn = (process.env.JWT_EXPIRES_IN ?? '8h') as NonNullable<
  JwtModuleOptions['signOptions']
>['expiresIn'];

/**
 * El secreto JWT no tiene valor por defecto: arrancar con uno conocido
 * permitiría falsificar tokens de administrador. Si falta, el proceso no inicia.
 */
function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'test') return 'test-only-jwt-secret-not-for-production';
  throw new Error(
    secret
      ? 'JWT_SECRET es demasiado corto: usa al menos 32 caracteres (openssl rand -hex 32).'
      : 'JWT_SECRET es obligatoria. Genérala con: openssl rand -hex 32',
  );
}

@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: jwtSecret(),
      signOptions: { expiresIn: jwtExpiresIn },
    }),
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthAttemptsService],
  exports: [AuthService, AuthAttemptsService],
})
export class AuthModule {}

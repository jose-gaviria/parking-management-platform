import { Global, Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const jwtExpiresIn = (process.env.JWT_EXPIRES_IN ?? '8h') as NonNullable<
  JwtModuleOptions['signOptions']
>['expiresIn'];

@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev_only_secret',
      signOptions: { expiresIn: jwtExpiresIn },
    }),
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}

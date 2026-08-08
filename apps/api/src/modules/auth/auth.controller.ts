import { Body, Controller, Get, Ip, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';

class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Escribe tu usuario.' })
  username!: string;

  @IsString()
  @IsNotEmpty({ message: 'Escribe tu contraseña.' })
  password!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // anti fuerza bruta
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto.username, dto.password, ip);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}

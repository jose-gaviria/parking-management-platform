import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/permissions';
import { UsersService } from './users.service';

class CreateUserDto {
  @IsString() @IsNotEmpty({ message: 'Escribe el nombre de usuario.' }) username!: string;
  @IsString() @IsNotEmpty({ message: 'Escribe el nombre completo.' }) fullName!: string;
  @IsString() @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password!: string;
  @IsOptional() @IsString() pin?: string;
  @IsArray() @ArrayNotEmpty({ message: 'Selecciona al menos un rol.' }) roleCodes!: string[];
}

class UpdateUserDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsString() pin?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsArray() roleCodes?: string[];
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  list() {
    return this.users.list();
  }

  @Get('roles')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  roles() {
    return this.users.listRoles();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.users.create({ ...dto, actorId: user.id });
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser) {
    return this.users.update(id, { ...dto, actorId: user.id });
  }
}

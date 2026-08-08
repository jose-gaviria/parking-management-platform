import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/permissions';
import { SettingsService } from './settings.service';

class UpdateSettingsDto {
  @IsObject()
  values!: Record<string, unknown>;
}

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Datos públicos del establecimiento (nombre, dirección) para tickets y login. */
  @Public()
  @Get('public')
  publicSettings() {
    return this.settings.getPublic();
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  all() {
    return this.settings.getAll();
  }

  @Put()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  update(@Body() dto: UpdateSettingsDto, @CurrentUser() user: AuthUser) {
    return this.settings.update(dto.values, user.id);
  }
}

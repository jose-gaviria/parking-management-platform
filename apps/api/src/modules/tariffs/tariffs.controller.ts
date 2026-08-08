import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsObject, IsString } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/permissions';
import { TariffRules } from './tariff-engine';
import { TariffsService } from './tariffs.service';

class CreateTariffDto {
  @IsString()
  @IsNotEmpty({ message: 'La tarifa necesita un nombre.' })
  name!: string;

  @IsString()
  @IsNotEmpty()
  vehicleTypeId!: string;

  @IsObject()
  rules!: TariffRules;
}

class AddVersionDto {
  @IsObject()
  rules!: TariffRules;
}

class SetActiveDto {
  @IsBoolean()
  active!: boolean;
}

@ApiTags('tariffs')
@Controller('tariffs')
export class TariffsController {
  constructor(private readonly tariffs: TariffsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TARIFFS_VIEW)
  list() {
    return this.tariffs.list();
  }

  @Get(':id/versions')
  @RequirePermissions(PERMISSIONS.TARIFFS_VIEW)
  versions(@Param('id') id: string) {
    return this.tariffs.versions(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TARIFFS_MANAGE)
  create(@Body() dto: CreateTariffDto, @CurrentUser() user: AuthUser) {
    return this.tariffs.createTariff({ ...dto, userId: user.id });
  }

  @Post(':id/versions')
  @RequirePermissions(PERMISSIONS.TARIFFS_MANAGE)
  addVersion(@Param('id') id: string, @Body() dto: AddVersionDto, @CurrentUser() user: AuthUser) {
    return this.tariffs.addVersion(id, dto.rules, user.id);
  }

  @Patch(':id/active')
  @RequirePermissions(PERMISSIONS.TARIFFS_MANAGE)
  setActive(@Param('id') id: string, @Body() dto: SetActiveDto, @CurrentUser() user: AuthUser) {
    return this.tariffs.setActive(id, dto.active, user.id);
  }
}

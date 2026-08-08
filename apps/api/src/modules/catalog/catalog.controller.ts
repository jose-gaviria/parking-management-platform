import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/permissions';
import { CatalogService } from './catalog.service';

class VehicleTypeDto {
  @IsString() @IsNotEmpty() code!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

class UpdateVehicleTypeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('vehicle-types')
  vehicleTypes() {
    return this.catalog.listVehicleTypes();
  }

  @Post('vehicle-types')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  createVehicleType(@Body() dto: VehicleTypeDto, @CurrentUser() user: AuthUser) {
    return this.catalog.createVehicleType(dto, user.id);
  }

  @Patch('vehicle-types/:id')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  updateVehicleType(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleTypeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.updateVehicleType(id, dto, user.id);
  }
}

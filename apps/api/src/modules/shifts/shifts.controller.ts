import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/permissions';
import { ShiftsService } from './shifts.service';

class OpenShiftDto {
  @IsInt({ message: 'La base inicial debe ser un valor en pesos.' })
  @Min(0)
  openingCash!: number;
}

class CloseShiftDto {
  @IsInt({ message: 'El efectivo contado debe ser un valor en pesos.' })
  @Min(0)
  countedCash!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

class CashMovementDto {
  @IsIn(['IN', 'OUT'])
  type!: 'IN' | 'OUT';

  @IsInt()
  @Min(1, { message: 'El valor debe ser mayor que cero.' })
  amount!: number;

  @IsString()
  @IsNotEmpty({ message: 'Indica el motivo del movimiento.' })
  reason!: string;
}

@ApiTags('shifts')
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Post('open')
  @RequirePermissions(PERMISSIONS.SHIFTS_OPEN)
  open(@Body() dto: OpenShiftDto, @CurrentUser() user: AuthUser) {
    return this.shifts.openShift(user.id, dto.openingCash);
  }

  @Get('current')
  current(@CurrentUser() user: AuthUser) {
    return this.shifts.currentShift(user.id);
  }

  @Post('close')
  @RequirePermissions(PERMISSIONS.SHIFTS_CLOSE)
  close(@Body() dto: CloseShiftDto, @CurrentUser() user: AuthUser) {
    return this.shifts.closeShift(user.id, dto.countedCash, dto.notes);
  }

  @Post('cash-movements')
  @RequirePermissions(PERMISSIONS.CASH_MOVEMENTS)
  cashMovement(@Body() dto: CashMovementDto, @CurrentUser() user: AuthUser) {
    return this.shifts.addCashMovement({ userId: user.id, ...dto });
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SHIFTS_VIEW_ALL)
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
  ) {
    return this.shifts.listShifts({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      userId,
    });
  }

  @Get(':id/summary')
  @RequirePermissions(PERMISSIONS.SHIFTS_VIEW_ALL)
  summary(@Param('id') id: string) {
    return this.shifts.summary(id);
  }
}

import { Body, Controller, Get, Ip, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppException } from '../../common/errors/app.exception';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/permissions';
import { AuthService } from '../auth/auth.service';
import { SessionsService } from './sessions.service';

class CreateEntryDto {
  @IsOptional()
  @IsString()
  plate?: string;

  @IsString()
  @IsNotEmpty({ message: 'Selecciona el tipo de vehículo.' })
  vehicleTypeId!: string;

  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() spotNumber?: string;
  @IsOptional() @IsString() driverIdNumber?: string;
  @IsOptional() @IsString() notes?: string;

  /** Segundo ingreso de una placa ya activa: exige autorización de supervisor. */
  @IsOptional() @IsBoolean() allowDuplicate?: boolean;
  @IsOptional() @IsString() authorizerUsername?: string;
  @IsOptional() @IsString() authorizerPin?: string;
}

class ScanDto {
  @IsString()
  @IsNotEmpty({ message: 'Escanea o digita el código del ticket.' })
  code!: string;

  @IsOptional() @IsInt() @Min(0) @Max(100) discountPct?: number;
  @IsOptional() @IsInt() @Min(0) flatDiscount?: number;
  @IsOptional() @IsBoolean() lostTicket?: boolean;
  @IsOptional() @IsBoolean() courtesy?: boolean;
}

class AuthorizedActionDto {
  @IsString() @IsNotEmpty() authorizerUsername!: string;
  @IsString() @IsNotEmpty() authorizerPin!: string;
  @IsString() @IsNotEmpty({ message: 'Indica el motivo.' }) reason!: string;
}

class FixPlateDto extends AuthorizedActionDto {
  @IsString() @IsNotEmpty({ message: 'Escribe la placa correcta.' }) newPlate!: string;
}

class ReprintDto {
  @IsString() @IsNotEmpty({ message: 'Indica el motivo de la reimpresión.' }) reason!: string;
}

/** Query params llegan como texto: `Number('abc')` daría NaN y rompería el cálculo. */
function parsePositiveInt(raw?: string): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly auth: AuthService,
  ) {}

  @Post('entry')
  @RequirePermissions(PERMISSIONS.SESSIONS_CREATE)
  async createEntry(
    @Body() dto: CreateEntryDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    // Sin esto, cualquier operador podría saltarse el aviso de placa duplicada
    // enviando allowDuplicate: true directamente a la API.
    let authorizerId: string | undefined;
    if (dto.allowDuplicate) {
      if (!dto.authorizerUsername || !dto.authorizerPin) {
        throw new AppException(
          'NEEDS_AUTHORIZATION',
          'Registrar una placa que ya está adentro requiere autorización de un supervisor.',
        );
      }
      authorizerId = await this.auth.validateSupervisor(
        dto.authorizerUsername,
        dto.authorizerPin,
        PERMISSIONS.SESSIONS_ALLOW_DUPLICATE,
      );
    }
    const { authorizerUsername: _u, authorizerPin: _p, ...entry } = dto;
    return this.sessions.createEntry({
      ...entry,
      operatorId: user.id,
      authorizerId,
      terminal: ip,
    });
  }

  @Get('inside')
  @RequirePermissions(PERMISSIONS.SESSIONS_VIEW)
  inside(@Query('search') search?: string) {
    return this.sessions.listInside(search);
  }

  @Get('by-plate/:plate')
  @RequirePermissions(PERMISSIONS.SESSIONS_VIEW)
  byPlate(@Param('plate') plate: string) {
    return this.sessions.searchByPlate(plate);
  }

  @Post('scan')
  @RequirePermissions(PERMISSIONS.SESSIONS_CHECKOUT)
  scan(@Body() dto: ScanDto) {
    return this.sessions.scan(dto.code, {
      discountPct: dto.discountPct,
      flatDiscount: dto.flatDiscount,
      lostTicket: dto.lostTicket,
      courtesy: dto.courtesy,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SESSIONS_VIEW)
  getById(@Param('id') id: string) {
    return this.sessions.getById(id);
  }

  @Get(':id/quote')
  @RequirePermissions(PERMISSIONS.SESSIONS_CHECKOUT)
  quote(
    @Param('id') id: string,
    @Query('discountPct') discountPct?: string,
    @Query('flatDiscount') flatDiscount?: string,
    @Query('lostTicket') lostTicket?: string,
    @Query('courtesy') courtesy?: string,
  ) {
    return this.sessions.quoteForSession(id, {
      discountPct: parsePositiveInt(discountPct),
      flatDiscount: parsePositiveInt(flatDiscount),
      lostTicket: lostTicket === 'true',
      courtesy: courtesy === 'true',
    });
  }

  @Post(':id/lost-ticket')
  @RequirePermissions(PERMISSIONS.SESSIONS_CHECKOUT)
  async lostTicket(
    @Param('id') id: string,
    @Body() dto: AuthorizedActionDto,
    @CurrentUser() user: AuthUser,
  ) {
    const authorizerId = await this.auth.validateSupervisor(
      dto.authorizerUsername,
      dto.authorizerPin,
      PERMISSIONS.SESSIONS_LOST_TICKET,
    );
    return this.sessions.markLostTicket(id, user.id, authorizerId, dto.reason);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.SESSIONS_VIEW)
  async cancel(
    @Param('id') id: string,
    @Body() dto: AuthorizedActionDto,
    @CurrentUser() user: AuthUser,
  ) {
    const authorizerId = await this.auth.validateSupervisor(
      dto.authorizerUsername,
      dto.authorizerPin,
      PERMISSIONS.SESSIONS_CANCEL,
    );
    return this.sessions.cancelSession(id, user.id, authorizerId, dto.reason);
  }

  @Post(':id/fix-plate')
  @RequirePermissions(PERMISSIONS.SESSIONS_VIEW)
  async fixPlate(
    @Param('id') id: string,
    @Body() dto: FixPlateDto,
    @CurrentUser() user: AuthUser,
  ) {
    const authorizerId = await this.auth.validateSupervisor(
      dto.authorizerUsername,
      dto.authorizerPin,
      PERMISSIONS.SESSIONS_FIX_PLATE,
    );
    return this.sessions.fixPlate(id, dto.newPlate, user.id, authorizerId);
  }

  @Post('tickets/:ticketId/reprint')
  @RequirePermissions(PERMISSIONS.TICKETS_REPRINT)
  reprint(
    @Param('ticketId') ticketId: string,
    @Body() dto: ReprintDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessions.registerReprint(ticketId, user.id, dto.reason);
  }
}

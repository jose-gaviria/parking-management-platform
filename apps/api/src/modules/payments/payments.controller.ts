import { Body, Controller, Get, Ip, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppException } from '../../common/errors/app.exception';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/permissions';
import { AuthService } from '../auth/auth.service';
import { PaymentsService } from './payments.service';

class AllocationDto {
  @IsString() @IsNotEmpty() methodCode!: string;
  @IsInt() @Min(0) amount!: number;
  @IsOptional() @IsString() reference?: string;
}

class ConfirmPaymentDto {
  @IsString() @IsNotEmpty() sessionId!: string;
  @IsString() @IsNotEmpty() idempotencyKey!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations!: AllocationDto[];

  @IsOptional() @IsInt() @Min(0) receivedAmount?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) discountPct?: number;
  @IsOptional() @IsInt() @Min(0) flatDiscount?: number;
  @IsOptional() @IsBoolean() courtesy?: boolean;

  // Autorización de supervisor, requerida para descuentos y cortesías
  @IsOptional() @IsString() authorizerUsername?: string;
  @IsOptional() @IsString() authorizerPin?: string;
}

class VoidPaymentDto {
  @IsString() @IsNotEmpty() authorizerUsername!: string;
  @IsString() @IsNotEmpty() authorizerPin!: string;
  @IsString() @IsNotEmpty({ message: 'Indica el motivo de la anulación.' }) reason!: string;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly auth: AuthService,
  ) {}

  @Get('methods')
  methods() {
    return this.payments.listMethods();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PAYMENTS_CONFIRM)
  async confirm(@Body() dto: ConfirmPaymentDto, @CurrentUser() user: AuthUser, @Ip() ip: string) {
    let authorizerId: string | undefined;
    const needsAuthorization =
      (dto.discountPct && dto.discountPct > 0) ||
      (dto.flatDiscount && dto.flatDiscount > 0) ||
      dto.courtesy;
    if (needsAuthorization) {
      if (!dto.authorizerUsername || !dto.authorizerPin) {
        throw new AppException(
          'NEEDS_AUTHORIZATION',
          'Los descuentos y cortesías requieren autorización de un supervisor.',
        );
      }
      authorizerId = await this.auth.validateSupervisor(
        dto.authorizerUsername,
        dto.authorizerPin,
        PERMISSIONS.PAYMENTS_DISCOUNT,
      );
    }
    return this.payments.confirmPayment({
      sessionId: dto.sessionId,
      idempotencyKey: dto.idempotencyKey,
      allocations: dto.allocations,
      receivedAmount: dto.receivedAmount,
      discountPct: dto.discountPct,
      flatDiscount: dto.flatDiscount,
      courtesy: dto.courtesy,
      operatorId: user.id,
      authorizerId,
      terminal: ip,
    });
  }

  @Get(':id/receipt')
  @RequirePermissions(PERMISSIONS.SESSIONS_VIEW)
  receipt(@Param('id') id: string) {
    return this.payments.receiptData(id);
  }

  @Post(':id/void')
  @RequirePermissions(PERMISSIONS.SESSIONS_VIEW)
  async void(
    @Param('id') id: string,
    @Body() dto: VoidPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    const authorizerId = await this.auth.validateSupervisor(
      dto.authorizerUsername,
      dto.authorizerPin,
      PERMISSIONS.PAYMENTS_VOID,
    );
    return this.payments.voidPayment(id, user.id, authorizerId, dto.reason);
  }
}

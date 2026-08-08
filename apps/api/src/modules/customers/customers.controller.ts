import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/permissions';
import { CustomersService } from './customers.service';

class CreateCustomerDto {
  @IsIn(['PERSON', 'COMPANY']) kind!: 'PERSON' | 'COMPANY';
  @IsString() @IsNotEmpty({ message: 'Escribe el nombre.' }) name!: string;
  @IsOptional() @IsString() idNumber?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail({}, { message: 'El correo no es válido.' }) email?: string;
}

class CreateSubscriptionDto {
  @IsString() @IsNotEmpty() customerId!: string;
  @IsString() @IsNotEmpty({ message: 'Escribe la placa.' }) plate!: string;
  @IsString() @IsNotEmpty() vehicleTypeId!: string;
  @IsISO8601() startsAt!: string;
  @IsISO8601() endsAt!: string;
  @IsInt() @Min(0) price!: number;
  @IsOptional() @IsString() notes?: string;
}

class SubscriptionStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'])
  status!: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
}

class CreateAgreementDto {
  @IsString() @IsNotEmpty() customerId!: string;
  @IsString() @IsNotEmpty({ message: 'Escribe el nombre del convenio.' }) name!: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) discountPct?: number;
  @IsOptional() @IsInt() @Min(0) flatDiscount?: number;
  @IsISO8601() startsAt!: string;
  @IsOptional() @IsISO8601() endsAt?: string;
  @IsOptional() @IsString() notes?: string;
}

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CUSTOMERS_MANAGE)
  list(@Query('search') search?: string) {
    return this.customers.listCustomers(search);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CUSTOMERS_MANAGE)
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthUser) {
    return this.customers.createCustomer(dto, user.id);
  }

  @Get('subscriptions')
  @RequirePermissions(PERMISSIONS.SUBSCRIPTIONS_MANAGE)
  subscriptions(@Query('status') status?: string, @Query('search') search?: string) {
    return this.customers.listSubscriptions({ status, search });
  }

  @Get('subscriptions/expiring')
  @RequirePermissions(PERMISSIONS.SUBSCRIPTIONS_MANAGE)
  expiring(@Query('days') days?: string) {
    return this.customers.expiringSoon(days ? Number(days) : undefined);
  }

  @Post('subscriptions')
  @RequirePermissions(PERMISSIONS.SUBSCRIPTIONS_MANAGE)
  createSubscription(@Body() dto: CreateSubscriptionDto, @CurrentUser() user: AuthUser) {
    return this.customers.createSubscription(dto, user.id);
  }

  @Patch('subscriptions/:id/status')
  @RequirePermissions(PERMISSIONS.SUBSCRIPTIONS_MANAGE)
  subscriptionStatus(
    @Param('id') id: string,
    @Body() dto: SubscriptionStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customers.updateSubscriptionStatus(id, dto.status, user.id);
  }

  @Get('agreements')
  @RequirePermissions(PERMISSIONS.AGREEMENTS_MANAGE)
  agreements() {
    return this.customers.listAgreements();
  }

  @Post('agreements')
  @RequirePermissions(PERMISSIONS.AGREEMENTS_MANAGE)
  createAgreement(@Body() dto: CreateAgreementDto, @CurrentUser() user: AuthUser) {
    return this.customers.createAgreement(dto, user.id);
  }
}

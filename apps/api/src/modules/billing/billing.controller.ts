import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/permissions';
import { BillingService } from './billing.service';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('invoices')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  list(@Query('status') status?: string, @Query('page') page?: string) {
    return this.billing.list({ status, page: page ? Number(page) : undefined });
  }

  @Post('retry-pending')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  retry() {
    return this.billing.retryPending();
  }
}

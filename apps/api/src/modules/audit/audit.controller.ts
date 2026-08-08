import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/permissions';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditService } from './audit.service';

@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_VIEW)
  search(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('action') action?: string,
    @Query('module') module?: string,
    @Query('userId') userId?: string,
    @Query('entityId') entityId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.audit.search({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      action,
      module,
      userId,
      entityId,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }
}

import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/permissions';
import { ReportsService } from './reports.service';

function parseRange(from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = to ? new Date(to) : now;
  return { from: start, to: end };
}

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    const range = parseRange(from, to);
    return this.reports.summary(range.from, range.to);
  }

  @Get('sales')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  sales(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('groupBy') groupBy?: string,
  ) {
    const range = parseRange(from, to);
    const group = (['day', 'operator', 'method'].includes(groupBy ?? '') ? groupBy : 'day') as
      | 'day'
      | 'operator'
      | 'method';
    return this.reports.sales(range.from, range.to, group);
  }

  @Get('occupancy-by-hour')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  occupancy(@Query('from') from?: string, @Query('to') to?: string) {
    const range = parseRange(from, to);
    return this.reports.occupancyByHour(range.from, range.to);
  }

  @Get('sales-by-vehicle-type')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  byVehicleType(@Query('from') from?: string, @Query('to') to?: string) {
    const range = parseRange(from, to);
    return this.reports.salesByVehicleType(range.from, range.to);
  }

  @Get('plate-history/:plate')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  plateHistory(@Param('plate') plate: string) {
    return this.reports.plateHistory(plate);
  }

  @Get('sessions.csv')
  @RequirePermissions(PERMISSIONS.REPORTS_EXPORT)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="estancias.csv"')
  sessionsCsv(@Query('from') from?: string, @Query('to') to?: string) {
    const range = parseRange(from, to);
    return this.reports.sessionsCsv(range.from, range.to);
  }
}

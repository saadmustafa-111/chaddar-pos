import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import {
  DashboardService,
  DashboardSummary,
  DashboardRange,
} from './dashboard.service';

const VALID_RANGES = new Set<DashboardRange>(['7d', '30d', '3m', '6m', '1y']);

@Controller('dashboard')
@UseGuards(SessionAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Single analytics endpoint consumed by the dashboard page. The
   * `range` query parameter controls the time-series granularity and
   * KPI window. Defaults to `30d` so a freshly-mounted dashboard
   * renders something useful immediately.
   */
  @Get('summary')
  async getSummary(@Query('range') range?: string): Promise<DashboardSummary> {
    const value = range ?? '30d';
    if (!VALID_RANGES.has(value as DashboardRange)) {
      throw new BadRequestException(
        `Unsupported range '${value}'. Allowed: ${Array.from(VALID_RANGES).join(', ')}`,
      );
    }
    return this.dashboardService.getSummary(value);
  }
}

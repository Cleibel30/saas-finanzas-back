import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ValidateCompanyGuard } from '@/company/guards/validate-company/validate-company.guard';
import { DashboardService } from './dashboard.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':companyId')
  async getDashboard(
    @Param('companyId') companyId: string,
    @Query('month') month?: string,
  ): Promise<DashboardResponseDto> {
    return this.dashboardService.getDashboard(companyId, month);
  }
}

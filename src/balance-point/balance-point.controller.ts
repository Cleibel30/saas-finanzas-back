import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { BalancePointService } from './balance-point.service';
import { ValidateCompanyGuard } from '@/company/guards/validate-company/validate-company.guard';
import { AuthGuard } from '@nestjs/passport';

@Controller('balance-point')
export class BalancePointController {
    constructor(private balancePointService: BalancePointService) {}

    @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
    @Get(':companyId/:startDate/:endDate')
    async getCompanyBreakEven(@Param() params: { companyId: string, startDate: Date, endDate: Date }) {
        return this.balancePointService.getCompanyBreakEven(params.companyId, params.startDate, params.endDate);
    }
}

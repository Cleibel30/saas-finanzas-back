    import { Body, Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
    import { CashFlowService } from './cash-flow.service';
    import { AuthGuard } from '@nestjs/passport';
    import { ValidateCompanyGuard } from '@/company/guards/validate-company/validate-company.guard';
    import { CashFlowDto } from './dto/cash-flow.dto';

    @Controller('cash-flow')
    export class CashFlowController {
        constructor(private cashFlowService: CashFlowService) { }

        @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
        @Get('total-cashflow/:companyId')
        async getTotalCashFlow(@Param('companyId') companyId: string) {
            return this.cashFlowService.getTotalCashFlow(companyId);
        }

        @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
        @Get('cashflow/:companyId/:startDate/:endDate')
        async getCashFlow(
            @Param() params: CashFlowDto
        ) {
            return this.cashFlowService.getCashFlow(params.companyId, params.startDate, params.endDate);
        }
    }

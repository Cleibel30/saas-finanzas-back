import { Body, Controller, Get, Param, ParseFloatPipe, Post, Req, UseGuards } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto, getCashFlowDto } from './dto/transaction.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserDto } from '@/auth/dto/user.dto';
import { ValidateCompanyGuard } from '@/company/guards/validate-company/validate-company.guard';

@Controller('transaction')
export class TransactionController {
    constructor(private transactionService: TransactionService) { }

    @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
    @Post('create/:companyId/:dollarRate')
    async createTransactions(@Body() createTransactionDto: CreateTransactionDto[], @Param('companyId') companyId: string, @Param('dollarRate', ParseFloatPipe) dollarRate: number) {
        return this.transactionService.createTransactions(createTransactionDto, companyId, dollarRate);
    }

    @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
    @Get('get-all/:companyId')
    async getTransactionsByCompany(@Param('companyId') companyId: string, @Req() req: Request & { user: UserDto }) {
        return this.transactionService.getTransactionsByCompany(companyId, req.user.userId);
    }

    @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
    @Get('total-cashflow/:companyId')
    async getTotalCashFlow(@Param('companyId') companyId: string) {
        return this.transactionService.getTotalCashFlow(companyId);
    }

    @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
    @Get('cashflow/:companyId')
    async getCashFlow(
        @Param('companyId') companyId: string,
        @Req() req: Request & { user: UserDto },
        @Body() date: getCashFlowDto,
    ) {
        return this.transactionService.getCashFlow(companyId, date.startDate, date.endDate);
    }
}

import { Body, Controller, Get, Param, ParseFloatPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/transaction.dto';
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

}

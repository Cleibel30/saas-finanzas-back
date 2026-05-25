import { Body, Controller, Delete, Get, Param, ParseFloatPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto, GetTransactionsByDateRangeDto, UpdateTransactionDto } from './dto/transaction.dto';
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
        return this.transactionService.getTransactionsByCompany(companyId);
    }

    @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
    @Get('get-by-id/:companyId/:transactionId')
    async getTransactionById(@Param('companyId') companyId: string, @Param('transactionId') transactionId: string) {
        return this.transactionService.getTransactionById(transactionId, companyId);
    }

    @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
    @Patch('update/:companyId/:transactionId')
    async updateTransaction(@Param('companyId') companyId: string, @Param('transactionId') transactionId: string, @Body() updateTransactionDto: UpdateTransactionDto) {
        return this.transactionService.updateTransaction(transactionId, companyId, updateTransactionDto);
    }

    @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
    @Delete('delete/:companyId/:transactionId')
    async deleteTransaction(@Param('companyId') companyId: string, @Param('transactionId') transactionId: string) {
        return this.transactionService.deleteTransaction(transactionId, companyId);
    }

    @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
    @Get('get-by-date-range/:companyId/:startDate/:endDate')
    async getTransactionsByDateRange(@Param() paramas: GetTransactionsByDateRangeDto) {
        return this.transactionService.getTransactionsByDateRange(paramas.companyId, paramas.startDate, paramas.endDate);
    }

    @UseGuards(AuthGuard('jwt'), ValidateCompanyGuard)
    @Get('get-by-date-category/:companyId/:categoryId')
    async getTransactionsByCategory(@Param('companyId') companyId: string, @Param('categoryId') categoryId: string) {
        return this.transactionService.getTransactionsByCategory(companyId, categoryId);
    }
}
